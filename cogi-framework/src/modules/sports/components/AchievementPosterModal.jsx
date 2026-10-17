import { useEffect, useMemo, useRef, useState } from 'react'
import { CAlert, CButton, CFormLabel, CFormSelect, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CSpinner } from '@coreui/react'
import { exportAchievementPosterPngBlob } from '../utils/achievementPosterRenderer'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

export default function AchievementPosterModal({
  visible = false,
  title = 'Ảnh thành tích',
  achievement = null,
  profile = null,
  templateOptions = [],
  selectedTemplateId = '',
  onTemplateChange = null,
  readOnlyTemplate = true,
  onClose,
}) {
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const previewUrlRef = useRef('')

  const selectedTemplate = useMemo(() => {
    if (!Array.isArray(templateOptions) || templateOptions.length === 0) return null
    if (!selectedTemplateId) return templateOptions[0] || null
    return templateOptions.find((item) => String(item?.id || '') === String(selectedTemplateId)) || templateOptions[0] || null
  }, [templateOptions, selectedTemplateId])

  useEffect(() => {
    if (!visible) return undefined
    let mounted = true
    let objectUrl = ''
    async function run() {
      if (!achievement || !selectedTemplate) {
        if (mounted) setPreviewUrl('')
        return
      }
      setRendering(true)
      setError('')
      try {
        const blob = await exportAchievementPosterPngBlob({
          template: selectedTemplate,
          achievement,
          profile: profile || achievement?.sportsProfile || null,
        })
        objectUrl = URL.createObjectURL(blob)
        if (!mounted) {
          URL.revokeObjectURL(objectUrl)
          objectUrl = ''
          return
        }
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current)
          return objectUrl
        })
        previewUrlRef.current = objectUrl
        objectUrl = ''
      } catch (renderError) {
        if (!mounted) return
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current)
          return ''
        })
        previewUrlRef.current = ''
        setError(toText(renderError?.message) || 'Không thể render ảnh thành tích.')
      } finally {
        if (mounted) setRendering(false)
      }
    }
    run()
    return () => {
      mounted = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [visible, achievement, selectedTemplate, profile])

  useEffect(() => () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = ''
    }
  }, [])

  async function handleDownloadPng() {
    if (!achievement || !selectedTemplate) return
    setDownloading(true)
    setError('')
    try {
      const blob = await exportAchievementPosterPngBlob({
        template: selectedTemplate,
        achievement,
        profile: profile || achievement?.sportsProfile || null,
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      const fileLabel = toText(achievement?.title) || `achievement-${achievement?.id || 'poster'}`
      anchor.download = `${fileLabel.replace(/[^A-Za-z0-9._-]+/g, '-')}.png`
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setError(toText(downloadError?.message) || 'Không thể tải PNG.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <CModal visible={visible} onClose={onClose} size='xl' scrollable>
      <CModalHeader>
        <CModalTitle>{title}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        {!readOnlyTemplate ? (
          <div className='mb-3'>
            <CFormLabel>Mẫu ảnh</CFormLabel>
            <CFormSelect value={String(selectedTemplateId || selectedTemplate?.id || '')} onChange={(event) => onTemplateChange?.(event.target.value)}>
              {templateOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name || item.code || `Template #${item.id}`}
                </option>
              ))}
            </CFormSelect>
          </div>
        ) : null}

        {!selectedTemplate ? <CAlert color='warning'>Chưa có mẫu ảnh phù hợp cho thành tích này.</CAlert> : null}
        {selectedTemplate ? (
          <div className='border rounded p-2'>
            {rendering ? <div className='d-flex align-items-center gap-2 mb-2'><CSpinner size='sm' />Đang render ảnh...</div> : null}
            {previewUrl ? (
              <img src={previewUrl} alt='Achievement poster preview' style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', background: '#111', borderRadius: 8 }} />
            ) : (
              <div style={{ width: '100%', minHeight: '40vh', background: '#111', borderRadius: 8 }} />
            )}
          </div>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose}>Đóng</CButton>
        <CButton color='primary' onClick={handleDownloadPng} disabled={downloading || !selectedTemplate}>{downloading ? 'Đang tạo...' : 'Tải PNG'}</CButton>
      </CModalFooter>
    </CModal>
  )
}
