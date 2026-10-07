export const ACTIVITIES = [
  [{ id: 'diagnostic', title: 'Prior knowledge', fields: [] }],
  [{ id: 'recursion-components', title: 'Discover the recursive pattern', fields: ['intro-base', 'intro-reduction', 'intro-stack'] }],
  [
    { id: 'stairs-design', title: 'Design Climbing Stairs', fields: ['stairs-suitability', 'stairs-recurrence'], code: 'stairs', run: true },
    { id: 'stairs-trace', title: 'Construct your call tree', fields: ['stairs-depth', 'stairs-stack'], tree: 'stairs' },
  ],
  [
    { id: 'memo-example', title: 'Study a worked cache example', fields: ['memo-example-explanation'] },
    { id: 'stairs-redundancy', title: 'Diagnose repeated work', fields: ['stairs-two-count', 'stairs-extra-count', 'stairs-redundancy'] },
    { id: 'stairs-memoization', title: 'Memoize your own solution', fields: ['stairs-cache', 'stairs-complexity'], code: 'memoization', run: true },
  ],
  [
    { id: 'grid-components', title: 'Explain before executing', fields: ['grid-base', 'grid-reduction', 'grid-stack'] },
    { id: 'grid-build', title: 'Build and trace', fields: ['grid-recurrence', 'grid-depth'], code: 'transfer', tree: 'grid' },
    { id: 'grid-optimize', title: 'Identify overlap and optimize', fields: ['grid-overlap', 'grid-cache', 'grid-complexity'], code: 'transfer' },
  ],
]

export function currentActivity(session) {
  return ACTIVITIES[session.partIndex][session.activityIndexByPart[session.partIndex] || 0]
}

export function canVisitActivity(session, partIndex, activityIndex) {
  const list = ACTIVITIES[partIndex]
  return Boolean(list?.[activityIndex]) && (activityIndex === 0 || session.completedActivities.includes(list[activityIndex - 1].id))
}
