import { useEffect, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CSpinner,
  CTable,
  CTableHead,
  CTableBody,
  CTableRow,
  CTableHeaderCell,
  CTableDataCell,
} from '@coreui/react'
import { getClassTeacherAssignments, updateClassTeacherAssignment } from '../services/classService'
import ClassTeacherAssignmentCreateModal from './ClassTeacherAssignmentCreateModal'
import { useAuth } from '../../../contexts/AuthContext'

function formatDate(value) {
  if (!value) return '-'
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleDateString()
  } catch {
    return '-'
  }
}

function formatTeacherDisplay(teacher) {
  if (!teacher) return '-'

  const fullName = String(teacher.fullName || '').trim()
  const username = String(teacher.username || '').trim()
  const email = String(teacher.email || '').trim()

  if (fullName && username) return `${fullName} (${username})`
  return fullName || username || email || '-'
}

function roleLabel(role) {
  switch (String(role || '')) {
    case 'main':
      return 'Phụ trách'
    case 'co_teacher':
      return 'Đồng giảng'
    case 'assistant':
      return 'Trợ giảng'
    case 'substitute':
      return 'Dạy thay'
    default:
      return role || '-'
  }
}

export default function ClassTeacherAssignmentsTab({ classId }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const { isAuthenticated, user } = useAuth()

  async function loadAssignments() {
    setLoading(true)
    setError('')

    try {
      const data = await getClassTeacherAssignments(classId)

      // sort: active first, then startDate desc, then createdAt desc
      const weight = (item) => (item.assignmentStatus === 'active' ? 0 : 1)

      const sorted = (Array.isArray(data) ? data : []).slice().sort((a, b) => {
        const wa = weight(a)
        const wb = weight(b)
        if (wa !== wb) return wa - wb

        const sa = a.startDate ? new Date(a.startDate).getTime() : 0
        const sb = b.startDate ? new Date(b.startDate).getTime() : 0
        if (sa !== sb) return sb - sa

        const ca = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const cb = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return cb - ca
      })

      setRows(sorted)
    } catch (err) {
      setError('Không thể tải danh sách phân công chuyên môn.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!classId) return
    loadAssignments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId])

  const [editingAssignment, setEditingAssignment] = useState(null)

  function handleOpenCreate() {
    setEditingAssignment(null)
    setShowCreate(true)
  }

  function handleCloseCreate() {
    setShowCreate(false)
    setEditingAssignment(null)
  }

  function handleCreated(item) {
    loadAssignments()
  }

  function handleEditClick(item) {
    setEditingAssignment(item)
    setShowCreate(true)
  }

  const [processingId, setProcessingId] = useState(null)

  async function handleToggleStatus(item) {
    if (!item || !item.id) return

    const targetStatus = item.assignmentStatus === 'active' ? 'inactive' : 'active'
    const verb = targetStatus === 'inactive' ? 'Ngừng' : 'Kích hoạt lại'
    const confirmMessage = `${verb} phân công này?`
    if (!window.confirm(confirmMessage)) return

    try {
      setProcessingId(item.id)
      await updateClassTeacherAssignment(classId, item.id, { assignmentStatus: targetStatus })
      window.alert(targetStatus === 'inactive' ? 'Đã ngừng phân công.' : 'Đã kích hoạt lại phân công.')
      loadAssignments()
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Không thể cập nhật trạng thái phân công.'
      window.alert(msg)
    } finally {
      setProcessingId(null)
    }
  }

  // If project has no IAM permission system in this frontend, fall back to authenticated users can create.
  const canCreate = Boolean(isAuthenticated)

  return (
    <CCard className='border-0 shadow-sm'>
      <CCardHeader className='d-flex align-items-center justify-content-between'>
        <strong>Danh sách phân công</strong>
        {canCreate && (
          <div>
            <CButton color='primary' size='sm' onClick={handleOpenCreate}>Thêm phân công</CButton>
          </div>
        )}
      </CCardHeader>

      <CCardBody>
        {loading && (
          <div className='text-center py-4'>
            <CSpinner />
          </div>
        )}

        {error && (
          <CAlert color='danger'>
            {error}
            <div className='mt-2'>
              <CButton size='sm' color='primary' onClick={loadAssignments}>Thử lại</CButton>
            </div>
          </CAlert>
        )}

        {!loading && !error && (!rows || rows.length === 0) && (
          <div>
            <div className='mb-3'><strong>Lớp học này chưa có phân công chuyên môn.</strong></div>
            <div className='text-body-secondary mb-3'>Các giáo viên được phân công giảng dạy sẽ được hiển thị tại đây.</div>
            {canCreate && <CButton color='primary' onClick={handleOpenCreate}>Thêm phân công</CButton>}
          </div>
        )}

        {!loading && !error && rows && rows.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: 40 }}>#</CTableHeaderCell>
                  <CTableHeaderCell>Giáo viên</CTableHeaderCell>
                  <CTableHeaderCell>Chuyên môn</CTableHeaderCell>
                  <CTableHeaderCell>Vai trò</CTableHeaderCell>
                  <CTableHeaderCell>Thời gian</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Tính công</CTableHeaderCell>
                  <CTableHeaderCell>Ghi chú</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 120 }}>Hành động</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.map((item, index) => (
                  <CTableRow key={item.id}>
                    <CTableDataCell>{index + 1}</CTableDataCell>
                    <CTableDataCell>{formatTeacherDisplay(item.teacher)}</CTableDataCell>
                    <CTableDataCell>{item.subject || item.subjectCode ? (item.subject ? `${item.subject}${item.subjectCode ? ` (${item.subjectCode})` : ''}` : item.subjectCode) : '—'}</CTableDataCell>
                    <CTableDataCell>{roleLabel(item.role)}</CTableDataCell>
                    <CTableDataCell>
                      {item.startDate && item.endDate ? `${formatDate(item.startDate)} - ${formatDate(item.endDate)}`
                        : item.startDate ? `Từ ngày ${formatDate(item.startDate)}`
                        : item.endDate ? `Đến ngày ${formatDate(item.endDate)}`
                        : 'Không giới hạn'}
                    </CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={item.assignmentStatus === 'inactive' ? 'secondary' : 'success'}>
                        {item.assignmentStatus === 'inactive' ? 'Ngừng hoạt động' : 'Đang hoạt động'}
                      </CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{item.isPayable ? 'Có' : 'Không'}</CTableDataCell>
                    <CTableDataCell title={item.note || ''} style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.note || '-'}</CTableDataCell>
                  <CTableDataCell style={{ width: 200 }}>
                    <CButton size='sm' color='secondary' className='me-2' onClick={() => handleEditClick(item)}>Sửa</CButton>
                    {item.assignmentStatus === 'active' ? (
                      <CButton size='sm' color='warning' disabled={processingId === item.id} onClick={() => handleToggleStatus(item)}>Ngừng</CButton>
                    ) : (
                      <CButton size='sm' color='success' disabled={processingId === item.id} onClick={() => handleToggleStatus(item)}>Kích hoạt lại</CButton>
                    )}
                  </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </div>
        )}

        <ClassTeacherAssignmentCreateModal
          show={showCreate}
          classId={classId}
          onClose={handleCloseCreate}
          onSuccess={handleCreated}
          existingRows={rows}
          assignment={editingAssignment}
        />
      </CCardBody>
    </CCard>
  )
}
