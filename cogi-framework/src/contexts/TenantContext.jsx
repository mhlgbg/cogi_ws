import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'

const TenantContext = createContext(null)

function resolveApiOrigin() {
  const explicitBase = String(import.meta.env.VITE_API_BASE_URL || '').trim()
  if (explicitBase) {
    const normalized = explicitBase.replace(/\/+$/, '')
    return normalized.endsWith('/api') ? normalized.slice(0, -4) : normalized
  }

  return 'http://localhost:1339'
}

function toAbsoluteUrl(url) {
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  if (!raw.startsWith('/')) return raw
  return `${resolveApiOrigin()}${raw}`
}

function extractTenantLogoUrlFromMedia(logo) {
  if (!logo) return ''

  const direct = toAbsoluteUrl(logo?.url)
  if (direct) return direct

  const attrs = toAbsoluteUrl(logo?.attributes?.url)
  if (attrs) return attrs

  const dataDirect = toAbsoluteUrl(logo?.data?.url)
  if (dataDirect) return dataDirect

  const dataAttrs = toAbsoluteUrl(logo?.data?.attributes?.url)
  if (dataAttrs) return dataAttrs

  const firstArray = toAbsoluteUrl(Array.isArray(logo) ? logo[0]?.url : '')
  if (firstArray) return firstArray

  return ''
}

function readTenantFromStorage() {
  const tenantCode = localStorage.getItem('tenantCode')
  const tenantName = localStorage.getItem('tenantName')
  const tenantShortName = localStorage.getItem('tenantShortName')
  const tenantLogoUrl = localStorage.getItem('tenantLogoUrl')
  const tenantLogoRaw = localStorage.getItem('tenantLogo')
  const tenantIdRaw = localStorage.getItem('tenantId')
  const userTenantIdRaw = localStorage.getItem('userTenantId')
  const defaultFeatureCode = localStorage.getItem('defaultFeatureCode')
  const tenantRolesRaw = localStorage.getItem('tenantRoles')

  if (!tenantCode || !tenantName || !tenantIdRaw || !userTenantIdRaw) {
    return null
  }

  const tenantId = Number(tenantIdRaw)
  const userTenantId = Number(userTenantIdRaw)
  if (!Number.isFinite(tenantId) || !Number.isFinite(userTenantId)) {
    return null
  }

  let roles = []
  if (tenantRolesRaw) {
    try {
      const parsedRoles = JSON.parse(tenantRolesRaw)
      roles = Array.isArray(parsedRoles) ? parsedRoles : []
    } catch {
      roles = []
    }
  }

  let tenantLogo = null
  if (tenantLogoRaw) {
    try {
      tenantLogo = JSON.parse(tenantLogoRaw)
    } catch {
      tenantLogo = null
    }
  }

  const normalizedTenantLogoUrl = String(tenantLogoUrl || '').trim() || extractTenantLogoUrlFromMedia(tenantLogo)

  return {
    tenantCode,
    tenantName,
    tenantShortName: tenantShortName || '',
    tenantLogo: tenantLogo || null,
    tenantLogoUrl: normalizedTenantLogoUrl,
    tenantId,
    userTenantId,
    defaultFeatureCode: defaultFeatureCode || '',
    roles,
  }
}

export function useTenant() {
  return useContext(TenantContext)
}

export default function TenantContextProvider({ children }) {
  const auth = useAuth()
  const [currentTenant, setCurrentTenant] = useState(() => readTenantFromStorage())

  const selectTenant = (tenantContextItem) => {
    const nextTenant = {
      tenantCode: String(tenantContextItem?.tenantCode || '').trim(),
      tenantName: String(tenantContextItem?.tenantName || '').trim(),
      tenantShortName: String(tenantContextItem?.tenantShortName || '').trim(),
      tenantLogo: tenantContextItem?.tenantLogo || null,
      tenantLogoUrl: String(tenantContextItem?.tenantLogoUrl || '').trim() || extractTenantLogoUrlFromMedia(tenantContextItem?.tenantLogo),
      tenantId: Number(tenantContextItem?.tenantId),
      userTenantId: Number(tenantContextItem?.userTenantId),
      defaultFeatureCode: String(tenantContextItem?.defaultFeatureCode || '').trim(),
      roles: Array.isArray(tenantContextItem?.roles) ? tenantContextItem.roles : [],
    }

    if (
      !nextTenant.tenantCode
      || !nextTenant.tenantName
      || !Number.isFinite(nextTenant.tenantId)
      || !Number.isFinite(nextTenant.userTenantId)
    ) {
      return
    }

    localStorage.setItem('tenantCode', nextTenant.tenantCode)
    localStorage.setItem('tenantName', nextTenant.tenantName)
    localStorage.setItem('tenantShortName', nextTenant.tenantShortName)
    localStorage.setItem('tenantLogoUrl', nextTenant.tenantLogoUrl)
    localStorage.setItem('tenantLogo', JSON.stringify(nextTenant.tenantLogo || null))
    localStorage.setItem('tenantId', String(nextTenant.tenantId))
    localStorage.setItem('userTenantId', String(nextTenant.userTenantId))
    localStorage.setItem('defaultFeatureCode', nextTenant.defaultFeatureCode)
    localStorage.setItem('tenantRoles', JSON.stringify(nextTenant.roles))

    setCurrentTenant(nextTenant)
  }

  const clearTenant = () => {
    localStorage.removeItem('tenantCode')
    localStorage.removeItem('tenantName')
    localStorage.removeItem('tenantShortName')
    localStorage.removeItem('tenantLogoUrl')
    localStorage.removeItem('tenantLogo')
    localStorage.removeItem('tenantId')
    localStorage.removeItem('userTenantId')
    localStorage.removeItem('defaultFeatureCode')
    localStorage.removeItem('tenantRoles')
    localStorage.removeItem('featureContext')
    setCurrentTenant(null)
  }

  useEffect(() => {
    if (!auth?.isAuthenticated) {
      clearTenant()
    }
  }, [auth?.isAuthenticated])

  const value = useMemo(
    () => ({
      currentTenant,
      hasTenant: Boolean(currentTenant?.tenantCode),
      selectTenant,
      clearTenant,
    }),
    [currentTenant],
  )

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
}

export { TenantContext }