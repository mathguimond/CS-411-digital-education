import importlib.util
from pathlib import Path
import unittest

RUNNER = Path(__file__).resolve().parents[2] / 'frontend/public/python/lesson_runner.py'
specification = importlib.util.spec_from_file_location('lesson_runner', RUNNER)
runner = importlib.util.module_from_spec(specification)
specification.loader.exec_module(runner)

FIBONACCI = '''def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)
'''
STAIRS = FIBONACCI.replace('fib(', 'climb_stairs(').replace('return n', 'return 1')
MEMOIZED = '''def climb_stairs(n):
    cache = {}
    def solve(k):
        if k not in cache:
            cache[k] = 1 if k < 2 else solve(k - 1) + solve(k - 2)
        return cache[k]
    return solve(n)
'''

GRID = '''def unique_paths(rows, cols):
    cache = {}
    def solve(r, c):
        if (r, c) not in cache:
            if not r or not c:
                cache[r, c] = 0
            elif r == 1 or c == 1:
                cache[r, c] = 1
            else:
                cache[r, c] = solve(r - 1, c) + solve(r, c - 1)
        return cache[r, c]
    return solve(rows, cols)
'''


class LessonRunnerTests(unittest.TestCase):
    def test_naive_recursion_and_memoized_recursion_pass_their_activities(self):
        self.assertTrue(runner.run_activity(FIBONACCI, 'fibonacci')['passed'])
        self.assertTrue(runner.run_activity(STAIRS, 'stairs')['passed'])
        result = runner.run_activity(MEMOIZED, 'memoization')
        self.assertTrue(result['passed'])
        self.assertLessEqual(result['efficiency']['calls'], 45)

    def test_unoptimized_refactoring_is_detected(self):
        naive = STAIRS + '\nunused_cache = {}'
        result = runner.run_activity(naive, 'memoization')
        self.assertFalse(result['passed'])
        self.assertFalse(result['efficiency']['passed'])
        self.assertIn('10,000', result['tests'][-1]['error'])

    def test_transfer_convention_and_own_code_runs(self):
        source = GRID
        result = runner.run_activity(source, 'transfer')
        self.assertTrue(result['passed'])
        self.assertEqual(result['totalTests'], 11)
        self.assertLessEqual(result['efficiency']['calls'], 293)
        own_run = runner.run_activity(source + '\nprint(unique_paths(3, 3))', 'transfer', 'run')
        self.assertEqual(own_run['output'], '6\n')
        self.assertEqual(own_run['tests'], [])
        self.assertNotIn('efficiency', own_run)

    def test_syntax_errors_missing_functions_and_missing_base_case(self):
        syntax = runner.run_activity('def fib(:', 'fibonacci')
        self.assertIn('SyntaxError', syntax['error'])
        self.assertEqual(syntax['totalTests'], 6)
        missing = runner.run_activity('def wrong(n): return 0', 'fibonacci')
        self.assertIn('Define a function named fib', missing['tests'][0]['error'])
        recursive = runner.run_activity('def fib(n): return fib(n-1)', 'fibonacci')
        self.assertFalse(recursive['passed'])
        self.assertIn('RecursionError', recursive['tests'][0]['error'])

    def test_output_and_namespace_are_bounded(self):
        self.assertIn('OutputLimit', runner.run_activity("print('x' * 8001)", 'transfer', 'run')['error'])
        first = runner.run_activity('marker = 42', 'transfer', 'run')
        self.assertTrue(first['passed'])
        second = runner.run_activity('print(marker)', 'transfer', 'run')
        self.assertIn('NameError', second['error'])

    def test_correct_values_without_recursion_do_not_pass_structure_check(self):
        source = 'def fib(n):\n    return [0,1,1,2,3,5,8,13,21][n]'
        result = runner.run_activity(source, 'fibonacci')
        self.assertTrue(all(case['passed'] for case in result['tests']))
        self.assertFalse(result['passed'])
