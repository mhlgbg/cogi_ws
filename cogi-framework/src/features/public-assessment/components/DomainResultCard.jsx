function getConfidenceLabel(confidence) {
  const normalized = String(confidence || '').trim().toLowerCase()
  if (normalized === 'supporting') return 'Bằng chứng bổ trợ'
  if (normalized === 'preliminary') return 'Đánh giá sơ bộ'
  return 'Ước lượng hiện tại'
}

export default function DomainResultCard({ domain }) {
  if (!domain) return null

  return (
    <article className='assessment-domain-result-card'>
      <div className='assessment-domain-result-card__header'>
        <h3 className='assessment-domain-result-card__title'>{domain.label || 'Domain'}</h3>
        <span className='assessment-domain-result-card__level'>{domain.level || '—'}</span>
      </div>
      <div className='assessment-domain-result-card__score'>{domain.rawScoreLabel || 'Chưa có điểm thô'}</div>
      <div className='assessment-domain-result-card__status'>{getConfidenceLabel(domain.confidence)}</div>
      {domain.shortStatus ? <p className='assessment-domain-result-card__copy'>{domain.shortStatus}</p> : null}
    </article>
  )
}
