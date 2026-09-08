import { CAlert, CCard, CCardBody, CCardHeader, CCol, CFormLabel, CFormSelect, CRow } from '@coreui/react'

export default function StudentPortalContextCard({
  title = 'Học tập của tôi',
  description = '',
  context = null,
  selectedLearnerId = '',
  onSelectLearner,
  error = '',
}) {
  const learners = Array.isArray(context?.learners) ? context.learners : []
  const learnerState = context?.learnerState || 'missing'

  return (
    <CCard className='mb-4'>
      <CCardHeader><strong>{title}</strong></CCardHeader>
      <CCardBody>
        {description ? <div className='text-body-secondary mb-3'>{description}</div> : null}
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        {learnerState === 'missing' ? <CAlert color='warning'>Bạn chưa có hồ sơ học tập được liên kết trong không gian số này.</CAlert> : null}
        {learnerState === 'selection_required' ? <CAlert color='info'>Vui lòng chọn hồ sơ học tập đang sử dụng để xem đúng dữ liệu lớp và buổi học.</CAlert> : null}
        <CRow className='g-3'>
          <CCol lg={7}>
            <div className='fw-semibold mb-1'>Hồ sơ đang xem: {context?.learnerContext?.fullName || 'Chưa chọn'}</div>
            <div className='small text-body-secondary'>Mã learner: {context?.learnerContext?.code || '-'}</div>
          </CCol>
          <CCol lg={5}>
            <CFormLabel>Hồ sơ học tập đang sử dụng</CFormLabel>
            <CFormSelect value={selectedLearnerId || ''} onChange={(event) => onSelectLearner?.(event.target.value)}>
              <option value=''>{learners.length > 1 ? 'Chọn hồ sơ học tập' : 'Chưa có hồ sơ'}</option>
              {learners.map((item) => (
                <option key={item.id} value={item.id}>{item.fullName}{item.code ? ` (${item.code})` : ''}</option>
              ))}
            </CFormSelect>
          </CCol>
        </CRow>
      </CCardBody>
    </CCard>
  )
}