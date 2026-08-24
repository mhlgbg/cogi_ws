import { CBadge, CCard, CCardBody, CCardHeader } from '@coreui/react'
import QuestionPreview from '../../learning-management/components/QuestionPreview'
import StimulusPreview from '../../learning-management/components/StimulusPreview'
import { computeSectionStats, computeVersionStats, formatCandidateRange, formatGradeRange, getResultModeLabel, getRuntimeConfigSummary, getVersionStatusLabel } from './assessmentUi'

export default function AssessmentPreview({ assessment, version, showAdminAnswers = false }) {
  if (!assessment || !version) {
    return <div className='text-body-secondary'>Chưa có phiên bản để xem trước.</div>
  }

  const stats = computeVersionStats(version)

  return (
    <div className='d-grid gap-4'>
      <CCard className='ai-card'>
        <CCardHeader>
          <strong>Xem trước toàn bộ đề</strong>
        </CCardHeader>
        <CCardBody>
          <div className='fs-5 fw-semibold'>{version.title || assessment.name}</div>
          <div className='text-body-secondary mb-3'>{assessment.name}</div>
          <div className='d-flex flex-wrap gap-3 small text-body-secondary mb-3'>
            <span>{formatGradeRange(version)}</span>
            <span>{formatCandidateRange(version)}</span>
            <span>{`${version.durationMinutes || 0} phút`}</span>
            <span>{getResultModeLabel(version.resultMode)}</span>
            <span>{version.requiresSpeaking ? 'Speaking required' : 'Không yêu cầu Speaking'}</span>
            <span>{version.requiresTeacherConfirmation ? 'Cần giáo viên xác nhận' : 'Không cần giáo viên xác nhận'}</span>
            {version.ceilingLevel ? <span>{`CEILING ${version.ceilingLevel}`}</span> : null}
            <CBadge color='secondary'>{getVersionStatusLabel(version.versionStatus)}</CBadge>
          </div>
          {version.instructions ? <div className='border-top pt-3' dangerouslySetInnerHTML={{ __html: version.instructions }} /> : null}
          <div className='small text-body-secondary mt-3'>{`${stats.totalSections} phần · ${stats.totalQuestions} câu hỏi · ${stats.totalPoints} điểm`}</div>
        </CCardBody>
      </CCard>

      {(version.sections || []).map((section, sectionIndex) => {
        const sectionStats = computeSectionStats(section)
        let previousStimulusId = ''
        return (
          <CCard key={section.id || section.documentId || section.code} className='ai-card'>
            <CCardHeader>
              <div className='fw-semibold'>{`PHẦN ${sectionIndex + 1} · ${section.title}`}</div>
              <div className='small text-body-secondary'>{`${sectionStats.totalQuestions} câu hỏi · ${sectionStats.totalPoints} điểm`}</div>
            </CCardHeader>
            <CCardBody className='d-grid gap-3'>
              {section.instruction ? <div dangerouslySetInnerHTML={{ __html: section.instruction }} /> : null}
              {(section.assessmentQuestions || []).map((item, index) => {
                const stimulus = item?.question?.stimulus || null
                const stimulusId = stimulus?.documentId || stimulus?.id || ''
                const shouldRenderStimulus = Boolean(stimulusId) && stimulusId !== previousStimulusId
                previousStimulusId = stimulusId || previousStimulusId
                return (
                  <div key={item.id || item.documentId || index} className='border rounded-3 p-3'>
                    <div className='d-flex justify-content-between align-items-start gap-2 mb-2 flex-wrap'>
                      <div className='fw-semibold'>{`${index + 1}. ${item.question?.code || ''}`}</div>
                      <div className='small text-body-secondary'>{`${item.points || 1} điểm · ${item.required ? 'Bắt buộc' : 'Tùy chọn'} · ${getRuntimeConfigSummary(item)}`}</div>
                    </div>
                    {shouldRenderStimulus && stimulus ? <div className='mb-3'><StimulusPreview stimulus={stimulus} compact /></div> : null}
                    <QuestionPreview question={item.question} />
                    {showAdminAnswers && Array.isArray(item.question?.options) && item.question.options.length > 0 ? (
                      <div className='small text-body-secondary mt-2'>
                        Đáp án quản trị: {item.question.options.filter((option) => option.isCorrect === true).map((option) => option.label || option.value).join(', ') || 'Chưa cấu hình'}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </CCardBody>
          </CCard>
        )
      })}
    </div>
  )
}
