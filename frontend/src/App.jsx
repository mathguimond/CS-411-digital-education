import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { StudyAuthProvider } from './auth/StudyAuth.jsx'
import { useStudyAuth } from './auth/authContext.js'
import LoginPage from './auth/LoginPage.jsx'
import './App.css'
import './lessons/shared/RecursionLesson.css'

const AiLesson = lazy(() => import('./lessons/ai/AiLesson.jsx'))
const ControlLesson = lazy(() => import('./lessons/control/ControlLesson.jsx'))

function AssignedLesson({ condition }) {
  const auth = useStudyAuth()
  if (!auth.data) return <Navigate to="/login" replace />
  const assigned = auth.data.participant.condition
  if (assigned !== condition) return <Navigate to={`/${assigned}-lesson`} replace />
  return condition === 'ai' ? <AiLesson /> : <ControlLesson />
}

function StudyRoutes() {
  const auth = useStudyAuth()
  if (auth.loading) return <main className="setup-page" role="status">Restoring your lesson…</main>
  if (auth.error) return <main className="setup-page"><h1>Reconnect to your lesson.</h1><p role="alert">{auth.error}</p><button onClick={auth.retry}>Try again</button></main>
  return <Suspense fallback={<main className="setup-page" role="status">Loading lesson…</main>}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/ai-lesson" element={<AssignedLesson condition="ai" />} />
    <Route path="/control-lesson" element={<AssignedLesson condition="control" />} />
    <Route path="*" element={<Navigate to={auth.data ? `/${auth.data.participant.condition}-lesson` : '/login'} replace />} />
  </Routes></Suspense>
}

export default function App() {
  return <HashRouter><StudyAuthProvider><div className="app-shell"><StudyRoutes /></div></StudyAuthProvider></HashRouter>
}
