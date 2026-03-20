const DEFAULT_EMPTY_ARRAY = []

const FEATURE_PATH_OVERRIDES = {
  'dashboard.view': '/',
  'department.manage': '/departments',
  'position.manage': '/positions',
}

function toNumberOrDefault(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function compareByOrderThenName(a, b) {
  const orderDiff = toNumberOrDefault(a?.order) - toNumberOrDefault(b?.order)
  if (orderDiff !== 0) return orderDiff

  const nameA = toText(a?.name).toLowerCase()
  const nameB = toText(b?.name).toLowerCase()
  return nameA.localeCompare(nameB)
}

function hasOwn(obj, key) {
  return Boolean(obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key))
}

function hasMenuVisibilityMetadata(feature) {
  if (!feature || typeof feature !== 'object') return false

  if (hasOwn(feature, 'showInMenu')) return true
  if (hasOwn(feature, 'hidden')) return true
  if (hasOwn(feature, 'menu')) return true
  if (hasOwn(feature, 'nav')) return true

  return false
}

function resolveExplicitMenuVisibility(feature) {
  if (!feature || typeof feature !== 'object') return null

  if (hasOwn(feature, 'showInMenu')) {
    return feature.showInMenu !== false
  }

  if (feature.hidden === true) return false
  if (feature.menu === false) return false
  if (feature.nav === false) return false

  if (feature.menu && typeof feature.menu === 'object' && hasOwn(feature.menu, 'show')) {
    return feature.menu.show !== false
  }

  return null
}

function isMenuVisibleFeature(feature) {
  if (!feature || typeof feature !== 'object') return false

  const explicit = resolveExplicitMenuVisibility(feature)
  if (explicit === false) return false
  if (explicit === true) return true

  const key = toText(feature?.key).toLowerCase()
  if (/\.(create|update|delete)$/.test(key)) {
    return false
  }

  return true
}

function dedupeItemsByPath(items) {
  const seen = new Set()

  return items.filter((item) => {
    const path = toText(item?.path)
    if (!path) return false

    if (seen.has(path)) return false
    seen.add(path)
    return true
  })
}

function normalizePath(value) {
  const raw = toText(value)
  if (!raw) return null

  if (raw === '/') return '/'
  return raw.startsWith('/') ? raw : `/${raw}`
}

export function featureKeyToPath(featureKey, overrides = FEATURE_PATH_OVERRIDES, fallbackPath = null) {
  const key = toText(featureKey)
  if (!key) return null

  // feature.path is the source of truth for menu route.
  const normalizedFallback = normalizePath(fallbackPath)
  if (normalizedFallback) return normalizedFallback

  if (overrides && overrides[key]) {
    return normalizePath(overrides[key])
  }

  const [resource = ''] = key.split('.')
  const normalizedResource = toText(resource)
  if (!normalizedResource) return null

  return `/${normalizedResource}`
}

export function normalizeItem(feature, options = {}) {
  const key = toText(feature?.key)
  if (!key) return null

  const path = featureKeyToPath(key, options.pathOverrides, feature?.path)
  if (!path) return null

  return {
    type: 'item',
    name: toText(feature?.name) || key,
    key,
    path,
    order: toNumberOrDefault(feature?.order),
    description: toText(feature?.description) || null,
  }
}

export function normalizeGroup(group, options = {}) {
  const rawFeatures = Array.isArray(group?.features) ? group.features : DEFAULT_EMPTY_ARRAY
  const useStrictMenuVisibility = rawFeatures.some((feature) => hasMenuVisibilityMetadata(feature))

  const items = dedupeItemsByPath(
    rawFeatures
      .filter((feature) => {
        const explicit = resolveExplicitMenuVisibility(feature)

        if (useStrictMenuVisibility) {
          return explicit === true
        }

        return isMenuVisibleFeature(feature)
      })
    .slice()
    .sort(compareByOrderThenName)
    .map((feature) => normalizeItem(feature, options))
    .filter(Boolean),
  )

  if (items.length === 0) return null

  return {
    type: 'group',
    name: toText(group?.name) || 'Unnamed Group',
    code: toText(group?.code) || null,
    icon: toText(group?.icon) || null,
    order: toNumberOrDefault(group?.order),
    items,
  }
}

export function buildNav(featureGroups, options = {}) {
  const groups = Array.isArray(featureGroups) ? featureGroups : DEFAULT_EMPTY_ARRAY

  return groups
    .slice()
    .sort(compareByOrderThenName)
    .map((group) => normalizeGroup(group, options))
    .filter(Boolean)
}

export function flatNavItems(featureGroups, options = {}) {
  const navGroups = buildNav(featureGroups, options)
  return navGroups.flatMap((group) => group.items)
}

/*
Example:
const featureGroups = [
  {
    id: 1,
    name: 'IAM',
    code: 'iam',
    icon: 'cilSettings',
    order: 1,
    features: [
      { id: 11, name: 'Dashboard', key: 'dashboard.view', order: 1 },
      { id: 12, name: 'User Management', key: 'user.list', order: 2 },
    ],
  },
]

buildNav(featureGroups) => [
  {
    type: 'group',
    name: 'IAM',
    code: 'iam',
    icon: 'cilSettings',
    items: [
      { type: 'item', name: 'Dashboard', key: 'dashboard.view', path: '/' },
      { type: 'item', name: 'User Management', key: 'user.list', path: '/users' },
    ],
  },
]
*/
