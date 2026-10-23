import { useMemo, useState } from 'react'
import {
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react'
import { buildProtectedFileUrl, resolveMediaUrl } from '../utils/mediaUrl'

function normalizePositiveId(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function formatBytes(bytes) {
  const numericBytes = Number(bytes || 0)
  if (!Number.isFinite(numericBytes) || numericBytes <= 0) return ''

  const units = ['B', 'KB', 'MB', 'GB']
  let size = numericBytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  const fixedSize = size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)
  return `${fixedSize} ${units[unitIndex]}`
}

function normalizeFileAsset(file) {
  if (!file || typeof file !== 'object') return null

  const fileAssetId = normalizePositiveId(file.fileAssetId || file.id)
  const rawUrl = String(file.resolvedUrl || file.url || file.relativePath || '').trim()
  const provider = String(file.provider || file.storageProvider || 'local').trim().toLowerCase() || 'local'
  const safeUrl = buildProtectedFileUrl({
    fileAssetId,
    storageProvider: provider,
    url: rawUrl || file.relativePath || '',
  }) || resolveMediaUrl(rawUrl || file.relativePath || '')

  const fileName = String(file.name || file.originalName || file.fileName || `File ${fileAssetId || 'unknown'}`).trim() || 'File'
  const mimeType = String(file.mime || file.mimeType || '').trim().toLowerCase()

  return {
    id: fileAssetId || file.id || file.documentId || fileName,
    fileAssetId,
    name: fileName,
    mimeType,
    provider,
    size: Number(file.size || 0) || 0,
    url: safeUrl,
    resolvedUrl: safeUrl,
    relativePath: String(file.relativePath || '').trim(),
    isPublic: file.isPublic !== false,
  }
}

function detectFileKind(file) {
  const mimeType = String(file?.mimeType || '').toLowerCase()
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'application/pdf' || mimeType.endsWith('/pdf')) return 'pdf'
  return 'file'
}

function getActionLabel(kind) {
  if (kind === 'image') return 'Xem ảnh'
  if (kind === 'pdf') return 'Xem PDF'
  return 'Mở file'
}

export default function FileAssetPreview({
  files,
  mode = 'readonly',
  onRemove,
  emptyText = 'Chưa có file.',
  className = '',
  compact = false,
}) {
  const normalizedFiles = useMemo(() => {
    const source = Array.isArray(files) ? files : files ? [files] : []
    return source.map(normalizeFileAsset).filter(Boolean)
  }, [files])

  const [viewerIndex, setViewerIndex] = useState(null)
  const imageFiles = normalizedFiles.filter((file) => detectFileKind(file) === 'image')

  const openInNewTab = (url) => {
    if (!url || typeof window === 'undefined') return
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const openViewer = (fileIndex) => {
    if (imageFiles.length === 0) return
    const candidateIndex = imageFiles.findIndex((file) => file.id === normalizedFiles[fileIndex]?.id)
    setViewerIndex(candidateIndex >= 0 ? candidateIndex : 0)
  }

  const currentViewerFile = viewerIndex !== null ? imageFiles[viewerIndex] : null

  if (normalizedFiles.length === 0) {
    return <div className={`text-body-secondary ${className}`}>{emptyText}</div>
  }

  return (
    <>
      <div className={`d-flex flex-column gap-2 ${className}`}>
        {normalizedFiles.map((file, index) => {
          const kind = detectFileKind(file)
          const isImage = kind === 'image'
          const isPdf = kind === 'pdf'
          const canRemove = mode === 'editable' && typeof onRemove === 'function'

          return (
            <div key={`${file.id || index}-${file.name}`} className='border rounded p-2 bg-light-subtle'>
              <div className='d-flex gap-3 align-items-start'>
                <div className='flex-shrink-0'>
                  {isImage ? (
                    <img
                      src={file.url}
                      alt={file.name}
                      onClick={() => openViewer(index)}
                      style={{
                        width: compact ? 56 : 72,
                        height: compact ? 56 : 72,
                        objectFit: 'cover',
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: '1px solid rgba(0,0,0,0.08)',
                        background: '#fff',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: compact ? 56 : 72,
                        height: compact ? 56 : 72,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#f3f4f6',
                        border: '1px solid rgba(0,0,0,0.08)',
                        fontSize: compact ? 18 : 22,
                        fontWeight: 700,
                        color: '#4b5563',
                      }}
                      title={file.name}
                    >
                      {isPdf ? 'PDF' : 'FILE'}
                    </div>
                  )}
                </div>

                <div className='flex-grow-1 min-w-0'>
                  <div className='fw-semibold text-truncate'>{file.name}</div>
                  <div className='small text-body-secondary d-flex flex-wrap align-items-center gap-2'>
                    {file.mimeType ? <span>{file.mimeType}</span> : null}
                    {file.size ? <span>• {formatBytes(file.size)}</span> : null}
                    {file.provider && file.provider !== 'local' ? <span>• {file.provider}</span> : null}
                  </div>
                  <div className='mt-2 d-flex flex-wrap gap-2'>
                    {(isImage || isPdf || !isImage) ? (
                      <CButton
                        type='button'
                        size='sm'
                        color='primary'
                        variant='outline'
                        onClick={() => openInNewTab(file.url)}
                      >
                        {getActionLabel(kind)}
                      </CButton>
                    ) : null}
                    {file.url ? (
                      <CButton
                        type='button'
                        size='sm'
                        color='secondary'
                        variant='outline'
                        onClick={() => {
                          const anchor = document.createElement('a')
                          anchor.href = file.url
                          anchor.download = file.name
                          anchor.target = '_blank'
                          anchor.rel = 'noopener noreferrer'
                          document.body.appendChild(anchor)
                          anchor.click()
                          anchor.remove()
                        }}
                      >
                        Tải
                      </CButton>
                    ) : null}
                    {canRemove ? (
                      <CButton
                        type='button'
                        size='sm'
                        color='danger'
                        variant='outline'
                        onClick={() => onRemove(file.id || file.fileAssetId || index)}
                      >
                        Gỡ
                      </CButton>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {currentViewerFile ? (
        <CModal visible={Boolean(currentViewerFile)} alignment='center' size='xl' backdrop={true} onClose={() => setViewerIndex(null)}>
          <CModalHeader>
            <CModalTitle>{currentViewerFile.name}</CModalTitle>
          </CModalHeader>
          <CModalBody className='text-center p-3'>
            <img
              src={currentViewerFile.url}
              alt={currentViewerFile.name}
              style={{ maxHeight: '75vh', maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }}
            />
          </CModalBody>
          <CModalFooter>
            <CButton type='button' color='secondary' variant='outline' onClick={() => setViewerIndex((value) => (value === 0 ? 0 : Math.max(0, value - 1)))} disabled={viewerIndex === 0}>
              Trước
            </CButton>
            <CButton type='button' color='primary' onClick={() => openInNewTab(currentViewerFile.url)}>
              Mở lớn hơn
            </CButton>
            <CButton type='button' color='secondary' variant='outline' onClick={() => setViewerIndex((value) => (value === imageFiles.length - 1 ? value : Math.min(imageFiles.length - 1, value + 1)))} disabled={viewerIndex === imageFiles.length - 1}>
              Tiếp
            </CButton>
          </CModalFooter>
        </CModal>
      ) : null}
    </>
  )
}
