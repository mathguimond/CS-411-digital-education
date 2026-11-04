from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import json
from unittest.mock import MagicMock, patch
from uuid import uuid4

import httpx
from google.genai import errors, types
from sqlalchemy import func, select

from app.database import ActivitySubmission, AssignmentState, HintTurn, Participant, StudyEvent, transaction, utcnow
from app.services.tutor import TutorDisabled, TutorUnavailable, generate_reply, limit_sentences
from app.services.study import assign_condition
from study_fixture import StudyCase


class EnrollmentTests(StudyCase):
    def test_recruiter_balance_breaks_global_ties_but_never_overrides_global_balance(self):
        counts = {'ai': 5, 'control': 5, 'referrers': {'jan': {'ai': 4, 'control': 1}}}
        self.assertEqual(assign_condition(counts, 'jan'), 'control')
        counts['ai'] = 4
        self.assertEqual(assign_condition(counts, 'jan'), 'ai')
    def test_authentication_and_assignment_are_server_owned(self):
        self.assertEqual(self.client.get('/api/study/session').status_code, 401)
        self.details['condition'] = 'control'
        response = self.enroll('ai')
        self.assertEqual(response.json['participant']['condition'], 'ai')
        self.assertNotIn('token', response.get_data(as_text=True))
        self.assertEqual(self.client.get('/api/study/session', headers=self.headers).json['participant'], response.json['participant'])
        self.assertEqual(self.client.get('/api/study/session', headers={'Authorization': 'Bearer ' + 'b' * 64}).status_code, 401)

    def test_enrollment_retries_do_not_create_another_participant_or_assignment(self):
        first = self.enroll()
        second = self.client.post('/api/study/enroll', json=self.details)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.json['participant'], second.json['participant'])
        with self.app.app_context(), transaction() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(Participant)), 1)
            self.assertEqual(sum(db.get(AssignmentState, 1).counts[key] for key in ['ai', 'control']), 1)
            participant = db.scalar(select(Participant))
            self.assertNotEqual(participant.token_hash, self.token)
            self.assertEqual(participant.degree, 'Computer Science')

    def test_overall_balance_is_atomic_and_recruiters_break_ties(self):
        def enroll_one(index):
            details = {**self.details, 'session_token': f'{index + 1:064x}', 'referrer': ['jan', 'mathieu', 'victor'][index % 3]}
            with self.app.test_client() as client:
                response = client.post('/api/study/enroll', json=details)
                return response.status_code
        with ThreadPoolExecutor(max_workers=6) as executor:
            self.assertTrue(all(status == 201 for status in executor.map(enroll_one, range(30))))
        with self.app.app_context(), transaction() as db:
            counts = db.get(AssignmentState, 1).counts
            self.assertEqual(counts['ai'], 15)
            self.assertEqual(counts['control'], 15)
        self.assertEqual(self.client.post('/api/study/enroll', json={**self.details, 'session_token': 'f' * 64, 'gender': 'invalid'}).status_code, 400)

    def test_input_validation_cors_and_safe_errors(self):
        for field, value in [('age', '17'), ('age', '99'), ('degree', ''), ('school_level', 'invalid'), ('referrer', 'invalid'), ('gender', None)]:
            self.assertEqual(self.client.post('/api/study/enroll', json={**self.details, field: value}).status_code, 400)
        self.assertEqual(self.client.post('/api/study/enroll', json=self.details, headers={'Origin': 'https://not-allowed.example'}).status_code, 403)
        response = self.client.options('/api/study/session', headers={'Origin': 'https://example.github.io', 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'Authorization, Content-Type'})
        self.assertEqual(response.headers.get('Access-Control-Allow-Origin'), 'https://example.github.io')
        self.assertEqual(self.client.post('/api/study/enroll', json={**self.details, 'age': '66+'}).status_code, 201)


class PersistenceTests(StudyCase):
    def setUp(self):
        super().setUp(); self.enroll()

    def test_answers_code_and_tree_edits_persist_with_idempotent_events(self):
        self.state['answers']['recursion-awareness'] = 'yes'
        self.state['answers']['recursion-before'] = 'A smaller version of the same task.'
        event = {'id': str(uuid4()), 'type': 'tree_node_edited', 'activityId': 'stairs-build', 'elapsedMs': None, 'changes': {'value': '5'}}
        batch_id = str(uuid4())
        body = {'id': batch_id, 'revision': 0, 'snapshot': self.state, 'events': [event]}
        first = self.client.put('/api/study/session', json=body, headers=self.headers)
        second = self.client.put('/api/study/session', json=body, headers=self.headers)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.json['revision'], first.json['revision'])
        restored = self.client.get('/api/study/session', headers=self.headers).json
        self.assertEqual(restored['snapshot']['answers'], self.state['answers'])
        with self.app.app_context(), transaction() as db:
            self.assertEqual(db.scalar(select(func.count()).select_from(StudyEvent)), 1)
            self.assertEqual(db.scalar(select(StudyEvent)).details['changes']['value'], '5')

    def test_conflicting_saves_and_cross_participant_state_are_rejected(self):
        self.assertEqual(self.save().status_code, 200)
        self.assertEqual(self.client.put('/api/study/session', headers=self.headers, json={'id': str(uuid4()), 'revision': 0, 'snapshot': self.state}).status_code, 409)
        self.state['condition'] = 'control'
        self.assertEqual(self.save().status_code, 403)

    def test_pretest_is_complete_before_clock_starts_and_is_saved_once(self):
        self.assertIsNone(self.remote['clock']['startedAt'])
        self.state['answers'] = {'recursion-awareness': 'yes'}
        self.assertEqual(self.submit('diagnostic', fill=False).status_code, 400)
        submission_id = str(uuid4())
        response = self.submit('diagnostic', submission_id=submission_id)
        self.assertEqual(response.status_code, 200, response.json)
        started = response.json['clock']['startedAt']
        self.assertIsNotNone(started)
        duplicate = self.submit('diagnostic', fill=False, submission_id=submission_id)
        self.assertEqual(duplicate.json['clock']['startedAt'], started)
        self.assertEqual(self.submit('diagnostic').status_code, 403)
        with self.app.app_context(), transaction() as db:
            submission = db.scalar(select(ActivitySubmission))
            self.assertEqual(submission.elapsed_ms, 0)
            self.assertIn('python-experience', submission.payload['answers'])

    def test_a_draft_save_cannot_change_a_submitted_pretest(self):
        self.submit('diagnostic')
        self.state['answers']['trace-baseline'] = '0'
        self.assertEqual(self.save().status_code, 403)

    def test_continue_ignores_tree_completion_and_records_elapsed_time(self):
        self.advance_to('stairs-build')
        self.assertEqual(self.submit('stairs-build').status_code, 200)
        self.assertEqual(len(self.state['trees']['stairs']['nodes']), 1)
        self.assertEqual(self.state['code']['memoization'], self.state['code']['stairs'])
        with self.app.app_context(), transaction() as db:
            rows = db.scalars(select(ActivitySubmission).order_by(ActivitySubmission.submitted_at)).all()
            self.assertTrue(all(row.elapsed_ms is not None and row.elapsed_ms >= 0 for row in rows))

    def test_skipping_required_responses_or_code_run_is_rejected(self):
        self.assertEqual(self.submit('stairs-build').status_code, 403)
        self.advance_to('stairs-build')
        self.state['codeRuns'] = {}
        self.assertEqual(self.submit('stairs-build', fill=False).status_code, 400)

    def test_overtime_is_allowed_and_timer_stops_before_final_questionnaire(self):
        self.advance_to('grid-optimize')
        with self.app.app_context(), transaction(write=True) as db:
            participant = db.get(Participant, self.remote['participant']['id'])
            participant.pretest_completed_at = utcnow() - timedelta(minutes=35)
        self.assertGreater(self.client.get('/api/study/session', headers=self.headers).json['clock']['elapsedMs'], 1800000)
        response = self.submit('grid-optimize')
        self.assertEqual(response.status_code, 200, response.json)
        self.assertEqual(self.state['partIndex'], 5)
        stopped = response.json['clock']['elapsedMs']
        self.assertEqual(self.submit('post-survey').status_code, 200)
        self.assertEqual(self.remote['clock']['elapsedMs'], stopped)
        self.assertTrue(self.state['surveySubmitted'])
        self.assertEqual(self.hint().status_code, 403)


class HintTests(StudyCase):
    def setUp(self):
        super().setUp(); self.enroll(); self.advance_to('recursion-components')

    @patch('app.services.hints.generate_reply', return_value='Inspect the smallest input. Follow the returned result. A third sentence is removed.')
    def test_question_budget_includes_followups_and_cannot_be_reset_by_refresh(self, model):
        request_id = str(uuid4())
        first = self.hint(request_id=request_id)
        self.assertEqual(first.status_code, 200, first.json)
        self.assertEqual(first.json['remaining'], 1)
        self.assertEqual(first.json['reply'], 'Inspect the smallest input. Follow the returned result.')
        self.assertEqual(self.hint(request_id=request_id).json['remaining'], 1)
        self.assertEqual(self.hint(message='What does that mean?').json['remaining'], 0)
        self.assertEqual(self.client.get('/api/study/session', headers=self.headers).json['hintUsage']['intro-base'], 2)
        self.assertEqual(self.hint().status_code, 409)
        self.assertEqual(model.call_count, 2)
        self.assertEqual(self.hint('intro-reduction').status_code, 200)

    @patch('app.services.hints.generate_reply', return_value='Trace a smaller input. Compare the pending frame.')
    def test_model_receives_question_previous_answers_and_prior_conversation(self, model):
        self.state['answers']['intro-base'] = 'My earlier explanation.'
        self.assertEqual(self.save().status_code, 200)
        self.hint()
        self.hint('intro-stack')
        args = model.call_args
        context = json.loads(args.kwargs['learner_context'])
        self.assertEqual(context['selected_question']['id'], 'intro-stack')
        self.assertEqual(context['answers_on_page']['intro-base'], 'My earlier explanation.')
        self.assertEqual(len(args.args[2]), 2)
        with self.app.app_context(), transaction() as db:
            turn = db.scalar(select(HintTurn).where(HintTurn.question_id == 'intro-stack'))
            self.assertEqual(turn.context['answers_on_page']['intro-base'], 'My earlier explanation.')
            self.assertEqual(turn.model, 'test-model')

    @patch('app.services.hints.generate_reply', side_effect=TutorUnavailable('quota_exceeded'))
    def test_provider_failure_does_not_spend_a_hint_or_expose_private_details(self, model):
        response = self.hint(message='Private learner text')
        self.assertEqual(response.status_code, 502)
        self.assertNotIn('Private learner text', response.get_data(as_text=True))
        self.assertEqual(self.client.get('/api/study/session', headers=self.headers).json['hintUsage'], {})

    @patch('app.services.hints.generate_reply', return_value='Inspect the smaller state.')
    def test_four_code_hints_and_transfer_help(self, model):
        self.advance_to('grid-build')
        self.save()
        for expected in [3, 2, 1, 0]:
            response = self.hint('grid-code', 'grid-build')
            self.assertEqual(response.status_code, 200, response.json)
            self.assertEqual(response.json['remaining'], expected)
        self.assertEqual(self.hint('grid-code', 'grid-build').status_code, 409)
        self.assertEqual(model.call_count, 4)

    @patch('app.services.hints.generate_reply', return_value='Inspect the smaller state.')
    def test_simultaneous_requests_cannot_exceed_the_hint_budget(self, model):
        def ask(_index):
            with self.app.test_client() as client:
                response = client.post('/api/study/hints', headers=self.headers, json={'id': str(uuid4()), 'questionId': 'intro-base', 'activityId': 'recursion-components'})
                return response.status_code
        with ThreadPoolExecutor(max_workers=6) as executor:
            statuses = list(executor.map(ask, range(12)))
        self.assertEqual(statuses.count(200), 2)
        self.assertEqual(statuses.count(409), 10)
        self.assertEqual(model.call_count, 2)

    @patch('app.services.hints.generate_reply', return_value='Inspect the smaller state.')
    def test_abandoned_hint_reservations_expire_without_spending_the_budget(self, model):
        with self.app.app_context(), transaction(write=True) as db:
            db.add(HintTurn(id=str(uuid4()), participant_id=self.remote['participant']['id'], question_id='intro-base', activity_id='recursion-components', status='pending', message='Interrupted request', created_at=utcnow() - timedelta(minutes=2), context={}))
        self.assertEqual(self.client.get('/api/study/session', headers=self.headers).json['hintUsage'], {})
        self.assertEqual(self.hint().json['remaining'], 1)
        self.assertEqual(self.hint().json['remaining'], 0)
        self.assertEqual(model.call_count, 2)

    @patch('app.services.hints.generate_reply')
    def test_no_pretest_or_survey_help_and_control_cannot_call_ai_endpoint(self, model):
        self.assertEqual(self.hint('hint-helpfulness', 'post-survey').status_code, 403)
        with self.app.app_context(), transaction(write=True) as db:
            db.get(Participant, self.remote['participant']['id']).condition = 'control'
        response = self.client.post('/api/ai/chat', headers=self.headers, json={'id': str(uuid4()), 'questionId': 'intro-base', 'activityId': 'recursion-components'})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.hint().status_code, 200)
        model.assert_not_called()


class GeminiTests(StudyCase):
    @patch('app.services.tutor.genai.Client')
    def test_sdk_policy_roles_and_two_sentence_limit(self, client):
        client.return_value.__enter__.return_value.models.generate_content.return_value = MagicMock(text='One hint. A next step. An unwanted third sentence.')
        with self.app.app_context():
            reply = generate_reply('What next?', 'ai-practice', [{'role': 'user', 'content': 'Earlier question'}, {'role': 'assistant', 'content': 'Earlier hint'}], learner_context='Current answer')
        self.assertEqual(reply, 'One hint. A next step.')
        arguments = client.return_value.__enter__.return_value.models.generate_content.call_args.kwargs
        self.assertIn('at most TWO', arguments['config'].system_instruction)
        self.assertIn('Never provide the final answer', arguments['config'].system_instruction)
        self.assertEqual([item.role for item in arguments['contents']], ['user', 'model', 'user'])
        self.assertIn('Current answer', arguments['contents'][-1].parts[0].text)
        self.assertEqual(client.call_args.kwargs['http_options'].timeout, 20000)

    @patch('app.services.tutor.genai.Client')
    def test_disabled_parts_never_contact_gemini(self, client):
        with self.app.app_context(), self.assertRaises(TutorDisabled):
            generate_reply('Help', 'ai-pretest', [])
        client.assert_not_called()

    @patch('app.services.tutor.genai.Client')
    def test_provider_status_categories_timeouts_and_empty_replies(self, client):
        generator = client.return_value.__enter__.return_value.models.generate_content
        with self.app.app_context():
            for status, category in [(401, 'authentication_failed'), (403, 'permission_denied'), (404, 'model_unavailable'), (429, 'quota_exceeded'), (503, 'provider_unavailable')]:
                generator.side_effect = errors.ClientError(status, {'error': {'message': 'sensitive provider text'}})
                with self.assertRaises(TutorUnavailable) as failure:
                    generate_reply('private answer', 'ai-practice', [])
                self.assertEqual(failure.exception.code, category)
            generator.side_effect = httpx.ReadTimeout('private timeout')
            with self.assertRaises(TutorUnavailable) as failure:
                generate_reply('Help', 'ai-practice', [])
            self.assertEqual(failure.exception.code, 'provider_timeout')
            generator.side_effect = None
            generator.return_value = types.GenerateContentResponse(candidates=[types.Candidate(finish_reason='MAX_TOKENS')])
            with self.assertRaises(TutorUnavailable) as failure:
                generate_reply('Help', 'ai-practice', [])
            self.assertEqual(failure.exception.code, 'output_limit')

    def test_length_filter_handles_questions_and_single_sentences(self):
        self.assertEqual(limit_sentences('First? Second! Third.'), 'First? Second!')
        self.assertEqual(limit_sentences('One sentence without final punctuation'), 'One sentence without final punctuation')
