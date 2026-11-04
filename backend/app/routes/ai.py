from flask import Blueprint, jsonify, request

from app.services.hints import request_hint

ai_routes = Blueprint("ai", __name__, url_prefix="/api/ai")


@ai_routes.post("/chat")
def chat():
    return jsonify(request_hint(request.get_json(silent=True), require_ai=True))
