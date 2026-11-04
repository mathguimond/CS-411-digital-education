import json
from pathlib import Path

SHARED = Path(__file__).resolve().parents[2] / "shared"
LESSON = json.loads((SHARED / "recursion-lesson.json").read_text(encoding="utf-8"))
STUDY = json.loads((SHARED / "study-config.json").read_text(encoding="utf-8"))
QUESTIONS = LESSON["questions"]
ACTIVITIES = {activity["id"]: (part_index, activity_index, activity)
              for part_index, activities in enumerate(LESSON["activities"])
              for activity_index, activity in enumerate(activities)}


def question_limit(question_id):
    return STUDY["hintLimits"].get(QUESTIONS[question_id]["kind"], 0)


def has_response(question, answers):
    answer = answers.get(question["id"])
    if question["kind"] == "choice":
        valid = isinstance(answer, str) and answer in {option["id"] for option in question["options"]}
        follow_up = question.get("followUp")
        if follow_up and answer == follow_up["when"]:
            summary = answers.get(follow_up["id"])
            valid = valid and isinstance(summary, str) and bool(summary.strip()) and len(summary) <= 240
        return valid
    if question["kind"] == "scale":
        return type(answer) is int and question["minimum"] <= answer <= question["maximum"]
    return isinstance(answer, str) and bool(answer.strip()) and len(answer) <= 4000
