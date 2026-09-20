import { useEffect, useState } from 'react'
import { CButton, CModal, CModalBody, CModalHeader, CModalTitle } from '@coreui/react'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

function clampZoom(value) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value || 1)))
}

export default function ZoomableAssessmentImage({ src, alt = '', title = '' }) {
  const [visible, setVisible] = useState(false)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    if (!visible) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') setVisible(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visible])

  function handleOpen() {
    setZoom(1)
    setVisible(true)
  }

  function handleClose() {
    setVisible(false)
  }

  function handleZoomIn() {
    setZoom((prev) => clampZoom(prev + ZOOM_STEP))
  }

  function handleZoomOut() {
    setZoom((prev) => clampZoom(prev - ZOOM_STEP))
  }

  function handleResetZoom() {
    setZoom(1)
  }

  return (
    <>
      <div className='assessment-zoomable-image'>
        <button type='button' className='assessment-zoomable-image__button' onClick={handleOpen} aria-label='Phóng to ảnh stimulus'>
          <img className='assessment-zoomable-image__preview' src={src} alt={alt} />
        </button>
        <div className='assessment-zoomable-image__toolbar'>
          <CButton color='light' size='sm' className='assessment-zoomable-image__action' onClick={handleOpen}>Phóng to</CButton>
        </div>
      </div>

      <CModal visible={visible} size='xl' alignment='center' scrollable onClose={handleClose} backdrop='static' className='assessment-image-modal'>
        <CModalHeader>
          <CModalTitle>{title || alt || 'Xem ảnh'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className='assessment-image-modal__controls'>
            <CButton color='secondary' variant='outline' size='sm' onClick={handleZoomOut} disabled={zoom <= MIN_ZOOM}>-</CButton>
            <CButton color='secondary' variant='outline' size='sm' onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM}>+</CButton>
            <CButton color='secondary' variant='outline' size='sm' onClick={handleResetZoom}>Fit</CButton>
            <span className='assessment-image-modal__zoom-label'>{`${Math.round(zoom * 100)}%`}</span>
          </div>
          <div className='assessment-image-modal__viewport'>
            <img
              className='assessment-image-modal__image'
              src={src}
              alt={alt}
              style={{ transform: `scale(${zoom})` }}
            />
          </div>
        </CModalBody>
      </CModal>
    </>
  )
}