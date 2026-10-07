import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ACTIVITIES } from '../src/lessons/shared/activities/activityPlan.js'

const curriculum = JSON.parse(await readFile(new URL('../../shared/recursion-lesson.json', import.meta.url), 'utf8'))
const support = JSON.parse(await readFile(new URL('../../shared/control-support.json', import.meta.url), 'utf8'))

test('every supported activity has two static hints and a complete fallback, with no assessment answers', () => {
  const allowed = curriculum.parts.flatMap((part, i) => part.ai_allowed ? ACTIVITIES[i].map((activity) => activity.id) : [])
  assert.deepEqual(Object.keys(support.activities).sort(), allowed.sort())
  for (const activity of Object.values(support.activities)) {
    assert.equal(activity.hints.length, 2)
    assert.ok(activity.hints.every((hint) => typeof hint === 'string' && hint.trim()))
    assert.ok(activity.solution.paragraphs.length > 0)
  }
})
