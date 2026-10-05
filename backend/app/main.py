import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix

from app.routes.ai import ai_routes


def create_app(config=None) -> Flask:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    app = Flask(__name__)
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
        MAX_CONTENT_LENGTH=32 * 1024,
    )
    if config:
        app.config.update(config)

    # Heroku supplies one trusted proxy hop. Do not trust forwarded IPs locally.
    if os.getenv("DYNO"):
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

    CORS(app, resources={r"/api/*": {"origins": app.config["ALLOWED_ORIGINS"]}})
    limiter = Limiter(key_func=get_remote_address, app=app)
    app.register_blueprint(ai_routes)
    app.view_functions["ai.chat"] = limiter.limit(app.config["CHAT_RATE_LIMIT"])(
        app.view_functions["ai.chat"]
    )

    @app.before_request
    def check_browser_origin():
        origin = request.headers.get("Origin")
        if request.path == "/api/ai/chat" and origin and origin not in app.config["ALLOWED_ORIGINS"]:
            return jsonify(error="This website origin is not allowed."), 403

    @app.get("/api/health")
    def health_check():
        return jsonify(
            status="ok",
            ai_configured=bool(app.config["GEMINI_API_KEY"] and app.config["GEMINI_MODEL"]),
        )

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify(error="Request is too large."), 413

    @app.errorhandler(429)
    def rate_limited(_error):
        return jsonify(error="Too many messages. Please wait a minute and try again."), 429

    return app


app = create_app()
