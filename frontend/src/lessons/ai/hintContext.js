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

