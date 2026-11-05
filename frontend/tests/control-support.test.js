import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { lesson } from '../src/lessons/shared/content.js'

const support = JSON.parse(await readFile(new URL('../../shared/control-support.json', import.meta.url), 'utf8'))
const config = JSON.parse(await readFile(new URL('../../shared/study-config.json', import.meta.url), 'utf8'))
test('every enabled question has exactly its allowed short hints and no worked solutions', () => {
  assert.deepEqual(config.hintLimits, { text: 3, choice: 3, tree: 5, code: 5 })
  const expected = new Set(lesson.activities.flatMap((activities, index) => lesson.parts[index].ai_allowed ? activities.flatMap((activity) => [...activity.fields, ...activity.hintQuestions || []]) : []))
  assert.deepEqual(Object.keys(support.questions).sort(), [...expected].sort())
  assert.equal(JSON.stringify(support).includes('solution'), false)
  for (const [id, hints] of Object.entries(support.questions)) {
    assert.equal(hints.length, config.hintLimits[lesson.questions[id].kind])
    for (const hint of hints) assert.ok((hint.match(/[.!?](?=\s|$)/g) || []).length <= 2, `${id}: ${hint}`)
  }
})
