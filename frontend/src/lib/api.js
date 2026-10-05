const baseUrl = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/+$/, '')

export async function askTutor({ message, history, stepId, signal, learnerContext }) {
  let response
  try {
    response = await fetch(`${baseUrl}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ condition: 'ai', step_id: stepId, message, history, ...(learnerContext ? { learner_context: learnerContext } : {}) }),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Cannot reach the AI tutor. Check your connection and try again.')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data?.error || 'The AI tutor is temporarily unavailable.')
  if (typeof data?.reply !== 'string' || !data.reply.trim()) throw new Error('The tutor returned an empty response. Please try again.')
  return data.reply
}

// Preserve complete turns and fit the backend history limits.
export function recentHistory(messages) {
  const history = []
  let chars = 0
  for (let index = messages.length - 2; index >= 0; index -= 2) {
    const pair = messages.slice(index, index + 2)
    const pairChars = pair.reduce((sum, entry) => sum + entry.content.length, 0)
    if (history.length + 2 > 12 || chars + pairChars > 16000) break
    history.unshift(...pair.map(({ role, content }) => ({ role, content })))
    chars += pairChars
  }
  return history
}
