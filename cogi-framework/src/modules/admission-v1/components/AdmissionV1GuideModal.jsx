import { CModal, CModalBody, CModalHeader, CModalTitle } from '@coreui/react'

function hasHtmlContent(value) {
  return /<[^>]+>/.test(String(value || ''))
}

function renderFallback(fallbackContent) {
  if (!fallbackContent) {
    return <div className='text-body-secondary'>Chưa có hướng dẫn cho kỳ tuyển sinh này.</div>
  }

  if (typeof fallbackContent === 'string') {
    return <div className='text-body-secondary' style={{ whiteSpace: 'pre-line' }}>{fallbackContent}</div>
  }

  return fallbackContent
}

export function renderAdmissionV1Guidance(campaign, fallbackContent) {
  const description = String(campaign?.description || '').trim()
  if (description) {
    if (hasHtmlContent(description)) {
      return <div dangerouslySetInnerHTML={{ __html: description }} />
    }

    return <div className='text-body-secondary' style={{ whiteSpace: 'pre-line' }}>{description}</div>
  }

  return renderFallback(fallbackContent)
}

export default function AdmissionV1GuideModal({
  visible,
  onClose,
  campaign,
  title = 'Hướng dẫn tuyển sinh',
  fallbackContent = null,
}) {
  return (
    <CModal visible={visible} onClose={onClose} alignment='center' size='lg'>
      <CModalHeader>
        <CModalTitle>{title}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className='mb-3'>
          <div className='fw-semibold'>{campaign?.name || 'Kỳ tuyển sinh'}</div>
          <div className='text-body-secondary'>Mã kỳ: {campaign?.code || '-'}</div>
        </div>
        {renderAdmissionV1Guidance(campaign, fallbackContent)}
      </CModalBody>
    </CModal>
  )
}
