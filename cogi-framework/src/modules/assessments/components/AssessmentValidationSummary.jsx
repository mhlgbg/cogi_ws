import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CSpinner } from '@coreui/react'
import { getStatusBadgeColor } from '../../learning-management/utils/questionBankUi'

function getValidationBadgeColor(level) {
  if (level === 'error') return getStatusBadgeColor('failed')
  if (level === 'warning') return getStatusBadgeColor('pending')
  if (level === 'info') return 'secondary'
  return getStatusBadgeColor('active')
}

export default function AssessmentValidationSummary({ loading, data, error, onValidate }) {
  return (
    <CCard className='mb-4 ai-card'>
      <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
        <strong>Kiểm tra đề</strong>
        <CButton color='secondary' variant='outline' onClick={onValidate} disabled={loading}>{loading ? 'Đang kiểm tra...' : 'Kiểm tra đề'}</CButton>
      </CCardHeader>
      <CCardBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        {loading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang kiểm tra cấu trúc đề...</span></div> : null}
        {!loading && !data ? <div className='text-body-secondary'>Chưa có kết quả kiểm tra.</div> : null}
        {!loading && data ? (
          <>
            <div className='d-flex gap-3 flex-wrap mb-3 small text-body-secondary'>
              <span>{`${data.summary?.totalSections || 0} phần`}</span>
              <span>{`${data.summary?.totalQuestions || 0} câu hỏi`}</span>
              <span>{data.summary?.hasErrors ? 'Có lỗi cần sửa' : 'Không có lỗi chặn publish'}</span>
            </div>
            <div className='d-grid gap-2'>
              {(data.checks || []).map((item) => (
                <div key={item.key} className='d-flex justify-content-between align-items-start gap-3 border rounded-3 p-3'>
                  <div>{item.message}</div>
                  <CBadge color={getValidationBadgeColor(item.level)}>{item.level}</CBadge>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </CCardBody>
    </CCard>
  )
}
