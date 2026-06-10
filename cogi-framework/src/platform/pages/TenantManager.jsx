import { useEffect, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
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
} from '@coreui/react'
import {
  activatePlatformTenantAdmin,
  activatePlatformTenantRole,
  createPlatformTenant,
  createPlatformTenantStorageConfig,
  deactivatePlatformTenantRole,
  getApiMessage,
  getPlatformTenantAdmins,
  getPlatformTenantFeatures,
  getPlatformTenantRoles,
  getPlatformTenantStorageConfigs,
  getPlatformTenants,
  inactivePlatformTenantAdmin,
  invitePlatformTenantAdmin,
  uploadPlatformTenantLogo,
  updatePlatformTenant,
  updatePlatformTenantDefaultStorageConfig,
  updatePlatformTenantFeature,
  updatePlatformTenantStorageConfig,
  updatePlatformTenantStatus,
} from '../services/platformApi'

function getRoleStateBadge(role) {
  const state = String(role?.assignmentState || '').trim().toLowerCase()
  if (state === 'inactive') {
    return { color: 'warning', label: 'Da tat' }
  }
  if (state === 'unassigned') {
    return { color: 'secondary', label: 'Chua gan' }
  }
  return null
}

function getStatusColor(status) {
  const normalized = String(status || '').trim().toUpperCase()
  if (normalized === 'ACTIVE') return 'success'
  if (normalized === 'SUSPENDED') return 'warning'
  if (normalized === 'DELETED') return 'secondary'
  return 'light'
}

function formatCreatedAt(value) {
  const timestamp = Date.parse(String(value || ''))
  if (Number.isNaN(timestamp)) return '-'

  return new Date(timestamp).toLocaleString('vi-VN')
}

function getTenantAdminStatusBadge(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'active') return { color: 'success', label: 'Active' }
  return { color: 'secondary', label: 'Inactive' }
}

function toAbsoluteMediaUrl(url) {
  if (!url) return ''
  if (String(url).startsWith('http')) return String(url)

  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '')
  if (!apiBaseUrl) return String(url)

  const normalizedPath = String(url).startsWith('/') ? String(url) : `/${String(url)}`
  const hostBase = apiBaseUrl.endsWith('/api') ? apiBaseUrl.slice(0, -4) : apiBaseUrl
  return `${hostBase}${normalizedPath}`
}

function createTenantFormState(tenant) {
  return {
    name: String(tenant?.name || ''),
    code: String(tenant?.code || ''),
    shortName: String(tenant?.shortName || ''),
    tenantStatus: String(tenant?.status || 'draft') || 'draft',
    description: String(tenant?.description || ''),
    slogan: String(tenant?.slogan || ''),
    defaultLocale: String(tenant?.defaultLocale || ''),
    timezone: String(tenant?.timezone || ''),
    defaultPublicRoute: String(tenant?.defaultPublicRoute || ''),
    defaultProtectedRoute: String(tenant?.defaultProtectedRoute || ''),
    logoId: tenant?.logo?.id || null,
    logoName: String(tenant?.logo?.name || ''),
    logoUrl: toAbsoluteMediaUrl(tenant?.logoUrl || tenant?.logo?.url || ''),
    logoFile: null,
    logoCleared: false,
  }
}

function createTenantAnalyticsFormState(tenant) {
  return {
    googleAnalyticsId: String(tenant?.googleAnalyticsId || ''),
    googleTagManagerId: String(tenant?.googleTagManagerId || ''),
    googleSearchConsoleVerification: String(tenant?.googleSearchConsoleVerification || ''),
    facebookPixelId: String(tenant?.facebookPixelId || ''),
  }
}

const GOOGLE_ANALYTICS_ID_PATTERN = /^G-[A-Z0-9]+$/i
const GOOGLE_TAG_MANAGER_ID_PATTERN = /^GTM-[A-Z0-9]+$/i

function validateTenantAnalyticsForm(form) {
  const googleAnalyticsId = String(form?.googleAnalyticsId || '').trim()
  const googleTagManagerId = String(form?.googleTagManagerId || '').trim()

  if (googleAnalyticsId && !GOOGLE_ANALYTICS_ID_PATTERN.test(googleAnalyticsId)) {
    return 'Google Analytics Measurement ID phai dung dinh dang G-XXXXXXXXXX'
  }

  if (googleTagManagerId && !GOOGLE_TAG_MANAGER_ID_PATTERN.test(googleTagManagerId)) {
    return 'Google Tag Manager ID phai dung dinh dang GTM-XXXXXXX'
  }

  return ''
}

function formatJsonEditor(value) {
  if (value === undefined || value === null || value === '') return '{\n  \n}'

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function formatStorageSettingsPreview(value) {
  const text = formatJsonEditor(value).replace(/\s+/g, ' ').trim()
  if (!text) return '-'
  if (text.length <= 100) return text
  return `${text.slice(0, 97)}...`
}

function createTenantStorageFormState(storageConfig) {
  return {
    name: String(storageConfig?.name || ''),
    provider: String(storageConfig?.provider || 'local').trim().toLowerCase() || 'local',
    basePath: String(storageConfig?.basePath || ''),
    publicBaseUrl: String(storageConfig?.publicBaseUrl || ''),
    quotaGB: String(storageConfig?.quotaGB ?? '5'),
    usedBytes: String(storageConfig?.usedBytes ?? '0'),
    isActive: storageConfig?.isActive !== false,
    settingsText: formatJsonEditor(storageConfig?.settings),
    notes: String(storageConfig?.notes || ''),
  }
}

function validateTenantStorageForm(form) {
  if (!String(form?.name || '').trim()) return 'Ten storage config la bat buoc'
  if (!String(form?.basePath || '').trim()) return 'Base path la bat buoc'

  const quotaGB = String(form?.quotaGB || '').trim()
  if (quotaGB && (!Number.isFinite(Number(quotaGB)) || Number(quotaGB) < 0)) {
    return 'Quota GB phai la so khong am'
  }

  const usedBytes = String(form?.usedBytes || '').trim()
  if (!/^\d+$/.test(usedBytes || '0')) {
    return 'Used bytes phai la so nguyen khong am'
  }

  const settingsText = String(form?.settingsText || '').trim()
  if (settingsText) {
    try {
      JSON.parse(settingsText)
    } catch {
      return 'Settings JSON khong hop le'
    }
  }

  return ''
}

export default function TenantManager() {
  const [loading, setLoading] = useState(false)
  const [actionId, setActionId] = useState(null)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [featureModalVisible, setFeatureModalVisible] = useState(false)
  const [featureModalLoading, setFeatureModalLoading] = useState(false)
  const [featureActionKey, setFeatureActionKey] = useState('')
  const [featureTenant, setFeatureTenant] = useState(null)
  const [assignedFeatures, setAssignedFeatures] = useState([])
  const [availableFeatures, setAvailableFeatures] = useState([])
  const [selectedAssignedIds, setSelectedAssignedIds] = useState([])
  const [selectedAvailableIds, setSelectedAvailableIds] = useState([])
  const [roleModalVisible, setRoleModalVisible] = useState(false)
  const [roleModalLoading, setRoleModalLoading] = useState(false)
  const [roleActionKey, setRoleActionKey] = useState('')
  const [roleTenant, setRoleTenant] = useState(null)
  const [activeRoles, setActiveRoles] = useState([])
  const [inactiveRoles, setInactiveRoles] = useState([])
  const [unassignedRoles, setUnassignedRoles] = useState([])
  const [selectedActiveRoleIds, setSelectedActiveRoleIds] = useState([])
  const [selectedInactiveRoleIds, setSelectedInactiveRoleIds] = useState([])
  const [roleConfirmVisible, setRoleConfirmVisible] = useState(false)
  const [roleConfirmRoles, setRoleConfirmRoles] = useState([])
  const [roleConfirmAffectedCount, setRoleConfirmAffectedCount] = useState(0)
  const [tenantAdminModalVisible, setTenantAdminModalVisible] = useState(false)
  const [tenantAdminModalLoading, setTenantAdminModalLoading] = useState(false)
  const [tenantAdminActionKey, setTenantAdminActionKey] = useState('')
  const [tenantAdminTenant, setTenantAdminTenant] = useState(null)
  const [tenantAdminRoleCode, setTenantAdminRoleCode] = useState('')
  const [tenantAdminRole, setTenantAdminRole] = useState(null)
  const [tenantAdmins, setTenantAdmins] = useState([])
  const [tenantAdminIdentifier, setTenantAdminIdentifier] = useState('')
  const [tenantAdminModalError, setTenantAdminModalError] = useState('')
  const [tenantFormModalVisible, setTenantFormModalVisible] = useState(false)
  const [tenantFormSaving, setTenantFormSaving] = useState(false)
  const [tenantLogoUploading, setTenantLogoUploading] = useState(false)
  const [editingTenant, setEditingTenant] = useState(null)
  const [tenantForm, setTenantForm] = useState(createTenantFormState(null))
  const [analyticsModalVisible, setAnalyticsModalVisible] = useState(false)
  const [analyticsSaving, setAnalyticsSaving] = useState(false)
  const [analyticsTenant, setAnalyticsTenant] = useState(null)
  const [analyticsForm, setAnalyticsForm] = useState(createTenantAnalyticsFormState(null))
  const [storageModalVisible, setStorageModalVisible] = useState(false)
  const [storageModalLoading, setStorageModalLoading] = useState(false)
  const [storageActionKey, setStorageActionKey] = useState('')
  const [storageTenant, setStorageTenant] = useState(null)
  const [storageConfigs, setStorageConfigs] = useState([])
  const [storageDefaultConfigId, setStorageDefaultConfigId] = useState(null)
  const [storageFormVisible, setStorageFormVisible] = useState(false)
  const [editingStorageId, setEditingStorageId] = useState(null)
  const [storageForm, setStorageForm] = useState(createTenantStorageFormState(null))

  useEffect(() => {
    let cancelled = false

    async function loadTenants() {
      setLoading(true)
      setError('')

      try {
        const nextRows = await getPlatformTenants()
        if (cancelled) return
        setRows(nextRows)
      } catch (requestError) {
        if (cancelled) return
        setError(getApiMessage(requestError, 'Khong tai duoc danh sach tenant'))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadTenants()

    return () => {
      cancelled = true
    }
  }, [])

  async function reloadTenants() {
    const nextRows = await getPlatformTenants()
    setRows(nextRows)
  }

  async function handleStatusAction(tenantId, nextStatus) {
    setActionId(tenantId)
    setError('')
    setSuccess('')

    try {
      await updatePlatformTenantStatus(tenantId, nextStatus)
      await reloadTenants()
      setSuccess('Cap nhat tenant status thanh cong')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong cap nhat duoc tenant status'))
    } finally {
      setActionId(null)
    }
  }

  function handleOpenCreateTenantModal() {
    setTenantFormModalVisible(true)
    setTenantFormSaving(false)
    setTenantLogoUploading(false)
    setEditingTenant(null)
    setTenantForm(createTenantFormState({ tenantStatus: 'draft' }))
    setError('')
    setSuccess('')
  }

  function handleOpenEditTenantModal(tenantRow) {
    setTenantFormModalVisible(true)
    setTenantFormSaving(false)
    setTenantLogoUploading(false)
    setEditingTenant(tenantRow || null)
    setTenantForm(createTenantFormState(tenantRow))
    setError('')
    setSuccess('')
  }

  function handleCloseTenantFormModal() {
    if (tenantFormSaving || tenantLogoUploading) return
    setTenantFormModalVisible(false)
    setTenantFormSaving(false)
    setTenantLogoUploading(false)
    setEditingTenant(null)
    setTenantForm(createTenantFormState(null))
  }

  function handleOpenAnalyticsModal(tenantRow) {
    setAnalyticsModalVisible(true)
    setAnalyticsSaving(false)
    setAnalyticsTenant(tenantRow || null)
    setAnalyticsForm(createTenantAnalyticsFormState(tenantRow))
    setError('')
    setSuccess('')
  }

  function handleCloseAnalyticsModal() {
    if (analyticsSaving) return
    setAnalyticsModalVisible(false)
    setAnalyticsSaving(false)
    setAnalyticsTenant(null)
    setAnalyticsForm(createTenantAnalyticsFormState(null))
  }

  function applyTenantStorageModalData(result, fallbackTenant = null) {
    const nextTenant = result?.tenant || fallbackTenant || null
    setStorageTenant(nextTenant)
    setStorageConfigs(Array.isArray(result?.storageConfigs) ? result.storageConfigs : [])
    setStorageDefaultConfigId(nextTenant?.storageDefaultConfigId || null)
  }

  async function loadTenantStorageModalData(tenantId, fallbackTenant = null) {
    const result = await getPlatformTenantStorageConfigs(tenantId)
    applyTenantStorageModalData(result, fallbackTenant)
    return result
  }

  async function handleOpenStorageModal(tenantRow) {
    setStorageModalVisible(true)
    setStorageModalLoading(true)
    setStorageActionKey('')
    setStorageTenant(tenantRow || null)
    setStorageConfigs([])
    setStorageDefaultConfigId(tenantRow?.storageDefaultConfigId || null)
    setStorageFormVisible(false)
    setEditingStorageId(null)
    setStorageForm(createTenantStorageFormState(null))
    setError('')
    setSuccess('')

    try {
      await loadTenantStorageModalData(tenantRow.id, tenantRow)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong tai duoc danh sach storage config cua tenant'))
      setStorageModalVisible(false)
    } finally {
      setStorageModalLoading(false)
    }
  }

  function handleCloseStorageModal() {
    if (storageModalLoading || storageActionKey) return
    setStorageModalVisible(false)
    setStorageModalLoading(false)
    setStorageActionKey('')
    setStorageTenant(null)
    setStorageConfigs([])
    setStorageDefaultConfigId(null)
    setStorageFormVisible(false)
    setEditingStorageId(null)
    setStorageForm(createTenantStorageFormState(null))
  }

  function handleStartCreateStorageConfig() {
    setEditingStorageId(null)
    setStorageForm(createTenantStorageFormState(null))
    setStorageFormVisible(true)
  }

  function handleStartEditStorageConfig(item) {
    setEditingStorageId(item?.id || null)
    setStorageForm(createTenantStorageFormState(item))
    setStorageFormVisible(true)
  }

  function handleCancelStorageForm() {
    if (storageActionKey) return
    setEditingStorageId(null)
    setStorageForm(createTenantStorageFormState(null))
    setStorageFormVisible(false)
  }

  async function handleTenantLogoChange(event) {
    const file = event.target.files?.[0] || null
    if (!file) return

    setTenantLogoUploading(true)
    setError('')
    setSuccess('')

    try {
      const uploaded = await uploadPlatformTenantLogo(file)
      setTenantForm((prev) => ({
        ...prev,
        logoId: uploaded?.id || null,
        logoName: String(uploaded?.name || file.name || ''),
        logoUrl: toAbsoluteMediaUrl(uploaded?.url || ''),
        logoFile: null,
        logoCleared: false,
      }))
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong upload duoc logo tenant'))
    } finally {
      setTenantLogoUploading(false)
      event.target.value = ''
    }
  }

  function handleClearTenantLogo() {
    setTenantForm((prev) => ({
      ...prev,
      logoId: null,
      logoName: '',
      logoUrl: '',
      logoFile: null,
      logoCleared: true,
    }))
  }

  async function handleSubmitTenantForm(event) {
    event?.preventDefault?.()

    setTenantFormSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        name: tenantForm.name,
        code: tenantForm.code,
        shortName: tenantForm.shortName,
        tenantStatus: tenantForm.tenantStatus,
        description: tenantForm.description,
        slogan: tenantForm.slogan,
        defaultLocale: tenantForm.defaultLocale,
        timezone: tenantForm.timezone,
        defaultPublicRoute: tenantForm.defaultPublicRoute,
        defaultProtectedRoute: tenantForm.defaultProtectedRoute,
        logo: tenantForm.logoId || null,
      }

      if (editingTenant?.id) {
        await updatePlatformTenant(editingTenant.id, payload)
        setSuccess('Cap nhat tenant thanh cong')
      } else {
        await createPlatformTenant(payload)
        setSuccess('Them moi tenant thanh cong')
      }

      await reloadTenants()
      setTenantFormModalVisible(false)
      setEditingTenant(null)
      setTenantForm(createTenantFormState(null))
    } catch (requestError) {
      setError(getApiMessage(requestError, editingTenant?.id ? 'Khong cap nhat duoc tenant' : 'Khong them moi duoc tenant'))
    } finally {
      setTenantFormSaving(false)
    }
  }

  async function handleSubmitAnalyticsForm() {
    if (!analyticsTenant?.id) return

    const validationMessage = validateTenantAnalyticsForm(analyticsForm)
    if (validationMessage) {
      setError(validationMessage)
      setSuccess('')
      return
    }

    setAnalyticsSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        name: analyticsTenant.name,
        code: analyticsTenant.code,
        shortName: analyticsTenant.shortName,
        tenantStatus: analyticsTenant.status,
        description: analyticsTenant.description,
        slogan: analyticsTenant.slogan,
        defaultLocale: analyticsTenant.defaultLocale,
        timezone: analyticsTenant.timezone,
        defaultPublicRoute: analyticsTenant.defaultPublicRoute,
        defaultProtectedRoute: analyticsTenant.defaultProtectedRoute,
        logo: analyticsTenant?.logo?.id || null,
        googleAnalyticsId: analyticsForm.googleAnalyticsId.trim(),
        googleTagManagerId: analyticsForm.googleTagManagerId.trim(),
        googleSearchConsoleVerification: analyticsForm.googleSearchConsoleVerification.trim(),
        facebookPixelId: analyticsForm.facebookPixelId.trim(),
      }

      const updatedTenant = await updatePlatformTenant(analyticsTenant.id, payload)
      await reloadTenants()
      setAnalyticsTenant(updatedTenant || analyticsTenant)
      setAnalyticsModalVisible(false)
      setAnalyticsForm(createTenantAnalyticsFormState(null))
      setSuccess('Cap nhat Analytics & Tracking thanh cong')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong cap nhat duoc Analytics & Tracking'))
    } finally {
      setAnalyticsSaving(false)
    }
  }

  async function handleSaveTenantDefaultStorageConfig() {
    if (!storageTenant?.id) return

    setStorageActionKey(`${storageTenant.id}:default`)
    setError('')
    setSuccess('')

    try {
      const result = await updatePlatformTenantDefaultStorageConfig(storageTenant.id, storageDefaultConfigId || null)
      applyTenantStorageModalData(result, storageTenant)
      await reloadTenants()
      setSuccess('Cap nhat storage mac dinh thanh cong')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong cap nhat duoc storage mac dinh'))
    } finally {
      setStorageActionKey('')
    }
  }

  async function handleSubmitTenantStorageForm() {
    if (!storageTenant?.id) return

    const validationMessage = validateTenantStorageForm(storageForm)
    if (validationMessage) {
      setError(validationMessage)
      setSuccess('')
      return
    }

    const rawSettings = String(storageForm.settingsText || '').trim()
    let parsedSettings = null
    if (rawSettings) {
      parsedSettings = JSON.parse(rawSettings)
    }

    setStorageActionKey(`${storageTenant.id}:${editingStorageId ? `edit:${editingStorageId}` : 'create'}`)
    setError('')
    setSuccess('')

    try {
      const payload = {
        name: String(storageForm.name || '').trim(),
        provider: String(storageForm.provider || 'local').trim().toLowerCase() || 'local',
        basePath: String(storageForm.basePath || '').trim(),
        publicBaseUrl: String(storageForm.publicBaseUrl || '').trim() || null,
        quotaGB: String(storageForm.quotaGB || '').trim() || null,
        usedBytes: String(storageForm.usedBytes || '0').trim() || '0',
        isActive: Boolean(storageForm.isActive),
        settings: parsedSettings,
        notes: String(storageForm.notes || '').trim() || null,
      }

      const result = editingStorageId
        ? await updatePlatformTenantStorageConfig(storageTenant.id, editingStorageId, payload)
        : await createPlatformTenantStorageConfig(storageTenant.id, payload)

      applyTenantStorageModalData(result, storageTenant)
      await reloadTenants()
      setStorageFormVisible(false)
      setEditingStorageId(null)
      setStorageForm(createTenantStorageFormState(null))
      setSuccess(editingStorageId ? 'Cap nhat storage config thanh cong' : 'Them storage config thanh cong')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong luu duoc storage config'))
    } finally {
      setStorageActionKey('')
    }
  }

  async function handleOpenFeatureModal(tenantRow) {
    setFeatureModalVisible(true)
    setFeatureModalLoading(true)
    setFeatureActionKey('')
    setFeatureTenant(tenantRow || null)
    setAssignedFeatures([])
    setAvailableFeatures([])
    setSelectedAssignedIds([])
    setSelectedAvailableIds([])
    setError('')
    setSuccess('')

    try {
      const result = await getPlatformTenantFeatures(tenantRow.id)
      setFeatureTenant(result?.tenant || tenantRow || null)
      setAssignedFeatures(Array.isArray(result?.assigned) ? result.assigned : [])
      setAvailableFeatures(Array.isArray(result?.available) ? result.available : [])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong tai duoc danh sach feature cua tenant'))
      setFeatureModalVisible(false)
    } finally {
      setFeatureModalLoading(false)
    }
  }

  async function loadRoleModalData(tenantId, fallbackTenant = null) {
    const result = await getPlatformTenantRoles(tenantId)
    setRoleTenant(result?.tenant || fallbackTenant || null)
    setActiveRoles(Array.isArray(result?.activeRoles) ? result.activeRoles : [])
    setInactiveRoles(Array.isArray(result?.inactiveRoles) ? result.inactiveRoles : [])
    setUnassignedRoles(Array.isArray(result?.unassignedRoles) ? result.unassignedRoles : [])
    setSelectedActiveRoleIds([])
    setSelectedInactiveRoleIds([])
    return result
  }

  async function handleOpenRoleModal(tenantRow) {
    setRoleModalVisible(true)
    setRoleModalLoading(true)
    setRoleActionKey('')
    setRoleTenant(tenantRow || null)
    setActiveRoles([])
    setInactiveRoles([])
    setUnassignedRoles([])
    setSelectedActiveRoleIds([])
    setSelectedInactiveRoleIds([])
    setRoleConfirmVisible(false)
    setRoleConfirmRoles([])
    setRoleConfirmAffectedCount(0)
    setError('')
    setSuccess('')

    try {
      await loadRoleModalData(tenantRow.id, tenantRow)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong tai duoc danh sach role cua tenant'))
      setRoleModalVisible(false)
    } finally {
      setRoleModalLoading(false)
    }
  }

  async function loadTenantAdminModalData(tenantId, fallbackTenant = null) {
    const result = await getPlatformTenantAdmins(tenantId)
    setTenantAdminTenant(result?.tenant || fallbackTenant || null)
    setTenantAdminRoleCode(String(result?.tenantAdminRoleCode || '').trim())
    setTenantAdminRole(result?.tenantAdminRole || null)
    setTenantAdmins(Array.isArray(result?.admins) ? result.admins : [])
    return result
  }

  async function handleOpenTenantAdminModal(tenantRow) {
    setTenantAdminModalVisible(true)
    setTenantAdminModalLoading(true)
    setTenantAdminActionKey('')
    setTenantAdminTenant(tenantRow || null)
    setTenantAdminRoleCode('')
    setTenantAdminRole(null)
    setTenantAdmins([])
    setTenantAdminIdentifier('')
    setTenantAdminModalError('')
    setError('')
    setSuccess('')

    try {
      await loadTenantAdminModalData(tenantRow.id, tenantRow)
    } catch (requestError) {
      setTenantAdminModalError(getApiMessage(requestError, 'Khong tai duoc danh sach Tenant Admin cua tenant'))
    } finally {
      setTenantAdminModalLoading(false)
    }
  }

  function handleCloseFeatureModal() {
    if (featureModalLoading || featureActionKey) return
    setFeatureModalVisible(false)
    setFeatureTenant(null)
    setAssignedFeatures([])
    setAvailableFeatures([])
    setSelectedAssignedIds([])
    setSelectedAvailableIds([])
  }

  function handleCloseRoleModal() {
    if (roleModalLoading || roleActionKey) return
    setRoleModalVisible(false)
    setRoleTenant(null)
    setActiveRoles([])
    setInactiveRoles([])
    setUnassignedRoles([])
    setSelectedActiveRoleIds([])
    setSelectedInactiveRoleIds([])
    setRoleConfirmVisible(false)
    setRoleConfirmRoles([])
    setRoleConfirmAffectedCount(0)
  }

  function handleCloseTenantAdminModal() {
    if (tenantAdminModalLoading || tenantAdminActionKey) return
    setTenantAdminModalVisible(false)
    setTenantAdminTenant(null)
    setTenantAdminRoleCode('')
    setTenantAdminRole(null)
    setTenantAdmins([])
    setTenantAdminIdentifier('')
    setTenantAdminModalError('')
  }

  async function handleOpenRoleModalFromTenantAdmin() {
    if (!tenantAdminTenant?.id) return
    handleCloseTenantAdminModal()
    await handleOpenRoleModal(tenantAdminTenant)
  }

  function formatFeatureOptionLabel(feature) {
    const groupName = String(feature?.group?.name || '').trim()
    const featureName = String(feature?.name || '').trim() || String(feature?.key || '').trim() || '-'
    return groupName ? `${groupName} / ${featureName}` : featureName
  }

  function formatRoleOptionLabel(role) {
    const roleName = String(role?.name || role?.type || '').trim() || '-'
    const roleType = String(role?.type || '').trim()
    return roleType && roleType.toLowerCase() !== roleName.toLowerCase()
      ? `${roleName} (${roleType})`
      : roleName
  }

  function toggleRoleSelection(roleId, setSelectedIds) {
    const nextId = String(roleId)
    setSelectedIds((prev) => (prev.includes(nextId) ? prev.filter((item) => item !== nextId) : [...prev, nextId]))
  }

  async function handleToggleFeatures(features, nextEnabled) {
    if (!featureTenant?.id || !Array.isArray(features) || features.length === 0) return

    setFeatureActionKey(`${featureTenant.id}:${nextEnabled ? 'enable' : 'disable'}`)
    setError('')
    setSuccess('')

    try {
      for (const feature of features) {
        // Keep each move durable immediately instead of batching a local-only change.
        await updatePlatformTenantFeature(featureTenant.id, feature.id, nextEnabled)
      }

      if (nextEnabled) {
        const movedFeatures = [...features].sort((left, right) => formatFeatureOptionLabel(left).localeCompare(formatFeatureOptionLabel(right)))
        setAssignedFeatures((prev) => [...prev, ...movedFeatures].sort((left, right) => formatFeatureOptionLabel(left).localeCompare(formatFeatureOptionLabel(right))))
        setAvailableFeatures((prev) => prev.filter((item) => !features.some((feature) => feature.id === item.id)))
        setSelectedAvailableIds([])
        setSuccess('Da gan feature cho tenant')
      } else {
        const movedFeatures = [...features].sort((left, right) => formatFeatureOptionLabel(left).localeCompare(formatFeatureOptionLabel(right)))
        setAvailableFeatures((prev) => [...prev, ...movedFeatures].sort((left, right) => formatFeatureOptionLabel(left).localeCompare(formatFeatureOptionLabel(right))))
        setAssignedFeatures((prev) => prev.filter((item) => !features.some((feature) => feature.id === item.id)))
        setSelectedAssignedIds([])
        setSuccess('Da go feature khoi tenant')
      }
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong cap nhat duoc feature cua tenant'))
    } finally {
      setFeatureActionKey('')
    }
  }

  async function handleActivateRoles(roles) {
    if (!roleTenant?.id || !Array.isArray(roles) || roles.length === 0) return

    setRoleActionKey(`${roleTenant.id}:activate`)
    setError('')
    setSuccess('')

    try {
      for (const role of roles) {
        await activatePlatformTenantRole(roleTenant.id, role.id)
      }
      await loadRoleModalData(roleTenant.id, roleTenant)
      setSuccess(roles.length > 1 ? 'Da kich hoat cac role cho tenant' : 'Da kich hoat role cho tenant')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong kich hoat duoc role cua tenant'))
    } finally {
      setRoleActionKey('')
    }
  }

  function handleRequestDeactivateRoles(roles) {
    if (!Array.isArray(roles) || roles.length === 0) return

    const affectedCount = roles.reduce((sum, role) => sum + Number(role?.activeUserRoleCount || 0), 0)
    setRoleConfirmRoles(roles)
    setRoleConfirmAffectedCount(affectedCount)
    setRoleConfirmVisible(true)
  }

  async function handleConfirmDeactivateRoles() {
    if (!roleTenant?.id || roleConfirmRoles.length === 0) return

    setRoleActionKey(`${roleTenant.id}:deactivate`)
    setError('')
    setSuccess('')

    try {
      let affectedCount = 0

      for (const role of roleConfirmRoles) {
        const result = await deactivatePlatformTenantRole(roleTenant.id, role.id)
        affectedCount += Number(result?.affectedUserRoleCount || 0)
      }

      await loadRoleModalData(roleTenant.id, roleTenant)
      setRoleConfirmVisible(false)
      setRoleConfirmRoles([])
      setRoleConfirmAffectedCount(0)
      setSuccess(
        affectedCount > 0
          ? `Da tat role cho tenant va cap nhat ${affectedCount} user-role assignment`
          : 'Da tat role cho tenant'
      )
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong tat duoc role cua tenant'))
    } finally {
      setRoleActionKey('')
    }
  }

  async function handleInviteTenantAdmin() {
    if (!tenantAdminTenant?.id) return

    const identifier = String(tenantAdminIdentifier || '').trim()
    if (!identifier) {
      setError('Vui long nhap username hoac email')
      return
    }

    setTenantAdminActionKey(`${tenantAdminTenant.id}:invite`)
    setError('')
    setSuccess('')
    setTenantAdminModalError('')

    try {
      const result = await invitePlatformTenantAdmin(tenantAdminTenant.id, identifier)
      await loadTenantAdminModalData(tenantAdminTenant.id, tenantAdminTenant)
      setTenantAdminIdentifier('')
      setSuccess(result?.message || 'Da moi/gan user lam Tenant Admin thanh cong.')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong moi/gan duoc Tenant Admin'))
    } finally {
      setTenantAdminActionKey('')
    }
  }

  async function handleInactiveTenantAdmin(admin) {
    if (!tenantAdminTenant?.id || !admin?.id) return

    const confirmed = window.confirm(`Inactive Tenant Admin ${admin?.username || admin?.email || `#${admin.id}`} cua tenant ${tenantAdminTenant?.name || '-'}?`)
    if (!confirmed) return

    setTenantAdminActionKey(`${tenantAdminTenant.id}:inactive:${admin.id}`)
    setError('')
    setSuccess('')
    setTenantAdminModalError('')

    try {
      const result = await inactivePlatformTenantAdmin(tenantAdminTenant.id, admin.id)
      await loadTenantAdminModalData(tenantAdminTenant.id, tenantAdminTenant)
      setSuccess(result?.message || 'Da inactive Tenant Admin thanh cong.')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong inactive duoc Tenant Admin'))
    } finally {
      setTenantAdminActionKey('')
    }
  }

  async function handleActivateTenantAdmin(admin) {
    if (!tenantAdminTenant?.id || !admin?.id) return

    setTenantAdminActionKey(`${tenantAdminTenant.id}:activate:${admin.id}`)
    setError('')
    setSuccess('')
    setTenantAdminModalError('')

    try {
      const result = await activatePlatformTenantAdmin(tenantAdminTenant.id, admin.id)
      await loadTenantAdminModalData(tenantAdminTenant.id, tenantAdminTenant)
      setSuccess(result?.message || 'Da kich hoat lai Tenant Admin thanh cong.')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong kich hoat lai duoc Tenant Admin'))
    } finally {
      setTenantAdminActionKey('')
    }
  }

  const selectedAvailableFeatures = availableFeatures.filter((item) => selectedAvailableIds.includes(String(item.id)))
  const selectedAssignedFeatures = assignedFeatures.filter((item) => selectedAssignedIds.includes(String(item.id)))
  const rightColumnRoles = [...inactiveRoles, ...unassignedRoles].sort((left, right) => formatRoleOptionLabel(left).localeCompare(formatRoleOptionLabel(right)))
  const selectedActiveRoles = activeRoles.filter((item) => selectedActiveRoleIds.includes(String(item.id)))
  const selectedRightColumnRoles = rightColumnRoles.filter((item) => selectedInactiveRoleIds.includes(String(item.id)))

  return (
    <>
      <CCard>
        <CCardHeader>
          <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
            <strong>Platform Tenant Manager</strong>
            <CButton color='primary' size='sm' onClick={handleOpenCreateTenantModal}>
              Them tenant
            </CButton>
          </div>
        </CCardHeader>
        <CCardBody>
        {success ? <CAlert color='success'>{success}</CAlert> : null}
        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        {loading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span>Dang tai tenant...</span>
          </div>
        ) : (
          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Name</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 180 }}>Code</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 160 }}>Status</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 200 }}>Created</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 420 }}>Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.map((item) => {
                const currentStatus = String(item?.status || '').trim().toUpperCase() || '-'
                const isSaving = actionId === item.id

                return (
                  <CTableRow key={item.id}>
                    <CTableDataCell>{item.name || '-'}</CTableDataCell>
                    <CTableDataCell>{item.code || '-'}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={getStatusColor(currentStatus)}>{currentStatus}</CBadge>
                    </CTableDataCell>
                    <CTableDataCell>{formatCreatedAt(item.createdAt)}</CTableDataCell>
                    <CTableDataCell>
                      <div className='d-flex gap-2 flex-wrap'>
                        <CButton
                          color='secondary'
                          variant='outline'
                          onClick={() => handleOpenEditTenantModal(item)}
                          disabled={isSaving}
                        >
                          Sua
                        </CButton>
                        <CButton
                          color='secondary'
                          onClick={() => handleOpenAnalyticsModal(item)}
                          disabled={isSaving}
                        >
                          Analytics & Tracking
                        </CButton>
                        <CButton
                          color='secondary'
                          variant='outline'
                          onClick={() => handleOpenStorageModal(item)}
                          disabled={isSaving}
                        >
                          Storages
                        </CButton>
                        <CButton
                          color='primary'
                          variant='outline'
                          onClick={() => handleOpenFeatureModal(item)}
                          disabled={isSaving}
                        >
                          Features
                        </CButton>
                        <CButton
                          color='info'
                          variant='outline'
                          onClick={() => handleOpenRoleModal(item)}
                          disabled={isSaving}
                        >
                          Roles
                        </CButton>
                        <CButton
                          color='dark'
                          variant='outline'
                          onClick={() => handleOpenTenantAdminModal(item)}
                          disabled={isSaving}
                        >
                          Tenant Admin
                        </CButton>
                        <CButton
                          color='success'
                          variant='outline'
                          onClick={() => handleStatusAction(item.id, 'ACTIVE')}
                          disabled={isSaving || currentStatus === 'ACTIVE'}
                        >
                          {isSaving ? 'Dang xu ly...' : 'Activate'}
                        </CButton>
                        <CButton
                          color='warning'
                          variant='outline'
                          onClick={() => handleStatusAction(item.id, 'SUSPENDED')}
                          disabled={isSaving || currentStatus === 'SUSPENDED'}
                        >
                          Suspend
                        </CButton>
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>
        )}
        </CCardBody>
      </CCard>

      <CModal visible={featureModalVisible} onClose={handleCloseFeatureModal} size='xl'>
        <CModalHeader closeButton={!featureModalLoading && !featureActionKey}>
          <CModalTitle>
            Quan ly features cho tenant {featureTenant?.name ? `- ${featureTenant.name}` : ''}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {featureModalLoading ? (
            <div className='d-flex align-items-center gap-2'>
              <CSpinner size='sm' />
              <span>Dang tai danh sach feature...</span>
            </div>
          ) : (
            <CRow className='g-3 align-items-center'>
              <CCol md={5}>
                <CFormLabel htmlFor='tenant-features-assigned'>Da gan cho tenant</CFormLabel>
                <CFormSelect
                  id='tenant-features-assigned'
                  multiple
                  size={20}
                  style={{ minHeight: '32rem' }}
                  value={selectedAssignedIds}
                  onChange={(event) => {
                    const values = Array.from(event.target.selectedOptions).map((option) => option.value)
                    setSelectedAssignedIds(values)
                  }}
                >
                  {assignedFeatures.map((feature) => (
                    <option key={feature.id} value={String(feature.id)}>
                      {formatFeatureOptionLabel(feature)}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>

              <CCol md={2}>
                <div className='d-flex flex-column gap-2'>
                  <CButton
                    color='primary'
                    onClick={() => handleToggleFeatures(selectedAvailableFeatures, true)}
                    disabled={featureModalLoading || Boolean(featureActionKey) || selectedAvailableFeatures.length === 0}
                  >
                    {'<<'}
                  </CButton>
                  <CButton
                    color='secondary'
                    onClick={() => handleToggleFeatures(selectedAssignedFeatures, false)}
                    disabled={featureModalLoading || Boolean(featureActionKey) || selectedAssignedFeatures.length === 0}
                  >
                    {'>>'}
                  </CButton>
                </div>
              </CCol>

              <CCol md={5}>
                <CFormLabel htmlFor='tenant-features-available'>Chua gan cho tenant</CFormLabel>
                <CFormSelect
                  id='tenant-features-available'
                  multiple
                  size={20}
                  style={{ minHeight: '32rem' }}
                  value={selectedAvailableIds}
                  onChange={(event) => {
                    const values = Array.from(event.target.selectedOptions).map((option) => option.value)
                    setSelectedAvailableIds(values)
                  }}
                >
                  {availableFeatures.map((feature) => (
                    <option key={feature.id} value={String(feature.id)}>
                      {formatFeatureOptionLabel(feature)}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
            </CRow>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={handleCloseFeatureModal} disabled={featureModalLoading || Boolean(featureActionKey)}>
            Dong
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={tenantFormModalVisible} onClose={handleCloseTenantFormModal}>
        <CModalHeader closeButton={!tenantFormSaving}>
          <CModalTitle>{editingTenant?.id ? 'Chinh sua tenant' : 'Them moi tenant'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CRow className='g-3'>
            <CCol md={12}>
              <CFormLabel htmlFor='tenant-form-name'>Name</CFormLabel>
              <CFormInput
                id='tenant-form-name'
                value={tenantForm.name}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, name: event.target.value }))}
                disabled={tenantFormSaving}
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor='tenant-form-code'>Code</CFormLabel>
              <CFormInput
                id='tenant-form-code'
                value={tenantForm.code}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, code: event.target.value.toLowerCase() }))}
                disabled={tenantFormSaving}
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor='tenant-form-short-name'>Short Name</CFormLabel>
              <CFormInput
                id='tenant-form-short-name'
                value={tenantForm.shortName}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, shortName: event.target.value }))}
                disabled={tenantFormSaving}
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor='tenant-form-status'>Status</CFormLabel>
              <CFormSelect
                id='tenant-form-status'
                value={tenantForm.tenantStatus}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, tenantStatus: event.target.value }))}
                disabled={tenantFormSaving}
              >
                <option value='draft'>draft</option>
                <option value='active'>active</option>
                <option value='inactive'>inactive</option>
                <option value='suspended'>suspended</option>
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor='tenant-form-default-locale'>Default Locale</CFormLabel>
              <CFormInput
                id='tenant-form-default-locale'
                value={tenantForm.defaultLocale}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, defaultLocale: event.target.value }))}
                disabled={tenantFormSaving}
              />
            </CCol>
            <CCol md={12}>
              <CFormLabel htmlFor='tenant-form-timezone'>Timezone</CFormLabel>
              <CFormInput
                id='tenant-form-timezone'
                value={tenantForm.timezone}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, timezone: event.target.value }))}
                disabled={tenantFormSaving}
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor='tenant-form-default-public-route'>Default Public Route</CFormLabel>
              <CFormInput
                id='tenant-form-default-public-route'
                value={tenantForm.defaultPublicRoute}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, defaultPublicRoute: event.target.value }))}
                disabled={tenantFormSaving || tenantLogoUploading}
                placeholder='/landing'
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel htmlFor='tenant-form-default-protected-route'>Default Protected Route</CFormLabel>
              <CFormInput
                id='tenant-form-default-protected-route'
                value={tenantForm.defaultProtectedRoute}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, defaultProtectedRoute: event.target.value }))}
                disabled={tenantFormSaving || tenantLogoUploading}
                placeholder='/dashboard'
              />
            </CCol>
            <CCol md={12}>
              <CFormLabel htmlFor='tenant-form-logo'>Logo</CFormLabel>
              <CFormInput
                id='tenant-form-logo'
                type='file'
                accept='image/*'
                onChange={handleTenantLogoChange}
                disabled={tenantFormSaving || tenantLogoUploading}
              />
              <div className='small text-body-secondary mt-1'>Logo se duoc upload vao media library ngay khi chon file.</div>
              {tenantForm.logoUrl ? (
                <div className='mt-2 d-flex flex-column gap-2'>
                  <img
                    src={tenantForm.logoUrl}
                    alt={tenantForm.logoName || tenantForm.name || 'Tenant logo'}
                    style={{ width: 96, height: 96, objectFit: 'contain', border: '1px solid #d8dbe0', borderRadius: 8, padding: 8 }}
                  />
                  <div className='small text-body-secondary'>{tenantForm.logoName || 'Logo hien tai'}</div>
                  <div>
                    <CButton color='secondary' variant='outline' size='sm' onClick={handleClearTenantLogo} disabled={tenantFormSaving || tenantLogoUploading}>
                      Xoa logo
                    </CButton>
                  </div>
                </div>
              ) : null}
            </CCol>
            <CCol md={12}>
              <CFormLabel htmlFor='tenant-form-slogan'>Slogan</CFormLabel>
              <CFormInput
                id='tenant-form-slogan'
                value={tenantForm.slogan}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, slogan: event.target.value }))}
                disabled={tenantFormSaving || tenantLogoUploading}
              />
            </CCol>
            <CCol md={12}>
              <CFormLabel htmlFor='tenant-form-description'>Description</CFormLabel>
              <CFormInput
                id='tenant-form-description'
                value={tenantForm.description}
                onChange={(event) => setTenantForm((prev) => ({ ...prev, description: event.target.value }))}
                disabled={tenantFormSaving || tenantLogoUploading}
              />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={handleCloseTenantFormModal} disabled={tenantFormSaving || tenantLogoUploading}>
            Dong
          </CButton>
          <CButton color='primary' onClick={handleSubmitTenantForm} disabled={tenantFormSaving || tenantLogoUploading}>
            {tenantFormSaving || tenantLogoUploading ? 'Dang xu ly...' : 'Luu'}
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={analyticsModalVisible} onClose={handleCloseAnalyticsModal}>
        <CModalHeader closeButton={!analyticsSaving}>
          <CModalTitle>
            Analytics & Tracking {analyticsTenant?.name ? `- ${analyticsTenant.name}` : ''}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CRow className='g-3'>
            <CCol md={12}>
              <CFormLabel htmlFor='tenant-analytics-ga-id'>Google Analytics Measurement ID</CFormLabel>
              <CFormInput
                id='tenant-analytics-ga-id'
                value={analyticsForm.googleAnalyticsId}
                onChange={(event) => setAnalyticsForm((prev) => ({ ...prev, googleAnalyticsId: event.target.value }))}
                disabled={analyticsSaving}
                placeholder='G-XXXXXXXXXX'
              />
            </CCol>
            <CCol md={12}>
              <CFormLabel htmlFor='tenant-analytics-gtm-id'>Google Tag Manager ID</CFormLabel>
              <CFormInput
                id='tenant-analytics-gtm-id'
                value={analyticsForm.googleTagManagerId}
                onChange={(event) => setAnalyticsForm((prev) => ({ ...prev, googleTagManagerId: event.target.value }))}
                disabled={analyticsSaving}
                placeholder='GTM-XXXXXXX'
              />
            </CCol>
            <CCol md={12}>
              <CFormLabel htmlFor='tenant-analytics-search-console'>Google Search Console Verification</CFormLabel>
              <CFormInput
                id='tenant-analytics-search-console'
                value={analyticsForm.googleSearchConsoleVerification}
                onChange={(event) => setAnalyticsForm((prev) => ({ ...prev, googleSearchConsoleVerification: event.target.value }))}
                disabled={analyticsSaving}
              />
            </CCol>
            <CCol md={12}>
              <CFormLabel htmlFor='tenant-analytics-facebook-pixel'>Facebook Pixel ID</CFormLabel>
              <CFormInput
                id='tenant-analytics-facebook-pixel'
                value={analyticsForm.facebookPixelId}
                onChange={(event) => setAnalyticsForm((prev) => ({ ...prev, facebookPixelId: event.target.value }))}
                disabled={analyticsSaving}
              />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={handleCloseAnalyticsModal} disabled={analyticsSaving}>
            Dong
          </CButton>
          <CButton color='primary' onClick={handleSubmitAnalyticsForm} disabled={analyticsSaving}>
            {analyticsSaving ? 'Dang xu ly...' : 'Luu'}
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={storageModalVisible} onClose={handleCloseStorageModal} size='xl'>
        <CModalHeader closeButton={!storageModalLoading && !storageActionKey}>
          <CModalTitle>
            Quan ly storage configs {storageTenant?.name ? `- ${storageTenant.name}` : ''}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {storageModalLoading ? (
            <div className='d-flex align-items-center gap-2'>
              <CSpinner size='sm' />
              <span>Dang tai danh sach storage config...</span>
            </div>
          ) : (
            <div className='d-flex flex-column gap-3'>
              <div className='border rounded p-3'>
                <CRow className='g-3 align-items-end'>
                  <CCol md={8}>
                    <CFormLabel htmlFor='tenant-storage-default-config'>Storage mac dinh</CFormLabel>
                    <CFormSelect
                      id='tenant-storage-default-config'
                      value={storageDefaultConfigId ? String(storageDefaultConfigId) : ''}
                      onChange={(event) => setStorageDefaultConfigId(event.target.value ? Number(event.target.value) : null)}
                      disabled={Boolean(storageActionKey)}
                    >
                      <option value=''>Chua chon storage mac dinh</option>
                      {storageConfigs.map((item) => (
                        <option key={item.id} value={String(item.id)}>{item.name || '-'} ({item.provider || '-'})</option>
                      ))}
                    </CFormSelect>
                  </CCol>
                  <CCol md={4}>
                    <CButton
                      color='primary'
                      className='w-100'
                      onClick={handleSaveTenantDefaultStorageConfig}
                      disabled={storageModalLoading || Boolean(storageActionKey)}
                    >
                      {storageActionKey === `${storageTenant?.id}:default` ? 'Dang xu ly...' : 'Luu storage mac dinh'}
                    </CButton>
                  </CCol>
                </CRow>
              </div>

              <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
                <div className='fw-semibold'>Danh sach storage config</div>
                <CButton color='success' size='sm' onClick={handleStartCreateStorageConfig} disabled={Boolean(storageActionKey)}>
                  Them storage config
                </CButton>
              </div>

              <CTable hover responsive>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Ten</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 120 }}>Provider</CTableHeaderCell>
                    <CTableHeaderCell>Base path</CTableHeaderCell>
                    <CTableHeaderCell>Public URL</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 100 }}>Quota</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 120 }}>Used bytes</CTableHeaderCell>
                    <CTableHeaderCell>Settings</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 140 }}>Trang thai</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 120 }}>Thao tac</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {storageConfigs.length === 0 ? (
                    <CTableRow>
                      <CTableDataCell colSpan={9} className='text-center text-medium-emphasis'>
                        Chua co storage config nao.
                      </CTableDataCell>
                    </CTableRow>
                  ) : storageConfigs.map((item) => (
                    <CTableRow key={item.id}>
                      <CTableDataCell>
                        <div className='d-flex flex-column gap-1'>
                          <span className='fw-semibold'>{item.name || '-'}</span>
                          {item.notes ? <span className='small text-medium-emphasis'>{item.notes}</span> : null}
                        </div>
                      </CTableDataCell>
                      <CTableDataCell>{String(item.provider || '-').toUpperCase()}</CTableDataCell>
                      <CTableDataCell>{item.basePath || '-'}</CTableDataCell>
                      <CTableDataCell>{item.publicBaseUrl || '-'}</CTableDataCell>
                      <CTableDataCell>{item.quotaGB || '0'}</CTableDataCell>
                      <CTableDataCell>{item.usedBytes || '0'}</CTableDataCell>
                      <CTableDataCell className='small text-medium-emphasis'>{formatStorageSettingsPreview(item.settings)}</CTableDataCell>
                      <CTableDataCell>
                        <div className='d-flex flex-column gap-1'>
                          <CBadge color={item.isActive ? 'success' : 'secondary'}>{item.isActive ? 'Active' : 'Inactive'}</CBadge>
                          {item.isDefault ? <CBadge color='primary'>Default</CBadge> : null}
                        </div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <CButton color='info' variant='outline' size='sm' onClick={() => handleStartEditStorageConfig(item)} disabled={Boolean(storageActionKey)}>
                          Sua
                        </CButton>
                      </CTableDataCell>
                    </CTableRow>
                  ))}
                </CTableBody>
              </CTable>

              {storageFormVisible ? (
                <div className='border rounded p-3'>
                  <div className='d-flex justify-content-between align-items-center gap-2 mb-3'>
                    <div className='fw-semibold'>{editingStorageId ? 'Cap nhat storage config' : 'Them storage config'}</div>
                    <CButton color='secondary' variant='outline' size='sm' onClick={handleCancelStorageForm} disabled={Boolean(storageActionKey)}>
                      Dong form
                    </CButton>
                  </div>
                  <CRow className='g-3'>
                    <CCol md={6}>
                      <CFormLabel htmlFor='storage-form-name'>Ten</CFormLabel>
                      <CFormInput
                        id='storage-form-name'
                        value={storageForm.name}
                        onChange={(event) => setStorageForm((prev) => ({ ...prev, name: event.target.value }))}
                        disabled={Boolean(storageActionKey)}
                      />
                    </CCol>
                    <CCol md={6}>
                      <CFormLabel htmlFor='storage-form-provider'>Provider</CFormLabel>
                      <CFormSelect
                        id='storage-form-provider'
                        value={storageForm.provider}
                        onChange={(event) => setStorageForm((prev) => ({ ...prev, provider: event.target.value }))}
                        disabled={Boolean(storageActionKey)}
                      >
                        <option value='local'>Local</option>
                        <option value='s3'>Amazon S3</option>
                        <option value='minio'>MinIO</option>
                        <option value='wasabi'>Wasabi</option>
                        <option value='azure'>Azure Blob</option>
                        <option value='gcs'>Google Cloud Storage</option>
                      </CFormSelect>
                    </CCol>
                    <CCol md={6}>
                      <CFormLabel htmlFor='storage-form-base-path'>Base path</CFormLabel>
                      <CFormInput
                        id='storage-form-base-path'
                        value={storageForm.basePath}
                        onChange={(event) => setStorageForm((prev) => ({ ...prev, basePath: event.target.value }))}
                        disabled={Boolean(storageActionKey)}
                      />
                    </CCol>
                    <CCol md={6}>
                      <CFormLabel htmlFor='storage-form-public-base-url'>Public URL</CFormLabel>
                      <CFormInput
                        id='storage-form-public-base-url'
                        value={storageForm.publicBaseUrl}
                        onChange={(event) => setStorageForm((prev) => ({ ...prev, publicBaseUrl: event.target.value }))}
                        disabled={Boolean(storageActionKey)}
                      />
                    </CCol>
                    <CCol md={4}>
                      <CFormLabel htmlFor='storage-form-quota'>Quota GB</CFormLabel>
                      <CFormInput
                        id='storage-form-quota'
                        type='number'
                        min='0'
                        step='0.01'
                        value={storageForm.quotaGB}
                        onChange={(event) => setStorageForm((prev) => ({ ...prev, quotaGB: event.target.value }))}
                        disabled={Boolean(storageActionKey)}
                      />
                    </CCol>
                    <CCol md={4}>
                      <CFormLabel htmlFor='storage-form-used-bytes'>Used bytes</CFormLabel>
                      <CFormInput
                        id='storage-form-used-bytes'
                        type='number'
                        min='0'
                        step='1'
                        value={storageForm.usedBytes}
                        onChange={(event) => setStorageForm((prev) => ({ ...prev, usedBytes: event.target.value }))}
                        disabled={Boolean(storageActionKey)}
                      />
                    </CCol>
                    <CCol md={4} className='d-flex align-items-end'>
                      <CFormCheck
                        id='storage-form-active'
                        label='Storage dang hoat dong'
                        checked={Boolean(storageForm.isActive)}
                        onChange={(event) => setStorageForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                        disabled={Boolean(storageActionKey)}
                      />
                    </CCol>
                    <CCol md={12}>
                      <CFormLabel htmlFor='storage-form-settings'>Settings JSON</CFormLabel>
                      <CFormTextarea
                        id='storage-form-settings'
                        rows={8}
                        value={storageForm.settingsText}
                        onChange={(event) => setStorageForm((prev) => ({ ...prev, settingsText: event.target.value }))}
                        disabled={Boolean(storageActionKey)}
                        style={{ fontFamily: 'monospace' }}
                      />
                    </CCol>
                    <CCol md={12}>
                      <CFormLabel htmlFor='storage-form-notes'>Ghi chu</CFormLabel>
                      <CFormTextarea
                        id='storage-form-notes'
                        rows={3}
                        value={storageForm.notes}
                        onChange={(event) => setStorageForm((prev) => ({ ...prev, notes: event.target.value }))}
                        disabled={Boolean(storageActionKey)}
                      />
                    </CCol>
                  </CRow>
                  <div className='d-flex justify-content-end gap-2 mt-3'>
                    <CButton color='secondary' variant='outline' onClick={handleCancelStorageForm} disabled={Boolean(storageActionKey)}>
                      Huy
                    </CButton>
                    <CButton color='primary' onClick={handleSubmitTenantStorageForm} disabled={Boolean(storageActionKey)}>
                      {storageActionKey ? 'Dang xu ly...' : (editingStorageId ? 'Cap nhat' : 'Them moi')}
                    </CButton>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={handleCloseStorageModal} disabled={storageModalLoading || Boolean(storageActionKey)}>
            Dong
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={roleModalVisible} onClose={handleCloseRoleModal} size='xl'>
        <CModalHeader closeButton={!roleModalLoading && !roleActionKey}>
          <CModalTitle>
            Quan ly roles cho tenant {roleTenant?.name ? `- ${roleTenant.name}` : ''}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {roleModalLoading ? (
            <div className='d-flex align-items-center gap-2'>
              <CSpinner size='sm' />
              <span>Dang tai danh sach role...</span>
            </div>
          ) : (
            <CRow className='g-3 align-items-center'>
              <CCol md={5}>
                <CFormLabel>Roles dang active</CFormLabel>
                <div className='border rounded p-2 d-flex flex-column gap-2 overflow-auto' style={{ minHeight: '32rem', maxHeight: '32rem' }}>
                  {activeRoles.length === 0 ? (
                    <div className='text-medium-emphasis small'>Khong co role active nao.</div>
                  ) : (
                    activeRoles.map((role) => {
                      const selected = selectedActiveRoleIds.includes(String(role.id))
                      return (
                        <div
                          key={`active-${role.id}`}
                          className={`border rounded px-3 py-2 ${selected ? 'border-primary bg-primary bg-opacity-10' : ''}`}
                          role='button'
                          tabIndex={0}
                          onClick={() => toggleRoleSelection(role.id, setSelectedActiveRoleIds)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              toggleRoleSelection(role.id, setSelectedActiveRoleIds)
                            }
                          }}
                        >
                          <div className='d-flex justify-content-between align-items-start gap-3'>
                            <div className='d-flex gap-2'>
                              <CFormCheck
                                className='mt-1'
                                checked={selected}
                                onChange={() => toggleRoleSelection(role.id, setSelectedActiveRoleIds)}
                                onClick={(event) => event.stopPropagation()}
                              />
                              <div>
                                <div className='fw-semibold'>{formatRoleOptionLabel(role)}</div>
                                {role.description ? <div className='small text-medium-emphasis'>{role.description}</div> : null}
                                <div className='small text-medium-emphasis'>Dang duoc gan cho {Number(role.activeUserRoleCount || 0)} user-role assignment</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </CCol>

              <CCol md={2}>
                <div className='d-flex flex-column gap-2'>
                  <CButton
                    color='primary'
                    onClick={() => handleActivateRoles(selectedRightColumnRoles)}
                    disabled={roleModalLoading || Boolean(roleActionKey) || selectedRightColumnRoles.length === 0}
                  >
                    {'<<'}
                  </CButton>
                  <CButton
                    color='secondary'
                    onClick={() => handleRequestDeactivateRoles(selectedActiveRoles)}
                    disabled={roleModalLoading || Boolean(roleActionKey) || selectedActiveRoles.length === 0}
                  >
                    {'>>'}
                  </CButton>
                </div>
              </CCol>

              <CCol md={5}>
                <CFormLabel>Roles chua active</CFormLabel>
                <div className='border rounded p-2 d-flex flex-column gap-2 overflow-auto' style={{ minHeight: '32rem', maxHeight: '32rem' }}>
                  {rightColumnRoles.length === 0 ? (
                    <div className='text-medium-emphasis small'>Khong co role inactive hoac chua gan.</div>
                  ) : (
                    rightColumnRoles.map((role) => {
                      const selected = selectedInactiveRoleIds.includes(String(role.id))
                      const badge = getRoleStateBadge(role)
                      return (
                        <div
                          key={`${role.assignmentState}-${role.id}`}
                          className={`border rounded px-3 py-2 ${selected ? 'border-primary bg-primary bg-opacity-10' : ''}`}
                          role='button'
                          tabIndex={0}
                          onClick={() => toggleRoleSelection(role.id, setSelectedInactiveRoleIds)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              toggleRoleSelection(role.id, setSelectedInactiveRoleIds)
                            }
                          }}
                        >
                          <div className='d-flex justify-content-between align-items-start gap-3'>
                            <div className='d-flex gap-2'>
                              <CFormCheck
                                className='mt-1'
                                checked={selected}
                                onChange={() => toggleRoleSelection(role.id, setSelectedInactiveRoleIds)}
                                onClick={(event) => event.stopPropagation()}
                              />
                              <div>
                                <div className='fw-semibold'>{formatRoleOptionLabel(role)}</div>
                                {role.description ? <div className='small text-medium-emphasis'>{role.description}</div> : null}
                                {Number(role.restorableUserRoleCount || 0) > 0 ? (
                                  <div className='small text-medium-emphasis'>Co the khoi phuc {Number(role.restorableUserRoleCount || 0)} user-role assignment</div>
                                ) : null}
                              </div>
                            </div>
                            {badge ? <CBadge color={badge.color}>{badge.label}</CBadge> : null}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </CCol>
            </CRow>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={handleCloseRoleModal} disabled={roleModalLoading || Boolean(roleActionKey)}>
            Dong
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={roleConfirmVisible} onClose={() => (!roleActionKey ? setRoleConfirmVisible(false) : undefined)}>
        <CModalHeader closeButton={!roleActionKey}>
          <CModalTitle>Xac nhan tat role</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className='mb-2'>
            Ban sap tat {roleConfirmRoles.length} role trong tenant {roleTenant?.name || '-'}. Assignment tenant-role se chuyen sang inactive va cac user-role assignment lien quan trong tenant nay se bi inactive voi reason = ROLE_DISABLED_FOR_TENANT.
          </p>
          <p className='mb-2'>
            {roleConfirmAffectedCount > 0
              ? `So user-role assignment du kien bi anh huong: ${roleConfirmAffectedCount}`
              : 'Backend hien khong co user-role assignment active nao bi anh huong.'}
          </p>
          <div className='small text-medium-emphasis'>
            {roleConfirmRoles.map((role) => formatRoleOptionLabel(role)).join(', ')}
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' disabled={Boolean(roleActionKey)} onClick={() => setRoleConfirmVisible(false)}>
            Huy
          </CButton>
          <CButton color='warning' disabled={Boolean(roleActionKey)} onClick={handleConfirmDeactivateRoles}>
            Xac nhan tat
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={tenantAdminModalVisible} onClose={handleCloseTenantAdminModal} size='xl'>
        <CModalHeader closeButton={!tenantAdminModalLoading && !tenantAdminActionKey}>
          <CModalTitle>
            Quan ly Tenant Admin {tenantAdminTenant?.name ? `- ${tenantAdminTenant.name}` : ''}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {tenantAdminModalLoading ? (
            <div className='d-flex align-items-center gap-2'>
              <CSpinner size='sm' />
              <span>Dang tai danh sach Tenant Admin...</span>
            </div>
          ) : (
            <div className='d-flex flex-column gap-3'>
              <div className='small text-medium-emphasis'>
                Tenant Admin Role Identifier: <strong>{tenantAdminRoleCode || tenantAdminRole?.code || 'TENANT_ADMIN'}</strong>
              </div>
              <div className='small text-medium-emphasis'>
                Gia tri nay co the la role code, role type hoac role name trong Strapi admin, vi giao dien role mac dinh thuong chi hien role name.
              </div>

              {tenantAdminModalError ? (
                <CAlert color='warning' className='mb-0'>
                  <div>{tenantAdminModalError}</div>
                  <div className='mt-2'>
                    <CButton color='warning' variant='outline' size='sm' onClick={handleOpenRoleModalFromTenantAdmin} disabled={tenantAdminModalLoading || Boolean(tenantAdminActionKey)}>
                      Mo modal Roles de bat role Tenant Admin
                    </CButton>
                  </div>
                </CAlert>
              ) : null}

              <div className='border rounded p-3'>
                <div className='fw-semibold mb-2'>Moi/Gan Tenant Admin</div>
                <CRow className='g-2 align-items-end'>
                  <CCol md={9}>
                    <CFormLabel htmlFor='tenant-admin-identifier'>Username hoac email</CFormLabel>
                    <CFormInput
                      id='tenant-admin-identifier'
                      value={tenantAdminIdentifier}
                      onChange={(event) => setTenantAdminIdentifier(event.target.value)}
                      placeholder='nhap username hoac email'
                      disabled={tenantAdminModalLoading || Boolean(tenantAdminActionKey) || Boolean(tenantAdminModalError)}
                    />
                  </CCol>
                  <CCol md={3}>
                    <CButton
                      color='primary'
                      className='w-100'
                      onClick={handleInviteTenantAdmin}
                      disabled={tenantAdminModalLoading || Boolean(tenantAdminActionKey) || Boolean(tenantAdminModalError)}
                    >
                      Moi/Gan Tenant Admin
                    </CButton>
                  </CCol>
                </CRow>
              </div>

              <CTable hover responsive>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Username</CTableHeaderCell>
                    <CTableHeaderCell>Email</CTableHeaderCell>
                    <CTableHeaderCell>Ho ten</CTableHeaderCell>
                    <CTableHeaderCell>So dien thoai</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 120 }}>Trang thai</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 180 }}>Ngay gan</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: 140 }}>Thao tac</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {tenantAdmins.length === 0 ? (
                    <CTableRow>
                      <CTableDataCell colSpan={7} className='text-center text-medium-emphasis'>
                        Chua co Tenant Admin nao.
                      </CTableDataCell>
                    </CTableRow>
                  ) : tenantAdmins.map((admin) => {
                    const badge = getTenantAdminStatusBadge(admin.status)
                    const isInactiveActionRunning = tenantAdminActionKey === `${tenantAdminTenant?.id}:inactive:${admin.id}`
                    const isActivateActionRunning = tenantAdminActionKey === `${tenantAdminTenant?.id}:activate:${admin.id}`
                    const isActiveAdmin = String(admin.status || '').toLowerCase() === 'active'

                    return (
                      <CTableRow key={admin.id}>
                        <CTableDataCell>{admin.username || '-'}</CTableDataCell>
                        <CTableDataCell>{admin.email || '-'}</CTableDataCell>
                        <CTableDataCell>{admin.fullName || '-'}</CTableDataCell>
                        <CTableDataCell>{admin.phone || '-'}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge color={badge.color}>{badge.label}</CBadge>
                        </CTableDataCell>
                        <CTableDataCell>{formatCreatedAt(admin.assignedAt)}</CTableDataCell>
                        <CTableDataCell>
                          {isActiveAdmin ? (
                            <CButton
                              color='warning'
                              variant='outline'
                              size='sm'
                              onClick={() => handleInactiveTenantAdmin(admin)}
                              disabled={tenantAdminModalLoading || Boolean(tenantAdminActionKey)}
                            >
                              {isInactiveActionRunning ? 'Dang xu ly...' : 'Inactive'}
                            </CButton>
                          ) : (
                            <CButton
                              color='success'
                              variant='outline'
                              size='sm'
                              onClick={() => handleActivateTenantAdmin(admin)}
                              disabled={tenantAdminModalLoading || Boolean(tenantAdminActionKey) || Boolean(tenantAdminModalError)}
                            >
                              {isActivateActionRunning ? 'Dang xu ly...' : 'Activate lai'}
                            </CButton>
                          )}
                        </CTableDataCell>
                      </CTableRow>
                    )
                  })}
                </CTableBody>
              </CTable>
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={handleCloseTenantAdminModal} disabled={tenantAdminModalLoading || Boolean(tenantAdminActionKey)}>
            Dong
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}