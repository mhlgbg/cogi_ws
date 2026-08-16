import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CAlert, CButton, CCard, CCardBody, CCardHeader, CCol, CContainer, CRow, CSpinner, CToast, CToastBody, CToaster, CBreadcrumb, CBreadcrumbItem } from '@coreui/react'
import OutcomeStandardFormModal from '../components/OutcomeStandardFormModal'
import OutcomeStandardStatusConfirmModal from '../components/OutcomeStandardStatusConfirmModal'
import useOutcomeStandardMutations from '../hooks/useOutcomeStandardMutations'
import { listExamPrograms } from '../services/examProgramApi'
import { getOutcomeStandard } from '../services/outcomeStandardApi'
import { useFeature } from '../../../contexts/FeatureContext'
import { buildExamConfigurationDetailPath, buildExamConfigurationPath, resolveOutcomeStandardMutationError, resolveOutcomeStandardReadError } from '../utils/examConfigurationUi'
import { buildOutcomeStandardFormValues, mapOutcomeStandardFormValuesToCreatePayload, mapOutcomeStandardFormValuesToUpdatePayload } from '../utils/outcomeStandardForm'
import { formatOutcomeEffectiveDateRange, getOutcomeRecognitionMethodLabel, getOutcomeStatusMeta } from '../utils/outcomeStandardUi'
import { formatExamConfigDateTime } from '../utils/examSubjectUi'

function SpinnerCenter() { return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><CSpinner /></div> }
function InfoCard({ label, value }) { return <CCard className='h-100'><CCardBody><div className='small text-body-secondary'>{label}</div><div className='fw-semibold'>{value || '-'}</div></CCardBody></CCard> }

export default function OutcomeStandardDetailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { id, tenantCode } = useParams()
  const feature = useFeature()
  const [loading, setLoading] = useState(true)
  const [outcome, setOutcome] = useState(null)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [toastState, setToastState] = useState({ visible: false, color: 'success', message: '' })
  const [editorState, setEditorState] = useState({ open: false, mode: 'edit', initialValues: buildOutcomeStandardFormValues() })
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [confirmState, setConfirmState] = useState({ open: false, nextActive: true, error: '' })
  const [examProgramOptions, setExamProgramOptions] = useState([])
  const canManage = feature?.isLoading ? false : feature?.hasFeature?.('exam-round.manage') || false
  const { activeMutation, createOutcomeStandard, updateOutcomeStandard, setOutcomeStandardActive } = useOutcomeStandardMutations()

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getOutcomeStandard(id)
        if (!mounted) return
        setOutcome(result || null)
      } catch (requestError) {
        if (!mounted) return
        setOutcome(null)
        setError(resolveOutcomeStandardReadError(requestError, 'Không tải được chi tiết chuẩn đầu ra.'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id, reloadToken])

  useEffect(() => {
    let mounted = true
    async function loadExamProgramOptions() {
      try {
        const result = await listExamPrograms({ page: 1, pageSize: 100, isActive: 'true' })
        if (!mounted) return
        setExamProgramOptions((result?.rows || []).map((item) => ({ value: String(item.id || item.documentId || ''), label: `${item.code} - ${item.name}` })))
      } catch {
        if (mounted) setExamProgramOptions([])
      }
    }
    loadExamProgramOptions()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!toastState.visible) return undefined
    const timer = window.setTimeout(() => setToastState((current) => ({ ...current, visible: false })), 2500)
    return () => window.clearTimeout(timer)
  }, [toastState.visible])

  useEffect(() => {
    const nextToast = location.state?.toast
    if (!nextToast?.message) return
    setToastState({ visible: true, color: nextToast.color || 'success', message: nextToast.message })
    navigate(buildExamConfigurationDetailPath('outcomes', id, tenantCode), { replace: true, state: null })
  }, [id, location.state, navigate, tenantCode])

  function reloadDetail() { setReloadToken((current) => current + 1) }
  function openEditModal() { setFormError(''); setFieldErrors({}); setEditorState({ open: true, mode: 'edit', initialValues: buildOutcomeStandardFormValues(outcome, { mode: 'edit' }) }) }
  function openCloneModal() { setFormError(''); setFieldErrors({}); setEditorState({ open: true, mode: 'clone', initialValues: buildOutcomeStandardFormValues(outcome, { mode: 'clone' }) }) }
  function closeEditor() { if (activeMutation) return; setEditorState((current) => ({ ...current, open: false })); setFormError(''); setFieldErrors({}) }
  function openStatusConfirm(nextActive) { setConfirmState({ open: true, nextActive, error: '' }) }
  function closeStatusConfirm() { if (activeMutation) return; setConfirmState({ open: false, nextActive: true, error: '' }) }

  async function handleFormSubmit(values) {
    setFormError('')
    setFieldErrors({})
    try {
      if (editorState.mode === 'edit') {
        const payload = mapOutcomeStandardFormValuesToUpdatePayload(values, buildOutcomeStandardFormValues(outcome, { mode: 'edit' }))
        if (Object.keys(payload).length === 0) { closeEditor(); return }
        await updateOutcomeStandard(outcome.id || outcome.documentId, payload)
        setToastState({ visible: true, color: 'success', message: 'Đã cập nhật chuẩn đầu ra.' })
        closeEditor(); reloadDetail(); return
      }
      const created = await createOutcomeStandard(mapOutcomeStandardFormValuesToCreatePayload(values))
      closeEditor()
      navigate(buildExamConfigurationDetailPath('outcomes', created?.id || created?.documentId, tenantCode), { state: { toast: { color: 'success', message: 'Đã tạo bản sao chuẩn đầu ra.' } } })
    } catch (requestError) {
      const resolvedError = resolveOutcomeStandardMutationError(requestError, editorState.mode === 'edit' ? 'Không thể cập nhật chuẩn đầu ra.' : 'Không thể tạo bản sao chuẩn đầu ra.')
      setFormError(resolvedError.message)
      setFieldErrors(resolvedError.fieldErrors || {})
    }
  }

  async function handleStatusConfirm() {
    try {
      await setOutcomeStandardActive(outcome.id || outcome.documentId, confirmState.nextActive)
      setToastState({ visible: true, color: 'success', message: confirmState.nextActive ? 'Đã kích hoạt lại chuẩn đầu ra.' : 'Đã ngừng sử dụng chuẩn đầu ra.' })
      closeStatusConfirm(); reloadDetail()
    } catch (requestError) {
      const resolvedError = resolveOutcomeStandardMutationError(requestError, confirmState.nextActive ? 'Không thể kích hoạt lại chuẩn đầu ra.' : 'Không thể ngừng sử dụng chuẩn đầu ra.')
      setConfirmState((current) => ({ ...current, error: resolvedError.message }))
    }
  }

  if (loading) return <SpinnerCenter />
  if (!outcome) {
    return <CContainer fluid className='py-4'><div className='alert alert-danger'>{error || 'Không tìm thấy chuẩn đầu ra.'}</div><div className='d-flex gap-2 flex-wrap'><CButton color='secondary' variant='outline' onClick={() => navigate(buildExamConfigurationPath('outcomes', tenantCode))}>Quay lại danh sách</CButton><CButton color='danger' variant='outline' onClick={() => setReloadToken((current) => current + 1)}>Thử lại</CButton></div></CContainer>
  }

  const statusMeta = getOutcomeStatusMeta(outcome.isActive)
  return (
    <CContainer fluid className='py-4'>
      <CBreadcrumb className='mb-3'>
        <CBreadcrumbItem><button type='button' className='btn btn-link p-0 text-decoration-none' onClick={() => navigate(buildExamConfigurationPath('overview', tenantCode))}>Cấu hình thi chuẩn đầu ra</button></CBreadcrumbItem>
        <CBreadcrumbItem><button type='button' className='btn btn-link p-0 text-decoration-none' onClick={() => navigate(buildExamConfigurationPath('outcomes', tenantCode))}>Chuẩn đầu ra</button></CBreadcrumbItem>
        <CBreadcrumbItem active>{outcome.name || outcome.code || 'Chi tiết chuẩn đầu ra'}</CBreadcrumbItem>
      </CBreadcrumb>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
        <div><div className='d-flex align-items-center gap-2 flex-wrap mb-2'><CButton color='secondary' variant='outline' onClick={() => navigate(buildExamConfigurationPath('outcomes', tenantCode))}>Quay lại</CButton><div className='fs-4 fw-semibold'>{outcome.name || '-'}</div><span className={`badge text-bg-${statusMeta.color}`}>{statusMeta.label}</span></div><div className='text-body-secondary'>{outcome.code || '-'} • {getOutcomeRecognitionMethodLabel(outcome.recognitionMethod)}</div></div>
        <div className='d-flex gap-2 flex-wrap'><CButton color='secondary' variant='outline' onClick={reloadDetail}>Tải lại trang</CButton>{canManage ? <CButton color='warning' variant='outline' onClick={openEditModal} disabled={Boolean(activeMutation)}>Chỉnh sửa</CButton> : null}{canManage ? <CButton color='secondary' variant='outline' onClick={openCloneModal} disabled={Boolean(activeMutation)}>Nhân bản</CButton> : null}{canManage && outcome.isActive ? <CButton color='warning' onClick={() => openStatusConfirm(false)} disabled={Boolean(activeMutation)}>Ngừng sử dụng</CButton> : null}{canManage && !outcome.isActive ? <CButton color='primary' onClick={() => openStatusConfirm(true)} disabled={Boolean(activeMutation)}>Kích hoạt lại</CButton> : null}</div>
      </div>
      <div className='alert alert-info'>Chuẩn đầu ra là cấu hình dùng để đánh giá và công nhận kết quả. Việc chỉnh sửa chuẩn đầu ra không tự động làm thay đổi dữ liệu đánh giá hoặc kết quả đã được ghi nhận trước đó.</div>
      {outcome.examProgramId && outcome.examProgramIsActive === false ? <CAlert color='warning'>Chương trình gốc của chuẩn đầu ra hiện đang inactive. Bước này chỉ hiển thị cảnh báo và không tự thay đổi dữ liệu liên quan.</CAlert> : null}
      <CRow className='g-3 mb-4'><CCol xl={4} md={6}><InfoCard label='Mã chuẩn' value={outcome.code} /></CCol><CCol xl={4} md={6}><InfoCard label='Tên chuẩn' value={outcome.name} /></CCol><CCol xl={4} md={6}><InfoCard label='Trạng thái' value={statusMeta.label} /></CCol></CRow>
      <CRow className='g-4 mb-4'>
        <CCol xl={6}><CCard className='h-100'><CCardHeader><strong>Thông tin chung</strong></CCardHeader><CCardBody><div className='mb-3'><div className='small text-body-secondary'>Phương thức công nhận</div><div className='fw-semibold'>{getOutcomeRecognitionMethodLabel(outcome.recognitionMethod)}</div></div><div className='mb-3'><div className='small text-body-secondary'>Mô tả áp dụng</div><div style={{ whiteSpace: 'pre-wrap' }}>{outcome.applicableDescription || 'Chưa có mô tả.'}</div></div><div><div className='small text-body-secondary'>Thời gian hiệu lực</div><div>{formatOutcomeEffectiveDateRange(outcome)}</div></div></CCardBody></CCard></CCol>
        <CCol xl={6}><CCard className='h-100'><CCardHeader><strong>Chương trình hoặc môn liên quan</strong></CCardHeader><CCardBody><div className='mb-3'><div className='small text-body-secondary'>Chương trình thi</div><div>{outcome.examProgramName || 'Không gắn chương trình'}</div></div><div><div className='small text-body-secondary'>Trạng thái chương trình gốc</div><div>{outcome.examProgramId ? (outcome.examProgramIsActive ? 'Đang hoạt động' : 'Ngừng sử dụng') : '-'}</div></div></CCardBody></CCard></CCol>
        <CCol xl={6}><CCard className='h-100'><CCardHeader><strong>Điều kiện công nhận</strong></CCardHeader><CCardBody><div className='mb-3'><div className='small text-body-secondary'>Phương thức công nhận</div><div>{getOutcomeRecognitionMethodLabel(outcome.recognitionMethod)}</div></div><div><div className='small text-body-secondary'>Mô tả điều kiện</div><div>{outcome.applicableDescription || 'Schema hiện tại chưa có rule cấu trúc chi tiết hơn cho outcome-standard.'}</div></div></CCardBody></CCard></CCol>
        <CCol xl={6}><CCard className='h-100'><CCardHeader><strong>Thông tin hệ thống</strong></CCardHeader><CCardBody><div className='mb-3'><div className='small text-body-secondary'>Tạo lúc</div><div>{formatExamConfigDateTime(outcome.createdAt)}</div></div><div><div className='small text-body-secondary'>Cập nhật lúc</div><div>{formatExamConfigDateTime(outcome.updatedAt)}</div></div></CCardBody></CCard></CCol>
      </CRow>
      <OutcomeStandardFormModal visible={editorState.open} mode={editorState.mode} initialValues={editorState.initialValues} examProgramOptions={examProgramOptions} onClose={closeEditor} onSubmit={handleFormSubmit} submitting={Boolean(activeMutation)} submitError={formError} fieldErrors={fieldErrors} />
      <OutcomeStandardStatusConfirmModal visible={confirmState.open} nextActive={confirmState.nextActive} error={confirmState.error} submitting={activeMutation === 'toggle-active'} onClose={closeStatusConfirm} onConfirm={handleStatusConfirm} />
      <CToaster placement='top-end'><CToast visible={toastState.visible} autohide delay={2500} color={toastState.color} onClose={() => setToastState((current) => ({ ...current, visible: false }))}><CToastBody>{toastState.message}</CToastBody></CToast></CToaster>
    </CContainer>
  )
}