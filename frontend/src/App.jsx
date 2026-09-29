import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'

function LessonPage({ title, description }) {
  return (
    <main className="page">
      <h1>{title}</h1>
      <p>{description}</p>
      <p className="note">Lesson content will be added in future issues.</p>
    </main>
  )
}

function Navigation() {
  return (
    <nav aria-label="Lesson navigation">
      <ul>
        <li>
          <Link to="/lesson-ai">AI-assisted lesson</Link>
        </li>
        <li>
          <Link to="/lesson-standard">Non-AI lesson</Link>
        </li>
      </ul>
    </nav>
  )
}

function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <Navigation />
        <Routes>
          <Route path="/" element={<Navigate to="/lesson-ai" replace />} />
          <Route
            path="/lesson-ai"
            element={
              <LessonPage
                title="AI-Assisted Lesson"
                description="Starter page for the lesson version that will include AI support."
              />
            }
          />
          <Route
            path="/lesson-standard"
            element={
              <LessonPage
                title="Non-AI Lesson"
                description="Starter page for the lesson version without AI support."
              />
            }
          />
        </Routes>
      </div>
    </HashRouter>
  )
}

export default App
