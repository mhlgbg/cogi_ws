import api from '../../../api/axios'

function isDev() {
  return Boolean(import.meta.env.DEV)
}

function normalizeTenantConfigPayload(payload) {
  const rawRows = Array.isArray(payload?.data) ? payload.data : []
  const rows = rawRows.map((row) => {
    if (!row || typeof row !== 'object') return null
    if (row.attributes && typeof row.attributes === 'object') {
      return {
        id: row.id,
        ...row.attributes,
      }
    }

    return row
  }).filter(Boolean)

  return {
    data: rows,
    meta: payload?.meta || null,
  }
}

export async function getTenantConfigs({ page = 1, pageSize = 10, q = '' } = {}) {
  const params = {
    'pagination[page]': page,
    'pagination[pageSize]': pageSize,
    'sort[0]': 'key:asc',
  }

  const keyword = String(q || '').trim()
  if (keyword) {
    params['filters[$or][0][key][$containsi]'] = keyword
    params['filters[$or][1][description][$containsi]'] = keyword
  }

  const res = await api.get('/tenant-configs', { params })
  return normalizeTenantConfigPayload(res.data)
}

export async function getTenantConfigByKey(key, options = {}) {
  const normalizedKey = String(key || '').trim()
  if (!normalizedKey) return null

  const tenantCode = String(options?.tenantCode || '').trim()
  const requestConfig = tenantCode
    ? {
      headers: {
        'x-tenant-code': tenantCode,
      },
    }
    : undefined

  if (isDev()) {
    console.info('[tenantConfigService.getTenantConfigByKey] request', {
      key: normalizedKey,
      tenantCode,
      baseURL: api.defaults.baseURL,
      url: `/tenant-config/by-key/${encodeURIComponent(normalizedKey)}`,
      fullUrl: `${String(api.defaults.baseURL || '').replace(/\/+$/, '')}/tenant-config/by-key/${encodeURIComponent(normalizedKey)}`,
      requestConfig,
    })
  }

  const res = await api.get(`/tenant-config/by-key/${encodeURIComponent(normalizedKey)}`, requestConfig)
  const payload = res?.data

  if (isDev()) {
    console.info('[tenantConfigService.getTenantConfigByKey] response', {
      key: normalizedKey,
      tenantCode,
      status: res?.status,
      payload,
    })
  }

  if (!payload || typeof payload !== 'object') return null

  if (payload.data?.attributes && typeof payload.data.attributes === 'object') {
    return {
      id: payload.data.id,
      ...payload.data.attributes,
    }
  }

  if (payload.data && typeof payload.data === 'object') {
    return payload.data
  }

  return null
}

export async function createTenantConfig(payload) {
  const res = await api.post('/tenant-configs', { data: payload })
  return res.data
}

export async function updateTenantConfig(id, payload) {
  const res = await api.put(`/tenant-configs/${id}`, { data: payload })
  return res.data
}

export async function deleteTenantConfig(id) {
  const res = await api.delete(`/tenant-configs/${id}`)
  return res.data
}