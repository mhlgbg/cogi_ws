import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import {
  createSurveyCampaignUserAssignment,
  deactivateSurveyCampaignUserAssignment,
  getSurveyCampaignAssignableUsers,
  getSurveyCampaignUserAssignments,
} from '../services/surveyCampaignService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function toUserLabel(item) {
  return item?.user?.fullName || item?.user?.username || item?.user?.email || `User #${item?.user?.id || ''}`
}

export default function CampaignManagerAssignmentModal({
  visible,
  campaignId,
  campaignName,
  onClose,
  onSaved,
}) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [note, setNote] = useState('')
  const [assignableUsers, setAssignableUsers] = useState([])
  const [assignedRows, setAssignedRows] = useState([])
  const [selectedUserIds, setSelectedUserIds] = useState([])

  const activeAssignedUserIds = useMemo(() => new Set(
    (assignedRows || [])
      .filter((item) => item?.assignmentStatus === 'active')
      .map((item) => Number(item?.user?.id || 0))
      .filter((value) => Number.isInteger(value) && value > 0),
  ), [assignedRows])

  async function loadAll(keyword = search) {
    if (!campaignId) return
    setLoading(true)
    setError('')
    try {
      const [assignedResponse, usersResponse] = await Promise.all([
        getSurveyCampaignUserAssignments({ campaign: campaignId }),
        getSurveyCampaignAssignableUsers({ page: 1, pageSize: 200, search: keyword }),
      ])

      const assigned = Array.isArray(assignedResponse?.data) ? assignedResponse.data : []
      const users = Array.isArray(usersResponse?.data) ? usersResponse.data : []
      setAssignedRows(assigned)
      setAssignableUsers(users)
      setSelectedUserIds((current) => current.filter((id) => users.some((item) => Number(item?.user?.id) === Number(id))))
    } catch (requestError) {
      setAssignedRows([])
      setAssignableUsers([])
      setError(getApiMessage(requestError, 'Không thể tải dữ liệu phân công quản lý.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!visible) return
    setSearch('')
    setNote('')
    setSelectedUserIds([])
    loadAll('')
  }, [visible, campaignId])

  function toggleSelectedUser(userId) {
    const normalized = Number(userId)
    if (!Number.isInteger(normalized) || normalized <= 0) return
    setSelectedUserIds((current) => (
      current.includes(normalized)
        ? current.filter((id) => id !== normalized)
        : [...current, normalized]
    ))
  }

  async function handleSearch() {
    await loadAll(search)
  }

  async function handleAssignMany() {
    if (!campaignId || selectedUserIds.length === 0 || saving) return
    setSaving(true)
    setError('')
    try {
      const failures = []
      for (const userId of selectedUserIds) {
        try {
          await createSurveyCampaignUserAssignment({
            campaign: campaignId,
            user: userId,
            note: String(note || '').trim(),
          })
        } catch (requestError) {
          failures.push(getApiMessage(requestError, `Không thể phân công user ${userId}`))
        }
      }
      await loadAll(search)
      setSelectedUserIds([])
      setNote('')
      if (failures.length > 0) {
        setError(failures[0])
      } else {
        onSaved?.()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleRevoke(item) {
    if (!item?.id || saving) return
    setSaving(true)
    setError('')
    try {
      await deactivateSurveyCampaignUserAssignment(item.id)
      await loadAll(search)
      onSaved?.()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể thu hồi phân công.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <CModal visible={visible} size='xl' backdrop='static' onClose={() => !saving && onClose?.()}>
      <CModalHeader>
        <CModalTitle>Phân công quản lý {campaignName ? `- ${campaignName}` : ''}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className='d-flex gap-2 align-items-end flex-wrap mb-3'>
          <div style={{ minWidth: 320 }}>
            <CFormLabel htmlFor='campaign-manager-search'>Tìm người dùng trong tenant</CFormLabel>
            <CFormInput
              id='campaign-manager-search'
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder='Tên, username, email...'
              disabled={loading || saving}
            />
          </div>
          <CButton color='secondary' variant='outline' onClick={handleSearch} disabled={loading || saving}>Tìm</CButton>
        </div>

        <div className='mb-3'>
          <CFormLabel htmlFor='campaign-manager-note'>Ghi chú phân công</CFormLabel>
          <CFormInput
            id='campaign-manager-note'
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder='Ghi chú cho đợt phân công'
            disabled={loading || saving}
          />
        </div>

        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        {loading ? (
          <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải dữ liệu...</div>
        ) : (
          <div className='row g-4'>
            <div className='col-md-6'>
              <h6 className='mb-2'>Người dùng khả dụng</h6>
              <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid #ddd', borderRadius: 6, padding: 12 }}>
                {assignableUsers.length === 0 ? (
                  <div className='text-body-secondary'>Không có dữ liệu người dùng.</div>
                ) : assignableUsers.map((item) => {
                  const userId = Number(item?.user?.id || 0)
                  const disabled = activeAssignedUserIds.has(userId)
                  return (
                    <div key={`assignable-${userId}`} className='mb-2'>
                      <CFormCheck
                        id={`assignable-user-${userId}`}
                        checked={selectedUserIds.includes(userId)}
                        disabled={disabled || saving}
                        onChange={() => toggleSelectedUser(userId)}
                        label={`${toUserLabel(item)}${item?.user?.email ? ` (${item.user.email})` : ''}${disabled ? ' - Đã phân công' : ''}`}
                      />
                    </div>
                  )
                })}
              </div>
            </div>

            <div className='col-md-6'>
              <h6 className='mb-2'>Người đang được phân công</h6>
              <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid #ddd', borderRadius: 6, padding: 12 }}>
                {assignedRows.length === 0 ? (
                  <div className='text-body-secondary'>Chưa phân công</div>
                ) : assignedRows
                  .filter((item) => item?.assignmentStatus === 'active')
                  .map((item) => (
                    <div key={`assigned-${item.id}`} className='d-flex justify-content-between align-items-start gap-2 mb-2'>
                      <div>
                        <div className='fw-semibold'>{toUserLabel(item)}</div>
                        <div className='small text-body-secondary'>{item?.user?.email || item?.user?.username || '-'}</div>
                      </div>
                      <CButton size='sm' color='warning' variant='outline' onClick={() => handleRevoke(item)} disabled={saving}>
                        Thu hồi
                      </CButton>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={saving}>Đóng</CButton>
        <CButton color='primary' onClick={handleAssignMany} disabled={saving || selectedUserIds.length === 0}>
          {saving ? 'Đang lưu...' : 'Phân công đã chọn'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}
