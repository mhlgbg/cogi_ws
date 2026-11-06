import axios from 'axios'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:1339/api'

function readStoredToken() {
  return localStorage.getItem('authJwt') || ''
}

const platformApi = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

platformApi.interceptors.request.use((config) => {
  const nextConfig = { ...config }
  nextConfig.headers = nextConfig.headers || {}

  const token = readStoredToken()
  if (token && !nextConfig.headers.Authorization) {
    nextConfig.headers.Authorization = `Bearer ${token}`
  }

  if (nextConfig.headers['x-tenant-code']) {
    delete nextConfig.headers['x-tenant-code']
  }

  return nextConfig
})

platformApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (import.meta.env.DEV) {
      const method = String(error?.config?.method || 'GET').toUpperCase()
      const baseURL = String(error?.config?.baseURL || '')
      const urlPath = String(error?.config?.url || '')
      const status = error?.response?.status
      const responseBody = error?.response?.data
      const requestPayload = error?.config?.data

      console.error('[PLATFORM API ERROR]', {
        method,
        url: `${baseURL}${urlPath}`,
        status,
        responseBody,
        requestPayload,
      })
    }

    return Promise.reject(error)
  },
)

export function getApiMessage(error, fallback) {
  const data = error?.response?.data
  const directMessage = data?.error?.message || data?.message || data?.error || data?.detail
  const message = typeof directMessage === 'string' && directMessage.trim() ? directMessage.trim() : error?.message
  if (typeof message === 'string' && message.trim()) return message.trim()
  return typeof fallback === 'string' && fallback.trim() ? fallback.trim() : 'Yeu cau khong thanh cong.'
}

export async function getPlatformTenants() {
  const response = await platformApi.get('/platform/tenants')
  return Array.isArray(response?.data?.data) ? response.data.data : []
}

export async function createPlatformTenant(payload) {
  const response = await platformApi.post('/platform/tenants', payload)
  return response?.data?.data || null
}

export async function updatePlatformTenant(id, payload) {
  const response = await platformApi.put(`/platform/tenants/${id}`, payload)
  return response?.data?.data || null
}

export async function uploadPlatformTenantLogo(file) {
  const formData = new FormData()
  formData.append('files', file)

  const response = await platformApi.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  const rows = Array.isArray(response?.data) ? response.data : []
  return rows[0] || null
}

export async function getPlatformFeatures({ groupId, groupCode } = {}) {
  const response = await platformApi.get('/platform/features', {
    params: {
      ...(groupId ? { groupId } : {}),
      ...(groupCode ? { groupCode } : {}),
    },
  })

  return response?.data?.data || {
    featureGroups: [],
    features: [],
    filters: {
      groupId: null,
      groupCode: null,
    },
  }
}

export async function createPlatformFeature(payload) {
  const response = await platformApi.post('/platform/features', payload)
  return response?.data?.data || null
}

export async function updatePlatformFeature(featureId, payload) {
  const response = await platformApi.put(`/platform/features/${featureId}`, payload)
  return response?.data?.data || null
}

export async function getPlatformSettings() {
  const response = await platformApi.get('/platform/settings')
  return response?.data?.data || {
    settings: [],
    groups: [],
  }
}

export async function getPlatformStravaDashboardOverview() {
  const response = await platformApi.get('/platform/strava/dashboard/overview')
  return response?.data?.data || {
    subscription: {
      exists: false,
      healthy: false,
      callbackUrl: null,
      warningCount: 0,
    },
    connections: {
      total: 0,
      active: 0,
      disconnected: 0,
      error: 0,
    },
    syncJobs: {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    },
    webhookEvents: {
      pending: 0,
      processing: 0,
      processed: 0,
      ignored: 0,
      failed: 0,
      deadLetter: 0,
    },
    system: {
      webhookRunnerEnabled: false,
      syncRunnerEnabled: false,
      webhookHandlerEnabled: false,
    },
  }
}

export async function getPlatformStravaConnections(params = {}) {
  const response = await platformApi.get('/platform/strava/connections', {
    params: {
      ...(params?.keyword ? { keyword: params.keyword } : {}),
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params?.staleSync ? { staleSync: 1 } : {}),
      ...(params?.page ? { page: params.page } : {}),
      ...(params?.pageSize ? { pageSize: params.pageSize } : {}),
      ...(params?.sort ? { sort: params.sort } : {}),
    },
  })

  return {
    data: Array.isArray(response?.data?.data) ? response.data.data : [],
    meta: response?.data?.meta || {
      pagination: {
        page: 1,
        pageSize: 20,
        pageCount: 1,
        total: 0,
      },
      filters: {
        keyword: '',
        status: null,
        tenantId: null,
        staleSync: false,
      },
      sort: {
        field: 'connectedAt',
        direction: 'desc',
      },
    },
  }
}

export async function getPlatformStravaWebhookEvents(params = {}) {
  const response = await platformApi.get('/platform/strava/webhook-events', {
    params: {
      ...(params?.keyword ? { keyword: params.keyword } : {}),
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.objectType ? { objectType: params.objectType } : {}),
      ...(params?.aspectType ? { aspectType: params.aspectType } : {}),
      ...(params?.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params?.connectionId ? { connectionId: params.connectionId } : {}),
      ...(params?.stale ? { stale: 1 } : {}),
      ...(params?.dateFrom ? { dateFrom: params.dateFrom } : {}),
      ...(params?.dateTo ? { dateTo: params.dateTo } : {}),
      ...(params?.page ? { page: params.page } : {}),
      ...(params?.pageSize ? { pageSize: params.pageSize } : {}),
      ...(params?.sort ? { sort: params.sort } : {}),
    },
  })

  return {
    data: Array.isArray(response?.data?.data) ? response.data.data : [],
    meta: response?.data?.meta || {
      pagination: {
        page: 1,
        pageSize: 20,
        pageCount: 1,
        total: 0,
      },
      filters: {
        keyword: '',
        status: null,
        objectType: null,
        aspectType: null,
        tenantId: null,
        connectionId: null,
        stale: false,
        dateFrom: null,
        dateTo: null,
      },
      sort: {
        field: 'eventTime',
        direction: 'desc',
      },
    },
  }
}

export async function getPlatformStravaWebhookEventDetail(eventId) {
  const response = await platformApi.get(`/platform/strava/webhook-events/${eventId}`)
  return response?.data?.data || null
}

export async function getPlatformStravaSyncJobs(params = {}) {
  const response = await platformApi.get('/platform/strava/sync-jobs', {
    params: {
      ...(params?.keyword ? { keyword: params.keyword } : {}),
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.tenantId ? { tenantId: params.tenantId } : {}),
      ...(params?.connectionId ? { connectionId: params.connectionId } : {}),
      ...(params?.userId ? { userId: params.userId } : {}),
      ...(params?.syncMode ? { syncMode: params.syncMode } : {}),
      ...(params?.jobType ? { jobType: params.jobType } : {}),
      ...(params?.stale ? { stale: 1 } : {}),
      ...(params?.dateFrom ? { dateFrom: params.dateFrom } : {}),
      ...(params?.dateTo ? { dateTo: params.dateTo } : {}),
      ...(params?.page ? { page: params.page } : {}),
      ...(params?.pageSize ? { pageSize: params.pageSize } : {}),
      ...(params?.sort ? { sort: params.sort } : {}),
    },
  })

  return {
    data: Array.isArray(response?.data?.data) ? response.data.data : [],
    meta: response?.data?.meta || {
      pagination: {
        page: 1,
        pageSize: 20,
        pageCount: 1,
        total: 0,
      },
      filters: {
        keyword: '',
        status: null,
        tenantId: null,
        connectionId: null,
        userId: null,
        syncMode: null,
        stale: false,
        dateFrom: null,
        dateTo: null,
      },
      sort: {
        field: 'requestedAt',
        direction: 'desc',
      },
    },
  }
}

export async function getPlatformStravaSyncJobDetail(jobId) {
  const response = await platformApi.get(`/platform/strava/sync-jobs/${jobId}`)
  return response?.data?.data || null
}

export async function getPlatformStravaSubscriptionOverview() {
  const response = await platformApi.get('/platform/strava/subscription')
  return response?.data?.data || {
    healthy: false,
    subscriptionExists: false,
    subscriptionCount: 0,
    subscription: null,
    callbackMatches: false,
    verifyTokenConfigured: false,
    clientConfigured: false,
    warnings: [],
    system: {
      webhookRunnerEnabled: false,
      webhookHandlerEnabled: false,
      webhookCheckOnBoot: false,
      callbackUrlConfigured: false,
    },
  }
}

export async function getPlatformStravaDiagnostics(params = {}) {
  const response = await platformApi.get('/platform/strava/diagnostics', {
    params: {
      ...(params?.window ? { window: params.window } : {}),
      ...(params?.tenantId ? { tenantId: params.tenantId } : {}),
    },
  })

  return response?.data?.data || null
}

export async function createPlatformStravaSubscription() {
  const response = await platformApi.post('/platform/strava/subscription')
  return response?.data?.data || null
}

export async function deletePlatformStravaSubscription() {
  const response = await platformApi.delete('/platform/strava/subscription')
  return response?.data?.data || null
}

export async function updatePlatformSetting(key, payload) {
  const response = await platformApi.put(`/platform/settings/${encodeURIComponent(key)}`, payload)
  return response?.data?.data || null
}

export async function getPlatformFeatureRoles(featureId) {
  const response = await platformApi.get(`/platform/features/${featureId}/roles`)
  return response?.data?.data || {
    feature: null,
    activeRoles: [],
    inactiveRoles: [],
    unassignedRoles: [],
  }
}

export async function activatePlatformFeatureRole(featureId, roleId) {
  const response = await platformApi.post(`/platform/features/${featureId}/roles/${roleId}/activate`)
  return response?.data?.data || null
}

export async function deactivatePlatformFeatureRole(featureId, roleId) {
  const response = await platformApi.post(`/platform/features/${featureId}/roles/${roleId}/deactivate`)
  return response?.data?.data || null
}

export async function updatePlatformTenantStatus(id, status) {
  const response = await platformApi.patch(`/platform/tenants/${id}/status`, { status })
  return response?.data?.data || null
}

export async function getPlatformTenantFeatures(id) {
  const response = await platformApi.get(`/platform/tenants/${id}/features`)
  return response?.data?.data || {
    tenant: null,
    assigned: [],
    available: [],
  }
}

export async function updatePlatformTenantFeature(tenantId, featureId, isEnabled) {
  const response = await platformApi.patch(`/platform/tenants/${tenantId}/features/${featureId}`, {
    isEnabled,
  })
  return response?.data?.data || null
}

export async function getPlatformGameTypes() {
  const response = await platformApi.get('/platform/game-types')
  return Array.isArray(response?.data?.data) ? response.data.data : []
}

export async function getStructuredTrees(params = {}) {
  const response = await platformApi.get('/platform/structured-tree', {
    params: {
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.limit ? { limit: params.limit } : {}),
      ...(params?.offset ? { offset: params.offset } : {}),
    },
  })

  return response?.data || { data: [], pagination: { total: 0, limit: 25, offset: 0 } }
}

export async function getStructuredTreeById(treeId) {
  const response = await platformApi.get(`/platform/structured-tree/${treeId}`)
  return response?.data || null
}

export async function createStructuredTree(payload) {
  const response = await platformApi.post('/platform/structured-tree', payload)
  return response?.data?.data || null
}

export async function updateStructuredTree(treeId, payload) {
  const response = await platformApi.put(`/platform/structured-tree/${treeId}`, payload)
  return response?.data?.data || null
}

export async function deleteStructuredTree(treeId) {
  const response = await platformApi.delete(`/platform/structured-tree/${treeId}`)
  return response?.data?.data || null
}

export async function getStructuredNodeTypes(params = {}) {
  const response = await platformApi.get('/platform/structured-node-type', {
    params: {
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.limit ? { limit: params.limit } : {}),
      ...(params?.offset ? { offset: params.offset } : {}),
    },
  })

  return response?.data || { data: [], pagination: { total: 0, limit: 25, offset: 0 } }
}

export async function getStructuredNodeTypeById(id) {
  const response = await platformApi.get(`/platform/structured-node-type/${id}`)
  return response?.data || null
}

export async function createStructuredNodeType(payload) {
  const response = await platformApi.post('/platform/structured-node-type', payload)
  return response?.data?.data || null
}

export async function updateStructuredNodeType(id, payload) {
  const response = await platformApi.put(`/platform/structured-node-type/${id}`, payload)
  return response?.data?.data || null
}

export async function deleteStructuredNodeType(id) {
  const response = await platformApi.delete(`/platform/structured-node-type/${id}`)
  return response?.data?.data || null
}

export async function getStructuredTreeNodes(treeId, params = {}) {
  const response = await platformApi.get(`/platform/structured-tree/${treeId}/nodes`, {
    params: {
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.limit ? { limit: params.limit } : {}),
      ...(params?.offset ? { offset: params.offset } : {}),
      ...(params?.nodeTypeId ? { nodeTypeId: params.nodeTypeId } : {}),
      ...(params?.parentId ? { parentId: params.parentId } : {}),
    },
  })

  return response?.data || { data: [], pagination: { total: 0, limit: 50, offset: 0 } }
}

export async function getStructuredTreeHierarchy(treeId) {
  const response = await platformApi.get(`/platform/structured-tree/${treeId}/tree-hierarchy`)
  const payload = response?.data || {}
  return {
    hierarchy: Array.isArray(payload?.hierarchy) ? payload.hierarchy : [],
    meta: payload?.meta || null,
    orphanNodes: Array.isArray(payload?.orphanNodes) ? payload.orphanNodes : [],
  }
}

export async function createStructuredNode(treeId, payload) {
  const response = await platformApi.post(`/platform/structured-tree/${treeId}/node`, payload)
  return response?.data?.data || null
}

export async function updateStructuredNode(treeId, nodeId, payload) {
  const response = await platformApi.put(`/platform/structured-tree/${treeId}/nodes/${nodeId}`, payload)
  return response?.data?.data || null
}

export async function deleteStructuredNode(treeId, nodeId) {
  const response = await platformApi.delete(`/platform/structured-tree/${treeId}/nodes/${nodeId}`)
  return response?.data?.data || null
}

export async function previewStructuredImport({ treeId, nodes }) {
  const response = await platformApi.post('/platform/structured-import/preview', {
    treeId,
    nodes,
  })
  return response?.data || {
    previewId: '',
    totalNodes: 0,
    summary: { new: 0, updated: 0, unchanged: 0, conflicts: 0, errors: [] },
    validationErrors: [],
  }
}

export async function confirmStructuredImport({ previewId, batchCode }) {
  const response = await platformApi.post('/platform/structured-import/confirm', {
    previewId,
    batchCode,
  })
  return response?.data || null
}

export async function getStructuredImportBatches(params = {}) {
  const response = await platformApi.get('/platform/structured-import/batches', {
    params: {
      ...(params?.limit ? { limit: params.limit } : {}),
      ...(params?.offset ? { offset: params.offset } : {}),
    },
  })
  return response?.data || { data: [], pagination: { total: 0, limit: 25, offset: 0 } }
}

export async function getPlatformCurriculumCatalog() {
  const response = await platformApi.get('/platform/curriculums/catalog')
  return response?.data?.data || {
    curricula: [],
    subjects: [],
    educationLevels: [],
    grades: [],
    versions: [],
    scopes: [],
    documents: [],
    sections: [],
    locations: [],
  }
}

export async function previewCurriculumSourceImport(formData) {
  const response = await platformApi.post('/platform/curriculum-source-import/preview', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  return response?.data?.data || {
    valid: false,
    errors: [],
    warnings: [],
    sections: [],
    sourceLocations: [],
    summary: {
      totalRecords: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      conflicts: 0,
      failed: 0,
    },
    previewToken: '',
  }
}

export async function confirmCurriculumSourceImport(previewToken) {
  const response = await platformApi.post('/platform/curriculum-source-import/confirm', { previewToken })
  return response?.data?.data || null
}

export async function getCurriculumImportBatches() {
  const response = await platformApi.get('/platform/curriculum-source-import/batches')
  return Array.isArray(response?.data?.data) ? response.data.data : []
}

export async function getPlatformCurriculumSubjects(params = {}) {
  const response = await platformApi.get('/platform/curriculums/subjects', {
    params: {
      ...(params?.page ? { page: params.page } : {}),
      ...(params?.pageSize ? { pageSize: params.pageSize } : {}),
    },
  })
  return response?.data?.data || { data: [], meta: { pagination: { page: 1, pageSize: 50, pageCount: 1, total: 0 } } }
}

export async function createPlatformCurriculumSubject(payload) {
  const response = await platformApi.post('/platform/curriculums/subjects', payload)
  return response?.data?.data || null
}

export async function updatePlatformCurriculumSubject(id, payload) {
  const response = await platformApi.put(`/platform/curriculums/subjects/${id}`, payload)
  return response?.data?.data || null
}

export async function deletePlatformCurriculumSubject(id) {
  const response = await platformApi.delete(`/platform/curriculums/subjects/${id}`)
  return response?.data?.data || null
}

export async function getPlatformCurriculumEducationLevels(params = {}) {
  const response = await platformApi.get('/platform/curriculums/education-levels', {
    params: {
      ...(params?.page ? { page: params.page } : {}),
      ...(params?.pageSize ? { pageSize: params.pageSize } : {}),
    },
  })
  return response?.data?.data || { data: [], meta: { pagination: { page: 1, pageSize: 50, pageCount: 1, total: 0 } } }
}

export async function createPlatformCurriculumEducationLevel(payload) {
  const response = await platformApi.post('/platform/curriculums/education-levels', payload)
  return response?.data?.data || null
}

export async function updatePlatformCurriculumEducationLevel(id, payload) {
  const response = await platformApi.put(`/platform/curriculums/education-levels/${id}`, payload)
  return response?.data?.data || null
}

export async function deletePlatformCurriculumEducationLevel(id) {
  const response = await platformApi.delete(`/platform/curriculums/education-levels/${id}`)
  return response?.data?.data || null
}

export async function getPlatformCurriculumGrades(params = {}) {
  const response = await platformApi.get('/platform/curriculums/grades', {
    params: {
      ...(params?.page ? { page: params.page } : {}),
      ...(params?.pageSize ? { pageSize: params.pageSize } : {}),
    },
  })
  return response?.data?.data || { data: [], meta: { pagination: { page: 1, pageSize: 50, pageCount: 1, total: 0 } } }
}

export async function createPlatformCurriculumGrade(payload) {
  const response = await platformApi.post('/platform/curriculums/grades', payload)
  return response?.data?.data || null
}

export async function updatePlatformCurriculumGrade(id, payload) {
  const response = await platformApi.put(`/platform/curriculums/grades/${id}`, payload)
  return response?.data?.data || null
}

export async function deletePlatformCurriculumGrade(id) {
  const response = await platformApi.delete(`/platform/curriculums/grades/${id}`)
  return response?.data?.data || null
}

export async function getPlatformCurricula(params = {}) {
  const response = await platformApi.get('/platform/curriculums', {
    params: {
      ...(params?.page ? { page: params.page } : {}),
      ...(params?.pageSize ? { pageSize: params.pageSize } : {}),
    },
  })
  return response?.data?.data || { data: [], meta: { pagination: { page: 1, pageSize: 50, pageCount: 1, total: 0 } } }
}

export async function createPlatformCurriculum(payload) {
  const response = await platformApi.post('/platform/curriculums', payload)
  return response?.data?.data || null
}

export async function updatePlatformCurriculum(id, payload) {
  const response = await platformApi.put(`/platform/curriculums/${id}`, payload)
  return response?.data?.data || null
}

export async function deletePlatformCurriculum(id) {
  const response = await platformApi.delete(`/platform/curriculums/${id}`)
  return response?.data?.data || null
}

export async function getPlatformCurriculumVersions(params = {}) {
  const response = await platformApi.get('/platform/curriculums/versions', {
    params: {
      ...(params?.page ? { page: params.page } : {}),
      ...(params?.pageSize ? { pageSize: params.pageSize } : {}),
    },
  })
  return response?.data?.data || { data: [], meta: { pagination: { page: 1, pageSize: 50, pageCount: 1, total: 0 } } }
}

export async function createPlatformCurriculumVersion(payload) {
  const response = await platformApi.post('/platform/curriculums/versions', payload)
  return response?.data?.data || null
}

export async function updatePlatformCurriculumVersion(id, payload) {
  const response = await platformApi.put(`/platform/curriculums/versions/${id}`, payload)
  return response?.data?.data || null
}

export async function deletePlatformCurriculumVersion(id) {
  const response = await platformApi.delete(`/platform/curriculums/versions/${id}`)
  return response?.data?.data || null
}

export async function getPlatformCurriculumScopes() {
  const response = await platformApi.get('/platform/curriculums/scopes')
  return response?.data?.data || { data: [], meta: { pagination: { page: 1, pageSize: 50, pageCount: 1, total: 0 } } }
}

export async function createPlatformCurriculumScope(payload) {
  const response = await platformApi.post('/platform/curriculums/scopes', payload)
  return response?.data?.data || null
}

export async function updatePlatformCurriculumScope(id, payload) {
  const response = await platformApi.put(`/platform/curriculums/scopes/${id}`, payload)
  return response?.data?.data || null
}

export async function deletePlatformCurriculumScope(id) {
  const response = await platformApi.delete(`/platform/curriculums/scopes/${id}`)
  return response?.data?.data || null
}

export async function getPlatformCurriculumDocuments(params = {}) {
  const response = await platformApi.get('/platform/curriculums/documents', {
    params: {
      ...(params?.page ? { page: params.page } : {}),
      ...(params?.pageSize ? { pageSize: params.pageSize } : {}),
    },
  })
  return response?.data?.data || { data: [], meta: { pagination: { page: 1, pageSize: 50, pageCount: 1, total: 0 } } }
}

export async function createPlatformCurriculumDocument(payload) {
  const response = await platformApi.post('/platform/curriculums/documents', payload)
  return response?.data?.data || null
}

export async function updatePlatformCurriculumDocument(id, payload) {
  const response = await platformApi.put(`/platform/curriculums/documents/${id}`, payload)
  return response?.data?.data || null
}

export async function deletePlatformCurriculumDocument(id) {
  const response = await platformApi.delete(`/platform/curriculums/documents/${id}`)
  return response?.data?.data || null
}

export async function getPlatformCurriculumSections(params = {}) {
  const response = await platformApi.get('/platform/curriculums/sections', {
    params: {
      ...(params?.page ? { page: params.page } : {}),
      ...(params?.pageSize ? { pageSize: params.pageSize } : {}),
    },
  })
  return response?.data?.data || { data: [], meta: { pagination: { page: 1, pageSize: 50, pageCount: 1, total: 0 } } }
}

export async function createPlatformCurriculumSection(payload) {
  const response = await platformApi.post('/platform/curriculums/sections', payload)
  return response?.data?.data || null
}

export async function updatePlatformCurriculumSection(id, payload) {
  const response = await platformApi.put(`/platform/curriculums/sections/${id}`, payload)
  return response?.data?.data || null
}

export async function deletePlatformCurriculumSection(id) {
  const response = await platformApi.delete(`/platform/curriculums/sections/${id}`)
  return response?.data?.data || null
}

export async function getPlatformCurriculumLocations(params = {}) {
  const response = await platformApi.get('/platform/curriculums/locations', {
    params: {
      ...(params?.page ? { page: params.page } : {}),
      ...(params?.pageSize ? { pageSize: params.pageSize } : {}),
    },
  })
  return response?.data?.data || { data: [], meta: { pagination: { page: 1, pageSize: 50, pageCount: 1, total: 0 } } }
}

export async function createPlatformCurriculumLocation(payload) {
  const response = await platformApi.post('/platform/curriculums/locations', payload)
  return response?.data?.data || null
}

export async function updatePlatformCurriculumLocation(id, payload) {
  const response = await platformApi.put(`/platform/curriculums/locations/${id}`, payload)
  return response?.data?.data || null
}

export async function deletePlatformCurriculumLocation(id) {
  const response = await platformApi.delete(`/platform/curriculums/locations/${id}`)
  return response?.data?.data || null
}

export async function getPlatformTenantGameTypes(tenantId) {
  const response = await platformApi.get(`/platform/tenants/${tenantId}/game-types`)
  return response?.data?.data || {
    tenant: null,
    gameTypes: [],
  }
}

export async function updatePlatformTenantGameTypeLicense(tenantId, gameTypeId, isLicensed) {
  const response = await platformApi.patch(`/platform/tenants/${tenantId}/game-types/${gameTypeId}/license`, {
    isLicensed,
  })
  return response?.data?.data || null
}

export async function getPlatformTenantRoles(id) {
  const response = await platformApi.get(`/platform/tenants/${id}/roles`)
  return response?.data?.data || {
    tenant: null,
    activeRoles: [],
    inactiveRoles: [],
    unassignedRoles: [],
  }
}

export async function getPlatformTenantAdmins(id) {
  const response = await platformApi.get(`/platform/tenants/${id}/tenant-admins`)
  return response?.data?.data || {
    tenant: null,
    tenantAdminRoleCode: '',
    tenantAdminRole: null,
    admins: [],
  }
}

export async function invitePlatformTenantAdmin(tenantId, identifier) {
  const response = await platformApi.post(`/platform/tenants/${tenantId}/tenant-admins/invite`, {
    identifier,
  })

  return response?.data || {
    ok: true,
    message: 'Da moi/gan user lam Tenant Admin thanh cong.',
    data: null,
  }
}

export async function inactivePlatformTenantAdmin(tenantId, assignmentId) {
  const response = await platformApi.post(`/platform/tenants/${tenantId}/tenant-admins/${assignmentId}/inactive`)
  return response?.data || {
    ok: true,
    message: 'Da inactive Tenant Admin thanh cong.',
    data: null,
  }
}

export async function activatePlatformTenantAdmin(tenantId, assignmentId) {
  const response = await platformApi.post(`/platform/tenants/${tenantId}/tenant-admins/${assignmentId}/activate`)
  return response?.data || {
    ok: true,
    message: 'Da kich hoat lai Tenant Admin thanh cong.',
    data: null,
  }
}

export async function activatePlatformTenantRole(tenantId, roleId) {
  const response = await platformApi.post(`/platform/tenants/${tenantId}/roles/${roleId}/activate`)
  return response?.data?.data || null
}

export async function deactivatePlatformTenantRole(tenantId, roleId) {
  const response = await platformApi.post(`/platform/tenants/${tenantId}/roles/${roleId}/deactivate`)
  return response?.data?.data || null
}

export async function getPlatformTenantStorageConfigs(tenantId) {
  const response = await platformApi.get(`/platform/tenants/${tenantId}/storage-configs`)
  return response?.data?.data || {
    tenant: null,
    storageConfigs: [],
  }
}

export async function createPlatformTenantStorageConfig(tenantId, payload) {
  const response = await platformApi.post(`/platform/tenants/${tenantId}/storage-configs`, payload)
  return response?.data?.data || {
    tenant: null,
    storageConfigs: [],
  }
}

export async function updatePlatformTenantStorageConfig(tenantId, storageConfigId, payload) {
  const response = await platformApi.put(`/platform/tenants/${tenantId}/storage-configs/${storageConfigId}`, payload)
  return response?.data?.data || {
    tenant: null,
    storageConfigs: [],
  }
}

export async function updatePlatformTenantDefaultStorageConfig(tenantId, storageDefaultConfigId) {
  const response = await platformApi.patch(`/platform/tenants/${tenantId}/storage-default-config`, {
    storageDefaultConfigId,
  })
  return response?.data?.data || {
    tenant: null,
    storageConfigs: [],
  }
}

export async function testPlatformTenantStorageConfigConnection(tenantId, storageConfigId) {
  const response = await platformApi.post(`/platform/tenants/${tenantId}/storage-configs/${storageConfigId}/test-connection`)
  return response?.data?.data || {
    provider: 's3',
    summary: 'FAIL',
    steps: {},
  }
}

export async function getPermissionDebug({ userId, tenantCode }) {
  const response = await platformApi.get('/platform/permission-debug', {
    params: {
      userId,
      tenantCode,
    },
  })

  return {
    roles: Array.isArray(response?.data?.roles) ? response.data.roles : [],
    features: Array.isArray(response?.data?.features) ? response.data.features : [],
  }
}

export default platformApi