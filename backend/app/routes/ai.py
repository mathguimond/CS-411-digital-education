from flask import Blueprint, current_app, jsonify, request

from app.services.tutor import TutorUnavailable, generate_reply, load_step

ai_routes = Blueprint("ai", __name__, url_prefix="/api/ai")
MAX_MESSAGE_CHARS = 4000
MAX_HISTORY_MESSAGES = 12
MAX_HISTORY_CHARS = 16000


def validate_payload(payload):
    if not isinstance(payload, dict):
        raise ValueError("Send a JSON object.")
    if payload.get("condition") != "ai":
        raise ValueError("AI support is only available for the AI lesson.")
    message = payload.get("message")
    if not isinstance(message, str) or not 1 <= len(message.strip()) <= MAX_MESSAGE_CHARS:
        raise ValueError("Message must contain 1 to 4000 characters.")
    step_id = payload.get("step_id")
    if not isinstance(step_id, str) or load_step(step_id) is None:
        raise ValueError("Unknown lesson step.")
    history = payload.get("history", [])
    if not isinstance(history, list) or len(history) > MAX_HISTORY_MESSAGES:
        raise ValueError("History must contain at most 12 messages.")
    total = 0
    for index, entry in enumerate(history):
        expected_role = "user" if index % 2 == 0 else "assistant"
        if not isinstance(entry, dict) or entry.get("role") != expected_role:
            raise ValueError("History must alternate user and assistant messages.")
        content = entry.get("content")
        if not isinstance(content, str) or not 1 <= len(content.strip()) <= MAX_MESSAGE_CHARS:
            raise ValueError("History messages must contain 1 to 4000 characters.")
        total += len(content)
    if len(history) % 2 or total > MAX_HISTORY_CHARS:
        raise ValueError("History must contain complete turns and at most 16000 characters.")
    return message.strip(), step_id, history


@ai_routes.post("/chat")
def chat():
    try:
        message, step_id, history = validate_payload(request.get_json(silent=True))
    except ValueError as error:
        return jsonify(error=str(error)), 400
    if not current_app.config["GEMINI_API_KEY"] or not current_app.config["GEMINI_MODEL"]:
        return jsonify(error="The AI tutor is not configured yet. Please contact the lesson organizer."), 503
    try:
        reply = generate_reply(message, step_id, history)
    except TutorUnavailable:
        return jsonify(error="The AI tutor could not respond. Please try again shortly."), 502
    return jsonify(reply=reply)
