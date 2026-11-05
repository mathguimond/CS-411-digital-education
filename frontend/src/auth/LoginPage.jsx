import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import config from '../../../shared/study-config.json'
import { useStudyAuth } from './authContext.js'

export default function LoginPage() {
  const auth = useStudyAuth()
  const [details, setDetails] = useState({ gender: '', age: '', school_level: '', degree: '', referrer: '' })
  const [consented, setConsented] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (auth.data) return <Navigate to={`/${auth.data.participant.condition}-lesson`} replace />
  const change = (key) => (event) => setDetails((value) => ({ ...value, [key]: event.target.value }))
  async function submit(event) {
    event.preventDefault()
    if (!consented) { setError('Please give your consent before continuing.'); return }
    setBusy(true); setError('')
    try { await auth.enroll({ ...details, data_consent: consented, consent_version: config.consent.version }) } catch (failure) { setError(failure.message) } finally { setBusy(false) }
  }
  const ages = Array.from({ length: config.maximumIndividualAge - config.minimumAge + 1 }, (_, i) => String(i + config.minimumAge)).concat(config.olderAgeOption)
  return <main className="study-login recursion-lesson">
    <header className="lesson-header"><div className="brand"><span className="brand-mark" aria-hidden="true">↳</span>DYNAMIC LEARNING</div></header>
    <section className="login-card lesson-content"><p className="eyebrow">Welcome to the study</p><h1>Before we begin.</h1><p className="lead">Tell us a little about your background. We’ll then assign your lesson.</p>
      <form onSubmit={submit}><fieldset disabled={busy} className="plain-fieldset">
        <fieldset className="login-gender"><legend>Gender</legend><div className="login-radio-row">{config.gender.map((option) => <label key={option.id}><input type="radio" name="gender" value={option.id} checked={details.gender === option.id} onChange={change('gender')} required />{option.label}</label>)}</div></fieldset>
        <label htmlFor="participant-age">Age</label><select id="participant-age" value={details.age} onChange={change('age')} required><option value="">Select your age</option>{ages.map((age) => <option key={age}>{age}</option>)}</select>
        <label htmlFor="participant-level">Current school level</label><select id="participant-level" value={details.school_level} onChange={change('school_level')} required><option value="">Select your school level</option>{config.schoolLevels.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}</select>
        <label htmlFor="participant-degree">Degree or program</label><input id="participant-degree" type="text" value={details.degree} onChange={change('degree')} maxLength={200} required placeholder="For example, BSc Computer Science" />
        <label htmlFor="participant-referrer">Who referred you to this study?</label><select id="participant-referrer" value={details.referrer} onChange={change('referrer')} required><option value="">Select a name</option>{config.referrers.map((referrer) => <option key={referrer.id} value={referrer.id}>{referrer.label}</option>)}</select>
        <p className="small muted">Your background, responses, Python code, call trees, hint conversations, and lesson interactions are saved for this study. Keep this browser open to complete the lesson in one sitting; refreshing preserves your progress.</p>
        <label className="login-consent" htmlFor="participant-consent"><input id="participant-consent" type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} required /><span>{config.consent.text}</span></label>
        <button type="submit" className="full-width" disabled={busy || !consented || Object.values(details).some((value) => !value.trim())}>{busy ? 'Preparing your lesson…' : 'Continue'}</button>
      </fieldset></form>{error && <p className="error-message" role="alert">{error}</p>}
    </section>
  </main>
}
