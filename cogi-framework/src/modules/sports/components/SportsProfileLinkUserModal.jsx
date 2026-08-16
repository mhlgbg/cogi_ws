import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCol,
  CFormInput,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import {
  getSportsProfileApiMessage,
  linkSportsProfileUser,
  listLinkableUsersForSportsProfile,
} from '../services/sportsProfileService'
import { getSportsProfileStatusMeta } from '../utils/sportsProfileUi'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function getDefaultKeyword(profile) {
  return toText(profile?.contactEmail) || toText(profile?.contactPhone) || ''
}

function getUserDisplayLabel(user) {
  if (!user) return 'User không xác định'
  return [toText(user.fullName), toText(user.username), toText(user.email)].filter(Boolean).join(' - ') || `User #${user.id}`
}

function getLinkedProfileLabel(profile) {
  if (!profile) return ''
  return [toText(profile.code), toText(profile.fullName)].filter(Boolean).join(' - ')
}

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

export default function SportsProfileLinkUserModal({ visible = false, profile = null, onClose, onLinked }) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [keywordInput, setKeywordInput] = useState('')
  const [keyword, setKeyword] = useState('')
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const [selectedUser, setSelectedUser] = useState(null)
  const profileId = Number(profile?.id || 0)
  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])

  useEffect(() => {
    if (!visible) return
    const initialKeyword = getDefaultKeyword(profile)
    setError('')
    setRows([])
    setSelectedUser(null)
    setKeywordInput(initialKeyword)
    setKeyword(initialKeyword)
    setPagination({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  }, [visible, profile])

  useEffect(() => {
    if (!visible) return undefined
    const timer = window.setTimeout(() => {
      setPagination((current) => ({ ...current, page: 1 }))
      setKeyword(keywordInput)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [keywordInput, visible])

  useEffect(() => {
    if (!visible || !profileId) return undefined
    let mounted = true

    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await listLinkableUsersForSportsProfile(profileId, {
          keyword,
          page: pagination.page,
          pageSize: pagination.pageSize,
        })
        if (!mounted) return
        const nextRows = Array.isArray(result?.rows) ? result.rows : []
        setRows(nextRows)
        setPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
        setSelectedUser((current) => {
          if (!current?.user?.id) return null
          const refreshed = nextRows.find((item) => item.user?.id === current.user.id && item.canLink)
          return refreshed || null
        })
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setSelectedUser(null)
        setError(getSportsProfileApiMessage(requestError, 'Không tải được danh sách User có thể liên kết.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => { mounted = false }
  }, [visible, profileId, keyword, pagination.page, pagination.pageSize])

  const exactSuggestions = useMemo(() => {
    const email = toText(profile?.contactEmail).toLowerCase()
    const phone = toText(profile?.contactPhone)
    return rows.filter((item) => {
      const userEmail = toText(item?.user?.email).toLowerCase()
      const userPhone = toText(item?.user?.phone)
      return (email && userEmail && email === userEmail) || (phone && userPhone && phone === userPhone)
    })
  }, [profile?.contactEmail, profile?.contactPhone, rows])

  async function handleConfirmLink() {
    if (!selectedUser?.user?.id || !selectedUser.canLink) return
    setSubmitting(true)
    setError('')
    try {
      const updated = await linkSportsProfileUser(profileId, { userId: selectedUser.user.id })
      onLinked?.(updated)
    } catch (requestError) {
      setError(getSportsProfileApiMessage(requestError, 'Không thể liên kết User với hồ sơ thể thao.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()} size='xl' scrollable>
      <CModalHeader>
        <CModalTitle>Liên kết User với hồ sơ thể thao</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        <CRow className='g-3 mb-3'>
          <CCol md={3}>
            <div className='small text-body-secondary'>Mã hồ sơ</div>
            <div className='fw-semibold'>{profile?.code || '-'}</div>
          </CCol>
          <CCol md={3}>
            <div className='small text-body-secondary'>Họ tên</div>
            <div className='fw-semibold'>{profile?.fullName || '-'}</div>
          </CCol>
          <CCol md={3}>
            <div className='small text-body-secondary'>Tên hiển thị</div>
            <div className='fw-semibold'>{profile?.displayName || '-'}</div>
          </CCol>
          <CCol md={3}>
            <div className='small text-body-secondary'>Điện thoại liên hệ</div>
            <div className='fw-semibold'>{profile?.contactPhone || '-'}</div>
          </CCol>
          <CCol md={6}>
            <div className='small text-body-secondary'>Email liên hệ</div>
            <div className='fw-semibold'>{profile?.contactEmail || '-'}</div>
          </CCol>
          <CCol md={6}>
            <div className='small text-body-secondary'>Gợi ý tìm kiếm</div>
            <div className='text-body-secondary'>Ưu tiên điền sẵn email hoặc số điện thoại của hồ sơ để admin rà soát thủ công. Hệ thống không tự động liên kết.</div>
          </CCol>
        </CRow>

        <div className='mb-3'>
          <div className='small text-body-secondary mb-1'>Tìm User</div>
          <CFormInput
            value={keywordInput}
            placeholder='Tìm theo tên, username, email, điện thoại'
            onChange={(event) => setKeywordInput(event.target.value)}
            disabled={loading || submitting}
          />
        </div>

        {exactSuggestions.length > 0 ? (
          <div className='mb-3'>
            <div className='fw-semibold mb-2'>User có khả năng phù hợp</div>
            <div className='d-flex gap-2 flex-wrap'>
              {exactSuggestions.map((item) => (
                <div key={`suggestion-${item.user?.id || item.userTenantId}`} className='border rounded p-2'>
                  <div className='fw-semibold'>{getUserDisplayLabel(item.user)}</div>
                  <div className='small text-body-secondary'>{item.user?.phone || '-'}</div>
                  <div className='small text-body-secondary'>{item.user?.email || '-'}</div>
                  {item.linkedSportsProfile ? (
                    <div className='small text-danger mt-1'>Đã liên kết: {getLinkedProfileLabel(item.linkedSportsProfile)}</div>
                  ) : (
                    <div className='small text-success mt-1'>Chưa liên kết hồ sơ thể thao</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải User trong tenant...</div>
        ) : rows.length === 0 ? (
          <CAlert color='secondary' className='mb-0'>Không tìm thấy User phù hợp trong tenant hiện tại.</CAlert>
        ) : (
          <>
            <CTable responsive hover align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>User</CTableHeaderCell>
                  <CTableHeaderCell>Username</CTableHeaderCell>
                  <CTableHeaderCell>Email</CTableHeaderCell>
                  <CTableHeaderCell>Phone</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái liên kết</CTableHeaderCell>
                  <CTableHeaderCell>Thao tác</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.map((item) => {
                  const linkedStatusMeta = item.linkedSportsProfile ? getSportsProfileStatusMeta(item.linkedSportsProfile.status) : null
                  const isSelected = selectedUser?.user?.id === item.user?.id
                  return (
                    <CTableRow key={item.user?.id || item.userTenantId} color={isSelected ? 'primary' : undefined}>
                      <CTableDataCell>
                        <div className='fw-semibold'>{item.user?.fullName || item.user?.username || '-'}</div>
                        <div className='small text-body-secondary'>{item.user?.documentId || `User #${item.user?.id || '-'}`}</div>
                      </CTableDataCell>
                      <CTableDataCell>{item.user?.username || '-'}</CTableDataCell>
                      <CTableDataCell>{item.user?.email || '-'}</CTableDataCell>
                      <CTableDataCell>{item.user?.phone || '-'}</CTableDataCell>
                      <CTableDataCell>
                        {item.linkedSportsProfile ? (
                          <>
                            <div className='d-flex gap-2 flex-wrap align-items-center'>
                              <CBadge color={linkedStatusMeta?.color || 'secondary'}>{linkedStatusMeta?.label || item.linkedSportsProfile.status}</CBadge>
                              <span>Đã liên kết: {getLinkedProfileLabel(item.linkedSportsProfile)}</span>
                            </div>
                            {item.linkBlockedReason ? <div className='small text-body-secondary mt-1'>{item.linkBlockedReason}</div> : null}
                          </>
                        ) : (
                          <CBadge color='success'>Chưa liên kết</CBadge>
                        )}
                      </CTableDataCell>
                      <CTableDataCell>
                        <CButton
                          size='sm'
                          color={isSelected ? 'primary' : 'secondary'}
                          variant={isSelected ? undefined : 'outline'}
                          disabled={!item.canLink || submitting}
                          onClick={() => setSelectedUser(item.canLink ? item : null)}
                        >
                          {isSelected ? 'Đã chọn' : 'Liên kết'}
                        </CButton>
                      </CTableDataCell>
                    </CTableRow>
                  )
                })}
              </CTableBody>
            </CTable>

            {pagination.pageCount > 1 ? (
              <div className='d-flex justify-content-end'>
                <CPagination>
                  <CPaginationItem disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>Trước</CPaginationItem>
                  {pages.map((entry, index) => entry === '...'
                    ? <CPaginationItem key={`profile-link-user-ellipsis-${index}`} disabled>...</CPaginationItem>
                    : <CPaginationItem key={`profile-link-user-page-${entry}`} active={pagination.page === entry} onClick={() => setPagination((current) => ({ ...current, page: entry }))}>{entry}</CPaginationItem>)}
                  <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.pageCount, current.page + 1) }))}>Sau</CPaginationItem>
                </CPagination>
              </div>
            ) : null}
          </>
        )}

        {selectedUser?.user?.id ? (
          <CAlert color='warning' className='mt-3 mb-0'>
            <div className='fw-semibold mb-2'>Bạn đang liên kết:</div>
            <div>Sports Profile: {getLinkedProfileLabel(profile)}</div>
            <div>User: {getUserDisplayLabel(selectedUser.user)}</div>
            <div className='mt-2'>Sau khi liên kết, User này sẽ được coi là chủ tài khoản của hồ sơ thể thao này.</div>
          </CAlert>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={submitting}>Hủy</CButton>
        <CButton color='primary' onClick={handleConfirmLink} disabled={submitting || !selectedUser?.user?.id || !selectedUser.canLink}>
          {submitting ? 'Đang liên kết...' : 'Xác nhận liên kết'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}