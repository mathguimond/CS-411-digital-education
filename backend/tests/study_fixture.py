import copy
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from uuid import uuid4

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.main import create_app
from app.curriculum import LESSON, QUESTIONS, STUDY
from app.database import database_url


def initial_snapshot(participant):
    def tree(kind, args):
        return {"kind": kind, "nodes": [{"id": "root", "parentId": None, "children": [], "depth": 0, "args": args, "value": "", "x": 720, "y": 45}]}
    return {"schemaVersion": 4, "sessionId": participant["id"], "condition": participant["condition"], "lessonVersion": LESSON["version"], "partIndex": 0, "activityIndexByPart": {}, "completedParts": [], "completedActivities": [], "pretestSubmitted": False, "transferStarted": False, "transferSubmitted": False, "surveySubmitted": False, "answers": {}, "code": {"stairs": "def climb_stairs(n): pass", "memoization": "def climb_stairs(n): pass", "transfer": "def unique_paths(rows, cols): pass", "transferMemo": "def unique_paths(rows, cols): pass"}, "trees": {"stairs": tree("stairs", ["4"]), "grid": tree("grid", ["2", "2"])}, "codeRuns": {}, "lastResults": {}, "activeMsByPart": {}}


class StudyCase(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        url = os.environ.get("TEST_DATABASE_URL")
        extra = {}
        self.admin = None
        if url:
            url = database_url(url)
            if not (make_url(url).database or "").endswith("_test"):
                raise RuntimeError("Integration tests require a database name ending in _test.")
            self.admin = create_engine(url, isolation_level="AUTOCOMMIT")
            self.schema = "study_" + uuid4().hex
            with self.admin.connect() as connection:
                connection.execute(text(f'CREATE SCHEMA "{self.schema}"'))
            extra["DATABASE_CONNECT_ARGS"] = {"options": f"-csearch_path={self.schema}"}
        else:
            url = "sqlite:///" + (Path(self.directory.name) / "study.sqlite3").as_posix()
        self.app = create_app({"TESTING": True, "DATABASE_URL": url, "DATABASE_AUTO_INIT": True, "GEMINI_API_KEY": "test-only-key", "GEMINI_MODEL": "test-model", "ALLOWED_ORIGINS": ["https://example.github.io"], "RATELIMIT_ENABLED": False, **extra})
        self.client = self.app.test_client()
        self.token = "a" * 64
        self.headers = {"Authorization": "Bearer " + self.token}
        self.details = {"session_token": self.token, "gender": "female", "age": "22", "school_level": "bachelor", "degree": "Computer Science", "referrer": "jan", "data_consent": True, "consent_version": STUDY["consent"]["version"]}
        self.remote = None
        self.state = None

    def tearDown(self):
        self.app.extensions["study_database"].dispose()
        if self.admin:
            with self.admin.connect() as connection:
                connection.execute(text(f'DROP SCHEMA "{self.schema}" CASCADE'))
            self.admin.dispose()
        self.directory.cleanup()

    def enroll(self, condition="ai"):
        with patch("app.services.study.secrets.choice", return_value=condition):
            response = self.client.post("/api/study/enroll", json=self.details)
        self.assertEqual(response.status_code, 201, response.json)
        self.remote = response.json
        self.state = initial_snapshot(self.remote["participant"])
        return response

    def save(self, events=None, batch_id=None):
        response = self.client.put("/api/study/session", headers=self.headers, json={"id": batch_id or str(uuid4()), "revision": self.remote["revision"], "snapshot": self.state, "events": events or []})
        if response.status_code == 200:
            self.remote["revision"] = response.json["revision"]
        return response

    def submit(self, activity_id, fill=True, submission_id=None):
        activity = next(item for items in LESSON["activities"] for item in items if item["id"] == activity_id)
        if fill:
            questions = LESSON["pretest"] if activity_id == "diagnostic" else [QUESTIONS[key] for key in activity["fields"]]
            for question in questions:
                self.state["answers"][question["id"]] = question.get("correct", question.get("options", [{"id": None}])[0]["id"]) if question["kind"] == "choice" else 5 if question["kind"] == "scale" else "My explanation."
            if activity_id == "diagnostic":
                self.state["answers"]["recursion-awareness"] = "no"
            if activity.get("run"):
                self.state["codeRuns"][activity["code"]] = True
        response = self.client.post("/api/study/checkpoint", headers=self.headers, json={"id": submission_id or str(uuid4()), "revision": self.remote["revision"], "activityId": activity_id, "snapshot": self.state})
        if response.status_code == 200:
            self.remote = response.json
            self.state = copy.deepcopy(self.remote["snapshot"])
        return response

    def advance_to(self, target):
        for items in LESSON["activities"]:
            for activity in items:
                if activity["id"] == target:
                    return
                if activity["id"] in self.state.get("completedActivities", []):
                    continue
                response = self.submit(activity["id"])
                self.assertEqual(response.status_code, 200, response.json)

    def hint(self, question_id="intro-base", activity_id="recursion-components", request_id=None, **extra):
        return self.client.post("/api/study/hints", headers=self.headers, json={"id": request_id or str(uuid4()), "questionId": question_id, "activityId": activity_id, **extra})
