import { createCallTree } from '../visualizations/treeModel.js'
import { currentActivity } from '../activities/activityPlan.js'
import { lesson } from '../content.js'

export const STARTER_CODE = {
  stairs: 'def climb_stairs(n):\n    pass\n',
  memoization: 'def climb_stairs(n):\n    pass\n',
  transfer: 'def unique_paths(rows, cols):\n    pass\n',
  transferMemo: 'def unique_paths(rows, cols):\n    pass\n',
}

export function createLessonSession(version, condition = 'ai', supportVersion = null, sessionId = crypto.randomUUID()) {
  return {
    schemaVersion: 4, sessionId, condition, lessonVersion: version, supportVersion,
    startedAt: new Date().toISOString(), partIndex: 0, completedParts: [], activityIndexByPart: {}, completedActivities: [],
    answers: {}, code: { ...STARTER_CODE }, codeRuns: {},
    trees: { stairs: createCallTree('stairs', [4]), grid: createCallTree('grid', [2, 2]) },
    chatHistory: [], hintUsage: {}, activeQuestionId: null, lastResults: {}, events: [],
    activeMsByPart: {}, activeMsByActivity: {}, activeMsByEditor: {},
    pretestSubmitted: false, transferStarted: false, transferSubmitted: false, surveySubmitted: false,
    baseline: null, assessment: null,
  }
}

export function hasResponse(question, answers) {
  const value = answers[question.id]
  if (question.kind === 'choice') {
    const selected = question.options.some((option) => option.id === value)
    return selected && (!question.followUp || value !== question.followUp.when || Boolean(answers[question.followUp.id]?.trim()))
  }
  if (question.kind === 'scale') return Number.isInteger(value) && value >= question.minimum && value <= question.maximum
  return typeof value === 'string' && Boolean(value.trim())
}

export function canVisitPart(session, index) {
  if (!Number.isInteger(index) || index < 0 || index >= lesson.parts.length || session.surveySubmitted) return false
  if (session.transferSubmitted) return index === 5
  if (session.transferStarted && index !== 4) return false
  if (index === 0 && session.pretestSubmitted) return false
  return index === 0 || session.completedParts.includes(index - 1)
}

export function scorePretest(questions, answers) {
  const scored = questions.filter((question) => question.correct !== undefined && question.correct !== null)
  return { score: scored.filter((question) => answers[question.id] === question.correct).length, total: scored.length }
}

export function snapshotForSave(session) {
  const { events: _events, chatHistory: _chat, hintUsage: _hints, ...snapshot } = session
  return snapshot
}

export { currentActivity }
