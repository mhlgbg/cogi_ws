import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { getMySurveyAssignments } from '../services/surveyService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function getAssignmentGroup(item) {
  if (item?.isCompleted || item?.hasSubmittedResponse) return 'done'
  if (item?.hasInProgressResponse) return 'in-progress'
  return 'todo'
}

function getGroupMeta(key) {
  if (key === 'todo') return { title: 'Chưa làm', color: 'secondary' }
  if (key === 'in-progress') return { title: 'Đang làm', color: 'warning' }
  return { title: 'Đã hoàn thành', color: 'success' }
}

function getStatusBadge(item) {
  const group = getAssignmentGroup(item)
  if (group === 'done') return { color: 'success', label: 'Đã hoàn thành' }
  if (group === 'in-progress') return { color: 'warning', label: 'Đang làm' }
  return { color: 'secondary', label: 'Chưa làm' }
}

function formatIdWithName(identifier, name) {
  const safeId = String(identifier || '').trim()
  const safeName = String(name || '').trim()

  if (safeId && safeName) return `${safeId} - ${safeName}`
  if (safeName) return safeName
  if (safeId) return safeId
  return '-'
}

function SectionTable({ title, color, rows, navigate }) {
  return (
    <CCard className='mb-4 shadow-sm border-0'>
      <CCardHeader className='bg-white d-flex justify-content-between align-items-center'>
        <div className='fw-bold'>{title}</div>
        <CBadge color={color} shape='rounded-pill'>{rows.length}</CBadge>
      </CCardHeader>
      <CCardBody>
        {rows.length === 0 ? (
          <div className='text-medium-emphasis'>Không có khảo sát trong nhóm này.</div>
        ) : (
          <CTable hover responsive align='middle'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Tên khảo sát</CTableHeaderCell>
                <CTableHeaderCell>Môn học</CTableHeaderCell>
                <CTableHeaderCell>Giảng viên</CTableHeaderCell>
                <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                <CTableHeaderCell className='text-end'>Hành động</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.map((item) => {
                const status = getStatusBadge(item)
                const group = getAssignmentGroup(item)
                const disabled = group === 'done'

                return (
                  <CTableRow key={item.id}>
                    <CTableDataCell>
                      <div className='fw-semibold'>{item?.campaign?.name || 'Khảo sát'}</div>
                      <div className='small text-medium-emphasis'>{item?.campaign?.template?.name || item?.campaign?.template?.code || ''}</div>
                    </CTableDataCell>
                    <CTableDataCell>{formatIdWithName(item?.courseId, item?.courseName)}</CTableDataCell>
                    <CTableDataCell>{formatIdWithName(item?.lecturerId, item?.lecturerName)}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={status.color}>{status.label}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell className='text-end'>
                      <CButton
                        color={group === 'in-progress' ? 'warning' : 'primary'}
                        variant={disabled ? 'outline' : undefined}
                        disabled={disabled}
                        onClick={() => navigate(`/survey/${item.id}`)}
                      >
                        {group === 'todo' ? 'Bắt đầu' : group === 'in-progress' ? 'Tiếp tục' : 'Đã làm'}
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>
        )}
      </CCardBody>
    </CCard>
  )
}

export default function SurveyList() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')

      try {
        const data = await getMySurveyAssignments()
        if (!mounted) return
        setRows(Array.isArray(data) ? data : [])
      } catch (loadError) {
        if (!mounted) return
        setRows([])
        setError(getApiMessage(loadError, 'Không tải được danh sách khảo sát'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  const grouped = useMemo(() => {
    const groups = {
      todo: [],
      'in-progress': [],
      done: [],
    }

    for (const item of rows) {
      groups[getAssignmentGroup(item)].push(item)
    }

    return groups
  }, [rows])

  return (
    <div className='container-fluid py-4'>
      <div className='d-flex justify-content-between align-items-center mb-4 gap-3 flex-wrap'>
        <div>
          <h3 className='mb-1'>Khảo sát của tôi</h3>
          <div className='text-medium-emphasis'>Theo dõi và hoàn thành các phiếu khảo sát được giao.</div>
        </div>
      </div>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}

      {loading ? (
        <div className='text-center py-5'>
          <CSpinner color='primary' />
        </div>
      ) : (
        <>
          {(['todo', 'in-progress', 'done']).map((key) => {
            const meta = getGroupMeta(key)
            return (
              <SectionTable
                key={key}
                title={meta.title}
                color={meta.color}
                rows={grouped[key]}
                navigate={navigate}
              />
            )
          })}
        </>
      )}
    </div>
  )
}