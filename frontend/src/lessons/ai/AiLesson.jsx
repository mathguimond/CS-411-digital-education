import LessonWorkspace from '../../shared/LessonWorkspace.jsx'
import AiTutor from './AiTutor.jsx'
import { lesson } from './content.js'

export default function AiLesson() {
  return <LessonWorkspace condition="ai" lesson={lesson} Support={AiTutor} />
}
