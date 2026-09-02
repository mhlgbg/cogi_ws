import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
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
  CToast,
  CToastBody,
  CToaster,
} from '@coreui/react'
import ExamErrorAlert from './ExamErrorAlert'
import ExamEligibilityImportModal from './ExamEligibilityImportModal'
import ExamEligibilityStatusBadge from './ExamEligibilityStatusBadge'
import {
  bulkCreateExamEligibilities,
  createExamEligibility,
  deleteExamEligibility,
  getExamEligibility,
  listExamEligibilities,
  listLearnersForEligibility,
  markExamEligibilityIneligible,
  updateExamEligibility,
} from '../services/examEligibilityApi'
import {
  EXAM_ELIGIBILITY_SOURCE_OPTIONS,
  EXAM_ELIGIBILITY_STATUS_OPTIONS,
  getEligibilitySourceLabel,
  getExamEligibilityApiMessage,
  mapExamEligibilityFieldErrors,
} from '../utils/examEligibilityUi'
import { formatDateTime, normalizeStatus, toText } from '../utils/examRoundUi'

function resolveEligibilityManagement(round, permissions, managementMeta) {
  if (permissions?.canManage !== true) {
    return {
      canManage: false,
      reasonCode: 'PERMISSION_DENIED',
      message: 'Bạn không có quyền quản lý đối tượng đăng ký.',
    }
  }

  if (managementMeta && managementMeta.canManage === false) {
    return {
      canManage: false,
      reasonCode: managementMeta.reasonCode || 'EXAM_ELIGIBILITY_NOT_EDITABLE',
      message: managementMeta.message || 'Đợt thi hiện không cho phép thay đổi eligibility.',
    }
  }

  if (managementMeta && managementMeta.canManage === true) {
    return {
      canManage: true,
      reasonCode: null,
      message: null,
    }
  }

  const registrationMode = normalizeStatus(round?.registrationMode)
  const status = normalizeStatus(round?.status)

  if (registrationMode !== 'restricted') {
    return {
      canManage: false,
      reasonCode: 'EXAM_ELIGIBILITY_RESTRICTED_MODE_REQUIRED',
      message: 'Đợt thi không sử dụng chế độ đăng ký có điều kiện.',
    }
  }

  if (status === 'pending_approval') {
    return {
      canManage: false,
      reasonCode: 'EXAM_ELIGIBILITY_PENDING_APPROVAL_LOCKED',
      message: 'Đợt thi đang chờ phê duyệt.',
    }
  }

  if (['draft', 'approved', 'registration_open', 'registration_paused'].includes(status)) {
    return {
      canManage: true,
      reasonCode: null,
      message: null,
    }
  }

  if (status === 'registration_closed') {
    return {
      canManage: false,
      reasonCode: 'EXAM_ELIGIBILITY_REGISTRATION_CLOSED',
      message: 'Đợt thi đã đóng đăng ký.',
    }
  }

  return {
    canManage: false,
    reasonCode: 'EXAM_ELIGIBILITY_WORKFLOW_LOCKED',
    message: 'Đợt thi đã qua giai đoạn cho phép thay đổi đối tượng đăng ký.',
  }
}

function buildPages(currentPage, pageCount) {
  const maxButtons = 7
  const pages = []
  if (pageCount <= maxButtons) {
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

function SummaryCard({ label, value }) {
  return (
    <CCard className='h-100'>
      <CCardBody>
        <div className='small text-body-secondary'>{label}</div>
        <div className='fs-5 fw-semibold'>{value}</div>
      </CCardBody>
    </CCard>
  )
}

function RegistrationSummaryCell({ summary }) {
  if (!summary?.registrationCode) return <span className='text-body-secondary'>Chưa đăng ký</span>
  return (
    <div>
      <div className='fw-semibold'>{summary.registrationCode}</div>
      <div className='small text-body-secondary'>{summary.registrationStatus || '-'}</div>
    </div>
  )
}

function EligibilityEditorModal({
  visible,
  mode,
  item,
  roundId,
  saving = false,
  submitError = '',
  fieldErrors = {},
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState({ learnerId: '', eligibilityStatus: 'eligible', source: 'manual', reason: '', note: '' })
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [lookupRows, setLookupRows] = useState([])
  const [lookupPagination, setLookupPagination] = useState({ page: 1, pageSize: 8, total: 0, pageCount: 1 })
  const [lookupSearch, setLookupSearch] = useState('')
  const [debouncedLookupSearch, setDebouncedLookupSearch] = useState('')
  const [localErrors, setLocalErrors] = useState({})

  const isCreate = mode === 'create'
  const isMarkEligible = mode === 'mark-eligible'
  const title = isCreate ? 'Thêm đối tượng đăng ký' : isMarkEligible ? 'Đánh dấu đủ điều kiện' : 'Cập nhật eligibility'
  const pages = useMemo(() => buildPages(lookupPagination.page, lookupPagination.pageCount), [lookupPagination.page, lookupPagination.pageCount])

  useEffect(() => {
    if (!visible) return
    setForm({
      learnerId: isCreate ? '' : String(item?.learner?.id || ''),
      eligibilityStatus: isMarkEligible ? 'eligible' : item?.eligibilityStatus || 'eligible',
      source: item?.source || 'manual',
      reason: item?.reason || '',
      note: item?.note || '',
    })
    setLookupSearch('')
    setDebouncedLookupSearch('')
    setLookupRows([])
    setLookupPagination({ page: 1, pageSize: 8, total: 0, pageCount: 1 })
    setLookupError('')
    setLocalErrors({})
  }, [isCreate, isMarkEligible, item, visible])

  useEffect(() => {
    if (!visible || !isCreate) return undefined
    const timer = window.setTimeout(() => setDebouncedLookupSearch(String(lookupSearch || '').trim()), 300)
    return () => window.clearTimeout(timer)
  }, [isCreate, lookupSearch, visible])

  useEffect(() => {
    if (!visible || !isCreate) return
    let mounted = true
    async function loadLookup() {
      setLookupLoading(true)
      setLookupError('')
      try {
        const result = await listLearnersForEligibility(roundId, {
          page: lookupPagination.page,
          pageSize: lookupPagination.pageSize,
          search: debouncedLookupSearch,
          excludeExisting: true,
        })
        if (!mounted) return
        setLookupRows(Array.isArray(result?.rows) ? result.rows : [])
        setLookupPagination(result?.pagination || { page: 1, pageSize: 8, total: 0, pageCount: 1 })
      } catch (requestError) {
        if (!mounted) return
        setLookupRows([])
        setLookupError(getExamEligibilityApiMessage(requestError, 'Không tải được danh sách learner.'))
      } finally {
        if (mounted) setLookupLoading(false)
      }
    }
    loadLookup()
    return () => { mounted = false }
  }, [debouncedLookupSearch, isCreate, lookupPagination.page, lookupPagination.pageSize, roundId, visible])

  function updateField(key, value) {
    setForm((current) => ({ ...current, [key]: value }))
    setLocalErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function validate() {
    const nextErrors = {}
    if (isCreate && !String(form.learnerId || '').trim()) nextErrors.learnerId = 'Bạn cần chọn learner.'
    if (!isMarkEligible && !String(form.eligibilityStatus || '').trim()) nextErrors.eligibilityStatus = 'Bạn cần chọn trạng thái.'
    const status = isMarkEligible ? 'eligible' : normalizeStatus(form.eligibilityStatus)
    if ((status === 'temporarily_ineligible' || status === 'ineligible') && !String(form.reason || '').trim()) {
      nextErrors.reason = 'Bạn cần nhập lý do.'
    }
    return nextErrors
  }

  function handleSubmit(event) {
    event.preventDefault()
    const nextErrors = validate()
    setLocalErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    const payload = isCreate
      ? {
          learnerId: Number(form.learnerId),
          eligibilityStatus: normalizeStatus(form.eligibilityStatus) || 'eligible',
          source: normalizeStatus(form.source) || 'manual',
          reason: toText(form.reason) || null,
          note: toText(form.note) || null,
        }
      : {
          eligibilityStatus: isMarkEligible ? 'eligible' : normalizeStatus(form.eligibilityStatus) || 'pending',
          reason: toText(form.reason) || null,
          note: toText(form.note) || null,
        }
    onSubmit?.(payload)
  }

  const errors = { ...localErrors, ...fieldErrors }

  return (
    <CModal visible={visible} onClose={() => !saving && onClose?.()} size='xl' backdrop='static' scrollable>
      <CModalHeader>
        <CModalTitle>{title}</CModalTitle>
      </CModalHeader>
      <form onSubmit={handleSubmit}>
        <CModalBody>
          {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}

          {!isCreate ? (
            <div className='mb-3'>
              <div className='small text-body-secondary'>Learner</div>
              <div className='fw-semibold'>{item?.learner?.fullName || '-'}</div>
              <div className='small text-body-secondary'>{item?.learner?.code || '-'}</div>
            </div>
          ) : null}

          {isCreate ? (
            <>
              <CRow className='g-3 mb-3'>
                <CCol md={8}>
                  <CFormLabel>Tìm learner</CFormLabel>
                  <CFormInput value={lookupSearch} onChange={(event) => { setLookupSearch(event.target.value); setLookupPagination((current) => ({ ...current, page: 1 })) }} placeholder='Tìm theo mã, họ tên hoặc số điện thoại phụ huynh' disabled={saving} />
                </CCol>
                <CCol md={4}>
                  <CFormLabel>Trạng thái ban đầu</CFormLabel>
                  <CFormSelect value={form.eligibilityStatus} onChange={(event) => updateField('eligibilityStatus', event.target.value)} disabled={saving} invalid={Boolean(errors.eligibilityStatus)}>
                    {EXAM_ELIGIBILITY_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </CFormSelect>
                  {errors.eligibilityStatus ? <div className='text-danger small mt-1'>{errors.eligibilityStatus}</div> : null}
                </CCol>
              </CRow>

              <CRow className='g-3 mb-3'>
                <CCol md={6}>
                  <CFormLabel>Nguồn</CFormLabel>
                  <CFormSelect value={form.source} onChange={(event) => updateField('source', event.target.value)} disabled={saving}>
                    {EXAM_ELIGIBILITY_SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </CFormSelect>
                </CCol>
              </CRow>

              {lookupError ? <CAlert color='warning'>{lookupError}</CAlert> : null}
              {errors.learnerId ? <div className='text-danger small mb-2'>{errors.learnerId}</div> : null}
              {lookupLoading ? <div className='d-flex align-items-center gap-2 mb-3'><CSpinner size='sm' />Đang tải learner...</div> : null}
              <CTable responsive hover align='middle'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell style={{ width: 56 }}>Chọn</CTableHeaderCell>
                    <CTableHeaderCell>Mã learner</CTableHeaderCell>
                    <CTableHeaderCell>Họ tên</CTableHeaderCell>
                    <CTableHeaderCell>Ngày sinh</CTableHeaderCell>
                    <CTableHeaderCell>Đăng ký</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {lookupRows.length > 0 ? lookupRows.map((learner) => (
                    <CTableRow key={learner.id}>
                      <CTableDataCell><CFormCheck type='radio' name='eligibility-learner' checked={String(form.learnerId) === String(learner.id)} onChange={() => updateField('learnerId', String(learner.id))} /></CTableDataCell>
                      <CTableDataCell>{learner.code || '-'}</CTableDataCell>
                      <CTableDataCell>
                        <div className='fw-semibold'>{learner.fullName || '-'}</div>
                        <div className='small text-body-secondary'>{learner.learnerStatus || '-'}</div>
                      </CTableDataCell>
                      <CTableDataCell>{learner.dateOfBirth || '-'}</CTableDataCell>
                      <CTableDataCell>{learner.registrationSummary?.registrationCode || 'Chưa đăng ký'}</CTableDataCell>
                    </CTableRow>
                  )) : (
                    <CTableRow>
                      <CTableDataCell colSpan={5} className='text-center text-body-secondary'>Không còn learner phù hợp để thêm.</CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>

              {lookupPagination.pageCount > 1 ? (
                <div className='d-flex justify-content-end'>
                  <CPagination>
                    <CPaginationItem disabled={lookupPagination.page <= 1} onClick={() => setLookupPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>Trước</CPaginationItem>
                    {pages.map((entry, index) => entry === '...'
                      ? <CPaginationItem key={`lookup-ellipsis-${index}`} disabled>...</CPaginationItem>
                      : <CPaginationItem key={`lookup-page-${entry}`} active={lookupPagination.page === entry} onClick={() => setLookupPagination((current) => ({ ...current, page: entry }))}>{entry}</CPaginationItem>)}
                    <CPaginationItem disabled={lookupPagination.page >= lookupPagination.pageCount} onClick={() => setLookupPagination((current) => ({ ...current, page: Math.min(current.pageCount, current.page + 1) }))}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              ) : null}
            </>
          ) : (
            <>
              {!isMarkEligible ? (
                <div className='mb-3'>
                  <CFormLabel>Trạng thái</CFormLabel>
                  <CFormSelect value={form.eligibilityStatus} onChange={(event) => updateField('eligibilityStatus', event.target.value)} disabled={saving} invalid={Boolean(errors.eligibilityStatus)}>
                    {EXAM_ELIGIBILITY_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </CFormSelect>
                  {errors.eligibilityStatus ? <div className='text-danger small mt-1'>{errors.eligibilityStatus}</div> : null}
                </div>
              ) : <CAlert color='info'>Bản ghi này sẽ được chuyển về trạng thái đủ điều kiện. Thao tác này không tự tạo hồ sơ đăng ký.</CAlert>}
            </>
          )}

          <div className='mb-3'>
            <CFormLabel>Lý do</CFormLabel>
            <CFormTextarea rows={3} value={form.reason} onChange={(event) => updateField('reason', event.target.value)} disabled={saving} invalid={Boolean(errors.reason)} placeholder='Nhập lý do nếu có' />
            {errors.reason ? <div className='text-danger small mt-1'>{errors.reason}</div> : null}
          </div>
          <div>
            <CFormLabel>Ghi chú</CFormLabel>
            <CFormTextarea rows={3} value={form.note} onChange={(event) => updateField('note', event.target.value)} disabled={saving} placeholder='Ghi chú nội bộ nếu cần' />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={onClose} disabled={saving}>Đóng</CButton>
          <CButton color='primary' type='submit' disabled={saving}>{saving ? 'Đang lưu...' : isCreate ? 'Thêm đối tượng' : 'Lưu cập nhật'}</CButton>
        </CModalFooter>
      </form>
    </CModal>
  )
}

function EligibilityBulkModal({ visible, roundId, saving = false, submitError = '', onClose, onSubmit }) {
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [lookupRows, setLookupRows] = useState([])
  const [lookupPagination, setLookupPagination] = useState({ page: 1, pageSize: 8, total: 0, pageCount: 1 })
  const [lookupSearch, setLookupSearch] = useState('')
  const [debouncedLookupSearch, setDebouncedLookupSearch] = useState('')
  const [selectedMap, setSelectedMap] = useState({})
  const [status, setStatus] = useState('eligible')
  const [source, setSource] = useState('manual')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [localError, setLocalError] = useState('')

  const pages = useMemo(() => buildPages(lookupPagination.page, lookupPagination.pageCount), [lookupPagination.page, lookupPagination.pageCount])
  const selectedItems = Object.values(selectedMap)

  useEffect(() => {
    if (!visible) return
    setLookupSearch('')
    setDebouncedLookupSearch('')
    setLookupRows([])
    setLookupPagination({ page: 1, pageSize: 8, total: 0, pageCount: 1 })
    setSelectedMap({})
    setStatus('eligible')
    setSource('manual')
    setReason('')
    setNote('')
    setLookupError('')
    setLocalError('')
  }, [visible])

  useEffect(() => {
    if (!visible) return undefined
    const timer = window.setTimeout(() => setDebouncedLookupSearch(String(lookupSearch || '').trim()), 300)
    return () => window.clearTimeout(timer)
  }, [lookupSearch, visible])

  useEffect(() => {
    if (!visible) return
    let mounted = true
    async function loadLookup() {
      setLookupLoading(true)
      setLookupError('')
      try {
        const result = await listLearnersForEligibility(roundId, {
          page: lookupPagination.page,
          pageSize: lookupPagination.pageSize,
          search: debouncedLookupSearch,
          excludeExisting: true,
        })
        if (!mounted) return
        setLookupRows(Array.isArray(result?.rows) ? result.rows : [])
        setLookupPagination(result?.pagination || { page: 1, pageSize: 8, total: 0, pageCount: 1 })
      } catch (requestError) {
        if (!mounted) return
        setLookupRows([])
        setLookupError(getExamEligibilityApiMessage(requestError, 'Không tải được danh sách learner.'))
      } finally {
        if (mounted) setLookupLoading(false)
      }
    }
    loadLookup()
    return () => { mounted = false }
  }, [debouncedLookupSearch, lookupPagination.page, lookupPagination.pageSize, roundId, visible])

  function toggleLearner(learner, checked) {
    setSelectedMap((current) => {
      const next = { ...current }
      if (checked) next[learner.id] = learner
      else delete next[learner.id]
      return next
    })
  }

  function handleSubmit() {
    if (selectedItems.length === 0) {
      setLocalError('Bạn cần chọn ít nhất một learner.')
      return
    }
    if ((status === 'temporarily_ineligible' || status === 'ineligible') && !String(reason || '').trim()) {
      setLocalError('Bạn cần nhập lý do cho trạng thái này.')
      return
    }
    onSubmit?.({
      source,
      duplicateHandling: 'skip',
      items: selectedItems.map((learner) => ({
        learnerId: learner.id,
        eligibilityStatus: status,
        reason: toText(reason) || null,
        note: toText(note) || null,
      })),
    })
  }

  return (
    <CModal visible={visible} onClose={() => !saving && onClose?.()} size='xl' backdrop='static' scrollable>
      <CModalHeader>
        <CModalTitle>Thêm hàng loạt đối tượng đăng ký</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
        {localError ? <CAlert color='danger'>{localError}</CAlert> : null}

        <CRow className='g-3 mb-3'>
          <CCol md={6}>
            <CFormLabel>Tìm learner</CFormLabel>
            <CFormInput value={lookupSearch} onChange={(event) => { setLookupSearch(event.target.value); setLookupPagination((current) => ({ ...current, page: 1 })) }} placeholder='Tìm theo mã, họ tên hoặc số điện thoại phụ huynh' disabled={saving} />
          </CCol>
          <CCol md={3}>
            <CFormLabel>Trạng thái chung</CFormLabel>
            <CFormSelect value={status} onChange={(event) => setStatus(event.target.value)} disabled={saving}>
              {EXAM_ELIGIBILITY_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </CFormSelect>
          </CCol>
          <CCol md={3}>
            <CFormLabel>Nguồn</CFormLabel>
            <CFormSelect value={source} onChange={(event) => setSource(event.target.value)} disabled={saving}>
              {EXAM_ELIGIBILITY_SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </CFormSelect>
          </CCol>
        </CRow>

        <CRow className='g-3 mb-3'>
          <CCol md={6}>
            <CFormLabel>Lý do chung</CFormLabel>
            <CFormTextarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} disabled={saving} placeholder='Nhập lý do nếu cần' />
          </CCol>
          <CCol md={6}>
            <CFormLabel>Ghi chú chung</CFormLabel>
            <CFormTextarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} disabled={saving} placeholder='Ghi chú nội bộ nếu cần' />
          </CCol>
        </CRow>

        <div className='small text-body-secondary mb-3'>Đã chọn {selectedItems.length} learner.</div>
        {lookupError ? <CAlert color='warning'>{lookupError}</CAlert> : null}
        {lookupLoading ? <div className='d-flex align-items-center gap-2 mb-3'><CSpinner size='sm' />Đang tải learner...</div> : null}
        <CTable responsive hover align='middle'>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell style={{ width: 56 }}>Chọn</CTableHeaderCell>
              <CTableHeaderCell>Mã learner</CTableHeaderCell>
              <CTableHeaderCell>Họ tên</CTableHeaderCell>
              <CTableHeaderCell>Ngày sinh</CTableHeaderCell>
              <CTableHeaderCell>Đăng ký</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {lookupRows.length > 0 ? lookupRows.map((learner) => (
              <CTableRow key={learner.id}>
                <CTableDataCell><CFormCheck checked={Boolean(selectedMap[learner.id])} onChange={(event) => toggleLearner(learner, event.target.checked)} /></CTableDataCell>
                <CTableDataCell>{learner.code || '-'}</CTableDataCell>
                <CTableDataCell>{learner.fullName || '-'}</CTableDataCell>
                <CTableDataCell>{learner.dateOfBirth || '-'}</CTableDataCell>
                <CTableDataCell>{learner.registrationSummary?.registrationCode || 'Chưa đăng ký'}</CTableDataCell>
              </CTableRow>
            )) : (
              <CTableRow>
                <CTableDataCell colSpan={5} className='text-center text-body-secondary'>Không còn learner phù hợp để thêm.</CTableDataCell>
              </CTableRow>
            )}
          </CTableBody>
        </CTable>

        {lookupPagination.pageCount > 1 ? (
          <div className='d-flex justify-content-end'>
            <CPagination>
              <CPaginationItem disabled={lookupPagination.page <= 1} onClick={() => setLookupPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>Trước</CPaginationItem>
              {pages.map((entry, index) => entry === '...'
                ? <CPaginationItem key={`bulk-ellipsis-${index}`} disabled>...</CPaginationItem>
                : <CPaginationItem key={`bulk-page-${entry}`} active={lookupPagination.page === entry} onClick={() => setLookupPagination((current) => ({ ...current, page: entry }))}>{entry}</CPaginationItem>)}
              <CPaginationItem disabled={lookupPagination.page >= lookupPagination.pageCount} onClick={() => setLookupPagination((current) => ({ ...current, page: Math.min(current.pageCount, current.page + 1) }))}>Sau</CPaginationItem>
            </CPagination>
          </div>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={saving}>Đóng</CButton>
        <CButton color='primary' onClick={handleSubmit} disabled={saving}>{saving ? 'Đang xử lý...' : 'Thêm hàng loạt'}</CButton>
      </CModalFooter>
    </CModal>
  )
}

function EligibilityDetailModal({ visible, loading = false, error = '', item, onClose }) {
  return (
    <CModal visible={visible} onClose={onClose} size='lg' scrollable>
      <CModalHeader>
        <CModalTitle>Chi tiết eligibility</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {loading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải chi tiết...</div> : null}
        {!loading && error ? <CAlert color='danger'>{error}</CAlert> : null}
        {!loading && !error && item ? (
          <div className='d-flex flex-column gap-3'>
            <div>
              <div className='small text-body-secondary'>Learner</div>
              <div className='fw-semibold'>{item.learner?.fullName || '-'}</div>
              <div className='small text-body-secondary'>{item.learner?.code || '-'}</div>
            </div>
            <CRow className='g-3'>
              <CCol md={6}><div className='small text-body-secondary'>Trạng thái</div><div>{item.eligibilityStatus || '-'}</div></CCol>
              <CCol md={6}><div className='small text-body-secondary'>Nguồn</div><div>{getEligibilitySourceLabel(item.source)}</div></CCol>
              <CCol md={6}><div className='small text-body-secondary'>Ngày xác định</div><div>{formatDateTime(item.reviewedAt)}</div></CCol>
              <CCol md={6}><div className='small text-body-secondary'>Người thao tác</div><div>{item.reviewedBy?.fullName || item.reviewedBy?.username || item.reviewedBy?.email || '-'}</div></CCol>
              <CCol xs={12}><div className='small text-body-secondary'>Lý do</div><div style={{ whiteSpace: 'pre-wrap' }}>{item.reason || '-'}</div></CCol>
              <CCol xs={12}><div className='small text-body-secondary'>Ghi chú</div><div style={{ whiteSpace: 'pre-wrap' }}>{item.note || '-'}</div></CCol>
              <CCol md={6}><div className='small text-body-secondary'>Tạo lúc</div><div>{formatDateTime(item.createdAt)}</div></CCol>
              <CCol md={6}><div className='small text-body-secondary'>Cập nhật lúc</div><div>{formatDateTime(item.updatedAt)}</div></CCol>
            </CRow>
            <div className='border rounded p-3 bg-body-tertiary'>
              <div className='fw-semibold mb-2'>Tóm tắt hồ sơ đăng ký</div>
              {item.registrationSummary?.registrationCode ? (
                <>
                  <div>Mã hồ sơ: {item.registrationSummary.registrationCode}</div>
                  <div>Trạng thái hồ sơ: {item.registrationSummary.registrationStatus || '-'}</div>
                  <div>Trạng thái thanh toán: {item.registrationSummary.paymentStatus || '-'}</div>
                  <div>Thời điểm đăng ký: {formatDateTime(item.registrationSummary.registeredAt)}</div>
                  <div>Số tiền phải nộp: {formatMoney(item.registrationSummary.payableAmount)} VND</div>
                </>
              ) : <div className='text-body-secondary'>Chưa đăng ký.</div>}
            </div>
          </div>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose}>Đóng</CButton>
      </CModalFooter>
    </CModal>
  )
}

function MarkIneligibleModal({ visible, item, saving = false, submitError = '', fieldErrors = {}, onClose, onSubmit }) {
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (!visible) return
    setReason('')
    setNote(item?.note || '')
    setLocalError('')
  }, [item, visible])

  function handleSubmit() {
    if (!String(reason || '').trim()) {
      setLocalError('Bạn cần nhập lý do.')
      return
    }
    onSubmit?.({ reason: toText(reason), note: toText(note) || null })
  }

  return (
    <CModal visible={visible} onClose={() => !saving && onClose?.()} backdrop='static'>
      <CModalHeader>
        <CModalTitle>Đánh dấu không đủ điều kiện</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {submitError ? <CAlert color='danger'>{submitError}</CAlert> : null}
        {localError || fieldErrors.reason ? <CAlert color='danger'>{localError || fieldErrors.reason}</CAlert> : null}
        <div className='mb-3'>
          <div className='small text-body-secondary'>Learner</div>
          <div className='fw-semibold'>{item?.learner?.fullName || '-'}</div>
          <div className='small text-body-secondary'>{item?.learner?.code || '-'}</div>
        </div>
        <CAlert color='warning'>Thao tác này không tự hủy hồ sơ đăng ký đã có. Các hồ sơ đăng ký liên quan cần được xử lý theo quy trình riêng.</CAlert>
        <div className='mb-3'>
          <CFormLabel>Lý do</CFormLabel>
          <CFormTextarea rows={3} value={reason} onChange={(event) => { setReason(event.target.value); setLocalError('') }} disabled={saving} placeholder='Nhập lý do không đủ điều kiện' />
        </div>
        <div>
          <CFormLabel>Ghi chú</CFormLabel>
          <CFormTextarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} disabled={saving} placeholder='Ghi chú nội bộ nếu cần' />
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={saving}>Đóng</CButton>
        <CButton color='danger' onClick={handleSubmit} disabled={saving}>{saving ? 'Đang cập nhật...' : 'Đánh dấu không đủ điều kiện'}</CButton>
      </CModalFooter>
    </CModal>
  )
}

export default function ExamRoundEligibilitiesTab({ round, permissions }) {
  const roundId = round?.id
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const [summary, setSummary] = useState({ pending: 0, eligible: 0, temporarilyIneligible: 0, ineligible: 0, registered: 0, notRegistered: 0 })
  const [managementMeta, setManagementMeta] = useState(null)
  const [filters, setFilters] = useState({ search: '', eligibilityStatus: '', source: '', registrationState: '' })
  const [appliedFilters, setAppliedFilters] = useState({ search: '', eligibilityStatus: '', source: '', registrationState: '' })
  const [refreshToken, setRefreshToken] = useState(0)
  const [toast, setToast] = useState({ visible: false, color: 'success', message: '' })
  const [editorState, setEditorState] = useState({ open: false, mode: 'create', item: null, error: '', fieldErrors: {}, saving: false })
  const [bulkState, setBulkState] = useState({ open: false, error: '', saving: false })
  const [importState, setImportState] = useState({ open: false })
  const [detailState, setDetailState] = useState({ open: false, id: null, item: null, loading: false, error: '' })
  const [markIneligibleState, setMarkIneligibleState] = useState({ open: false, item: null, error: '', fieldErrors: {}, saving: false })

  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])
  const totalEligibilities = summary.pending + summary.eligible + summary.temporarilyIneligible + summary.ineligible
  const management = useMemo(() => resolveEligibilityManagement(round, permissions, managementMeta), [managementMeta, permissions, round])
  const canManageEligibility = management.canManage === true

  useEffect(() => {
    if (!toast.visible) return undefined
    const timer = window.setTimeout(() => setToast((current) => ({ ...current, visible: false })), 2500)
    return () => window.clearTimeout(timer)
  }, [toast.visible])

  useEffect(() => {
    let mounted = true
    async function load() {
      if (!roundId) return
      setLoading(true)
      setError('')
      try {
        const result = await listExamEligibilities(roundId, {
          page: pagination.page,
          pageSize: pagination.pageSize,
          ...appliedFilters,
        })
        if (!mounted) return
        setRows(Array.isArray(result?.rows) ? result.rows : [])
        setPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
        setSummary(result?.summary || { pending: 0, eligible: 0, temporarilyIneligible: 0, ineligible: 0, registered: 0, notRegistered: 0 })
        setManagementMeta(result?.management || null)
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setManagementMeta(null)
        setError(getExamEligibilityApiMessage(requestError, 'Không tải được danh sách đối tượng đăng ký.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [appliedFilters, pagination.page, pagination.pageSize, refreshToken, roundId])

  function reload() {
    setRefreshToken((current) => current + 1)
  }

  function applyFilters() {
    setPagination((current) => ({ ...current, page: 1 }))
    setAppliedFilters(filters)
  }

  function resetFilters() {
    const next = { search: '', eligibilityStatus: '', source: '', registrationState: '' }
    setFilters(next)
    setAppliedFilters(next)
    setPagination((current) => ({ ...current, page: 1 }))
  }

  function openCreate() {
    setEditorState({ open: true, mode: 'create', item: null, error: '', fieldErrors: {}, saving: false })
  }

  function openEdit(item) {
    setEditorState({ open: true, mode: 'update', item, error: '', fieldErrors: {}, saving: false })
  }

  function openMarkEligible(item) {
    setEditorState({ open: true, mode: 'mark-eligible', item, error: '', fieldErrors: {}, saving: false })
  }

  function closeEditor() {
    if (editorState.saving) return
    setEditorState({ open: false, mode: 'create', item: null, error: '', fieldErrors: {}, saving: false })
  }

  function openBulk() {
    setBulkState({ open: true, error: '', saving: false })
  }

  function closeBulk() {
    if (bulkState.saving) return
    setBulkState({ open: false, error: '', saving: false })
  }

  function openImport() {
    setImportState({ open: true })
  }

  function closeImport() {
    setImportState({ open: false })
  }

  async function openDetail(item) {
    setDetailState({ open: true, id: item.id, item: null, loading: true, error: '' })
    try {
      const detail = await getExamEligibility(roundId, item.id)
      setDetailState({ open: true, id: item.id, item: detail, loading: false, error: '' })
    } catch (requestError) {
      setDetailState({ open: true, id: item.id, item: null, loading: false, error: getExamEligibilityApiMessage(requestError, 'Không tải được chi tiết eligibility.') })
    }
  }

  function closeDetail() {
    setDetailState({ open: false, id: null, item: null, loading: false, error: '' })
  }

  function openMarkIneligible(item) {
    setMarkIneligibleState({ open: true, item, error: '', fieldErrors: {}, saving: false })
  }

  function closeMarkIneligible() {
    if (markIneligibleState.saving) return
    setMarkIneligibleState({ open: false, item: null, error: '', fieldErrors: {}, saving: false })
  }

  async function handleEditorSubmit(payload) {
    setEditorState((current) => ({ ...current, saving: true, error: '', fieldErrors: {} }))
    try {
      if (editorState.mode === 'create') {
        await createExamEligibility(roundId, payload)
        setToast({ visible: true, color: 'success', message: 'Đã thêm learner vào danh sách eligibility.' })
      } else {
        await updateExamEligibility(roundId, editorState.item.id, payload)
        setToast({ visible: true, color: 'success', message: editorState.mode === 'mark-eligible' ? 'Đã đánh dấu đủ điều kiện.' : 'Đã cập nhật eligibility.' })
      }
      closeEditor()
      reload()
      if (detailState.open && detailState.id === editorState.item?.id) openDetail(editorState.item)
    } catch (requestError) {
      setEditorState((current) => ({
        ...current,
        saving: false,
        error: getExamEligibilityApiMessage(requestError, 'Không thể lưu eligibility.'),
        fieldErrors: mapExamEligibilityFieldErrors(requestError),
      }))
      return
    }
    setEditorState((current) => ({ ...current, saving: false }))
  }

  async function handleBulkSubmit(payload) {
    setBulkState((current) => ({ ...current, saving: true, error: '' }))
    try {
      const result = await bulkCreateExamEligibilities(roundId, payload)
      const summaryText = `Nhận ${result?.summary?.received || 0}, tạo ${result?.summary?.created || 0}, cập nhật ${result?.summary?.updated || 0}, bỏ qua ${result?.summary?.skipped || 0}.`
      setToast({ visible: true, color: 'success', message: `Đã xử lý thêm hàng loạt eligibility. ${summaryText}` })
      closeBulk()
      reload()
    } catch (requestError) {
      setBulkState((current) => ({ ...current, saving: false, error: getExamEligibilityApiMessage(requestError, 'Không thể thêm hàng loạt eligibility.') }))
      return
    }
    setBulkState((current) => ({ ...current, saving: false }))
  }

  async function handleMarkIneligibleSubmit(payload) {
    setMarkIneligibleState((current) => ({ ...current, saving: true, error: '', fieldErrors: {} }))
    try {
      const result = await markExamEligibilityIneligible(roundId, markIneligibleState.item.id, payload)
      const warnings = Array.isArray(result?.warnings) ? result.warnings : []
      setToast({ visible: true, color: warnings.length > 0 ? 'warning' : 'success', message: warnings.length > 0 ? `Đã đánh dấu không đủ điều kiện. ${warnings.map((item) => item.message).join(' ')}` : 'Đã đánh dấu không đủ điều kiện.' })
      closeMarkIneligible()
      reload()
      if (detailState.open && detailState.id === markIneligibleState.item?.id) openDetail(markIneligibleState.item)
    } catch (requestError) {
      setMarkIneligibleState((current) => ({
        ...current,
        saving: false,
        error: getExamEligibilityApiMessage(requestError, 'Không thể đánh dấu không đủ điều kiện.'),
        fieldErrors: mapExamEligibilityFieldErrors(requestError),
      }))
      return
    }
    setMarkIneligibleState((current) => ({ ...current, saving: false }))
  }

  async function handleDelete(item) {
    if (!canManageEligibility) return
    const confirmed = window.confirm(`Xóa learner ${item?.learner?.fullName || item?.learner?.code || ''} khỏi danh sách eligibility?`)
    if (!confirmed) return

    try {
      await deleteExamEligibility(roundId, item.id)
      setToast({ visible: true, color: 'success', message: 'Đã xóa learner khỏi danh sách eligibility.' })
      reload()
      if (detailState.open && detailState.id === item.id) closeDetail()
    } catch (requestError) {
      setToast({ visible: true, color: 'danger', message: getExamEligibilityApiMessage(requestError, 'Không thể xóa eligibility.') })
    }
  }

  function handleImportCompleted(result) {
    closeImport()
    reload()
    setToast({
      visible: true,
      color: 'success',
      message: `Đã nhập ${result?.imported || 0} đối tượng: ${result?.created || 0} tạo mới, ${result?.updated || 0} cập nhật, ${result?.skipped || 0} không thay đổi.`,
    })
  }

  const registrationMode = normalizeStatus(round?.registrationMode)

  return (
    <>
      <CRow className='g-3 mb-4'>
        <CCol md={3} sm={6}><SummaryCard label='Tổng đối tượng' value={totalEligibilities} /></CCol>
        <CCol md={3} sm={6}><SummaryCard label='Đủ điều kiện' value={summary.eligible} /></CCol>
        <CCol md={3} sm={6}><SummaryCard label='Không đủ điều kiện' value={summary.ineligible + summary.temporarilyIneligible} /></CCol>
        <CCol md={3} sm={6}><SummaryCard label='Đã đăng ký' value={summary.registered} /></CCol>
      </CRow>

      <CCard>
        <CCardHeader className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
          <div>
            <div className='fw-semibold'>Đối tượng đăng ký</div>
            <div className='small text-body-secondary'>Quản lý danh sách learner đủ điều kiện đăng ký dự thi trong các đợt sử dụng chế độ giới hạn đối tượng.</div>
          </div>
          <div className='d-flex gap-2 flex-wrap'>
            <CButton color='secondary' variant='outline' onClick={reload} disabled={loading}>Tải lại</CButton>
            {permissions?.canManage === true ? <CButton color='primary' onClick={openCreate} disabled={!canManageEligibility}>Thêm đối tượng</CButton> : null}
            {permissions?.canManage === true ? <CButton color='primary' variant='outline' onClick={openBulk} disabled={!canManageEligibility}>Thêm hàng loạt</CButton> : null}
            {permissions?.canManage === true || permissions?.canApprove === true ? <CButton color='secondary' variant='outline' onClick={openImport}>Tải file mẫu / Nhập Excel</CButton> : null}
          </div>
        </CCardHeader>
        <CCardBody>
          {registrationMode === 'restricted' ? <CAlert color='info'>Chỉ learner có eligibility hợp lệ mới được đăng ký.</CAlert> : null}
          {registrationMode === 'open' ? <CAlert color='warning'>Đợt thi đang ở chế độ mở. Eligibility không bắt buộc để learner đăng ký, nhưng có thể được dùng để quản lý hoặc theo dõi nếu backend hỗ trợ.</CAlert> : null}
          {!canManageEligibility && management.message ? <CAlert color='warning'>{management.message}</CAlert> : null}

          <CRow className='g-3 mb-3'>
            <CCol lg={4} md={6}>
              <CFormLabel>Tìm learner</CFormLabel>
              <CFormInput value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder='Mã learner, họ tên hoặc số điện thoại phụ huynh' />
            </CCol>
            <CCol lg={2} md={6}>
              <CFormLabel>Trạng thái</CFormLabel>
              <CFormSelect value={filters.eligibilityStatus} onChange={(event) => setFilters((current) => ({ ...current, eligibilityStatus: event.target.value }))}>
                <option value=''>Tất cả</option>
                {EXAM_ELIGIBILITY_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </CFormSelect>
            </CCol>
            <CCol lg={2} md={6}>
              <CFormLabel>Nguồn</CFormLabel>
              <CFormSelect value={filters.source} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))}>
                <option value=''>Tất cả</option>
                {EXAM_ELIGIBILITY_SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </CFormSelect>
            </CCol>
            <CCol lg={2} md={6}>
              <CFormLabel>Đăng ký</CFormLabel>
              <CFormSelect value={filters.registrationState} onChange={(event) => setFilters((current) => ({ ...current, registrationState: event.target.value }))}>
                <option value=''>Tất cả</option>
                <option value='registered'>Đã đăng ký</option>
                <option value='unregistered'>Chưa đăng ký</option>
              </CFormSelect>
            </CCol>
          </CRow>

          <div className='d-flex gap-2 mb-3 flex-wrap'>
            <CButton color='primary' onClick={applyFilters}>Lọc</CButton>
            <CButton color='secondary' variant='outline' onClick={resetFilters}>Đặt lại</CButton>
          </div>

          {error ? <CAlert color='danger'>{error}</CAlert> : null}
          {loading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải danh sách đối tượng đăng ký...</div> : null}

          {!loading ? (
            <>
              <CTable responsive hover align='middle'>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Mã learner</CTableHeaderCell>
                    <CTableHeaderCell>Họ tên</CTableHeaderCell>
                    <CTableHeaderCell>Ngày sinh</CTableHeaderCell>
                    <CTableHeaderCell>Trạng thái eligibility</CTableHeaderCell>
                    <CTableHeaderCell>Lý do</CTableHeaderCell>
                    <CTableHeaderCell>Ngày xác định</CTableHeaderCell>
                    <CTableHeaderCell>Đã đăng ký</CTableHeaderCell>
                    <CTableHeaderCell>Người thao tác</CTableHeaderCell>
                    <CTableHeaderCell>Thao tác</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {rows.length > 0 ? rows.map((row) => (
                    <CTableRow key={row.id}>
                      <CTableDataCell>{row.learner?.code || '-'}</CTableDataCell>
                      <CTableDataCell>
                        <div className='fw-semibold'>{row.learner?.fullName || '-'}</div>
                        <div className='small text-body-secondary'>{getEligibilitySourceLabel(row.source)}</div>
                      </CTableDataCell>
                      <CTableDataCell>{row.learner?.dateOfBirth || '-'}</CTableDataCell>
                      <CTableDataCell><ExamEligibilityStatusBadge status={row.eligibilityStatus} /></CTableDataCell>
                      <CTableDataCell>
                        <div style={{ maxWidth: 260 }} className='text-truncate'>{row.reason || '-'}</div>
                      </CTableDataCell>
                      <CTableDataCell>{formatDateTime(row.reviewedAt)}</CTableDataCell>
                      <CTableDataCell><RegistrationSummaryCell summary={row.registrationSummary} /></CTableDataCell>
                      <CTableDataCell>{row.reviewedBy?.fullName || row.reviewedBy?.username || row.reviewedBy?.email || '-'}</CTableDataCell>
                      <CTableDataCell>
                        <CDropdown alignment='end'>
                          <CDropdownToggle color='secondary' variant='outline' size='sm'>Thao tác</CDropdownToggle>
                          <CDropdownMenu>
                            <CDropdownItem onClick={() => openDetail(row)}>Xem chi tiết</CDropdownItem>
                            {canManageEligibility && row.eligibilityStatus !== 'eligible' ? <CDropdownItem onClick={() => openMarkEligible(row)}>Đánh dấu đủ điều kiện</CDropdownItem> : null}
                            {canManageEligibility ? <CDropdownItem onClick={() => openEdit(row)}>Chỉnh ghi chú / trạng thái</CDropdownItem> : null}
                            {canManageEligibility && row.eligibilityStatus !== 'ineligible' ? <CDropdownItem onClick={() => openMarkIneligible(row)}>Đánh dấu không đủ điều kiện</CDropdownItem> : null}
                            {canManageEligibility ? <CDropdownItem onClick={() => handleDelete(row)}>Xóa khỏi danh sách</CDropdownItem> : null}
                          </CDropdownMenu>
                        </CDropdown>
                      </CTableDataCell>
                    </CTableRow>
                  )) : (
                    <CTableRow>
                      <CTableDataCell colSpan={9} className='text-center text-body-secondary'>Chưa có learner nào trong danh sách eligibility phù hợp với bộ lọc hiện tại.</CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>

              {pagination.pageCount > 1 ? (
                <div className='d-flex justify-content-end'>
                  <CPagination>
                    <CPaginationItem disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>Trước</CPaginationItem>
                    {pages.map((entry, index) => entry === '...'
                      ? <CPaginationItem key={`eligibility-ellipsis-${index}`} disabled>...</CPaginationItem>
                      : <CPaginationItem key={`eligibility-page-${entry}`} active={pagination.page === entry} onClick={() => setPagination((current) => ({ ...current, page: entry }))}>{entry}</CPaginationItem>)}
                    <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.pageCount, current.page + 1) }))}>Sau</CPaginationItem>
                  </CPagination>
                </div>
              ) : null}
            </>
          ) : null}
        </CCardBody>
      </CCard>

      <EligibilityEditorModal
        visible={editorState.open}
        mode={editorState.mode}
        item={editorState.item}
        roundId={roundId}
        saving={editorState.saving}
        submitError={editorState.error}
        fieldErrors={editorState.fieldErrors}
        onClose={closeEditor}
        onSubmit={handleEditorSubmit}
      />

      <EligibilityBulkModal
        visible={bulkState.open}
        roundId={roundId}
        saving={bulkState.saving}
        submitError={bulkState.error}
        onClose={closeBulk}
        onSubmit={handleBulkSubmit}
      />

      <EligibilityDetailModal
        visible={detailState.open}
        loading={detailState.loading}
        error={detailState.error}
        item={detailState.item}
        onClose={closeDetail}
      />

      <ExamEligibilityImportModal
        visible={importState.open}
        roundId={roundId}
        onClose={closeImport}
        onImported={handleImportCompleted}
      />

      <MarkIneligibleModal
        visible={markIneligibleState.open}
        item={markIneligibleState.item}
        saving={markIneligibleState.saving}
        submitError={markIneligibleState.error}
        fieldErrors={markIneligibleState.fieldErrors}
        onClose={closeMarkIneligible}
        onSubmit={handleMarkIneligibleSubmit}
      />

      <CToaster placement='top-end'>
        {toast.visible ? <CToast visible color={toast.color}><CToastBody>{toast.message}</CToastBody></CToast> : null}
      </CToaster>
    </>
  )
}