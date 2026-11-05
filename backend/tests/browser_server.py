"""Local browser-test fixture. Never registered by the production application."""
import json
import os
from pathlib import Path
import sys
import tempfile
import logging
from datetime import timedelta

logging.getLogger('werkzeug').setLevel(logging.ERROR)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
temporary = tempfile.TemporaryDirectory()
os.environ['DATABASE_URL'] = 'sqlite:///' + (Path(temporary.name) / 'browser.sqlite3').as_posix()

from flask import jsonify
from sqlalchemy import delete, select
from app.main import create_app
from app.database import ActivitySubmission, AssignmentState, HintTurn, Participant, StudyEvent, SyncBatch, transaction, utcnow
from app.services.study import participant_for
import app.services.hints as hints
import app.services.study as study

app = create_app({'TESTING': True, 'GEMINI_API_KEY': 'browser-test-key', 'GEMINI_MODEL': 'browser-test-model', 'RATELIMIT_ENABLED': False, 'ALLOWED_ORIGINS': ['http://127.0.0.1:5173', 'http://127.0.0.1:5174']})
study.secrets.choice = lambda choices: choices[0]


def model_reply(_message, _step, _history, learner_context=''):
    assert json.loads(learner_context)['selected_question']['id']
    return 'Consider which smaller input can return directly. Follow what the pending parent still needs.'


hints.generate_reply = model_reply


@app.post('/__test__/reset')
def reset():
    with transaction(write=True) as db:
        for model in (HintTurn, SyncBatch, StudyEvent, ActivitySubmission, Participant):
            db.execute(delete(model))
        db.get(AssignmentState, 1).counts = {'ai': 0, 'control': 0, 'referrers': {}}
    return jsonify(ok=True)


@app.post('/__test__/overtime')
def overtime():
    with transaction(write=True) as db:
        participant_for(db, lock=True).pretest_completed_at = utcnow() - timedelta(minutes=31)
    return jsonify(ok=True)


@app.get('/__test__/records')
def records():
    with transaction() as db:
        participant = participant_for(db)
        return jsonify(condition=participant.condition, referrer=participant.referrer, gender=participant.gender, age=participant.age, degree=participant.degree, consentVersion=participant.consent_version, consentText=participant.consent_text, consentedAt=participant.consented_at.isoformat() if participant.consented_at else None, snapshot=participant.snapshot,
            submissions=[{'activityId': row.activity_id, 'elapsedMs': row.elapsed_ms, 'payload': row.payload} for row in db.scalars(select(ActivitySubmission).where(ActivitySubmission.participant_id == participant.id).order_by(ActivitySubmission.submitted_at))],
            events=[row.details for row in db.scalars(select(StudyEvent).where(StudyEvent.participant_id == participant.id))],
            hints=[{'questionId': row.question_id, 'reply': row.reply, 'message': row.message, 'context': row.context, 'model': row.model, 'status': row.status} for row in db.scalars(select(HintTurn).where(HintTurn.participant_id == participant.id).order_by(HintTurn.created_at))])


if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5001, use_reloader=False, threaded=True)
