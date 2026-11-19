import { useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { createAssessmentSession, listAssessmentSessions, markAssessmentSessionReady } from '../services/examSessionApi'

function normalizeRowList(result) {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.data)) return result.data
  if (Array.isArray(result?.results)) return result.results
  return []
}

function toRelationValue(value) {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'object') return String(value.documentId ?? value.id ?? '')
  return String(value)
}

export default function AssessmentSessionListPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [campaignId, setCampaignId] = useState('1')
  const [slotId, setSlotId] = useState('1')
  const [subjectId, setSubjectId] = useState('1')
  const [assessmentId, setAssessmentId] = useState('1')
  const [assessmentVersionId, setAssessmentVersionId] = useState('1')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [durationMinutes, setDurationMinutes] = useState('60')
  const [status, setStatus] = useState('draft')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const result = await listAssessmentSessions({ campaignId, slotId })
      setRows(normalizeRowList(result))
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không tải được phiên thi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [campaignId, slotId])

  async function handleCreate() {
    try {
      const payload = {
        campaign: toRelationValue(campaignId),
        slot: toRelationValue(slotId),
        subject: toRelationValue(subjectId),
        assessment: toRelationValue(assessmentId),
        assessmentVersion: toRelationValue(assessmentVersionId),
        code: code.trim(),
        name: name.trim(),
        durationMinutes: Number(durationMinutes),
        status,
      }
      if (!payload.code || !payload.name) {
        setError('Mã và tên phiên thi là bắt buộc')
        return
      }
      const created = await createAssessmentSession(payload)
      setRows((prev) => {
        const base = Array.isArray(prev) ? prev : []
        const key = created?.id || created?.documentId
        const exists = base.some((item) => (item.id || item.documentId) === key)
        return exists ? base : [created, ...base]
      })
      setCode('')
      setName('')
      await load()
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không tạo được phiên thi')
    }
  }

  async function handleReady(id) {
    try {
      await markAssessmentSessionReady(id)
      await load()
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không chốt phiên thi được')
    }
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='fw-semibold'>Tạo phiên thi</CCardHeader>
          <CCardBody>
            <CRow className='g-3'>
              <CCol md={2}><CFormLabel>Campaign</CFormLabel><CFormInput type='number' value={campaignId} onChange={(e) => setCampaignId(e.target.value)} /></CCol>
              <CCol md={2}><CFormLabel>Ca thi</CFormLabel><CFormInput type='number' value={slotId} onChange={(e) => setSlotId(e.target.value)} /></CCol>
              <CCol md={2}><CFormLabel>Môn</CFormLabel><CFormInput type='number' value={subjectId} onChange={(e) => setSubjectId(e.target.value)} /></CCol>
              <CCol md={2}><CFormLabel>Assessment</CFormLabel><CFormInput type='number' value={assessmentId} onChange={(e) => setAssessmentId(e.target.value)} /></CCol>
              <CCol md={2}><CFormLabel>Version</CFormLabel><CFormInput type='number' value={assessmentVersionId} onChange={(e) => setAssessmentVersionId(e.target.value)} /></CCol>
              <CCol md={2}><CFormLabel>Thời lượng</CFormLabel><CFormInput type='number' value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} /></CCol>
              <CCol md={3}><CFormLabel>Mã phiên</CFormLabel><CFormInput value={code} onChange={(e) => setCode(e.target.value)} /></CCol>
              <CCol md={4}><CFormLabel>Tên phiên</CFormLabel><CFormInput value={name} onChange={(e) => setName(e.target.value)} /></CCol>
              <CCol md={3}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={status} onChange={(e) => setStatus(e.target.value)}><option value='draft'>draft</option><option value='ready'>ready</option></CFormSelect></CCol>
              <CCol md={2} className='d-flex align-items-end'><CButton color='primary' onClick={handleCreate}>Lưu</CButton></CCol>
            </CRow>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xs={12}>
        <CCard>
          <CCardHeader className='fw-semibold'>Danh sách phiên thi</CCardHeader>
          <CCardBody>
            {error ? <CAlert color='danger'>{error}</CAlert> : null}
            <CTable responsive hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Mã</CTableHeaderCell>
                  <CTableHeaderCell>Tên</CTableHeaderCell>
                  <CTableHeaderCell>Ca</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Hành động</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {!loading && rows.length === 0 ? <CTableRow><CTableDataCell colSpan={5}>Chưa có phiên thi</CTableDataCell></CTableRow> : null}
                {!loading && rows.map((row) => (
                  <CTableRow key={row.id || row.documentId || row.code}>
                    <CTableDataCell>{row.code}</CTableDataCell>
                    <CTableDataCell>{row.name}</CTableDataCell>
                    <CTableDataCell>{row.slot?.code || row.slot?.name || '—'}</CTableDataCell>
                    <CTableDataCell>{row.status}</CTableDataCell>
                    <CTableDataCell>
                      {row.status === 'draft' ? <CButton size='sm' color='success' onClick={() => handleReady(row.id)}>Chốt ready</CButton> : 'Đã khóa'}
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}
