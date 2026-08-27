import { CAlert, CButton, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle } from '@coreui/react'

export default function SubmitAssessmentModal({ visible, mode = 'confirm', answeredCount, totalQuestions, missingRequired = [], submitting, submitError, onClose, onSubmit, onContinue, onJumpToMissing }) {
  const incomplete = mode === 'incomplete'
  return (
    <CModal visible={visible} onClose={onClose} backdrop='static'>
      <CModalHeader>
        <CModalTitle>{incomplete ? 'Còn câu chưa hoàn thành' : 'Nộp bài'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className='assessment-runner-submit-summary'>
          <div className='fw-semibold mb-2'>{`Bạn đã trả lời ${answeredCount}/${totalQuestions} câu.`}</div>
          {incomplete ? <div className='text-body-secondary mb-3'>{`Bạn còn ${missingRequired.length} câu chưa hoàn thành.`}</div> : missingRequired.length > 0 ? <div className='text-body-secondary mb-3'>{`Còn ${missingRequired.length} câu bắt buộc chưa hoàn thành.`}</div> : <div className='text-body-secondary mb-3'>Bạn có thể nộp bài ngay bây giờ.</div>}
          {missingRequired.length > 0 ? (
            <div className='d-grid gap-2'>
              {missingRequired.map((item) => (
                <button key={`${item.assessmentQuestionId}-${item.questionCode}`} type='button' className='assessment-runner-option-card' onClick={() => onJumpToMissing?.(item)}>
                  <span className='assessment-runner-option-marker'>{item.questionNumber || item.order}</span>
                  <span>{item.sectionTitle ? `${item.sectionTitle}: Câu ${item.questionNumber || item.order}` : `Câu ${item.questionNumber || item.order}`}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {submitError ? <CAlert color='danger' className='mt-3 mb-0'>{submitError}</CAlert> : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={submitting}>{incomplete ? 'Đóng' : 'Quay lại bài'}</CButton>
        {incomplete ? <CButton color='primary' onClick={onContinue}>Làm tiếp</CButton> : <CButton color='primary' onClick={onSubmit} disabled={submitting}>{submitting ? 'Đang nộp...' : 'Nộp bài'}</CButton>}
      </CModalFooter>
    </CModal>
  )
}