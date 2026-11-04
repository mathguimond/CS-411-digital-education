import { studyRequest } from '../../../lib/studyApi.js'
import { createLessonSession, currentActivity, snapshotForSave } from './lessonState.js'

export class StudyStore {
  constructor({ remote, token, api = studyRequest, storage = localStorage }) {
    this.api = api; this.token = token; this.storage = storage
    this.key = `dynamic-learning:study:${remote.participant.id}`
    this.listeners = new Set(); this.busy = ''; this.saveError = ''; this.hintError = ''; this.saving = false; this.retryAt = 0
    let saved
    try { saved = JSON.parse(storage.getItem(this.key)) } catch { /* Start with server state. */ }
    const participant = remote.participant
    const initial = { ...createLessonSession(participant.lessonVersion, participant.condition, null, participant.id), ...remote.snapshot, chatHistory: remote.conversation, hintUsage: remote.hintUsage }
    const conflict = saved?.conflict && remote.revision > saved.revision
    if (conflict) { try { storage.setItem(`${this.key}:conflict-draft`, JSON.stringify(saved)) } catch { /* Keep the authoritative saved lesson available. */ } }
    const restore = !conflict && saved?.session?.sessionId === participant.id && saved.session.lessonVersion === participant.lessonVersion && (saved.pendingBatch || saved.pendingCheckpoint || saved.dirty || saved.queue?.length)
    // After an explicit reload, restore newer server work while retaining the old
    // draft locally and uploading its unsent interaction events for the study record.
    this.cache = restore ? saved : { session: initial, revision: remote.revision, queue: conflict ? saved.queue : [], sequence: 0, dirty: Boolean(conflict && saved.queue?.length), pendingBatch: null, pendingCheckpoint: null }
    this.cache.session.events ||= []
    this.cache.session.chatHistory = remote.conversation
    this.cache.session.hintUsage = remote.hintUsage
    this.clock = remote.clock
    this.offset = Date.parse(remote.clock.serverNow) - Date.now()
    this.persist()
  }

  get session() { return this.cache.session }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener) }
  emit() { for (const listener of this.listeners) listener() }
  persist() {
    if (this.running === false) return
    try { this.storage.setItem(this.key, JSON.stringify({ ...this.cache, session: { ...this.session, events: [] } })) } catch { this.saveError = 'This browser could not save a local backup. Keep the page open until your work has synced.' }
  }
  update(change) {
    this.cache.session = typeof change === 'function' ? change(this.session) : change
    this.cache.sequence++; this.cache.dirty = true; this.persist(); this.emit()
  }
  elapsedMs() {
    if (!this.clock.startedAt) return null
    return Math.max(0, (this.clock.stoppedAt ? Date.parse(this.clock.stoppedAt) : Date.now() + this.offset) - Date.parse(this.clock.startedAt))
  }
  record(type, details = {}) {
    const event = { id: crypto.randomUUID(), type, timestamp: new Date().toISOString(), elapsedMs: this.elapsedMs(), activityId: currentActivity(this.session).id, ...details }
    this.cache.queue.push(event)
    this.update((session) => ({ ...session, events: [...session.events.slice(-99), event] }))
  }
  async send(path, body, method = 'POST') { return this.api(path, { token: this.token, method, body }) }

  async flush() {
    if (this.flushing) return this.flushing
    this.flushing = this.flushBatches().finally(() => { this.flushing = null })
    return this.flushing
  }
  async flushBatches() {
    this.saving = true; this.emit()
    try {
      while (this.cache.pendingBatch || this.cache.dirty || this.cache.queue.length) {
        if (!this.cache.pendingBatch) {
          const events = []
          const body = { id: crypto.randomUUID(), revision: this.cache.revision, snapshot: snapshotForSave(this.session), events }
          for (const event of this.cache.queue.slice(0, 25)) {
            if (JSON.stringify(body).length + JSON.stringify(event).length > 400000) break
            events.push(event)
          }
          this.cache.pendingBatch = { body, sequence: this.cache.sequence }
          this.persist()
        }
        const pending = this.cache.pendingBatch
        const response = await this.send('/session', pending.body, 'PUT')
        this.cache.revision = response.revision
        const sent = new Set(pending.body.events.map((event) => event.id))
        this.cache.queue = this.cache.queue.filter((event) => !sent.has(event.id))
        this.cache.dirty = this.cache.sequence !== pending.sequence
        this.cache.pendingBatch = null
        this.saveError = ''; this.retryAt = 0
        this.persist()
      }
    } catch (error) {
      this.saveError = error.message
      this.blocked = ['revision_conflict', 'version_conflict'].includes(error.code)
      this.cache.conflict = error.code === 'revision_conflict'
      this.retryAt = Date.now() + 5000
      throw error
    } finally { this.saving = false; this.persist(); this.emit() }
  }
  mergeRemote(remote) {
    this.cache.session = { ...this.session, ...remote.snapshot, hintUsage: remote.hintUsage, chatHistory: remote.conversation }
    this.cache.revision = remote.revision
    this.clock = remote.clock; this.offset = Date.parse(remote.clock.serverNow) - Date.now()
    this.persist(); this.emit()
  }
  async checkpoint() {
    if (this.busy || this.blocked) return
    this.busy = 'checkpoint'; this.saveError = ''; this.emit()
    try {
      if (!this.cache.pendingCheckpoint) {
        const activityId = currentActivity(this.session).id
        this.record('activity_submitted', { activityId })
        await this.flush()
        this.cache.pendingCheckpoint = { id: crypto.randomUUID(), revision: this.cache.revision, activityId, snapshot: snapshotForSave(this.session) }
        this.persist()
      }
      const remote = await this.send('/checkpoint', this.cache.pendingCheckpoint)
      this.cache.pendingCheckpoint = null; this.cache.dirty = false
      this.mergeRemote(remote)
    } catch (error) { this.saveError = error.message; this.cache.conflict = error.code === 'revision_conflict'; throw error } finally { this.busy = ''; this.persist(); this.emit() }
  }
  async requestHint(questionId, message) {
    if (this.busy || this.blocked || this.cache.pendingCheckpoint) return
    this.busy = 'hint'; this.hintError = ''
    this.update((session) => ({ ...session, activeQuestionId: questionId }))
    try {
      this.record('hint_requested', { questionId })
      await this.flush()
      const result = await this.send('/hints', { id: crypto.randomUUID(), questionId, activityId: currentActivity(this.session).id, message: message || 'Give me one small hint about this question.' })
      this.update((session) => ({ ...session, hintUsage: result.hintUsage, chatHistory: result.conversation }))
      this.record('hint_received', { questionId, remaining: result.remaining })
    } catch (error) {
      this.hintError = error.message
      this.record('hint_failed', { questionId, reason: error.code })
      try {
        const remote = await this.api('/session', { token: this.token })
        this.update((session) => ({ ...session, hintUsage: remote.hintUsage, chatHistory: remote.conversation }))
      } catch { /* Keep the draft and retry when connected. */ }
    } finally { this.busy = ''; this.emit() }
  }
  start() {
    this.running = true
    const sync = () => { if (!this.busy && !this.blocked && !this.cache.pendingCheckpoint && Date.now() >= this.retryAt) this.flush().catch(() => {}) }
    const interval = setInterval(sync, 1000)
    window.addEventListener('online', sync)
    if (this.cache.pendingCheckpoint) this.checkpoint().catch(() => {})
    else sync()
    return () => { this.stop(); clearInterval(interval); window.removeEventListener('online', sync) }
  }
  stop() { this.running = false }
}
