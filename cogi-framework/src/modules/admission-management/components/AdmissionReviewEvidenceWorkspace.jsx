import { memo, useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CNav,
  CNavItem,
  CNavLink,
} from '@coreui/react'
import { createObjectUrlFromUrl, openUrlInNewTab, resolveMediaUrl } from '../../../utils/mediaUrl'

const ImageEvidenceViewer = memo(function ImageEvidenceViewer({ images }) {
  const safeImages = Array.isArray(images) ? images : []
  const [activeIndex, setActiveIndex] = useState(0)
  const activeImage = safeImages[activeIndex] || null

  if (safeImages.length === 0) {
    return <CAlert color='light' className='mb-0'>Không có hình ảnh minh chứng.</CAlert>
  }

  function showPrev() {
    setActiveIndex((current) => (current <= 0 ? safeImages.length - 1 : current - 1))
  }

  function showNext() {
    setActiveIndex((current) => (current >= safeImages.length - 1 ? 0 : current + 1))
  }

  return (
    <CCard className='border-0 shadow-sm'>
      <CCardHeader className='bg-white border-0 d-flex justify-content-between align-items-center gap-2 flex-wrap'>
        <div>
          <div className='fw-semibold'>Thư viện hình ảnh</div>
          <div className='small text-body-secondary'>{safeImages.length} tệp</div>
        </div>
        <div className='d-flex gap-2'>
          <CButton size='sm' color='secondary' variant='outline' onClick={showPrev}>Trước</CButton>
          <CButton size='sm' color='secondary' variant='outline' onClick={showNext}>Sau</CButton>
          {activeImage?.url ? (
            <CButton size='sm' color='primary' variant='outline' onClick={() => window.open(activeImage.url, '_blank', 'noopener,noreferrer')}>
              Mở ảnh trong tab mới
            </CButton>
          ) : null}
        </div>
      </CCardHeader>
      <CCardBody>
        {activeImage?.url ? (
          <img
            src={activeImage.url}
            alt={activeImage.label || activeImage.fileName || 'Image evidence'}
            className='img-fluid rounded border'
            loading='lazy'
            style={{ width: '100%', maxHeight: 640, objectFit: 'contain', background: '#f8f9fa' }}
          />
        ) : (
          <CAlert color='warning' className='mb-0'>Không mở được liên kết hình ảnh.</CAlert>
        )}
        <div className='mt-3'>
          <div className='fw-semibold'>{activeImage?.label || activeImage?.fileName || '-'}</div>
          <div className='small text-body-secondary'>{activeImage?.fieldLabel || '-'}</div>
        </div>
      </CCardBody>
    </CCard>
  )
})

const PdfEvidenceTabs = memo(function PdfEvidenceTabs({ pdfs }) {
  const safePdfs = Array.isArray(pdfs) ? pdfs : []
  const [activeIndex, setActiveIndex] = useState(0)
  const [activePdfUrl, setActivePdfUrl] = useState('')
  const activePdf = safePdfs[activeIndex] || null

  useEffect(() => {
    let revokedUrl = ''
    let cancelled = false

    async function preparePdfUrl() {
      const nextUrl = String(activePdf?.url || '').trim()
      if (!nextUrl) {
        setActivePdfUrl('')
        return
      }

      try {
        const objectUrl = await createObjectUrlFromUrl(nextUrl)
        if (cancelled) {
          if (objectUrl) {
            window.URL.revokeObjectURL(objectUrl)
          }
          return
        }

        revokedUrl = objectUrl
        setActivePdfUrl(objectUrl)
      } catch {
        if (!cancelled) {
          setActivePdfUrl(resolveMediaUrl(nextUrl))
        }
      }
    }

    preparePdfUrl()

    return () => {
      cancelled = true
      if (revokedUrl) {
        window.URL.revokeObjectURL(revokedUrl)
      }
    }
  }, [activePdf?.url])

  if (safePdfs.length === 0) {
    return <CAlert color='light' className='mb-0'>Không có tệp PDF minh chứng.</CAlert>
  }

  return (
    <CCard className='border-0 shadow-sm'>
      <CCardHeader className='bg-white border-0'>
        <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap mb-3'>
          <div>
            <div className='fw-semibold'>Tài liệu PDF</div>
            <div className='small text-body-secondary'>{safePdfs.length} tệp</div>
          </div>
          {activePdf?.url ? (
            <CButton size='sm' color='primary' variant='outline' onClick={() => openUrlInNewTab(activePdf.url)}>
              Mở PDF trong tab mới
            </CButton>
          ) : null}
        </div>
        <CNav variant='tabs' role='tablist'>
          {safePdfs.map((pdf, index) => (
            <CNavItem key={`${pdf.fileName || 'pdf'}-${index}`}>
              <CNavLink
                active={index === activeIndex}
                onClick={() => setActiveIndex(index)}
                style={{ cursor: 'pointer' }}
              >
                {pdf.label || pdf.fileName || `PDF ${index + 1}`}
              </CNavLink>
            </CNavItem>
          ))}
        </CNav>
      </CCardHeader>
      <CCardBody>
        <div className='mb-3'>
          <div className='fw-semibold'>{activePdf?.fileName || '-'}</div>
          <div className='small text-body-secondary'>{activePdf?.fieldLabel || '-'}</div>
        </div>
        {activePdfUrl ? (
          <iframe
            key={activePdfUrl}
            src={activePdfUrl}
            title={activePdf.fileName || 'PDF evidence'}
            style={{ width: '100%', minHeight: 720, border: '1px solid #dee2e6', borderRadius: 8 }}
          />
        ) : (
          <CAlert color='warning' className='mb-0'>Không mở được liên kết PDF.</CAlert>
        )}
      </CCardBody>
    </CCard>
  )
})

const EvidenceWorkspace = memo(function EvidenceWorkspace({ evidences }) {
  const images = useMemo(() => (Array.isArray(evidences?.images) ? evidences.images : []), [evidences?.images])
  const pdfs = useMemo(() => (Array.isArray(evidences?.pdfs) ? evidences.pdfs : []), [evidences?.pdfs])
  const hasEvidence = images.length > 0 || pdfs.length > 0

  return (
    <div className='d-flex flex-column gap-4'>
      {!hasEvidence ? <CAlert color='light' className='mb-0'>Hồ sơ này chưa có minh chứng đính kèm.</CAlert> : null}
      <ImageEvidenceViewer images={images} />
      <PdfEvidenceTabs pdfs={pdfs} />
    </div>
  )
})

export default EvidenceWorkspace
