import { useEffect, useMemo, useState } from 'react'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCol, CFormInput, CFormLabel, CFormSelect, CPagination, CPaginationItem, CRow, CSpinner } from '@coreui/react'
import {
  createManagedClubMemberHistory,
  deleteManagedClubMemberHistory,
  getManagedClubMember,
  getSportsClubManagementApiMessage,
  listManagedClubMemberHistory,
  updateManagedClubMemberHistory,
} from '../services/sportsClubManagementService'
import { formatSportsDateTime, getApprovedByLabel, getClubMembershipRoleLabel, getClubMembershipSourceLabel, getClubMembershipStatusMeta, getSportsProfileOptionLabel } from '../utils/clubMembershipUi'

const EVENT_OPTIONS = [
  { value: 'joined', label: 'Gia nhập' },
  { value: 'deactivated', label: 'Dừng hoạt động' },
  { value: 'reactivated', label: 'Hoạt động lại' },
  { value: 'left', label: 'Rời CLB' },
  { value: 'rejoined', label: 'Gia nhập lại' },
  { value: 'suspended', label: 'Tạm đình chỉ' },
]

function buildPages(currentPage, pageCount) {
  const pages = []
  if (pageCount <= 7) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }
  const left = Math.max(2, currentPage - 2)
  const right = Math.min(pageCount - 1, currentPage + 2)
  pages.push(1)
  if (left > 2) pages.push('...')
  for (let index = left; index <= right; index += 1) pages.push(index)
  if (right < pageCount - 1) pages.push('...')
  pages.push(pageCount)
  return pages
}

function getEventLabel(eventType) {
  return EVENT_OPTIONS.find((item) => item.value === String(eventType || '').trim().toLowerCase())?.label || 'Sự kiện khác'
}

export default function ManagedClubMemberHistoryManager({
  club = null,
  membership = null,
  onMembershipChange,
  readOnly = false,
  showMembershipSummary = false,
  title = 'Lịch sử CLB',
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [currentMembership, setCurrentMembership] = useState(membership)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [form, setForm] = useState({ eventType: 'joined', eventAt: new Date().toISOString().slice(0, 10), note: '' })
  const [submitting, setSubmitting] = useState(false)
  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])
  const clubId = Number(club?.id || 0)
  const membershipId = Number(membership?.id || 0)

  useEffect(() => {
    setCurrentMembership(membership)
  }, [membership])

  async function refreshMembership() {
    if (!clubId || !membershipId) return null
    const nextMembership = await getManagedClubMember(clubId, membershipId)
    setCurrentMembership(nextMembership)
    onMembershipChange?.(nextMembership)
    return nextMembership
  }

  async function load() {
    if (!clubId || !membershipId) return
    setLoading(true)
    setError('')
    try {
      const [result] = await Promise.all([
        listManagedClubMemberHistory(clubId, membershipId, { page: pagination.page, pageSize: pagination.pageSize, sort: 'eventAt:desc' }),
        refreshMembership(),
      ])
      setRows(Array.isArray(result?.rows) ? result.rows : [])
      setPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
    } catch (requestError) {
      setRows([])
      setError(getSportsClubManagementApiMessage(requestError, 'Không tải được lịch sử Membership.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [clubId, membershipId, pagination.page, pagination.pageSize])

  function openCreate() {
    setEditingItem(null)
    setForm({ eventType: 'joined', eventAt: new Date().toISOString().slice(0, 10), note: '' })
    setShowForm(true)
  }

  function openEdit(item) {
    setEditingItem(item)
    setForm({ eventType: item.eventType || 'joined', eventAt: String(item.eventAt || '').slice(0, 10), note: item.note || '' })
    setShowForm(true)
  }

  async function handleSubmit() {
    if (!form.eventType || !form.eventAt) {
      setError('Loại sự kiện và ngày hiệu lực là bắt buộc')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      let result = null
      if (editingItem?.id) {
        result = await updateManagedClubMemberHistory(clubId, membershipId, editingItem.id, { eventType: form.eventType, eventAt: form.eventAt, note: form.note || null })
      } else {
        result = await createManagedClubMemberHistory(clubId, membershipId, { eventType: form.eventType, eventAt: form.eventAt, note: form.note || null })
      }
      if (result?.membership) {
        setCurrentMembership(result.membership)
        onMembershipChange?.(result.membership)
      }
      setShowForm(false)
      await load()
    } catch (requestError) {
      setError(getSportsClubManagementApiMessage(requestError, 'Không thể lưu mốc lịch sử.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(item) {
    const confirmed = window.confirm('Xóa mốc lịch sử này có thể làm thay đổi trạng thái hiện tại của thành viên. Bạn có chắc chắn muốn tiếp tục?')
    if (!confirmed) return
    try {
      const result = await deleteManagedClubMemberHistory(clubId, membershipId, item.id)
      if (result?.membership) {
        setCurrentMembership(result.membership)
        onMembershipChange?.(result.membership)
      }
      await load()
    } catch (requestError) {
      setError(getSportsClubManagementApiMessage(requestError, 'Không thể xóa mốc lịch sử.'))
    }
  }

  return (
    <div>
      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {showMembershipSummary ? (
        <CCard className='mb-4'>
          <CCardBody>
            <CRow className='g-3'>
              <CCol md={4}><div className='small text-body-secondary'>Sports Profile</div><div className='fw-semibold'>{getSportsProfileOptionLabel(currentMembership?.sportsProfile)}</div></CCol>
              <CCol md={3}><div className='small text-body-secondary'>Member Code</div><div className='fw-semibold'>{currentMembership?.memberCode || '-'}</div></CCol>
              <CCol md={3}><div className='small text-body-secondary'>Club</div><div className='fw-semibold'>{club?.name || club?.code || '-'}</div></CCol>
              <CCol md={2}><div className='small text-body-secondary'>Trạng thái hiện tại</div><div className='fw-semibold'>{getClubMembershipStatusMeta(currentMembership?.status).label}</div></CCol>
            </CRow>
          </CCardBody>
        </CCard>
      ) : null}

      <div className='d-flex justify-content-between align-items-center gap-3 mb-3 flex-wrap'>
        <div className='fw-semibold'>{title}</div>
        {!readOnly ? <CButton color='primary' onClick={openCreate}>Thêm lịch sử</CButton> : null}
      </div>

      {showForm ? (
        <CCard className='mb-4'>
          <CCardBody>
            <CRow className='g-3'>
              <CCol md={4}><CFormLabel>Loại sự kiện *</CFormLabel><CFormSelect value={form.eventType} onChange={(event) => setForm((current) => ({ ...current, eventType: event.target.value }))} disabled={submitting}>{EVENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</CFormSelect></CCol>
              <CCol md={4}><CFormLabel>Ngày hiệu lực *</CFormLabel><CFormInput type='date' value={form.eventAt} onChange={(event) => setForm((current) => ({ ...current, eventAt: event.target.value }))} disabled={submitting} /></CCol>
              <CCol md={4}><CFormLabel>Ghi chú</CFormLabel><CFormInput value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} disabled={submitting} /></CCol>
            </CRow>
            <div className='d-flex justify-content-end gap-2 mt-3 flex-wrap'>
              <CButton color='secondary' variant='outline' onClick={() => setShowForm(false)} disabled={submitting}>Hủy</CButton>
              <CButton color='primary' onClick={handleSubmit} disabled={submitting}>{submitting ? 'Đang lưu...' : 'Lưu lịch sử'}</CButton>
            </div>
          </CCardBody>
        </CCard>
      ) : null}

      {loading ? (
        <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải lịch sử...</div>
      ) : rows.length === 0 ? (
        <CAlert color='secondary' className='mb-0'>Chưa có lịch sử.</CAlert>
      ) : (
        <>
          {rows.map((item) => {
            const fromStatus = getClubMembershipStatusMeta(item.fromStatus)
            const toStatus = getClubMembershipStatusMeta(item.toStatus)
            const oldMemberCode = item.metadata?.oldMemberCode ? String(item.metadata.oldMemberCode).trim() : ''
            const newMemberCode = item.metadata?.newMemberCode ? String(item.metadata.newMemberCode).trim() : ''
            return (
              <CCard className='mb-3' key={item.id}>
                <CCardBody>
                  <div className='d-flex justify-content-between gap-3 flex-wrap mb-2'>
                    <div className='fw-semibold'>{getEventLabel(item.eventType)}</div>
                    <div className='small text-body-secondary'>{formatSportsDateTime(item.eventAt)}</div>
                  </div>
                  <div className='d-flex gap-2 flex-wrap mb-2'>
                    <CBadge color='info'>{getClubMembershipSourceLabel(item.source)}</CBadge>
                    {item.performedBy?.id ? <CBadge color='secondary'>{getApprovedByLabel(item.performedBy)}</CBadge> : null}
                  </div>
                  {item.fromStatus || item.toStatus ? <div className='mb-2'>Trạng thái: <CBadge color={fromStatus.color}>{fromStatus.label}</CBadge> {' -> '} <CBadge color={toStatus.color}>{toStatus.label}</CBadge></div> : null}
                  {item.fromRole || item.toRole ? <div className='mb-2'>Vai trò: <strong>{getClubMembershipRoleLabel(item.fromRole)}</strong> {' -> '} <strong>{getClubMembershipRoleLabel(item.toRole)}</strong></div> : null}
                  {item.fromPositionTitle || item.toPositionTitle ? <div className='mb-2'>Chức danh: <strong>{item.fromPositionTitle || '-'}</strong> {' -> '} <strong>{item.toPositionTitle || '-'}</strong></div> : null}
                  {oldMemberCode || newMemberCode ? <div className='mb-2'>Mã thành viên: <strong>{oldMemberCode || '-'}</strong> {' -> '} <strong>{newMemberCode || '-'}</strong></div> : null}
                  {item.note ? <div style={{ whiteSpace: 'pre-wrap' }} className='mb-2'>{item.note}</div> : null}
                  {!readOnly ? (
                    <div className='d-flex gap-2 flex-wrap'>
                      <CButton size='sm' color='secondary' variant='outline' onClick={() => openEdit(item)}>Sửa</CButton>
                      <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(item)}>Xóa</CButton>
                    </div>
                  ) : null}
                </CCardBody>
              </CCard>
            )
          })}
          {pagination.pageCount > 1 ? (
            <div className='d-flex justify-content-end'>
              <CPagination>
                <CPaginationItem disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>Trước</CPaginationItem>
                {pages.map((entry, index) => entry === '...'
                  ? <CPaginationItem key={`managed-history-ellipsis-${index}`} disabled>...</CPaginationItem>
                  : <CPaginationItem key={`managed-history-page-${entry}`} active={pagination.page === entry} onClick={() => setPagination((current) => ({ ...current, page: entry }))}>{entry}</CPaginationItem>)}
                <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.pageCount, current.page + 1) }))}>Sau</CPaginationItem>
              </CPagination>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}