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
import ExamSubjectFormModal from '../components/ExamSubjectFormModal'
import ExamSubjectComponentConfigModal from '../components/ExamSubjectComponentConfigModal'
import ExamSubjectStatusConfirmModal from '../components/ExamSubjectStatusConfirmModal'
import ExamSubjectStructureEditorModal from '../components/ExamSubjectStructureEditorModal'
import useExamSubjectMutations from '../hooks/useExamSubjectMutations'
import { getExamSubject, replaceExamSubjectComponents, updateExamSubjectComponent } from '../services/examSubjectApi'
import { useFeature } from '../../../contexts/FeatureContext'
import {
  buildExamConfigurationDetailPath,
  buildExamConfigurationPath,
  getExamMethodLabel,
  resolveExamSubjectMutationError,
  resolveExamSubjectReadError,
} from '../utils/examConfigurationUi'
import {
  buildExamSubjectFormValues,
  mapExamSubjectFormValuesToCreatePayload,
  mapExamSubjectFormValuesToUpdatePayload,
} from '../utils/examSubjectForm'
import {
  formatExamConfigDateTime,
  formatExamConfigMoney,
  formatEffectiveDuration,
  formatEffectiveScore,
  getEffectiveDuration,
  getEffectivePassingScore,
  getExamSubjectCalculationMethodLabel,
  getExamSubjectPassingSummary,
  getExamSubjectStatusMeta,
} from '../utils/examSubjectUi'

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

export default function ExamSubjectDetailPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { id, tenantCode } = useParams()
  const feature = useFeature()
  const [loading, setLoading] = useState(true)
  const [subject, setSubject] = useState(null)
  const [error, setError] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [toastState, setToastState] = useState({ visible: false, color: 'success', message: '' })
  const [editorState, setEditorState] = useState({ open: false, mode: 'edit', initialValues: buildExamSubjectFormValues() })
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [confirmState, setConfirmState] = useState({ open: false, nextActive: true, error: '' })
  const [structureEditorOpen, setStructureEditorOpen] = useState(false)
  const [structureSaving, setStructureSaving] = useState(false)
  const [structureError, setStructureError] = useState('')
  const [componentConfigState, setComponentConfigState] = useState({ open: false, item: null, error: '', fieldErrors: {}, saving: false })
  const canManage = feature?.isLoading ? false : feature?.hasFeature?.('exam-round.manage') || false
  const { activeMutation, createExamSubject, updateExamSubject, setExamSubjectActive } = useExamSubjectMutations()

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getExamSubject(id)
        if (!mounted) return
        setSubject(result || null)
      } catch (requestError) {
        if (!mounted) return
        setSubject(null)
        setError(resolveExamSubjectReadError(requestError, 'Không tải được chi tiết môn thi.'))
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
    navigate(buildExamConfigurationDetailPath('subjects', id, tenantCode), { replace: true, state: null })
  }, [id, location.state, navigate, tenantCode])

  function reloadDetail() {
    setReloadToken((current) => current + 1)
  }

  function openEditModal() {
    setFormError('')
    setFieldErrors({})
    setEditorState({ open: true, mode: 'edit', initialValues: buildExamSubjectFormValues(subject, { mode: 'edit' }) })
  }

  function openCloneModal() {
    setFormError('')
    setFieldErrors({})
    setEditorState({ open: true, mode: 'clone', initialValues: buildExamSubjectFormValues(subject, { mode: 'clone' }) })
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

  function openComponentConfig(item) {
    setComponentConfigState({ open: true, item: { ...item, subjectName: subject?.name || '' }, error: '', fieldErrors: {}, saving: false })
  }

  function closeComponentConfig() {
    if (componentConfigState.saving) return
    setComponentConfigState({ open: false, item: null, error: '', fieldErrors: {}, saving: false })
  }

  async function handleFormSubmit(values) {
    setFormError('')
    setFieldErrors({})

    try {
      if (editorState.mode === 'edit') {
        const payload = mapExamSubjectFormValuesToUpdatePayload(values, buildExamSubjectFormValues(subject, { mode: 'edit' }))
        if (Object.keys(payload).length === 0) {
          closeEditor()
          return
        }
        await updateExamSubject(subject.id || subject.documentId, payload)
        setToastState({ visible: true, color: 'success', message: 'Đã cập nhật môn thi.' })
        closeEditor()
        reloadDetail()
        return
      }

      const created = await createExamSubject(mapExamSubjectFormValuesToCreatePayload(values))
      closeEditor()
      navigate(buildExamConfigurationDetailPath('subjects', created?.id || created?.documentId, tenantCode), {
        state: {
          toast: {
            color: 'success',
            message: 'Đã tạo bản sao môn thi.',
          },
        },
      })
    } catch (requestError) {
      const resolvedError = resolveExamSubjectMutationError(requestError, editorState.mode === 'edit' ? 'Không thể cập nhật môn thi.' : 'Không thể tạo bản sao môn thi.')
      setFormError(resolvedError.message)
      setFieldErrors(resolvedError.fieldErrors || {})
    }
  }

  async function handleStatusConfirm() {
    try {
      await setExamSubjectActive(subject.id || subject.documentId, confirmState.nextActive)
      setToastState({
        visible: true,
        color: 'success',
        message: confirmState.nextActive ? 'Đã kích hoạt lại môn thi.' : 'Đã ngừng sử dụng môn thi.',
      })
      closeStatusConfirm()
      reloadDetail()
    } catch (requestError) {
      const resolvedError = resolveExamSubjectMutationError(requestError, confirmState.nextActive ? 'Không thể kích hoạt lại môn thi.' : 'Không thể ngừng sử dụng môn thi.')
      setConfirmState((current) => ({ ...current, error: resolvedError.message }))
    }
  }

  async function handleStructureSubmit(componentIds) {
    setStructureSaving(true)
    setStructureError('')

    try {
      await replaceExamSubjectComponents(subject.id || subject.documentId, componentIds)
      setToastState({ visible: true, color: 'success', message: 'Đã cập nhật cấu trúc kỹ năng của môn thi.' })
      setStructureEditorOpen(false)
      reloadDetail()
    } catch (requestError) {
      const resolvedError = resolveExamSubjectMutationError(requestError, 'Không thể cập nhật cấu trúc kỹ năng của môn thi.')
      setStructureError(resolvedError.message)
    } finally {
      setStructureSaving(false)
    }
  }

  async function handleComponentConfigSubmit(payload) {
    setComponentConfigState((current) => ({ ...current, saving: true, error: '', fieldErrors: {} }))

    try {
      await updateExamSubjectComponent(subject.id || subject.documentId, componentConfigState.item?.id, payload)
      setToastState({ visible: true, color: 'success', message: 'Đã cập nhật cấu hình kỹ năng trong môn.' })
      setComponentConfigState({ open: false, item: null, error: '', fieldErrors: {}, saving: false })
      reloadDetail()
    } catch (requestError) {
      const resolvedError = resolveExamSubjectMutationError(requestError, 'Không thể cập nhật cấu hình kỹ năng trong môn.')
      setComponentConfigState((current) => ({ ...current, saving: false, error: resolvedError.message, fieldErrors: resolvedError.fieldErrors || {} }))
    }
  }

  if (loading) return <SpinnerCenter />

  if (!subject) {
    return (
      <CContainer fluid className='py-4'>
        <div className='alert alert-danger'>{error || 'Không tìm thấy môn thi.'}</div>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={() => navigate(buildExamConfigurationPath('subjects', tenantCode))}>Quay lại danh sách</CButton>
          <CButton color='danger' variant='outline' onClick={() => setReloadToken((current) => current + 1)}>Thử lại</CButton>
        </div>
      </CContainer>
    )
  }

  const statusMeta = getExamSubjectStatusMeta(subject.isActive)
  const hasComponentsSummary = Array.isArray(subject.subjectComponents) && subject.subjectComponents.length > 0
  const hasInactiveComponents = Array.isArray(subject.subjectComponents) && subject.subjectComponents.some((item) => item.examComponentIsActive === false)

  return (
    <CContainer fluid className='py-4'>
      <CBreadcrumb className='mb-3'>
        <CBreadcrumbItem><button type='button' className='btn btn-link p-0 text-decoration-none' onClick={() => navigate(buildExamConfigurationPath('overview', tenantCode))}>Cấu hình thi chuẩn đầu ra</button></CBreadcrumbItem>
        <CBreadcrumbItem><button type='button' className='btn btn-link p-0 text-decoration-none' onClick={() => navigate(buildExamConfigurationPath('subjects', tenantCode))}>Môn thi</button></CBreadcrumbItem>
        <CBreadcrumbItem active>{subject.name || subject.code || 'Chi tiết môn thi'}</CBreadcrumbItem>
      </CBreadcrumb>

      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
        <div>
          <div className='d-flex align-items-center gap-2 flex-wrap mb-2'>
            <CButton color='secondary' variant='outline' onClick={() => navigate(buildExamConfigurationPath('subjects', tenantCode))}>Quay lại</CButton>
            <div className='fs-4 fw-semibold'>{subject.name || '-'}</div>
            <span className={`badge text-bg-${statusMeta.color}`}>{statusMeta.label}</span>
          </div>
          <div className='text-body-secondary'>{subject.code || '-'} • {getExamSubjectCalculationMethodLabel(subject.calculationMethod)}</div>
        </div>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={reloadDetail}>Tải lại trang</CButton>
          {canManage ? <CButton color='warning' variant='outline' onClick={openEditModal} disabled={Boolean(activeMutation)}>Chỉnh sửa</CButton> : null}
          {canManage ? <CButton color='secondary' variant='outline' onClick={openCloneModal} disabled={Boolean(activeMutation)}>Nhân bản</CButton> : null}
          {canManage ? <CButton color='info' variant='outline' onClick={openStructureEditor} disabled={structureSaving}>Quản lý kỹ năng trong môn</CButton> : null}
          {canManage && subject.isActive ? <CButton color='warning' onClick={() => openStatusConfirm(false)} disabled={Boolean(activeMutation)}>Ngừng sử dụng</CButton> : null}
          {canManage && !subject.isActive ? <CButton color='primary' onClick={() => openStatusConfirm(true)} disabled={Boolean(activeMutation)}>Kích hoạt lại</CButton> : null}
        </div>
      </div>

      {feature?.isLoading ? <CAlert color='secondary'>Đang tải quyền thao tác...</CAlert> : null}
      {!feature?.isLoading && subject.isActive && hasInactiveComponents ? <CAlert color='warning'>Môn thi này đang chứa kỹ năng inactive. Bước hiện tại chỉ cảnh báo read-only và không tự thay đổi cấu trúc kỹ năng.</CAlert> : null}

      <CRow className='g-3 mb-4'>
        <CCol xl={4} md={6}><InfoCard label='Mã môn' value={subject.code} /></CCol>
        <CCol xl={4} md={6}><InfoCard label='Tên môn' value={subject.name} /></CCol>
        <CCol xl={4} md={6}><InfoCard label='Trạng thái' value={statusMeta.label} /></CCol>
      </CRow>

      <CRow className='g-4 mb-4'>
        <CCol xl={6}>
          <CCard className='h-100'>
            <CCardHeader><strong>Thông tin chung</strong></CCardHeader>
            <CCardBody>
              <div className='mb-3'><div className='small text-body-secondary'>Cách tính kết quả</div><div className='fw-semibold'>{getExamSubjectCalculationMethodLabel(subject.calculationMethod)}</div></div>
              <div className='mb-3'><div className='small text-body-secondary'>Điều kiện đạt</div><div>{getExamSubjectPassingSummary(subject)}</div></div>
              <div><div className='small text-body-secondary'>Mô tả quy tắc</div><div style={{ whiteSpace: 'pre-wrap' }}>{subject.ruleDescription || 'Chưa có mô tả.'}</div></div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xl={6}>
          <CCard className='h-100'>
            <CCardHeader><strong>Cấu hình điểm</strong></CCardHeader>
            <CCardBody>
              <div className='mb-3'><div className='small text-body-secondary'>Điểm tổng hợp yêu cầu</div><div>{subject.requiredAggregateScore === null ? 'Chưa cấu hình đầy đủ' : subject.requiredAggregateScore}</div></div>
              <div className='mb-3'><div className='small text-body-secondary'>Yêu cầu tất cả kỹ năng đạt</div><div>{subject.requireAllComponents ? 'Có' : 'Không'}</div></div>
              <div><div className='small text-body-secondary'>Tóm tắt cấu hình</div><div>{getExamSubjectPassingSummary(subject)}</div></div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xl={6}>
          <CCard className='h-100'>
            <CCardHeader><strong>Cấu hình lệ phí</strong></CCardHeader>
            <CCardBody>
              <div className='mb-3'><div className='small text-body-secondary'>Lệ phí mặc định</div><div>{formatExamConfigMoney(subject.defaultFee)}</div></div>
              <div><div className='small text-body-secondary'>Loại tiền</div><div>VND</div></div>
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xl={6}>
          <CCard className='h-100'>
            <CCardHeader><strong>Thông tin hệ thống</strong></CCardHeader>
            <CCardBody>
              <div className='mb-3'><div className='small text-body-secondary'>Tạo lúc</div><div>{formatExamConfigDateTime(subject.createdAt)}</div></div>
              <div><div className='small text-body-secondary'>Cập nhật lúc</div><div>{formatExamConfigDateTime(subject.updatedAt)}</div></div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CCard>
        <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
          <div>
            <strong>Kỹ năng thuộc môn</strong>
            <div className='small text-body-secondary'>Thêm, xóa hoặc sắp xếp kỹ năng của môn thi tại đây.</div>
          </div>
          {canManage ? <CButton color='primary' variant='outline' size='sm' onClick={openStructureEditor} disabled={structureSaving}>Thêm / Xóa / Sắp xếp kỹ năng</CButton> : null}
        </CCardHeader>
        <CCardBody>
          {hasComponentsSummary ? (
            <CTable responsive hover align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Thứ tự</CTableHeaderCell>
                  <CTableHeaderCell>Kỹ năng</CTableHeaderCell>
                  <CTableHeaderCell>Bắt buộc</CTableHeaderCell>
                  <CTableHeaderCell>Trọng số</CTableHeaderCell>
                  <CTableHeaderCell>Điểm đạt áp dụng</CTableHeaderCell>
                  <CTableHeaderCell>Thời lượng áp dụng</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Thao tác</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {subject.subjectComponents.map((item) => {
                  const effectivePassingScore = getEffectivePassingScore(item)
                  const effectiveDuration = getEffectiveDuration(item)
                  return (
                  <CTableRow key={item.id}>
                    <CTableDataCell>{item.displayOrder}</CTableDataCell>
                    <CTableDataCell>
                      <div className='fw-semibold'>{item.examComponentName || '-'}</div>
                      <div className='small text-body-secondary'>{item.examComponentCode || '-'} • {getExamMethodLabel(item.examMethod)}</div>
                      {item.examComponentIsActive === false ? <div className='small text-warning'>Kỹ năng gốc đã ngừng sử dụng</div> : null}
                    </CTableDataCell>
                    <CTableDataCell>{item.isRequired ? 'Có' : 'Không'}</CTableDataCell>
                    <CTableDataCell>{item.weight === null ? '-' : item.weight}</CTableDataCell>
                    <CTableDataCell>{formatEffectiveScore(effectivePassingScore)}</CTableDataCell>
                    <CTableDataCell>{formatEffectiveDuration(effectiveDuration)}</CTableDataCell>
                    <CTableDataCell>{item.examComponentIsActive === false ? 'Kỹ năng gốc inactive' : 'Đang dùng'}</CTableDataCell>
                    <CTableDataCell>
                      {canManage ? <CButton size='sm' color='secondary' variant='outline' onClick={() => openComponentConfig(item)}>Cấu hình</CButton> : null}
                    </CTableDataCell>
                  </CTableRow>
                )})}
              </CTableBody>
            </CTable>
          ) : (
            <div className='d-flex justify-content-between align-items-center gap-3 flex-wrap'>
              <div className='text-body-secondary'>Môn thi này chưa có kỹ năng nào được cấu hình.</div>
              {canManage ? <CButton color='primary' size='sm' onClick={openStructureEditor} disabled={structureSaving}>Thêm kỹ năng vào môn</CButton> : null}
            </div>
          )}
        </CCardBody>
      </CCard>

      <ExamSubjectFormModal
        visible={editorState.open}
        mode={editorState.mode}
        initialValues={editorState.initialValues}
        onClose={closeEditor}
        onSubmit={handleFormSubmit}
        submitting={Boolean(activeMutation)}
        submitError={formError}
        fieldErrors={fieldErrors}
      />

      <ExamSubjectStatusConfirmModal
        visible={confirmState.open}
        nextActive={confirmState.nextActive}
        error={confirmState.error}
        submitting={activeMutation === 'toggle-active'}
        onClose={closeStatusConfirm}
        onConfirm={handleStatusConfirm}
      />

      <ExamSubjectStructureEditorModal
        visible={structureEditorOpen}
        subject={subject}
        saving={structureSaving}
        saveError={structureError}
        onClose={closeStructureEditor}
        onSubmit={handleStructureSubmit}
      />

      <ExamSubjectComponentConfigModal
        visible={componentConfigState.open}
        item={componentConfigState.item}
        saving={componentConfigState.saving}
        submitError={componentConfigState.error}
        fieldErrors={componentConfigState.fieldErrors}
        onClose={closeComponentConfig}
        onSubmit={handleComponentConfigSubmit}
      />

      <CToaster placement='top-end'>
        <CToast visible={toastState.visible} autohide delay={2500} color={toastState.color} onClose={() => setToastState((current) => ({ ...current, visible: false }))}>
          <CToastBody>{toastState.message}</CToastBody>
        </CToast>
      </CToaster>
    </CContainer>
  )
}