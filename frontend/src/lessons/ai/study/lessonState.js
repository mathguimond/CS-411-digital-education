import { createCallTree } from '../visualizations/treeModel.js'
import { currentActivity } from '../activities/activityPlan.js'

export const STARTER_CODE = {
  stairs: 'def climb_stairs(n):\n    # Count sequences of one-step or two-step moves.\n    pass\n',
  memoization: 'def climb_stairs(n):\n    pass\n',
  transfer: 'def unique_paths(rows, cols):\n    pass\n',
}

export function createLessonSession(version) {
  return {
    schemaVersion: 3, sessionId: crypto.randomUUID(), condition: 'ai', lessonVersion: version,
    startedAt: new Date().toISOString(), partIndex: 0, completedParts: [],
    activityIndexByPart: {}, completedActivities: [], hintUnlockedActivities: [],
    answers: {}, code: { ...STARTER_CODE }, trees: { stairs: createCallTree('stairs'), grid: createCallTree('grid') },
    chatHistory: [], lastResults: {}, events: [], activeMsByPart: {}, activeMsByActivity: {}, activeMsByEditor: {},
    pretestSubmitted: false, transferStarted: false, transferSubmitted: false,
    baseline: null, cohortFlags: {}, assessment: null,
  }
}

export function canVisitPart(session, index) {
  if (!Number.isInteger(index) || index < 0 || index > 4) return false
  if (session.transferStarted && index !== 4) return false
  if (index === 0 && session.pretestSubmitted) return false
  return index <= session.completedParts.length
}

export function scorePretest(questions, answers) {
  const scored = questions.filter((question) => Number.isInteger(question.correct))
  return { score: scored.filter((question) => answers[question.id] === question.correct).length, total: scored.length }
}

export function cohortFlags(questions, answers) {
  const baseline = scorePretest(questions, answers)
  return { priorIndependentMemoization: answers['memo-experience'] === 2,
    possiblePriorMastery: baseline.score === baseline.total && answers['memo-experience'] === 2 }
}

export function learnerContext(session, activity) {
  const relevantCode = activity.code || (activity.id === 'stairs-trace' || activity.id === 'stairs-redundancy' ? 'stairs' : null)
  const tree = activity.tree || (activity.id.startsWith('stairs-') ? 'stairs' : null)
  const lastRun = relevantCode ? session.lastResults[relevantCode] : null
  const failedTests = lastRun?.tests?.filter((test) => !test.passed) || []
  // Bound fields individually so truncation never produces invalid JSON.
  const context = { baseline: session.baseline, activity: { id: activity.id, title: activity.title },
    answers: Object.fromEntries(activity.fields.map((id) => [id, String(session.answers[id] ?? '').slice(0, 350)])),
    code: relevantCode ? session.code[relevantCode].slice(0, 2400) : undefined,
    tree: tree ? session.trees[tree].nodes.slice(0, 40).map(({ id, parentId, args, value }) => ({ id: id === 'root' ? 'root' : session.trees[tree].nodes.findIndex((node) => node.id === id), parent: parentId === 'root' ? 'root' : session.trees[tree].nodes.findIndex((node) => node.id === parentId), args: args.map((arg) => String(arg).slice(0, 24)), value: String(value).slice(0, 24) })) : undefined,
    lastRun: lastRun ? { passed: lastRun.passed, analysis: lastRun.analysis, efficiency: lastRun.efficiency, error: lastRun.error?.slice(0, 300), codeChangedSinceRun: lastRun.codeChangedSinceRun, tests: (failedTests.length ? failedTests : lastRun.tests || []).slice(0, 3).map(({ input, expected, actual, passed, error }) => ({ input, expected, actual: typeof actual === 'string' ? actual.slice(0, 100) : actual, passed, error: error?.slice(0, 150) })), output: lastRun.output?.slice(0, 200) } : undefined,
  }
  let encoded = JSON.stringify(context)
  while (encoded.length > 6000 && context.tree?.length > 1) { context.tree.pop(); encoded = JSON.stringify(context) }
  while (encoded.length > 6000 && context.code?.length) { context.code = context.code.slice(0, Math.floor(context.code.length / 2)); encoded = JSON.stringify(context) }
  return encoded
}

export function studyMetrics(session) {
  const events = session.events
  const runs = events.filter((event) => event.type === 'code_run_finished')
  const practiceRuns = runs.filter((event) => event.mode === 'test')
  const timedOut = events.filter((event) => event.type === 'code_run_failed' && event.mode === 'test' && event.failureCode === 'execution_timeout')
  const timeline = {}
  for (const event of events) {
    if (!event.activityId) continue
    const item = timeline[event.activityId] ||= { firstRunMs: null, firstSuccessMs: null, submissions: 0, hintRequests: 0, followUpTurns: 0, responseEdits: 0, codeEdits: 0, feedbackToEditMs: [] }
    const time = Date.parse(event.timestamp)
    if (event.type === 'activity_entered') item.enteredAt ??= time
    if (event.type === 'code_run_started' && item.firstRunMs === null && item.enteredAt) item.firstRunMs = time - item.enteredAt
    if (event.type === 'code_run_finished' && event.mode === 'test' && event.result.passed && item.firstSuccessMs === null && item.enteredAt) item.firstSuccessMs = time - item.enteredAt
    if (event.type === 'activity_submitted') item.submissions++
    if (event.type === 'chat_requested') {
      if (event.requestKind === 'hint') item.hintRequests++
      else item.followUpTurns++
    }
    if (['chat_answered', 'code_run_finished', 'tree_checked'].includes(event.type)) item.lastFeedbackAt = time
    if (['response_edited', 'code_edited', 'tree_node_edited', 'tree_child_added'].includes(event.type)) {
      if (event.type === 'response_edited') item.responseEdits++
      if (event.type === 'code_edited') item.codeEdits++
      if (item.lastFeedbackAt) { item.feedbackToEditMs.push(time - item.lastFeedbackAt); delete item.lastFeedbackAt }
    }
  }
  for (const item of Object.values(timeline)) delete item.lastFeedbackAt
  return {
    activeMsByPart: session.activeMsByPart, activeMsByActivity: session.activeMsByActivity, activeMsByEditor: session.activeMsByEditor,
    activityTimeline: timeline,
    practiceRuns: practiceRuns.length + timedOut.length,
    unsuccessfulPracticeRuns: practiceRuns.filter((event) => !event.result.passed).length + timedOut.length,
    memoizationRuns: [...practiceRuns, ...timedOut].filter((event) => event.activity === 'memoization').length,
    unsuccessfulMemoizationRuns: [...practiceRuns.filter((event) => !event.result.passed), ...timedOut].filter((event) => event.activity === 'memoization').length,
    syntaxErrors: runs.filter((event) => event.result.error?.startsWith('SyntaxError')).length,
    failedAssertions: runs.reduce((sum, event) => sum + (event.result.tests || []).filter((test) => !test.passed && !test.error).length, 0),
    runtimeExceptions: runs.filter((event) => event.result.error && !event.result.error.startsWith('SyntaxError') || event.result.tests?.some((test) => test.error)).length,
    interruptedRuns: events.filter((event) => event.type === 'code_run_failed').length,
    hintRequests: events.filter((event) => event.type === 'chat_requested' && event.requestKind === 'hint').length,
    aiInteractionTurns: events.filter((event) => event.type === 'chat_answered').length,
    transferCodeRuns: runs.filter((event) => event.activity === 'transfer').length,
  }
}

export { currentActivity }
