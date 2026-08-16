import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  CBreadcrumb,
  CBreadcrumbItem,
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CRow,
  CToast,
  CToastBody,
  CToaster,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import ExamProgramFormModal from '../components/ExamProgramFormModal'
import ExamProgramStructureEditorModal from '../components/ExamProgramStructureEditorModal'
import ExamProgramSubjectConfigModal from '../components/ExamProgramSubjectConfigModal'
import ExamProgramStatusConfirmModal from '../components/ExamProgramStatusConfirmModal'
import useExamProgramMutations from '../hooks/useExamProgramMutations'
import { getExamProgram, replaceExamProgramSubjects, updateExamProgramSubject } from '../services/examProgramApi'
import { useFeature } from '../../../contexts/FeatureContext'
import {
  buildExamConfigurationDetailPath,
  buildExamConfigurationPath,
  resolveExamProgramMutationError,
  resolveExamProgramReadError,
} from '../utils/examConfigurationUi'
import {
  buildExamProgramFormValues,
  mapExamProgramFormValuesToCreatePayload,
  mapExamProgramFormValuesToUpdatePayload,
} from '../utils/examProgramForm'
import {
  formatExamProgramDate,
  formatExamProgramFee,
  getExamProgramSubjectEffectiveFee,
  getExamProgramSubjectEffectivePassingRule,
  formatExamProgramSubjectFee,
  getExamProgramFeeCalculationMethodLabel,
  getExamProgramPassingMethodLabel,
  getExamProgramStatusMeta,
} from '../utils/examProgramUi'
import { formatExamConfigDateTime } from '../utils/examSubjectUi'

function SpinnerCenter() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <CSpinner />
    </div>
  )
}

function InfoCard({ label, value }) {
  return (
    <CCard className='h-100'>
      <CCardBody>
        <div className='small text-body-secondary'>{label}</div>
        <div className='fw-semibold'>{value || '-'}</div>
      </CCardBody>
    </CCard>
  )
}

export default function ExamProgramDetailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { id, tenantCode } = useParams()
  const feature = useFeature()
  const [loading, setLoading] = useState(true)
  const [program, setProgram] = useState(null)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [toastState, setToastState] = useState({ visible: false, color: 'success', message: '' })
  const [editorState, setEditorState] = useState({ open: false, mode: 'edit', initialValues: buildExamProgramFormValues() })
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [confirmState, setConfirmState] = useState({ open: false, nextActive: true, error: '' })
  const [structureEditorOpen, setStructureEditorOpen] = useState(false)
  const [structureSaving, setStructureSaving] = useState(false)
  const [structureError, setStructureError] = useState('')
  const [programSubjectConfigState, setProgramSubjectConfigState] = useState({ open: false, item: null, error: '', fieldErrors: {}, saving: false })
  const canManage = feature?.isLoading ? false : feature?.hasFeature?.('exam-round.manage') || false
  const { activeMutation, createExamProgram, updateExamProgram, setExamProgramActive } = useExamProgramMutations()

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getExamProgram(id)
        if (!mounted) return
        setProgram(result || null)
      } catch (requestError) {
        if (!mounted) return
        setProgram(null)
        setError(resolveExamProgramReadError(requestError, 'Không tải được chi tiết chương trình thi.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id, reloadToken])

  useEffect(() => {
    if (!toastState.visible) return undefined
    const timer = window.setTimeout(() => setToastState((current) => ({ ...current, visible: false })), 2500)
    return () => window.clearTimeout(timer)
  }, [toastState.visible])

  useEffect(() => {
    const nextToast = location.state?.toast
    if (!nextToast?.message) return
    setToastState({ visible: true, color: nextToast.color || 'success', message: nextToast.message })
    navigate(buildExamConfigurationDetailPath('programs', id, tenantCode), { replace: true, state: null })
  }, [id, location.state, navigate, tenantCode])

  function reloadDetail() {
    setReloadToken((current) => current + 1)
  }

  function openEditModal() {
    setFormError('')
    setFieldErrors({})
    setEditorState({ open: true, mode: 'edit', initialValues: buildExamProgramFormValues(program, { mode: 'edit' }) })
  }

  function openCloneModal() {
    setFormError('')
    setFieldErrors({})
    setEditorState({ open: true, mode: 'clone', initialValues: buildExamProgramFormValues(program, { mode: 'clone' }) })
  }

  function closeEditor() {
    if (activeMutation) return
    setEditorState((current) => ({ ...current, open: false }))
    setFormError('')
    setFieldErrors({})
  }

  function openStatusConfirm(nextActive) {
    setConfirmState({ open: true, nextActive, error: '' })
  }

  function closeStatusConfirm() {
    if (activeMutation) return
    setConfirmState({ open: false, nextActive: true, error: '' })
  }

  function openStructureEditor() {
    setStructureError('')
    setStructureEditorOpen(true)
  }

  function closeStructureEditor() {
    if (structureSaving) return
    setStructureEditorOpen(false)
    setStructureError('')
  }

  function openProgramSubjectConfig(item) {
    setProgramSubjectConfigState({ open: true, item: { ...item, programName: program?.name || '' }, error: '', fieldErrors: {}, saving: false })
  }

  function closeProgramSubjectConfig() {
    if (programSubjectConfigState.saving) return
    setProgramSubjectConfigState({ open: false, item: null, error: '', fieldErrors: {}, saving: false })
  }

  async function handleFormSubmit(values) {
    setFormError('')
    setFieldErrors({})
    try {
      if (editorState.mode === 'edit') {
        const payload = mapExamProgramFormValuesToUpdatePayload(values, buildExamProgramFormValues(program, { mode: 'edit' }))
        if (Object.keys(payload).length === 0) {
          closeEditor()
          return
        }
        await updateExamProgram(program.id || program.documentId, payload)
        setToastState({ visible: true, color: 'success', message: 'Đã cập nhật chương trình thi.' })
        closeEditor()
        reloadDetail()
        return
      }

      const created = await createExamProgram(mapExamProgramFormValuesToCreatePayload(values))
      closeEditor()
      navigate(buildExamConfigurationDetailPath('programs', created?.id || created?.documentId, tenantCode), {
        state: {
          toast: {
            color: 'success',
            message: 'Đã tạo bản sao chương trình thi.',
          },
        },
      })
    } catch (requestError) {
      const resolvedError = resolveExamProgramMutationError(requestError, editorState.mode === 'edit' ? 'Không thể cập nhật chương trình thi.' : 'Không thể tạo bản sao chương trình thi.')
      setFormError(resolvedError.message)
      setFieldErrors(resolvedError.fieldErrors || {})
    }
  }

  async function handleStatusConfirm() {
    try {
      await setExamProgramActive(program.id || program.documentId, confirmState.nextActive)
      setToastState({
        visible: true,
        color: 'success',
        message: confirmState.nextActive ? 'Đã kích hoạt lại chương trình thi.' : 'Đã ngừng sử dụng chương trình thi.',
      })
      closeStatusConfirm()
      reloadDetail()
    } catch (requestError) {
      const resolvedError = resolveExamProgramMutationError(requestError, confirmState.nextActive ? 'Không thể kích hoạt lại chương trình thi.' : 'Không thể ngừng sử dụng chương trình thi.')
      setConfirmState((current) => ({ ...current, error: resolvedError.message }))
    }
  }

  async function handleStructureSubmit(subjectIds) {
    setStructureSaving(true)
    setStructureError('')
    try {
      await replaceExamProgramSubjects(program.id || program.documentId, subjectIds)
      setToastState({ visible: true, color: 'success', message: 'Đã cập nhật cấu trúc môn thi của chương trình.' })
      setStructureEditorOpen(false)
      reloadDetail()
    } catch (requestError) {
      const resolvedError = resolveExamProgramMutationError(requestError, 'Không thể cập nhật cấu trúc môn thi của chương trình.')
      setStructureError(resolvedError.message)
    } finally {
      setStructureSaving(false)
    }
  }

  async function handleProgramSubjectConfigSubmit(payload) {
    setProgramSubjectConfigState((current) => ({ ...current, saving: true, error: '', fieldErrors: {} }))
    try {
      await updateExamProgramSubject(program.id || program.documentId, programSubjectConfigState.item?.id, payload)
      setToastState({ visible: true, color: 'success', message: 'Đã cập nhật cấu hình môn trong chương trình.' })
      setProgramSubjectConfigState({ open: false, item: null, error: '', fieldErrors: {}, saving: false })
      reloadDetail()
    } catch (requestError) {
      const resolvedError = resolveExamProgramMutationError(requestError, 'Không thể cập nhật cấu hình môn trong chương trình.')
      setProgramSubjectConfigState((current) => ({ ...current, saving: false, error: resolvedError.message, fieldErrors: resolvedError.fieldErrors || {} }))
    }
  }

  if (loading) return <SpinnerCenter />

  if (!program) {
    return (
      <CContainer fluid className='py-4'>
        <div className='alert alert-danger'>{error || 'Không tìm thấy chương trình thi.'}</div>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={() => navigate(buildExamConfigurationPath('programs', tenantCode))}>Quay lại danh sách</CButton>
          <CButton color='danger' variant='outline' onClick={() => setReloadToken((current) => current + 1)}>Thử lại</CButton>
        </div>
      </CContainer>
    )
  }

  const statusMeta = getExamProgramStatusMeta(program.isActive)
  const hasProgramSubjects = Array.isArray(program.programSubjects) && program.programSubjects.length > 0
  const fixedFeeMissing = program.feeCalculationMethod === 'fixed' && program.defaultFee === null
  const hasInactiveSubjects = Array.isArray(program.programSubjects) && program.programSubjects.some((item) => item.examSubjectIsActive === false)

  return (
    <CContainer fluid className='py-4'>
      <CBreadcrumb className='mb-3'>
        <CBreadcrumbItem><button type='button' className='btn btn-link p-0 text-decoration-none' onClick={() => navigate(buildExamConfigurationPath('overview', tenantCode))}>Cấu hình thi chuẩn đầu ra</button></CBreadcrumbItem>
        <CBreadcrumbItem><button type='button' className='btn btn-link p-0 text-decoration-none' onClick={() => navigate(buildExamConfigurationPath('programs', tenantCode))}>Chương trình thi</button></CBreadcrumbItem>
        <CBreadcrumbItem active>{program.name || program.code || 'Chi tiết chương trình thi'}</CBreadcrumbItem>
      </CBreadcrumb>

      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
        <div>
          <div className='d-flex align-items-center gap-2 flex-wrap mb-2'>
            <CButton color='secondary' variant='outline' onClick={() => navigate(buildExamConfigurationPath('programs', tenantCode))}>Quay lại</CButton>
            <div className='fs-4 fw-semibold'>{program.name || '-'}</div>
            <span className={`badge text-bg-${statusMeta.color}`}>{statusMeta.label}</span>
          </div>
          <div className='text-body-secondary'>{program.code || '-'} • {getExamProgramFeeCalculationMethodLabel(program.feeCalculationMethod)}</div>
        </div>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={reloadDetail}>Tải lại trang</CButton>
          {canManage ? <CButton color='warning' variant='outline' onClick={openEditModal} disabled={Boolean(activeMutation)}>Chỉnh sửa</CButton> : null}
          {canManage ? <CButton color='secondary' variant='outline' onClick={openCloneModal} disabled={Boolean(activeMutation)}>Nhân bản</CButton> : null}
          {canManage ? <CButton color='info' variant='outline' onClick={openStructureEditor} disabled={structureSaving}>Thêm / Xóa / Sắp xếp môn</CButton> : null}
          {canManage && program.isActive ? <CButton color='warning' onClick={() => openStatusConfirm(false)} disabled={Boolean(activeMutation)}>Ngừng sử dụng</CButton> : null}
          {canManage && !program.isActive ? <CButton color='primary' onClick={() => openStatusConfirm(true)} disabled={Boolean(activeMutation)}>Kích hoạt lại</CButton> : null}
        </div>
      </div>

      <div className='alert alert-info'>Các đợt thi được tạo từ chương trình này lưu cấu trúc snapshot riêng. Việc chỉnh sửa chương trình không tự động cập nhật các đợt thi đã tạo.</div>
      {fixedFeeMissing ? <div className='alert alert-warning'>Chương trình đang dùng phương thức lệ phí cố định nhưng chưa cấu hình lệ phí mặc định.</div> : null}
      {!feature?.isLoading && hasInactiveSubjects ? <CAlert color='warning'>Chương trình này đang chứa môn thi inactive. Bước hiện tại chỉ cảnh báo read-only và không tự thay đổi danh sách môn.</CAlert> : null}

      <CRow className='g-3 mb-4'>
        <CCol xl={4} md={6}><InfoCard label='Mã chương trình' value={program.code} /></CCol>
        <CCol xl={4} md={6}><InfoCard label='Tên chương trình' value={program.name} /></CCol>
        <CCol xl={4} md={6}><InfoCard label='Trạng thái' value={statusMeta.label} /></CCol>
      </CRow>

      <CRow className='g-4 mb-4'>
        <CCol xl={6}>
          <CCard className='h-100'>
            <CCardHeader><strong>Thông tin chung</strong></CCardHeader>
            <CCardBody>
              <div className='mb-3'><div className='small text-body-secondary'>Quy tắc đạt chương trình</div><div className='fw-semibold'>{getExamProgramPassingMethodLabel(program.passingMethod)}</div></div>
              <div className='mb-3'><div className='small text-body-secondary'>Mô tả mục tiêu</div><div style={{ whiteSpace: 'pre-wrap' }}>{program.targetDescription || 'Chưa có mô tả.'}</div></div>
              <div className='mb-3'><div className='small text-body-secondary'>Hiệu lực từ</div><div>{formatExamProgramDate(program.validFrom)}</div></div>
              <div><div className='small text-body-secondary'>Hiệu lực đến</div><div>{formatExamProgramDate(program.validTo)}</div></div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xl={6}>
          <CCard className='h-100'>
            <CCardHeader><strong>Cấu hình thanh toán</strong></CCardHeader>
            <CCardBody>
              <div className='mb-3'><div className='small text-body-secondary'>Phương thức tính lệ phí</div><div>{getExamProgramFeeCalculationMethodLabel(program.feeCalculationMethod)}</div></div>
              <div className='mb-3'><div className='small text-body-secondary'>Lệ phí mặc định</div><div>{formatExamProgramFee(program.defaultFee, program.feeCalculationMethod)}</div></div>
              <div><div className='small text-body-secondary'>Số môn thuộc chương trình</div><div>{program.programSubjectCount === null ? 'Chưa có dữ liệu' : program.programSubjectCount}</div></div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xl={6}>
          <CCard className='h-100'>
            <CCardHeader><strong>Cấu hình đăng ký</strong></CCardHeader>
            <CCardBody>
              <div className='mb-3'><div className='small text-body-secondary'>Chọn môn / kỹ năng</div><div>Schema hiện tại của exam-program không có các field `allowSubjectSelection` hoặc `allowComponentSelection`.</div></div>
              <div><div className='small text-body-secondary'>Quy tắc đang có trên model</div><div>{getExamProgramPassingMethodLabel(program.passingMethod)}</div></div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xl={6}>
          <CCard className='h-100'>
            <CCardHeader><strong>Thông tin hệ thống</strong></CCardHeader>
            <CCardBody>
              <div className='mb-3'><div className='small text-body-secondary'>Tạo lúc</div><div>{formatExamConfigDateTime(program.createdAt)}</div></div>
              <div><div className='small text-body-secondary'>Cập nhật lúc</div><div>{formatExamConfigDateTime(program.updatedAt)}</div></div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CCard>
        <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
          <div>
            <strong>Môn thuộc chương trình</strong>
            <div className='small text-body-secondary'>Thêm, loại bỏ, sắp xếp hoặc cấu hình từng môn trong chương trình tại đây.</div>
          </div>
          {canManage ? <CButton color='primary' variant='outline' size='sm' onClick={openStructureEditor} disabled={structureSaving}>Thêm / Xóa / Sắp xếp môn</CButton> : null}
        </CCardHeader>
        <CCardBody>
          {hasProgramSubjects ? (
            <CTable responsive hover align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Thứ tự</CTableHeaderCell>
                  <CTableHeaderCell>Môn thi</CTableHeaderCell>
                  <CTableHeaderCell>Bắt buộc</CTableHeaderCell>
                  <CTableHeaderCell>Điều kiện đạt áp dụng</CTableHeaderCell>
                  <CTableHeaderCell>Lệ phí áp dụng</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái môn gốc</CTableHeaderCell>
                  <CTableHeaderCell>Thao tác</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {program.programSubjects.map((item) => {
                  const effectiveFee = getExamProgramSubjectEffectiveFee(item)
                  const effectivePassingRule = getExamProgramSubjectEffectivePassingRule(item)
                  return (
                  <CTableRow key={item.id}>
                    <CTableDataCell>{item.displayOrder}</CTableDataCell>
                    <CTableDataCell>
                      <div className='fw-semibold'>{item.examSubjectName || '-'}</div>
                      <div className='small text-body-secondary'>{item.examSubjectCode || '-'} • {item.examSubjectCalculationMethod || '-'}</div>
                      {item.examSubjectIsActive ? null : <div className='small text-warning'>Môn gốc đã ngừng sử dụng</div>}
                    </CTableDataCell>
                    <CTableDataCell>{item.isRequired ? 'Có' : 'Không'}</CTableDataCell>
                    <CTableDataCell>{effectivePassingRule.label}</CTableDataCell>
                    <CTableDataCell>{effectiveFee.source === 'override' ? formatExamProgramSubjectFee(item) : effectiveFee.source === 'default' ? `Theo môn: ${formatExamProgramFee(effectiveFee.value, 'fixed')}` : 'Chưa cấu hình'}</CTableDataCell>
                    <CTableDataCell>{item.examSubjectIsActive ? 'Đang hoạt động' : 'Ngừng sử dụng'}</CTableDataCell>
                    <CTableDataCell>{canManage ? <CButton size='sm' color='secondary' variant='outline' onClick={() => openProgramSubjectConfig(item)}>Cấu hình</CButton> : null}</CTableDataCell>
                  </CTableRow>
                )})}
              </CTableBody>
            </CTable>
          ) : (
            <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap'>
              <div className='text-body-secondary'>Chương trình chưa có môn thi. Hãy cấu hình danh sách môn ở bước tiếp theo.</div>
              {canManage ? <CButton color='primary' size='sm' onClick={openStructureEditor} disabled={structureSaving}>Thêm môn vào chương trình</CButton> : null}
            </div>
          )}
        </CCardBody>
      </CCard>

      <ExamProgramFormModal
        visible={editorState.open}
        mode={editorState.mode}
        initialValues={editorState.initialValues}
        onClose={closeEditor}
        onSubmit={handleFormSubmit}
        submitting={Boolean(activeMutation)}
        submitError={formError}
        fieldErrors={fieldErrors}
      />

      <ExamProgramStatusConfirmModal
        visible={confirmState.open}
        nextActive={confirmState.nextActive}
        error={confirmState.error}
        submitting={activeMutation === 'toggle-active'}
        onClose={closeStatusConfirm}
        onConfirm={handleStatusConfirm}
      />

      <ExamProgramStructureEditorModal
        visible={structureEditorOpen}
        program={program}
        saving={structureSaving}
        saveError={structureError}
        onClose={closeStructureEditor}
        onSubmit={handleStructureSubmit}
      />

      <ExamProgramSubjectConfigModal
        visible={programSubjectConfigState.open}
        item={programSubjectConfigState.item}
        saving={programSubjectConfigState.saving}
        submitError={programSubjectConfigState.error}
        fieldErrors={programSubjectConfigState.fieldErrors}
        onClose={closeProgramSubjectConfig}
        onSubmit={handleProgramSubjectConfigSubmit}
      />

      <CToaster placement='top-end'>
        <CToast visible={toastState.visible} autohide delay={2500} color={toastState.color} onClose={() => setToastState((current) => ({ ...current, visible: false }))}>
          <CToastBody>{toastState.message}</CToastBody>
        </CToast>
      </CToaster>
    </CContainer>
  )
}