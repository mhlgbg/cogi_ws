export default function AssessmentStrengths({ items = [] }) {
  return (
    <section className='assessment-result-list-section' aria-labelledby='assessment-strengths-title'>
      <h2 id='assessment-strengths-title' className='assessment-form-section-title'>Điểm mạnh hiện tại</h2>
      <div className='assessment-result-bullet-list'>
        {items.map((item) => (
          <div key={item} className='assessment-result-bullet-card'>
            <span className='assessment-result-bullet-card__icon' aria-hidden='true'>✓</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
