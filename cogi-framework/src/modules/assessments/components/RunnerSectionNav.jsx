import { CButton, CProgress, CProgressBar } from '@coreui/react'

export default function RunnerSectionNav({ sections = [], activeSectionCode = '', answeredMap = {}, currentAssessmentQuestionId = '', onSelectQuestion }) {
  return (
    <div className='assessment-runner-stimulus'>
      <div className='d-flex justify-content-between align-items-center gap-2 mb-3 flex-wrap'>
        <strong>Điều hướng bài làm</strong>
        <span className='small text-body-secondary'>Nhấn vào số câu để chuyển nhanh</span>
      </div>
      <div className='assessment-runner-section-list'>
        {sections.map((section) => {
          const rows = Array.isArray(section?.questions) ? section.questions : []
          const answeredCount = rows.filter((item) => answeredMap[String(item?.assessmentQuestionId || item?.assessmentQuestionDocumentId || '')] === true).length
          const percent = rows.length > 0 ? Math.round((answeredCount / rows.length) * 100) : 0
          return (
            <div key={section?.code || section?.id} className={`assessment-runner-section-card${section?.code === activeSectionCode ? ' is-active' : ''}`}>
              <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap mb-2'>
                <div>
                  <div className='fw-semibold'>{section?.title || section?.code || 'Phần'}</div>
                  <div className='small text-body-secondary'>{`${answeredCount}/${rows.length} câu đã trả lời`}</div>
                </div>
                <div className='small text-body-secondary'>{section?.code || ''}</div>
              </div>
              <CProgress className='mb-3'>
                <CProgressBar value={percent}>{`${percent}%`}</CProgressBar>
              </CProgress>
              <div className='assessment-runner-question-grid'>
                {rows.map((item, index) => {
                  const questionRef = String(item?.assessmentQuestionId || item?.assessmentQuestionDocumentId || '')
                  const answered = answeredMap[questionRef] === true
                  const current = questionRef === String(currentAssessmentQuestionId || '')
                  return (
                    <CButton
                      key={questionRef || `${section?.code}-${index}`}
                      type='button'
                      color='light'
                      className={`assessment-runner-question-chip${current ? ' is-current' : ''}${answered ? ' is-answered' : ''}`}
                      onClick={() => onSelectQuestion?.(section, item)}
                    >
                      {index + 1}
                    </CButton>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}