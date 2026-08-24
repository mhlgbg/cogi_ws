export default function LockedRecommendation() {
  return (
    <section className='assessment-locked-recommendation' aria-labelledby='assessment-locked-recommendation-title'>
      <div className='assessment-locked-recommendation__icon' aria-hidden='true'>LOCK</div>
      <div>
        <h2 id='assessment-locked-recommendation-title' className='assessment-form-section-title mb-2'>Lộ trình học đề xuất</h2>
        <p className='assessment-section-lead mb-0'>Lớp phù hợp, lộ trình và học phí sẽ được mở sau khi giáo viên xác nhận phần Speaking.</p>
      </div>
    </section>
  )
}
