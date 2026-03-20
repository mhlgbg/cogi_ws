import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import api from '../api/axios'
import { useAuth } from './AuthContext'
import { useTenant } from './TenantContext'

const FeatureContext = createContext(null)
const FEATURE_CONTEXT_STORAGE_KEY = 'featureContext'

function readFeatureContextFromStorage(tenantCode) {
  if (!tenantCode) return null

  const raw = localStorage.getItem(FEATURE_CONTEXT_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    const storedTenantCode = String(parsed?.tenant?.code || '').trim().toLowerCase()
    if (storedTenantCode && storedTenantCode === tenantCode) {
      return parsed
    }
  } catch {
    return null
  }

  return null
}

export function useFeature() {
  return useContext(FeatureContext)
}

export default function FeatureProvider({ children }) {
  const auth = useAuth()
  const tenant = useTenant()

  const tenantCode = String(tenant?.currentTenant?.tenantCode || '').trim().toLowerCase()

  const [featureContext, setFeatureContext] = useState(() => readFeatureContextFromStorage(tenantCode))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const clearFeatureContext = useCallback(() => {
    localStorage.removeItem(FEATURE_CONTEXT_STORAGE_KEY)
    setFeatureContext(null)
    setError('')
  }, [])

  const loadFeatureContext = useCallback(async () => {
    if (!tenantCode) {
      clearFeatureContext()
      return null
    }

    const token = auth?.token || localStorage.getItem('authJwt')
    if (!token) {
      clearFeatureContext()
      return null
    }

    setIsLoading(true)
    setError('')

    try {
      const response = await api.get('/my-feature-context')

      const nextContext = response?.data || null
      setFeatureContext(nextContext)
      localStorage.setItem(FEATURE_CONTEXT_STORAGE_KEY, JSON.stringify(nextContext))
      return nextContext
    } catch (requestError) {
      const message = requestError?.response?.data?.error?.message
        || requestError?.response?.data?.message
        || 'Không thể tải feature context.'
      setError(message)
      setFeatureContext(null)
      localStorage.removeItem(FEATURE_CONTEXT_STORAGE_KEY)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [auth?.token, clearFeatureContext, tenantCode])

  useEffect(() => {
    if (!auth?.isAuthenticated || !tenantCode) {
      clearFeatureContext()
      return
    }

    const cached = readFeatureContextFromStorage(tenantCode)
    if (cached) {
      setFeatureContext(cached)
    }

    loadFeatureContext()
  }, [auth?.isAuthenticated, tenantCode, clearFeatureContext, loadFeatureContext])

  const features = useMemo(
    () => (Array.isArray(featureContext?.features) ? featureContext.features : []),
    [featureContext],
  )

  const featureGroups = useMemo(
    () => (Array.isArray(featureContext?.featureGroups) ? featureContext.featureGroups : []),
    [featureContext],
  )

  const roles = useMemo(
    () => (Array.isArray(featureContext?.roles) ? featureContext.roles : []),
    [featureContext],
  )

  const hasFeature = useCallback(
    (featureKey) => {
      if (!featureKey) return false
      const key = String(featureKey).trim().toLowerCase()
      if (!key) return false

      return features.some((item) => String(item?.key || '').trim().toLowerCase() === key)
    },
    [features],
  )

  const getFeature = useCallback(
    (featureKey) => {
      if (!featureKey) return null
      const key = String(featureKey).trim().toLowerCase()
      if (!key) return null

      return features.find((item) => String(item?.key || '').trim().toLowerCase() === key) || null
    },
    [features],
  )

  const value = useMemo(
    () => ({
      featureContext,
      featureGroups,
      features,
      roles,
      isLoading,
      error,
      loadFeatureContext,
      clearFeatureContext,
      hasFeature,
      getFeature,
    }),
    [
      featureContext,
      featureGroups,
      features,
      roles,
      isLoading,
      error,
      loadFeatureContext,
      clearFeatureContext,
      hasFeature,
      getFeature,
    ],
  )

  return <FeatureContext.Provider value={value}>{children}</FeatureContext.Provider>
}

export { FeatureContext }
