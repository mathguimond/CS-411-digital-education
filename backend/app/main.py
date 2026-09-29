from flask import Flask, jsonify


def create_app() -> Flask:
    app = Flask(__name__)

    @app.get("/api/health")
    def health_check():
        return jsonify({"status": "ok"})

    return app


app = create_app()
