import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CFormInput,
  CFormLabel,
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
} from '@coreui/react'
import { getCurrentLearner, listLearnerExamRounds, normalizeCurrentLearnerApiMessage } from '../services/learnerExamApi'
import { formatDateTime, formatMoney, getPaymentCalculationMethodLabel, getRegistrationModeLabel } from '../utils/examRoundUi'
import { getLearnerActionLabel, getLearnerExamReasonLabel, getLearnerExamStatusMeta, groupLearnerExamRounds } from '../utils/learnerExamUi'

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

function ExamRoundCard({ item, onViewDetail, onGoRegister, onViewRegistration }) {
  const reasonLabel = getLearnerExamReasonLabel(item?.reasonCode)
  const statusMeta = getLearnerExamStatusMeta(item)
  const actionLabel = getLearnerActionLabel(item)

  return (
    <CCard className='h-100'>
      <CCardHeader className='d-flex justify-content-between align-items-start gap-2 flex-wrap'>
        <div>
          <div className='small text-body-secondary'>{item?.code || '-'}</div>
          <div className='fw-semibold'>{item?.name || '-'}</div>
        </div>
        <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
      </CCardHeader>
      <CCardBody className='d-flex flex-column gap-2'>
        <div className='small text-body-secondary'>{item?.shortDescription || 'Chưa có mô tả ngắn.'}</div>
        <div><span className='small text-body-secondary'>Thời gian đăng ký</span><div>{formatDateTime(item?.registrationStartAt)} - {formatDateTime(item?.registrationEndAt)}</div></div>
        <div><span className='small text-body-secondary'>Thời gian thi</span><div>{formatDateTime(item?.examStartAt)} - {formatDateTime(item?.examEndAt)}</div></div>
        <div><span className='small text-body-secondary'>Chế độ đăng ký</span><div>{getRegistrationModeLabel(item?.registrationMode)}</div></div>
        <div><span className='small text-body-secondary'>Lệ phí</span><div>{item?.paymentCalculationMethod === 'fixed' ? `${formatMoney(item?.fixedFee)} VND` : getPaymentCalculationMethodLabel(item?.paymentCalculationMethod)}</div></div>
        {item?.existingRegistration?.registrationCode ? (
          <div className='border rounded p-2 bg-body-tertiary'>
            <div className='small text-body-secondary'>Hồ sơ hiện có</div>
            <div className='fw-semibold'>{item.existingRegistration.registrationCode}</div>
            <div className='small text-body-secondary'>{item.existingRegistration.registrationStatus || '-'}</div>
          </div>
        ) : null}
        {reasonLabel && !item?.canRegister && !item?.existingRegistration?.registrationCode ? <CAlert color='warning' className='mb-0 py-2'>{reasonLabel}</CAlert> : null}
        <div className='d-flex gap-2 flex-wrap mt-auto'>
          <CButton color='secondary' variant='outline' onClick={() => onViewDetail?.(item.id)}>Xem chi tiết</CButton>
          {item?.existingRegistration?.id ? <CButton color='info' onClick={() => onViewRegistration?.(item.existingRegistration.id)}>Xem hồ sơ đăng ký</CButton> : null}
          {!item?.existingRegistration?.id && actionLabel ? <CButton color='primary' onClick={() => onGoRegister?.(item)} disabled={!item?.canRegister}>{actionLabel}</CButton> : null}
        </div>
      </CCardBody>
    </CCard>
  )
}

function ExamGroup({ title, rows, onViewDetail, onGoRegister, onViewRegistration }) {
  if (!rows.length) return null
  return (
    <div className='mb-4'>
      <div className='fs-5 fw-semibold mb-3'>{title}</div>
      <CRow className='g-3'>
        {rows.map((item) => (
          <CCol key={item.id} xl={3} lg={4} md={6} xs={12}>
            <ExamRoundCard item={item} onViewDetail={onViewDetail} onGoRegister={onGoRegister} onViewRegistration={onViewRegistration} />
          </CCol>
        ))}
      </CRow>
    </div>
  )
}

export default function LearnerExamListPage() {
  const navigate = useNavigate()
  const { tenantCode } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [user, setUser] = useState(null)
  const [learner, setLearner] = useState(null)
  const [support, setSupport] = useState(null)
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: Number(searchParams.get('page') || 1), pageSize: 12, total: 0, pageCount: 1 })
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [appliedSearch, setAppliedSearch] = useState(searchParams.get('search') || '')

  const grouped = useMemo(() => groupLearnerExamRounds(rows), [rows])
  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])

  useEffect(() => {
    let mounted = true
    async function loadLearnerProfile() {
      try {
        const result = await getCurrentLearner()
        if (!mounted) return
        setUser(result?.user || null)
        setLearner(result?.learner || null)
        setSupport(result?.support || null)
      } catch (requestError) {
        if (!mounted) return
        setError(normalizeCurrentLearnerApiMessage(requestError, 'Không tải được hồ sơ learner hiện tại.'))
      }
    }
    loadLearnerProfile()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    async function loadRounds() {
      setLoading(true)
      setError('')
      try {
        const result = await listLearnerExamRounds({ page: pagination.page, pageSize: pagination.pageSize, search: appliedSearch })
        if (!mounted) return
        setRows(Array.isArray(result?.rows) ? result.rows : [])
        setPagination(result?.pagination || { page: 1, pageSize: 12, total: 0, pageCount: 1 })
        if (!user && result?.user) setUser(result.user)
        if (!learner && result?.learner) setLearner(result.learner)
        if (!support && result?.support) setSupport(result.support)
        const params = new URLSearchParams()
        params.set('page', String(result?.pagination?.page || pagination.page))
        if (appliedSearch) params.set('search', appliedSearch)
        setSearchParams(params)
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setError(normalizeCurrentLearnerApiMessage(requestError, 'Không tải được danh sách đợt thi cho learner.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadRounds()
    return () => { mounted = false }
  }, [appliedSearch, pagination.page, pagination.pageSize])

  function buildExamDetailPath(roundId) {
    return tenantCode ? `/t/${encodeURIComponent(tenantCode)}/learner/exams/${roundId}` : `/learner/exams/${roundId}`
  }

  function buildRegisterPath(item) {
    if (item?.requiresLearnerCreation) {
      return tenantCode ? `/t/${encodeURIComponent(tenantCode)}/learner/exams/${item.id}/register/profile` : `/learner/exams/${item.id}/register/profile`
    }
    return tenantCode ? `/t/${encodeURIComponent(tenantCode)}/learner/exams/${item.id}/register` : `/learner/exams/${item.id}/register`
  }

  function buildRegistrationPath(registrationId) {
    return tenantCode ? `/t/${encodeURIComponent(tenantCode)}/learner/exam-registrations/${registrationId}` : `/learner/exam-registrations/${registrationId}`
  }

  return (
    <CContainer fluid className='py-4'>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='fs-4 fw-semibold'>Đăng ký dự thi</div>
          <div className='text-body-secondary'>Xem các đợt thi bạn có thể theo dõi và chuẩn bị đăng ký dự thi.</div>
        </div>
      </div>

      {learner ? (
        <CCard className='mb-4'>
          <CCardBody>
            <div className='small text-body-secondary'>Người học</div>
            <div className='fw-semibold'>{learner.fullName || '-'} - {learner.code || '-'}</div>
            <div className='small text-body-secondary'>{learner.className || 'Chưa có thông tin lớp'}</div>
          </CCardBody>
        </CCard>
      ) : null}

      {!learner ? (
        <CAlert color='info'>Tài khoản của bạn hiện chưa được liên kết với hồ sơ người học. Bạn vẫn có thể đăng ký các đợt thi không giới hạn đối tượng. Thông tin người học sẽ được khai và tạo khi bạn thực hiện đăng ký.</CAlert>
      ) : null}

      <CCard className='mb-4'>
        <CCardBody>
          <CRow className='g-3'>
            <CCol md={8}>
              <CFormLabel>Tìm đợt thi</CFormLabel>
              <CFormInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder='Tìm theo mã hoặc tên đợt thi' />
            </CCol>
            <CCol md={4} className='d-flex align-items-end gap-2'>
              <CButton color='primary' onClick={() => { setPagination((current) => ({ ...current, page: 1 })); setAppliedSearch(String(search || '').trim()) }}>Tìm kiếm</CButton>
              <CButton color='secondary' variant='outline' onClick={() => { setSearch(''); setAppliedSearch(''); setPagination((current) => ({ ...current, page: 1 })) }}>Đặt lại</CButton>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {loading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải danh sách đợt thi...</div> : null}

      {!loading ? (
        <>
          <ExamGroup title='Đã đăng ký' rows={grouped.registered} onViewDetail={(id) => navigate(buildExamDetailPath(id))} onGoRegister={(item) => navigate(buildRegisterPath(item))} onViewRegistration={(id) => navigate(buildRegistrationPath(id))} />
          <ExamGroup title='Đang mở đăng ký' rows={grouped.opening} onViewDetail={(id) => navigate(buildExamDetailPath(id))} onGoRegister={(item) => navigate(buildRegisterPath(item))} onViewRegistration={(id) => navigate(buildRegistrationPath(id))} />
          <ExamGroup title='Chưa mở đăng ký' rows={grouped.notOpen} onViewDetail={(id) => navigate(buildExamDetailPath(id))} onGoRegister={(item) => navigate(buildRegisterPath(item))} onViewRegistration={(id) => navigate(buildRegistrationPath(id))} />
          <ExamGroup title='Tạm dừng đăng ký' rows={grouped.paused} onViewDetail={(id) => navigate(buildExamDetailPath(id))} onGoRegister={(item) => navigate(buildRegisterPath(item))} onViewRegistration={(id) => navigate(buildRegistrationPath(id))} />
          <ExamGroup title='Sắp mở đăng ký' rows={grouped.upcoming} onViewDetail={(id) => navigate(buildExamDetailPath(id))} onGoRegister={(item) => navigate(buildRegisterPath(item))} onViewRegistration={(id) => navigate(buildRegistrationPath(id))} />
          <ExamGroup title='Chưa đủ điều kiện đăng ký' rows={grouped.ineligible} onViewDetail={(id) => navigate(buildExamDetailPath(id))} onGoRegister={(item) => navigate(buildRegisterPath(item))} onViewRegistration={(id) => navigate(buildRegistrationPath(id))} />
          <ExamGroup title='Đã hết thời gian đăng ký' rows={grouped.ended} onViewDetail={(id) => navigate(buildExamDetailPath(id))} onGoRegister={(item) => navigate(buildRegisterPath(item))} onViewRegistration={(id) => navigate(buildRegistrationPath(id))} />
          <ExamGroup title='Chưa khả dụng' rows={grouped.unavailable} onViewDetail={(id) => navigate(buildExamDetailPath(id))} onGoRegister={(item) => navigate(buildRegisterPath(item))} onViewRegistration={(id) => navigate(buildRegistrationPath(id))} />

          {pagination.pageCount > 1 ? (
            <div className='d-flex justify-content-end'>
              <CPagination>
                <CPaginationItem disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}>Trước</CPaginationItem>
                {pages.map((entry, index) => entry === '...'
                  ? <CPaginationItem key={`learner-round-ellipsis-${index}`} disabled>...</CPaginationItem>
                  : <CPaginationItem key={`learner-round-page-${entry}`} active={pagination.page === entry} onClick={() => setPagination((current) => ({ ...current, page: entry }))}>{entry}</CPaginationItem>)}
                <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => setPagination((current) => ({ ...current, page: Math.min(current.pageCount, current.page + 1) }))}>Sau</CPaginationItem>
              </CPagination>
            </div>
          ) : null}
        </>
      ) : null}
    </CContainer>
  )
}