export default function AnswerField({ id, label, value, onChange, placeholder = 'Explain your reasoning…', rows = 3, disabled = false }) {
  return <div className="answer-field"><label htmlFor={id}>{label}</label><textarea id={id} rows={rows} value={value || ''} onChange={(event) => onChange(id, event.target.value)} placeholder={placeholder} disabled={disabled} maxLength={4000} /></div>
}
