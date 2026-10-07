import { useEffect, useRef, useState } from 'react'

export default function usePython() {
  const workerRef = useRef(null)
  const pendingRef = useRef(null)
  const [status, setStatus] = useState('idle')

  function destroy() { workerRef.current?.terminate(); workerRef.current = null }

  useEffect(() => () => {
    destroy()
    pendingRef.current?.reject(new Error('Code execution was cancelled.'))
  }, [])

  async function execute(source, activity, mode = 'test') {
    if (pendingRef.current) throw new Error('A program is already running.')
    setStatus(workerRef.current ? 'running' : 'loading')
    if (!workerRef.current) workerRef.current = new Worker(new URL('./python.worker.js', import.meta.url), { type: 'module' })
    const worker = workerRef.current
    return new Promise((resolve, reject) => {
      let timeout
      function stopTimer() { clearTimeout(timeout) }
      function fail(message, code = 'runtime_unavailable') {
        const error = new Error(message)
        error.code = code
        stopTimer(); pendingRef.current = null; destroy(); setStatus('idle'); reject(error)
      }
      function executionTimer() {
        stopTimer()
        timeout = setTimeout(() => fail('This run exceeded 8 seconds and was stopped.', 'execution_timeout'), 8000)
      }
      // Loading is separate from execution; slow first downloads are not counted as code failures.
      timeout = setTimeout(() => fail('Python could not load. Check your internet connection and try again.'), 60000)
      pendingRef.current = { reject: (error) => { stopTimer(); pendingRef.current = null; reject(error) } }
      worker.onmessage = ({ data }) => {
        if (data.type === 'ready') { setStatus('running'); executionTimer() }
        if (data.type === 'result') { stopTimer(); pendingRef.current = null; setStatus('idle'); resolve(data.result) }
        if (data.type === 'error') fail(data.error)
      }
      worker.onerror = () => fail('Python could not start. Check your connection and try again.')
      // A warm worker is already ready and will not send another ready event.
      if (worker.__lessonReady) executionTimer()
      const onMessage = worker.onmessage
      worker.onmessage = (event) => { if (event.data.type === 'ready') worker.__lessonReady = true; onMessage(event) }
      worker.postMessage({ source, activity, mode, runnerUrl: new URL(`${import.meta.env.BASE_URL}python/lesson_runner.py`, location.origin).href })
    })
  }

  return { execute, status, busy: status !== 'idle' }
}
