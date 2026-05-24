import { useEffect, useState } from 'react'
import {
  CButton,
  CFormCheck,
  CCol,
  CFormInput,
  CFormLabel,
  CModal,
  CModalBody,
  CModalHeader,
  CModalTitle,
  CFormSelect,
  CSpinner,
  CFormTextarea,
  CLink,
} from '@coreui/react'
import TableFieldRenderer from './TableFieldRenderer'
import { getFileValueMetaList } from './schema'
import { createObjectUrlFromUrl, isDataUrl, openUrlInNewTab, resolveMediaUrl } from '../../../utils/mediaUrl'

function padDatePart(value) {
  return String(value).padStart(2, '0')
}

function formatDisplayDate(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`
  }

  const localMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text)
  if (localMatch) {
    return `${padDatePart(localMatch[1])}/${padDatePart(localMatch[2])}/${localMatch[3]}`
  }

  return text
}

function normalizeDateInput(value) {
  const digitsOnly = String(value ?? '').replace(/\D+/g, '').slice(0, 8)
  if (digitsOnly.length <= 2) return digitsOnly
  if (digitsOnly.length <= 4) return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`
  return `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4)}`
}

export default function FieldRenderer({
  field,
  fieldOverride,
  value,
  error,
  submitting,
  isReadOnly,
  fileNamesOnlyOnReadOnly = false,
  onValueChange,
  onFileChange,
  onTableCellChange,
}) {
  const [previewVisible, setPreviewVisible] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [previewTitle, setPreviewTitle] = useState('')
  const [previewType, setPreviewType] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const isTextarea = field.type === 'textarea'
  const isFileField = field.type === 'file' || field.type === 'image'
  const isTableField = field.type === 'table'
  const fileMetaList = getFileValueMetaList(value)
  const inputType = field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'
  const effectiveReadOnly = isReadOnly || fieldOverride?.isReadOnly === true
  const helperText = String(fieldOverride?.helperText || '').trim()

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith('blob:')) {
        window.URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  function handleOpenFile(event, url) {
    if (!isDataUrl(url)) return
    event.preventDefault()
    void openUrlInNewTab(url)
  }

  function closePreviewModal() {
    if (previewUrl.startsWith('blob:')) {
      window.URL.revokeObjectURL(previewUrl)
    }
    setPreviewVisible(false)
    setPreviewLoading(false)
    setPreviewError('')
    setPreviewTitle('')
    setPreviewType('')
    setPreviewUrl('')
  }

  async function handlePreviewFile(fileMeta) {
    const sourceUrl = resolveMediaUrl(fileMeta?.url || fileMeta?.dataUrl || '')
    if (!sourceUrl) return

    if (previewUrl.startsWith('blob:')) {
      window.URL.revokeObjectURL(previewUrl)
    }

    setPreviewVisible(true)
    setPreviewLoading(true)
    setPreviewError('')
    setPreviewTitle(fileMeta?.name || 'Xem tệp')
    setPreviewType(fileMeta?.isPdf ? 'pdf' : fileMeta?.isImage ? 'image' : 'file')

    try {
      if (fileMeta?.isPdf) {
        const objectUrl = await createObjectUrlFromUrl(sourceUrl)
        setPreviewUrl(objectUrl || sourceUrl)
      } else {
        setPreviewUrl(sourceUrl)
      }
    } catch {
      setPreviewUrl(sourceUrl)
      if (fileMeta?.isPdf) {
        setPreviewError('Không nhúng được PDF trong modal. Bạn có thể tải tệp xuống nếu cần.')
      }
    } finally {
      setPreviewLoading(false)
    }
  }

  return (
    <CCol md={isTextarea || isTableField ? 12 : 6} key={field.key}>
      {!isTableField ? (
        <>
          <CFormLabel>
            {field.label}
            {field.required ? ' *' : ''}
          </CFormLabel>
          {field.description ? <div className='text-body-secondary small mb-2'>{field.description}</div> : null}
          {helperText ? <div className='text-body-secondary small mb-2'>{helperText}</div> : null}
        </>
      ) : null}

      {field.type === 'textarea' ? (
        <>
          <CFormTextarea
            rows={4}
            value={String(value ?? '')}
            onChange={(event) => onValueChange(field.key, event.target.value)}
            placeholder={field.placeholder || undefined}
            invalid={Boolean(error)}
            disabled={submitting || effectiveReadOnly}
            readOnly={effectiveReadOnly}
          />
          {error ? <div className='text-danger small mt-1'>{error}</div> : null}
        </>
      ) : null}

      {field.type === 'date' ? (
        <>
          <CFormInput
            type='text'
            inputMode='numeric'
            value={formatDisplayDate(value)}
            onChange={(event) => onValueChange(field.key, normalizeDateInput(event.target.value))}
            placeholder={field.placeholder || 'dd/MM/yyyy'}
            invalid={Boolean(error)}
            disabled={submitting || effectiveReadOnly}
            readOnly={effectiveReadOnly}
          />
          {error ? <div className='text-danger small mt-1'>{error}</div> : null}
        </>
      ) : null}

      {field.type === 'select' ? (
        <>
          <CFormSelect
            value={String(value ?? '')}
            onChange={(event) => onValueChange(field.key, event.target.value)}
            invalid={Boolean(error)}
            disabled={submitting || effectiveReadOnly}
          >
            <option value=''>Chọn {field.label.toLowerCase()}</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </CFormSelect>
          {error ? <div className='text-danger small mt-1'>{error}</div> : null}
        </>
      ) : null}

      {field.type === 'radio' ? (
        <>
          <div className='d-flex flex-column gap-2 mt-1'>
            {field.options.map((option) => (
              <CFormCheck
                key={option.value}
                type='radio'
                name={field.key}
                label={option.label}
                value={option.value}
                checked={String(value ?? '') === String(option.value)}
                onChange={(event) => onValueChange(field.key, event.target.value)}
                disabled={submitting || effectiveReadOnly}
              />
            ))}
          </div>
          {error ? <div className='text-danger small mt-1'>{error}</div> : null}
        </>
      ) : null}

      {isTableField ? (
        <>
          <TableFieldRenderer
            field={field}
            value={value}
            error={error}
            onChangeCell={(rowIndex, columnKey, cellValue) => onTableCellChange(field.key, rowIndex, columnKey, cellValue)}
            disabled={submitting || effectiveReadOnly}
          />
          {error ? <div className='text-danger small mt-1'>{typeof error === 'string' ? error : error?.message}</div> : null}
        </>
      ) : null}

      {isFileField ? (
        effectiveReadOnly ? (
          <div className='border rounded-3 p-3 bg-light'>
            {fileMetaList.length > 0 ? (
              <div className='d-flex flex-column gap-3'>
                {fileMetaList.map((fileMeta, index) => (
                  <div key={`${fileMeta.name}-${index}`} className='border rounded-3 bg-white p-3'>
                    {!fileNamesOnlyOnReadOnly && fileMeta.isImage && (fileMeta.url || fileMeta.dataUrl) ? (
                      <div className='mb-3'>
                        <img
                          src={resolveMediaUrl(fileMeta.url || fileMeta.dataUrl)}
                          alt={fileMeta.name}
                          style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', display: 'block' }}
                        />
                      </div>
                    ) : null}

                    <div className='d-flex flex-column gap-2'>
                      {fileNamesOnlyOnReadOnly ? (
                        <CButton color='link' className='p-0 text-start small' onClick={() => handlePreviewFile(fileMeta)}>
                          {fileMeta.name}
                        </CButton>
                      ) : (
                        <div className='small text-body-secondary'>{fileMeta.name}</div>
                      )}
                      {!fileNamesOnlyOnReadOnly ? (
                        <div className='d-flex gap-3 flex-wrap'>
                          <CButton color='link' className='p-0' onClick={() => handlePreviewFile(fileMeta)}>
                            {fileMeta.isPdf ? 'Xem PDF' : fileMeta.isImage ? 'Xem ảnh' : 'Xem tệp'}
                          </CButton>
                          <CLink href={resolveMediaUrl(fileMeta.url || fileMeta.dataUrl)} download={fileMeta.name} onClick={(event) => handleOpenFile(event, fileMeta.dataUrl)}>
                            Tải xuống
                          </CLink>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className='text-body-secondary'>Chưa có tệp đính kèm</div>
            )}
          </div>
        ) : (
          <>
            <CFormInput
              type='file'
              accept={field.type === 'image' ? 'image/*' : field.accept?.join(',') || undefined}
              multiple={field.multiple === true}
              onChange={(event) => onFileChange(field, event)}
              invalid={Boolean(error)}
              disabled={submitting || effectiveReadOnly}
            />
            {fileMetaList.length > 0 ? (
              <div className='text-body-secondary small mt-1'>
                Đã chọn: {fileMetaList.map((fileMeta) => fileMeta.name).join(', ')}
              </div>
            ) : null}
            {error ? <div className='text-danger small mt-1'>{error}</div> : null}
          </>
        )
      ) : null}

      {!['textarea', 'date', 'select', 'radio', 'file', 'image', 'table'].includes(field.type) ? (
        <>
          <CFormInput
            type={inputType}
            value={String(value ?? '')}
            onChange={(event) => onValueChange(field.key, event.target.value)}
            placeholder={field.placeholder || undefined}
            min={field.type === 'number' && field.min !== null ? field.min : undefined}
            max={field.type === 'number' && field.max !== null ? field.max : undefined}
            step={field.type === 'number' && field.step !== null ? field.step : undefined}
            invalid={Boolean(error)}
            disabled={submitting || effectiveReadOnly}
            readOnly={effectiveReadOnly}
          />
          {error ? <div className='text-danger small mt-1'>{error}</div> : null}
        </>
      ) : null}

      <CModal visible={previewVisible} size='xl' alignment='center' onClose={closePreviewModal}>
        <CModalHeader>
          <CModalTitle>{previewTitle || 'Xem tệp đính kèm'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {previewLoading ? (
            <div className='d-flex align-items-center gap-2 py-4'>
              <CSpinner size='sm' />
              <span>Đang tải xem trước...</span>
            </div>
          ) : previewError ? (
            <div className='text-warning small mb-3'>{previewError}</div>
          ) : null}

          {!previewLoading && previewType === 'image' && previewUrl ? (
            <img
              src={previewUrl}
              alt={previewTitle}
              style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain', display: 'block' }}
            />
          ) : null}

          {!previewLoading && previewType === 'pdf' && previewUrl ? (
            <iframe
              key={previewUrl}
              src={previewUrl}
              title={previewTitle || 'PDF preview'}
              style={{ width: '100%', minHeight: '75vh', border: '1px solid #dee2e6', borderRadius: 8 }}
            />
          ) : null}

          {!previewLoading && previewType === 'file' && previewUrl ? (
            <div className='d-flex flex-column gap-2'>
              <div>Không có chế độ xem trước cho tệp này.</div>
              <CLink href={previewUrl} target='_blank' rel='noreferrer'>Mở tệp</CLink>
            </div>
          ) : null}
        </CModalBody>
      </CModal>
    </CCol>
  )
}