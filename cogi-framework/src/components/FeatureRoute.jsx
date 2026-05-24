import { Navigate } from 'react-router-dom'
import { useFeature } from '../contexts/FeatureContext'

export default function FeatureRoute({ featureKey, featureKeys, children }) {
  const feature = useFeature()
  const requiredKeys = Array.isArray(featureKeys)
    ? featureKeys.filter(Boolean)
    : (featureKey ? [featureKey] : [])

  if (feature?.isLoading) {
    return <div>Đang tải quyền truy cập...</div>
  }

  if (requiredKeys.length === 0) {
    return <>{children}</>
  }

  if (requiredKeys.some((key) => feature?.hasFeature?.(key))) {
    return <>{children}</>
  }

  return <Navigate to="/forbidden" replace />
}
