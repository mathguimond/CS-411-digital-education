import RecursionLesson from '../shared/RecursionLesson.jsx'
import FixedSupport from './FixedSupport.jsx'
import { support } from './content.js'

export default function ControlLesson() {
  return <RecursionLesson condition="control" Support={FixedSupport} supportVersion={support.version} />
}
