const GOOGLE_ANALYTICS_SCRIPT_ID = 'cogi-google-analytics-script'

function canUseDom() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function normalizeMeasurementId(measurementId) {
  return String(measurementId || '').trim()
}

function ensureDataLayer() {
  if (!Array.isArray(window.dataLayer)) {
    window.dataLayer = []
  }

  return window.dataLayer
}

function ensureGtag() {
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments)
    }
  }

  return window.gtag
}

function hasAnalyticsScript(measurementId) {
  const existingScript = document.getElementById(GOOGLE_ANALYTICS_SCRIPT_ID)

  if (existingScript) {
    return true
  }

  return Boolean(document.querySelector(`script[src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"]`))
}

export function injectGoogleAnalytics(measurementId) {
  const normalizedMeasurementId = normalizeMeasurementId(measurementId)

  if (!normalizedMeasurementId || !canUseDom()) {
    return false
  }

  try {
    ensureDataLayer()
    const gtag = ensureGtag()

    if (!hasAnalyticsScript(normalizedMeasurementId)) {
      const script = document.createElement('script')
      script.id = GOOGLE_ANALYTICS_SCRIPT_ID
      script.async = true
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(normalizedMeasurementId)}`
      script.onerror = () => {}
      document.head.appendChild(script)
    }

    gtag('js', new Date())
    gtag('config', normalizedMeasurementId)

    return true
  } catch (error) {
    return false
  }
}

export function removeGoogleAnalytics() {
  if (!canUseDom()) {
    return false
  }

  try {
    const existingScript = document.getElementById(GOOGLE_ANALYTICS_SCRIPT_ID)
    if (existingScript?.parentNode) {
      existingScript.parentNode.removeChild(existingScript)
    }

    if (typeof window.gtag === 'function') {
      delete window.gtag
    }

    if (Array.isArray(window.dataLayer)) {
      delete window.dataLayer
    }

    return true
  } catch (error) {
    return false
  }
}

export function trackGoogleAnalyticsPageView(measurementId, pagePath) {
  const normalizedMeasurementId = normalizeMeasurementId(measurementId)
  const normalizedPagePath = String(pagePath || '').trim()

  if (!normalizedMeasurementId || !normalizedPagePath || !canUseDom()) {
    return false
  }

  try {
    ensureDataLayer()
    const gtag = ensureGtag()

    gtag('config', normalizedMeasurementId, {
      page_path: normalizedPagePath,
    })

    return true
  } catch (error) {
    return false
  }
}
