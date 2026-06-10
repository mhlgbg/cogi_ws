import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { injectGoogleAnalytics, removeGoogleAnalytics, trackGoogleAnalyticsPageView } from '../utils/googleAnalytics'

const FRAMEWORK_GOOGLE_ANALYTICS_ID = 'G-X0HVK96KZQ'

export default function PublicAnalyticsBoundary() {
  const location = useLocation()
  const lastTrackedPathRef = useRef('')

  useEffect(() => {
    injectGoogleAnalytics(FRAMEWORK_GOOGLE_ANALYTICS_ID)

    return () => {
      removeGoogleAnalytics()
    }
  }, [])

  useEffect(() => {
    const nextPagePath = `${location.pathname}${location.search || ''}`

    if (!nextPagePath) {
      return
    }

    if (!lastTrackedPathRef.current) {
      lastTrackedPathRef.current = nextPagePath
      return
    }

    if (lastTrackedPathRef.current === nextPagePath) {
      return
    }

    lastTrackedPathRef.current = nextPagePath
    trackGoogleAnalyticsPageView(FRAMEWORK_GOOGLE_ANALYTICS_ID, nextPagePath)
  }, [location.pathname, location.search])

  return <Outlet />
}