import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import ExamCampaignFormModal, { DEFAULT_CAMPAIGN_FORM, formatDisplayDate } from '../components/ExamCampaignFormModal'
import { createExamCampaign, listExamCampaigns } from '../services/examSessionApi'

function normalizeRowList(result) {
  if (Array.isArray(result)) return result
  if (Array.isArray(result?.data)) return result.data
  if (Array.isArray(result?.results)) return result.results
  return []
}

function formatCampaignDateRange(startDate, endDate) {
  const startText = formatDisplayDate(startDate)
  const endText = formatDisplayDate(endDate)

  if (startText === '—' && endText === '—') return '—'
  if (startText === '—') return `~ ${endText}`
  if (endText === '—') return `${startText} → Không xác định`

  return `${startText} → ${endText}`
}

export default function ExamCampaignListPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState(DEFAULT_CAMPAIGN_FORM)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const result = await listExamCampaigns()
      setRows(normalizeRowList(result))
    } catch (err) {
      setError(err?.response?.data?.error?.message || 'Không tải được đợt thi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(formValues) {
    try {
      setCreating(true)
      setError('')
      const payload = {
        code: String(formValues?.code || '').trim(),
        name: String(formValues?.name || '').trim(),
        description: String(formValues?.description || '').trim(),
        status: formValues?.status || 'draft',
        startDate: formValues?.startDate || null,
        endDate: formValues?.endDate || null,
      }

      if (!payload.code || !payload.name) {
        setError('Mã và tên đợt thi là bắt buộc')
        return
      }
      if (payload.startDate && payload.endDate && payload.startDate > payload.endDate) {
        setError('Ngày bắt đầu không được sau ngày kết thúc')
        return
      }

      const created = await createExamCampaign(payload)
      setRows((prev) => {
        const base = Array.isArray(prev) ? prev : []
        const exists = base.some((item) => (item.id || item.documentId) === (created?.id || created?.documentId))
        return exists ? base : [created, ...base]
      })
      setCreateForm(DEFAULT_CAMPAIGN_FORM)
      setShowCreateModal(false)
      await load()
    } catch (err) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || 'Không tạo được đợt thi')
    } finally {
      setCreating(false)
    }
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='fw-semibold d-flex justify-content-between align-items-center'>
            <span>Danh sách đợt thi</span>
            <CButton color='primary' onClick={() => setShowCreateModal(true)}>Thêm mới</CButton>
          </CCardHeader>
          <CCardBody>
            {error ? <CAlert color='danger'>{error}</CAlert> : null}
            <CTable responsive hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Mã</CTableHeaderCell>
                  <CTableHeaderCell>Tên</CTableHeaderCell>
                  <CTableHeaderCell>Thời gian</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Thao tác</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {loading ? <CTableRow><CTableDataCell colSpan={5}>Đang tải...</CTableDataCell></CTableRow> : null}
                {!loading && rows.length === 0 ? <CTableRow><CTableDataCell colSpan={5}>Chưa có dữ liệu</CTableDataCell></CTableRow> : null}
                {!loading && rows.map((row) => (
                  <CTableRow key={row.id || row.documentId || row.code}>
                    <CTableDataCell>{row.code}</CTableDataCell>
                    <CTableDataCell>{row.name}</CTableDataCell>
                    <CTableDataCell>{formatCampaignDateRange(row.startDate || row.startAt, row.endDate || row.endAt)}</CTableDataCell>
                    <CTableDataCell>{row.status}</CTableDataCell>
                    <CTableDataCell>
                      <CButton
                        size='sm'
                        color='primary'
                        variant='outline'
                        onClick={() => navigate(`/exam-campaigns/${row.documentId || row.id}`)}
                      >
                        Chi tiết
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>

      <ExamCampaignFormModal
        visible={showCreateModal}
        title='Thêm đợt thi'
        initialValues={createForm}
        submitLabel='Lưu'
        saving={creating}
        onClose={() => {
          setShowCreateModal(false)
          setCreateForm(DEFAULT_CAMPAIGN_FORM)
          setError('')
        }}
        onSave={async (nextForm) => {
          setCreateForm(nextForm)
          await handleCreate(nextForm)
        }}
      />
    </CRow>
  )
}
