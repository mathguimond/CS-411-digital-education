import json
from datetime import timedelta, timezone

from flask import current_app
from sqlalchemy import select

from app.curriculum import ACTIVITIES, LESSON, QUESTIONS, SHARED, question_limit
from app.database import HintTurn, transaction, utcnow
from app.services.study import StudyError, elapsed, hint_state, identifier, participant_for
from app.services.tutor import TutorUnavailable, generate_reply, limit_sentences

FIXED = json.loads((SHARED / "control-support.json").read_text(encoding="utf-8"))


def hint_context(snapshot, activity, question_id):
    question = QUESTIONS[question_id]
    code_key = activity.get("code")
    tree_key = activity.get("tree")
    context = {
        "selected_question": {key: value for key, value in question.items() if key != "correct"},
        "current_answer": str(snapshot.get("answers", {}).get(question_id, ""))[:4000] if question["kind"] in {"text", "choice"} else None,
        "activity": activity["title"],
        "answers_on_page": {key: str(snapshot.get("answers", {}).get(key, ""))[:350] for key in activity["fields"]},
        "code": snapshot.get("code", {}).get(code_key, "")[:2600] if code_key else None,
        "tree": [{"id": index, "parent": next((i for i, other in enumerate(snapshot["trees"][tree_key]["nodes"]) if other["id"] == node.get("parentId")), None), "args": node["args"], "return": node["value"]} for index, node in enumerate(snapshot.get("trees", {}).get(tree_key, {}).get("nodes", [])[:40])] if tree_key else None,
        "last_run": snapshot.get("lastResults", {}).get(code_key),
    }
    if context["last_run"]:
        result = context["last_run"]
        context["last_run"] = {"error": str(result.get("error") or "")[:400], "passed": result.get("passed"), "analysis": result.get("analysis"), "efficiency": result.get("efficiency"), "tests": [{"input": test.get("input"), "passed": test.get("passed"), "error": str(test.get("error") or "")[:150]} for test in result.get("tests", []) if not test.get("passed")][:3]}
    while len(json.dumps(context)) > 6000:
        if context.get("tree"):
            context["tree"].pop()
        elif context.get("code"):
            context["code"] = context["code"][:len(context["code"]) // 2]
        else:
            context.pop("last_run", None)
            break
    return context


def result_payload(db, participant, turn):
    usage, conversation = hint_state(db, participant.id)
    limit = question_limit(turn.question_id)
    return {"reply": turn.reply, "questionId": turn.question_id, "limit": limit, "remaining": max(0, limit - usage.get(turn.question_id, 0)), "hintUsage": usage, "conversation": conversation}


def request_hint(payload, require_ai=False):
    if not isinstance(payload, dict):
        raise StudyError("Send a JSON object.")
    turn_id = identifier(payload.get("id"))
    question_id = payload.get("questionId")
    activity_id = payload.get("activityId")
    if not isinstance(question_id, str) or question_id not in QUESTIONS or not isinstance(activity_id, str) or activity_id not in ACTIVITIES:
        raise StudyError("Unknown lesson question.")
    part_index, _, activity = ACTIVITIES[activity_id]
    if question_id not in activity["fields"] + activity.get("hintQuestions", []):
        raise StudyError("This hint does not belong to the selected activity.")
    if not LESSON["parts"][part_index].get("ai_allowed") or question_limit(question_id) == 0:
        raise StudyError("Hints are unavailable for this questionnaire.", 403, "ai_disabled")
    message = payload.get("message", "Give me one small hint about this question.")
    if not isinstance(message, str) or not 1 <= len(message.strip()) <= 4000:
        raise StudyError("A follow-up must contain 1 to 4000 characters.")
    with transaction(write=True) as db:
        participant = participant_for(db, lock=True)
        if require_ai and participant.condition != "ai":
            raise StudyError("AI support is only available for the assigned AI condition.", 403)
        if not participant.pretest_completed_at or participant.transfer_completed_at:
            raise StudyError("Hints are unavailable outside the timed lesson.", 403, "ai_disabled")
        if participant.snapshot.get("partIndex") != part_index:
            raise StudyError("Open this lesson part before requesting its hints.", 403)
        required_previous = [item["id"] for items in LESSON["activities"][:part_index] for item in items] + [item["id"] for item in LESSON["activities"][part_index][:ACTIVITIES[activity_id][1]]]
        if any(item not in participant.snapshot.get("completedActivities", []) for item in required_previous):
            raise StudyError("Complete the preceding activity first.", 403)
        existing = db.get(HintTurn, turn_id)
        if existing:
            if existing.participant_id != participant.id or existing.question_id != question_id:
                raise StudyError("Invalid hint request.", 403)
            if existing.status == "completed":
                return result_payload(db, participant, existing)
            raise StudyError("That hint is still being prepared or must be requested again.", 409, "hint_pending")
        cutoff = utcnow() - timedelta(seconds=45)
        for pending in db.scalars(select(HintTurn).where(HintTurn.participant_id == participant.id, HintTurn.status == "pending")).all():
            if pending.created_at.replace(tzinfo=pending.created_at.tzinfo or timezone.utc) < cutoff:
                pending.status = "failed"
        db.flush()
        usage, _conversation = hint_state(db, participant.id)
        limit = question_limit(question_id)
        if usage.get(question_id, 0) >= limit:
            raise StudyError("You have used all hints for this question.", 409, "hint_limit")
        if participant.condition == "ai" and (not current_app.config["GEMINI_API_KEY"] or not current_app.config["GEMINI_MODEL"]):
            raise StudyError("The AI hints are not configured. Please contact the organizer.", 503)
        previous_turns = db.scalars(select(HintTurn).where(HintTurn.participant_id == participant.id, HintTurn.status == "completed").order_by(HintTurn.created_at, HintTurn.id)).all()
        history = []
        for previous in previous_turns:
            history.extend([{"role": "user", "content": f"Question: {QUESTIONS[previous.question_id]['prompt']}\n{previous.message}"}, {"role": "assistant", "content": previous.reply}])
        context = hint_context(participant.snapshot, activity, question_id)
        turn = HintTurn(id=turn_id, participant_id=participant.id, question_id=question_id, activity_id=activity_id, status="pending", message=message.strip(), context=context, model=current_app.config["GEMINI_MODEL"] if participant.condition == "ai" else FIXED["version"], elapsed_ms=elapsed(participant))
        db.add(turn)
        condition = participant.condition
        if condition == "control":
            turn.reply = limit_sentences(FIXED["questions"][question_id][usage.get(question_id, 0)])
            turn.status, turn.completed_at = "completed", utcnow()
            db.flush()
            return result_payload(db, participant, turn)
    # Release the database connection while waiting for the external model.
    try:
        reply = generate_reply(message.strip(), LESSON["parts"][part_index]["id"], history, learner_context=json.dumps(context))
    except TutorUnavailable:
        with transaction(write=True) as db:
            participant_for(db, lock=True)
            db.get(HintTurn, turn_id).status = "failed"
        raise
    with transaction(write=True) as db:
        participant = participant_for(db, lock=True)
        turn = db.get(HintTurn, turn_id)
        expired = turn.status != "pending" or turn.created_at.replace(tzinfo=turn.created_at.tzinfo or timezone.utc) < utcnow() - timedelta(seconds=45)
        if expired:
            turn.status = "failed"
        else:
            turn.reply, turn.status, turn.completed_at = limit_sentences(reply), "completed", utcnow()
        db.flush()
        result = result_payload(db, participant, turn)
    if expired:
        raise StudyError("This hint request expired without using a hint. Please request it again.", 409, "hint_expired")
    return result
