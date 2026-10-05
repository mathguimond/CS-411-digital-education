const PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/'
let runtime

self.onmessage = async ({ data }) => {
  try {
    if (!runtime) {
      self.postMessage({ type: 'loading' })
      const { loadPyodide } = await import(/* @vite-ignore */ `${PYODIDE_BASE}pyodide.mjs`)
      runtime = await loadPyodide({ indexURL: PYODIDE_BASE })
      const response = await fetch(data.runnerUrl)
      if (!response.ok) throw new Error('The lesson code runner could not be loaded.')
      runtime.runPython(await response.text())
      self.postMessage({ type: 'ready' })
    }
    runtime.globals.set('learner_source', data.source)
    runtime.globals.set('learner_activity', data.activity)
    runtime.globals.set('learner_mode', data.mode)
    const serialized = await runtime.runPythonAsync('run_activity_json(learner_source, learner_activity, learner_mode)')
    self.postMessage({ type: 'result', result: JSON.parse(serialized) })
  } catch (error) {
    self.postMessage({ type: 'error', error: error.message || 'Python could not run. Please try again.' })
  }
}
