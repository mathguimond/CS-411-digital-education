import os
import hashlib
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix

from app.routes.ai import ai_routes
from app.routes.study import study_routes
from app.database import AssignmentState, init_database, transaction
from app.services.study import StudyError
from app.services.tutor import TutorUnavailable
from sqlalchemy.exc import SQLAlchemyError


def create_app(config=None) -> Flask:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    app = Flask(__name__)
    instance = Path(app.instance_path)
    instance.mkdir(parents=True, exist_ok=True)
    app.config.from_mapping(
        GEMINI_API_KEY=os.getenv("GEMINI_API_KEY", ""),
        GEMINI_MODEL=os.getenv("GEMINI_MODEL", ""),
        ALLOWED_ORIGINS=[
            origin.strip()
            for origin in os.getenv(
                "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
            ).split(",") if origin.strip()
        ],
        CHAT_RATE_LIMIT=os.getenv("CHAT_RATE_LIMIT", "10 per minute"),
        RATELIMIT_STORAGE_URI=os.getenv("RATELIMIT_STORAGE_URI", "memory://"),
        MAX_CONTENT_LENGTH=512 * 1024,
        DATABASE_URL=os.getenv("DATABASE_URL") or f"sqlite:///{(instance / 'study.sqlite3').as_posix()}",
        DATABASE_AUTO_INIT=not bool(os.getenv("DYNO")) and not os.getenv("DATABASE_URL", "").startswith("postgres"),
    )
    if config:
        app.config.update(config)
    if os.getenv("DYNO") and not app.config["DATABASE_URL"].startswith("postgres"):
        raise RuntimeError("Heroku requires an attached Postgres DATABASE_URL for study storage.")
    init_database(app)

    # Heroku supplies one trusted proxy hop. Do not trust forwarded IPs locally.
    if os.getenv("DYNO"):
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

    CORS(app, resources={r"/api/*": {"origins": app.config["ALLOWED_ORIGINS"]}})
    limiter = Limiter(key_func=get_remote_address, app=app)
    app.extensions["study_limiter"] = limiter
    app.register_blueprint(ai_routes)
    app.register_blueprint(study_routes)
    app.view_functions["ai.chat"] = limiter.limit(app.config["CHAT_RATE_LIMIT"])(
        app.view_functions["ai.chat"]
    )
    app.view_functions["study.hint"] = limiter.limit(app.config["CHAT_RATE_LIMIT"], key_func=lambda: hashlib.sha256(request.headers.get("Authorization", get_remote_address()).encode()).hexdigest())(app.view_functions["study.hint"])

    @app.before_request
    def check_browser_origin():
        origin = request.headers.get("Origin")
        if request.path.startswith(("/api/ai/", "/api/study/")) and origin and origin not in app.config["ALLOWED_ORIGINS"]:
            return jsonify(error="This website origin is not allowed."), 403

    @app.get("/api/health")
    def health_check():
        with transaction() as db:
            if db.get(AssignmentState, 1) is None:
                return jsonify(status="unavailable", error="Study database migration is required."), 503
        return jsonify(
            status="ok",
            ai_configured=bool(app.config["GEMINI_API_KEY"] and app.config["GEMINI_MODEL"]),
            database_configured=bool(app.config["DATABASE_URL"]),
            database_ready=True,
        )

    @app.errorhandler(StudyError)
    def study_error(error):
        return jsonify(error=error.message, error_code=error.code), error.status

    @app.errorhandler(SQLAlchemyError)
    def database_error(error):
        app.logger.error("Study database request failed (%s)", type(error).__name__)
        return jsonify(error="Your work could not be saved. Please check your connection and try again.", error_code="database_unavailable"), 503

    @app.errorhandler(TutorUnavailable)
    def tutor_error(error):
        return jsonify(error=error.public_message, error_code=error.code), 502

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify(error="Request is too large."), 413

    @app.errorhandler(429)
    def rate_limited(_error):
        return jsonify(error="Too many messages. Please wait a minute and try again."), 429

    return app


app = create_app()
