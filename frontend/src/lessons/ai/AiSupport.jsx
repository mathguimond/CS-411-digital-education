import AiTutor from './AiTutor.jsx'
import { learnerContext } from './hintContext.js'

export default function AiSupport({ step, activity, session, setSession, record, onBusyChange }) {
  return <AiTutor step={step} activity={activity} record={record}
    learnerContext={learnerContext(session, activity)} conversation={session.chatHistory}
    unlocked={session.hintUnlockedActivities.includes(activity.id)} onBusyChange={onBusyChange}
    onUnlock={() => setSession((value) => ({ ...value, hintUnlockedActivities: [...new Set([...value.hintUnlockedActivities, activity.id])] }))}
    onConversationChange={(messages) => setSession((value) => ({ ...value, chatHistory: messages }))} />
}
