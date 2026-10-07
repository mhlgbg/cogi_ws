export const DEFAULT_FRAME_CONFIG = {
  photoShape: 'rect',
  photoFitMode: 'cover',
  minZoom: 0.5,
  maxZoom: 4,
  defaultZoom: 1,
  defaultOffsetX: 0,
  defaultOffsetY: 0,
  allowRotate: true,
  showOutsidePhotoAreaInPreview: 'dim',
  outsideOverlayOpacity: 0.45,
  outputFormat: 'png',
  outputQuality: 0.92,
}

const COVER_INTERACTION_MIN_ZOOM = 1.18

export function clampNumber(value, minValue, maxValue) {
  return Math.min(maxValue, Math.max(minValue, value))
}

export function normalizeRotation(value) {
  const normalized = Number(value || 0)
  const mod = normalized % 360
  return mod < 0 ? mod + 360 : mod
}

export function getRoundedRectRadius(area) {
  return clampNumber(Math.min(area.width, area.height) * 0.12, 0, Math.min(area.width, area.height) / 2)
}

export function resolveCampaignConfig(campaign) {
  if (!campaign || typeof campaign !== 'object') return null

  const width = Math.max(1, Number(campaign.width || 1080) || 1080)
  const height = Math.max(1, Number(campaign.height || 1080) || 1080)
  const minZoom = clampNumber(Number(campaign.minZoom || DEFAULT_FRAME_CONFIG.minZoom) || DEFAULT_FRAME_CONFIG.minZoom, 0.05, 20)
  const maxZoom = clampNumber(Number(campaign.maxZoom || DEFAULT_FRAME_CONFIG.maxZoom) || DEFAULT_FRAME_CONFIG.maxZoom, minZoom, 20)

  return {
    ...campaign,
    width,
    height,
    photoShape: ['circle', 'rect', 'rounded_rect', 'ellipse'].includes(String(campaign.photoShape || '').trim().toLowerCase())
      ? String(campaign.photoShape || '').trim().toLowerCase()
      : DEFAULT_FRAME_CONFIG.photoShape,
    photoArea: {
      x: Number.isFinite(Number(campaign.photoAreaX)) ? Number(campaign.photoAreaX) : 0,
      y: Number.isFinite(Number(campaign.photoAreaY)) ? Number(campaign.photoAreaY) : 0,
      width: Math.max(1, Number(campaign.photoAreaWidth || width) || width),
      height: Math.max(1, Number(campaign.photoAreaHeight || height) || height),
    },
    photoFitMode: ['cover', 'contain'].includes(String(campaign.photoFitMode || '').trim().toLowerCase())
      ? String(campaign.photoFitMode || '').trim().toLowerCase()
      : DEFAULT_FRAME_CONFIG.photoFitMode,
    minZoom,
    maxZoom,
    defaultZoom: clampNumber(Number(campaign.defaultZoom || DEFAULT_FRAME_CONFIG.defaultZoom) || DEFAULT_FRAME_CONFIG.defaultZoom, minZoom, maxZoom),
    defaultOffsetX: Number(campaign.defaultOffsetX || 0) || 0,
    defaultOffsetY: Number(campaign.defaultOffsetY || 0) || 0,
    allowRotate: campaign.allowRotate !== false,
    showOutsidePhotoAreaInPreview: ['dim', 'hide', 'show'].includes(String(campaign.showOutsidePhotoAreaInPreview || '').trim().toLowerCase())
      ? String(campaign.showOutsidePhotoAreaInPreview || '').trim().toLowerCase()
      : DEFAULT_FRAME_CONFIG.showOutsidePhotoAreaInPreview,
    outsideOverlayOpacity: clampNumber(Number(campaign.outsideOverlayOpacity || DEFAULT_FRAME_CONFIG.outsideOverlayOpacity) || DEFAULT_FRAME_CONFIG.outsideOverlayOpacity, 0, 1),
    outputFormat: ['png', 'jpeg'].includes(String(campaign.outputFormat || '').trim().toLowerCase())
      ? String(campaign.outputFormat || '').trim().toLowerCase()
      : DEFAULT_FRAME_CONFIG.outputFormat,
    outputQuality: clampNumber(Number(campaign.outputQuality || DEFAULT_FRAME_CONFIG.outputQuality) || DEFAULT_FRAME_CONFIG.outputQuality, 0.1, 1),
  }
}

export function buildPhotoAreaPath(context, area, shape) {
  const x = area.x
  const y = area.y
  const width = area.width
  const height = area.height

  if (shape === 'circle') {
    context.arc(x + width / 2, y + height / 2, Math.min(width, height) / 2, 0, Math.PI * 2)
    return
  }

  if (shape === 'ellipse') {
    context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2)
    return
  }

  if (shape === 'rounded_rect') {
    context.roundRect(x, y, width, height, getRoundedRectRadius(area))
    return
  }

  context.rect(x, y, width, height)
}

export function drawCheckerboard(context, width, height) {
  const size = 40
  context.save()
  context.fillStyle = '#f8fafc'
  context.fillRect(0, 0, width, height)
  for (let top = 0; top < height; top += size) {
    for (let left = 0; left < width; left += size) {
      if (((left / size) + (top / size)) % 2 === 0) {
        context.fillStyle = 'rgba(148, 163, 184, 0.18)'
        context.fillRect(left, top, size, size)
      }
    }
  }
  context.restore()
}

export function renderOutsideOverlay(context, campaign) {
  context.save()
  context.beginPath()
  context.rect(0, 0, campaign.width, campaign.height)
  buildPhotoAreaPath(context, campaign.photoArea, campaign.photoShape)
  context.fillStyle = `rgba(15, 23, 42, ${campaign.outsideOverlayOpacity})`
  context.fill('evenodd')
  context.restore()
}

export function renderPhotoAreaGuide(context, campaign) {
  context.save()
  context.beginPath()
  buildPhotoAreaPath(context, campaign.photoArea, campaign.photoShape)
  context.strokeStyle = 'rgba(14, 165, 233, 0.85)'
  context.lineWidth = Math.max(3, Math.min(campaign.width, campaign.height) * 0.004)
  context.setLineDash([24, 18])
  context.stroke()
  context.restore()
}

export function getRotatedBounds(width, height, rotation) {
  const radians = (normalizeRotation(rotation) * Math.PI) / 180
  const sin = Math.abs(Math.sin(radians))
  const cos = Math.abs(Math.cos(radians))
  return {
    width: (width * cos) + (height * sin),
    height: (width * sin) + (height * cos),
  }
}

export function getBaseScale(imageAsset, campaign, rotation) {
  if (!imageAsset?.width || !imageAsset?.height) return 1
  const rotatedIntrinsic = getRotatedBounds(imageAsset.width, imageAsset.height, rotation)
  if (campaign.photoFitMode === 'contain') {
    return Math.min(campaign.photoArea.width / rotatedIntrinsic.width, campaign.photoArea.height / rotatedIntrinsic.height)
  }
  return Math.max(campaign.photoArea.width / rotatedIntrinsic.width, campaign.photoArea.height / rotatedIntrinsic.height)
}

export function getEffectiveMinZoom(campaign) {
  const configuredMinZoom = Number(campaign?.minZoom || DEFAULT_FRAME_CONFIG.minZoom) || DEFAULT_FRAME_CONFIG.minZoom
  if (campaign?.photoFitMode === 'cover') {
    return Math.max(configuredMinZoom, COVER_INTERACTION_MIN_ZOOM)
  }
  return configuredMinZoom
}

export function getDisplayMetrics(imageAsset, campaign, transform) {
  if (!imageAsset?.width || !imageAsset?.height) {
    return {
      width: campaign?.photoArea?.width || campaign?.width || 1080,
      height: campaign?.photoArea?.height || campaign?.height || 1080,
      rotatedWidth: campaign?.photoArea?.width || campaign?.width || 1080,
      rotatedHeight: campaign?.photoArea?.height || campaign?.height || 1080,
      baseScale: 1,
    }
  }

  const baseScale = getBaseScale(imageAsset, campaign, transform.rotation)
  const width = imageAsset.width * baseScale * transform.zoom
  const height = imageAsset.height * baseScale * transform.zoom
  const rotatedBounds = getRotatedBounds(width, height, transform.rotation)
  return {
    width,
    height,
    rotatedWidth: rotatedBounds.width,
    rotatedHeight: rotatedBounds.height,
    baseScale,
  }
}

export function clampTransform(transform, imageAsset, campaign) {
  if (!campaign?.width || !campaign?.height || !campaign?.photoArea || !imageAsset?.width || !imageAsset?.height) return transform

  const effectiveMinZoom = getEffectiveMinZoom(campaign)

  const next = {
    ...transform,
    zoom: clampNumber(Number(transform.zoom || campaign.defaultZoom || DEFAULT_FRAME_CONFIG.defaultZoom), effectiveMinZoom, campaign.maxZoom),
    rotation: campaign.allowRotate ? normalizeRotation(transform.rotation) : 0,
  }

  const metrics = getDisplayMetrics(imageAsset, campaign, next)
  const area = campaign.photoArea
  const areaCenterX = area.x + area.width / 2
  const areaCenterY = area.y + area.height / 2

  let minCenterX
  let maxCenterX
  let minCenterY
  let maxCenterY

  if (campaign.photoFitMode === 'cover') {
    minCenterX = metrics.rotatedWidth >= area.width ? area.x + area.width - (metrics.rotatedWidth / 2) : areaCenterX
    maxCenterX = metrics.rotatedWidth >= area.width ? area.x + (metrics.rotatedWidth / 2) : areaCenterX
    minCenterY = metrics.rotatedHeight >= area.height ? area.y + area.height - (metrics.rotatedHeight / 2) : areaCenterY
    maxCenterY = metrics.rotatedHeight >= area.height ? area.y + (metrics.rotatedHeight / 2) : areaCenterY
  } else {
    minCenterX = area.x - (metrics.rotatedWidth / 2)
    maxCenterX = area.x + area.width + (metrics.rotatedWidth / 2)
    minCenterY = area.y - (metrics.rotatedHeight / 2)
    maxCenterY = area.y + area.height + (metrics.rotatedHeight / 2)
  }

  next.centerX = clampNumber(Number(next.centerX || areaCenterX), minCenterX, maxCenterX)
  next.centerY = clampNumber(Number(next.centerY || areaCenterY), minCenterY, maxCenterY)
  return next
}

export function createDefaultTransform(imageAsset, campaign) {
  const area = campaign.photoArea
  const effectiveMinZoom = getEffectiveMinZoom(campaign)
  return clampTransform({
    centerX: area.x + (area.width / 2) + campaign.defaultOffsetX,
    centerY: area.y + (area.height / 2) + campaign.defaultOffsetY,
    zoom: Math.max(campaign.defaultZoom, effectiveMinZoom),
    rotation: 0,
  }, imageAsset, campaign)
}

export function renderUserImage(context, campaign, userAsset, transform) {
  if (!userAsset?.image) return
  const metrics = getDisplayMetrics(userAsset, campaign, transform)
  context.save()
  context.translate(transform.centerX, transform.centerY)
  context.rotate((transform.rotation * Math.PI) / 180)
  context.drawImage(userAsset.image, -metrics.width / 2, -metrics.height / 2, metrics.width, metrics.height)
  context.restore()
}

export function renderFrameCanvas(context, campaign, frameAsset, userAsset, transform, mode = 'preview', options = {}) {
  context.clearRect(0, 0, campaign.width, campaign.height)
  drawCheckerboard(context, campaign.width, campaign.height)

  if (userAsset) {
    if (mode === 'export' || campaign.showOutsidePhotoAreaInPreview === 'hide') {
      context.save()
      context.beginPath()
      buildPhotoAreaPath(context, campaign.photoArea, campaign.photoShape)
      context.clip()
      renderUserImage(context, campaign, userAsset, transform)
      context.restore()
    } else {
      renderUserImage(context, campaign, userAsset, transform)
    }

    if (mode === 'preview' && campaign.showOutsidePhotoAreaInPreview === 'dim') {
      renderOutsideOverlay(context, campaign)
    }
  }

  if (mode === 'preview' && options.showGuide !== false) {
    renderPhotoAreaGuide(context, campaign)
  }

  if (frameAsset?.image) {
    context.drawImage(frameAsset.image, 0, 0, campaign.width, campaign.height)
  }
}

export function canvasRectToDisplayRect(area, campaign, previewSize) {
  if (!campaign?.width || !campaign?.height || !previewSize?.width || !previewSize?.height) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  return {
    x: (area.x / campaign.width) * previewSize.width,
    y: (area.y / campaign.height) * previewSize.height,
    width: (area.width / campaign.width) * previewSize.width,
    height: (area.height / campaign.height) * previewSize.height,
  }
}

export function displayRectToCanvasRect(displayRect, campaign, previewSize) {
  if (!campaign?.width || !campaign?.height || !previewSize?.width || !previewSize?.height) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  return {
    x: (displayRect.x / previewSize.width) * campaign.width,
    y: (displayRect.y / previewSize.height) * campaign.height,
    width: (displayRect.width / previewSize.width) * campaign.width,
    height: (displayRect.height / previewSize.height) * campaign.height,
  }
}