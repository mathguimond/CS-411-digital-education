import copy
import hashlib
import json
import re
import secrets
from datetime import timedelta, timezone
from uuid import UUID, uuid4

from flask import request
from sqlalchemy import and_, or_, select

from app.curriculum import ACTIVITIES, LESSON, QUESTIONS, STUDY, has_response
from app.database import ActivitySubmission, AssignmentState, HintTurn, Participant, StudyEvent, SyncBatch, transaction, utcnow


class StudyError(Exception):
    def __init__(self, message, status=400, code="invalid_request"):
        self.message, self.status, self.code = message, status, code
        super().__init__(message)


def identifier(value):
    try:
        return str(UUID(value))
    except (TypeError, ValueError, AttributeError) as error:
        raise StudyError("A valid request identifier is required.") from error


def iso(value):
    return value.replace(tzinfo=value.tzinfo or timezone.utc).isoformat() if value else None


def elapsed(participant, now=None):
    if not participant.pretest_completed_at:
        return None
    stop = participant.transfer_completed_at or now or utcnow()
    start = participant.pretest_completed_at.replace(tzinfo=participant.pretest_completed_at.tzinfo or timezone.utc)
    stop = stop.replace(tzinfo=stop.tzinfo or timezone.utc)
    return max(0, round((stop - start).total_seconds() * 1000))


def token_hash(token):
    if not isinstance(token, str) or re.fullmatch(r"[a-f0-9]{64}", token) is None:
        raise StudyError("Please enter the study before opening a lesson.", 401, "unauthorized")
    return hashlib.sha256(token.encode()).hexdigest()


def participant_for(db, lock=False):
    digest = token_hash(request.headers.get("Authorization", "").removeprefix("Bearer "))
    query = select(Participant).where(Participant.token_hash == digest)
    if lock:
        query = query.with_for_update()
    participant = db.scalar(query)
    if participant is None:
        raise StudyError("Please enter the study before opening a lesson.", 401, "unauthorized")
    return participant


def assign_condition(counts, referrer):
    # Overall balance has priority; recruiter counts break overall ties.
    if counts["ai"] != counts["control"]:
        return "ai" if counts["ai"] < counts["control"] else "control"
    group = counts["referrers"].get(referrer, {"ai": 0, "control": 0})
    if group["ai"] != group["control"]:
        return "ai" if group["ai"] < group["control"] else "control"
    return secrets.choice(("ai", "control"))


def enroll(payload):
    if not isinstance(payload, dict):
        raise StudyError("Send the participant details as JSON.")
    digest = token_hash(payload.get("session_token"))
    values = {key: payload.get(key) for key in ("gender", "age", "school_level", "degree", "referrer")}
    ages = {str(age) for age in range(STUDY["minimumAge"], STUDY["maximumIndividualAge"] + 1)} | {STUDY["olderAgeOption"]}
    for field, options in (("gender", {item["id"] for item in STUDY["gender"]}), ("age", ages), ("school_level", {item["id"] for item in STUDY["schoolLevels"]}), ("referrer", {item["id"] for item in STUDY["referrers"]})):
        if not isinstance(values[field], str) or values[field] not in options:
            raise StudyError(f"Choose a valid {field.replace('_', ' ')}.")
    if not isinstance(values["degree"], str) or not 1 <= len(values["degree"].strip()) <= 200:
        raise StudyError("Enter your degree or current program, using at most 200 characters.")
    values["degree"] = values["degree"].strip()
    with transaction(write=True) as db:
        counter = db.scalar(select(AssignmentState).where(AssignmentState.id == 1).with_for_update())
        if counter is None:
            raise StudyError("Study storage has not been initialized. Please contact the organizer.", 503, "database_unavailable")
        existing = db.scalar(select(Participant).where(Participant.token_hash == digest))
        if existing:
            return session_payload(db, existing), False
        counts = copy.deepcopy(counter.counts)
        condition = assign_condition(counts, values["referrer"])
        counts[condition] += 1
        group = counts["referrers"].setdefault(values["referrer"], {"ai": 0, "control": 0})
        group[condition] += 1
        counter.counts = counts
        participant = Participant(id=str(uuid4()), token_hash=digest, **values, condition=condition, lesson_version=LESSON["version"], snapshot={}, revision=0)
        db.add(participant)
        db.flush()
        return session_payload(db, participant), True


def hint_state(db, participant_id):
    active = or_(HintTurn.status == "completed", and_(HintTurn.status == "pending", HintTurn.created_at > utcnow() - timedelta(seconds=45)))
    turns = db.scalars(select(HintTurn).where(HintTurn.participant_id == participant_id, active).order_by(HintTurn.created_at, HintTurn.id)).all()
    usage, conversation = {}, []
    for turn in turns:
        usage[turn.question_id] = usage.get(turn.question_id, 0) + 1
        if turn.status == "completed":
            tag = {"questionId": turn.question_id, "activityId": turn.activity_id, "questionTitle": QUESTIONS[turn.question_id]["prompt"]}
            conversation.extend([{"role": "user", "content": turn.message, **tag}, {"role": "assistant", "content": turn.reply, **tag}])
    return usage, conversation


def session_payload(db, participant):
    usage, conversation = hint_state(db, participant.id)
    return {
        "participant": {"id": participant.id, "condition": participant.condition, "lessonVersion": participant.lesson_version},
        "snapshot": participant.snapshot, "revision": participant.revision,
        "clock": {"startedAt": iso(participant.pretest_completed_at), "stoppedAt": iso(participant.transfer_completed_at), "elapsedMs": elapsed(participant), "serverNow": iso(utcnow())},
        "hintUsage": usage, "conversation": conversation,
    }


def validated_snapshot(value, participant):
    if not isinstance(value, dict) or len(json.dumps(value)) > 220000:
        raise StudyError("The saved lesson state is invalid or too large.")
    if value.get("sessionId") != participant.id or value.get("condition") != participant.condition:
        raise StudyError("This lesson belongs to a different participant.", 403)
    if value.get("lessonVersion") != participant.lesson_version or participant.lesson_version != LESSON["version"]:
        raise StudyError("This lesson version has changed. Please contact the organizer.", 409, "version_conflict")
    snapshot = copy.deepcopy(value)
    for field in ("answers", "code", "trees", "activityIndexByPart", "codeRuns", "lastResults"):
        if not isinstance(snapshot.get(field), dict):
            raise StudyError("The saved lesson state is incomplete.")
    if type(snapshot.get("partIndex")) is not int or not 0 <= snapshot["partIndex"] < len(LESSON["parts"]):
        raise StudyError("Invalid lesson part.")
    if participant.pretest_completed_at:
        saved_answers = participant.snapshot.get("answers", {})
        locked_fields = [question["id"] for question in LESSON["pretest"]] + [question["followUp"]["id"] for question in LESSON["pretest"] if question.get("followUp")]
        if any(snapshot["answers"].get(key) != saved_answers.get(key) for key in locked_fields):
            raise StudyError("The submitted pre-test cannot be changed.", 403, "pretest_locked")
    snapshot.pop("events", None)
    snapshot.pop("chatHistory", None)
    snapshot.pop("hintUsage", None)
    for field, timestamp in (("pretestSubmitted", participant.pretest_completed_at), ("transferSubmitted", participant.transfer_completed_at), ("surveySubmitted", participant.survey_completed_at)):
        snapshot[field] = timestamp is not None
    return snapshot


def save_events(db, participant, events):
    if not isinstance(events, list) or len(events) > 25:
        raise StudyError("Send at most 25 lesson events at a time.")
    for event in events:
        if not isinstance(event, dict) or not isinstance(event.get("type"), str) or not 1 <= len(event["type"]) <= 80:
            raise StudyError("Invalid lesson event.")
        client_id = identifier(event.get("id"))
        if db.scalar(select(StudyEvent.id).where(StudyEvent.participant_id == participant.id, StudyEvent.client_id == client_id)):
            continue
        milliseconds = event.get("elapsedMs")
        if milliseconds is not None and (type(milliseconds) is not int or not 0 <= milliseconds <= 2_147_483_647):
            raise StudyError("Invalid elapsed time.")
        if len(json.dumps(event)) > 65000:
            raise StudyError("A lesson event is too large.")
        db.add(StudyEvent(id=str(uuid4()), participant_id=participant.id, client_id=client_id, type=event["type"], activity_id=str(event.get("activityId", ""))[:80] or None, question_id=str(event.get("questionId", ""))[:80] or None, occurred_at=str(event.get("timestamp", ""))[:40] or None, elapsed_ms=milliseconds, server_elapsed_ms=elapsed(participant), details=event))


def save_snapshot(payload):
    if not isinstance(payload, dict):
        raise StudyError("Send a JSON object.")
    batch_id = identifier(payload.get("id"))
    with transaction(write=True) as db:
        participant = participant_for(db, lock=True)
        old_batch = db.get(SyncBatch, batch_id)
        if old_batch:
            if old_batch.participant_id != participant.id:
                raise StudyError("Invalid save request.", 403)
            return {"revision": participant.revision, "serverNow": iso(utcnow())}
        if participant.survey_completed_at:
            raise StudyError("This lesson has already been completed.", 403)
        if payload.get("revision") != participant.revision:
            raise StudyError("This lesson was updated in another tab. Reload before continuing.", 409, "revision_conflict")
        snapshot = validated_snapshot(payload.get("snapshot"), participant)
        for key in ("completedParts", "completedActivities", "transferStarted"):
            snapshot[key] = participant.snapshot.get(key, [] if key != "transferStarted" else False)
        save_events(db, participant, payload.get("events", []))
        participant.snapshot = snapshot
        participant.revision += 1
        db.add(SyncBatch(id=batch_id, participant_id=participant.id, revision=participant.revision))
        return {"revision": participant.revision, "serverNow": iso(utcnow())}


def checkpoint(payload):
    if not isinstance(payload, dict):
        raise StudyError("Send a JSON object.")
    submission_id = identifier(payload.get("id"))
    activity_id = payload.get("activityId")
    if not isinstance(activity_id, str) or activity_id not in ACTIVITIES:
        raise StudyError("Unknown lesson activity.")
    part_index, activity_index, activity = ACTIVITIES[activity_id]
    with transaction(write=True) as db:
        participant = participant_for(db, lock=True)
        previous = db.get(ActivitySubmission, submission_id)
        if previous:
            if previous.participant_id != participant.id:
                raise StudyError("Invalid submission.", 403)
            return session_payload(db, participant)
        if participant.survey_completed_at:
            raise StudyError("This lesson has already been completed.", 409)
        if payload.get("revision") != participant.revision:
            raise StudyError("This lesson was updated in another tab. Reload before continuing.", 409, "revision_conflict")
        completed = list(participant.snapshot.get("completedActivities", []))
        required_previous = [item["id"] for items in LESSON["activities"][:part_index] for item in items] + [item["id"] for item in LESSON["activities"][part_index][:activity_index]]
        if any(item not in completed for item in required_previous):
            raise StudyError("Complete the preceding activity first.", 403)
        if activity_id == "diagnostic" and participant.pretest_completed_at:
            raise StudyError("The pre-test has already been submitted.", 403)
        snapshot = validated_snapshot(payload.get("snapshot"), participant)
        answers = snapshot.get("answers", {})
        questions = LESSON["pretest"] if part_index == 0 else [QUESTIONS[key] for key in activity["fields"]]
        if any(not has_response(question, answers) for question in questions):
            raise StudyError("Complete each response before continuing.")
        if activity.get("run") and not snapshot.get("codeRuns", {}).get(activity["code"]):
            raise StudyError("Run your Python code before continuing; it does not need to pass.")
        now = utcnow()
        if activity_id == "diagnostic":
            participant.pretest_completed_at = now
            scored = [question for question in LESSON["pretest"] if "correct" in question]
            snapshot["baseline"] = {"score": sum(answers.get(question["id"]) == question["correct"] for question in scored), "total": len(scored)}
        if activity_id == "grid-optimize":
            participant.transfer_completed_at = now
        if activity_id == "post-survey":
            participant.survey_completed_at = now
        db.add(ActivitySubmission(id=submission_id, participant_id=participant.id, activity_id=activity_id, submitted_at=now, elapsed_ms=elapsed(participant, now), payload=copy.deepcopy(snapshot)))
        if activity_id not in completed:
            completed.append(activity_id)
        snapshot["completedActivities"] = completed
        last_in_part = activity_index == len(LESSON["activities"][part_index]) - 1
        snapshot["completedParts"] = [index for index, items in enumerate(LESSON["activities"]) if all(item["id"] in completed for item in items)]
        snapshot["activityIndexByPart"] = dict(snapshot.get("activityIndexByPart", {}))
        if last_in_part and part_index < len(LESSON["parts"]) - 1:
            snapshot["partIndex"] = part_index + 1
        elif not last_in_part:
            snapshot["partIndex"] = part_index
            snapshot["activityIndexByPart"][str(part_index)] = activity_index + 1
        if activity_id == "stairs-build" and "stairs-build" not in participant.snapshot.get("completedActivities", []):
            snapshot["code"]["memoization"] = snapshot["code"]["stairs"]
        if activity_id == "grid-build" and "grid-build" not in participant.snapshot.get("completedActivities", []):
            snapshot["code"]["transferMemo"] = snapshot["code"]["transfer"]
        snapshot["pretestSubmitted"] = participant.pretest_completed_at is not None
        snapshot["transferSubmitted"] = participant.transfer_completed_at is not None
        snapshot["surveySubmitted"] = participant.survey_completed_at is not None
        snapshot["transferStarted"] = snapshot["partIndex"] >= 4
        snapshot["activeQuestionId"] = None
        participant.snapshot = snapshot
        participant.revision += 1
        db.flush()
        return session_payload(db, participant)
