import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
  CTabContent,
  CTabPane,
  CToast,
  CToastBody,
  CToaster,
} from '@coreui/react'
import QuickMessageAccessesTab from '../components/QuickMessageAccessesTab'
import QuickMessageActivityTab from '../components/QuickMessageActivityTab'
import QuickMessageCreateResultModal from '../components/QuickMessageCreateResultModal'
import QuickMessageOverviewTab from '../components/QuickMessageOverviewTab'
import QuickMessageStatusBadge from '../components/QuickMessageStatusBadge'
import { formatDateTime, QUICK_MESSAGE_TABS, resolveQuickMessageTab } from '../components/quickMessageUi'
import {
  cancelQuickMessage,
  getApiMessage,
  getQuickMessage,
  lockQuickMessage,
  unlockQuickMessage,
  updateQuickMessage,
} from '../services/quickMessageService'

export default function QuickMessageDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = useMemo(() => resolveQuickMessageTab(searchParams), [searchParams])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusSubmitting, setStatusSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [detail, setDetail] = useState(null)
  const [toastState, setToastState] = useState({ visible: false, color: 'success', message: '' })
  const [createResultModal, setCreateResultModal] = useState(null)

  async function loadDetail() {
    setLoading(true)
    setError('')
    try {
      const data = await getQuickMessage(id)
      setDetail(data)
    } catch (requestError) {
      setDetail(null)
      setError(getApiMessage(requestError, 'Không tải được chi tiết thông điệp'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDetail()
  }, [id])

  useEffect(() => {
    const state = location.state?.quickMessageCreateNotice
    if (!state) return

    if (state.type === 'pin') {
      setCreateResultModal({ code: state.code, plainPin: state.plainPin })
    } else if (state.type === 'success') {
      setToastState({ visible: true, color: 'success', message: state.message || 'Tạo thông điệp thành công.' })
    }

    navigate(`${location.pathname}${location.search}`, { replace: true, state: {} })
  }, [location.pathname, location.search, location.state, navigate])

  function changeTab(nextTab) {
    const params = new URLSearchParams(searchParams)
    params.set('tab', nextTab)
    setSearchParams(params, { replace: true })
  }

  async function handleSave(payload) {
    setSaving(true)
    setSaveError('')
    try {
      await updateQuickMessage(id, payload)
      await loadDetail()
      setToastState({ visible: true, color: 'success', message: 'Cập nhật thông điệp thành công.' })
    } catch (requestError) {
      const message = getApiMessage(requestError, 'Không thể cập nhật thông điệp')
      setSaveError(message)
      throw requestError
    } finally {
      setSaving(false)
    }
  }

  async function handleActivate() {
    setStatusSubmitting(true)
    setSaveError('')
    try {
      await updateQuickMessage(id, { status: 'active' })
      await loadDetail()
      setToastState({ visible: true, color: 'success', message: 'Đã kích hoạt thông điệp.' })
    } catch (requestError) {
      setSaveError(getApiMessage(requestError, 'Không thể kích hoạt thông điệp'))
      throw requestError
    } finally {
      setStatusSubmitting(false)
    }
  }

  async function handleLock() {
    setStatusSubmitting(true)
    setSaveError('')
    try {
      await lockQuickMessage(id)
      await loadDetail()
      setToastState({ visible: true, color: 'success', message: 'Đã khóa thông điệp.' })
    } catch (requestError) {
      setSaveError(getApiMessage(requestError, 'Không thể khóa thông điệp'))
      throw requestError
    } finally {
      setStatusSubmitting(false)
    }
  }

  async function handleUnlock(payload = {}) {
    setStatusSubmitting(true)
    setSaveError('')
    try {
      await unlockQuickMessage(id, payload)
      await loadDetail()
      setToastState({ visible: true, color: 'success', message: 'Đã mở lại thông điệp.' })
    } catch (requestError) {
      setSaveError(getApiMessage(requestError, 'Không thể mở lại thông điệp'))
      throw requestError
    } finally {
      setStatusSubmitting(false)
    }
  }

  async function handleCancelMessage() {
    setStatusSubmitting(true)
    setSaveError('')
    try {
      await cancelQuickMessage(id)
      await loadDetail()
      setToastState({ visible: true, color: 'success', message: 'Đã hủy thông điệp.' })
    } catch (requestError) {
      setSaveError(getApiMessage(requestError, 'Không thể hủy thông điệp'))
      throw requestError
    } finally {
      setStatusSubmitting(false)
    }
  }

  const message = detail?.message || null
  const accesses = Array.isArray(detail?.accesses) ? detail.accesses : []

  return (
    <>
      <CRow className='g-4'>
        <CCol xs={12}>
          <CCard className='border-0 shadow-sm'>
            <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
              <div>
                <div className='d-flex align-items-center gap-2 flex-wrap'>
                  <strong>{message?.title || 'Chi tiết thông điệp'}</strong>
                  {message ? <QuickMessageStatusBadge status={message.status} effectiveStatus={message.effectiveStatus} /> : null}
                </div>
                {message ? <div className='small text-body-secondary mt-1'>Cập nhật lần cuối: {formatDateTime(message.updatedAt)}</div> : null}
              </div>
              <CButton color='secondary' variant='outline' onClick={() => navigate('/quick-messages')}>Quay lại danh sách</CButton>
            </CCardHeader>
            <CCardBody>
              {error ? <CAlert color='danger'>{error}</CAlert> : null}

              {loading ? (
                <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải dữ liệu...</div>
              ) : !detail ? (
                <CAlert color='warning'>Không tìm thấy thông điệp.</CAlert>
              ) : (
                <>
                  <CNav variant='tabs' className='mb-4'>
                    {QUICK_MESSAGE_TABS.map((item) => (
                      <CNavItem key={item.key}>
                        <CNavLink active={activeTab === item.key} role='button' onClick={() => changeTab(item.key)}>{item.label}</CNavLink>
                      </CNavItem>
                    ))}
                  </CNav>

                  <CTabContent>
                    <CTabPane visible={activeTab === 'overview'}>
                      <QuickMessageOverviewTab
                        detail={detail}
                        loading={loading}
                        saving={saving}
                        saveError={saveError}
                        statusSubmitting={statusSubmitting}
                        onRefresh={loadDetail}
                        onSave={handleSave}
                        onActivate={handleActivate}
                        onLock={handleLock}
                        onUnlock={handleUnlock}
                        onCancelMessage={handleCancelMessage}
                      />
                    </CTabPane>
                    <CTabPane visible={activeTab === 'accesses'}>
                      <QuickMessageAccessesTab message={message} accesses={accesses} onReload={loadDetail} />
                    </CTabPane>
                    <CTabPane visible={activeTab === 'activity'}>
                      <QuickMessageActivityTab message={message} summary={detail?.summary || {}} />
                    </CTabPane>
                  </CTabContent>
                </>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <QuickMessageCreateResultModal
        visible={Boolean(createResultModal)}
        result={createResultModal}
        onClose={() => setCreateResultModal(null)}
      />

      <CToaster placement='top-end'>
        <CToast visible={toastState.visible} autohide delay={2500} color={toastState.color} onClose={() => setToastState((prev) => ({ ...prev, visible: false }))}>
          <CToastBody>{toastState.message}</CToastBody>
        </CToast>
      </CToaster>
    </>
  )
}