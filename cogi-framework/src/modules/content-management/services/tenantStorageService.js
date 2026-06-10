import api from '../../../api/axios'
import { buildProtectedFileUrl, resolveMediaUrl } from '../../../utils/mediaUrl'

function normalizePositiveId(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function normalizePagination(payload) {
  const pagination = payload?.pagination && typeof payload.pagination === 'object' ? payload.pagination : {}
  const page = Number(pagination.page || 1)
  const pageSize = Number(pagination.pageSize || 10)
  const total = Number(pagination.total || 0)
  const pageCount = Number(pagination.pageCount || (total > 0 ? Math.ceil(total / pageSize) : 1))

  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10,
    total: Number.isInteger(total) && total >= 0 ? total : 0,
    pageCount: Number.isInteger(pageCount) && pageCount > 0 ? pageCount : 1,
  }
}

function normalizeFileAsset(item) {
  if (!item || typeof item !== 'object') return null

  const rawUrl = String(item.url || '').trim()
  return {
    id: normalizePositiveId(item.id),
    code: String(item.code || '').trim(),
    moduleKey: String(item.moduleKey || '').trim(),
    entityType: String(item.entityType || '').trim(),
    entityId: String(item.entityId || '').trim(),
    originalName: String(item.originalName || '').trim(),
    fileName: String(item.fileName || '').trim(),
    extension: String(item.extension || '').trim(),
    mimeType: String(item.mimeType || '').trim(),
    size: Number(item.size || 0) || 0,
    provider: String(item.provider || 'local').trim().toLowerCase() || 'local',
    relativePath: String(item.relativePath || '').trim(),
    url: rawUrl,
    resolvedUrl: buildProtectedFileUrl({
      fileAssetId: item.id,
      storageProvider: item.provider,
      url: rawUrl,
    }) || resolveMediaUrl(rawUrl),
    downloadCount: Number(item.downloadCount || 0) || 0,
    lastAccessAt: item.lastAccessAt || null,
    status: String(item.status || '').trim().toUpperCase(),
    isPublic: item.isPublic !== false,
    isDeleted: Boolean(item.isDeleted),
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
    uploadedBy: item.uploadedBy || null,
  }
}

export function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export async function getTenantStorageSummary() {
  const response = await api.get('/tenant/storage/summary')
  const data = response?.data?.data || {}

  return {
    provider: String(data.provider || 'local').trim().toLowerCase() || 'local',
    quotaGB: Number(data.quotaGB || 0) || 0,
    usedBytes: Number(data.usedBytes || 0) || 0,
    usedGB: Number(data.usedGB || 0) || 0,
    percentUsed: Number(data.percentUsed || 0) || 0,
    fileCount: Number(data.fileCount || 0) || 0,
    activeFileCount: Number(data.activeFileCount || 0) || 0,
    deletedFileCount: Number(data.deletedFileCount || 0) || 0,
  }
}

export async function getTenantStorageFiles(params = {}) {
  const response = await api.get('/tenant/storage/files', {
    params,
  })

  const data = Array.isArray(response?.data?.data) ? response.data.data.map(normalizeFileAsset).filter(Boolean) : []
  return {
    data,
    pagination: normalizePagination(response?.data),
  }
}

export async function uploadTenantStorageFile(payload) {
  const formData = new FormData()
  formData.append('file', payload.file)
  formData.append('moduleKey', String(payload.moduleKey || '').trim())
  if (payload.entityType) formData.append('entityType', String(payload.entityType).trim())
  if (payload.entityId) formData.append('entityId', String(payload.entityId).trim())
  if (payload.isPublic !== undefined) formData.append('isPublic', payload.isPublic ? 'true' : 'false')

  const response = await api.post('/tenant/storage/upload', formData)
  return normalizeFileAsset(response?.data?.data)
}

export async function deleteTenantStorageFile(id) {
  const response = await api.delete(`/tenant/storage/files/${id}`)
  return normalizeFileAsset(response?.data?.data)
}

export async function restoreTenantStorageFile(id) {
  const response = await api.post(`/tenant/storage/files/${id}/restore`)
  return normalizeFileAsset(response?.data?.data)
}