import { useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
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
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
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
import QuickMessageCreateResultModal from './QuickMessageCreateResultModal'
import {
  buildQuickMessageAccessInitialValues,
  buildQuickMessageAccessPayload,
  canUnlockAccess,
  formatAccessViewCount,
  formatDateTime,
  formatDateTimeInput,
  getQuickMessageAccessStatusMeta,
  validateQuickMessageAccessForm,
} from './quickMessageUi'
import {
  cancelQuickMessageAccess,
  cloneQuickMessageAccessBatch,
  createQuickMessageAccess,
  disableQuickMessageAccessPin,
  enableQuickMessageAccessPin,
  getApiMessage,
  lockQuickMessageAccess,
  unlockQuickMessageAccess,
  updateQuickMessageAccess,
  changeQuickMessageAccessPin,
} from '../services/quickMessageService'

function AccessStatusBadge({ status }) {
  const meta = getQuickMessageAccessStatusMeta(status)
  return <CBadge color={meta.color}>{meta.label}</CBadge>
}

function AccessFormFields({
  form,
  errors,
  disabled,
  includePin = false,
  includeRequirePin = false,
  messageExpiresAt = '',
  onChange,
}) {
  const expiresAfterMessage = useMemo(() => {
    if (!form?.expiresAt || !messageExpiresAt) return false
    const accessDate = new Date(form.expiresAt)
    const messageDate = new Date(messageExpiresAt)
    if (Number.isNaN(accessDate.getTime()) || Number.isNaN(messageDate.getTime())) return false
    return accessDate.getTime() > messageDate.getTime()
  }, [form?.expiresAt, messageExpiresAt])

  return (
    <CRow className='g-3'>
      <CCol md={12}>
        <CFormLabel>Nhãn mã truy cập</CFormLabel>
        <CFormInput value={form.label} onChange={(event) => onChange('label', event.target.value)} placeholder='Ví dụ: Gửi cô Lan' disabled={disabled} />
      </CCol>
      <CCol md={12}>
        <CFormLabel>Người nhận dự kiến</CFormLabel>
        <CFormInput value={form.recipientName} onChange={(event) => onChange('recipientName', event.target.value)} placeholder='Ví dụ: Cô Lan' disabled={disabled} />
      </CCol>
      <CCol md={6}>
        <CFormLabel>Thời gian hết hạn riêng</CFormLabel>
        <CFormInput type='datetime-local' value={form.expiresAt} onChange={(event) => onChange('expiresAt', event.target.value)} disabled={disabled} />
        <div className='small text-body-secondary mt-1'>Nếu để trống, mã sẽ dùng thời hạn chung của thông điệp.</div>
        {errors.expiresAt ? <div className='text-danger small mt-1'>{errors.expiresAt}</div> : null}
        {expiresAfterMessage ? <div className='text-warning small mt-1'>Mã vẫn sẽ hết hạn theo thời hạn chung của thông điệp nếu thời hạn chung đến trước.</div> : null}
      </CCol>
      <CCol md={6}>
        <CFormLabel>Giới hạn lượt xem</CFormLabel>
        <CFormInput type='number' min={1} value={form.maxViews} onChange={(event) => onChange('maxViews', event.target.value)} placeholder='Để trống nếu không giới hạn' disabled={disabled} />
        {errors.maxViews ? <div className='text-danger small mt-1'>{errors.maxViews}</div> : null}
      </CCol>

      {includeRequirePin ? (
        <CCol md={12}>
          <CFormCheck label='Yêu cầu PIN' checked={form.requirePin === true} onChange={(event) => onChange('requirePin', event.target.checked)} disabled={disabled} />
        </CCol>
      ) : null}

      {includePin || form.requirePin ? (
        <>
          <CCol md={6}>
            <CFormLabel>PIN</CFormLabel>
            <CFormInput type='password' inputMode='numeric' value={form.pin || ''} onChange={(event) => onChange('pin', event.target.value)} placeholder='4-6 chữ số' disabled={disabled} />
            {errors.pin ? <div className='text-danger small mt-1'>{errors.pin}</div> : null}
          </CCol>
          <CCol md={6}>
            <CFormLabel>Nhập lại PIN</CFormLabel>
            <CFormInput type='password' inputMode='numeric' value={form.pinConfirm || ''} onChange={(event) => onChange('pinConfirm', event.target.value)} placeholder='Nhập lại PIN' disabled={disabled} />
            {errors.pinConfirm ? <div className='text-danger small mt-1'>{errors.pinConfirm}</div> : null}
          </CCol>
        </>
      ) : null}
    </CRow>
  )
}

export default function QuickMessageAccessesTab({ message = null, accesses = [], onReload }) {
  const rows = Array.isArray(accesses) ? accesses : []
  const [toastState, setToastState] = useState({ visible: false, color: 'success', message: '' })
  const [modalError, setModalError] = useState('')
  const [confirmError, setConfirmError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activeActionId, setActiveActionId] = useState(null)
  const [resultModal, setResultModal] = useState(null)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createForm, setCreateForm] = useState(() => buildQuickMessageAccessInitialValues({}, { includePin: true }))
  const [createErrors, setCreateErrors] = useState({})
  const [editState, setEditState] = useState({ open: false, access: null, form: buildQuickMessageAccessInitialValues(), errors: {} })
  const [pinState, setPinState] = useState({ open: false, mode: 'enable', access: null, form: buildQuickMessageAccessInitialValues({}, { includePin: true }), errors: {} })
  const [confirmState, setConfirmState] = useState({ open: false, type: '', access: null, expiresAt: '', error: '' })
  const [cloneState, setCloneState] = useState({
    open: false,
    access: null,
    form: {
      quantity: '1',
      startIndex: '1',
      appendIndexToLabel: true,
      appendIndexToRecipientName: false,
      separator: ' - ',
    },
    errors: {},
  })
  const [cloneResultState, setCloneResultState] = useState(null)

  const messageCancelled = String(message?.status || '').trim().toLowerCase() === 'cancelled'
  const messageLocked = String(message?.status || '').trim().toLowerCase() === 'locked'

  function accessNeedsExpiryBeforeUnlock(access) {
    if (!access || String(access?.status || '').trim().toLowerCase() !== 'locked') return false
    if (!access?.expiresAt) return false
    const expiresAt = new Date(access.expiresAt)
    return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= Date.now()
  }

  function resetCreateForm() {
    setCreateForm(buildQuickMessageAccessInitialValues({}, { includePin: true }))
    setCreateErrors({})
    setModalError('')
  }

  function closeCreateModal() {
    if (submitting) return
    setCreateModalOpen(false)
    resetCreateForm()
  }

  function updateCreateField(key, value) {
    setCreateForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateEditField(key, value) {
    setEditState((prev) => ({ ...prev, form: { ...prev.form, [key]: value } }))
  }

  function updatePinField(key, value) {
    setPinState((prev) => ({ ...prev, form: { ...prev.form, [key]: value } }))
  }

  function updateCloneField(key, value) {
    setCloneState((prev) => ({ ...prev, form: { ...prev.form, [key]: value } }))
  }

  function openCloneModal(access) {
    setCloneState({
      open: true,
      access,
      form: {
        quantity: '1',
        startIndex: '1',
        appendIndexToLabel: true,
        appendIndexToRecipientName: false,
        separator: ' - ',
      },
      errors: {},
    })
    setModalError('')
  }

  function validateCloneForm(form) {
    const errors = {}
    const quantity = Number(form?.quantity)
    const startIndex = Number(form?.startIndex)
    const separator = String(form?.separator || '')

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      errors.quantity = 'Số lượng phải là số nguyên từ 1 đến 100.'
    }
    if (!Number.isInteger(startIndex) || startIndex < 1 || startIndex > 10000) {
      errors.startIndex = 'Số bắt đầu phải là số nguyên từ 1 đến 10000.'
    }
    if (separator.length > 10) {
      errors.separator = 'Chuỗi phân tách tối đa 10 ký tự.'
    }

    return errors
  }

  async function handleCreateAccess() {
    const errors = validateQuickMessageAccessForm(createForm, { includePin: createForm.requirePin === true })
    setCreateErrors(errors)
    setModalError('')
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const payload = buildQuickMessageAccessPayload(createForm, { includePin: createForm.requirePin === true, includeRequirePin: true })
      const result = await createQuickMessageAccess(message?.id || message?.documentId, payload)
      await onReload?.()
      setCreateModalOpen(false)
      resetCreateForm()
      setResultModal({ code: result?.access?.code || '', plainPin: result?.plainPin || '' })
    } catch (requestError) {
      setModalError(getApiMessage(requestError, 'Không thể tạo mã truy cập'))
    } finally {
      setSubmitting(false)
    }
  }

  function openEditModal(access) {
    setEditState({
      open: true,
      access,
      form: buildQuickMessageAccessInitialValues(access),
      errors: {},
    })
    setModalError('')
  }

  async function handleSaveEdit() {
    const errors = validateQuickMessageAccessForm(editState.form)
    setEditState((prev) => ({ ...prev, errors }))
    setModalError('')
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const payload = buildQuickMessageAccessPayload(editState.form)
      await updateQuickMessageAccess(editState.access.id || editState.access.documentId, payload)
      await onReload?.()
      setEditState({ open: false, access: null, form: buildQuickMessageAccessInitialValues(), errors: {} })
      setToastState({ visible: true, color: 'success', message: 'Đã cập nhật mã truy cập.' })
    } catch (requestError) {
      setModalError(getApiMessage(requestError, 'Không thể cập nhật mã truy cập'))
    } finally {
      setSubmitting(false)
    }
  }

  function openPinModal(access, mode) {
    setPinState({
      open: true,
      mode,
      access,
      form: buildQuickMessageAccessInitialValues({ requirePin: true }, { includePin: true }),
      errors: {},
    })
    setModalError('')
  }

  async function handlePinSubmit() {
    const errors = validateQuickMessageAccessForm(pinState.form, { includePin: true })
    setPinState((prev) => ({ ...prev, errors }))
    setModalError('')
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const accessId = pinState.access.id || pinState.access.documentId
      const pin = String(pinState.form.pin || '').trim()
      let result = null
      if (pinState.mode === 'enable') {
        result = await enableQuickMessageAccessPin(accessId, pin)
      } else {
        result = await changeQuickMessageAccessPin(accessId, pin)
      }
      await onReload?.()
      setPinState({ open: false, mode: 'enable', access: null, form: buildQuickMessageAccessInitialValues({}, { includePin: true }), errors: {} })
      setResultModal({ code: result?.access?.code || pinState.access.code || '', plainPin: result?.plainPin || '' })
    } catch (requestError) {
      setModalError(getApiMessage(requestError, pinState.mode === 'enable' ? 'Không thể bật PIN' : 'Không thể đổi PIN'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCloneSubmit() {
    const errors = validateCloneForm(cloneState.form)
    setCloneState((prev) => ({ ...prev, errors }))
    setModalError('')
    if (Object.keys(errors).length > 0) return

    setSubmitting(true)
    try {
      const result = await cloneQuickMessageAccessBatch(cloneState.access.id || cloneState.access.documentId, {
        quantity: Number(cloneState.form.quantity),
        startIndex: Number(cloneState.form.startIndex),
        appendIndexToLabel: cloneState.form.appendIndexToLabel === true,
        appendIndexToRecipientName: cloneState.form.appendIndexToRecipientName === true,
        separator: String(cloneState.form.separator || ' - '),
      })
      await onReload?.()
      setCloneState({
        open: false,
        access: null,
        form: {
          quantity: '1',
          startIndex: '1',
          appendIndexToLabel: true,
          appendIndexToRecipientName: false,
          separator: ' - ',
        },
        errors: {},
      })
      setCloneResultState({
        sourceAccess: result?.sourceAccess || cloneState.access,
        quantity: result?.quantity || 0,
        accesses: Array.isArray(result?.accesses) ? result.accesses : [],
      })
      setToastState({ visible: true, color: 'success', message: `Đã tạo ${result?.quantity || 0} mã truy cập mới.` })
    } catch (requestError) {
      setModalError(getApiMessage(requestError, 'Không thể nhân bản hàng loạt mã truy cập'))
    } finally {
      setSubmitting(false)
    }
  }

  function openConfirm(type, access) {
    setConfirmState({
      open: true,
      type,
      access,
      expiresAt: type === 'unlock' && accessNeedsExpiryBeforeUnlock(access) ? formatDateTimeInput(access.expiresAt) : '',
      error: '',
    })
    setConfirmError('')
  }

  async function handleConfirmAction() {
    if (!confirmState.access) return
    const accessId = confirmState.access.id || confirmState.access.documentId
    setActiveActionId(accessId)
    setConfirmError('')

    try {
      if (confirmState.type === 'disable-pin') {
        await disableQuickMessageAccessPin(accessId)
        await onReload?.()
        setToastState({ visible: true, color: 'success', message: 'Đã tắt yêu cầu PIN.' })
      }

      if (confirmState.type === 'lock') {
        await lockQuickMessageAccess(accessId)
        await onReload?.()
        setToastState({ visible: true, color: 'success', message: 'Đã khóa mã truy cập.' })
      }

      if (confirmState.type === 'unlock') {
        const payload = {}
        if (accessNeedsExpiryBeforeUnlock(confirmState.access)) {
          const expiresAt = String(confirmState.expiresAt || '').trim()
          if (!expiresAt) {
            setConfirmState((prev) => ({ ...prev, error: 'Vui lòng chỉnh thời hạn trước khi mở lại mã.' }))
            return
          }
          payload.expiresAt = new Date(expiresAt).toISOString()
        }
        await unlockQuickMessageAccess(accessId, payload)
        await onReload?.()
        setToastState({ visible: true, color: 'success', message: 'Đã mở lại mã truy cập.' })
      }

      if (confirmState.type === 'cancel') {
        await cancelQuickMessageAccess(accessId)
        await onReload?.()
        setToastState({ visible: true, color: 'success', message: 'Đã hủy mã truy cập.' })
      }

      setConfirmState({ open: false, type: '', access: null, expiresAt: '', error: '' })
    } catch (requestError) {
      setConfirmError(getApiMessage(requestError, 'Không thể thực hiện thao tác với mã truy cập'))
    } finally {
      setActiveActionId(null)
    }
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(String(code || ''))
      setToastState({ visible: true, color: 'success', message: 'Đã sao chép mã truy cập.' })
    } catch {
      setToastState({ visible: true, color: 'danger', message: 'Không thể sao chép mã truy cập.' })
    }
  }

  async function copyAccessInfo(access) {
    const lines = [`Mã truy cập: ${access?.code || ''}`]
    if (access?.requirePin) {
      lines.push(access?.hasPin ? 'Mã này yêu cầu PIN.' : 'Thiếu PIN. Hãy đặt lại PIN trước khi sử dụng.')
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setToastState({ visible: true, color: 'success', message: 'Đã sao chép thông tin truy cập.' })
    } catch {
      setToastState({ visible: true, color: 'danger', message: 'Không thể sao chép thông tin truy cập.' })
    }
  }

  async function copyCloneCodes() {
    const rowsToCopy = Array.isArray(cloneResultState?.accesses) ? cloneResultState.accesses : []
    const text = rowsToCopy.map((item) => item?.code).filter(Boolean).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setToastState({ visible: true, color: 'success', message: 'Đã sao chép danh sách mã truy cập.' })
    } catch {
      setToastState({ visible: true, color: 'danger', message: 'Không thể sao chép danh sách mã truy cập.' })
    }
  }

  async function copyCloneInfo() {
    const rowsToCopy = Array.isArray(cloneResultState?.accesses) ? cloneResultState.accesses : []
    const requiresPin = cloneResultState?.sourceAccess?.requirePin === true
    const text = rowsToCopy
      .map((item) => [`Mã truy cập: ${item?.code || ''}`, ...(requiresPin ? ['Mã này yêu cầu PIN.'] : [])].join('\n'))
      .join('\n\n')

    try {
      await navigator.clipboard.writeText(text)
      setToastState({ visible: true, color: 'success', message: 'Đã sao chép thông tin các mã truy cập.' })
    } catch {
      setToastState({ visible: true, color: 'danger', message: 'Không thể sao chép thông tin các mã truy cập.' })
    }
  }

  return (
    <>
      <CCard className='border-0 shadow-sm'>
        <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
          <div>
            <strong>Mã truy cập</strong>
            <div className='small text-body-secondary mt-1'>Quản lý mã truy cập, người nhận, PIN, thời hạn và giới hạn lượt xem.</div>
          </div>
          <CButton color='primary' onClick={() => setCreateModalOpen(true)} disabled={messageCancelled || submitting}>
            Tạo mã truy cập
          </CButton>
        </CCardHeader>
        <CCardBody>
          {messageLocked ? <CAlert color='warning'>Thông điệp đang bị khóa. Bạn vẫn có thể xem danh sách mã, nhưng các mã sẽ chưa sử dụng được cho đến khi thông điệp được mở lại.</CAlert> : null}
          {messageCancelled ? <CAlert color='warning'>Thông điệp đã bị hủy. Không thể tạo thêm mã truy cập mới.</CAlert> : null}

          {rows.length === 0 ? (
            <div className='text-center py-5'>
              <div className='fw-semibold mb-2'>Chưa có mã truy cập.</div>
              <div className='text-body-secondary mb-3'>Hãy tạo mã đầu tiên để chia sẻ thông điệp này.</div>
              <CButton color='primary' onClick={() => setCreateModalOpen(true)} disabled={messageCancelled || submitting}>Tạo mã truy cập</CButton>
            </div>
          ) : (
            <CTable hover responsive align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Nhãn</CTableHeaderCell>
                  <CTableHeaderCell>Người nhận</CTableHeaderCell>
                  <CTableHeaderCell>Mã truy cập</CTableHeaderCell>
                  <CTableHeaderCell>PIN</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Hết hạn</CTableHeaderCell>
                  <CTableHeaderCell>Lượt xem</CTableHeaderCell>
                  <CTableHeaderCell>Thao tác</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.map((item) => {
                  const accessId = item.id || item.documentId
                  const isBusy = activeActionId === accessId || submitting
                  const canEdit = String(item?.status || '').trim().toLowerCase() !== 'cancelled'
                  const canChangePin = item?.requirePin === true && item?.hasPin === true
                  const canEnablePin = item?.requirePin !== true || item?.hasPin !== true
                  const canDisablePin = item?.requirePin === true || item?.hasPin === true
                  const canCancel = String(item?.status || '').trim().toLowerCase() !== 'cancelled'
                  const unlockBlockedByCancelled = String(item?.status || '').trim().toLowerCase() === 'cancelled'
                  const canCloneBatch = String(item?.status || '').trim().toLowerCase() !== 'cancelled'

                  return (
                    <CTableRow key={accessId}>
                      <CTableDataCell>{item.label || 'Chưa đặt nhãn'}</CTableDataCell>
                      <CTableDataCell>{item.recipientName || 'Không xác định'}</CTableDataCell>
                      <CTableDataCell>
                        <div className='d-flex align-items-center gap-2 flex-wrap'>
                          <code className='fw-semibold'>{item.code || '-'}</code>
                          <CButton size='sm' color='secondary' variant='outline' onClick={() => copyCode(item.code)} disabled={isBusy}>Copy</CButton>
                        </div>
                      </CTableDataCell>
                      <CTableDataCell>
                        {item.requirePin && item.hasPin ? <CBadge color='info'>Có PIN</CBadge> : null}
                        {!item.requirePin ? <CBadge color='secondary'>Không PIN</CBadge> : null}
                        {item.requirePin && !item.hasPin ? <CBadge color='warning'>Thiếu PIN</CBadge> : null}
                      </CTableDataCell>
                      <CTableDataCell><AccessStatusBadge status={item.effectiveStatus || item.status} /></CTableDataCell>
                      <CTableDataCell>
                        {item.expiresAt ? (
                          <div>
                            <div>{formatDateTime(item.expiresAt)}</div>
                            {item.isExpired ? <div className='small text-danger'>Đã hết hạn</div> : null}
                          </div>
                        ) : 'Theo hạn chung'}
                      </CTableDataCell>
                      <CTableDataCell>{formatAccessViewCount(item.viewCount, item.maxViews)}</CTableDataCell>
                      <CTableDataCell>
                        <CDropdown alignment='end'>
                          <CDropdownToggle color='secondary' variant='outline' size='sm' disabled={isBusy}>Thao tác</CDropdownToggle>
                          <CDropdownMenu>
                            <CDropdownItem onClick={() => copyCode(item.code)}>Sao chép mã</CDropdownItem>
                            <CDropdownItem onClick={() => copyAccessInfo(item)}>Sao chép thông tin</CDropdownItem>
                            {canCloneBatch ? <CDropdownItem onClick={() => openCloneModal(item)}>Nhân bản hàng loạt</CDropdownItem> : null}
                            {canEdit ? <CDropdownItem onClick={() => openEditModal(item)}>Chỉnh sửa</CDropdownItem> : null}
                            {canEnablePin ? <CDropdownItem onClick={() => openPinModal(item, 'enable')}>Bật PIN</CDropdownItem> : null}
                            {canChangePin ? <CDropdownItem onClick={() => openPinModal(item, 'change')}>Đổi PIN</CDropdownItem> : null}
                            {canDisablePin ? <CDropdownItem onClick={() => openConfirm('disable-pin', item)}>Tắt PIN</CDropdownItem> : null}
                            {String(item?.status || '').trim().toLowerCase() !== 'locked' && !unlockBlockedByCancelled ? <CDropdownItem onClick={() => openConfirm('lock', item)}>Khóa</CDropdownItem> : null}
                            {canUnlockAccess(item) && !unlockBlockedByCancelled ? <CDropdownItem onClick={() => openConfirm('unlock', item)}>Mở lại</CDropdownItem> : null}
                            {canCancel ? <CDropdownItem onClick={() => openConfirm('cancel', item)}>Hủy</CDropdownItem> : null}
                          </CDropdownMenu>
                        </CDropdown>
                      </CTableDataCell>
                    </CTableRow>
                  )
                })}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      <CModal visible={createModalOpen} onClose={closeCreateModal} alignment='center' backdrop='static'>
        <CModalHeader>
          <CModalTitle>Tạo mã truy cập</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {modalError ? <CAlert color='danger'>{modalError}</CAlert> : null}
          <AccessFormFields
            form={createForm}
            errors={createErrors}
            includePin={createForm.requirePin === true}
            includeRequirePin={true}
            messageExpiresAt={message?.expiresAt}
            disabled={submitting}
            onChange={updateCreateField}
          />
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeCreateModal} disabled={submitting}>Đóng</CButton>
          <CButton color='primary' onClick={handleCreateAccess} disabled={submitting}>{submitting ? 'Đang tạo...' : 'Tạo mã truy cập'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={cloneState.open} onClose={() => !submitting && setCloneState((prev) => ({ ...prev, open: false }))} alignment='center' backdrop='static'>
        <CModalHeader>
          <CModalTitle>Nhân bản hàng loạt</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {modalError ? <CAlert color='danger'>{modalError}</CAlert> : null}
          {cloneState.access ? (
            <>
              <CAlert color='info'>Các mã mới sẽ kế thừa cấu hình của access nguồn nhưng luôn có code mới và không kế thừa lịch sử truy cập hoặc phản hồi.</CAlert>
              {cloneState.access.requirePin === true ? <CAlert color='warning'>Access nguồn đang yêu cầu PIN. Các bản sao sẽ giữ nguyên yêu cầu PIN của access nguồn, nhưng hệ thống không thể hiển thị lại PIN hiện tại.</CAlert> : null}
              <CRow className='g-3'>
                <CCol md={6}>
                  <CFormLabel>Số lượng</CFormLabel>
                  <CFormInput type='number' min={1} max={100} value={cloneState.form.quantity} onChange={(event) => updateCloneField('quantity', event.target.value)} disabled={submitting} />
                  {cloneState.errors.quantity ? <div className='text-danger small mt-1'>{cloneState.errors.quantity}</div> : null}
                </CCol>
                <CCol md={6}>
                  <CFormLabel>Số bắt đầu</CFormLabel>
                  <CFormInput type='number' min={1} max={10000} value={cloneState.form.startIndex} onChange={(event) => updateCloneField('startIndex', event.target.value)} disabled={submitting} />
                  {cloneState.errors.startIndex ? <div className='text-danger small mt-1'>{cloneState.errors.startIndex}</div> : null}
                </CCol>
                <CCol md={12}>
                  <CFormLabel>Chuỗi phân tách</CFormLabel>
                  <CFormInput value={cloneState.form.separator} onChange={(event) => updateCloneField('separator', event.target.value)} disabled={submitting} />
                  {cloneState.errors.separator ? <div className='text-danger small mt-1'>{cloneState.errors.separator}</div> : null}
                </CCol>
                <CCol md={12}>
                  <CFormCheck label='Thêm số thứ tự vào nhãn' checked={cloneState.form.appendIndexToLabel === true} onChange={(event) => updateCloneField('appendIndexToLabel', event.target.checked)} disabled={submitting} />
                </CCol>
                <CCol md={12}>
                  <CFormCheck label='Thêm số thứ tự vào người nhận dự kiến' checked={cloneState.form.appendIndexToRecipientName === true} onChange={(event) => updateCloneField('appendIndexToRecipientName', event.target.checked)} disabled={submitting} />
                </CCol>
              </CRow>
            </>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setCloneState((prev) => ({ ...prev, open: false }))} disabled={submitting}>Đóng</CButton>
          <CButton color='primary' onClick={handleCloneSubmit} disabled={submitting}>{submitting ? 'Đang nhân bản...' : 'Nhân bản'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={editState.open} onClose={() => !submitting && setEditState({ open: false, access: null, form: buildQuickMessageAccessInitialValues(), errors: {} })} alignment='center' backdrop='static'>
        <CModalHeader>
          <CModalTitle>Chỉnh sửa mã truy cập</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {modalError ? <CAlert color='danger'>{modalError}</CAlert> : null}
          {editState.access && String(editState.access.status || '').trim().toLowerCase() === 'cancelled' ? <CAlert color='warning'>Mã truy cập đã bị hủy và không thể chỉnh sửa.</CAlert> : null}
          <AccessFormFields
            form={editState.form}
            errors={editState.errors}
            messageExpiresAt={message?.expiresAt}
            disabled={submitting || String(editState.access?.status || '').trim().toLowerCase() === 'cancelled'}
            onChange={updateEditField}
          />
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setEditState({ open: false, access: null, form: buildQuickMessageAccessInitialValues(), errors: {} })} disabled={submitting}>Đóng</CButton>
          <CButton color='primary' onClick={handleSaveEdit} disabled={submitting || String(editState.access?.status || '').trim().toLowerCase() === 'cancelled'}>{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={pinState.open} onClose={() => !submitting && setPinState({ open: false, mode: 'enable', access: null, form: buildQuickMessageAccessInitialValues({}, { includePin: true }), errors: {} })} alignment='center' backdrop='static'>
        <CModalHeader>
          <CModalTitle>{pinState.mode === 'enable' ? 'Thiết lập PIN' : 'Đổi PIN truy cập'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {modalError ? <CAlert color='danger'>{modalError}</CAlert> : null}
          <AccessFormFields
            form={pinState.form}
            errors={pinState.errors}
            includePin={true}
            disabled={submitting}
            onChange={updatePinField}
          />
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setPinState({ open: false, mode: 'enable', access: null, form: buildQuickMessageAccessInitialValues({}, { includePin: true }), errors: {} })} disabled={submitting}>Đóng</CButton>
          <CButton color='primary' onClick={handlePinSubmit} disabled={submitting}>{submitting ? 'Đang lưu...' : pinState.mode === 'enable' ? 'Bật PIN' : 'Đổi PIN'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={confirmState.open} onClose={() => !activeActionId && setConfirmState({ open: false, type: '', access: null, expiresAt: '', error: '' })} alignment='center'>
        <CModalHeader>
          <CModalTitle>
            {confirmState.type === 'disable-pin' ? 'Xác nhận tắt PIN' : null}
            {confirmState.type === 'lock' ? 'Xác nhận khóa mã' : null}
            {confirmState.type === 'unlock' ? 'Xác nhận mở lại mã' : null}
            {confirmState.type === 'cancel' ? 'Xác nhận hủy mã' : null}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {confirmState.type === 'disable-pin' ? <div>Bạn có chắc muốn tắt yêu cầu PIN? Sau thao tác này, người có mã truy cập sẽ không cần nhập PIN.</div> : null}
          {confirmState.type === 'lock' ? <div>Bạn có chắc muốn khóa mã truy cập này? Người nhận sẽ không thể sử dụng mã cho đến khi được mở lại.</div> : null}
          {confirmState.type === 'cancel' ? <div>Bạn có chắc muốn hủy mã truy cập này? Mã sẽ không thể được sử dụng hoặc mở lại. Lịch sử lượt xem và phản hồi vẫn được giữ.</div> : null}
          {confirmState.type === 'unlock' ? (
            <div>
              <div className='mb-2'>Mã truy cập sẽ được mở lại nếu trạng thái hợp lệ.</div>
              {accessNeedsExpiryBeforeUnlock(confirmState.access) ? (
                <>
                  <CFormLabel>Thời gian hết hạn mới</CFormLabel>
                  <CFormInput type='datetime-local' value={confirmState.expiresAt} onChange={(event) => setConfirmState((prev) => ({ ...prev, expiresAt: event.target.value, error: '' }))} />
                  <div className='small text-body-secondary mt-1'>Mã đang hết hạn. Hãy gia hạn trước khi mở lại.</div>
                </>
              ) : null}
              {messageLocked ? <div className='text-warning small mt-2'>Thông điệp đang bị khóa. Dù mở lại mã, mã vẫn chưa sử dụng được cho đến khi thông điệp được mở lại.</div> : null}
              {messageCancelled ? <div className='text-warning small mt-2'>Thông điệp đã bị hủy. Mã sẽ vẫn không sử dụng được dù trạng thái access được thay đổi.</div> : null}
            </div>
          ) : null}

          {confirmState.error ? <div className='text-danger small mt-2'>{confirmState.error}</div> : null}
          {confirmError ? <div className='text-danger small mt-2'>{confirmError}</div> : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={() => setConfirmState({ open: false, type: '', access: null, expiresAt: '', error: '' })} disabled={Boolean(activeActionId)}>Đóng</CButton>
          <CButton color={confirmState.type === 'cancel' ? 'danger' : 'primary'} onClick={handleConfirmAction} disabled={Boolean(activeActionId)}>
            {activeActionId ? <><CSpinner size='sm' className='me-2' />Đang xử lý...</> : 'Xác nhận'}
          </CButton>
        </CModalFooter>
      </CModal>

      <QuickMessageCreateResultModal visible={Boolean(resultModal)} result={resultModal} onClose={() => setResultModal(null)} />

      <CModal visible={Boolean(cloneResultState)} onClose={() => setCloneResultState(null)} alignment='center' size='lg'>
        <CModalHeader>
          <CModalTitle>Kết quả nhân bản hàng loạt</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className='mb-3'>Đã tạo <strong>{cloneResultState?.quantity || 0}</strong> mã truy cập mới.</div>
          {cloneResultState?.sourceAccess?.requirePin === true ? <CAlert color='warning'>Các bản sao giữ nguyên yêu cầu PIN của access nguồn. Hệ thống không hiển thị lại PIN hiện tại.</CAlert> : null}
          <CTable hover responsive align='middle'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Nhãn</CTableHeaderCell>
                <CTableHeaderCell>Người nhận</CTableHeaderCell>
                <CTableHeaderCell>Mã truy cập</CTableHeaderCell>
                <CTableHeaderCell>PIN</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {(cloneResultState?.accesses || []).map((item) => (
                <CTableRow key={item.id || item.documentId || item.code}>
                  <CTableDataCell>{item.label || 'Chưa đặt nhãn'}</CTableDataCell>
                  <CTableDataCell>{item.recipientName || 'Không xác định'}</CTableDataCell>
                  <CTableDataCell><code>{item.code || '-'}</code></CTableDataCell>
                  <CTableDataCell>{item.requirePin ? 'Yêu cầu PIN' : 'Không PIN'}</CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </CModalBody>
        <CModalFooter className='justify-content-between flex-wrap gap-2'>
          <div className='d-flex gap-2 flex-wrap'>
            <CButton color='secondary' variant='outline' onClick={copyCloneCodes} disabled={!cloneResultState?.accesses?.length}>Sao chép mã</CButton>
            <CButton color='secondary' variant='outline' onClick={copyCloneInfo} disabled={!cloneResultState?.accesses?.length}>Sao chép thông tin</CButton>
          </div>
          <CButton color='primary' onClick={() => setCloneResultState(null)}>Đóng</CButton>
        </CModalFooter>
      </CModal>

      <CToaster placement='top-end'>
        <CToast visible={toastState.visible} autohide delay={2500} color={toastState.color} onClose={() => setToastState((prev) => ({ ...prev, visible: false }))}>
          <CToastBody>{toastState.message}</CToastBody>
        </CToast>
      </CToaster>
    </>
  )
}