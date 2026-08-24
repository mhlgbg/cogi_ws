export default function AssessmentResultHero({
  status = 'PROVISIONAL',
  title = 'Kết quả sơ bộ',
  studentName = '',
  grade = '',
  assessmentTitle = '',
  provisionalLevel = '',
}) {
  return (
    <section className='assessment-result-hero' aria-labelledby='assessment-result-title'>
      <div className='assessment-result-hero__content'>
        <div className='assessment-badge assessment-result-status-badge'>
          <span>{status}</span>
          <span className='assessment-result-status-badge__divider' aria-hidden='true'>•</span>
          <span>Kết quả tạm thời</span>
        </div>
        <h1 id='assessment-result-title' className='assessment-section-title assessment-result-hero__title'>{title}</h1>
        <p className='assessment-section-lead assessment-result-hero__lead'>Kết quả này chưa phải kết quả cuối cùng. Giáo viên sẽ xác nhận sau phần Speaking trước khi tư vấn lớp học và lộ trình.</p>

        {studentName || grade || assessmentTitle ? (
          <div className='assessment-result-student-summary' aria-label='Thông tin học sinh'>
            {studentName ? <div className='assessment-result-student-summary__name'>{studentName}</div> : null}
            <div className='assessment-result-student-summary__meta'>
              {[grade, assessmentTitle].filter(Boolean).join(' · ')}
            </div>
          </div>
        ) : null}
      </div>

      <div className='assessment-result-level-card' aria-label='Mức sơ bộ hiện tại'>
        <div className='assessment-result-level-card__eyebrow'>Mức hiện tại sơ bộ</div>
        <div className='assessment-result-level-card__value'>{provisionalLevel || '—'}</div>
        <p className='assessment-result-level-card__copy'>Đây là mức đánh giá tạm thời dựa trên các phần online. Kết quả cuối cùng sẽ được giáo viên xác nhận sau phần Speaking.</p>
      </div>
    </section>
  )
}
