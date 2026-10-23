import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormSelect,
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
  getCampaignPostRegistrationSportsProfiles,
  linkCampaignPostRegistrationSportsProfiles,
  manualLinkCampaignPostRegistrationSportsProfile,
} from '../services/registrationCampaignApi'
import { listSportsProfiles } from '../../sports/services/sportsProfileService'
import { getApiMessage } from '../utils/registrationCampaignUi'

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

function getStatusBadge(status) {
  if (status === 'ready_to_link') return { color: 'success', label: 'Sẵn sàng liên kết' }
  if (status === 'already_linked_correct') return { color: 'info', label: 'Đã liên kết' }
  if (status === 'already_linked_different_code') return { color: 'info', label: 'Đã liên kết - khác mã khai báo' }
  if (status === 'profile_not_found') return { color: 'danger', label: 'Không tìm thấy hồ sơ' }
  if (status === 'profile_code_not_unique') return { color: 'danger', label: 'Mã trùng hoặc không duy nhất' }
  if (status === 'user_linked_to_other_profile') return { color: 'warning', label: 'User đã liên kết hồ sơ khác' }
  if (status === 'profile_linked_to_other_user') return { color: 'warning', label: 'Hồ sơ đã liên kết User khác' }
  if (status === 'not_eligible') return { color: 'secondary', label: 'Chưa đủ điều kiện' }
  return { color: 'dark', label: 'Cần kiểm tra' }
}

function StatCard({ label, value, color = 'secondary' }) {
  return (
    <CCol sm={6} xl={3}>
      <CCard className='h-100'>
        <CCardBody>
          <div className='small text-body-secondary'>{label}</div>
          <div className={`fs-4 fw-semibold text-${color}`}>{value || 0}</div>
        </CCardBody>
      </CCard>
    </CCol>
  )
}

export default function CampaignPostRegistrationTab({ campaign, onChanged }) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [rows, setRows] = useState([])
  const [task, setTask] = useState(null)
  const [stats, setStats] = useState(null)
  const [filters, setFilters] = useState({ q: '', status: '' })
  const [query, setQuery] = useState({ q: '', status: '' })
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, pageCount: 1 })
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [manualTargetRow, setManualTargetRow] = useState(null)
  const [manualSearch, setManualSearch] = useState('')
  const [manualPage, setManualPage] = useState(1)
  const [manualRows, setManualRows] = useState([])
  const [manualPagination, setManualPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const [manualSelectedProfileId, setManualSelectedProfileId] = useState(null)
  const [manualLoading, setManualLoading] = useState(false)

  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])
  const readyRows = useMemo(() => rows.filter((item) => item.canBulkLink === true), [rows])
  const selectedManualProfile = useMemo(
    () => manualRows.find((item) => Number(item.id) === Number(manualSelectedProfileId)) || null,
    [manualRows, manualSelectedProfileId],
  )

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [success])

  async function loadManualProfiles({ page = 1, search = '' } = {}) {
    if (!manualModalOpen) return
    setManualLoading(true)
    try {
      const response = await listSportsProfiles({
        page,
        pageSize: 10,
        search,
        sort: 'updatedAt:desc',
      })
      setManualRows(Array.isArray(response?.rows) ? response.rows : [])
      setManualPagination(response?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
    } catch (requestError) {
      setManualRows([])
      setManualPagination({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
      setError(getApiMessage(requestError, 'Không tải được danh sách Sports Profile.'))
    } finally {
      setManualLoading(false)
    }
  }

  async function loadData() {
    if (!campaign?.id) return
    setLoading(true)
    setError('')
    try {
      const response = await getCampaignPostRegistrationSportsProfiles(campaign.id, {
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...query,
      })
      setRows(Array.isArray(response?.data) ? response.data : [])
      setTask(response?.task || null)
      setStats(response?.stats || null)
      setPagination(response?.pagination || { page: 1, pageSize: 20, total: 0, pageCount: 1 })
      setSelectedIds((current) => {
        const next = new Set()
        for (const id of current.values()) {
          if ((response?.data || []).some((row) => Number(row.registrationId) === Number(id) && row.canBulkLink === true)) {
            next.add(id)
          }
        }
        return next
      })
    } catch (requestError) {
      setRows([])
      setTask(null)
      setStats(null)
      setError(getApiMessage(requestError, 'Không tải được dữ liệu xử lý sau đăng ký.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, pagination.page, pagination.pageSize, query])

  useEffect(() => {
    if (!manualModalOpen) return
    loadManualProfiles({ page: manualPage, search: manualSearch })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualModalOpen, manualPage, manualSearch])

  function applyFilters() {
    setPagination((prev) => ({ ...prev, page: 1 }))
    setQuery(filters)
  }

  function resetFilters() {
    const next = { q: '', status: '' }
    setFilters(next)
    setQuery(next)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  function toggleSelect(id, checked) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleSelectPage(checked) {
    setSelectedIds((current) => {
      const next = new Set(current)
      for (const row of readyRows) {
        if (checked) next.add(row.registrationId)
        else next.delete(row.registrationId)
      }
      return next
    })
  }

  async function handleLink(mode, registrationIds = []) {
    setSubmitting(true)
    setError('')
    try {
      const result = await linkCampaignPostRegistrationSportsProfiles(campaign.id, {
        mode,
        registrationIds,
      })
      const successCount = Number(result?.successCount || 0)
      const failedCount = Number(result?.failedCount || 0)
      setSuccess(`Liên kết hoàn tất: ${successCount} thành công, ${failedCount} lỗi.`)
      setSelectedIds(new Set())
      await loadData()
      onChanged?.()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể liên kết hồ sơ thể thao.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLinkSelected() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    if (!window.confirm(`Xác nhận liên kết ${ids.length} người đã chọn?`)) return
    await handleLink('selected', ids)
  }

  async function handleLinkAllReady() {
    const totalReady = Number(stats?.readyToLink || 0)
    if (totalReady <= 0) return
    if (!window.confirm(`Xác nhận liên kết toàn bộ ${totalReady} trường hợp đang sẵn sàng?`)) return
    await handleLink('all_ready')
  }

  function openManualLinkModal(row) {
    setError('')
    setManualTargetRow(row || null)
    setManualSelectedProfileId(null)
    setManualSearch('')
    setManualPage(1)
    setManualRows([])
    setManualPagination({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
    setManualModalOpen(true)
  }

  function closeManualLinkModal() {
    if (submitting) return
    setManualModalOpen(false)
    setManualTargetRow(null)
    setManualSelectedProfileId(null)
    setManualRows([])
  }

  async function handleConfirmManualLink() {
    if (!manualTargetRow?.registrationId || !manualSelectedProfileId) return
    setSubmitting(true)
    setError('')
    try {
      const result = await manualLinkCampaignPostRegistrationSportsProfile(campaign.id, {
        registrationId: manualTargetRow.registrationId,
        sportsProfileId: manualSelectedProfileId,
      })
      const linkedCode = result?.row?.sportsProfile?.code || selectedManualProfile?.code || '-'
      setSuccess(`Đã liên kết thủ công thành công với hồ sơ ${linkedCode}.`)
      closeManualLinkModal()
      await loadData()
      onChanged?.()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể liên kết thủ công hồ sơ thể thao.'))
    } finally {
      setSubmitting(false)
    }
  }

  const allReadyInPageSelected = readyRows.length > 0 && readyRows.every((row) => selectedIds.has(row.registrationId))

  return (
    <CCard>
      <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
        <strong>Xử lý sau đăng ký - Liên kết hồ sơ thể thao</strong>
        <div className='d-flex gap-2'>
          <CButton color='secondary' variant='outline' disabled={loading || submitting} onClick={loadData}>Đối soát lại</CButton>
          <CButton color='primary' variant='outline' disabled={submitting || selectedIds.size === 0} onClick={handleLinkSelected}>
            Liên kết đã chọn ({selectedIds.size})
          </CButton>
          <CButton color='success' disabled={submitting || Number(stats?.readyToLink || 0) <= 0} onClick={handleLinkAllReady}>
            Liên kết tất cả sẵn sàng ({stats?.readyToLink || 0})
          </CButton>
        </div>
      </CCardHeader>
      <CCardBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        {success ? <CAlert color='success'>{success}</CAlert> : null}

        {task && task.available !== true ? (
          <CAlert color='warning' className='mb-3'>
            <div className='fw-semibold mb-1'>Tác vụ chưa khả dụng</div>
            <div>{task.unavailableReason || 'Vui lòng cấu hình lại chiến dịch để bật tác vụ này.'}</div>
          </CAlert>
        ) : null}

        <CRow className='g-3 mb-3'>
          <StatCard label='Đăng ký đã hoàn tất' value={stats?.completedTotal || 0} />
          <StatCard label='Đã liên kết' value={stats?.alreadyLinkedTotal || stats?.alreadyLinkedCorrect || 0} color='info' />
          <StatCard label='Chờ liên kết' value={stats?.waitingToLink || 0} color='warning' />
          <StatCard label='Cần xử lý' value={stats?.needAttention || 0} color='danger' />
        </CRow>

        <CRow className='g-2 mb-3'>
          <CCol md={6}>
            <CFormInput
              placeholder='Tìm theo tên, email, điện thoại, mã thành viên, mã hồ sơ'
              value={filters.q}
              onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))}
            />
          </CCol>
          <CCol md={3}>
            <CFormSelect value={filters.status} onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}>
              <option value=''>Tất cả trạng thái</option>
              <option value='ready_to_link'>Sẵn sàng liên kết</option>
              <option value='already_linked_correct'>Đã liên kết (mã khớp)</option>
              <option value='already_linked_different_code'>Đã liên kết (khác mã/không khai báo)</option>
              <option value='profile_not_found'>Không tìm thấy hồ sơ</option>
              <option value='profile_code_not_unique'>Mã trùng/không duy nhất</option>
              <option value='user_linked_to_other_profile'>User đã liên kết hồ sơ khác</option>
              <option value='profile_linked_to_other_user'>Hồ sơ đã liên kết User khác</option>
              <option value='not_eligible'>Chưa đủ điều kiện</option>
              <option value='need_manual_review'>Cần kiểm tra</option>
            </CFormSelect>
          </CCol>
          <CCol md={3} className='d-flex gap-2'>
            <CButton color='primary' onClick={applyFilters}>Lọc</CButton>
            <CButton color='secondary' variant='outline' onClick={resetFilters}>Đặt lại</CButton>
          </CCol>
        </CRow>

        {loading ? (
          <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang đối soát dữ liệu...</div>
        ) : (
          <>
            <CTable responsive hover align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: 40 }}>
                    <CFormCheck
                      checked={allReadyInPageSelected}
                      disabled={readyRows.length === 0}
                      onChange={(event) => toggleSelectPage(event.target.checked)}
                    />
                  </CTableHeaderCell>
                  <CTableHeaderCell>Người đăng ký</CTableHeaderCell>
                  <CTableHeaderCell>User</CTableHeaderCell>
                  <CTableHeaderCell>Mã thành viên khai báo</CTableHeaderCell>
                  <CTableHeaderCell>Sports Profile</CTableHeaderCell>
                  <CTableHeaderCell>Họ tên hồ sơ thể thao</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái đối soát</CTableHeaderCell>
                  <CTableHeaderCell>Thao tác</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.length > 0 ? rows.map((row) => {
                  const statusMeta = getStatusBadge(row.reconciliationStatus)
                  const canBulkLink = row.canBulkLink === true
                  return (
                    <CTableRow key={row.registrationId}>
                      <CTableDataCell>
                        <CFormCheck
                          checked={selectedIds.has(row.registrationId)}
                          disabled={!canBulkLink || submitting}
                          onChange={(event) => toggleSelect(row.registrationId, event.target.checked)}
                        />
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className='fw-semibold'>{row.registration?.fullName || '-'}</div>
                        <div className='small text-body-secondary'>{row.registration?.email || '-'} | {row.registration?.phone || '-'}</div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <div>{row.user?.fullName || '-'}</div>
                        <div className='small text-body-secondary'>{row.user?.email || '-'}</div>
                      </CTableDataCell>
                      <CTableDataCell>{row.declaredMemberCode || '-'}</CTableDataCell>
                      <CTableDataCell>{row.sportsProfile?.code || '-'}</CTableDataCell>
                      <CTableDataCell>{row.sportsProfile?.fullName || row.sportsProfile?.displayName || '-'}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
                        {row.manualLinkTag ? <div className='small text-info mt-1'>{row.manualLinkTag}</div> : null}
                        {row.reconciliationReason ? <div className='small text-body-secondary mt-1'>{row.reconciliationReason}</div> : null}
                      </CTableDataCell>
                      <CTableDataCell>
                        <CButton
                          size='sm'
                          color='primary'
                          variant='outline'
                          disabled={row.canManualLink !== true || submitting}
                          onClick={() => openManualLinkModal(row)}
                        >
                          Liên kết
                        </CButton>
                      </CTableDataCell>
                    </CTableRow>
                  )
                }) : (
                  <CTableRow>
                    <CTableDataCell colSpan={8} className='text-center text-body-secondary'>
                      Không có dữ liệu phù hợp bộ lọc.
                    </CTableDataCell>
                  </CTableRow>
                )}
              </CTableBody>
            </CTable>

            {pagination.pageCount > 1 ? (
              <div className='d-flex justify-content-end'>
                <CPagination>
                  <CPaginationItem disabled={pagination.page <= 1} onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}>Trước</CPaginationItem>
                  {pages.map((item, index) => item === '...'
                    ? <CPaginationItem key={`ellipsis-${index}`} disabled>...</CPaginationItem>
                    : <CPaginationItem key={`page-${item}`} active={pagination.page === item} onClick={() => setPagination((prev) => ({ ...prev, page: item }))}>{item}</CPaginationItem>)}
                  <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.pageCount, prev.page + 1) }))}>Sau</CPaginationItem>
                </CPagination>
              </div>
            ) : null}
          </>
        )}

        <CModal size='xl' alignment='center' visible={manualModalOpen} onClose={closeManualLinkModal}>
          <CModalHeader>
            <CModalTitle>Liên kết thủ công Sports Profile</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CRow className='g-3 mb-3'>
              <CCol md={4}>
                <div className='small text-body-secondary'>User đích</div>
                <div className='fw-semibold'>{manualTargetRow?.user?.fullName || '-'}</div>
                <div className='small text-body-secondary'>{manualTargetRow?.user?.email || '-'} | {manualTargetRow?.user?.phone || '-'}</div>
              </CCol>
              <CCol md={4}>
                <div className='small text-body-secondary'>Mã thành viên khai báo</div>
                <div className='fw-semibold'>{manualTargetRow?.declaredMemberCode || '-'}</div>
              </CCol>
              <CCol md={4}>
                <div className='small text-body-secondary'>Sports Profile thực tế đã chọn</div>
                <div className='fw-semibold'>{selectedManualProfile?.code || '-'}</div>
                <div className='small text-body-secondary'>{selectedManualProfile?.fullName || selectedManualProfile?.displayName || '-'}</div>
              </CCol>
            </CRow>

            <CRow className='g-2 mb-3'>
              <CCol md={9}>
                <CFormInput
                  placeholder='Tìm Sports Profile theo mã hồ sơ, họ tên, email hoặc điện thoại'
                  value={manualSearch}
                  onChange={(event) => {
                    setManualSearch(event.target.value)
                    setManualPage(1)
                  }}
                />
              </CCol>
              <CCol md={3} className='d-flex justify-content-end align-items-center'>
                {manualLoading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tìm...</div> : null}
              </CCol>
            </CRow>

            <CTable responsive hover align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: 44 }} />
                  <CTableHeaderCell>Mã hồ sơ</CTableHeaderCell>
                  <CTableHeaderCell>Họ tên hồ sơ</CTableHeaderCell>
                  <CTableHeaderCell>Email liên hệ</CTableHeaderCell>
                  <CTableHeaderCell>Điện thoại liên hệ</CTableHeaderCell>
                  <CTableHeaderCell>User hiện tại</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {manualRows.length > 0 ? manualRows.map((profile) => {
                  const occupiedByOtherUser = profile?.user?.id && Number(profile.user.id) !== Number(manualTargetRow?.user?.id || 0)
                  return (
                    <CTableRow key={profile.id}>
                      <CTableDataCell>
                        <CFormCheck
                          type='radio'
                          name='manual-profile-select'
                          checked={Number(manualSelectedProfileId) === Number(profile.id)}
                          disabled={Boolean(occupiedByOtherUser) || submitting}
                          onChange={() => setManualSelectedProfileId(profile.id)}
                        />
                      </CTableDataCell>
                      <CTableDataCell>{profile.code || '-'}</CTableDataCell>
                      <CTableDataCell>{profile.fullName || profile.displayName || '-'}</CTableDataCell>
                      <CTableDataCell>{profile.contactEmail || '-'}</CTableDataCell>
                      <CTableDataCell>{profile.contactPhone || '-'}</CTableDataCell>
                      <CTableDataCell>
                        {profile.user?.id ? (
                          <>
                            <div>{profile.user?.fullName || '-'}</div>
                            <div className='small text-body-secondary'>{profile.user?.email || '-'}</div>
                          </>
                        ) : '-'}
                      </CTableDataCell>
                    </CTableRow>
                  )
                }) : (
                  <CTableRow>
                    <CTableDataCell colSpan={6} className='text-center text-body-secondary'>
                      Không tìm thấy Sports Profile phù hợp.
                    </CTableDataCell>
                  </CTableRow>
                )}
              </CTableBody>
            </CTable>

            {manualPagination.pageCount > 1 ? (
              <div className='d-flex justify-content-end'>
                <CPagination>
                  <CPaginationItem disabled={manualPage <= 1} onClick={() => setManualPage((prev) => Math.max(1, prev - 1))}>Trước</CPaginationItem>
                  {buildPages(manualPage, manualPagination.pageCount).map((item, index) => item === '...'
                    ? <CPaginationItem key={`manual-ellipsis-${index}`} disabled>...</CPaginationItem>
                    : <CPaginationItem key={`manual-page-${item}`} active={manualPage === item} onClick={() => setManualPage(item)}>{item}</CPaginationItem>)}
                  <CPaginationItem disabled={manualPage >= manualPagination.pageCount} onClick={() => setManualPage((prev) => Math.min(manualPagination.pageCount, prev + 1))}>Sau</CPaginationItem>
                </CPagination>
              </div>
            ) : null}
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={closeManualLinkModal} disabled={submitting}>Đóng</CButton>
            <CButton color='primary' onClick={handleConfirmManualLink} disabled={!manualSelectedProfileId || submitting}>
              {submitting ? 'Đang liên kết...' : 'Xác nhận liên kết'}
            </CButton>
          </CModalFooter>
        </CModal>
      </CCardBody>
    </CCard>
  )
}
