import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
} from '@coreui/react'
import RegistrationCampaignBasicInfoModal from '../components/RegistrationCampaignBasicInfoModal'
import CampaignStatusActions from '../components/CampaignStatusActions'
import CampaignOverviewTab from '../components/CampaignOverviewTab'
import CampaignConfigTab from '../components/CampaignConfigTab'
import CampaignFormTab from '../components/CampaignFormTab'
import CampaignRegistrationsTab from '../components/CampaignRegistrationsTab'
import CampaignEmailsTab from '../components/CampaignEmailsTab'
import CampaignPublicPageTab from '../components/CampaignPublicPageTab'
import {
  closeRegistrationCampaign,
  getRegistrationCampaign,
  getRegistrationCampaignFormOptions,
  openRegistrationCampaign,
  pauseRegistrationCampaign,
  cancelRegistrationCampaign,
  updateRegistrationCampaignBasicInfo,
  updateRegistrationCampaignConfig,
  updateRegistrationCampaignForm,
} from '../services/registrationCampaignApi'
import {
  buildRegistrationCampaignTabPath,
  copyToClipboard,
  formatDateTime,
  getApiMessage,
  getCampaignStatusMeta,
  resolveRegistrationCampaignTab,
} from '../utils/registrationCampaignUi'
import { buildTenantUrl } from '../../../utils/tenantRouting'

function SpinnerCenter() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <CSpinner />
    </div>
  )
}

export default function RegistrationCampaignDetailPage() {
  const { id, tenantCode } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [campaign, setCampaign] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formOptions, setFormOptions] = useState(null)
  const [optionsLoading, setOptionsLoading] = useState(false)
  const [showBasicInfoModal, setShowBasicInfoModal] = useState(false)

  const activeTab = useMemo(() => resolveRegistrationCampaignTab(location.pathname), [location.pathname])

  async function loadFormOptions() {
    setOptionsLoading(true)
    try {
      const optionData = await getRegistrationCampaignFormOptions()
      setFormOptions(optionData || null)
      return optionData || null
    } catch {
      setFormOptions({ targetFeatures: [], availableRoles: [] })
      return null
    } finally {
      setOptionsLoading(false)
    }
  }

  async function loadData() {
    setLoading(true)
    setError('')
    try {
      const [campaignData, optionData] = await Promise.all([
        getRegistrationCampaign(id),
        loadFormOptions(),
      ])
      setCampaign(campaignData || null)
      setFormOptions(optionData || null)
    } catch (requestError) {
      setCampaign(null)
      setError(getApiMessage(requestError, 'Không tải được chi tiết chiến dịch'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [success])

  function goTab(tab) {
    navigate(buildRegistrationCampaignTabPath(id, tab, tenantCode))
  }

  async function openBasicInfoModal() {
    await loadFormOptions()
    setShowBasicInfoModal(true)
  }

  async function reloadKeepTab() {
    await loadData()
  }

  async function handleSaveBasicInfo(payload) {
    setSaving(true)
    setError('')
    try {
      await updateRegistrationCampaignBasicInfo(id, payload)
      setShowBasicInfoModal(false)
      setSuccess('Đã cập nhật thông tin cơ bản')
      await reloadKeepTab()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu thông tin cơ bản'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveConfig(payload) {
    setSaving(true)
    setError('')
    try {
      await updateRegistrationCampaignConfig(id, payload)
      setSuccess('Đã lưu cấu hình chiến dịch')
      await reloadKeepTab()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu cấu hình chiến dịch'))
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveForm(payload) {
    setSaving(true)
    setError('')
    try {
      await updateRegistrationCampaignForm(id, payload)
      setSuccess('Đã lưu biểu mẫu đăng ký')
      await reloadKeepTab()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể lưu biểu mẫu đăng ký'))
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusAction(actionKey, payload = {}) {
    setSaving(true)
    setError('')
    try {
      if (actionKey === 'open') await openRegistrationCampaign(id, payload)
      if (actionKey === 'pause') await pauseRegistrationCampaign(id, payload)
      if (actionKey === 'close') await closeRegistrationCampaign(id, payload)
      if (actionKey === 'cancel') await cancelRegistrationCampaign(id, payload)
      setSuccess('Đã cập nhật trạng thái chiến dịch')
      await reloadKeepTab()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể cập nhật trạng thái chiến dịch'))
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyLink() {
    const copied = await copyToClipboard(campaign?.publicJoinPath || campaign?.publicApiPath)
    if (copied) {
      setSuccess('Đã sao chép link đăng ký')
    } else {
      setError('Không thể sao chép link đăng ký')
    }
  }

  function handleOpenPublic() {
    if (!campaign?.publicJoinPath) return
    const target = buildTenantUrl(campaign.publicJoinPath, { tenantCode, isMainDomain: Boolean(tenantCode) })
    window.open(target, '_blank', 'noopener,noreferrer')
  }

  if (loading) return <SpinnerCenter />
  if (!campaign) {
    return (
      <CContainer className='py-4'>
        <CCard>
          <CCardBody className='text-center'>Không tìm thấy chiến dịch đăng ký.</CCardBody>
        </CCard>
      </CContainer>
    )
  }

  const statusMeta = getCampaignStatusMeta(campaign.status)

  return (
    <CContainer fluid className='py-4'>
      <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
        <div className='flex-grow-1'>
          <div className='d-flex align-items-center gap-2 flex-wrap mb-2'>
            <CButton color='secondary' variant='outline' onClick={() => navigate(tenantCode ? `/t/${encodeURIComponent(tenantCode)}/registration-campaigns` : '/registration-campaigns')}>Quay lại</CButton>
            <div className='fs-4 fw-semibold'>{campaign.name}</div>
            <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
          </div>
          <div className='text-body-secondary mb-2'>{campaign.code} | {campaign.targetFeature || '-'}</div>
          <div className='small text-body-secondary'>Thời gian nhận đăng ký: {formatDateTime(campaign.startAt)} - {formatDateTime(campaign.endAt)}</div>
        </div>
        <div className='d-flex flex-wrap gap-2 justify-content-end'>
          <CButton color='warning' variant='outline' onClick={openBasicInfoModal}>Sửa thông tin cơ bản</CButton>
          <CButton color='info' variant='outline' onClick={handleCopyLink}>Sao chép link đăng ký</CButton>
          <CButton color='primary' variant='outline' onClick={handleOpenPublic} disabled={!campaign.publicJoinPath}>Mở trang public</CButton>
          <CampaignStatusActions campaign={campaign} submitting={saving} onAction={handleStatusAction} />
        </div>
      </div>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}

      <CNav variant='tabs' className='mb-3 flex-wrap'>
        <CNavItem><CNavLink href='#' active={activeTab === 'overview'} onClick={(event) => { event.preventDefault(); goTab('overview') }}>Tổng quan</CNavLink></CNavItem>
        <CNavItem><CNavLink href='#' active={activeTab === 'config'} onClick={(event) => { event.preventDefault(); goTab('config') }}>Cấu hình</CNavLink></CNavItem>
        <CNavItem><CNavLink href='#' active={activeTab === 'form'} onClick={(event) => { event.preventDefault(); goTab('form') }}>Biểu mẫu</CNavLink></CNavItem>
        <CNavItem><CNavLink href='#' active={activeTab === 'registrations'} onClick={(event) => { event.preventDefault(); goTab('registrations') }}>Người đăng ký</CNavLink></CNavItem>
        <CNavItem><CNavLink href='#' active={activeTab === 'emails'} onClick={(event) => { event.preventDefault(); goTab('emails') }}>Email</CNavLink></CNavItem>
        <CNavItem><CNavLink href='#' active={activeTab === 'public-page'} onClick={(event) => { event.preventDefault(); goTab('public-page') }}>Trang đăng ký</CNavLink></CNavItem>
      </CNav>

      {activeTab === 'overview' ? <CampaignOverviewTab campaign={campaign} onOpenPublic={handleOpenPublic} onEditBasicInfo={openBasicInfoModal} /> : null}
      {activeTab === 'config' ? <CampaignConfigTab campaign={campaign} formOptions={formOptions} saving={saving} onSave={handleSaveConfig} onEditBasicInfo={openBasicInfoModal} /> : null}
      {activeTab === 'form' ? <CampaignFormTab campaign={campaign} saving={saving} onSave={handleSaveForm} /> : null}
      {activeTab === 'registrations' ? <CampaignRegistrationsTab campaign={campaign} onChanged={reloadKeepTab} /> : null}
      {activeTab === 'emails' ? <CampaignEmailsTab campaign={campaign} onChanged={reloadKeepTab} onOpenRegistration={() => goTab('registrations')} /> : null}
      {activeTab === 'public-page' ? <CampaignPublicPageTab campaign={campaign} onOpenPublic={handleOpenPublic} onOpenAction={() => handleStatusAction('open')} /> : null}

      <RegistrationCampaignBasicInfoModal
        visible={showBasicInfoModal}
        campaign={campaign}
        targetFeatureOptions={formOptions?.targetFeatures || []}
        roleOptions={formOptions?.availableRoles || []}
        rolesLoading={optionsLoading}
        submitting={saving}
        onClose={() => setShowBasicInfoModal(false)}
        onSubmit={handleSaveBasicInfo}
      />
    </CContainer>
  )
}