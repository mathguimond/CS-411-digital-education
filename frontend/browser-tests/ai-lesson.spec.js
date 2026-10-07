import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'

const lesson = JSON.parse(await readFile(new URL('../../shared/recursion-lesson.json', import.meta.url), 'utf8'))
const storageKey = `dynamic-learning:ai:${lesson.version}`
const stairs = 'def climb_stairs(n):\n    if n < 2:\n        return 1\n    return climb_stairs(n - 1) + climb_stairs(n - 2)\n'
const memo = 'def climb_stairs(n):\n    cache = {}\n    def solve(k):\n        if k not in cache:\n            cache[k] = 1 if k < 2 else solve(k - 1) + solve(k - 2)\n        return cache[k]\n    return solve(n)\n'
const grid = 'def unique_paths(rows, cols):\n    cache = {}\n    def solve(r, c):\n        if (r, c) not in cache:\n            if not r or not c:\n                cache[r, c] = 0\n            elif r == 1 or c == 1:\n                cache[r, c] = 1\n            else:\n                cache[r, c] = solve(r - 1, c) + solve(r, c - 1)\n        return cache[r, c]\n    return solve(rows, cols)\n\nprint(unique_paths(3, 3))\n'
const nextActivity = (page) => page.getByRole('button', { name: 'Submit attempt & unlock next activity', exact: true }).click()

async function pretest(page) {
  for (const [name, value] of [['trace-baseline', 1], ['duplicate-baseline', 1], ['complexity-baseline', 3], ['memo-experience', 2]]) await page.locator(`input[name="${name}"][value="${value}"]`).check()
  await page.getByRole('button', { name: 'Submit pre-test & continue' }).click()
}
async function fillAnswers(page, ids) {
  for (const id of ids) await page.locator(`#${id}`).fill('My explanation of the base cases, smaller states, pending calls, and cache.')
}

async function revealFixedSolution(page) {
  const panel = page.locator('#lesson-support')
  await expect(panel.getByRole('button', { name: 'Show worked answer ↗', exact: true })).toBeDisabled()
  await panel.getByRole('button', { name: 'Reveal hint 1', exact: true }).click()
  await expect(panel.getByRole('button', { name: 'Show worked answer ↗', exact: true })).toBeDisabled()
  await panel.getByRole('button', { name: 'Reveal hint 2', exact: true }).click()
  await panel.getByRole('button', { name: 'Show worked answer ↗', exact: true }).click()
  await expect(panel.getByText('Worked answer', { exact: true })).toBeVisible()
}

// Build a complete tree through the same add/select/input controls learners use.
async function constructTree(page, kind, activityId) {
  let number = 1
  async function fill(nodeNumber, args) {
    const name = new RegExp(`^Select call ${nodeNumber === 1 ? 'root' : nodeNumber}:`)
    await page.getByRole('button', { name }).click()
    if (nodeNumber !== 1) for (let i = 0; i < args.length; i++) await page.locator(`#${activityId}-arg-${i}`).fill(String(args[i]))
    const base = kind === 'stairs' ? args[0] < 2 : args[0] === 1 || args[1] === 1
    let value = 1
    if (!base) {
      value = 0
      const children = kind === 'stairs' ? [[args[0] - 1], [args[0] - 2]] : [[args[0] - 1, args[1]], [args[0], args[1] - 1]]
      for (const child of children) {
        await page.getByRole('button', { name }).click()
        await page.getByRole('button', { name: 'Add child call', exact: true }).click()
        value += await fill(++number, child)
      }
    }
    await page.getByRole('button', { name }).click()
    await page.locator(`#${activityId}-return`).fill(String(value))
    return value
  }
  await fill(1, kind === 'stairs' ? [5] : [3, 3])
}

for (const condition of ['ai', 'control']) {
test(`${condition}: shared study flow, support, real Python, grid assessment and export`, async ({ page }, testInfo) => {
  const requests = [], exceptions = []
  page.on('pageerror', (error) => exceptions.push(error.message))
  await page.route('**/api/ai/chat', async (route) => {
    requests.push(route.request().postDataJSON())
    await route.fulfill({ json: { reply: `Hint ${requests.length}: consider your current smaller inputs.` } })
  })
  await page.goto(`./#/${condition}-lesson`)
  await expect(page.locator('.condition-badge')).toContainText(condition === 'ai' ? 'AI-assisted lesson' : 'Control lesson')
  await expect(page.locator('#lesson-support')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Submit pre-test & continue' })).toBeDisabled()
  await pretest(page)
  await expect(page.getByRole('button', { name: /Pre-test$/ })).toBeDisabled()
  await expect(page.locator('#tutor-message')).toHaveCount(0)
  await page.getByRole('button', { name: 'Next animation step' }).click()
  await expect(page.getByText('Call stack · 2 frames', { exact: true })).toBeVisible()
  await expect(page.getByRole('img', { name: /Nesting doll call tree/ })).toBeVisible()
  await fillAnswers(page, ['intro-base', 'intro-reduction', 'intro-stack'])
  if (condition === 'ai') {
    await page.getByRole('button', { name: 'Ask for a hint', exact: true }).click()
    await expect(page.locator('#tutor-message')).toBeVisible()
    expect(JSON.parse(requests[0].learner_context).baseline.score).toBe(3)
    await page.locator('#tutor-message').fill('What is pending in my example?')
    await page.getByRole('button', { name: /Send follow-up/ }).click()
    await expect(page.getByText('Hint 2: consider your current smaller inputs.')).toBeVisible()
    expect(requests[1].history.length).toBe(2)
  } else {
    await revealFixedSolution(page)
    await expect(page.locator('#tutor-message')).toHaveCount(0)
  }
  await page.reload()
  await expect(page.locator('#intro-base')).toHaveValue(/My explanation/)
  if (condition === 'ai') await expect(page.locator('#tutor-message')).toBeVisible()
  else await expect(page.locator('#lesson-support').getByText('Worked answer', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Submit attempt & continue', exact: true }).click()

  await expect(page.locator('#tutor-message')).toHaveCount(0)
  if (condition === 'ai') await expect(page.locator('.chat-transcript')).toContainText('Hint 1:')
  else await expect(page.getByRole('button', { name: 'Reveal hint 1', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /2 · Construct your call tree/ })).toBeDisabled()
  await expect(page.locator('.tree-builder')).toHaveCount(0)
  await fillAnswers(page, ['stairs-suitability', 'stairs-recurrence'])
  await page.locator('#code-stairs').fill(stairs)
  await page.getByRole('button', { name: 'Run tests', exact: true }).click()
  await expect(page.getByText('All practice checks passed.', { exact: true })).toBeVisible({ timeout: 70000 })
  if (condition === 'ai') {
    await page.getByRole('button', { name: 'Ask for a hint', exact: true }).click()
    await expect(page.locator('#tutor-message')).toBeVisible()
    const context = JSON.parse(requests.at(-1).learner_context)
    expect(context.activity.id).toBe('stairs-design')
    expect(context.code).toContain('def climb_stairs(n):')
    expect(context.lastRun.passed).toBe(true)
    expect(requests.at(-1).history).toEqual([])
  } else {
    await revealFixedSolution(page)
    await expect(page.locator('#lesson-support .worked-code')).toContainText('def climb_stairs(n):')
  }
  await nextActivity(page)
  await expect(page.locator('#tutor-message')).toHaveCount(0)
  await constructTree(page, 'stairs', 'stairs-trace')
  await page.getByRole('button', { name: 'Check my tree', exact: true }).click()
  await expect(page.getByText('Your tree checks passed.')).toBeVisible()
  await fillAnswers(page, ['stairs-depth', 'stairs-stack'])
  if (condition === 'ai') {
    await page.getByRole('button', { name: 'Ask for a hint', exact: true }).click()
    await expect(page.locator('#tutor-message')).toBeVisible()
    expect(JSON.parse(requests.at(-1).learner_context).tree.length).toBe(15)
  } else {
    await revealFixedSolution(page)
    await expect(page.locator('#lesson-support .call-tree-figure')).toHaveAccessibleName('Naive Climbing Stairs call tree')
    await expect(page.locator('#lesson-support .node-result')).toHaveCount(15)
    await expect(page.locator('#lesson-support .tree-node.returned')).toHaveCount(0)
    await page.locator('#lesson-support').getByRole('button', { name: 'Next tree step' }).click()
    await expect(page.locator('#lesson-support').getByText('Stack · 2 frames', { exact: true })).toBeVisible()
  }
  await page.screenshot({ path: testInfo.outputPath('stairs-tree-desktop.png'), fullPage: true })
  await page.getByRole('button', { name: 'Submit attempt & continue', exact: true }).click()

  await expect(page.locator('#tutor-message')).toHaveCount(0)
  if (condition === 'ai') await expect(page.locator('.chat-transcript')).toContainText('Hint 4:')
  else await expect(page.getByRole('button', { name: 'Reveal hint 1', exact: true })).toBeVisible()
  await expect(page.locator('#code-memoization')).toHaveCount(0)
  await fillAnswers(page, ['memo-example-explanation'])
  await nextActivity(page)
  await fillAnswers(page, ['stairs-two-count', 'stairs-extra-count', 'stairs-redundancy'])
  await nextActivity(page)
  await expect(page.locator('#code-memoization')).toHaveValue(stairs)
  await page.getByRole('button', { name: 'Run tests', exact: true }).click()
  await expect(page.getByText(/There is still repeated work to investigate/)).toBeVisible({ timeout: 70000 })
  if (condition === 'control') {
    await revealFixedSolution(page)
    await expect(page.locator('#lesson-support .worked-code')).toContainText('cache[k] = result')
  }
  await page.locator('#code-memoization').fill(memo)
  await page.getByRole('button', { name: 'Run tests', exact: true }).click()
  await expect(page.getByText('All practice checks passed.', { exact: true })).toBeVisible({ timeout: 15000 })
  await fillAnswers(page, ['stairs-cache', 'stairs-complexity'])
  await page.getByRole('button', { name: 'Start the transfer task' }).click()

  await expect(page.getByRole('button', { name: /Build & trace$/ })).toBeDisabled()
  await expect(page.locator('#lesson-support')).toHaveCount(0)
  await expect(page.locator('.mobile-support-toggle')).toHaveCount(0)
  await expect(page.locator('#code-transfer')).toHaveCount(0)
  await fillAnswers(page, ['grid-base', 'grid-reduction', 'grid-stack'])
  await nextActivity(page)
  await page.locator('#code-transfer').fill(grid)
  await page.getByRole('button', { name: 'Run my code', exact: true }).click()
  await expect(page.locator('.program-output')).toHaveText('6', { timeout: 70000 })
  await expect(page.locator('.test-results')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Check my tree' })).toHaveCount(0)
  await constructTree(page, 'grid', 'grid-build')
  await fillAnswers(page, ['grid-recurrence', 'grid-depth'])
  await nextActivity(page)
  await expect(page.getByRole('button', { name: /Explain before executing/ })).toBeDisabled()
  await fillAnswers(page, ['grid-overlap', 'grid-cache', 'grid-complexity'])
  await page.getByRole('button', { name: 'Submit final assessment' }).click()
  await expect(page.getByRole('heading', { name: 'You made the jump.' })).toBeVisible({ timeout: 70000 })
  await expect(page.getByText('Call-count check: passed', { exact: true })).toBeVisible()
  await expect(page.getByText('Constructed call tree: passed', { exact: true })).toBeVisible()
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download my lesson record' }).click()
  const exported = JSON.parse(await readFile(await (await downloadEvent).path(), 'utf8'))
  expect(exported.schemaVersion).toBe(3)
  expect(exported.condition).toBe(condition)
  expect(exported.assessment.passed).toBe(true)
  expect(exported.assessment.treeAssessment.passed).toBe(true)
  expect(exported.metrics.unsuccessfulMemoizationRuns).toBe(1)
  expect(exported.metrics.hintRequests).toBe(condition === 'ai' ? 3 : 8)
  expect(exported.metrics.aiInteractionTurns).toBe(condition === 'ai' ? 4 : 0)
  expect(exported.metrics.fixedHintsOpened).toBe(condition === 'ai' ? 0 : 8)
  expect(exported.metrics.fallbackSolutionsDisplayed).toBe(condition === 'ai' ? 0 : 4)
  expect(exported.cohortFlags.possiblePriorMastery).toBe(true)
  expect(exported.chatHistory).toBeUndefined()
  expect(exported.completedActivities.length).toBe(10)
  expect(requests.every((request) => !['ai-pretest', 'ai-transfer'].includes(request.step_id))).toBe(true)
  if (condition === 'control') {
    expect(requests).toEqual([])
    expect(exported.supportVersion).toBe('fixed-hints-v1')
  }
  await page.reload()
  await expect(page.getByRole('heading', { name: 'You made the jump.' })).toBeVisible()
  expect(exceptions).toEqual([])
})
}

test('mobile AI hint button, retry, hover cursor, and control starting point', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let calls = 0
  await page.route('**/api/ai/chat', (route) => route.fulfill(++calls === 1 ? { status: 502, json: { error: 'Please try your hint again.' } } : { json: { reply: 'Consider the smallest input in your explanation.' } }))
  await page.goto('./#/ai-lesson')
  await expect(page.locator('#lesson-support')).toHaveCount(0)
  await pretest(page)
  await page.getByRole('button', { name: 'Open AI hints ↗', exact: true }).click()
  await expect(page.locator('#tutor-message')).toHaveCount(0)
  const hint = page.getByRole('button', { name: 'Ask for a hint', exact: true })
  expect(await hint.evaluate((element) => getComputedStyle(element).cursor)).toBe('pointer')
  await hint.click()
  await expect(page.getByText('Please try your hint again.')).toBeVisible()
  await expect(page.locator('#tutor-message')).toHaveCount(0)
  await hint.click()
  await expect(page.locator('#tutor-message')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('hint-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'Close hints', exact: true }).first().click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.goto('./#/control-lesson')
  await expect(page.locator('.brand')).toContainText('DYNAMIC LEARNING')
  await expect(page.locator('#tutor-message')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Your starting point' })).toBeVisible()
})

test('control hints work on mobile and both routes preserve separate progress and support', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const requests = []
  await page.route('**/api/ai/chat', (route) => {
    requests.push(route.request().postDataJSON())
    return route.fulfill({ json: { reply: 'An AI-only reply.' } })
  })
  await page.goto('./#/ai-lesson')
  await pretest(page)
  await page.locator('#intro-base').fill('My AI group answer.')
  await page.goto('./#/control-lesson')
  await expect(page.getByRole('heading', { name: 'Your starting point' })).toBeVisible()
  await expect(page.locator('#lesson-support')).toHaveCount(0)
  await expect(page.locator('.mobile-support-toggle')).toHaveCount(0)
  await pretest(page)
  await expect(page.locator('#intro-base')).toHaveValue('')
  await page.locator('#intro-base').fill('My control group answer.')
  await page.getByRole('button', { name: 'Open fixed hints ↗', exact: true }).click()
  await revealFixedSolution(page)
  await expect(page.locator('#tutor-message')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('control-hints-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'Close hints', exact: true }).first().click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.goto('./#/ai-lesson')
  await expect(page.locator('#intro-base')).toHaveValue('My AI group answer.')
  await expect(page.getByRole('button', { name: 'Reveal hint 1' })).toHaveCount(0)
  await page.goto('./#/control-lesson')
  await expect(page.locator('#intro-base')).toHaveValue('My control group answer.')
  await page.getByRole('button', { name: 'Open fixed hints ↗', exact: true }).click()
  await expect(page.locator('#lesson-support').getByText('Worked answer', { exact: true })).toBeVisible()
  expect(requests).toEqual([])
})

test('dragging a tree and an unsuccessful attempt still unlock the next activity', async ({ page }) => {
  await page.goto('./#/ai-lesson')
  await expect(page.getByRole('heading', { name: 'Your starting point' })).toBeVisible()
  await page.addInitScript((key) => {
    const saved = JSON.parse(sessionStorage.getItem(key))
    Object.assign(saved, { partIndex: 2, completedParts: [0, 1], pretestSubmitted: true, baseline: { score: 0, total: 3 }, completedActivities: ['diagnostic', 'recursion-components', 'stairs-design'], activityIndexByPart: { 2: 1 } })
    sessionStorage.setItem(key, JSON.stringify(saved))
  }, storageKey)
  await page.reload()
  const root = page.getByRole('button', { name: /^Select call root:/ })
  await root.scrollIntoViewIfNeeded()
  const bounds = await root.boundingBox()
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down(); await page.mouse.move(bounds.x + bounds.width / 2 + 50, bounds.y + bounds.height / 2 + 30, { steps: 5 }); await page.mouse.up()
  const x = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)).trees.stairs.nodes[0].x, storageKey)
  expect(x).toBeGreaterThan(750)
  await root.press('ArrowRight')
  await expect.poll(() => page.evaluate((key) => JSON.parse(sessionStorage.getItem(key)).trees.stairs.nodes[0].x, storageKey)).toBe(x + 10)
  await page.locator('#stairs-trace-return').fill('0')
  for (let i = 0; i < 2; i++) {
    await root.click()
    await page.getByRole('button', { name: 'Add child call', exact: true }).click()
    await page.locator('#stairs-trace-arg-0').fill('5')
    await page.locator('#stairs-trace-return').fill('0')
  }
  await fillAnswers(page, ['stairs-depth', 'stairs-stack'])
  await page.getByRole('button', { name: 'Check my tree' }).click()
  await expect(page.getByText('Revisit these calls:')).toBeVisible()
  await page.getByRole('button', { name: 'Submit attempt & continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Study a worked cache example', exact: true })).toBeVisible()
})

test('assessment timeout does not block editing, worker recovers, and syntax failure submits', async ({ page }) => {
  await page.goto('./#/ai-lesson')
  await expect(page.getByRole('heading', { name: 'Your starting point' })).toBeVisible()
  await page.addInitScript((key) => {
    const saved = JSON.parse(sessionStorage.getItem(key))
    Object.assign(saved, { partIndex: 4, completedParts: [0, 1, 2, 3], pretestSubmitted: true, transferStarted: true, baseline: { score: 2, total: 3 }, completedActivities: ['grid-components', 'grid-build'], activityIndexByPart: { 4: 2 } })
    sessionStorage.setItem(key, JSON.stringify(saved))
  }, storageKey)
  await page.reload()
  await page.locator('#code-transfer').fill('while True:\n    pass\n')
  await page.getByRole('button', { name: 'Run my code', exact: true }).click()
  await page.locator('#grid-overlap').fill('My explanation while the code runs.')
  await expect(page.getByText('This run exceeded 8 seconds and was stopped.', { exact: true })).toBeVisible({ timeout: 70000 })
  await page.locator('#code-transfer').fill('print(42)')
  await page.getByRole('button', { name: 'Run my code', exact: true }).click()
  await expect(page.locator('.program-output')).toHaveText('42', { timeout: 70000 })
  await expect(page.locator('.test-results')).toHaveCount(0)
  await page.locator('#code-transfer').fill('def unique_paths(:')
  await fillAnswers(page, ['grid-overlap', 'grid-cache', 'grid-complexity'])
  await page.getByRole('button', { name: 'Submit final assessment' }).click()
  await expect(page.getByRole('heading', { name: 'You made the jump.' })).toBeVisible({ timeout: 70000 })
  await expect(page.getByText(/SyntaxError on line 1/)).toBeVisible()
  await expect(page.getByText('0/11', { exact: true })).toBeVisible()
  await expect(page.getByText('Recursive call detected: not assessed', { exact: true })).toBeVisible()
})
