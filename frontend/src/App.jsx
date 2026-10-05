import { lazy, Suspense } from 'react'
import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'

const AiLesson = lazy(() => import('./lessons/ai/AiLesson.jsx'))
const ControlLesson = lazy(() => import('./lessons/control/ControlLesson.jsx'))

function SetupPage() {
  return (
    <main className="setup-page">
      <p className="eyebrow">CS-411 · Digital education</p>
      <h1>One topic.<br />Two ways to learn.</h1>
      <p className="lead">Recursion, with a path toward memoization. Two lesson environments for exploring how support affects learning.</p>
      <div className="setup-links">
        <Link className="setup-card" to="/ai-lesson"><span className="eyebrow">Environment 01</span><h2>AI-assisted lesson <span aria-hidden="true">↗</span></h2><p>Ask a tutor for hints, explanations, and worked answers.</p></Link>
        <Link className="setup-card" to="/control-lesson"><span className="eyebrow">Environment 02</span><h2>Control lesson <span aria-hidden="true">↗</span></h2><p>Reveal prepared hints and compare your answer with a correction.</p></Link>
      </div>
      <p className="muted">Organizer preview. Send participants the direct link to their assigned lesson.</p>
    </main>
  )
}

function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <Suspense fallback={<main className="setup-page" role="status">Loading lesson…</main>}>
          <Routes>
            <Route path="/" element={<SetupPage />} />
            <Route path="/ai-lesson" element={<AiLesson />} />
            <Route path="/control-lesson" element={<ControlLesson />} />
            <Route path="/lesson-ai" element={<Navigate to="/ai-lesson" replace />} />
            <Route path="/lesson-standard" element={<Navigate to="/control-lesson" replace />} />
            <Route path="*" element={<main className="setup-page"><h1>Lesson not found</h1><p>Check the link you received from the lesson organizer.</p></main>} />
          </Routes>
        </Suspense>
      </div>
    </HashRouter>
  )
}

export default App
