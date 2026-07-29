import React from 'react'

const SPIN_DURATION_MS = 4600
const SVG_START_ANGLE = -90

function normalizeAngle(angle) {
  let next = Number(angle || 0) % 360
  if (next < 0) next += 360
  return next
}

function truncateWheelLabel(value, maxWords = 3, maxChars = 18) {
  const text = String(value || '').trim()
  if (!text) return ''
  const words = text.split(/\s+/)
  let shortText = words.slice(0, maxWords).join(' ')
  if (shortText.length > maxChars) shortText = shortText.slice(0, maxChars).trim()
  return shortText !== text ? `${shortText}...` : shortText
}

function getRadialLabelLayout(midAngle, wheelRotation = 0) {
  const screenAngle = normalizeAngle(midAngle + wheelRotation)
  const shouldFlip = screenAngle > 90 && screenAngle < 270
  return {
    rotation: midAngle + (shouldFlip ? 180 : 0),
    textAnchor: shouldFlip ? 'end' : 'start',
  }
}

function polarToCartesian(cx, cy, radius, angleDeg) {
  const angleRad = angleDeg * (Math.PI / 180)
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  }
}

function buildAnnularSectorPath(cx, cy, outerRadius, innerRadius, startAngle, endAngle) {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle)
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle)
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle)
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle)
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

function getReadableLabelRotation(midAngle, wheelRotation = 0) {
  const screenAngle = normalizeAngle(midAngle + wheelRotation)
  let desiredScreenRotation = screenAngle
  if (screenAngle > 90 && screenAngle < 270) {
    desiredScreenRotation += 180
  }
  return desiredScreenRotation - wheelRotation
}

function extractSegmentKey(segment) {
  return String(segment?.documentId || segment?.id || '')
}

export default function LuckyWheelDisplay({
  segments = [],
  rotation = 0,
  isSpinning = false,
  interactive = true,
  highlightResultKey = '',
  centerLabel = 'Quay',
  centerDisabled = false,
  onCenterClick,
  onSpinEnd,
}) {
  const size = 560
  const cx = size / 2
  const cy = size / 2
  const outerRadius = size * 0.46
  const innerRadius = outerRadius * 0.39
  const segmentCount = Math.max(1, segments.length)
  const anglePer = 360 / segmentCount

  return (
    <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <div
        style={{
          position: 'relative',
          width: 'min(100%, 560px)',
          aspectRatio: '1 / 1',
        }}
      >
        <svg
          width='100%'
          height='100%'
          viewBox={`0 0 ${size} ${size}`}
          preserveAspectRatio='xMidYMid meet'
          style={{ display: 'block', overflow: 'visible' }}
        >
          <circle cx={cx} cy={cy} r={outerRadius} fill='#fff' stroke='#e5e7eb' strokeWidth={2} />

          <g
            style={{
              transform: `rotate(${rotation}deg)`,
              transformOrigin: `${cx}px ${cy}px`,
              transformBox: 'view-box',
              transition: isSpinning ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(.12,.78,.18,1)` : 'none',
              willChange: 'transform',
            }}
            onTransitionEnd={(event) => {
              if (event.propertyName === 'transform') onSpinEnd?.(event)
            }}
          >
            {segments.map((segment, index) => {
              const startAngle = SVG_START_ANGLE + index * anglePer
              const endAngle = SVG_START_ANGLE + (index + 1) * anglePer
              const midAngle = startAngle + anglePer / 2
              const path = buildAnnularSectorPath(cx, cy, outerRadius, innerRadius, startAngle, endAngle)
              const background = segment.displayColor || (index % 2 === 0 ? '#f8fafc' : '#ffffff')
              const foreground = segment.textColor || '#111827'
              const label = truncateWheelLabel(segment.shortLabel || segment.name || '', 3, 18)
              const imageUrl = String(segment.resolvedImageUrl || '').trim()
              const isHighlighted = highlightResultKey && extractSegmentKey(segment) === String(highlightResultKey)
              const textPoint = polarToCartesian(cx, cy, innerRadius + (outerRadius - innerRadius) * 0.1, midAngle)
              const imagePoint = polarToCartesian(cx, cy, innerRadius + (outerRadius - innerRadius) * 0.22, midAngle)
              const labelLayout = getRadialLabelLayout(midAngle, rotation)
              const labelRotation = getReadableLabelRotation(midAngle, rotation)

              return (
                <g key={extractSegmentKey(segment) || index}>
                  <path d={path} fill={background} stroke={isHighlighted ? '#f59e0b' : '#ffffff'} strokeWidth={isHighlighted ? 5 : 2} strokeLinejoin='round' />
                  {imageUrl ? (
                    <image
                      href={imageUrl}
                      x={imagePoint.x - 17}
                      y={imagePoint.y - 17}
                      width='34'
                      height='34'
                      preserveAspectRatio='xMidYMid meet'
                    />
                  ) : null}
                  <text
                    x={textPoint.x}
                    y={textPoint.y}
                    fill={foreground}
                    fontSize={15}
                    fontWeight={700}
                    textAnchor={labelLayout.textAnchor}
                    dominantBaseline='middle'
                    transform={`rotate(${labelRotation} ${textPoint.x} ${textPoint.y})`}
                  >
                    {label}
                  </text>
                </g>
              )
            })}
          </g>

          <polygon points={`${cx - 13},8 ${cx + 13},8 ${cx},34`} fill='#1f2937' />
        </svg>

        <button
          type='button'
          onClick={interactive ? onCenterClick : undefined}
          disabled={!interactive || centerDisabled}
          aria-label={centerLabel}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '27%',
            height: '27%',
            minWidth: 92,
            minHeight: 92,
            borderRadius: '50%',
            border: '4px solid rgba(255,255,255,0.9)',
            background: !interactive || centerDisabled ? '#6b7280' : '#2563eb',
            color: '#fff',
            fontSize: 18,
            fontWeight: 700,
            cursor: !interactive || centerDisabled ? 'not-allowed' : 'pointer',
            boxShadow: '0 10px 22px rgba(15,23,42,0.22)',
            zIndex: 2,
          }}
        >
          {centerLabel}
        </button>
      </div>
    </div>
  )
}