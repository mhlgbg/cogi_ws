export default function AssessmentPriorities({ items = [] }) {
  return (
    <section className='assessment-result-list-section' aria-labelledby='assessment-priorities-title'>
      <h2 id='assessment-priorities-title' className='assessment-form-section-title'>Ưu tiên cải thiện</h2>
      <div className='assessment-result-bullet-list'>
        {items.map((item) => (
          <div key={item} className='assessment-result-bullet-card assessment-result-bullet-card--priority'>
            <span className='assessment-result-bullet-card__icon' aria-hidden='true'>→</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
