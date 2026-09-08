import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CCol, CFormInput, CRow, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import { getTeacherClasses } from '../services/classService'
import { formatSessionDate, formatSessionTime, formatTeacherDisplay } from '../utils/classSessionUi'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export default function TeacherClassWorkspacePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [qDraft, setQDraft] = useState('')
  const [error, setError] = useState('')

  const total = useMemo(() => rows.length, [rows])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await getTeacherClasses({ q })
      setRows(Array.isArray(data) ? data : [])
    } catch (requestError) {
      setRows([])
      setError(getApiMessage(requestError, 'Không thể tải lớp giảng dạy.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [q])

  return (
    <div className='container-fluid py-4'>
      <CCard className='mb-4'>
        <CCardHeader><strong>Lớp tôi phụ trách</strong></CCardHeader>
        <CCardBody>
          <CRow className='g-3 align-items-end'>
            <CCol md={9}>
              <CFormInput value={qDraft} placeholder='Tìm theo tên lớp hoặc môn học' onChange={(event) => setQDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') setQ(qDraft.trim()) }} />
            </CCol>
            <CCol md={3} className='d-flex gap-2 justify-content-end'>
              <CButton color='primary' onClick={() => setQ(qDraft.trim())} disabled={loading}>Tìm</CButton>
              <CButton color='secondary' variant='outline' onClick={() => { setQ(''); setQDraft('') }} disabled={loading}>Đặt lại</CButton>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      <CCard>
        <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
          <div><strong>Danh sách lớp</strong> <CBadge color='secondary' className='ms-2'>{total}</CBadge></div>
        </CCardHeader>
        <CCardBody>
          {loading ? (
            <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải dữ liệu...</span></div>
          ) : (
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Lớp</CTableHeaderCell>
                  <CTableHeaderCell>Môn học</CTableHeaderCell>
                  <CTableHeaderCell>Vai trò</CTableHeaderCell>
                  <CTableHeaderCell>Học viên active</CTableHeaderCell>
                  <CTableHeaderCell>Buổi tiếp theo</CTableHeaderCell>
                  <CTableHeaderCell>Chưa hoàn thành báo cáo</CTableHeaderCell>
                  <CTableHeaderCell>Hành động</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={7} className='text-center text-body-secondary'>Không có lớp phù hợp.</CTableDataCell>
                  </CTableRow>
                ) : rows.map((item) => (
                  <CTableRow key={item.id}>
                    <CTableDataCell>
                      <div className='fw-semibold'>{item.name || '-'}</div>
                      <div className='small text-body-secondary'>{item.subjectCode || '-'}</div>
                    </CTableDataCell>
                    <CTableDataCell>{item.subject || '-'}</CTableDataCell>
                    <CTableDataCell>{item.roleLabels?.join(', ') || '-'}</CTableDataCell>
                    <CTableDataCell>{item.activeLearnersCount || 0}</CTableDataCell>
                    <CTableDataCell>
                      {item.nextSession ? `${formatSessionDate(item.nextSession.sessionDate)} · ${formatSessionTime(item.nextSession.startTime)}-${formatSessionTime(item.nextSession.endTime)}` : '—'}
                    </CTableDataCell>
                    <CTableDataCell>{item.pendingReportCount || 0}</CTableDataCell>
                    <CTableDataCell>
                      <CButton size='sm' color='primary' variant='outline' onClick={() => navigate(`/teacher/classes/${item.id}`)}>Mở lớp</CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>
    </div>
  )
}