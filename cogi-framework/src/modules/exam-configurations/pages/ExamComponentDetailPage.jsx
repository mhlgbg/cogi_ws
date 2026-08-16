import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  CBreadcrumb,
  CBreadcrumbItem,
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CRow,
  CToast,
  CToastBody,
  CToaster,
  CSpinner,
} from '@coreui/react'
import ExamComponentFormModal from '../components/ExamComponentFormModal'
import ExamComponentStatusConfirmModal from '../components/ExamComponentStatusConfirmModal'
import useExamComponentMutations from '../hooks/useExamComponentMutations'
import { getExamComponent } from '../services/examComponentApi'
import { useFeature } from '../../../contexts/FeatureContext'
import {
  buildExamComponentFormValues,
  mapExamComponentFormValuesToCreatePayload,
  mapExamComponentFormValuesToUpdatePayload,
} from '../utils/examComponentForm'
import {
  buildExamConfigurationDetailPath,
  buildExamConfigurationPath,
  formatExamScore,
  getApiMessage,
  getExamComponentTypeLabel,
  getExamMethodLabel,
  getExamStatusBadgeMeta,
  resolveExamComponentMutationError,
} from '../utils/examConfigurationUi'

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

export default function ExamComponentDetailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { id, tenantCode } = useParams()
  const feature = useFeature()
  const [loading, setLoading] = useState(true)
  const [component, setComponent] = useState(null)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [toastState, setToastState] = useState({ visible: false, color: 'success', message: '' })
  const [editorState, setEditorState] = useState({ open: false, mode: 'edit', initialValues: buildExamComponentFormValues() })
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [confirmState, setConfirmState] = useState({ open: false, nextActive: true, error: '' })
  const canManage = feature?.isLoading ? false : feature?.hasFeature?.('exam-round.manage') || false
  const { activeMutation, createExamComponent, updateExamComponent, setExamComponentActive } = useExamComponentMutations()

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getExamComponent(id)
        if (!mounted) return
        setComponent(result || null)
      } catch (requestError) {
        if (!mounted) return
        setComponent(null)
        setError(getApiMessage(requestError, 'Không tải được chi tiết kỹ năng thi.'))
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
    navigate(buildExamConfigurationDetailPath('components', id, tenantCode), { replace: true, state: null })
  }, [id, location.state, navigate, tenantCode])

  function reloadDetail() {
    setReloadToken((current) => current + 1)
  }

  function openEditModal() {
    setFormError('')
    setFieldErrors({})
    setEditorState({ open: true, mode: 'edit', initialValues: buildExamComponentFormValues(component, { mode: 'edit' }) })
  }

  function openCloneModal() {
    setFormError('')
    setFieldErrors({})
    setEditorState({ open: true, mode: 'clone', initialValues: buildExamComponentFormValues(component, { mode: 'clone' }) })
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

  async function handleFormSubmit(values) {
    setFormError('')
    setFieldErrors({})

    try {
      if (editorState.mode === 'edit') {
        const payload = mapExamComponentFormValuesToUpdatePayload(values, buildExamComponentFormValues(component, { mode: 'edit' }))
        if (Object.keys(payload).length === 0) {
          closeEditor()
          return
        }
        await updateExamComponent(component.id || component.documentId, payload)
        setToastState({ visible: true, color: 'success', message: 'Đã cập nhật kỹ năng thi.' })
        closeEditor()
        reloadDetail()
        return
      }

      const created = await createExamComponent(mapExamComponentFormValuesToCreatePayload(values))
      closeEditor()
      navigate(buildExamConfigurationDetailPath('components', created?.id || created?.documentId, tenantCode), {
        state: {
          toast: {
            color: 'success',
            message: 'Đã tạo bản sao kỹ năng thi.',
          },
        },
      })
    } catch (requestError) {
      const resolvedError = resolveExamComponentMutationError(requestError, editorState.mode === 'edit' ? 'Không thể cập nhật kỹ năng thi.' : 'Không thể tạo bản sao kỹ năng thi.')
      setFormError(resolvedError.message)
      setFieldErrors(resolvedError.fieldErrors || {})
    }
  }

  async function handleStatusConfirm() {
    try {
      await setExamComponentActive(component.id || component.documentId, confirmState.nextActive)
      setToastState({
        visible: true,
        color: 'success',
        message: confirmState.nextActive ? 'Đã kích hoạt lại kỹ năng thi.' : 'Đã ngừng sử dụng kỹ năng thi.',
      })
      closeStatusConfirm()
      reloadDetail()
    } catch (requestError) {
      const resolvedError = resolveExamComponentMutationError(requestError, confirmState.nextActive ? 'Không thể kích hoạt lại kỹ năng thi.' : 'Không thể ngừng sử dụng kỹ năng thi.')
      setConfirmState((current) => ({ ...current, error: resolvedError.message }))
    }
  }

  if (loading) return <SpinnerCenter />

  if (!component) {
    return (
      <CContainer fluid className='py-4'>
        <div className='alert alert-danger'>{error || 'Không tìm thấy kỹ năng thi.'}</div>
        <CButton color='secondary' variant='outline' onClick={() => navigate(buildExamConfigurationPath('components', tenantCode))}>Quay lại danh sách</CButton>
      </CContainer>
    )
  }

  const statusMeta = getExamStatusBadgeMeta(component.isActive)
  const canManageComponent = canManage && component.componentType === 'skill'

  return (
    <CContainer fluid className='py-4'>
      <CBreadcrumb className='mb-3'>
        <CBreadcrumbItem><button type='button' className='btn btn-link p-0 text-decoration-none' onClick={() => navigate(buildExamConfigurationPath('components', tenantCode))}>Kỹ năng thi</button></CBreadcrumbItem>
        <CBreadcrumbItem active>{component.code || component.name || 'Chi tiết kỹ năng thi'}</CBreadcrumbItem>
      </CBreadcrumb>

      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
        <div>
          <div className='d-flex align-items-center gap-2 flex-wrap mb-2'>
            <CButton color='secondary' variant='outline' onClick={() => navigate(buildExamConfigurationPath('components', tenantCode))}>Quay lại</CButton>
            <div className='fs-4 fw-semibold'>{component.name || '-'}</div>
            <span className={`badge text-bg-${statusMeta.color}`}>{statusMeta.label}</span>
          </div>
          <div className='text-body-secondary'>{component.code || '-'} • {getExamComponentTypeLabel(component.componentType)} • {getExamMethodLabel(component.examMethod)}</div>
        </div>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={reloadDetail}>Tải lại trang</CButton>
          {canManageComponent ? <CButton color='warning' variant='outline' onClick={openEditModal} disabled={Boolean(activeMutation)}>Chỉnh sửa</CButton> : null}
          {canManageComponent ? <CButton color='secondary' variant='outline' onClick={openCloneModal} disabled={Boolean(activeMutation)}>Nhân bản</CButton> : null}
          {canManageComponent && component.isActive ? <CButton color='warning' onClick={() => openStatusConfirm(false)} disabled={Boolean(activeMutation)}>Ngừng sử dụng</CButton> : null}
          {canManageComponent && !component.isActive ? <CButton color='primary' onClick={() => openStatusConfirm(true)} disabled={Boolean(activeMutation)}>Kích hoạt lại</CButton> : null}
        </div>
      </div>

      {feature?.isLoading ? <CAlert color='secondary'>Đang tải quyền thao tác...</CAlert> : null}
      {!feature?.isLoading && canManage && component.componentType !== 'skill' ? <CAlert color='info'>Record này không thuộc loại kỹ năng thi (`skill`), nên các action ghi của bước hiện tại không được hiển thị.</CAlert> : null}

      <CRow className='g-3 mb-4'>
        <CCol md={3} sm={6}><InfoCard label='Loại cấu phần' value={getExamComponentTypeLabel(component.componentType)} /></CCol>
        <CCol md={3} sm={6}><InfoCard label='Phương thức thi' value={getExamMethodLabel(component.examMethod)} /></CCol>
        <CCol md={3} sm={6}><InfoCard label='Thời lượng mặc định' value={component.defaultDurationMinutes ? `${component.defaultDurationMinutes} phút` : '-'} /></CCol>
        <CCol md={3} sm={6}><InfoCard label='Thứ tự hiển thị' value={String(component.displayOrder ?? 0)} /></CCol>
      </CRow>

      <CRow className='g-3 mb-4'>
        <CCol md={3} sm={6}><InfoCard label='Điểm tối thiểu' value={formatExamScore(component.minimumScore)} /></CCol>
        <CCol md={3} sm={6}><InfoCard label='Điểm tối đa' value={formatExamScore(component.maximumScore)} /></CCol>
        <CCol md={3} sm={6}><InfoCard label='Điểm đạt' value={formatExamScore(component.passingScore)} /></CCol>
        <CCol md={3} sm={6}><InfoCard label='Điểm liệt' value={formatExamScore(component.eliminationScore)} /></CCol>
      </CRow>

      <CCard>
        <CCardBody>
          <div className='small text-body-secondary mb-2'>Mô tả</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{component.description || 'Chưa có mô tả cho kỹ năng thi này.'}</div>
        </CCardBody>
      </CCard>

      <ExamComponentFormModal
        visible={editorState.open}
        mode={editorState.mode}
        initialValues={editorState.initialValues}
        onClose={closeEditor}
        onSubmit={handleFormSubmit}
        submitting={Boolean(activeMutation)}
        submitError={formError}
        fieldErrors={fieldErrors}
      />

      <ExamComponentStatusConfirmModal
        visible={confirmState.open}
        nextActive={confirmState.nextActive}
        error={confirmState.error}
        submitting={activeMutation === 'toggle-active'}
        onClose={closeStatusConfirm}
        onConfirm={handleStatusConfirm}
      />

      <CToaster placement='top-end'>
        <CToast visible={toastState.visible} autohide delay={2500} color={toastState.color} onClose={() => setToastState((current) => ({ ...current, visible: false }))}>
          <CToastBody>{toastState.message}</CToastBody>
        </CToast>
      </CToaster>
    </CContainer>
  )
}