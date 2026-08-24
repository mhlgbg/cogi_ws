import { CBadge } from '@coreui/react'
import StimulusPreview from './StimulusPreview'
import { getFileAssetUrl, getQuestionTypeLabel, getStatusBadgeColor } from '../utils/questionBankUi'

export default function QuestionPreview({ question }) {
  if (!question) {
    return <div className='small text-body-secondary'>Chua co du lieu xem truoc.</div>
  }

  return (
    <div className='border rounded-3 p-3 bg-body-tertiary'>
      <div className='d-flex justify-content-between align-items-start gap-2 flex-wrap mb-3'>
        <div>
          <div className='fw-semibold'>{question.title || question.code || 'Question preview'}</div>
          <div className='small text-body-secondary'>{question.code || '-'}</div>
        </div>
        <CBadge color={getStatusBadgeColor(question.questionStatus)}>{question.questionStatus || '-'}</CBadge>
      </div>

      {question.stimulus ? <div className='mb-3'><StimulusPreview stimulus={question.stimulus} compact /></div> : null}

      <div className='mb-3'>
        <div className='small text-body-secondary mb-1'>{getQuestionTypeLabel(question.type)}</div>
        <div dangerouslySetInnerHTML={{ __html: question.questionText || '' }} />
      </div>

      {Array.isArray(question.options) && question.options.length > 0 ? (
        <div className='d-grid gap-2'>
          {question.options.map((option, index) => {
            const imageUrl = getFileAssetUrl(option.imageAsset)
            const isCorrect = option.isCorrect === true
            return (
              <div key={option.clientKey || option.documentId || option.id || index} className={`border rounded-3 p-3${isCorrect ? ' border-success bg-success-subtle' : ' bg-white'}`}>
                <div className='d-flex gap-3 align-items-start flex-wrap'>
                  <div className='fw-semibold' style={{ minWidth: 32 }}>{option.label || String.fromCharCode(65 + index)}</div>
                  <div className='flex-grow-1'>
                    {option.content ? <div className='mb-2' dangerouslySetInnerHTML={{ __html: option.content }} /> : null}
                    {imageUrl ? <img src={imageUrl} alt={option.label || `option-${index + 1}`} style={{ maxWidth: 180, maxHeight: 140, objectFit: 'contain', borderRadius: 10 }} /> : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className='small text-body-secondary'>Loai cau hoi nay khong hien thi option preview.</div>
      )}
    </div>
  )
}
