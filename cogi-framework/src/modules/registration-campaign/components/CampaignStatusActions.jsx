import { useMemo, useState } from 'react'
import {
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CFormTextarea,
} from '@coreui/react'
import { normalizeStatus } from '../utils/registrationCampaignUi'

function buildActions(status) {
  const normalized = normalizeStatus(status)
  if (normalized === 'draft') {
    return [
      { key: 'open', label: 'Mở chiến dịch', color: 'success', requireReason: false },
      { key: 'cancel', label: 'Hủy chiến dịch', color: 'danger', requireReason: true },
    ]
  }
  if (normalized === 'open') {
    return [
      { key: 'pause', label: 'Tạm dừng', color: 'warning', requireReason: false },
      { key: 'close', label: 'Đóng chiến dịch', color: 'secondary', requireReason: false },
      { key: 'cancel', label: 'Hủy chiến dịch', color: 'danger', requireReason: true },
    ]
  }
  if (normalized === 'paused') {
    return [
      { key: 'open', label: 'Mở lại', color: 'success', requireReason: false },
      { key: 'close', label: 'Đóng chiến dịch', color: 'secondary', requireReason: false },
    ]
  }
  if (normalized === 'closed') {
    return []
  }
  return []
}

export default function CampaignStatusActions({ campaign, submitting = false, onAction }) {
  const actions = useMemo(() => buildActions(campaign?.status), [campaign?.status])
  const [confirmState, setConfirmState] = useState(null)
  const [reason, setReason] = useState('')

  function openConfirm(action) {
    setReason('')
    setConfirmState(action)
  }

  function closeConfirm() {
    if (submitting) return
    setConfirmState(null)
    setReason('')
  }

  async function handleConfirm() {
    if (!confirmState) return
    if (confirmState.requireReason && !String(reason || '').trim()) return
    await onAction?.(confirmState.key, confirmState.requireReason ? { reason: String(reason || '').trim() } : {})
    closeConfirm()
  }

  if (!actions.length) return null

  return (
    <>
      <div className='d-flex flex-wrap gap-2'>
        {actions.map((action) => (
          <CButton key={action.key} color={action.color} variant={action.key === 'open' ? undefined : 'outline'} disabled={submitting} onClick={() => openConfirm(action)}>
            {action.label}
          </CButton>
        ))}
      </div>

      <CModal visible={Boolean(confirmState)} onClose={closeConfirm}>
        <CModalHeader>
          <CModalTitle>{confirmState?.label}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className='mb-3'>Bạn chắc chắn muốn thực hiện thao tác này?</div>
          {confirmState?.requireReason ? (
            <>
              <div className='small fw-semibold mb-1'>Lý do</div>
              <CFormTextarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder='Nhập lý do' />
            </>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={closeConfirm} disabled={submitting}>Đóng</CButton>
          <CButton color={confirmState?.color || 'primary'} onClick={handleConfirm} disabled={submitting || (confirmState?.requireReason && !String(reason || '').trim())}>
            {submitting ? 'Đang xử lý...' : 'Xác nhận'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}