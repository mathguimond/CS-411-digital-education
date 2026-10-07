import { createCallTree } from '../visualizations/treeModel.js'
import { currentActivity } from '../activities/activityPlan.js'

export const STARTER_CODE = {
  stairs: 'def climb_stairs(n):\n    # Count sequences of one-step or two-step moves.\n    pass\n',
  memoization: 'def climb_stairs(n):\n    pass\n',
  transfer: 'def unique_paths(rows, cols):\n    pass\n',
}

export function createLessonSession(version, condition = 'ai', supportVersion = null) {
  return {
    schemaVersion: 3, sessionId: crypto.randomUUID(), condition, lessonVersion: version, supportVersion,
    startedAt: new Date().toISOString(), partIndex: 0, completedParts: [],
    activityIndexByPart: {}, completedActivities: [], hintUnlockedActivities: [],
    answers: {}, code: { ...STARTER_CODE }, trees: { stairs: createCallTree('stairs'), grid: createCallTree('grid') },
    chatHistory: [], fixedSupport: {}, lastResults: {}, events: [], activeMsByPart: {}, activeMsByActivity: {}, activeMsByEditor: {},
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


export function studyMetrics(session) {
  const events = session.events
  const runs = events.filter((event) => event.type === 'code_run_finished')
  const practiceRuns = runs.filter((event) => event.mode === 'test')
  const timedOut = events.filter((event) => event.type === 'code_run_failed' && event.mode === 'test' && event.failureCode === 'execution_timeout')
  const timeline = {}
  for (const event of events) {
    if (!event.activityId) continue
    const item = timeline[event.activityId] ||= { firstRunMs: null, firstSuccessMs: null, submissions: 0, hintRequests: 0, fixedHintsOpened: 0, fallbackDisplayed: false, followUpTurns: 0, responseEdits: 0, codeEdits: 0, feedbackToEditMs: [] }
    const time = Date.parse(event.timestamp)
    if (event.type === 'activity_entered') item.enteredAt ??= time
    if (event.type === 'code_run_started' && item.firstRunMs === null && item.enteredAt) item.firstRunMs = time - item.enteredAt
    if (event.type === 'code_run_finished' && event.mode === 'test' && event.result.passed && item.firstSuccessMs === null && item.enteredAt) item.firstSuccessMs = time - item.enteredAt
    if (event.type === 'activity_submitted') item.submissions++
    if (event.type === 'hint_revealed') { item.hintRequests++; item.fixedHintsOpened++ }
    if (event.type === 'solution_revealed') item.fallbackDisplayed = true
    if (event.type === 'chat_requested') {
      if (event.requestKind === 'hint') item.hintRequests++
      else item.followUpTurns++
    }
    if (['chat_answered', 'hint_revealed', 'solution_revealed', 'code_run_finished', 'tree_checked'].includes(event.type)) item.lastFeedbackAt = time
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
    hintRequests: events.filter((event) => event.type === 'chat_requested' && event.requestKind === 'hint' || event.type === 'hint_revealed').length,
    fixedHintsOpened: events.filter((event) => event.type === 'hint_revealed').length,
    fallbackSolutionsDisplayed: events.filter((event) => event.type === 'solution_revealed').length,
    aiInteractionTurns: events.filter((event) => event.type === 'chat_answered').length,
    transferCodeRuns: runs.filter((event) => event.activity === 'transfer').length,
  }
}

export { currentActivity }
