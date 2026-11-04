import { lesson } from '../content.js'

export const ACTIVITIES = lesson.activities
export function currentActivity(session) { return ACTIVITIES[session.partIndex][session.activityIndexByPart[session.partIndex] || 0] }
export function canVisitActivity(session, partIndex, activityIndex) {
  const list = ACTIVITIES[partIndex]
  return Boolean(list?.[activityIndex]) && (activityIndex === 0 || session.completedActivities.includes(list[activityIndex - 1].id))
}
