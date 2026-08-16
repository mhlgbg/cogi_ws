import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CFormCheck,
  CRow,
  CSpinner,
} from '@coreui/react'
import { createLearnerExamRegistration, getLearnerRegistrationOptions, normalizeCurrentLearnerApiMessage } from '../services/learnerExamApi'
import { formatDateTime, formatMoney, getPaymentCalculationMethodLabel } from '../utils/examRoundUi'
import { getLearnerExamReasonLabel } from '../utils/learnerExamUi'

function SpinnerCenter() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><CSpinner /></div>
}

function buildInitialSelection(options) {
  const subjects = Array.isArray(options?.subjects) ? options.subjects : []
  const selectedSubjectIds = (options?.allowSubjectSelection
    ? subjects.filter((subject) => subject.selectedByDefault)
    : subjects
  ).map((subject) => subject.examRoundSubjectId)

  const selectedComponentIds = []
  for (const subject of subjects) {
    if (!selectedSubjectIds.includes(subject.examRoundSubjectId)) continue
    for (const component of subject.components || []) {
      if (options?.allowComponentSelection) {
        if (component.selectedByDefault) selectedComponentIds.push(component.examRoundComponentId)
      }
    }
  }

  return { selectedSubjectIds, selectedComponentIds }
}

function calculateClientFeePreview(options, selectedSubjects) {
  const method = String(options?.paymentCalculationMethod || options?.feeConfiguration?.paymentCalculationMethod || '').trim().toLowerCase()
  const fixedFee = options?.feeConfiguration?.fixedFee ?? options?.feePreview?.fixedFee ?? null
  const subjectFeeTotal = selectedSubjects.reduce((sum, subject) => sum + Number(subject.fee || 0), 0)
  const componentFeeTotal = selectedSubjects.reduce((sum, subject) => sum + (subject.selectedComponents || []).reduce((componentSum, component) => componentSum + Number(component.fee || 0), 0), 0)

  if (method === 'fixed' || method === 'program_fee') {
    return {
      calculationMethod: method,
      fixedFee,
      subjectFeeTotal,
      componentFeeTotal,
      totalAmount: fixedFee === null || fixedFee === undefined ? null : Number(fixedFee || 0),
    }
  }

  if (method === 'subject_fee') {
    return {
      calculationMethod: method,
      fixedFee,
      subjectFeeTotal,
      componentFeeTotal,
      totalAmount: subjectFeeTotal,
    }
  }

  return {
    calculationMethod: method,
    fixedFee,
    subjectFeeTotal,
    componentFeeTotal,
    totalAmount: componentFeeTotal,
  }
}

function SelectionCard({ title, children }) {
  return (
    <CCard className='mb-4'>
      <CCardHeader><strong>{title}</strong></CCardHeader>
      <CCardBody>{children}</CCardBody>
    </CCard>
  )
}

export default function LearnerExamRegistrationPage() {
  const navigate = useNavigate()
  const { id, tenantCode } = useParams()
  const detailPath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/learner/exams/${id}` : `/learner/exams/${id}`
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [options, setOptions] = useState(null)
  const [error, setError] = useState('')
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([])
  const [selectedComponentIds, setSelectedComponentIds] = useState([])
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getLearnerRegistrationOptions(id)
        if (!mounted) return
        setOptions(result)
        const initialSelection = buildInitialSelection(result)
        setSelectedSubjectIds(initialSelection.selectedSubjectIds)
        setSelectedComponentIds(initialSelection.selectedComponentIds)
      } catch (requestError) {
        if (!mounted) return
        setOptions(null)
        setError(normalizeCurrentLearnerApiMessage(requestError, 'Không tải được tùy chọn đăng ký dự thi.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id])

  const selectedSubjects = useMemo(() => {
    const subjects = Array.isArray(options?.subjects) ? options.subjects : []
    return subjects
      .filter((subject) => selectedSubjectIds.includes(subject.examRoundSubjectId))
      .map((subject) => ({
        ...subject,
        selectedComponents: (subject.components || []).filter((component) => {
          if (!options?.allowComponentSelection) return true
          return selectedComponentIds.includes(component.examRoundComponentId)
        }),
      }))
  }, [options, selectedComponentIds, selectedSubjectIds])

  const feePreview = useMemo(() => calculateClientFeePreview(options, selectedSubjects), [options, selectedSubjects])

  const selectionIssue = useMemo(() => {
    if (!selectedSubjects.length) return 'Bạn cần chọn ít nhất một môn thi.'
    if (selectedSubjects.some((subject) => !Array.isArray(subject.selectedComponents) || subject.selectedComponents.length === 0)) {
      return 'Mỗi môn thi phải có ít nhất một kỹ năng/phần thi được chọn.'
    }
    if (options?.paymentRequired && feePreview.totalAmount === null) {
      return 'Không thể tính lệ phí dự kiến từ cấu hình hiện tại của đợt thi.'
    }
    return ''
  }, [feePreview.totalAmount, options?.paymentRequired, selectedSubjects])

  function toggleSubject(subject, checked) {
    setSelectedSubjectIds((prev) => checked
      ? Array.from(new Set([...prev, subject.examRoundSubjectId]))
      : prev.filter((item) => item !== subject.examRoundSubjectId))

    if (!checked) {
      setSelectedComponentIds((prev) => prev.filter((componentId) => !(subject.components || []).some((component) => component.examRoundComponentId === componentId)))
      return
    }

    if (options?.allowComponentSelection) {
      const requiredComponentIds = (subject.components || [])
        .filter((component) => component.selectedByDefault || component.isRequired)
        .map((component) => component.examRoundComponentId)
      setSelectedComponentIds((prev) => Array.from(new Set([...prev, ...requiredComponentIds])))
    }
  }

  function toggleComponent(component, checked) {
    setSelectedComponentIds((prev) => checked
      ? Array.from(new Set([...prev, component.examRoundComponentId]))
      : prev.filter((item) => item !== component.examRoundComponentId))
  }

  async function handleSubmit() {
    if (!options?.canRegister || selectionIssue || !confirmed || submitting) return

    if (options?.existingRegistration?.id) {
      navigate(tenantCode ? `/t/${encodeURIComponent(tenantCode)}/learner/exam-registrations/${options.existingRegistration.id}` : `/learner/exam-registrations/${options.existingRegistration.id}`)
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const payload = {}
      if (options?.allowSubjectSelection) payload.subjectIds = selectedSubjectIds
      if (options?.allowComponentSelection) payload.componentIds = selectedComponentIds
      const result = await createLearnerExamRegistration(id, payload)
      const detailPath = result?.detailPath || (tenantCode ? `/t/${encodeURIComponent(tenantCode)}/learner/exam-registrations/${result?.registration?.id}` : `/learner/exam-registrations/${result?.registration?.id}`)
      navigate(detailPath, { state: { justCreated: true } })
    } catch (requestError) {
      const existingRegistrationId = requestError?.response?.data?.details?.registration?.id
      if (existingRegistrationId) {
        navigate(tenantCode ? `/t/${encodeURIComponent(tenantCode)}/learner/exam-registrations/${existingRegistrationId}` : `/learner/exam-registrations/${existingRegistrationId}`)
        return
      }
      setError(normalizeCurrentLearnerApiMessage(requestError, 'Không thể tạo hồ sơ đăng ký dự thi.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <SpinnerCenter />

  if (!options) {
    return (
      <CContainer fluid className='py-4'>
        <CAlert color='danger'>{error || 'Không tải được thông tin đăng ký.'}</CAlert>
        <CButton color='secondary' variant='outline' onClick={() => navigate(detailPath)}>Quay lại chi tiết đợt thi</CButton>
      </CContainer>
    )
  }

  const reasonLabel = getLearnerExamReasonLabel(options.reasonCode)

  return (
    <CContainer fluid className='py-4'>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-4'>
        <div>
          <div className='small text-body-secondary'>{options?.examRound?.code || '-'}</div>
          <div className='fs-4 fw-semibold'>Đăng ký dự thi</div>
          <div className='text-body-secondary'>{options?.examRound?.name || '-'}</div>
        </div>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={() => navigate(detailPath)}>Quay lại chi tiết đợt thi</CButton>
          {options?.existingRegistration?.id ? (
            <CButton color='info' onClick={() => navigate(tenantCode ? `/t/${encodeURIComponent(tenantCode)}/learner/exam-registrations/${options.existingRegistration.id}` : `/learner/exam-registrations/${options.existingRegistration.id}`)}>
              Xem hồ sơ hiện có
            </CButton>
          ) : null}
        </div>
      </div>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {reasonLabel && !options?.canRegister ? <CAlert color='warning'>{reasonLabel}</CAlert> : null}
      {!options?.paymentConfigured && options?.paymentRequired ? <CAlert color='warning'>Đợt thi này hiện chưa có snapshot thông tin thanh toán hợp lệ. Vui lòng liên hệ nhà trường trước khi tiếp tục.</CAlert> : null}
      {selectionIssue ? <CAlert color='warning'>{selectionIssue}</CAlert> : null}

      <CRow className='g-4'>
        <CCol xl={8}>
          <SelectionCard title='1. Chọn môn thi'>
            <div className='small text-body-secondary mb-3'>
              {options?.allowSubjectSelection
                ? 'Môn bắt buộc đã được chọn sẵn và khóa. Bạn có thể chọn thêm các môn tự chọn hợp lệ.'
                : 'Đợt thi này không cho phép tự chọn môn. Hệ thống sẽ áp dụng toàn bộ môn thi active của đợt.'}
            </div>
            <div className='d-flex flex-column gap-3'>
              {(options.subjects || []).map((subject) => {
                const checked = selectedSubjectIds.includes(subject.examRoundSubjectId)
                return (
                  <div key={subject.examRoundSubjectId} className='border rounded p-3'>
                    <div className='d-flex justify-content-between gap-3 flex-wrap mb-2'>
                      <CFormCheck
                        id={`subject-${subject.examRoundSubjectId}`}
                        checked={checked}
                        disabled={!options.allowSubjectSelection || subject.isRequired}
                        onChange={(event) => toggleSubject(subject, event.target.checked)}
                        label={<span className='fw-semibold'>{subject.codeSnapshot ? `${subject.codeSnapshot} - ` : ''}{subject.nameSnapshot}</span>}
                      />
                      <div className='d-flex gap-2 flex-wrap'>
                        <CBadge color={subject.isRequired ? 'danger' : 'secondary'}>{subject.isRequired ? 'Bắt buộc' : 'Tự chọn'}</CBadge>
                        <CBadge color='light' textColor='dark'>{subject.fee === null || subject.fee === undefined ? 'Chưa cấu hình phí' : `${formatMoney(subject.fee)} VND`}</CBadge>
                      </div>
                    </div>
                    <div className='small text-body-secondary'>Quy tắc: {getPaymentCalculationMethodLabel(options.paymentCalculationMethod) === 'Phí theo môn' ? 'Phí môn sẽ được cộng vào tổng dự kiến.' : 'Theo cấu hình của đợt thi.'}</div>
                  </div>
                )
              })}
            </div>
          </SelectionCard>

          <SelectionCard title='2. Chọn kỹ năng / phần thi'>
            <div className='small text-body-secondary mb-3'>
              {options?.allowComponentSelection
                ? 'Kỹ năng bắt buộc đã được chọn sẵn. Khi bỏ một môn tự chọn, các kỹ năng thuộc môn đó cũng sẽ được loại khỏi bản nháp.'
                : 'Đợt thi này không cho phép tự chọn kỹ năng. Hệ thống sẽ tự áp dụng toàn bộ kỹ năng active thuộc các môn bạn được đăng ký.'}
            </div>
            <div className='d-flex flex-column gap-3'>
              {selectedSubjects.map((subject) => (
                <div key={subject.examRoundSubjectId} className='border rounded p-3'>
                  <div className='fw-semibold mb-2'>{subject.codeSnapshot ? `${subject.codeSnapshot} - ` : ''}{subject.nameSnapshot}</div>
                  <div className='d-flex flex-column gap-2'>
                    {(subject.components || []).map((component) => {
                      const checked = !options.allowComponentSelection || selectedComponentIds.includes(component.examRoundComponentId)
                      return (
                        <div key={component.examRoundComponentId} className='border rounded p-2 bg-body-tertiary'>
                          <div className='d-flex justify-content-between gap-3 flex-wrap'>
                            <CFormCheck
                              id={`component-${component.examRoundComponentId}`}
                              checked={checked}
                              disabled={!options.allowComponentSelection || component.isRequired}
                              onChange={(event) => toggleComponent(component, event.target.checked)}
                              label={<span>{component.codeSnapshot ? `${component.codeSnapshot} - ` : ''}{component.nameSnapshot}</span>}
                            />
                            <div className='d-flex gap-2 flex-wrap'>
                              <CBadge color={component.isRequired ? 'danger' : 'secondary'}>{component.isRequired ? 'Bắt buộc' : 'Tự chọn'}</CBadge>
                              <CBadge color='light' textColor='dark'>{component.fee === null || component.fee === undefined ? 'Chưa cấu hình phí' : `${formatMoney(component.fee)} VND`}</CBadge>
                            </div>
                          </div>
                          <div className='small text-body-secondary mt-2'>Thời lượng: {component.durationMinutes ? `${component.durationMinutes} phút` : '-'} · Hình thức: {component.examMethod || '-'}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </SelectionCard>

          <SelectionCard title='3. Xác nhận đăng ký'>
            <CRow className='g-3'>
              <CCol md={6}>
                <div className='small text-body-secondary'>Người học</div>
                <div className='fw-semibold'>{options?.learner?.fullName || '-'} {options?.learner?.code ? `- ${options.learner.code}` : ''}</div>
                <div className='small text-body-secondary'>{options?.learner?.dateOfBirth ? `Ngày sinh: ${formatDateTime(options.learner.dateOfBirth)}` : 'Ngày sinh: -'}</div>
              </CCol>
              <CCol md={6}>
                <div className='small text-body-secondary'>Đợt thi</div>
                <div className='fw-semibold'>{options?.examRound?.code || '-'} - {options?.examRound?.name || '-'}</div>
                <div className='small text-body-secondary'>Thời gian thi: {formatDateTime(options?.examRound?.examStartAt)} - {formatDateTime(options?.examRound?.examEndAt)}</div>
              </CCol>
            </CRow>

            <div className='mt-4'>
              <div className='fw-semibold mb-2'>Nội dung đăng ký</div>
              <div className='d-flex flex-column gap-2'>
                {selectedSubjects.map((subject) => (
                  <div key={subject.examRoundSubjectId} className='border rounded p-3'>
                    <div className='fw-semibold'>{subject.codeSnapshot ? `${subject.codeSnapshot} - ` : ''}{subject.nameSnapshot}</div>
                    <div className='small text-body-secondary mb-2'>{subject.isRequired ? 'Môn bắt buộc' : 'Môn tự chọn'}</div>
                    <div className='d-flex flex-column gap-1'>
                      {(subject.selectedComponents || []).map((component) => (
                        <div key={component.examRoundComponentId} className='small'>
                          {component.codeSnapshot ? `${component.codeSnapshot} - ` : ''}{component.nameSnapshot} · {component.isRequired ? 'Bắt buộc' : 'Tự chọn'}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <CAlert color='secondary' className='mt-4 mb-3'>Sau khi xác nhận đăng ký, hệ thống sẽ cấp mã hồ sơ và thông tin chuyển khoản. Hồ sơ chỉ được ghi nhận thanh toán sau khi nhà trường xác nhận đã nhận tiền.</CAlert>
            <CFormCheck
              id='registration-confirm-checkbox'
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              label='Tôi xác nhận thông tin đăng ký trên là chính xác.'
            />
          </SelectionCard>
        </CCol>

        <CCol xl={4}>
          <SelectionCard title='Lệ phí dự kiến'>
            <div className='small text-body-secondary mb-2'>Phương thức tính phí</div>
            <div className='fw-semibold mb-3'>{getPaymentCalculationMethodLabel(options?.paymentCalculationMethod)}</div>

            <div className='d-flex justify-content-between py-1'><span>Phí cố định</span><strong>{feePreview.fixedFee === null || feePreview.fixedFee === undefined ? '-' : `${formatMoney(feePreview.fixedFee)} VND`}</strong></div>
            <div className='d-flex justify-content-between py-1'><span>Tổng phí theo môn</span><strong>{`${formatMoney(feePreview.subjectFeeTotal || 0)} VND`}</strong></div>
            <div className='d-flex justify-content-between py-1'><span>Tổng phí theo kỹ năng</span><strong>{`${formatMoney(feePreview.componentFeeTotal || 0)} VND`}</strong></div>
            <hr />
            <div className='d-flex justify-content-between py-1'><span>Tổng dự kiến</span><strong>{feePreview.totalAmount === null ? '-' : `${formatMoney(feePreview.totalAmount)} VND`}</strong></div>
            <div className='small text-body-secondary mt-2'>Hạn thanh toán: {formatDateTime(options?.paymentDueAt)}</div>
            <div className='small text-body-secondary mt-3'>Lệ phí chính thức được hệ thống xác định khi hồ sơ đăng ký được tạo.</div>
          </SelectionCard>

          <SelectionCard title='Thanh toán'>
            {options?.paymentRequired ? (
              <>
                <div className='small text-body-secondary mb-2'>Trạng thái cấu hình</div>
                <CBadge color={options?.paymentConfigured ? 'success' : 'warning'}>{options?.paymentConfigured ? 'Đã sẵn sàng' : 'Chưa hợp lệ'}</CBadge>
                <div className='small text-body-secondary mt-3'>Khi hồ sơ được tạo, hệ thống sẽ snapshot thông tin nhận thanh toán từ đợt thi xuống hồ sơ của bạn.</div>
              </>
            ) : (
              <CAlert color='success' className='mb-0'>Đợt thi này không yêu cầu nộp lệ phí.</CAlert>
            )}
          </SelectionCard>

          <div className='d-grid gap-2'>
            <CButton color='primary' disabled={!options?.canRegister || !options?.paymentConfigured && options?.paymentRequired || !confirmed || Boolean(selectionIssue) || submitting} onClick={handleSubmit}>
              {submitting ? 'Đang tạo hồ sơ...' : 'Xác nhận đăng ký'}
            </CButton>
          </div>
        </CCol>
      </CRow>
    </CContainer>
  )
}