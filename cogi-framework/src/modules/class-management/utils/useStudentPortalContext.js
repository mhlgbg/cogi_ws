import { useEffect, useMemo, useState } from 'react'
import { useTenant } from '../../../contexts/TenantContext'
import { getStudentContext } from '../services/classService'

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function getStorageKey(tenantCode) {
  return `studentPortalLearnerId:${String(tenantCode || '').trim().toLowerCase() || 'default'}`
}

function readStoredLearnerId(tenantCode) {
  if (typeof window === 'undefined') return ''
  return toText(window.localStorage.getItem(getStorageKey(tenantCode)))
}

function writeStoredLearnerId(tenantCode, learnerId) {
  if (typeof window === 'undefined') return
  const key = getStorageKey(tenantCode)
  const normalized = toText(learnerId)
  if (normalized) {
    window.localStorage.setItem(key, normalized)
    return
  }
  window.localStorage.removeItem(key)
}

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export default function useStudentPortalContext() {
  const tenant = useTenant()
  const tenantCode = tenant?.currentTenant?.tenantCode || ''
  const [selectedLearnerId, setSelectedLearnerId] = useState(() => readStoredLearnerId(tenantCode))
  const [context, setContext] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setSelectedLearnerId(readStoredLearnerId(tenantCode))
  }, [tenantCode])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const data = await getStudentContext({ learnerId: selectedLearnerId })
        if (!active) return
        setContext(data)
        const resolvedLearnerId = toText(data?.learnerContext?.id)
        if (resolvedLearnerId !== selectedLearnerId) {
          setSelectedLearnerId(resolvedLearnerId)
        }
        writeStoredLearnerId(tenantCode, resolvedLearnerId)
      } catch (requestError) {
        if (!active) return
        setContext(null)
        setError(getApiMessage(requestError, 'Không thể tải hồ sơ học tập.'))
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [selectedLearnerId, tenantCode])

  const selectedLearner = context?.learnerContext || null

  const value = useMemo(() => ({
    tenantCode,
    context,
    selectedLearnerId: toText(selectedLearner?.id || selectedLearnerId),
    selectedLearner,
    loading,
    error,
    setSelectedLearnerId: (learnerId) => {
      const nextValue = toText(learnerId)
      setSelectedLearnerId(nextValue)
      writeStoredLearnerId(tenantCode, nextValue)
    },
  }), [context, error, loading, selectedLearner, selectedLearnerId, tenantCode])

  return value
}