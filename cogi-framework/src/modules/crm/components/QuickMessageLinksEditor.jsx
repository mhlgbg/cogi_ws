import {
  CButton,
  CCol,
  CFormInput,
  CFormLabel,
  CRow,
} from '@coreui/react'

function createEmptyLink() {
  return { label: '', url: '' }
}

export default function QuickMessageLinksEditor({ value = [], errors = {}, disabled = false, onChange }) {
  const links = Array.isArray(value) ? value : []

  function updateLink(index, patch) {
    const next = links.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item))
    onChange(next)
  }

  function addLink() {
    if (links.length >= 10) return
    onChange([...links, createEmptyLink()])
  }

  function removeLink(index) {
    onChange(links.filter((_, currentIndex) => currentIndex !== index))
  }

  return (
    <div>
      <div className='d-flex justify-content-between align-items-center mb-2'>
        <CFormLabel className='mb-0'>Đường link</CFormLabel>
        <CButton type='button' color='secondary' variant='outline' size='sm' onClick={addLink} disabled={disabled || links.length >= 10}>
          Thêm đường link
        </CButton>
      </div>

      {errors.links ? <div className='text-danger small mb-2'>{errors.links}</div> : null}

      {links.length === 0 ? (
        <div className='small text-body-secondary'>Chưa có đường link nào.</div>
      ) : links.map((item, index) => (
        <div key={`quick-message-link-${index}`} className='border rounded p-3 mb-3'>
          <CRow className='g-3 align-items-start'>
            <CCol md={4}>
              <CFormLabel>Tên đường link</CFormLabel>
              <CFormInput
                value={item?.label || ''}
                onChange={(event) => updateLink(index, { label: event.target.value })}
                placeholder='Ví dụ: Mở tài liệu'
                disabled={disabled}
              />
              {errors[`links.${index}.label`] ? <div className='text-danger small mt-1'>{errors[`links.${index}.label`]}</div> : null}
            </CCol>
            <CCol md={7}>
              <CFormLabel>URL</CFormLabel>
              <CFormInput
                value={item?.url || ''}
                onChange={(event) => updateLink(index, { url: event.target.value })}
                placeholder='https://example.com/document'
                disabled={disabled}
              />
              {errors[`links.${index}.url`] ? <div className='text-danger small mt-1'>{errors[`links.${index}.url`]}</div> : null}
            </CCol>
            <CCol md={1} className='d-flex align-items-end'>
              <CButton type='button' color='danger' variant='outline' onClick={() => removeLink(index)} disabled={disabled}>
                Xóa
              </CButton>
            </CCol>
          </CRow>
        </div>
      ))}
    </div>
  )
}