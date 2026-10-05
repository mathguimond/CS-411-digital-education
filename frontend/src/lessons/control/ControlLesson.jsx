import LessonWorkspace from '../../shared/LessonWorkspace.jsx'
import FixedSupport from './FixedSupport.jsx'
import { lesson } from './content.js'

export default function ControlLesson() {
  return <LessonWorkspace condition="control" lesson={lesson} Support={FixedSupport} />
}
