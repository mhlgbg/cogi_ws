import {
  CAlert,
  CBadge,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CLink,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { getFileValueMetaList } from '../../../pages/admission/form-renderer/schema'

function renderDate(value) {
  if (!value) return '-'
  const text = String(value).trim()
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (match) return text

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function normalizeList(items) {
  return Array.isArray(items) ? items.filter(Boolean) : []
}

function mergeFieldFiles(field, fallbackFormData) {
  const files = normalizeList(field?.files)
  const hasUsableUrl = files.some((item) => item?.url)
  if (hasUsableUrl || !field?.key) return files

  const fallbackFiles = getFileValueMetaList(fallbackFormData?.[field.key])
  if (fallbackFiles.length === 0) return files

  return fallbackFiles.map((item, index) => ({
    id: null,
    name: item.name || `Tệp ${index + 1}`,
    url: item.url || item.dataUrl || null,
    mime: item.type || null,
    fieldKey: field.key,
    fieldLabel: field.label,
  }))
}

function SummaryBlock({ title, items }) {
  const rows = normalizeList(items)
  if (rows.length === 0) return null

  return (
    <CCard className='border-0 shadow-sm h-100'>
      <CCardHeader className='bg-white border-0 fw-semibold'>{title}</CCardHeader>
      <CCardBody>
        {rows.map((item) => (
          <div key={item.key || item.label} className='mb-3'>
            <div className='small text-body-secondary'>{item.label}</div>
            <div>{item.value || '-'}</div>
          </div>
        ))}
      </CCardBody>
    </CCard>
  )
}

function EvidenceList({ title, items, color = 'secondary' }) {
  const rows = normalizeList(items)
  if (rows.length === 0) return null

  return (
    <CCard className='border-0 shadow-sm h-100'>
      <CCardHeader className='bg-white border-0 d-flex justify-content-between align-items-center gap-2'>
        <span className='fw-semibold'>{title}</span>
        <CBadge color={color}>{rows.length}</CBadge>
      </CCardHeader>
      <CCardBody>
        <div className='d-flex flex-column gap-2'>
          {rows.map((item, index) => (
            <div key={`${item.fieldKey || 'file'}-${item.name}-${index}`} className='border rounded px-3 py-2'>
              <div className='fw-semibold'>{item.name || 'Tệp đính kèm'}</div>
              <div className='small text-body-secondary'>{item.fieldLabel || '-'}</div>
              {item.url ? (
                <CLink href={item.url} target='_blank' rel='noreferrer'>Mở tệp</CLink>
              ) : (
                <div className='small text-body-secondary'>Không có liên kết trực tiếp trong snapshot</div>
              )}
            </div>
          ))}
        </div>
      </CCardBody>
    </CCard>
  )
}

function DisplayField({ field, fallbackFormData }) {
  const files = mergeFieldFiles(field, fallbackFormData)

  if (field?.type === 'table') {
    const rows = normalizeList(field?.rows)
    return (
      <div className='mb-4'>
        <div className='fw-semibold mb-2'>{field.label}</div>
        {rows.length === 0 ? (
          <div className='text-body-secondary small'>Không có dữ liệu</div>
        ) : (
          <CTable bordered responsive small className='mb-0'>
            <CTableHead>
              <CTableRow>
                {normalizeList(rows[0]?.cells).map((cell) => (
                  <CTableHeaderCell key={cell.key || cell.label}>{cell.label}</CTableHeaderCell>
                ))}
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.map((row) => (
                <CTableRow key={row.key}>
                  {normalizeList(row.cells).map((cell) => (
                    <CTableDataCell key={cell.key || cell.label}>{cell.value || '-'}</CTableDataCell>
                  ))}
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        )}
      </div>
    )
  }

  if (files.length > 0) {
    return (
      <div className='mb-4'>
        <div className='fw-semibold mb-2'>{field.label}</div>
        <div className='d-flex flex-column gap-2'>
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className='border rounded px-3 py-2'>
              <div>{file.name || 'Tệp đính kèm'}</div>
              {file.url ? (
                <CLink href={file.url} target='_blank' rel='noreferrer'>Mở tệp</CLink>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className='mb-4'>
      <div className='small text-body-secondary'>{field.label}</div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{field.value || '-'}</div>
    </div>
  )
}

export default function AdmissionReviewSnapshotView({ snapshot, fallbackFormData }) {
  const displaySections = normalizeList(snapshot?.displaySections)

  return (
    <div className='d-flex flex-column gap-4'>
      <CRow className='g-3'>
        <CCol md={6} xl={4}><SummaryBlock title='Tóm tắt học sinh' items={snapshot?.studentSummary} /></CCol>
        <CCol md={6} xl={4}><SummaryBlock title='Tóm tắt phụ huynh' items={snapshot?.parentSummary} /></CCol>
        <CCol md={6} xl={4}><SummaryBlock title='Tóm tắt học tập / điểm số' items={snapshot?.studyScoreSummary} /></CCol>
      </CRow>

      {snapshot?.cambridgeBranch ? (
        <CAlert color='info' className='mb-0'>
          <strong>{snapshot.cambridgeBranch.label}:</strong> {snapshot.cambridgeBranch.value}
        </CAlert>
      ) : null}

      {normalizeList(snapshot?.serviceNeeds).length > 0 ? (
        <CCard className='border-0 shadow-sm'>
          <CCardHeader className='bg-white border-0 fw-semibold'>Nhu cầu dịch vụ</CCardHeader>
          <CCardBody>
            <div className='d-flex flex-wrap gap-2'>
              {snapshot.serviceNeeds.map((item) => (
                <CBadge key={item.key || item.label} color='secondary' shape='rounded-pill'>{item.label}: {item.value}</CBadge>
              ))}
            </div>
          </CCardBody>
        </CCard>
      ) : null}

      {(normalizeList(snapshot?.evidenceFiles?.images).length > 0 || normalizeList(snapshot?.evidenceFiles?.pdfs).length > 0) ? (
        <CRow className='g-3'>
          <CCol md={6}><EvidenceList title='Minh chứng hình ảnh' items={snapshot?.evidenceFiles?.images} color='info' /></CCol>
          <CCol md={6}><EvidenceList title='Minh chứng PDF' items={snapshot?.evidenceFiles?.pdfs} color='danger' /></CCol>
        </CRow>
      ) : null}

      {displaySections.map((section) => (
        <CCard key={section.key || section.title} className='border-0 shadow-sm'>
          <CCardHeader className='bg-white border-0 fw-semibold'>{section.title || 'Thông tin hồ sơ'}</CCardHeader>
          <CCardBody>
            {normalizeList(section.fields).length === 0 ? (
              <div className='text-body-secondary small'>Không có dữ liệu hiển thị</div>
            ) : normalizeList(section.fields).map((field) => (
              <DisplayField key={field.key || field.label} field={field} fallbackFormData={fallbackFormData} />
            ))}
          </CCardBody>
        </CCard>
      ))}

      {snapshot?.generatedAt ? (
        <div className='small text-body-secondary'>Snapshot cập nhật: {renderDate(snapshot.generatedAt)}</div>
      ) : null}
    </div>
  )
}
