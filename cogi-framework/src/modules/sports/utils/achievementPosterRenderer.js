function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatDateViShort(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('vi-VN')
}

function formatDateViLongUpper(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear())
  return `${day} THÁNG ${month}, ${year}`
}

function formatDurationSeconds(seconds) {
  const total = Number(seconds)
  if (!Number.isInteger(total) || total <= 0) return ''
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const remain = total % 60
  return [hours, minutes, remain].map((item) => String(item).padStart(2, '0')).join(':')
}

function formatDistanceShort(value) {
  const distance = Number(value)
  if (!Number.isFinite(distance) || distance <= 0) return ''
  if (Math.abs(distance - 42.195) < 0.01) return 'FM'
  if (Math.abs(distance - 21.0975) < 0.01) return 'HM'
  if (Math.abs(distance - 10) < 0.01) return '10K'
  if (Math.abs(distance - 5) < 0.01) return '5K'
  return `${distance}km`
}

function formatDistanceKm(value) {
  const distance = Number(value)
  if (!Number.isFinite(distance) || distance <= 0) return ''
  return `${distance.toFixed(3).replace(/\.?0+$/, '')} km`
}

function formatDistanceFull(value) {
  const distance = Number(value)
  if (!Number.isFinite(distance) || distance <= 0) return ''
  if (Math.abs(distance - 42.195) < 0.01) return 'Full Marathon'
  if (Math.abs(distance - 21.0975) < 0.01) return 'Half Marathon'
  if (Math.abs(distance - 10) < 0.01) return '10 Kilometers'
  if (Math.abs(distance - 5) < 0.01) return '5 Kilometers'
  return `${distance}km`
}

function resolveAchievementResult(achievement) {
  const duration = formatDurationSeconds(achievement?.durationSeconds)
  if (duration) return duration
  const resultText = toText(achievement?.resultText)
  if (resultText) return resultText
  const value = achievement?.resultValue === null || achievement?.resultValue === undefined || achievement?.resultValue === '' ? '' : String(achievement.resultValue)
  const unit = toText(achievement?.resultUnit)
  return [value, unit].filter(Boolean).join(' ')
}

function normalizeLayerType(value) {
  const normalized = toText(value).toLowerCase()
  if (normalized === 'data' || normalized === 'text' || normalized === 'image') return normalized
  return 'data'
}

function normalizeLayer(layer, index = 0) {
  const type = normalizeLayerType(layer?.type || layer?.kind)
  return {
    id: toText(layer?.id) || toText(layer?.key) || `layer-${index + 1}`,
    key: toText(layer?.key) || toText(layer?.field),
    type,
    field: toText(layer?.field) || toText(layer?.key),
    fields: Array.isArray(layer?.fields) ? layer.fields.map((item) => toText(item)).filter(Boolean) : [],
    content: toText(layer?.content),
    template: toText(layer?.template),
    visible: layer?.visible !== false,
    hideWhenEmpty: layer?.hideWhenEmpty !== false,
    x: toNumber(layer?.x, 0),
    y: toNumber(layer?.y, 0),
    width: toNumber(layer?.width, type === 'image' ? 0.12 : 0.7),
    height: toNumber(layer?.height, type === 'image' ? 0.12 : 0.1),
    fontFamily: toText(layer?.fontFamily),
    fontSize: toNumber(layer?.fontSize, 0.035),
    fontWeight: toText(layer?.fontWeight) || '400',
    color: toText(layer?.color) || '#ffffff',
    textAlign: toText(layer?.textAlign) || 'left',
    opacity: Math.max(0, Math.min(1, toNumber(layer?.opacity, 1))),
    zIndex: Number.isFinite(Number(layer?.zIndex)) ? Number(layer.zIndex) : index,
    format: layer?.format && typeof layer.format === 'object' ? { ...layer.format } : layer?.format,
    imageUrl: toText(layer?.imageUrl),
  }
}

function legacyFieldToLayer(field, index = 0) {
  const key = toText(field?.key) || `field-${index + 1}`
  return normalizeLayer({
    id: key,
    key,
    type: toText(field?.kind).toLowerCase() === 'image' || key === 'clubLogo' ? 'image' : 'data',
    field: key,
    visible: field?.visible !== false,
    x: toNumber(field?.x, 0),
    y: toNumber(field?.y, 0),
    width: toNumber(field?.width, 0.12),
    height: toNumber(field?.height, 0.12),
    fontFamily: toText(field?.fontFamily),
    fontSize: toNumber(field?.fontSize, 0.035),
    fontWeight: toText(field?.fontWeight) || '400',
    color: toText(field?.color) || '#ffffff',
    textAlign: toText(field?.textAlign) || 'left',
    opacity: Math.max(0, Math.min(1, toNumber(field?.opacity, 1))),
    zIndex: Number.isFinite(Number(field?.zIndex)) ? Number(field.zIndex) : index,
    hideWhenEmpty: field?.hideWhenEmpty !== false,
  }, index)
}

function defaultLayoutLayers(layoutKey) {
  const base = [
    { id: 'title', type: 'data', field: 'achievementTitle', x: 0.08, y: 0.12, width: 0.8, fontSize: 0.06, color: '#ffffff', fontWeight: '700', textAlign: 'left', zIndex: 1, hideWhenEmpty: true },
    { id: 'result', type: 'data', field: 'result', x: 0.08, y: 0.2, width: 0.5, fontSize: 0.08, color: '#ffe082', fontWeight: '700', textAlign: 'left', zIndex: 2, hideWhenEmpty: true },
    { id: 'distance', type: 'data', field: 'distance', x: 0.08, y: 0.28, width: 0.4, fontSize: 0.04, color: '#ffffff', fontWeight: '500', textAlign: 'left', zIndex: 3, hideWhenEmpty: true },
    { id: 'achieved-at', type: 'data', field: 'achievedAt', x: 0.08, y: 0.34, width: 0.5, fontSize: 0.033, color: '#ffffff', fontWeight: '500', textAlign: 'left', zIndex: 4, hideWhenEmpty: true },
    { id: 'athlete', type: 'data', field: 'athleteName', x: 0.08, y: 0.76, width: 0.7, fontSize: 0.045, color: '#ffffff', fontWeight: '700', textAlign: 'left', zIndex: 5, hideWhenEmpty: true },
    { id: 'runner-code', type: 'data', field: 'runnerCode', x: 0.08, y: 0.84, width: 0.5, fontSize: 0.033, color: '#ffffff', fontWeight: '500', textAlign: 'left', zIndex: 6, hideWhenEmpty: true },
    { id: 'club-name', type: 'data', field: 'clubName', x: 0.08, y: 0.9, width: 0.6, fontSize: 0.03, color: '#ffffff', fontWeight: '500', textAlign: 'left', zIndex: 7, hideWhenEmpty: true },
    { id: 'club-logo', type: 'image', field: 'clubLogo', x: 0.82, y: 0.84, width: 0.12, height: 0.12, zIndex: 8, hideWhenEmpty: true },
  ]
  if (layoutKey === 'personal_best') {
    return base.map((item) => {
      if (item.id === 'title') return { ...item, y: 0.1, fontSize: 0.055 }
      if (item.id === 'result') return { ...item, y: 0.19, color: '#ffeb3b' }
      return item
    })
  }
  return base
}

export function resolveTemplateLayout(template) {
  const layoutKey = toText(template?.layoutKey).toLowerCase() || 'default'
  const config = template?.layoutConfig && typeof template.layoutConfig === 'object' ? template.layoutConfig : {}
  const sourceLayers = Array.isArray(config.layers)
    ? config.layers
    : (Array.isArray(config.fields) ? config.fields.map(legacyFieldToLayer) : defaultLayoutLayers(layoutKey))
  const layers = sourceLayers.map((item, index) => normalizeLayer(item, index))
  return {
    layoutKey,
    version: Number(toNumber(config.version, 1)),
    layers,
    fields: layers.map((layer) => ({
      key: layer.field || layer.key || layer.id,
      kind: layer.type === 'image' ? 'image' : 'text',
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      fontFamily: layer.fontFamily,
      fontSize: layer.fontSize,
      fontWeight: layer.fontWeight,
      color: layer.color,
      textAlign: layer.textAlign,
      opacity: layer.opacity,
      visible: layer.visible,
      zIndex: layer.zIndex,
      hideWhenEmpty: layer.hideWhenEmpty,
    })),
  }
}

function formatDataFieldValue(fieldName, data, formatConfig) {
  const key = toText(fieldName)
  const formatType = typeof formatConfig === 'string'
    ? toText(formatConfig).toLowerCase()
    : toText(formatConfig?.type || '').toLowerCase()

  if (key === 'distance') {
    const distanceValue = data?.distanceValueKm
    if (formatType === 'km') return formatDistanceKm(distanceValue)
    if (formatType === 'full') return formatDistanceFull(distanceValue)
    return toText(data?.distance)
  }

  if (key === 'achievedAt') {
    const achievedAt = data?.achievedAtRaw
    if (formatType === 'vi_long_upper') return formatDateViLongUpper(achievedAt)
    return formatDateViShort(achievedAt)
  }

  if (key === 'result') {
    const resultText = toText(data?.result)
    const distanceText = toText(data?.distance)
    if (formatType === 'duration_distance') return [resultText, distanceText].filter(Boolean).join(' · ')
    return resultText
  }

  if (key === 'runnerCode') {
    const value = toText(data?.runnerCode)
    if (!value) return ''
    if (formatType === 'runner_prefix') return `Runner #${value}`
    return value
  }

  return toText(data?.[key])
}

function resolveDataLayerText(layer, renderData) {
  const template = toText(layer?.template)
  const separator = toText(layer?.format?.separator || layer?.separator) || ' · '
  if (template) {
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => toText(renderData?.[key]))
      .replace(/\s{2,}/g, ' ')
      .trim()
  }

  const configuredFields = Array.isArray(layer?.fields) ? layer.fields.map((item) => toText(item)).filter(Boolean) : []
  if (configuredFields.length > 0) {
    return configuredFields
      .map((fieldName) => formatDataFieldValue(fieldName, renderData, layer?.format))
      .map((item) => toText(item))
      .filter(Boolean)
      .join(separator)
  }

  const fieldName = toText(layer?.field || layer?.key)
  if (!fieldName) return ''
  return formatDataFieldValue(fieldName, renderData, layer?.format)
}

export function buildAchievementRenderData({ achievement, profile }) {
  const athleteName = toText(profile?.displayName)
    || toText(profile?.fullName)
    || toText(achievement?.sportsProfile?.displayName)
    || toText(achievement?.sportsProfile?.fullName)
    || toText(achievement?.sportsProfile?.code)
  const profileCode = toText(profile?.code) || toText(achievement?.sportsProfile?.code)
  const memberCode = toText(achievement?.clubMembership?.memberCode || achievement?.clubMembership?.oldMemberCode)
  return {
    athleteName,
    profileCode,
    runnerCode: memberCode || profileCode,
    clubName: toText(achievement?.club?.name) || toText(achievement?.club?.code),
    achievementTitle: toText(achievement?.title),
    eventName: toText(achievement?.sourceReference),
    sport: toText(achievement?.sportType),
    achievementType: toText(achievement?.achievementType),
    distance: formatDistanceShort(achievement?.distanceKm),
    distanceValueKm: Number(achievement?.distanceKm || 0) || null,
    result: resolveAchievementResult(achievement),
    achievedAt: formatDateViShort(achievement?.achievedAt),
    achievedAtRaw: achievement?.achievedAt || null,
    durationSecondsRaw: Number(achievement?.durationSeconds || 0) || null,
    clubLogoUrl: toText(achievement?.club?.logo?.url),
  }
}

async function loadImage(url) {
  const target = toText(url)
  if (!target) return null
  const response = await fetch(target, { credentials: 'include' })
  if (!response.ok) throw new Error(`Không tải được ảnh: ${response.status}`)
  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Ảnh không hợp lệ'))
      img.src = objectUrl
    })
    return image
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function toCanvasTextAlign(value) {
  const normalized = toText(value).toLowerCase()
  if (normalized === 'center' || normalized === 'right') return normalized
  return 'left'
}

function resolveAnchorX(x, width, align) {
  if (align === 'center') return x + (width / 2)
  if (align === 'right') return x + width
  return x
}

function resolveCanvasFontSize(layer, canvas) {
  const raw = toNumber(layer?.fontSize, 0.035)
  if (raw > 1) return Math.max(10, raw)
  return Math.max(10, raw * canvas.width)
}

function drawTextLayer(ctx, layer, textValue, canvas) {
  const value = toText(textValue)
  if (!value && layer?.hideWhenEmpty !== false) return
  const x = toNumber(layer?.x) * canvas.width
  const y = toNumber(layer?.y) * canvas.height
  const width = Math.max(1, toNumber(layer?.width, 0.6) * canvas.width)
  const fontSize = resolveCanvasFontSize(layer, canvas)
  const fontFamily = toText(layer?.fontFamily) || 'Inter, Segoe UI, Arial, sans-serif'
  const fontWeight = toText(layer?.fontWeight) || '400'
  const align = toCanvasTextAlign(layer?.textAlign)
  const alpha = Math.max(0, Math.min(1, toNumber(layer?.opacity, 1)))

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.textAlign = align
  ctx.textBaseline = 'top'
  ctx.fillStyle = toText(layer?.color) || '#ffffff'
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  ctx.fillText(value, resolveAnchorX(x, width, align), y)
  ctx.restore()
}

function drawImageLayer(ctx, layer, image, canvas) {
  if (!image && layer?.hideWhenEmpty !== false) return
  if (!image) return
  const x = toNumber(layer?.x) * canvas.width
  const y = toNumber(layer?.y) * canvas.height
  const width = Math.max(1, toNumber(layer?.width, 0.12) * canvas.width)
  const height = Math.max(1, toNumber(layer?.height, 0.12) * canvas.height)
  const alpha = Math.max(0, Math.min(1, toNumber(layer?.opacity, 1)))
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.drawImage(image, x, y, width, height)
  ctx.restore()
}

function resolveLayerImageUrl(layer, renderData) {
  const sourceField = toText(layer?.field || layer?.key)
  if (sourceField === 'clubLogo') return toText(renderData?.clubLogoUrl)
  return toText(layer?.imageUrl || layer?.content)
}

export async function renderAchievementPosterToCanvas({ canvas, template, achievement, profile }) {
  if (!canvas) throw new Error('Canvas is required')
  const backgroundUrl = toText(template?.backgroundAsset?.url)
  if (!backgroundUrl) throw new Error('Template chưa có ảnh nền')
  const layout = resolveTemplateLayout(template)
  const renderData = buildAchievementRenderData({ achievement, profile })

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try { await document.fonts.ready } catch {}
  }

  const backgroundImage = await loadImage(backgroundUrl)
  canvas.width = Number(backgroundImage?.naturalWidth || backgroundImage?.width || 1080)
  canvas.height = Number(backgroundImage?.naturalHeight || backgroundImage?.height || 1350)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Không tạo được canvas context')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height)

  const layers = (layout.layers || []).filter((layer) => layer?.visible !== false)
    .sort((a, b) => {
      const diff = Number(a?.zIndex || 0) - Number(b?.zIndex || 0)
      if (diff !== 0) return diff
      return toText(a?.id).localeCompare(toText(b?.id))
    })

  const imageCache = new Map()
  for (const layer of layers) {
    const layerType = normalizeLayerType(layer?.type || layer?.kind)
    if (layerType === 'image') {
      const imageUrl = resolveLayerImageUrl(layer, renderData)
      if (!imageUrl) continue
      if (!imageCache.has(imageUrl)) {
        imageCache.set(imageUrl, await loadImage(imageUrl).catch(() => null))
      }
      drawImageLayer(ctx, layer, imageCache.get(imageUrl), canvas)
      continue
    }

    if (layerType === 'text') {
      drawTextLayer(ctx, layer, toText(layer?.content), canvas)
      continue
    }

    const dataText = resolveDataLayerText(layer, renderData)
    drawTextLayer(ctx, layer, dataText, canvas)
  }
}

export async function exportAchievementPosterPngBlob({ template, achievement, profile }) {
  if (typeof document === 'undefined') throw new Error('Only browser environment is supported')
  const canvas = document.createElement('canvas')
  await renderAchievementPosterToCanvas({ canvas, template, achievement, profile })
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Không thể tạo PNG'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
}
