import { useCallback, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import api from '../../../api/axios'
import { useFeature } from '../../../contexts/FeatureContext'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function statusColor(cleanupStatus) {
  if (cleanupStatus === 'success') return 'success'
  if (cleanupStatus === 'warning') return 'warning'
  if (cleanupStatus === 'failed') return 'danger'
  if (cleanupStatus === 'preview') return 'info'
  return 'secondary'
}

function statusLabel(cleanupStatus) {
  if (cleanupStatus === 'success') return 'Đã dọn'
  if (cleanupStatus === 'warning') return 'Có cảnh báo'
  if (cleanupStatus === 'failed') return 'Thất bại'
  if (cleanupStatus === 'preview') return 'Chưa dọn'
  return 'Không cần dọn'
}

function summaryText(report) {
  if (!report) return ''

  const parts = [
    `Xóa user: ${Array.isArray(report?.deletedUserIds) ? report.deletedUserIds.length : 0}`,
    `assignment: ${toNumber(report?.deletedAssignments)}`,
    `response: ${toNumber(report?.deletedResponses)}`,
    `answer: ${toNumber(report?.deletedAnswers)}`,
  ]

  return parts.join(' | ')
}

export default function UserDuplicateCleanupPage() {
  const feature = useFeature()
  const canCleanup = feature?.hasFeature?.('admin.userDuplicateCleanup.cleanup')

  const [usernameInput, setUsernameInput] = useState('')
  const [scannedUsername, setScannedUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [groups, setGroups] = useState([])
  const [scanMeta, setScanMeta] = useState(null)
  const [detailGroup, setDetailGroup] = useState(null)
  const [confirmState, setConfirmState] = useState({ open: false, mode: '', group: null })
  const [submitting, setSubmitting] = useState(false)
  const [cleanupReportsByUsername, setCleanupReportsByUsername] = useState({})
  const [cleanupAllResult, setCleanupAllResult] = useState(null)

  const fetchGroups = useCallback(async (nextUsername = usernameInput) => {
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      setCleanupAllResult(null)

      const normalizedUsername = toText(nextUsername)
      const response = await api.get('/admin/user-duplicate-cleanup/scan', {
        params: {
          username: normalizedUsername || undefined,
        },
      })

      const nextGroups = Array.isArray(response?.data?.data) ? response.data.data : []
      setGroups(nextGroups)
      setScanMeta(response?.data?.meta || null)
      setScannedUsername(normalizedUsername)
      setCleanupReportsByUsername({})
      setSuccess(normalizedUsername ? `Đã quét username ${normalizedUsername}` : 'Đã quét toàn bộ user trùng trong tenant hiện tại')
    } catch (requestError) {
      const message = requestError?.response?.data?.error?.message
        || requestError?.response?.data?.message
        || requestError?.message
        || 'Không thể quét user trùng'
      setError(message)
      setGroups([])
      setScanMeta(null)
    } finally {
      setLoading(false)
    }
  }, [usernameInput])

  const handleScan = useCallback(() => {
    fetchGroups(usernameInput)
  }, [fetchGroups, usernameInput])

  const handleRescan = useCallback(() => {
    fetchGroups(scannedUsername)
  }, [fetchGroups, scannedUsername])

  const handleCleanupOne = useCallback(async (group) => {
    if (!group) return

    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      const response = await api.post('/admin/user-duplicate-cleanup/cleanup-one', {
        username: group.username,
        keepUserId: group.keepUserId,
      })

      const report = response?.data?.report || null
      setCleanupReportsByUsername((current) => ({
        ...current,
        [toText(group?.username).toLowerCase()]: report,
      }))
      setSuccess(`Đã xử lý nhóm ${group.username}`)
      setConfirmState({ open: false, mode: '', group: null })
      await fetchGroups(scannedUsername || usernameInput)
    } catch (requestError) {
      const message = requestError?.response?.data?.error?.message
        || requestError?.response?.data?.message
        || requestError?.message
        || 'Không thể dọn nhóm user trùng'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }, [fetchGroups, scannedUsername, usernameInput])

  const handleCleanupAll = useCallback(async () => {
    try {
      setSubmitting(true)
      setError('')
      setSuccess('')

      const response = await api.post('/admin/user-duplicate-cleanup/cleanup-all', {
        username: scannedUsername || undefined,
      })

      const reports = Array.isArray(response?.data?.reports) ? response.data.reports : []
      const nextReports = {}
      for (const report of reports) {
        const key = toText(report?.username).toLowerCase()
        if (!key) continue
        nextReports[key] = report
      }

      setCleanupReportsByUsername(nextReports)
      setCleanupAllResult(response?.data || null)
      setSuccess('Đã chạy dọn tất cả nhóm đã rà soát')
      setConfirmState({ open: false, mode: '', group: null })
      await fetchGroups(scannedUsername || usernameInput)
    } catch (requestError) {
      const message = requestError?.response?.data?.error?.message
        || requestError?.response?.data?.message
        || requestError?.message
        || 'Không thể dọn tất cả nhóm user trùng'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }, [fetchGroups, scannedUsername, usernameInput])

  const rows = useMemo(() => {
    return groups.map((group) => {
      const report = cleanupReportsByUsername[toText(group?.username).toLowerCase()] || null
      return {
        ...group,
        cleanupReport: report,
        effectiveStatus: report?.cleanupStatus || group?.cleanupStatus || 'preview',
      }
    })
  }, [cleanupReportsByUsername, groups])

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader>Dọn user trùng</CCardHeader>
          <CCardBody>
            <CRow className='g-3 align-items-end'>
              <CCol md={8}>
                <CFormLabel htmlFor='duplicate-cleanup-username'>Username</CFormLabel>
                <CFormInput
                  id='duplicate-cleanup-username'
                  placeholder='Để trống để quét toàn bộ tenant hiện tại'
                  value={usernameInput}
                  onChange={(event) => setUsernameInput(event.target.value)}
                />
              </CCol>
              <CCol md={4} className='d-flex gap-2'>
                <CButton color='primary' onClick={handleScan} disabled={loading || submitting}>
                  {loading ? <CSpinner size='sm' /> : 'Tìm user trùng'}
                </CButton>
                <CButton color='secondary' variant='outline' onClick={handleRescan} disabled={loading || submitting || (!scanMeta && rows.length === 0)}>
                  Quét lại
                </CButton>
              </CCol>
            </CRow>

            {!canCleanup ? (
              <CAlert color='warning' className='mt-3 mb-0'>
                Tài khoản hiện tại chỉ có quyền xem. Nút dọn dữ liệu sẽ bị khóa.
              </CAlert>
            ) : null}

            {error ? <CAlert color='danger' className='mt-3 mb-0'>{error}</CAlert> : null}
            {success ? <CAlert color='success' className='mt-3 mb-0'>{success}</CAlert> : null}

            {cleanupAllResult?.meta ? (
              <CAlert color={cleanupAllResult?.ok ? 'success' : 'warning'} className='mt-3 mb-0'>
                {`Đã xử lý ${toNumber(cleanupAllResult.meta.processedGroups)} nhóm | thành công ${toNumber(cleanupAllResult.meta.successGroups)} | cảnh báo ${toNumber(cleanupAllResult.meta.warningGroups)} | lỗi ${toNumber(cleanupAllResult.meta.failedGroups)}`}
              </CAlert>
            ) : null}

            <div className='d-flex justify-content-between align-items-center mt-4 mb-3 gap-3 flex-wrap'>
              <div>
                <strong>{`Nhóm trùng: ${rows.length}`}</strong>
                {scanMeta ? <span className='ms-3 text-body-secondary'>{`Quét lúc ${new Date(scanMeta.scannedAt).toLocaleString('vi-VN')}`}</span> : null}
              </div>
              <CButton
                color='danger'
                onClick={() => setConfirmState({ open: true, mode: 'all', group: null })}
                disabled={!canCleanup || rows.length === 0 || loading || submitting}
              >
                Dọn tất cả nhóm đã rà soát
              </CButton>
            </div>

            <CTable hover responsive className='mb-0 ai-table'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Username</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 120 }}>Số lượng</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 140 }}>keepUserId</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 160 }}>Survey Assignments</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 160 }}>Survey Responses</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 160 }}>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell style={{ minWidth: 260 }}>Kết quả gần nhất</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 220 }}>Hành động</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.length === 0 ? (
                  <CTableRow>
                    <CTableDataCell colSpan={8} className='text-center text-body-secondary py-4'>
                      {loading ? 'Đang quét dữ liệu...' : 'Chưa có dữ liệu trùng để hiển thị'}
                    </CTableDataCell>
                  </CTableRow>
                ) : rows.map((group) => (
                  <CTableRow key={group.normalizedUsername}>
                    <CTableDataCell>
                      <div className='fw-semibold'>{group.username}</div>
                      <div className='text-body-secondary small'>{group.normalizedUsername}</div>
                    </CTableDataCell>
                    <CTableDataCell>{toNumber(group.duplicateCount)}</CTableDataCell>
                    <CTableDataCell>{group.keepUserId || '-'}</CTableDataCell>
                    <CTableDataCell>{toNumber(group.totalSurveyAssignments)}</CTableDataCell>
                    <CTableDataCell>{toNumber(group.totalSurveyResponses)}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={statusColor(group.effectiveStatus)}>{statusLabel(group.effectiveStatus)}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>
                      {group.cleanupReport ? (
                        <>
                          <div>{summaryText(group.cleanupReport)}</div>
                          {Array.isArray(group.cleanupReport?.warnings) && group.cleanupReport.warnings.length > 0 ? (
                            <div className='text-warning small mt-1'>{group.cleanupReport.warnings[0]}</div>
                          ) : null}
                          {Array.isArray(group.cleanupReport?.errors) && group.cleanupReport.errors.length > 0 ? (
                            <div className='text-danger small mt-1'>{group.cleanupReport.errors[0]}</div>
                          ) : null}
                        </>
                      ) : (
                        <span className='text-body-secondary'>Chưa cleanup</span>
                      )}
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className='d-flex gap-2'>
                        <CButton color='info' variant='outline' size='sm' onClick={() => setDetailGroup(group)}>
                          Xem chi tiết
                        </CButton>
                        <CButton
                          color='danger'
                          variant='outline'
                          size='sm'
                          onClick={() => setConfirmState({ open: true, mode: 'one', group })}
                          disabled={!canCleanup || submitting}
                        >
                          Dọn nhóm này
                        </CButton>
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>

      <CModal visible={Boolean(detailGroup)} size='xl' onClose={() => setDetailGroup(null)}>
        <CModalHeader>
          <CModalTitle>{`Chi tiết nhóm trùng: ${detailGroup?.username || ''}`}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>User ID</CTableHeaderCell>
                <CTableHeaderCell>Email</CTableHeaderCell>
                <CTableHeaderCell>Họ tên</CTableHeaderCell>
                <CTableHeaderCell>Assignments</CTableHeaderCell>
                <CTableHeaderCell>Responses</CTableHeaderCell>
                <CTableHeaderCell>Roles</CTableHeaderCell>
                <CTableHeaderCell>Giữ lại</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {(Array.isArray(detailGroup?.members) ? detailGroup.members : []).map((member) => (
                <CTableRow key={member.id}>
                  <CTableDataCell>{member.id}</CTableDataCell>
                  <CTableDataCell>{member.email || '-'}</CTableDataCell>
                  <CTableDataCell>{member.fullName || '-'}</CTableDataCell>
                  <CTableDataCell>{toNumber(member.surveyAssignmentsCount)}</CTableDataCell>
                  <CTableDataCell>{toNumber(member.surveyResponsesCount)}</CTableDataCell>
                  <CTableDataCell>{toNumber(member.userTenantRolesCount)}</CTableDataCell>
                  <CTableDataCell>
                    {Number(member.id) === Number(detailGroup?.keepUserId)
                      ? <CBadge color='success'>Keep</CBadge>
                      : <CBadge color='danger'>Delete candidate</CBadge>}
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setDetailGroup(null)}>Đóng</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={confirmState.open} onClose={() => setConfirmState({ open: false, mode: '', group: null })}>
        <CModalHeader>
          <CModalTitle>Xác nhận cleanup user trùng</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CAlert color='danger'>
            Đây là thao tác nguy hiểm. Hệ thống sẽ xóa dữ liệu liên quan trong tenant hiện tại và có thể xóa hẳn user nếu user đó không còn thuộc tenant nào khác.
          </CAlert>
          {confirmState.mode === 'one' && confirmState.group ? (
            <div>
              <div>{`Username: ${confirmState.group.username}`}</div>
              <div>{`Keep user: ${confirmState.group.keepUserId}`}</div>
              <div>{`Delete candidates: ${(Array.isArray(confirmState.group.deleteCandidates) ? confirmState.group.deleteCandidates : []).join(', ') || '-'}`}</div>
            </div>
          ) : (
            <div>{`Sẽ cleanup ${rows.length} nhóm đã rà soát trong tenant hiện tại.`}</div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setConfirmState({ open: false, mode: '', group: null })} disabled={submitting}>
            Hủy
          </CButton>
          <CButton
            color='danger'
            onClick={() => {
              if (confirmState.mode === 'one') {
                handleCleanupOne(confirmState.group)
                return
              }
              handleCleanupAll()
            }}
            disabled={submitting}
          >
            {submitting ? <CSpinner size='sm' /> : 'Xác nhận cleanup'}
          </CButton>
        </CModalFooter>
      </CModal>
    </CRow>
  )
}