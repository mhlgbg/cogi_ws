const STORAGE_KEY = 'assessment-public-flow'

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

function safeParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function getFlowState() {
  if (!isBrowser()) return null
  const raw = window.sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  const parsed = safeParse(raw)
  return parsed && typeof parsed === 'object' ? parsed : null
}

export function setFlowState(nextValue) {
  if (!isBrowser()) return
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue || null))
}

export function patchFlowState(patch) {
  const current = getFlowState() || {}
  const nextValue = {
    ...current,
    ...(patch || {}),
  }
  setFlowState(nextValue)
  return nextValue
}

export function clearFlowState() {
  if (!isBrowser()) return
  window.sessionStorage.removeItem(STORAGE_KEY)
}

export function mergeFlowState(mutator) {
  const current = getFlowState() || {}
  const nextValue = typeof mutator === 'function' ? mutator(current) : current
  setFlowState(nextValue)
  return nextValue
}
