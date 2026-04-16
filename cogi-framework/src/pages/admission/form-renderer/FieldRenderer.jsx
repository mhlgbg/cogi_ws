import {
  CFormCheck,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CLink,
} from '@coreui/react'
import TableFieldRenderer from './TableFieldRenderer'
import { getFileValueMetaList } from './schema'

export default function FieldRenderer({
  field,
  value,
  error,
  submitting,
  isReadOnly,
  onValueChange,
  onFileChange,
  onTableCellChange,
}) {
  const isTextarea = field.type === 'textarea'
  const isFileField = field.type === 'file' || field.type === 'image'
  const isTableField = field.type === 'table'
  const fileMetaList = getFileValueMetaList(value)
  const inputType = field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : 'text'

  return (
    <CCol md={isTextarea || isTableField ? 12 : 6} key={field.key}>
      {!isTableField ? (
        <>
          <CFormLabel>
            {field.label}
            {field.required ? ' *' : ''}
          </CFormLabel>
          {field.description ? <div className='text-body-secondary small mb-2'>{field.description}</div> : null}
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
            disabled={submitting || isReadOnly}
            readOnly={isReadOnly}
          />
          {error ? <div className='text-danger small mt-1'>{error}</div> : null}
        </>
      ) : null}

      {field.type === 'date' ? (
        <>
          <CFormInput
            type='date'
            value={String(value ?? '')}
            onChange={(event) => onValueChange(field.key, event.target.value)}
            invalid={Boolean(error)}
            disabled={submitting || isReadOnly}
            readOnly={isReadOnly}
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
            disabled={submitting || isReadOnly}
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
                disabled={submitting || isReadOnly}
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
            onChangeCell={(rowIndex, columnKey, cellValue) => onTableCellChange(field.key, rowIndex, columnKey, cellValue)}
            disabled={submitting || isReadOnly}
          />
          {error ? <div className='text-danger small mt-1'>{error}</div> : null}
        </>
      ) : null}

      {isFileField ? (
        isReadOnly ? (
          <div className='border rounded-3 p-3 bg-light'>
            {fileMetaList.length > 0 ? (
              <div className='d-flex flex-column gap-3'>
                {fileMetaList.map((fileMeta, index) => (
                  <div key={`${fileMeta.name}-${index}`} className='border rounded-3 bg-white p-3'>
                    {fileMeta.isImage && fileMeta.dataUrl ? (
                      <div className='mb-3'>
                        <img
                          src={fileMeta.dataUrl}
                          alt={fileMeta.name}
                          style={{ maxWidth: '100%', maxHeight: '320px', objectFit: 'contain', display: 'block' }}
                        />
                      </div>
                    ) : null}

                    <div className='d-flex flex-column gap-2'>
                      <div className='small text-body-secondary'>{fileMeta.name}</div>
                      <div className='d-flex gap-3 flex-wrap'>
                        <CLink href={fileMeta.dataUrl} target='_blank' rel='noreferrer'>
                          {fileMeta.isPdf ? 'Mở PDF' : 'Mở tệp'}
                        </CLink>
                        <CLink href={fileMeta.dataUrl} download={fileMeta.name}>
                          Tải xuống
                        </CLink>
                      </div>
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
              disabled={submitting}
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
            disabled={submitting || isReadOnly}
            readOnly={isReadOnly}
          />
          {error ? <div className='text-danger small mt-1'>{error}</div> : null}
        </>
      ) : null}
    </CCol>
  )
}