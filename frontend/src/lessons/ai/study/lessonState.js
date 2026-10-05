export const STARTER_CODE = {
  fibonacci: 'def fib(n):\n    # Handle the smallest inputs directly.\n    # Then combine smaller versions of the problem.\n    pass\n',
  memoization: 'def fib_memo(n):\n    cache = {}\n\n    def solve(k):\n        # Look for a saved result.\n        # Handle a base case or calculate a new result.\n        # Save the result before returning it.\n        pass\n\n    return solve(n)\n',
  transfer: 'def climb_stairs(n):\n    pass\n',
}

export function createLessonSession(version) {
  return {
    schemaVersion: 2, sessionId: crypto.randomUUID(), condition: 'ai', lessonVersion: version,
    startedAt: new Date().toISOString(), partIndex: 0, completedParts: [],
    answers: {}, code: { ...STARTER_CODE }, conversations: {}, events: [], activeMsByPart: {}, activeMsByEditor: {},
    pretestSubmitted: false, transferStarted: false, transferSubmitted: false,
    baseline: null, assessment: null,
  }
}

export function canVisitPart(session, index) {
  if (!Number.isInteger(index) || index < 0 || index > 4) return false
  if (session.transferStarted && !session.transferSubmitted && index !== 4) return false
  if (index === 0 && session.pretestSubmitted) return false
  return index <= session.completedParts.length
}

export function scorePretest(questions, answers) {
  return { score: questions.filter((question) => answers[question.id] === question.correct).length, total: questions.length }
}

export function studyMetrics(session) {
  const runs = session.events.filter((event) => event.type === 'code_run_finished')
  const practiceRuns = runs.filter((event) => event.mode === 'test')
  const timedOut = session.events.filter((event) => event.type === 'code_run_failed' && event.mode === 'test' && event.failureCode === 'execution_timeout')
  return {
    activeMsByPart: session.activeMsByPart,
    activeMsByEditor: session.activeMsByEditor || {},
    practiceRuns: practiceRuns.length + timedOut.length,
    unsuccessfulPracticeRuns: practiceRuns.filter((event) => !event.result.passed).length + timedOut.length,
    memoizationRuns: [...practiceRuns, ...timedOut].filter((event) => event.activity === 'memoization').length,
    unsuccessfulMemoizationRuns: [...practiceRuns.filter((event) => !event.result.passed), ...timedOut].filter((event) => event.activity === 'memoization').length,
    interruptedRuns: session.events.filter((event) => event.type === 'code_run_failed').length,
    hintRequests: session.events.filter((event) => event.type === 'chat_requested' && event.supportMode === 'hints').length,
    transferCodeRuns: runs.filter((event) => event.activity === 'transfer').length,
  }
}
