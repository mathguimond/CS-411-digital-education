"""Browser-side practice checks. This module never executes on the Flask server.

The checks are a pilot aid rather than a secure assessment/grading service.
"""
import ast
import contextlib
import io
import json
import sys
import time


class OutputLimit(Exception):
    pass


class BoundedOutput(io.StringIO):
    def write(self, text):
        if self.tell() + len(text) > 8000:
            raise OutputLimit("Too much output. Try printing only the results you need.")
        return super().write(text)


ACTIVITIES = {
    "fibonacci": {"function": "fib", "cases": [(0, 0), (1, 1), (2, 1), (4, 3), (6, 8), (8, 21)], "memoized": False},
    "stairs": {"function": "climb_stairs", "cases": [(0, 1), (1, 1), (2, 2), (4, 5), (5, 8), (8, 34)], "memoized": False},
    "memoization": {"function": "climb_stairs", "cases": [(0, 1), (1, 1), (2, 2), (4, 5), (6, 13), (10, 89), (20, 10946)], "memoized": True},
    "transfer": {"function": "unique_paths", "cases": [((0, 0), 0), ((0, 4), 0), ((4, 0), 0), ((1, 1), 1), ((1, 4), 1), ((4, 1), 1), ((2, 3), 3), ((3, 3), 6), ((3, 7), 28), ((8, 8), 3432), ((12, 12), 705432)], "memoized": True},
}


def inspect_structure(tree):
    functions = [node for node in ast.walk(tree) if isinstance(node, ast.FunctionDef)]
    recursive = any(
        isinstance(call, ast.Call) and isinstance(call.func, ast.Name) and call.func.id == function.name
        for function in functions for call in ast.walk(function)
    )
    dictionary = any(
        isinstance(node, (ast.Dict, ast.DictComp)) or
        (isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "dict")
        for node in ast.walk(tree)
    )
    return {"recursionUsed": recursive, "dictionaryUsed": dictionary}


def error_text(error):
    if isinstance(error, SyntaxError):
        return f"SyntaxError on line {error.lineno}: {error.msg}"
    return f"{type(error).__name__}: {str(error)[:1000]}"


def run_activity(source, activity, mode="test"):
    started = time.perf_counter()
    output = BoundedOutput()
    result = {"tests": [], "output": "", "error": None, "analysis": {}, "passed": False, "durationMs": 0}
    if mode == "test":
        result["totalTests"] = len(ACTIVITIES[activity]["cases"])
    try:
        tree = ast.parse(source, filename="<learner>")
        compiled = compile(tree, "<learner>", "exec")
        result["analysis"] = inspect_structure(tree)
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            if mode == "run":
                # No reference tests or generated calls during an assessment run.
                exec(compiled, {"__name__": "__main__"})
                result["passed"] = True
            else:
                specification = ACTIVITIES[activity]
                for input_value, expected in specification["cases"]:
                    namespace = {"__name__": "__main__"}
                    calls = 0

                    def profiler(frame, event, _arg):
                        nonlocal calls
                        if event == "call" and frame.f_code.co_filename == "<learner>" and frame.f_code.co_name != "<module>":
                            calls += 1
                            if calls > 10000:
                                raise RuntimeError("More than 10,000 function calls. This run was stopped.")

                    arguments = input_value if isinstance(input_value, tuple) else (input_value,)
                    label = f"rows = {arguments[0]}, cols = {arguments[1]}" if len(arguments) == 2 else f"n = {input_value}"
                    case = {"input": input_value, "label": label, "expected": expected, "actual": None, "passed": False, "error": None, "calls": 0}
                    try:
                        exec(compiled, namespace)
                        function = namespace.get(specification["function"])
                        if not callable(function):
                            raise ValueError(f"Define a function named {specification['function']}.")
                        sys.setprofile(profiler)
                        actual = function(*arguments)
                        case["actual"] = actual if isinstance(actual, (int, float, str, bool, type(None))) else repr(actual)[:100]
                        case["passed"] = actual == expected
                    except Exception as error:
                        case["error"] = error_text(error)
                    finally:
                        sys.setprofile(None)
                    case["calls"] = calls
                    result["tests"].append(case)

                all_correct = all(case["passed"] for case in result["tests"])
                structural = result["analysis"]["recursionUsed"]
                if specification["memoized"]:
                    largest = result["tests"][-1]
                    size = largest["input"][0] * largest["input"][1] if isinstance(largest["input"], tuple) else largest["input"]
                    result["efficiency"] = {"input": largest["input"], "label": largest["label"], "calls": largest["calls"], "limit": 2 * size + 5,
                                            "passed": largest["passed"] and largest["calls"] <= 2 * size + 5}
                    structural = structural and result["analysis"]["dictionaryUsed"] and result["efficiency"]["passed"]
                result["passed"] = all_correct and structural
    except Exception as error:
        result["error"] = error_text(error)
    finally:
        sys.setprofile(None)
        result["output"] = output.getvalue()
        result["durationMs"] = round((time.perf_counter() - started) * 1000)
    return result


def run_activity_json(source, activity, mode="test"):
    return json.dumps(run_activity(source, activity, mode))
