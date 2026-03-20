import { Navigate } from 'react-router-dom'
import { useFeature } from '../contexts/FeatureContext'

export default function FeatureRoute({ featureKey, children }) {
  const feature = useFeature()

  if (feature?.isLoading) {
    return <div>Đang tải quyền truy cập...</div>
  }

  if (!featureKey) {
    return <>{children}</>
  }

  if (feature?.hasFeature?.(featureKey)) {
    return <>{children}</>
  }

  return <Navigate to="/forbidden" replace />
}
