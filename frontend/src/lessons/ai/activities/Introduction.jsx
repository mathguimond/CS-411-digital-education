import NestingDolls from '../visualizations/NestingDolls.jsx'
import AnswerField from './AnswerField.jsx'

export default function Introduction({ answers, onChange, record }) {
  return <>
    <p className="activity-lead">A recursive solution asks: <em>can I solve a smaller version of this same problem, then use its result?</em> Start by exploring this idea with nesting dolls.</p>
    <NestingDolls record={record} />
    <div className="concept-cards"><div><span className="eyebrow">01 · Stop</span><h3>The base case</h3><p>A small input you can handle directly, without another recursive call. The solid doll has nothing smaller inside.</p></div><div><span className="eyebrow">02 · Reduce</span><h3>The recursive case</h3><p>Work on a smaller instance of the same problem. The input must move toward a base case.</p></div><div><span className="eyebrow">03 · Return</span><h3>The waiting calls</h3><p>Each call keeps its own local state on the stack. As smaller calls return, waiting calls resume and return their results.</p></div></div>
    <div className="activity-note"><strong>Try this with your tutor.</strong><p>Ask it to introduce recursion using the dolls. It will ask short check-in questions and adapt to your replies.</p></div>
    <AnswerField id="doll-explanation" label="In your own words: what is the base case, and what makes the process stop?" value={answers['doll-explanation']} onChange={onChange} />
  </>
}
