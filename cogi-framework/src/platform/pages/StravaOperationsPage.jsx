import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  COffcanvas,
  COffcanvasBody,
  COffcanvasHeader,
  COffcanvasTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import SimplePagination from '../../components/SimplePagination'
import StravaDiagnosticsTab from '../components/StravaDiagnosticsTab'
import {
  createPlatformStravaSubscription,
  deletePlatformStravaSubscription,
  getApiMessage,
  getPlatformStravaConnections,
  getPlatformStravaDashboardOverview,
  getPlatformStravaDiagnostics,
  getPlatformStravaSubscriptionOverview,
  getPlatformStravaSyncJobs,
  getPlatformStravaWebhookEvents,
} from '../services/platformApi'

function StatusBadge({ healthy }) {
  return <CBadge color={healthy ? 'success' : 'warning'}>{healthy ? 'Healthy' : 'Warning'}</CBadge>
}

function HealthBadge({ healthy, warningCount = 0 }) {
  if (healthy) {
    return <CBadge color="success">Healthy</CBadge>
  }
  if (warningCount > 0) {
    return <CBadge color="warning">Warning</CBadge>
  }
  return <CBadge color="danger">Error</CBadge>
}

function EnabledBadge({ enabled }) {
  return <CBadge color={enabled ? 'success' : 'secondary'}>{enabled ? 'Enabled' : 'Disabled'}</CBadge>
}

function YesNoBadge({ value, yesLabel = 'Yes', noLabel = 'No' }) {
  return <CBadge color={value ? 'success' : 'secondary'}>{value ? yesLabel : noLabel}</CBadge>
}

function MetricRow({ label, value, right }) {
  return (
    <div className="d-flex justify-content-between align-items-center py-1 gap-3">
      <span className="text-body-secondary">{label}</span>
      <div className="d-flex align-items-center gap-2 text-end">
        {right}
        <strong>{value ?? '-'}</strong>
      </div>
    </div>
  )
}

function OverviewCard({ title, children }) {
  return (
    <CCard className="h-100 shadow-sm border-0">
      <CCardHeader className="bg-white border-bottom-0">
        <strong>{title}</strong>
      </CCardHeader>
      <CCardBody>{children}</CCardBody>
    </CCard>
  )
}

function formatDateTime(value) {
  const timestamp = Date.parse(String(value || ''))
  if (Number.isNaN(timestamp)) return '-'
  return new Date(timestamp).toLocaleString('vi-VN')
}

function formatShortDateTime(value) {
  const timestamp = Date.parse(String(value || ''))
  if (Number.isNaN(timestamp)) return '-'
  return new Date(timestamp).toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getConnectionStatusBadge(status) {
  const normalized = String(status || '').trim().toUpperCase()
  if (normalized === 'ACTIVE') return { color: 'success', label: 'Active' }
  if (normalized === 'DISCONNECTED') return { color: 'secondary', label: 'Disconnected' }
  return { color: 'danger', label: 'Error' }
}

function formatAthleteMeta(row) {
  const pieces = [String(row?.athleteId || '').trim()].filter(Boolean)
  return pieces.join(' • ') || '-'
}

function formatUserMeta(row) {
  return String(row?.userEmail || '').trim() || '-'
}

function formatErrorPreview(value) {
  const text = String(value || '').trim()
  if (!text) return '-'
  if (text.length <= 120) return text
  return `${text.slice(0, 117)}...`
}

function DrawerField({ label, value, muted = false }) {
  return (
    <div className="py-2 border-bottom">
      <div className="small text-body-secondary mb-1">{label}</div>
      <div className={muted ? 'text-body-secondary' : ''}>{value || '-'}</div>
    </div>
  )
}

function getWebhookEventStatusBadge(status, lastError) {
  const normalized = String(status || '').trim().toLowerCase()
  const errorText = String(lastError || '').trim().toLowerCase()
  if (normalized === 'ignored' && (errorText.includes('duplicate') || errorText.includes('idempotency'))) {
    return { color: 'info', label: 'Duplicate' }
  }
  if (normalized === 'pending') return { color: 'secondary', label: 'Pending' }
  if (normalized === 'processing') return { color: 'primary', label: 'Processing' }
  if (normalized === 'processed') return { color: 'success', label: 'Processed' }
  if (normalized === 'ignored') return { color: 'warning', label: 'Ignored' }
  if (normalized === 'dead_letter') return { color: 'dark', label: 'Dead Letter' }
  return { color: 'danger', label: 'Failed' }
}

function getSyncJobStatusBadge(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'queued') return { color: 'secondary', label: 'Queued' }
  if (normalized === 'running') return { color: 'primary', label: 'Running' }
  if (normalized === 'partial_ready') return { color: 'info', label: 'Partial Ready' }
  if (normalized === 'completed') return { color: 'success', label: 'Completed' }
  if (normalized === 'cancelled') return { color: 'dark', label: 'Cancelled' }
  if (normalized === 'failed') return { color: 'danger', label: 'Failed' }
  return { color: 'warning', label: String(status || 'Unknown') }
}

function formatSyncJobResult(row) {
  const counters = [
    `P:${Number(row?.processedActivities || 0)}`,
    `C:${Number(row?.createdActivities || 0)}`,
    `U:${Number(row?.updatedActivities || 0)}`,
    `S:${Number(row?.skippedActivities || 0)}`,
    `F:${Number(row?.failedActivities || 0)}`,
  ]
  return counters.join(' • ')
}

function toPositiveText(value) {
  const text = String(value || '').trim()
  return /^\d+$/.test(text) ? text : ''
}

function readFlagText(value) {
  const text = String(value || '').trim().toLowerCase()
  return text === '1' || text === 'true' || text === 'yes' || text === 'on'
}

function readAllowedText(value, allowed) {
  const text = String(value || '').trim()
  return allowed.includes(text) ? text : ''
}

function readDiagnosticsWindow(value) {
  const text = String(value || '').trim().toLowerCase()
  return text === '7d' || text === '30d' ? text : '24h'
}

export default function StravaOperationsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = useMemo(() => {
    const tab = String(searchParams.get('tab') || '').trim().toLowerCase()
    return tab === 'connections' || tab === 'webhook-events' || tab === 'sync-jobs' || tab === 'subscription' || tab === 'diagnostics'
      ? tab
      : 'overview'
  }, [searchParams])
  const initialSyncConnectionId = useMemo(() => toPositiveText(searchParams.get('connectionId') || ''), [searchParams])
  const initialSyncTenantId = useMemo(() => toPositiveText(searchParams.get('tenantId') || ''), [searchParams])
  const initialConnectionStatus = useMemo(() => readAllowedText(searchParams.get('status'), ['ACTIVE', 'DISCONNECTED', 'ERROR']), [searchParams])
  const initialConnectionStaleSync = useMemo(() => readFlagText(searchParams.get('staleSync')), [searchParams])
  const initialWebhookStatus = useMemo(() => readAllowedText(searchParams.get('status'), ['pending', 'processing', 'processed', 'ignored', 'failed', 'dead_letter']), [searchParams])
  const initialWebhookStale = useMemo(() => readFlagText(searchParams.get('stale')), [searchParams])
  const initialSyncStatus = useMemo(() => readAllowedText(searchParams.get('status'), ['queued', 'running', 'partial_ready', 'completed', 'failed', 'cancelled']), [searchParams])
  const initialSyncStale = useMemo(() => readFlagText(searchParams.get('stale')), [searchParams])
  const initialDiagnosticsWindow = useMemo(() => readDiagnosticsWindow(searchParams.get('window')), [searchParams])

  const [activeTab, setActiveTab] = useState(initialTab)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [connectionsLoading, setConnectionsLoading] = useState(false)
  const [connectionsError, setConnectionsError] = useState('')
  const [connections, setConnections] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [pageCount, setPageCount] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState(initialConnectionStatus)
  const [connectionStaleSyncOnly, setConnectionStaleSyncOnly] = useState(initialConnectionStaleSync)
  const [searchDraft, setSearchDraft] = useState('')
  const [keyword, setKeyword] = useState('')
  const [sort, setSort] = useState('connectedAt:desc')
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedConnection, setSelectedConnection] = useState(null)
  const [webhookEventsLoading, setWebhookEventsLoading] = useState(false)
  const [webhookEventsError, setWebhookEventsError] = useState('')
  const [webhookEvents, setWebhookEvents] = useState([])
  const [webhookPage, setWebhookPage] = useState(1)
  const [webhookPageSize, setWebhookPageSize] = useState(20)
  const [webhookPageCount, setWebhookPageCount] = useState(1)
  const [webhookTotal, setWebhookTotal] = useState(0)
  const [webhookSearchDraft, setWebhookSearchDraft] = useState('')
  const [webhookKeyword, setWebhookKeyword] = useState('')
  const [webhookStatusFilter, setWebhookStatusFilter] = useState(initialWebhookStatus)
  const [webhookStaleOnly, setWebhookStaleOnly] = useState(initialWebhookStale)
  const [webhookObjectTypeFilter, setWebhookObjectTypeFilter] = useState('')
  const [webhookAspectTypeFilter, setWebhookAspectTypeFilter] = useState('')
  const [webhookTenantIdDraft, setWebhookTenantIdDraft] = useState('')
  const [webhookTenantId, setWebhookTenantId] = useState('')
  const [webhookConnectionIdDraft, setWebhookConnectionIdDraft] = useState('')
  const [webhookConnectionId, setWebhookConnectionId] = useState('')
  const [webhookDateFrom, setWebhookDateFrom] = useState('')
  const [webhookDateTo, setWebhookDateTo] = useState('')
  const [webhookSort, setWebhookSort] = useState('eventTime:desc')
  const [syncJobsLoading, setSyncJobsLoading] = useState(false)
  const [syncJobsError, setSyncJobsError] = useState('')
  const [syncJobs, setSyncJobs] = useState([])
  const [syncJobPage, setSyncJobPage] = useState(1)
  const [syncJobPageSize, setSyncJobPageSize] = useState(20)
  const [syncJobPageCount, setSyncJobPageCount] = useState(1)
  const [syncJobTotal, setSyncJobTotal] = useState(0)
  const [syncJobSearchDraft, setSyncJobSearchDraft] = useState('')
  const [syncJobKeyword, setSyncJobKeyword] = useState('')
  const [syncJobStatusFilter, setSyncJobStatusFilter] = useState(initialSyncStatus)
  const [syncJobStaleOnly, setSyncJobStaleOnly] = useState(initialSyncStale)
  const [syncJobModeFilter, setSyncJobModeFilter] = useState('')
  const [syncJobTenantIdDraft, setSyncJobTenantIdDraft] = useState(initialSyncTenantId)
  const [syncJobTenantId, setSyncJobTenantId] = useState(initialSyncTenantId)
  const [syncJobConnectionIdDraft, setSyncJobConnectionIdDraft] = useState(initialSyncConnectionId)
  const [syncJobConnectionId, setSyncJobConnectionId] = useState(initialSyncConnectionId)
  const [syncJobDateFrom, setSyncJobDateFrom] = useState('')
  const [syncJobDateTo, setSyncJobDateTo] = useState('')
  const [syncJobSort, setSyncJobSort] = useState('requestedAt:desc')
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  const [subscriptionError, setSubscriptionError] = useState('')
  const [subscriptionData, setSubscriptionData] = useState(null)
  const [subscriptionAction, setSubscriptionAction] = useState('')
  const [subscriptionNotice, setSubscriptionNotice] = useState(null)
  const [confirmAction, setConfirmAction] = useState('')
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false)
  const [diagnosticsError, setDiagnosticsError] = useState('')
  const [diagnosticsData, setDiagnosticsData] = useState(null)
  const [diagnosticsWindow, setDiagnosticsWindow] = useState(initialDiagnosticsWindow)

  const connectionQuery = useMemo(() => ({
    keyword,
    status: statusFilter,
    staleSync: connectionStaleSyncOnly,
    page,
    pageSize,
    sort,
  }), [connectionStaleSyncOnly, keyword, page, pageSize, sort, statusFilter])

  const fromToText = useMemo(() => {
    if (total === 0) return '0'
    const from = (page - 1) * pageSize + 1
    const to = Math.min(page * pageSize, total)
    return `${from}-${to}/${total}`
  }, [page, pageSize, total])

  const webhookFromToText = useMemo(() => {
    if (webhookTotal === 0) return '0'
    const from = (webhookPage - 1) * webhookPageSize + 1
    const to = Math.min(webhookPage * webhookPageSize, webhookTotal)
    return `${from}-${to}/${webhookTotal}`
  }, [webhookPage, webhookPageSize, webhookTotal])

  const syncJobFromToText = useMemo(() => {
    if (syncJobTotal === 0) return '0'
    const from = (syncJobPage - 1) * syncJobPageSize + 1
    const to = Math.min(syncJobPage * syncJobPageSize, syncJobTotal)
    return `${from}-${to}/${syncJobTotal}`
  }, [syncJobPage, syncJobPageSize, syncJobTotal])

  const anyTabLoading = loading || connectionsLoading || webhookEventsLoading || syncJobsLoading || subscriptionLoading || diagnosticsLoading

  const webhookQuery = useMemo(() => ({
    keyword: webhookKeyword,
    status: webhookStatusFilter,
    stale: webhookStaleOnly,
    objectType: webhookObjectTypeFilter,
    aspectType: webhookAspectTypeFilter,
    tenantId: webhookTenantId,
    connectionId: webhookConnectionId,
    dateFrom: webhookDateFrom,
    dateTo: webhookDateTo,
    page: webhookPage,
    pageSize: webhookPageSize,
    sort: webhookSort,
  }), [webhookAspectTypeFilter, webhookConnectionId, webhookDateFrom, webhookDateTo, webhookKeyword, webhookObjectTypeFilter, webhookPage, webhookPageSize, webhookSort, webhookStaleOnly, webhookStatusFilter, webhookTenantId])

  const syncJobQuery = useMemo(() => ({
    keyword: syncJobKeyword,
    status: syncJobStatusFilter,
    stale: syncJobStaleOnly,
    tenantId: syncJobTenantId,
    connectionId: syncJobConnectionId,
    syncMode: syncJobModeFilter,
    dateFrom: syncJobDateFrom,
    dateTo: syncJobDateTo,
    page: syncJobPage,
    pageSize: syncJobPageSize,
    sort: syncJobSort,
  }), [syncJobConnectionId, syncJobDateFrom, syncJobDateTo, syncJobKeyword, syncJobModeFilter, syncJobPage, syncJobPageSize, syncJobSort, syncJobStaleOnly, syncJobStatusFilter, syncJobTenantId])

  useEffect(() => {
    setActiveTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    if (activeTab === 'connections') {
      setStatusFilter(initialConnectionStatus)
      setConnectionStaleSyncOnly(initialConnectionStaleSync)
      setPage(1)
    }

    if (activeTab === 'webhook-events') {
      setWebhookStatusFilter(initialWebhookStatus)
      setWebhookStaleOnly(initialWebhookStale)
      setWebhookPage(1)
    }

    if (activeTab === 'sync-jobs') {
      setSyncJobStatusFilter(initialSyncStatus)
      setSyncJobStaleOnly(initialSyncStale)
      setSyncJobTenantIdDraft(initialSyncTenantId)
      setSyncJobTenantId(initialSyncTenantId)
      setSyncJobConnectionIdDraft(initialSyncConnectionId)
      setSyncJobConnectionId(initialSyncConnectionId)
      setSyncJobPage(1)
    }

    if (activeTab === 'diagnostics') {
      setDiagnosticsWindow(initialDiagnosticsWindow)
    }
  }, [
    activeTab,
    initialConnectionStaleSync,
    initialConnectionStatus,
    initialDiagnosticsWindow,
    initialSyncConnectionId,
    initialSyncStale,
    initialSyncStatus,
    initialSyncTenantId,
    initialWebhookStale,
    initialWebhookStatus,
  ])

  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const nextData = await getPlatformStravaDashboardOverview()
      setData(nextData)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong tai duoc tong quan Strava Operations'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'overview') return undefined
    void loadOverview()
    return undefined
  }, [activeTab, loadOverview])

  const loadConnections = useCallback(async () => {
    setConnectionsLoading(true)
    setConnectionsError('')

    try {
      const result = await getPlatformStravaConnections(connectionQuery)
      setConnections(Array.isArray(result?.data) ? result.data : [])
      const pagination = result?.meta?.pagination || {}
      setPage(Number(pagination.page || connectionQuery.page || 1))
      setPageSize(Number(pagination.pageSize || connectionQuery.pageSize || 20))
      setPageCount(Math.max(1, Number(pagination.pageCount || 1)))
      setTotal(Number(pagination.total || 0))
    } catch (requestError) {
      setConnections([])
      setPageCount(1)
      setTotal(0)
      setConnectionsError(getApiMessage(requestError, 'Khong tai duoc danh sach Strava connections'))
    } finally {
      setConnectionsLoading(false)
    }
  }, [connectionQuery])

  useEffect(() => {
    if (activeTab !== 'connections') return undefined
    loadConnections()
    return undefined
  }, [activeTab, loadConnections])

  const loadWebhookEvents = useCallback(async () => {
    setWebhookEventsLoading(true)
    setWebhookEventsError('')

    try {
      const result = await getPlatformStravaWebhookEvents(webhookQuery)
      setWebhookEvents(Array.isArray(result?.data) ? result.data : [])
      const pagination = result?.meta?.pagination || {}
      setWebhookPage(Number(pagination.page || webhookQuery.page || 1))
      setWebhookPageSize(Number(pagination.pageSize || webhookQuery.pageSize || 20))
      setWebhookPageCount(Math.max(1, Number(pagination.pageCount || 1)))
      setWebhookTotal(Number(pagination.total || 0))
    } catch (requestError) {
      setWebhookEvents([])
      setWebhookPageCount(1)
      setWebhookTotal(0)
      setWebhookEventsError(getApiMessage(requestError, 'Khong tai duoc danh sach webhook events'))
    } finally {
      setWebhookEventsLoading(false)
    }
  }, [webhookQuery])

  useEffect(() => {
    if (activeTab !== 'webhook-events') return undefined
    loadWebhookEvents()
    return undefined
  }, [activeTab, loadWebhookEvents])

  const loadSyncJobs = useCallback(async () => {
    setSyncJobsLoading(true)
    setSyncJobsError('')

    try {
      const result = await getPlatformStravaSyncJobs(syncJobQuery)
      setSyncJobs(Array.isArray(result?.data) ? result.data : [])
      const pagination = result?.meta?.pagination || {}
      setSyncJobPage(Number(pagination.page || syncJobQuery.page || 1))
      setSyncJobPageSize(Number(pagination.pageSize || syncJobQuery.pageSize || 20))
      setSyncJobPageCount(Math.max(1, Number(pagination.pageCount || 1)))
      setSyncJobTotal(Number(pagination.total || 0))
    } catch (requestError) {
      setSyncJobs([])
      setSyncJobPageCount(1)
      setSyncJobTotal(0)
      setSyncJobsError(getApiMessage(requestError, 'Khong tai duoc danh sach Strava sync jobs'))
    } finally {
      setSyncJobsLoading(false)
    }
  }, [syncJobQuery])

  useEffect(() => {
    if (activeTab !== 'sync-jobs') return undefined
    loadSyncJobs()
    return undefined
  }, [activeTab, loadSyncJobs])

  const loadSubscription = useCallback(async () => {
    setSubscriptionLoading(true)
    setSubscriptionError('')

    try {
      const nextData = await getPlatformStravaSubscriptionOverview()
      setSubscriptionData(nextData)
    } catch (requestError) {
      setSubscriptionData(null)
      setSubscriptionError(getApiMessage(requestError, 'Khong tai duoc Strava subscription'))
    } finally {
      setSubscriptionLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab !== 'subscription') return undefined
    void loadSubscription()
    return undefined
  }, [activeTab, loadSubscription])

  const loadDiagnostics = useCallback(async () => {
    setDiagnosticsLoading(true)
    setDiagnosticsError('')

    try {
      const nextData = await getPlatformStravaDiagnostics({ window: diagnosticsWindow })
      setDiagnosticsData(nextData)
    } catch (requestError) {
      setDiagnosticsError(getApiMessage(requestError, 'Khong tai duoc Strava diagnostics'))
      setDiagnosticsData(null)
    } finally {
      setDiagnosticsLoading(false)
    }
  }, [diagnosticsWindow])

  useEffect(() => {
    if (activeTab !== 'diagnostics') return undefined
    void loadDiagnostics()
    return undefined
  }, [activeTab, loadDiagnostics])

  async function reloadOverview() {
    await loadOverview()
  }

  async function reloadConnections() {
    await loadConnections()
  }

  async function reloadWebhookEvents() {
    await loadWebhookEvents()
  }

  async function reloadSyncJobs() {
    await loadSyncJobs()
  }

  async function reloadSubscription() {
    await loadSubscription()
  }

  async function reloadDiagnostics() {
    await loadDiagnostics()
  }

  function setTab(nextTab) {
    setActiveTab(nextTab)
    const nextParams = new URLSearchParams(searchParams)
    if (nextTab === 'overview') nextParams.delete('tab')
    else nextParams.set('tab', nextTab)
    if (nextTab !== 'diagnostics') nextParams.delete('window')
    setSearchParams(nextParams, { replace: true })
  }

  function handleDiagnosticsWindowChange(nextWindow) {
    const resolvedWindow = readDiagnosticsWindow(nextWindow)
    setDiagnosticsWindow(resolvedWindow)
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', 'diagnostics')
    nextParams.set('window', resolvedWindow)
    setSearchParams(nextParams, { replace: true })
  }

  function applySearch() {
    setPage(1)
    setKeyword(String(searchDraft || '').trim())
  }

  function applyWebhookSearch() {
    setWebhookPage(1)
    setWebhookKeyword(String(webhookSearchDraft || '').trim())
    setWebhookTenantId(toPositiveText(webhookTenantIdDraft))
    setWebhookConnectionId(toPositiveText(webhookConnectionIdDraft))
  }

  function applySyncJobSearch() {
    setSyncJobPage(1)
    setSyncJobKeyword(String(syncJobSearchDraft || '').trim())
    setSyncJobTenantId(toPositiveText(syncJobTenantIdDraft))
    setSyncJobConnectionId(toPositiveText(syncJobConnectionIdDraft))
  }

  function handleOpenDetail(row) {
    setSelectedConnection(row || null)
    setDetailVisible(true)
  }

  function handleOpenWebhookEventDetail(row) {
    if (!row?.eventId) return
    navigate(`/platform/integrations/strava/webhook-events/${row.eventId}`)
  }

  function handleOpenSyncJobDetail(row) {
    if (!row?.jobId) return
    navigate(`/platform/integrations/strava/sync-jobs/${row.jobId}`)
  }

  function openSyncJobsForConnection(connectionId, tenantId) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('tab', 'sync-jobs')
    nextParams.set('connectionId', String(connectionId || ''))
    if (tenantId) nextParams.set('tenantId', String(tenantId))
    setSyncJobConnectionIdDraft(String(connectionId || ''))
    setSyncJobConnectionId(String(connectionId || ''))
    if (tenantId) {
      setSyncJobTenantIdDraft(String(tenantId))
      setSyncJobTenantId(String(tenantId))
    }
    setActiveTab('sync-jobs')
    setSearchParams(nextParams, { replace: true })
    setDetailVisible(false)
  }

  function handleRefresh() {
    if (activeTab === 'connections') {
      void reloadConnections()
      return
    }
    if (activeTab === 'webhook-events') {
      void reloadWebhookEvents()
      return
    }
    if (activeTab === 'sync-jobs') {
      void reloadSyncJobs()
      return
    }
    if (activeTab === 'subscription') {
      void reloadSubscription()
      return
    }
    if (activeTab === 'diagnostics') {
      void reloadDiagnostics()
      return
    }
    void reloadOverview()
  }

  async function handleConfirmSubscriptionAction() {
    if (!confirmAction || subscriptionAction) return

    const action = confirmAction
    setConfirmAction('')
    setSubscriptionAction(action)
    setSubscriptionError('')
    setSubscriptionNotice(null)

    try {
      if (action === 'create') {
        const result = await createPlatformStravaSubscription()
        setSubscriptionData(result)
        setSubscriptionNotice({
          color: result?.existed ? 'info' : 'success',
          message: result?.existed ? 'Subscription da ton tai cho callback hien tai.' : 'Tao Strava subscription thanh cong.',
        })
      }

      if (action === 'delete') {
        const result = await deletePlatformStravaSubscription()
        setSubscriptionData(result)
        setSubscriptionNotice({
          color: result?.deleted ? 'success' : 'info',
          message: result?.deleted ? 'Da xoa Strava subscription hien tai.' : 'Khong co subscription de xoa.',
        })
      }
    } catch (requestError) {
      setSubscriptionError(getApiMessage(requestError, action === 'create' ? 'Khong tao duoc Strava subscription' : 'Khong xoa duoc Strava subscription'))
    } finally {
      setSubscriptionAction('')
    }
  }

  function renderConnectionsToolbar() {
    return (
      <CCard className="border-0 shadow-sm mb-4">
        <CCardBody>
          <CRow className="g-3 align-items-end">
            <CCol xs={12} lg={4}>
              <CFormLabel htmlFor="strava-connection-search">Search</CFormLabel>
              <CFormInput
                id="strava-connection-search"
                placeholder="Tenant, user, athlete..."
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    applySearch()
                  }
                }}
              />
            </CCol>
            <CCol xs={12} sm={6} lg={2}>
              <CFormLabel htmlFor="strava-connection-status">Status</CFormLabel>
              <CFormSelect
                id="strava-connection-status"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value)
                  setPage(1)
                }}
              >
                <option value="">All statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="DISCONNECTED">Disconnected</option>
                <option value="ERROR">Error</option>
              </CFormSelect>
            </CCol>
            <CCol xs={12} sm={6} lg={3}>
              <CFormLabel htmlFor="strava-connection-sort">Sort</CFormLabel>
              <CFormSelect
                id="strava-connection-sort"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value)
                  setPage(1)
                }}
              >
                <option value="connectedAt:desc">Connected: newest</option>
                <option value="connectedAt:asc">Connected: oldest</option>
                <option value="tenantName:asc">Tenant: A-Z</option>
                <option value="userName:asc">User: A-Z</option>
                <option value="athleteName:asc">Athlete: A-Z</option>
                <option value="status:asc">Status</option>
                <option value="lastSyncAt:desc">Last sync: newest</option>
                <option value="tokenExpiresAt:asc">Token expiry: soonest</option>
                <option value="activityCount:desc">Activities: high-low</option>
              </CFormSelect>
            </CCol>
            <CCol xs={12} sm={6} lg={1}>
              <CFormLabel htmlFor="strava-connection-page-size">Page size</CFormLabel>
              <CFormSelect
                id="strava-connection-page-size"
                value={String(pageSize)}
                onChange={(event) => {
                  setPage(1)
                  setPageSize(Number(event.target.value || 20))
                }}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </CFormSelect>
            </CCol>
            <CCol xs={12} sm={6} lg={2}>
              <div className="d-flex gap-2">
                <CButton color="primary" onClick={applySearch} disabled={connectionsLoading}>
                  Search
                </CButton>
                <CButton color="secondary" variant="outline" onClick={reloadConnections} disabled={connectionsLoading}>
                  Refresh
                </CButton>
              </div>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>
    )
  }

  function renderConnectionsTable() {
    return (
      <CCard className="border-0 shadow-sm d-none d-lg-block">
        <CCardHeader className="bg-white d-flex justify-content-between align-items-center">
          <strong>Connections</strong>
          <span className="text-body-secondary small">{fromToText}</span>
        </CCardHeader>
        <CCardBody>
          <CTable hover responsive align="middle">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Tenant</CTableHeaderCell>
                <CTableHeaderCell>User</CTableHeaderCell>
                <CTableHeaderCell>Athlete</CTableHeaderCell>
                <CTableHeaderCell>Status</CTableHeaderCell>
                <CTableHeaderCell>Connected</CTableHeaderCell>
                <CTableHeaderCell>Last Sync</CTableHeaderCell>
                <CTableHeaderCell>Token Expiry</CTableHeaderCell>
                <CTableHeaderCell>Activities</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {connections.map((row) => {
                const statusBadge = getConnectionStatusBadge(row.status)
                return (
                  <CTableRow key={row.connectionId}>
                    <CTableDataCell>
                      <div className="fw-semibold">{row.tenantName}</div>
                      <div className="small text-body-secondary">ID {row.tenantId}</div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="fw-semibold">{row.userName}</div>
                      <div className="small text-body-secondary">{formatUserMeta(row)}</div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="fw-semibold">{row.athleteName}</div>
                      <div className="small text-body-secondary">{formatAthleteMeta(row)}</div>
                    </CTableDataCell>
                    <CTableDataCell><CBadge color={statusBadge.color}>{statusBadge.label}</CBadge></CTableDataCell>
                    <CTableDataCell>{formatShortDateTime(row.connectedAt)}</CTableDataCell>
                    <CTableDataCell>{formatShortDateTime(row.lastSyncAt)}</CTableDataCell>
                    <CTableDataCell>{formatShortDateTime(row.tokenExpiresAt)}</CTableDataCell>
                    <CTableDataCell>{row.activityCount}</CTableDataCell>
                    <CTableDataCell className="text-end">
                      <CButton color="primary" variant="outline" size="sm" onClick={() => handleOpenDetail(row)}>
                        View Detail
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    )
  }

  function renderConnectionsCards() {
    return (
      <div className="d-lg-none d-flex flex-column gap-3">
        <div className="text-body-secondary small">{fromToText}</div>
        {connections.map((row) => {
          const statusBadge = getConnectionStatusBadge(row.status)
          return (
            <CCard key={row.connectionId} className="border-0 shadow-sm">
              <CCardBody>
                <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                  <div>
                    <div className="fw-semibold">{row.athleteName}</div>
                    <div className="small text-body-secondary">{row.tenantName}</div>
                  </div>
                  <CBadge color={statusBadge.color}>{statusBadge.label}</CBadge>
                </div>
                <div className="small text-body-secondary mb-1">User</div>
                <div className="mb-2">{row.userName}</div>
                <div className="small text-body-secondary mb-1">Connected</div>
                <div className="mb-2">{formatShortDateTime(row.connectedAt)}</div>
                <div className="small text-body-secondary mb-1">Last Sync</div>
                <div className="mb-2">{formatShortDateTime(row.lastSyncAt)}</div>
                <div className="small text-body-secondary mb-1">Token Expiry</div>
                <div className="mb-3">{formatShortDateTime(row.tokenExpiresAt)}</div>
                <div className="d-flex justify-content-between align-items-center">
                  <span className="small text-body-secondary">Activities: {row.activityCount}</span>
                  <CButton color="primary" variant="outline" size="sm" onClick={() => handleOpenDetail(row)}>
                    View Detail
                  </CButton>
                </div>
              </CCardBody>
            </CCard>
          )
        })}
      </div>
    )
  }

  function renderConnectionsContent() {
    return (
      <>
        {renderConnectionsToolbar()}

        {connectionStaleSyncOnly ? (
          <CAlert color="info" className="mb-4">
            Dang loc chi cac connection co stale sync tu Diagnostics shortcut.
          </CAlert>
        ) : null}

        {connectionsError ? (
          <CAlert color="danger" className="mb-4">{connectionsError}</CAlert>
        ) : null}

        {connectionsLoading ? (
          <div className="d-flex justify-content-center align-items-center py-5">
            <CSpinner className="me-2" />
            <span>Dang tai Strava connections...</span>
          </div>
        ) : null}

        {!connectionsLoading && !connectionsError && connections.length === 0 ? (
          <CCard className="border-0 shadow-sm">
            <CCardBody className="py-5 text-center text-body-secondary">
              Khong co Strava connection nao phu hop voi bo loc hien tai.
            </CCardBody>
          </CCard>
        ) : null}

        {!connectionsLoading && !connectionsError && connections.length > 0 ? (
          <>
            {renderConnectionsTable()}
            {renderConnectionsCards()}
            <div className="mt-4">
              <SimplePagination currentPage={page} pageCount={pageCount} disabled={connectionsLoading} onPageChange={setPage} />
            </div>
          </>
        ) : null}
      </>
    )
  }

  function renderWebhookEventsToolbar() {
    return (
      <CCard className="border-0 shadow-sm mb-4">
        <CCardBody>
          <CRow className="g-3 align-items-end mb-1">
            <CCol xs={12} lg={4}>
              <CFormLabel htmlFor="strava-webhook-search">Search</CFormLabel>
              <CFormInput
                id="strava-webhook-search"
                placeholder="Tenant, user, object, athlete..."
                value={webhookSearchDraft}
                onChange={(event) => setWebhookSearchDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    applyWebhookSearch()
                  }
                }}
              />
            </CCol>
            <CCol xs={12} sm={6} lg={2}>
              <CFormLabel htmlFor="strava-webhook-status">Status</CFormLabel>
              <CFormSelect
                id="strava-webhook-status"
                value={webhookStatusFilter}
                onChange={(event) => {
                  setWebhookStatusFilter(event.target.value)
                  setWebhookPage(1)
                }}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="processed">Processed</option>
                <option value="ignored">Ignored</option>
                <option value="failed">Failed</option>
                <option value="dead_letter">Dead Letter</option>
              </CFormSelect>
            </CCol>
            <CCol xs={12} sm={6} lg={2}>
              <CFormLabel htmlFor="strava-webhook-object-type">Object</CFormLabel>
              <CFormSelect
                id="strava-webhook-object-type"
                value={webhookObjectTypeFilter}
                onChange={(event) => {
                  setWebhookObjectTypeFilter(event.target.value)
                  setWebhookPage(1)
                }}
              >
                <option value="">All objects</option>
                <option value="activity">Activity</option>
                <option value="athlete">Athlete</option>
                <option value="unknown">Unknown</option>
              </CFormSelect>
            </CCol>
            <CCol xs={12} sm={6} lg={2}>
              <CFormLabel htmlFor="strava-webhook-aspect">Aspect</CFormLabel>
              <CFormSelect
                id="strava-webhook-aspect"
                value={webhookAspectTypeFilter}
                onChange={(event) => {
                  setWebhookAspectTypeFilter(event.target.value)
                  setWebhookPage(1)
                }}
              >
                <option value="">All aspects</option>
                <option value="create">Create</option>
                <option value="update">Update</option>
                <option value="delete">Delete</option>
                <option value="unknown">Unknown</option>
              </CFormSelect>
            </CCol>
            <CCol xs={12} sm={6} lg={2}>
              <CFormLabel htmlFor="strava-webhook-sort">Sort</CFormLabel>
              <CFormSelect
                id="strava-webhook-sort"
                value={webhookSort}
                onChange={(event) => {
                  setWebhookSort(event.target.value)
                  setWebhookPage(1)
                }}
              >
                <option value="eventTime:desc">Time: newest</option>
                <option value="eventTime:asc">Time: oldest</option>
                <option value="tenantName:asc">Tenant: A-Z</option>
                <option value="status:asc">Status</option>
                <option value="attempts:desc">Attempts: high-low</option>
                <option value="processedAt:desc">Processed: newest</option>
                <option value="claimedAt:desc">Claimed: newest</option>
              </CFormSelect>
            </CCol>
          </CRow>

          <CRow className="g-3 align-items-end">
            <CCol xs={12} sm={6} lg={2}>
              <CFormLabel htmlFor="strava-webhook-tenant-id">Tenant Id</CFormLabel>
              <CFormInput id="strava-webhook-tenant-id" placeholder="Optional" value={webhookTenantIdDraft} onChange={(event) => setWebhookTenantIdDraft(event.target.value)} />
            </CCol>
            <CCol xs={12} sm={6} lg={2}>
              <CFormLabel htmlFor="strava-webhook-connection-id">Connection Id</CFormLabel>
              <CFormInput id="strava-webhook-connection-id" placeholder="Optional" value={webhookConnectionIdDraft} onChange={(event) => setWebhookConnectionIdDraft(event.target.value)} />
            </CCol>
            <CCol xs={12} sm={6} lg={2}>
              <CFormLabel htmlFor="strava-webhook-date-from">Date From</CFormLabel>
              <CFormInput id="strava-webhook-date-from" type="date" value={webhookDateFrom} onChange={(event) => { setWebhookDateFrom(event.target.value); setWebhookPage(1) }} />
            </CCol>
            <CCol xs={12} sm={6} lg={2}>
              <CFormLabel htmlFor="strava-webhook-date-to">Date To</CFormLabel>
              <CFormInput id="strava-webhook-date-to" type="date" value={webhookDateTo} onChange={(event) => { setWebhookDateTo(event.target.value); setWebhookPage(1) }} />
            </CCol>
            <CCol xs={12} sm={6} lg={1}>
              <CFormLabel htmlFor="strava-webhook-page-size">Page size</CFormLabel>
              <CFormSelect id="strava-webhook-page-size" value={String(webhookPageSize)} onChange={(event) => { setWebhookPage(1); setWebhookPageSize(Number(event.target.value || 20)) }}>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </CFormSelect>
            </CCol>
            <CCol xs={12} sm={6} lg={3}>
              <div className="d-flex gap-2">
                <CButton color="primary" onClick={applyWebhookSearch} disabled={webhookEventsLoading}>Search</CButton>
                <CButton color="secondary" variant="outline" onClick={reloadWebhookEvents} disabled={webhookEventsLoading}>Refresh</CButton>
              </div>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>
    )
  }

  function renderWebhookEventsTable() {
    return (
      <CCard className="border-0 shadow-sm d-none d-lg-block">
        <CCardHeader className="bg-white d-flex justify-content-between align-items-center">
          <strong>Webhook Events</strong>
          <span className="text-body-secondary small">{webhookFromToText}</span>
        </CCardHeader>
        <CCardBody>
          <CTable hover responsive align="middle">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Time</CTableHeaderCell>
                <CTableHeaderCell>Tenant</CTableHeaderCell>
                <CTableHeaderCell>Object</CTableHeaderCell>
                <CTableHeaderCell>Aspect</CTableHeaderCell>
                <CTableHeaderCell>Status</CTableHeaderCell>
                <CTableHeaderCell>Attempts</CTableHeaderCell>
                <CTableHeaderCell>Processed</CTableHeaderCell>
                <CTableHeaderCell>Claimed By</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {webhookEvents.map((row) => {
                const statusBadge = getWebhookEventStatusBadge(row.status, row.lastError)
                return (
                  <CTableRow key={row.eventId} style={{ cursor: 'pointer' }} onClick={() => handleOpenWebhookEventDetail(row)}>
                    <CTableDataCell>
                      <div className="fw-semibold">{formatShortDateTime(row.eventTime)}</div>
                      <div className="small text-body-secondary">Event #{row.eventId}</div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="fw-semibold">{row?.tenant?.name || '-'}</div>
                      <div className="small text-body-secondary">{row?.user?.name || '-'}</div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="fw-semibold text-capitalize">{row.objectType || '-'}</div>
                      <div className="small text-body-secondary">{row.objectId || '-'}</div>
                    </CTableDataCell>
                    <CTableDataCell className="text-capitalize">{row.aspectType || '-'}</CTableDataCell>
                    <CTableDataCell><CBadge color={statusBadge.color}>{statusBadge.label}</CBadge></CTableDataCell>
                    <CTableDataCell>{row.attempts || 0}</CTableDataCell>
                    <CTableDataCell>{formatShortDateTime(row.processedAt)}</CTableDataCell>
                    <CTableDataCell>
                      <div>{row.claimedBy || '-'}</div>
                      {row.lastError ? <div className="small text-body-secondary">{formatErrorPreview(row.lastError)}</div> : null}
                    </CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    )
  }

  function renderWebhookEventCards() {
    return (
      <div className="d-lg-none d-flex flex-column gap-3">
        <div className="text-body-secondary small">{webhookFromToText}</div>
        {webhookEvents.map((row) => {
          const statusBadge = getWebhookEventStatusBadge(row.status, row.lastError)
          return (
            <CCard key={row.eventId} className="border-0 shadow-sm" style={{ cursor: 'pointer' }} onClick={() => handleOpenWebhookEventDetail(row)}>
              <CCardBody>
                <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                  <div>
                    <div className="fw-semibold">Event #{row.eventId}</div>
                    <div className="small text-body-secondary">{formatShortDateTime(row.eventTime)}</div>
                  </div>
                  <CBadge color={statusBadge.color}>{statusBadge.label}</CBadge>
                </div>
                <div className="small text-body-secondary mb-1">Tenant</div>
                <div className="mb-2">{row?.tenant?.name || '-'}</div>
                <div className="small text-body-secondary mb-1">Object</div>
                <div className="mb-2 text-capitalize">{row.objectType || '-'} {row.objectId ? `• ${row.objectId}` : ''}</div>
                <div className="small text-body-secondary mb-1">Aspect</div>
                <div className="mb-2 text-capitalize">{row.aspectType || '-'}</div>
                <div className="small text-body-secondary mb-1">Processed</div>
                <div className="mb-2">{formatShortDateTime(row.processedAt)}</div>
                <div className="d-flex justify-content-between align-items-center">
                  <span className="small text-body-secondary">Attempts: {row.attempts || 0}</span>
                  <span className="small text-body-secondary">Tap to open</span>
                </div>
              </CCardBody>
            </CCard>
          )
        })}
      </div>
    )
  }

  function renderWebhookEventsContent() {
    return (
      <>
        {renderWebhookEventsToolbar()}

        {webhookStaleOnly ? (
          <CAlert color="info" className="mb-4">
            Dang loc chi cac webhook event stale tu Diagnostics shortcut.
          </CAlert>
        ) : null}

        {webhookEventsError ? (
          <CAlert color="danger" className="mb-4">{webhookEventsError}</CAlert>
        ) : null}

        {webhookEventsLoading ? (
          <div className="d-flex justify-content-center align-items-center py-5">
            <CSpinner className="me-2" />
            <span>Dang tai Strava webhook events...</span>
          </div>
        ) : null}

        {!webhookEventsLoading && !webhookEventsError && webhookEvents.length === 0 ? (
          <CCard className="border-0 shadow-sm">
            <CCardBody className="py-5 text-center text-body-secondary">
              Khong co webhook event nao phu hop voi bo loc hien tai.
            </CCardBody>
          </CCard>
        ) : null}

        {!webhookEventsLoading && !webhookEventsError && webhookEvents.length > 0 ? (
          <>
            {renderWebhookEventsTable()}
            {renderWebhookEventCards()}
            <div className="mt-4">
              <SimplePagination currentPage={webhookPage} pageCount={webhookPageCount} disabled={webhookEventsLoading} onPageChange={setWebhookPage} />
            </div>
          </>
        ) : null}
      </>
    )
  }

  function renderSyncJobsToolbar() {
    return (
      <CCard className="border-0 shadow-sm mb-4">
        <CCardBody>
          <CRow className="g-3 align-items-end mb-1">
            <CCol xs={12} lg={4}>
              <CFormLabel htmlFor="strava-syncjob-search">Search</CFormLabel>
              <CFormInput
                id="strava-syncjob-search"
                placeholder="Tenant, user, athlete, job id..."
                value={syncJobSearchDraft}
                onChange={(event) => setSyncJobSearchDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    applySyncJobSearch()
                  }
                }}
              />
            </CCol>
            <CCol xs={12} sm={6} lg={2}>
              <CFormLabel htmlFor="strava-syncjob-status">Status</CFormLabel>
              <CFormSelect id="strava-syncjob-status" value={syncJobStatusFilter} onChange={(event) => { setSyncJobStatusFilter(event.target.value); setSyncJobPage(1) }}>
                <option value="">All statuses</option>
                <option value="queued">Queued</option>
                <option value="running">Running</option>
                <option value="partial_ready">Partial Ready</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </CFormSelect>
            </CCol>
            <CCol xs={12} sm={6} lg={2}>
              <CFormLabel htmlFor="strava-syncjob-mode">Sync Mode</CFormLabel>
              <CFormSelect id="strava-syncjob-mode" value={syncJobModeFilter} onChange={(event) => { setSyncJobModeFilter(event.target.value); setSyncJobPage(1) }}>
                <option value="">All modes</option>
                <option value="initial">Initial</option>
                <option value="incremental">Incremental</option>
                <option value="retry">Retry</option>
              </CFormSelect>
            </CCol>
            <CCol xs={12} sm={6} lg={2}>
              <CFormLabel htmlFor="strava-syncjob-sort">Sort</CFormLabel>
              <CFormSelect id="strava-syncjob-sort" value={syncJobSort} onChange={(event) => { setSyncJobSort(event.target.value); setSyncJobPage(1) }}>
                <option value="requestedAt:desc">Requested: newest</option>
                <option value="requestedAt:asc">Requested: oldest</option>
                <option value="tenantName:asc">Tenant: A-Z</option>
                <option value="status:asc">Status</option>
                <option value="syncMode:asc">Mode</option>
                <option value="startedAt:desc">Started: newest</option>
                <option value="finishedAt:desc">Finished: newest</option>
                <option value="claimedAt:desc">Claimed: newest</option>
                <option value="nextRetryAt:asc">Retry: soonest</option>
              </CFormSelect>
            </CCol>
            <CCol xs={12} sm={6} lg={2}>
              <CFormLabel htmlFor="strava-syncjob-page-size">Page size</CFormLabel>
              <CFormSelect id="strava-syncjob-page-size" value={String(syncJobPageSize)} onChange={(event) => { setSyncJobPage(1); setSyncJobPageSize(Number(event.target.value || 20)) }}>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </CFormSelect>
            </CCol>
          </CRow>

          <CRow className="g-3 align-items-end">
            <CCol xs={12} sm={6} lg={2}>
              <CFormLabel htmlFor="strava-syncjob-tenant-id">Tenant Id</CFormLabel>
              <CFormInput id="strava-syncjob-tenant-id" placeholder="Optional" value={syncJobTenantIdDraft} onChange={(event) => setSyncJobTenantIdDraft(event.target.value)} />
            </CCol>
            <CCol xs={12} sm={6} lg={2}>
              <CFormLabel htmlFor="strava-syncjob-connection-id">Connection Id</CFormLabel>
              <CFormInput id="strava-syncjob-connection-id" placeholder="Optional" value={syncJobConnectionIdDraft} onChange={(event) => setSyncJobConnectionIdDraft(event.target.value)} />
            </CCol>
            <CCol xs={12} sm={6} lg={2}>
              <CFormLabel htmlFor="strava-syncjob-date-from">Date From</CFormLabel>
              <CFormInput id="strava-syncjob-date-from" type="date" value={syncJobDateFrom} onChange={(event) => { setSyncJobDateFrom(event.target.value); setSyncJobPage(1) }} />
            </CCol>
            <CCol xs={12} sm={6} lg={2}>
              <CFormLabel htmlFor="strava-syncjob-date-to">Date To</CFormLabel>
              <CFormInput id="strava-syncjob-date-to" type="date" value={syncJobDateTo} onChange={(event) => { setSyncJobDateTo(event.target.value); setSyncJobPage(1) }} />
            </CCol>
            <CCol xs={12} sm={6} lg={4}>
              <div className="d-flex gap-2">
                <CButton color="primary" onClick={applySyncJobSearch} disabled={syncJobsLoading}>Search</CButton>
                <CButton color="secondary" variant="outline" onClick={reloadSyncJobs} disabled={syncJobsLoading}>Refresh</CButton>
              </div>
            </CCol>
          </CRow>
        </CCardBody>
      </CCard>
    )
  }

  function renderSyncJobsTable() {
    return (
      <CCard className="border-0 shadow-sm d-none d-lg-block">
        <CCardHeader className="bg-white d-flex justify-content-between align-items-center">
          <strong>Sync Jobs</strong>
          <span className="text-body-secondary small">{syncJobFromToText}</span>
        </CCardHeader>
        <CCardBody>
          <CTable hover responsive align="middle">
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Created/Requested</CTableHeaderCell>
                <CTableHeaderCell>Tenant</CTableHeaderCell>
                <CTableHeaderCell>User/Athlete</CTableHeaderCell>
                <CTableHeaderCell>Type</CTableHeaderCell>
                <CTableHeaderCell>Status</CTableHeaderCell>
                <CTableHeaderCell>Attempts</CTableHeaderCell>
                <CTableHeaderCell>Progress/Result</CTableHeaderCell>
                <CTableHeaderCell>Started</CTableHeaderCell>
                <CTableHeaderCell>Completed</CTableHeaderCell>
                <CTableHeaderCell>Claimed By</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {syncJobs.map((row) => {
                const statusBadge = getSyncJobStatusBadge(row.status)
                return (
                  <CTableRow key={row.jobId}>
                    <CTableDataCell>
                      <div className="fw-semibold">{formatShortDateTime(row.requestedAt)}</div>
                      <div className="small text-body-secondary">Job #{row.jobId}</div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="fw-semibold">{row?.tenant?.name || '-'}</div>
                      <div className="small text-body-secondary">{row?.tenant?.code || '-'}</div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="fw-semibold">{row?.user?.name || '-'}</div>
                      <div className="small text-body-secondary">{row?.connection?.athleteName || '-'}</div>
                    </CTableDataCell>
                    <CTableDataCell>
                      <div className="fw-semibold text-capitalize">{row.syncMode || '-'}</div>
                      <div className="small text-body-secondary">{row.phase || '-'}</div>
                    </CTableDataCell>
                    <CTableDataCell><CBadge color={statusBadge.color}>{statusBadge.label}</CBadge></CTableDataCell>
                    <CTableDataCell>{row.attempts || 0}</CTableDataCell>
                    <CTableDataCell>
                      <div>{formatSyncJobResult(row)}</div>
                      <div className="small text-body-secondary">{row.progressMessage || '-'}</div>
                    </CTableDataCell>
                    <CTableDataCell>{formatShortDateTime(row.startedAt)}</CTableDataCell>
                    <CTableDataCell>{formatShortDateTime(row.finishedAt)}</CTableDataCell>
                    <CTableDataCell>
                      <div>{row.claimedBy || '-'}</div>
                      {row.nextRetryAt ? <div className="small text-body-secondary">Retry {formatShortDateTime(row.nextRetryAt)}</div> : null}
                    </CTableDataCell>
                    <CTableDataCell className="text-end">
                      <div className="d-flex justify-content-end gap-2">
                        <CButton color="primary" variant="outline" size="sm" onClick={() => handleOpenSyncJobDetail(row)}>View Detail</CButton>
                        <CButton color="secondary" variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(String(row.jobId || ''))}>Copy Job ID</CButton>
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    )
  }

  function renderSyncJobCards() {
    return (
      <div className="d-lg-none d-flex flex-column gap-3">
        <div className="text-body-secondary small">{syncJobFromToText}</div>
        {syncJobs.map((row) => {
          const statusBadge = getSyncJobStatusBadge(row.status)
          return (
            <CCard key={row.jobId} className="border-0 shadow-sm" style={{ cursor: 'pointer' }} onClick={() => handleOpenSyncJobDetail(row)}>
              <CCardBody>
                <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                  <div>
                    <div className="fw-semibold">Job #{row.jobId}</div>
                    <div className="small text-body-secondary">{formatShortDateTime(row.requestedAt)}</div>
                  </div>
                  <CBadge color={statusBadge.color}>{statusBadge.label}</CBadge>
                </div>
                <div className="small text-body-secondary mb-1">Tenant</div>
                <div className="mb-2">{row?.tenant?.name || '-'}</div>
                <div className="small text-body-secondary mb-1">User / Athlete</div>
                <div className="mb-2">{row?.user?.name || '-'} / {row?.connection?.athleteName || '-'}</div>
                <div className="small text-body-secondary mb-1">Mode / Phase</div>
                <div className="mb-2 text-capitalize">{row.syncMode || '-'} / {row.phase || '-'}</div>
                <div className="small text-body-secondary mb-1">Result</div>
                <div className="mb-2">{formatSyncJobResult(row)}</div>
                <div className="d-flex justify-content-between align-items-center">
                  <span className="small text-body-secondary">Attempts: {row.attempts || 0}</span>
                  <span className="small text-body-secondary">Tap to open</span>
                </div>
              </CCardBody>
            </CCard>
          )
        })}
      </div>
    )
  }

  function renderSyncJobsContent() {
    return (
      <>
        {renderSyncJobsToolbar()}

        {syncJobStaleOnly ? (
          <CAlert color="info" className="mb-4">
            Dang loc chi cac sync job stale tu Diagnostics shortcut.
          </CAlert>
        ) : null}

        {syncJobsError ? (
          <CAlert color="danger" className="mb-4">{syncJobsError}</CAlert>
        ) : null}

        {syncJobsLoading ? (
          <div className="d-flex justify-content-center align-items-center py-5">
            <CSpinner className="me-2" />
            <span>Dang tai Strava sync jobs...</span>
          </div>
        ) : null}

        {!syncJobsLoading && !syncJobsError && syncJobs.length === 0 ? (
          <CCard className="border-0 shadow-sm">
            <CCardBody className="py-5 text-center text-body-secondary">
              Khong co Strava sync job nao phu hop voi bo loc hien tai.
            </CCardBody>
          </CCard>
        ) : null}

        {!syncJobsLoading && !syncJobsError && syncJobs.length > 0 ? (
          <>
            {renderSyncJobsTable()}
            {renderSyncJobCards()}
            <div className="mt-4">
              <SimplePagination currentPage={syncJobPage} pageCount={syncJobPageCount} disabled={syncJobsLoading} onPageChange={setSyncJobPage} />
            </div>
          </>
        ) : null}
      </>
    )
  }

  function renderSubscriptionContent() {
    const warningCount = Array.isArray(subscriptionData?.warnings) ? subscriptionData.warnings.length : 0
    const canCreate = subscriptionAction === ''
    const canDelete = subscriptionAction === '' && Boolean(subscriptionData?.subscriptionExists)

    return (
      <>
        <CCard className="border-0 shadow-sm mb-4">
          <CCardBody>
            <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
              <div>
                <div className="fw-semibold">Subscription Actions</div>
                <div className="text-body-secondary small">Dang ky hoac xoa Strava webhook subscription hien tai.</div>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <CButton color="primary" onClick={() => setConfirmAction('create')} disabled={!canCreate || subscriptionLoading}>
                  Create Subscription
                </CButton>
                <CButton color="danger" variant="outline" onClick={() => setConfirmAction('delete')} disabled={!canDelete || subscriptionLoading}>
                  Delete Subscription
                </CButton>
              </div>
            </div>
          </CCardBody>
        </CCard>

        {subscriptionNotice ? <CAlert color={subscriptionNotice.color} className="mb-4">{subscriptionNotice.message}</CAlert> : null}
        {subscriptionError ? <CAlert color="danger" className="mb-4">{subscriptionError}</CAlert> : null}

        {subscriptionLoading ? (
          <div className="d-flex justify-content-center align-items-center py-5">
            <CSpinner className="me-2" />
            <span>Dang tai Strava subscription...</span>
          </div>
        ) : null}

        {!subscriptionLoading && subscriptionData ? (
          <CRow className="g-4">
            <CCol xs={12} lg={6}>
              <OverviewCard title="Health Summary">
                <MetricRow label="Health" value={subscriptionData.healthy ? 'Healthy' : warningCount > 0 ? 'Warning' : 'Error'} right={<HealthBadge healthy={subscriptionData.healthy} warningCount={warningCount} />} />
                <MetricRow label="Subscription Exists" value={subscriptionData.subscriptionExists ? 'Yes' : 'No'} right={<YesNoBadge value={subscriptionData.subscriptionExists} />} />
                <MetricRow label="Subscription Count" value={subscriptionData.subscriptionCount} />
                <MetricRow label="Callback Matches" value={subscriptionData.callbackMatches ? 'Yes' : 'No'} right={<YesNoBadge value={subscriptionData.callbackMatches} />} />
                <MetricRow label="Client Configured" value={subscriptionData.clientConfigured ? 'Yes' : 'No'} right={<YesNoBadge value={subscriptionData.clientConfigured} />} />
                <MetricRow label="Verify Token Configured" value={subscriptionData.verifyTokenConfigured ? 'Yes' : 'No'} right={<YesNoBadge value={subscriptionData.verifyTokenConfigured} />} />
              </OverviewCard>
            </CCol>

            <CCol xs={12} lg={6}>
              <OverviewCard title="Current Subscription">
                {subscriptionData.subscription ? (
                  <>
                    <MetricRow label="Subscription ID" value={subscriptionData.subscription.id} />
                    <MetricRow label="Callback URL" value={subscriptionData.subscription.callbackUrl || '-'} />
                    <MetricRow label="Created At" value={formatDateTime(subscriptionData.subscription.createdAt)} />
                    <MetricRow label="Last Checked" value={formatDateTime(new Date().toISOString())} />
                  </>
                ) : (
                  <div className="text-body-secondary">
                    He thong chua co Strava subscription. Webhook moi se khong duoc nhan cho den khi tao subscription.
                  </div>
                )}
              </OverviewCard>
            </CCol>

            <CCol xs={12} lg={6}>
              <OverviewCard title="Warnings">
                {Array.isArray(subscriptionData.warnings) && subscriptionData.warnings.length > 0 ? (
                  <div className="d-flex flex-column gap-2">
                    {subscriptionData.warnings.map((warning) => (
                      <CAlert key={warning} color="warning" className="mb-0 py-2">{warning}</CAlert>
                    ))}
                  </div>
                ) : (
                  <div className="text-body-secondary">Khong co warning tu health service.</div>
                )}
              </OverviewCard>
            </CCol>

            <CCol xs={12} lg={6}>
              <OverviewCard title="Environment Status">
                <MetricRow label="Webhook Runner Enabled" value={subscriptionData.system?.webhookRunnerEnabled ? 'Yes' : 'No'} right={<YesNoBadge value={subscriptionData.system?.webhookRunnerEnabled === true} />} />
                <MetricRow label="Webhook Handler Enabled" value={subscriptionData.system?.webhookHandlerEnabled ? 'Yes' : 'No'} right={<YesNoBadge value={subscriptionData.system?.webhookHandlerEnabled === true} />} />
                <MetricRow label="Webhook Check On Boot" value={subscriptionData.system?.webhookCheckOnBoot ? 'Yes' : 'No'} right={<YesNoBadge value={subscriptionData.system?.webhookCheckOnBoot === true} />} />
                <MetricRow label="Callback URL Configured" value={subscriptionData.system?.callbackUrlConfigured ? 'Yes' : 'No'} right={<YesNoBadge value={subscriptionData.system?.callbackUrlConfigured === true} />} />
              </OverviewCard>
            </CCol>
          </CRow>
        ) : null}

        <CModal visible={Boolean(confirmAction)} onClose={() => setConfirmAction('')} alignment="center">
          <CModalHeader>
            <CModalTitle>{confirmAction === 'create' ? 'Create Subscription' : 'Delete Subscription'}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            {confirmAction === 'create'
              ? 'Thong tac nay se dang ky callback URL hien tai voi Strava. He thong khong tu dong xoa cac subscription bat thuong hien co.'
              : 'Thong tac nay se xoa subscription hien tai. Sau do he thong se khong nhan them webhook moi tu Strava cho den khi tao lai subscription.'}
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setConfirmAction('')} disabled={Boolean(subscriptionAction)}>Cancel</CButton>
            <CButton color={confirmAction === 'create' ? 'primary' : 'danger'} onClick={handleConfirmSubscriptionAction} disabled={Boolean(subscriptionAction)}>
              {subscriptionAction ? <CSpinner size="sm" className="me-2" /> : null}
              {confirmAction === 'create' ? 'Confirm Create' : 'Confirm Delete'}
            </CButton>
          </CModalFooter>
        </CModal>
      </>
    )
  }

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
        <div>
          <h2 className="mb-1">Strava Operations</h2>
          <p className="text-body-secondary mb-0">Quan tri Strava toan platform.</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <CButton color="primary" onClick={handleRefresh} disabled={anyTabLoading || Boolean(subscriptionAction)}>
            {(anyTabLoading || Boolean(subscriptionAction)) ? <CSpinner size="sm" className="me-2" /> : null}
            Refresh
          </CButton>
        </div>
      </div>

      <div className="d-flex gap-2 flex-wrap mb-4">
        <CButton color={activeTab === 'overview' ? 'primary' : 'secondary'} variant="outline" active={activeTab === 'overview'} onClick={() => setTab('overview')}>Tong quan</CButton>
        <CButton color={activeTab === 'connections' ? 'primary' : 'secondary'} variant="outline" active={activeTab === 'connections'} onClick={() => setTab('connections')}>Connections</CButton>
        <CButton color={activeTab === 'sync-jobs' ? 'primary' : 'secondary'} variant="outline" active={activeTab === 'sync-jobs'} onClick={() => setTab('sync-jobs')}>Sync Jobs</CButton>
        <CButton color={activeTab === 'webhook-events' ? 'primary' : 'secondary'} variant="outline" active={activeTab === 'webhook-events'} onClick={() => setTab('webhook-events')}>Webhook Events</CButton>
        <CButton color={activeTab === 'subscription' ? 'primary' : 'secondary'} variant="outline" active={activeTab === 'subscription'} onClick={() => setTab('subscription')}>Subscription</CButton>
        <CButton color={activeTab === 'diagnostics' ? 'primary' : 'secondary'} variant="outline" active={activeTab === 'diagnostics'} onClick={() => setTab('diagnostics')}>Diagnostics</CButton>
      </div>

      {activeTab === 'overview' && error ? (
        <CAlert color="danger" className="mb-4">{error}</CAlert>
      ) : null}

      {activeTab === 'overview' && loading && !data ? (
        <div className="d-flex justify-content-center align-items-center py-5">
          <CSpinner className="me-2" />
          <span>Dang tai Strava Operations...</span>
        </div>
      ) : null}

      {activeTab === 'overview' && !loading && data ? (
        <CRow className="g-4">
          <CCol xs={12} md={6} xl={4}>
            <OverviewCard title="Subscription">
              <MetricRow label="Status" value={data.subscription.healthy ? 'Healthy' : 'Warning'} right={<StatusBadge healthy={data.subscription.healthy} />} />
              <MetricRow label="Exists" value={data.subscription.exists ? 'Yes' : 'No'} />
              <MetricRow label="Callback URL" value={data.subscription.callbackUrl || '-'} />
              <MetricRow label="Warning Count" value={data.subscription.warningCount} />
            </OverviewCard>
          </CCol>

          <CCol xs={12} md={6} xl={4}>
            <OverviewCard title="Connections">
              <MetricRow label="Total" value={data.connections.total} />
              <MetricRow label="Active" value={data.connections.active} />
              <MetricRow label="Disconnected" value={data.connections.disconnected} />
              <MetricRow label="Error" value={data.connections.error} />
            </OverviewCard>
          </CCol>

          <CCol xs={12} md={6} xl={4}>
            <OverviewCard title="Sync Jobs">
              <MetricRow label="Pending" value={data.syncJobs.pending} />
              <MetricRow label="Running" value={data.syncJobs.running} />
              <MetricRow label="Completed" value={data.syncJobs.completed} />
              <MetricRow label="Failed" value={data.syncJobs.failed} />
              <MetricRow label="Cancelled" value={data.syncJobs.cancelled} />
            </OverviewCard>
          </CCol>

          <CCol xs={12} md={6} xl={6}>
            <OverviewCard title="Webhook Events">
              <MetricRow label="Pending" value={data.webhookEvents.pending} />
              <MetricRow label="Processing" value={data.webhookEvents.processing} />
              <MetricRow label="Processed" value={data.webhookEvents.processed} />
              <MetricRow label="Ignored" value={data.webhookEvents.ignored} />
              <MetricRow label="Failed" value={data.webhookEvents.failed} />
              <MetricRow label="Dead Letter" value={data.webhookEvents.deadLetter} />
            </OverviewCard>
          </CCol>

          <CCol xs={12} md={6} xl={6}>
            <OverviewCard title="System">
              <MetricRow label="Webhook Runner" value={data.system.webhookRunnerEnabled ? 'Enabled' : 'Disabled'} right={<EnabledBadge enabled={data.system.webhookRunnerEnabled} />} />
              <MetricRow label="Sync Runner" value={data.system.syncRunnerEnabled ? 'Enabled' : 'Disabled'} right={<EnabledBadge enabled={data.system.syncRunnerEnabled} />} />
              <MetricRow label="Webhook Handler" value={data.system.webhookHandlerEnabled ? 'Enabled' : 'Disabled'} right={<EnabledBadge enabled={data.system.webhookHandlerEnabled} />} />
            </OverviewCard>
          </CCol>
        </CRow>
      ) : null}

      {activeTab === 'connections' ? renderConnectionsContent() : null}
      {activeTab === 'sync-jobs' ? renderSyncJobsContent() : null}
      {activeTab === 'webhook-events' ? renderWebhookEventsContent() : null}
      {activeTab === 'subscription' ? renderSubscriptionContent() : null}
      {activeTab === 'diagnostics' ? (
        <StravaDiagnosticsTab
          data={diagnosticsData}
          loading={diagnosticsLoading}
          error={diagnosticsError}
          window={diagnosticsWindow}
          onWindowChange={handleDiagnosticsWindowChange}
          onRefresh={reloadDiagnostics}
        />
      ) : null}

      <COffcanvas placement="end" visible={detailVisible} onHide={() => setDetailVisible(false)}>
        <COffcanvasHeader>
          <COffcanvasTitle>Connection Detail</COffcanvasTitle>
        </COffcanvasHeader>
        <COffcanvasBody>
          {selectedConnection ? (
            <>
              <DrawerField label="Tenant" value={`${selectedConnection.tenantName} (ID ${selectedConnection.tenantId})`} />
              <DrawerField label="User" value={selectedConnection.userName} />
              <DrawerField label="User Email" value={selectedConnection.userEmail || '-'} muted />
              <DrawerField label="Athlete" value={`${selectedConnection.athleteName} (${selectedConnection.athleteId})`} />
              <DrawerField label="Status" value={getConnectionStatusBadge(selectedConnection.status).label} />
              <DrawerField label="Connected Time" value={formatDateTime(selectedConnection.connectedAt)} />
              <DrawerField label="Disconnected Time" value={formatDateTime(selectedConnection.disconnectedAt)} />
              <DrawerField label="Last Sync" value={formatDateTime(selectedConnection.lastSyncAt)} />
              <DrawerField label="Last Activity Sync" value={formatDateTime(selectedConnection.lastActivitySyncAt)} />
              <DrawerField label="Token Expiry" value={formatDateTime(selectedConnection.tokenExpiresAt)} />
              <DrawerField label="Subscription Id" value={selectedConnection.subscriptionId ? String(selectedConnection.subscriptionId) : '-'} />
              <DrawerField label="Activities" value={String(selectedConnection.activityCount || 0)} />
              <DrawerField label="Last Sync Error" value={formatErrorPreview(selectedConnection.lastSyncError)} muted />
              {selectedConnection?.connectionId ? (
                <div className="pt-3">
                  <CButton color="secondary" variant="outline" onClick={() => openSyncJobsForConnection(selectedConnection.connectionId, selectedConnection.tenantId)}>
                    View Sync Jobs
                  </CButton>
                </div>
              ) : null}
            </>
          ) : null}
        </COffcanvasBody>
      </COffcanvas>
    </div>
  )
}