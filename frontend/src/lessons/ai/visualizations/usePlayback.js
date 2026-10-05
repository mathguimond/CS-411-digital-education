import { useEffect, useState } from 'react'

export default function usePlayback(length, interval = 1100) {
  const [{ index, playing }, setPlayback] = useState({ index: 0, playing: false })

  useEffect(() => {
    if (!playing) return
    const timer = setInterval(() => {
      setPlayback((current) => {
        const next = Math.min(current.index + 1, length - 1)
        return { index: next, playing: next < length - 1 }
      })
    }, interval)
    return () => clearInterval(timer)
  }, [playing, length, interval])

  function reset() { setPlayback({ index: 0, playing: false }) }
  function step(delta) { setPlayback((current) => ({ index: Math.max(0, Math.min(current.index + delta, length - 1)), playing: false })) }
  function toggle() {
    setPlayback((current) => ({ index: current.index === length - 1 ? 0 : current.index, playing: !current.playing }))
  }
  return { index, playing, reset, step, toggle }
}
