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
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { createExamSlot, listExamSlots } from '../services/examSessionApi'

function normalizeRowList(result) {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.data)) return result.data
  if (Array.isArray(result?.results)) return result.results
  return []
}

export default function ExamSlotListPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [campaignId, setCampaignId] = useState('1')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const result = await listExamSlots({ campaignId })
      setRows(normalizeRowList(result))
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không tải được ca thi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [campaignId])

  async function handleCreate() {
    try {
      const payload = {
        tenant: 1,
        campaign: Number(campaignId),
        code: code.trim(),
        name: name.trim(),
        startAt,
        endAt,
        status: 'draft',
      }
      if (!payload.code || !payload.name || !payload.startAt || !payload.endAt) {
        setError('Mã, tên, giờ bắt đầu và giờ kết thúc là bắt buộc')
        return
      }
      const created = await createExamSlot(payload)
      setRows((prev) => {
        const base = Array.isArray(prev) ? prev : []
        const key = created?.id || created?.documentId
        const exists = base.some((item) => (item.id || item.documentId) === key)
        return exists ? base : [created, ...base]
      })
      setCode('')
      setName('')
      setStartAt('')
      setEndAt('')
      await load()
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không tạo được ca thi')
    }
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='fw-semibold'>Tạo ca thi</CCardHeader>
          <CCardBody>
            <CRow className='g-3'>
              <CCol md={2}><CFormLabel>Campaign ID</CFormLabel><CFormInput type='number' value={campaignId} onChange={(e) => setCampaignId(e.target.value)} /></CCol>
              <CCol md={3}><CFormLabel>Mã ca</CFormLabel><CFormInput value={code} onChange={(e) => setCode(e.target.value)} /></CCol>
              <CCol md={3}><CFormLabel>Tên ca</CFormLabel><CFormInput value={name} onChange={(e) => setName(e.target.value)} /></CCol>
              <CCol md={2}><CFormLabel>Bắt đầu</CFormLabel><CFormInput type='datetime-local' value={startAt} onChange={(e) => setStartAt(e.target.value)} /></CCol>
              <CCol md={2}><CFormLabel>Kết thúc</CFormLabel><CFormInput type='datetime-local' value={endAt} onChange={(e) => setEndAt(e.target.value)} /></CCol>
              <CCol md={12}><CButton color='primary' onClick={handleCreate}>Lưu ca thi</CButton></CCol>
            </CRow>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xs={12}>
        <CCard>
          <CCardHeader className='fw-semibold'>Danh sách ca thi</CCardHeader>
          <CCardBody>
            {error ? <CAlert color='danger'>{error}</CAlert> : null}
            <CTable responsive hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Mã</CTableHeaderCell>
                  <CTableHeaderCell>Tên</CTableHeaderCell>
                  <CTableHeaderCell>Thời gian</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {!loading && rows.length === 0 ? <CTableRow><CTableDataCell colSpan={4}>Chưa có ca thi</CTableDataCell></CTableRow> : null}
                {!loading && rows.map((row) => (
                  <CTableRow key={row.id || row.documentId || row.code}>
                    <CTableDataCell>{row.code}</CTableDataCell>
                    <CTableDataCell>{row.name}</CTableDataCell>
                    <CTableDataCell>{row.startAt} / {row.endAt}</CTableDataCell>
                    <CTableDataCell>{row.status}</CTableDataCell>
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
