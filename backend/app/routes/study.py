from flask import Blueprint, jsonify, request

from app.database import transaction
from app.services.study import checkpoint, enroll, participant_for, save_snapshot, session_payload
from app.services.hints import request_hint

study_routes = Blueprint("study", __name__, url_prefix="/api/study")


@study_routes.post("/enroll")
def enroll_participant():
    response, created = enroll(request.get_json(silent=True))
    return jsonify(response), 201 if created else 200


@study_routes.get("/session")
def get_session():
    with transaction() as db:
        return jsonify(session_payload(db, participant_for(db)))


@study_routes.put("/session")
def sync_session():
    return jsonify(save_snapshot(request.get_json(silent=True)))


@study_routes.post("/checkpoint")
def submit_checkpoint():
    return jsonify(checkpoint(request.get_json(silent=True)))


@study_routes.post("/hints")
def hint():
    return jsonify(request_hint(request.get_json(silent=True)))
