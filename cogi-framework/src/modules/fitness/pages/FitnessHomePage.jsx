import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CFormSelect,
  CModal,
  CModalBody,
  CModalHeader,
  CModalTitle,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
  CTabContent,
  CTabPane,
} from '@coreui/react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useTenant } from '../../../contexts/TenantContext'
import {
  cancelStravaSyncJob,
  createStravaConnectUrl,
  disconnectStrava,
  getCurrentStravaSyncJob,
  getFitnessApiErrorMessage,
  getStravaActivities,
  getStravaAnalyticsInsights,
  getStravaAnalyticsMilestones,
  getStravaAnalyticsOverview,
  getStravaAnalyticsRecords,
  getStravaAnalyticsTopActivities,
  getStravaAnalyticsTrends,
  getStravaAnalyticsYearly,
  getStravaAnalyticsYearlyRecords,
  getStravaStatus,
  isStravaReconnectRequiredErrorCode,
  retryStravaSyncJob,
  startStravaSync,
} from '../services/fitnessService'
import { formatNumber } from '../../../utils/numberFormat'
import './fitness-home-page.css'

const TAB_ITEMS = [
  { key: 'overview', label: 'Tổng quan', icon: 'dashboard' },
  { key: 'trends', label: 'Xu hướng', icon: 'trends' },
  { key: 'records', label: 'Thành tích', icon: 'trophy' },
  { key: 'insights', label: 'Insight', icon: 'insight' },
  { key: 'activities', label: 'Hoạt động', icon: 'activities' },
  { key: 'challenge', label: 'Challenge', icon: 'challenge' },
]

const STRAVA_SYNC_POLL_INTERVAL = 4000
const ACTIVE_SYNC_JOB_STATUSES = new Set(['queued', 'running', 'partial_ready'])
const TERMINAL_SYNC_JOB_STATUSES = new Set(['completed', 'failed', 'cancelled'])
const RECONNECT_REQUIRED_ERROR_CODES = new Set([
  'STRAVA_CONNECTION_REVOKED',
  'STRAVA_TOKEN_REFRESH_FAILED',
  'STRAVA_NOT_CONNECTED',
])
const VKL_RUNNERS_PRIVACY_URL = '/privacy/vkl-runners'
const COGI_PRIVACY_URL = '/privacy/cogi-platform'

function InlineIcon({ name }) {
  const props = {
    fill: 'none',
    viewBox: '0 0 24 24',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }

  const icons = {
    dashboard: (
      <svg {...props}>
        <rect x='3' y='3' width='8' height='8' rx='2' />
        <rect x='13' y='3' width='8' height='5' rx='2' />
        <rect x='13' y='10' width='8' height='11' rx='2' />
        <rect x='3' y='13' width='8' height='8' rx='2' />
      </svg>
    ),
    trends: (
      <svg {...props}>
        <path d='M4 17l5-5 4 4 7-8' />
        <path d='M15 8h5v5' />
      </svg>
    ),
    trophy: (
      <svg {...props}>
        <path d='M8 4h8v3a4 4 0 0 1-8 0z' />
        <path d='M6 5H4a2 2 0 0 0 2 4h2' />
        <path d='M18 5h2a2 2 0 0 1-2 4h-2' />
        <path d='M12 11v4' />
        <path d='M9 21h6' />
        <path d='M10 15h4l1 6H9z' />
      </svg>
    ),
    insight: (
      <svg {...props}>
        <path d='M9 18h6' />
        <path d='M10 22h4' />
        <path d='M12 2a7 7 0 0 0-4 12.7c.7.5 1.2 1.3 1.4 2.1h5.2c.2-.8.7-1.6 1.4-2.1A7 7 0 0 0 12 2z' />
      </svg>
    ),
    activities: (
      <svg {...props}>
        <path d='M4 14h4l2-5 4 10 2-5h4' />
      </svg>
    ),
    challenge: (
      <svg {...props}>
        <path d='M12 3l7 4v5c0 4.4-3 8.5-7 9-4-1-7-4.6-7-9V7z' />
        <path d='M9.5 12l1.8 1.8 3.2-3.6' />
      </svg>
    ),
    link: (
      <svg {...props}>
        <path d='M10 13a5 5 0 0 0 7.1 0l1.4-1.4a5 5 0 0 0-7.1-7.1L10 5' />
        <path d='M14 11a5 5 0 0 0-7.1 0L5.5 12.4a5 5 0 1 0 7.1 7.1L14 19' />
      </svg>
    ),
    sync: (
      <svg {...props}>
        <path d='M21 12a9 9 0 0 0-15.5-6.4' />
        <path d='M3 4v5h5' />
        <path d='M3 12a9 9 0 0 0 15.5 6.4' />
        <path d='M21 20v-5h-5' />
      </svg>
    ),
    distance: (
      <svg {...props}>
        <path d='M4 18c3-6 5-8 8-12 3 4 5 6 8 12' />
        <path d='M8 18h8' />
      </svg>
    ),
    clock: (
      <svg {...props}>
        <circle cx='12' cy='12' r='9' />
        <path d='M12 7v5l3 2' />
      </svg>
    ),
    elevation: (
      <svg {...props}>
        <path d='M4 18l6-9 3 4 3-5 4 10' />
      </svg>
    ),
    streak: (
      <svg {...props}>
        <path d='M13 3L7 14h4l-1 7 7-12h-4l0-6z' />
      </svg>
    ),
    sport: (
      <svg {...props}>
        <circle cx='7' cy='7' r='3' />
        <path d='M14 5h6' />
        <path d='M14 9h6' />
        <path d='M4 20l5-6 4 2 4-5 3 2' />
      </svg>
    ),
    recent: (
      <svg {...props}>
        <path d='M12 6v6l4 2' />
        <circle cx='12' cy='12' r='9' />
      </svg>
    ),
    calendar: (
      <svg {...props}>
        <rect x='3' y='5' width='18' height='16' rx='2' />
        <path d='M16 3v4' />
        <path d='M8 3v4' />
        <path d='M3 10h18' />
      </svg>
    ),
  }

  return <span className='fitness-page__inline-icon'>{icons[name] || icons.dashboard}</span>
}

function SummaryCard({ icon = 'dashboard', label, value, helper }) {
  return (
    <CCard className='fitness-page__summary-card'>
      <CCardBody className='fitness-page__summary-body'>
        <span className='fitness-page__summary-icon'>
          <InlineIcon name={icon} />
        </span>
        <div className='fitness-page__summary-value'>{value}</div>
        <div className='fitness-page__summary-label'>{label}</div>
        {helper ? <div className='fitness-page__summary-helper'>{helper}</div> : null}
      </CCardBody>
    </CCard>
  )
}

function SectionHeader({ title, description, action = null }) {
  return (
    <div className='fitness-page__section'>
      <div className='fitness-page__section-header'>
        <div>
          <h2 className='fitness-page__section-title'>{title}</h2>
          {description ? <div className='fitness-page__section-description'>{description}</div> : null}
        </div>
        {action}
      </div>
      <div className='fitness-page__section-rule' />
    </div>
  )
}

function EmptyPanel({ title, description }) {
  return (
    <div
      style={{
        border: '1px dashed #cbd5e1',
        borderRadius: 16,
        padding: 24,
        background: '#f8fafc',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      <div className='text-muted'>{description}</div>
    </div>
  )
}

function getApiErrorMessage(error, fallback = 'Không tải được dữ liệu Thể thao.') {
  return getFitnessApiErrorMessage(error, fallback)
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function isActiveSyncJob(job) {
  return ACTIVE_SYNC_JOB_STATUSES.has(String(job?.status || '').trim())
}

function getReadableSyncStatus(status) {
  const normalized = String(status || '').trim()
  if (normalized === 'completed') return 'Đồng bộ thành công'
  if (normalized === 'failed') return 'Đồng bộ chưa hoàn tất'
  if (normalized === 'cancelled') return 'Đã hủy đồng bộ'
  if (normalized === 'partial_ready') return 'Đang hoàn thiện số liệu'
  if (normalized === 'running') return 'Đang đồng bộ'
  if (normalized === 'queued') return 'Đang chờ đồng bộ'
  return 'Chưa đồng bộ'
}

function getReadableConnectionStatus(status, connected) {
  if (!connected) return 'Chưa kết nối'

  const normalized = String(status || '').trim().toUpperCase()
  if (normalized === 'ACTIVE' || normalized === 'CONNECTED') return 'Đã kết nối'
  if (normalized === 'EXPIRED' || normalized === 'REVOKED' || normalized === 'ERROR') return 'Có lỗi'
  return 'Đã kết nối'
}

function getConnectionCardStatusLabel({ connected, isSyncActive, isFailed }) {
  if (isFailed) return 'Có lỗi'
  if (isSyncActive) return 'Đang đồng bộ'
  return connected ? 'Đã kết nối' : 'Chưa kết nối'
}

function getConnectionCardStatusColor({ connected, isSyncActive, isFailed }) {
  if (isFailed) return 'danger'
  if (isSyncActive) return 'info'
  return connected ? 'success' : 'secondary'
}

function getSyncReferenceTime(job, fallback = null) {
  return job?.finishedAt || job?.recentReadyAt || job?.startedAt || job?.requestedAt || fallback || null
}

function getSyncActivityCount(job, fallback = 0) {
  const total = Number(job?.totalActivities)
  if (Number.isFinite(total) && total > 0) return total

  const processed = Number(job?.processedActivities)
  if (Number.isFinite(processed) && processed > 0) return processed

  return Number(fallback || 0)
}

function getStravaSyncStatusContent(job) {
  const status = String(job?.status || '').trim()
  const phase = String(job?.phase || '').trim()
  const backendMessage = typeof job?.progressMessage === 'string' && job.progressMessage.trim()
    ? job.progressMessage.trim()
    : typeof job?.message === 'string' && job.message.trim()
      ? job.message.trim()
      : ''

  if (backendMessage) {
    return {
      title: status === 'partial_ready' ? 'Đang đồng bộ lịch sử' : 'Trạng thái đồng bộ Strava',
      description: backendMessage,
    }
  }

  if (status === 'queued') return { title: 'Đang chờ đồng bộ', description: 'Yêu cầu đồng bộ đang chờ xử lý.' }
  if (status === 'running' && phase === 'preparing') return { title: 'Đang chuẩn bị', description: 'Đang chuẩn bị đồng bộ dữ liệu.' }
  if (status === 'running' && phase === 'syncing_recent') return { title: 'Đang tải dữ liệu gần đây', description: 'Đang tải các hoạt động gần đây…' }
  if (status === 'partial_ready' && phase === 'syncing_history') return { title: 'Đang đồng bộ lịch sử', description: 'Dữ liệu gần đây đã sẵn sàng. Hệ thống đang tiếp tục đồng bộ lịch sử.' }
  if ((status === 'partial_ready' || status === 'running') && phase === 'rebuilding_snapshot') return { title: 'Đang hoàn thiện số liệu', description: 'Đang hoàn thiện số liệu thống kê…' }
  if (status === 'running' && phase === 'finalizing') return { title: 'Đang hoàn tất', description: 'Đang hoàn tất quá trình đồng bộ…' }
  if (status === 'completed') return { title: 'Đồng bộ hoàn tất', description: 'Đồng bộ hoàn tất.' }
  if (status === 'failed') return { title: 'Đồng bộ chưa hoàn tất', description: 'Đồng bộ chưa hoàn tất. Bạn có thể thử lại.' }
  if (status === 'cancelled') return { title: 'Đã hủy đồng bộ', description: 'Đã hủy đồng bộ.' }

  return { title: 'Trạng thái đồng bộ Strava', description: 'Đang xử lý đồng bộ Strava.' }
}

function computeSyncProgress(job) {
  const processed = Math.max(0, Number(job?.processedActivities || 0))
  const total = Number(job?.totalActivities)
  if (!Number.isFinite(total) || total <= 0) {
    return {
      processed,
      total: null,
      percent: null,
    }
  }

  const boundedProcessed = Math.min(processed, total)
  return {
    processed,
    total,
    percent: Math.max(0, Math.min(100, Math.round((boundedProcessed / total) * 100))),
  }
}

function StravaSyncStatusCard({
  job,
  loading,
  polling,
  error,
  syncCancelling,
  syncRetrying,
  onRetry,
  onCancel,
  onReconnect,
  fallbackActivityCount,
  fallbackSyncAt,
  fallbackStatus,
}) {
  if (!job && !loading && !error && !fallbackStatus && !fallbackSyncAt && !fallbackActivityCount) return null

  const status = String(job?.status || fallbackStatus || '').trim()
  const content = getStravaSyncStatusContent(job)
  const progress = computeSyncProgress(job)
  const syncTime = getSyncReferenceTime(job, fallbackSyncAt)
  const activityCount = getSyncActivityCount(job, fallbackActivityCount)
  const reconnectRequired = RECONNECT_REQUIRED_ERROR_CODES.has(String(job?.lastErrorCode || '').trim())
  const showRetry = Boolean(job?.canRetry) && !reconnectRequired
  const showCancel = Boolean(job?.canCancel)
  const badgeColor = status === 'completed'
    ? 'success'
    : status === 'failed'
      ? 'danger'
      : status === 'cancelled'
        ? 'secondary'
        : status === 'partial_ready'
          ? 'warning'
          : 'info'

  return (
    <CCard className='fitness-page__panel fitness-page__sync-card mb-4'>
      <CCardBody className='fitness-page__panel-body'>
        {loading && !job ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span className='text-muted'>Đang tải trạng thái đồng bộ Strava...</span>
          </div>
        ) : null}

        {job ? (
          <div>
            <div className='fitness-page__sync-summary'>
              <div>
                <div className='fitness-page__panel-kicker'>
                  <InlineIcon name='sync' />
                  Trạng thái đồng bộ
                </div>
                <div className='d-flex flex-wrap align-items-center gap-2 mb-2'>
                  <div className='fitness-page__panel-title'>{getReadableSyncStatus(status)}</div>
                  <CBadge color={badgeColor}>{status || 'unknown'}</CBadge>
                  {status === 'partial_ready' ? <CBadge color='warning' shape='rounded-pill'>Số liệu đang được hoàn thiện</CBadge> : null}
                  {polling ? <CBadge color='info' shape='rounded-pill'>Đang cập nhật</CBadge> : null}
                </div>
                <div className='fitness-page__panel-subtitle'>{content.description}</div>
                {status === 'failed' && job?.lastErrorMessage ? <div className='small text-danger mt-2'>{job.lastErrorMessage}</div> : null}
                {error ? <div className='small text-danger mt-2'>{error}</div> : null}
              </div>
              <div className='d-flex flex-wrap gap-2'>
                {reconnectRequired ? (
                  <CButton color='primary' variant='outline' onClick={onReconnect}>
                    Kết nối lại Strava
                  </CButton>
                ) : null}
                {showRetry ? (
                  <CButton color='warning' variant='outline' disabled={syncRetrying} onClick={onRetry}>
                    {syncRetrying ? 'Đang thử lại...' : 'Thử lại'}
                  </CButton>
                ) : null}
                {showCancel ? (
                  <CButton color='secondary' variant='outline' disabled={syncCancelling} onClick={onCancel}>
                    {syncCancelling ? 'Đang hủy...' : 'Hủy'}
                  </CButton>
                ) : null}
              </div>
            </div>

            <div className='fitness-page__sync-stats'>
              <div className='fitness-page__sync-stat'>
                <div className='fitness-page__sync-stat-label'>Trạng thái</div>
                <div className='fitness-page__sync-stat-value'>{getReadableSyncStatus(status)}</div>
              </div>
              <div className='fitness-page__sync-stat'>
                <div className='fitness-page__sync-stat-label'>Thời điểm</div>
                <div className='fitness-page__sync-stat-value'>{formatDateTime(syncTime)}</div>
              </div>
              <div className='fitness-page__sync-stat'>
                <div className='fitness-page__sync-stat-label'>Hoạt động</div>
                <div className='fitness-page__sync-stat-value'>{formatNumber(activityCount)}</div>
              </div>
            </div>

            <details className='fitness-page__details'>
              <summary>Chi tiết</summary>
              <div className='fitness-page__details-grid'>
                {progress.total ? (
                  <>
                    <span>{`Đã xử lý ${formatNumber(progress.processed)} / ${formatNumber(progress.total)} hoạt động`}</span>
                    <span>{`Tiến độ ${progress.percent}%`}</span>
                  </>
                ) : (
                  <span>{`Đã xử lý ${formatNumber(progress.processed)} hoạt động`}</span>
                )}
                <span>{`Mới: ${formatNumber(job?.createdActivities || 0)}`}</span>
                <span>{`Cập nhật: ${formatNumber(job?.updatedActivities || 0)}`}</span>
                <span>{`Bỏ qua: ${formatNumber(job?.skippedActivities || 0)}`}</span>
                {Number(job?.failedActivities || 0) > 0 ? <span>{`Lỗi: ${formatNumber(job.failedActivities)}`}</span> : null}
                {job?.requestedAt ? <span>{`Yêu cầu lúc ${formatDateTime(job.requestedAt)}`}</span> : null}
                {job?.startedAt ? <span>{`Bắt đầu lúc ${formatDateTime(job.startedAt)}`}</span> : null}
                {job?.recentReadyAt ? <span>{`Sẵn sàng gần đây lúc ${formatDateTime(job.recentReadyAt)}`}</span> : null}
                {job?.finishedAt ? <span>{`Kết thúc lúc ${formatDateTime(job.finishedAt)}`}</span> : null}
              </div>
            </details>
          </div>
        ) : null}

        {!job && !loading ? (
          <div>
            <div className='fitness-page__sync-summary'>
              <div>
                <div className='fitness-page__panel-kicker'>
                  <InlineIcon name='sync' />
                  Trạng thái đồng bộ
                </div>
                <div className='d-flex flex-wrap align-items-center gap-2 mb-2'>
                  <div className='fitness-page__panel-title'>{getReadableSyncStatus(status)}</div>
                  <CBadge color={status === 'completed' ? 'success' : 'secondary'}>{status || 'NEVER'}</CBadge>
                </div>
                <div className='fitness-page__panel-subtitle'>Dữ liệu đồng bộ gần nhất được hiển thị ở chế độ rút gọn để giữ dashboard nằm gọn trong một màn hình.</div>
              </div>
            </div>

            <div className='fitness-page__sync-stats'>
              <div className='fitness-page__sync-stat'>
                <div className='fitness-page__sync-stat-label'>Trạng thái</div>
                <div className='fitness-page__sync-stat-value'>{getReadableSyncStatus(status)}</div>
              </div>
              <div className='fitness-page__sync-stat'>
                <div className='fitness-page__sync-stat-label'>Thời điểm</div>
                <div className='fitness-page__sync-stat-value'>{formatDateTime(syncTime)}</div>
              </div>
              <div className='fitness-page__sync-stat'>
                <div className='fitness-page__sync-stat-label'>Hoạt động</div>
                <div className='fitness-page__sync-stat-value'>{formatNumber(activityCount)}</div>
              </div>
            </div>
          </div>
        ) : null}

        {!job && error ? <div className='small text-danger'>{error}</div> : null}
      </CCardBody>
    </CCard>
  )
}

function formatDistanceMeters(value, options = {}) {
  const distanceMeters = Number(value || 0)
  const distanceKm = distanceMeters / 1000
  return `${formatNumber(distanceKm, { minimumFractionDigits: 0, maximumFractionDigits: 1, ...options })} km`
}

function formatDurationSeconds(value) {
  const totalSeconds = Number(value || 0)
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0 giờ'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0) return `${formatNumber(hours)} giờ ${formatNumber(minutes)} phút`
  return `${formatNumber(minutes)} phút`
}

function formatElevationMeters(value) {
  return `${formatNumber(Math.round(Number(value || 0)))} m`
}

function formatTrendValue(metric, value) {
  if (metric === 'distance') return formatDistanceMeters(value)
  if (metric === 'movingTime') return formatDurationSeconds(value)
  if (metric === 'elevation') return formatElevationMeters(value)
  return formatNumber(value)
}

function formatPercent(value, options = {}) {
  return `${formatNumber(Number(value || 0) * 100, { minimumFractionDigits: 0, maximumFractionDigits: 1, ...options })}%`
}

function formatDelta(delta, formatter) {
  const numeric = Number(delta || 0)
  const prefix = numeric > 0 ? '+' : ''
  return `${prefix}${formatter(numeric)}`
}

function formatChangePercent(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Chưa đủ dữ liệu'
  const numeric = Number(value)
  const prefix = numeric > 0 ? '+' : ''
  return `${prefix}${formatPercent(numeric)}`
}

function createDefaultInsightsData() {
  return {
    filters: { range: '12m', sportType: 'all' },
    weekday: { items: [], topWeekday: null, leastWeekday: null, weekendRate: 0, weekdayRate: 0 },
    timeOfDay: { items: [], topPeriod: null, bestDistancePeriod: null, bestPacePeriod: null, bestSpeedPeriod: null },
    frequency: {
      averageActivitiesPerWeek: 0,
      averageActiveDaysPerWeek: 0,
      averageDistancePerWeek: 0,
      averageMovingTimePerWeek: 0,
      activeWeeks: 0,
      inactiveWeeks: 0,
      activeWeekRate: 0,
    },
    consistency: { score: 0, level: 'none', activeWeekRate: 0, stabilityScore: 0, description: '' },
    distanceDistribution: { items: [], mostCommonBucket: null },
    durationDistribution: { items: [], mostCommonBucket: null },
    sportDistribution: { items: [] },
    recentComparison: {
      current: { totalActivities: 0, totalDistance: 0, totalMovingTime: 0, activeDays: 0, averageDistancePerActivity: 0 },
      previous: { totalActivities: 0, totalDistance: 0, totalMovingTime: 0, activeDays: 0, averageDistancePerActivity: 0 },
      changes: {},
    },
    statements: [],
  }
}

function PlaceholderTab({ text }) {
  return <EmptyPanel title='Đang hoàn thiện' description={text} />
}

export default function FitnessHomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const tenant = useTenant()
  const tenantName = tenant?.currentTenant?.tenantName || tenant?.resolvedTenant?.tenantName || 'đơn vị của bạn'
  const mountedRef = useRef(false)
  const pollingTimeoutRef = useRef(null)
  const pollingGenerationRef = useRef(0)
  const pollingAbortControllerRef = useRef(null)
  const pollingFailureCountRef = useRef(0)
  const pollingRequestSequenceRef = useRef(0)
  const syncJobRef = useRef(null)
  const recentReadyHandledRef = useRef('')
  const completedHandledRef = useRef('')
  const failedHandledRef = useRef('')
  const cancelledHandledRef = useRef('')

  const [activeTab, setActiveTab] = useState('overview')
  const [statusLoading, setStatusLoading] = useState(true)
  const [connectLoading, setConnectLoading] = useState(false)
  const [disconnectLoading, setDisconnectLoading] = useState(false)
  const [syncJob, setSyncJob] = useState(null)
  const [syncJobLoading, setSyncJobLoading] = useState(true)
  const [syncStarting, setSyncStarting] = useState(false)
  const [syncCancelling, setSyncCancelling] = useState(false)
  const [syncRetrying, setSyncRetrying] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [isPolling, setIsPolling] = useState(false)
  const [lastDashboardRefreshAt, setLastDashboardRefreshAt] = useState(null)
  const [activitiesLoading, setActivitiesLoading] = useState(false)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [trendsLoading, setTrendsLoading] = useState(true)
  const [yearlyLoading, setYearlyLoading] = useState(true)
  const [recordsLoading, setRecordsLoading] = useState(true)
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [insightsError, setInsightsError] = useState('')
  const [message, setMessage] = useState({ type: '', text: '' })
  const [stravaStatus, setStravaStatus] = useState({
    connected: false,
    status: 'DISCONNECTED',
    athleteFirstname: null,
    athleteLastname: null,
    profileUrl: null,
    lastSyncAt: null,
    lastSyncStatus: 'NEVER',
  })
  const [overview, setOverview] = useState({
    allTime: {
      totalActivities: 0,
      totalDistance: 0,
      totalMovingTime: 0,
      totalElevationGain: 0,
      activeDays: 0,
      averageDistance: 0,
      averageMovingTime: 0,
      currentStreak: 0,
      longestStreak: 0,
    },
    currentYear: {
      totalActivities: 0,
      totalDistance: 0,
      totalMovingTime: 0,
      totalElevationGain: 0,
    },
    latestActivity: null,
    sportBreakdown: [],
    lastSyncAt: null,
    lastSyncStatus: 'NEVER',
  })
  const [trends, setTrends] = useState({ metric: 'distance', groupBy: 'month', items: [] })
  const [yearly, setYearly] = useState({ items: [] })
  const [records, setRecords] = useState({ records: {} })
  const [topActivities, setTopActivities] = useState({ sortBy: 'distance', items: [] })
  const [yearlyRecords, setYearlyRecords] = useState({ items: [] })
  const [milestones, setMilestones] = useState({
    distance: { currentValue: 0, achieved: [], next: null },
    activities: { currentValue: 0, achieved: [], next: null },
    activeDays: { currentValue: 0, achieved: [], next: null },
  })
  const [insights, setInsights] = useState(createDefaultInsightsData())
  const [trendRange, setTrendRange] = useState('12m')
  const [trendGroupBy, setTrendGroupBy] = useState('month')
  const [trendMetric, setTrendMetric] = useState('distance')
  const [insightRange, setInsightRange] = useState('12m')
  const [insightSportType, setInsightSportType] = useState('all')
  const [recordSportType, setRecordSportType] = useState('all')
  const [topSortBy, setTopSortBy] = useState('distance')
  const [topYear, setTopYear] = useState('')
  const [selectedActivityDetail, setSelectedActivityDetail] = useState(null)
  const [activities, setActivities] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, pageCount: 1, total: 0 })

  const isStravaConnected = Boolean(stravaStatus?.connected)
  const athleteName = [stravaStatus?.athleteFirstname, stravaStatus?.athleteLastname].filter(Boolean).join(' ').trim()
  const recentActivities = useMemo(() => activities.slice(0, 5), [activities])
  const latestActivity = overview?.latestActivity || null
  const overviewSyncStatus = overview?.lastSyncStatus || stravaStatus?.lastSyncStatus || 'NEVER'
  const overviewSyncAt = overview?.lastSyncAt || stravaStatus?.lastSyncAt || null
  const syncStatus = String(syncJob?.status || '').trim()
  const isSyncActive = isActiveSyncJob(syncJob)
  const isPartialReady = syncStatus === 'partial_ready'
  const isFailed = syncStatus === 'failed'
  const reconnectRequired = isStravaReconnectRequiredErrorCode(syncJob?.lastErrorCode)
  const syncActionPending = syncStarting || syncCancelling || syncRetrying
  const syncButtonDisabled = !isStravaConnected || syncActionPending || isSyncActive
  const totalActivitiesAllTime = Number(overview?.allTime?.totalActivities || 0)
  const hasOverviewData = totalActivitiesAllTime > 0
  const statusBarSyncLabel = isSyncActive ? getReadableSyncStatus(syncStatus) : getReadableSyncStatus(overviewSyncStatus)
  const statusBarSyncTime = getSyncReferenceTime(syncJob, overviewSyncAt)
  const statusBarActivityCount = getSyncActivityCount(syncJob, overview?.allTime?.totalActivities || 0)

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      pollingGenerationRef.current += 1
      if (pollingTimeoutRef.current) {
        window.clearTimeout(pollingTimeoutRef.current)
        pollingTimeoutRef.current = null
      }
      if (pollingAbortControllerRef.current) {
        pollingAbortControllerRef.current.abort()
        pollingAbortControllerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')

    if (connected === '1') {
      setMessage({ type: 'success', text: 'Kết nối Strava thành công.' })
      navigate(location.pathname, { replace: true })
    } else if (error === '1') {
      setMessage({ type: 'danger', text: 'Kết nối Strava không thành công.' })
      navigate(location.pathname, { replace: true })
    }
  }, [location.pathname, location.search, navigate])

  useEffect(() => {
    syncJobRef.current = syncJob || null
  }, [syncJob])

  useEffect(() => {
    loadStatus()
    loadOverview()
    loadActivities(1)
    loadCurrentSyncJob()
  }, [])

  useEffect(() => {
    loadTrends()
  }, [trendRange, trendGroupBy, trendMetric])

  useEffect(() => {
    loadYearly()
  }, [])

  useEffect(() => {
    loadRecords()
  }, [recordSportType])

  useEffect(() => {
    loadTopActivities()
  }, [topSortBy, topYear, recordSportType])

  useEffect(() => {
    loadYearlyRecords()
    loadMilestones()
  }, [])

  useEffect(() => {
    if (!isStravaConnected) {
      stopSyncPolling()
      setSyncJob(null)
      setSyncError('')
      setSyncJobLoading(false)
      setInsights(createDefaultInsightsData())
      setInsightsError('')
      setInsightsLoading(false)
      return
    }
    loadInsights()
  }, [isStravaConnected, insightRange, insightSportType])

  function setIfMounted(action) {
    if (mountedRef.current) action()
  }

  function clearSyncPollingTimer() {
    if (pollingTimeoutRef.current) {
      window.clearTimeout(pollingTimeoutRef.current)
      pollingTimeoutRef.current = null
    }
  }

  function abortSyncPollingRequest() {
    if (pollingAbortControllerRef.current) {
      pollingAbortControllerRef.current.abort()
      pollingAbortControllerRef.current = null
    }
  }

  function stopSyncPolling() {
    pollingGenerationRef.current += 1
    clearSyncPollingTimer()
    abortSyncPollingRequest()
    pollingFailureCountRef.current = 0
    setIfMounted(() => setIsPolling(false))
  }

  async function refreshDashboardAfterSync() {
    await Promise.all([
      loadStatus(),
      loadOverview(),
      loadYearly(),
      loadTrends(),
      loadInsights(),
      loadRecords(),
      loadTopActivities(),
      loadYearlyRecords(),
      loadMilestones(),
      loadActivities(1),
    ])
    setIfMounted(() => setLastDashboardRefreshAt(new Date().toISOString()))
  }

  async function handleSyncJobTransition(nextJob, previousJob, source = 'manual') {
    if (!nextJob) return

    const previousStatus = String(previousJob?.status || '').trim()
    const nextStatus = String(nextJob?.status || '').trim()
    const nextRecentReadyAt = String(nextJob?.recentReadyAt || '').trim()
    const recentReadyKey = nextRecentReadyAt ? `${nextJob.id}:${nextRecentReadyAt}` : ''
    const terminalKey = `${nextJob.id}:${nextStatus}:${nextJob.finishedAt || ''}`

    if (source === 'load') {
      if (recentReadyKey) recentReadyHandledRef.current = recentReadyKey
      if (nextStatus === 'completed') completedHandledRef.current = terminalKey
      if (nextStatus === 'failed') failedHandledRef.current = terminalKey
      if (nextStatus === 'cancelled') cancelledHandledRef.current = terminalKey
      return
    }

    if (nextStatus === 'partial_ready' && recentReadyKey && recentReadyHandledRef.current !== recentReadyKey) {
      recentReadyHandledRef.current = recentReadyKey
      await refreshDashboardAfterSync()
      if (source === 'poll') {
        setIfMounted(() => setMessage({ type: 'info', text: 'Dữ liệu gần đây từ Strava đã sẵn sàng. Hệ thống đang tiếp tục hoàn thiện số liệu.' }))
      }
    }

    if (nextStatus === 'completed' && completedHandledRef.current !== terminalKey) {
      completedHandledRef.current = terminalKey
      stopSyncPolling()
      await refreshDashboardAfterSync()
      setIfMounted(() => {
        setMessage({ type: 'success', text: 'Đồng bộ Strava hoàn tất.' })
        setSyncError('')
      })
      return
    }

    if (nextStatus === 'failed' && failedHandledRef.current !== terminalKey) {
      failedHandledRef.current = terminalKey
      stopSyncPolling()
      setIfMounted(() => {
        setMessage({ type: 'danger', text: nextJob?.lastErrorMessage || 'Đồng bộ chưa hoàn tất. Bạn có thể thử lại.' })
        setSyncError(nextJob?.lastErrorMessage || '')
      })
      return
    }

    if (nextStatus === 'cancelled' && cancelledHandledRef.current !== terminalKey) {
      cancelledHandledRef.current = terminalKey
      stopSyncPolling()
      setIfMounted(() => {
        setMessage({ type: 'info', text: 'Đã hủy đồng bộ Strava. Dữ liệu đã đồng bộ trước khi hủy vẫn được giữ lại.' })
        setSyncError('')
      })
      return
    }

    if (source === 'poll' && previousStatus !== nextStatus && TERMINAL_SYNC_JOB_STATUSES.has(nextStatus) === false) {
      setIfMounted(() => setSyncError(''))
    }
  }

  async function applySyncJobSnapshot(job, source = 'manual') {
    const requestId = ++pollingRequestSequenceRef.current
    const previousJob = syncJobRef.current

    if (!mountedRef.current) return
    setSyncJob(job || null)
    syncJobRef.current = job || null
    setSyncError('')

    if (requestId !== pollingRequestSequenceRef.current) return

    if (!job || !isActiveSyncJob(job)) {
      if (!job) stopSyncPolling()
      else if (TERMINAL_SYNC_JOB_STATUSES.has(String(job.status || '').trim())) stopSyncPolling()
    }

    await handleSyncJobTransition(job, previousJob, source)
  }

  function scheduleNextSyncPoll(generation) {
    clearSyncPollingTimer()
    pollingTimeoutRef.current = window.setTimeout(() => {
      runSyncPolling(generation)
    }, STRAVA_SYNC_POLL_INTERVAL)
  }

  async function runSyncPolling(generation) {
    if (!mountedRef.current || generation !== pollingGenerationRef.current) return

    abortSyncPollingRequest()
    const controller = new AbortController()
    pollingAbortControllerRef.current = controller

    try {
      const response = await getCurrentStravaSyncJob({ signal: controller.signal })
      if (!mountedRef.current || generation !== pollingGenerationRef.current) return

      pollingFailureCountRef.current = 0
      await applySyncJobSnapshot(response?.data || null, 'poll')

      if (!response?.data || !isActiveSyncJob(response.data)) {
        setIfMounted(() => setIsPolling(false))
        return
      }

      scheduleNextSyncPoll(generation)
    } catch (error) {
      if (controller.signal.aborted || !mountedRef.current || generation !== pollingGenerationRef.current) return

      const normalizedMessage = getApiErrorMessage(error, 'Không thể cập nhật trạng thái đồng bộ Strava.')
      const status = Number(error?.status || error?.response?.status || 0)
      pollingFailureCountRef.current += 1

      if (status === 401 || status === 403) {
        stopSyncPolling()
        setIfMounted(() => setSyncError(normalizedMessage))
        return
      }

      setIfMounted(() => setSyncError(normalizedMessage))

      if (pollingFailureCountRef.current >= 3) {
        stopSyncPolling()
        return
      }

      scheduleNextSyncPoll(generation)
    } finally {
      if (pollingAbortControllerRef.current === controller) {
        pollingAbortControllerRef.current = null
      }
    }
  }

  function startSyncPolling() {
    const generation = pollingGenerationRef.current + 1
    pollingGenerationRef.current = generation
    clearSyncPollingTimer()
    abortSyncPollingRequest()
    pollingFailureCountRef.current = 0
    setIfMounted(() => setIsPolling(true))
    scheduleNextSyncPoll(generation)
  }

  async function loadCurrentSyncJob(options = {}) {
    const { silent = false, signal } = options

    if (!silent) setIfMounted(() => setSyncJobLoading(true))

    try {
      const response = await getCurrentStravaSyncJob({ signal })
      if (!mountedRef.current) return null

      await applySyncJobSnapshot(response?.data || null, 'load')

      if (response?.data && isActiveSyncJob(response.data)) {
        startSyncPolling()
      }

      return response
    } catch (error) {
      if (signal?.aborted) return null

      const status = Number(error?.status || error?.response?.status || 0)
      const messageText = getApiErrorMessage(error, 'Không thể tải trạng thái đồng bộ Strava.')

      if (status === 401 || status === 403 || status === 404) {
        stopSyncPolling()
      }

      setIfMounted(() => setSyncError(messageText))
      return null
    } finally {
      if (!silent) setIfMounted(() => setSyncJobLoading(false))
    }
  }

  async function loadStatus() {
    setIfMounted(() => setStatusLoading(true))
    try {
      const response = await getStravaStatus()
      setIfMounted(() => setStravaStatus(response || {
        connected: false,
        status: 'DISCONNECTED',
        athleteFirstname: null,
        athleteLastname: null,
        profileUrl: null,
        lastSyncAt: null,
        lastSyncStatus: 'NEVER',
      }))
    } catch (error) {
      setIfMounted(() => setMessage({ type: 'danger', text: getApiErrorMessage(error, 'Không tải được trạng thái kết nối Strava.') }))
    } finally {
      setIfMounted(() => setStatusLoading(false))
    }
  }

  async function loadOverview() {
    setIfMounted(() => setOverviewLoading(true))
    try {
      const response = await getStravaAnalyticsOverview()
      if (response) setIfMounted(() => setOverview(response))
    } catch (error) {
      setIfMounted(() => setMessage((current) => current.text ? current : { type: 'danger', text: getApiErrorMessage(error, 'Không tải được tổng quan Strava.') }))
    } finally {
      setIfMounted(() => setOverviewLoading(false))
    }
  }

  async function loadTrends() {
    setIfMounted(() => setTrendsLoading(true))
    try {
      const response = await getStravaAnalyticsTrends({ range: trendRange, groupBy: trendGroupBy, metric: trendMetric })
      setIfMounted(() => setTrends(response || { metric: trendMetric, groupBy: trendGroupBy, items: [] }))
    } catch (error) {
      setIfMounted(() => {
        setMessage((current) => current.text ? current : { type: 'danger', text: getApiErrorMessage(error, 'Không tải được xu hướng tập luyện.') })
        setTrends({ metric: trendMetric, groupBy: trendGroupBy, items: [] })
      })
    } finally {
      setIfMounted(() => setTrendsLoading(false))
    }
  }

  async function loadYearly() {
    setIfMounted(() => setYearlyLoading(true))
    try {
      const response = await getStravaAnalyticsYearly()
      setIfMounted(() => setYearly(response || { items: [] }))
    } catch (error) {
      setIfMounted(() => {
        setMessage((current) => current.text ? current : { type: 'danger', text: getApiErrorMessage(error, 'Không tải được thống kê theo năm.') })
        setYearly({ items: [] })
      })
    } finally {
      setIfMounted(() => setYearlyLoading(false))
    }
  }

  async function loadInsights() {
    setIfMounted(() => {
      setInsightsLoading(true)
      setInsightsError('')
    })
    try {
      const response = await getStravaAnalyticsInsights({ range: insightRange, sportType: insightSportType })
      setIfMounted(() => setInsights(response || createDefaultInsightsData()))
    } catch (error) {
      setIfMounted(() => {
        setInsights(createDefaultInsightsData())
        setInsightsError(getApiErrorMessage(error, 'Không tải được insight luyện tập.'))
      })
    } finally {
      setIfMounted(() => setInsightsLoading(false))
    }
  }

  async function loadActivities(page = 1) {
    setIfMounted(() => setActivitiesLoading(true))
    try {
      const response = await getStravaActivities({ page, pageSize: pagination.pageSize, sort: 'startDate:desc' })
      setIfMounted(() => {
        setActivities(Array.isArray(response?.items) ? response.items : [])
        setPagination(response?.pagination || { page: 1, pageSize: pagination.pageSize, pageCount: 1, total: 0 })
      })
    } catch (error) {
      setIfMounted(() => {
        setMessage((current) => current.text ? current : { type: 'danger', text: getApiErrorMessage(error, 'Không tải được danh sách hoạt động.') })
        setActivities([])
      })
    } finally {
      setIfMounted(() => setActivitiesLoading(false))
    }
  }

  async function loadRecords() {
    setIfMounted(() => setRecordsLoading(true))
    try {
      const response = await getStravaAnalyticsRecords({ sportType: recordSportType })
      setIfMounted(() => setRecords(response || { records: {} }))
    } catch (error) {
      setIfMounted(() => {
        setMessage((current) => current.text ? current : { type: 'danger', text: getApiErrorMessage(error, 'Không tải được các kỷ lục cá nhân.') })
        setRecords({ records: {} })
      })
    } finally {
      setIfMounted(() => setRecordsLoading(false))
    }
  }

  async function loadTopActivities() {
    try {
      const response = await getStravaAnalyticsTopActivities({ sortBy: topSortBy, sportType: recordSportType, year: topYear || undefined, limit: 10 })
      setIfMounted(() => setTopActivities(response || { sortBy: topSortBy, items: [] }))
    } catch (error) {
      setIfMounted(() => {
        setMessage((current) => current.text ? current : { type: 'danger', text: getApiErrorMessage(error, 'Không tải được hoạt động nổi bật.') })
        setTopActivities({ sortBy: topSortBy, items: [] })
      })
    }
  }

  async function loadYearlyRecords() {
    try {
      const response = await getStravaAnalyticsYearlyRecords()
      setIfMounted(() => setYearlyRecords(response || { items: [] }))
    } catch (error) {
      setIfMounted(() => {
        setMessage((current) => current.text ? current : { type: 'danger', text: getApiErrorMessage(error, 'Không tải được thành tích theo năm.') })
        setYearlyRecords({ items: [] })
      })
    }
  }

  async function loadMilestones() {
    try {
      const response = await getStravaAnalyticsMilestones()
      setIfMounted(() => setMilestones(response || {
        distance: { currentValue: 0, achieved: [], next: null },
        activities: { currentValue: 0, achieved: [], next: null },
        activeDays: { currentValue: 0, achieved: [], next: null },
      }))
    } catch (error) {
      setIfMounted(() => {
        setMessage((current) => current.text ? current : { type: 'danger', text: getApiErrorMessage(error, 'Không tải được cột mốc cá nhân.') })
        setMilestones({
          distance: { currentValue: 0, achieved: [], next: null },
          activities: { currentValue: 0, achieved: [], next: null },
          activeDays: { currentValue: 0, achieved: [], next: null },
        })
      })
    }
  }

  async function reloadFitnessData() {
    await refreshDashboardAfterSync()
  }

  async function handleConnectStrava() {
    if (connectLoading) return
    setIfMounted(() => {
      setConnectLoading(true)
      setMessage({ type: '', text: '' })
    })
    try {
      const response = await createStravaConnectUrl()
      const url = String(response?.url || '').trim()
      if (!url) throw new Error('Không nhận được URL kết nối Strava')
      window.location.href = url
    } catch (error) {
      setIfMounted(() => {
        setMessage({ type: 'danger', text: getApiErrorMessage(error, 'Không thể khởi tạo kết nối Strava.') })
        setConnectLoading(false)
      })
    }
  }

  async function handleDisconnectStrava() {
    if (disconnectLoading) return
    const confirmed = window.confirm('Bạn có chắc muốn ngắt kết nối Strava? Các thành tích đã đồng bộ trước đây vẫn được giữ lại.')
    if (!confirmed) return
    setIfMounted(() => {
      setDisconnectLoading(true)
      setMessage({ type: '', text: '' })
    })
    try {
      await disconnectStrava()
      stopSyncPolling()
      setIfMounted(() => {
        setSyncJob(null)
        setSyncError('')
      })
      await reloadFitnessData()
      setIfMounted(() => setMessage({ type: 'success', text: 'Đã ngắt kết nối Strava.' }))
    } catch (error) {
      setIfMounted(() => setMessage({ type: 'danger', text: getApiErrorMessage(error, 'Không thể ngắt kết nối Strava.') }))
    } finally {
      setIfMounted(() => setDisconnectLoading(false))
    }
  }

  async function handleSyncStrava() {
    if (syncStarting || isSyncActive) return
    setIfMounted(() => {
      setSyncStarting(true)
      setMessage({ type: '', text: '' })
      setSyncError('')
    })
    try {
      const result = await startStravaSync()
      await applySyncJobSnapshot(result?.data || null, 'start')
      if (result?.data && isActiveSyncJob(result.data)) startSyncPolling()
      setIfMounted(() => setMessage({ type: 'success', text: result?.message || 'Đã gửi yêu cầu đồng bộ Strava.' }))
    } catch (error) {
      const text = getApiErrorMessage(error, 'Không thể đồng bộ thành tích Strava.')
      setIfMounted(() => {
        setSyncError(text)
        setMessage({ type: 'danger', text: Number(error?.status || error?.response?.status || 0) === 401 ? `${text} Vui lòng kết nối lại Strava.` : text })
      })
    } finally {
      setIfMounted(() => setSyncStarting(false))
    }
  }

  async function handleRetrySyncJob() {
    if (!syncJob?.id || syncRetrying) return
    setIfMounted(() => {
      setSyncRetrying(true)
      setSyncError('')
    })
    try {
      const result = await retryStravaSyncJob(syncJob.id)
      await applySyncJobSnapshot(result?.data || null, 'retry')
      if (result?.data && isActiveSyncJob(result.data)) startSyncPolling()
      setIfMounted(() => setMessage({ type: 'info', text: result?.message || 'Đã gửi yêu cầu thử lại đồng bộ Strava.' }))
    } catch (error) {
      const text = getApiErrorMessage(error, 'Không thể thử lại đồng bộ Strava.')
      setIfMounted(() => {
        setSyncError(text)
        setMessage({ type: 'danger', text })
      })
    } finally {
      setIfMounted(() => setSyncRetrying(false))
    }
  }

  async function handleCancelSyncJob() {
    if (!syncJob?.id || syncCancelling) return
    const confirmed = window.confirm('Bạn có chắc muốn dừng quá trình đồng bộ? Dữ liệu đã đồng bộ trước khi hủy vẫn được giữ lại.')
    if (!confirmed) return

    stopSyncPolling()
    setIfMounted(() => {
      setSyncCancelling(true)
      setSyncError('')
    })
    try {
      const result = await cancelStravaSyncJob(syncJob.id)
      await applySyncJobSnapshot(result?.data || null, 'cancel')
      setIfMounted(() => setMessage({ type: 'info', text: result?.message || 'Đã hủy đồng bộ Strava.' }))
    } catch (error) {
      const text = getApiErrorMessage(error, 'Không thể hủy đồng bộ Strava.')
      setIfMounted(() => {
        setSyncError(text)
        setMessage({ type: 'danger', text })
      })
      if (isActiveSyncJob(syncJobRef.current)) startSyncPolling()
    } finally {
      setIfMounted(() => setSyncCancelling(false))
    }
  }

  function handleChangeRange(value) {
    setTrendRange(value)
    if (value === '12m') setTrendGroupBy('month')
  }

  function renderStatusBar() {
    return (
      <div className='fitness-page__status-bar'>
        <div className='fitness-page__status-items'>
          <span className='fitness-page__status-chip'>
            <InlineIcon name='link' />
            {isStravaConnected ? 'Strava đã kết nối' : 'Chưa kết nối Strava'}
          </span>
          <span className='fitness-page__status-chip'>
            <InlineIcon name='sync' />
            {statusBarSyncLabel}
          </span>
          <span className='fitness-page__status-chip'>
            <InlineIcon name='activities' />
            {`${formatNumber(statusBarActivityCount)} hoạt động`}
          </span>
          <span className='fitness-page__status-chip'>
            <InlineIcon name='clock' />
            <small>Lần sync</small>
            {formatDateTime(statusBarSyncTime)}
          </span>
        </div>
        {lastDashboardRefreshAt ? (
          <div className='fitness-page__muted-note'>{`Cập nhật dashboard: ${formatDateTime(lastDashboardRefreshAt)}`}</div>
        ) : null}
      </div>
    )
  }

  function renderDashboardHighlights() {
    const emptyHelper = !isStravaConnected
      ? 'Kết nối Strava để bắt đầu.'
      : overviewLoading && !hasOverviewData
        ? 'Đang tải tổng quan.'
        : 'Chờ dữ liệu đồng bộ.'

    return (
      <div className='fitness-page__kpi-grid'>
        <SectionHeader title='Tổng quan' description='Bốn chỉ số quan trọng nhất được đưa lên ngay đầu trang để xem nhanh trong một màn hình.' />
        <CRow className='g-3'>
          <CCol sm={6} xl={3}>
            <SummaryCard
              icon='distance'
              label='Tổng quãng đường'
              value={hasOverviewData ? formatDistanceMeters(overview.allTime.totalDistance) : '—'}
              helper={hasOverviewData ? 'Tích lũy toàn thời gian.' : emptyHelper}
            />
          </CCol>
          <CCol sm={6} xl={3}>
            <SummaryCard
              icon='clock'
              label='Tổng thời gian'
              value={hasOverviewData ? formatDurationSeconds(overview.allTime.totalMovingTime) : '—'}
              helper={hasOverviewData ? 'Moving time toàn bộ lịch sử.' : emptyHelper}
            />
          </CCol>
          <CCol sm={6} xl={3}>
            <SummaryCard
              icon='activities'
              label='Số hoạt động'
              value={hasOverviewData ? formatNumber(overview.allTime.totalActivities) : '—'}
              helper={hasOverviewData ? 'Tổng số hoạt động đã đồng bộ.' : emptyHelper}
            />
          </CCol>
          <CCol sm={6} xl={3}>
            <SummaryCard
              icon='elevation'
              label='Tổng độ cao tích lũy'
              value={hasOverviewData ? formatElevationMeters(overview.allTime.totalElevationGain) : '—'}
              helper={hasOverviewData ? 'Tính theo mét.' : emptyHelper}
            />
          </CCol>
        </CRow>
      </div>
    )
  }

  function renderConnectionCard() {
    const connectionStatusLabel = getConnectionCardStatusLabel({
      connected: isStravaConnected,
      isSyncActive,
      isFailed: isFailed || reconnectRequired,
    })
    const connectionStatusColor = getConnectionCardStatusColor({
      connected: isStravaConnected,
      isSyncActive,
      isFailed: isFailed || reconnectRequired,
    })
    const friendlyConnectionStatus = getReadableConnectionStatus(stravaStatus?.status, isStravaConnected)
    const syncedActivities = Number(overview?.allTime?.totalActivities || 0)

    return (
      <CCard className='fitness-page__panel mb-0'>
        <CCardBody className='fitness-page__panel-body'>
          {statusLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 120 }}>
              <CSpinner size='sm' />
              <span className='text-muted'>Đang tải trạng thái kết nối Strava...</span>
            </div>
          ) : (
            <div className='fitness-page__connection-card'>
              <div className='fitness-page__connection-header'>
                <div className='fitness-page__connection-main'>
                  {isStravaConnected && stravaStatus?.profileUrl ? (
                    <img src={stravaStatus.profileUrl} alt={athleteName || 'Strava athlete'} className='fitness-page__avatar' />
                  ) : (
                    <div className='fitness-page__avatar-placeholder'>
                      {athleteName ? athleteName.slice(0, 1).toUpperCase() : 'S'}
                    </div>
                  )}

                  <div className='fitness-page__connection-text'>
                    <div className='fitness-page__panel-kicker'>
                      <InlineIcon name='link' />
                      Kết nối Strava
                    </div>
                    <h2 className='fitness-page__connection-title'>Kết nối Strava</h2>
                    <div className='fitness-page__connection-description'>Đồng bộ hoạt động để xem thống kê, thành tích và phân tích luyện tập.</div>
                  </div>
                </div>

                <div className='fitness-page__connection-badge-wrap'>
                  <CBadge color={connectionStatusColor} className='fitness-page__connection-badge'>
                    {connectionStatusLabel}
                  </CBadge>
                </div>
              </div>

              <div className='fitness-page__connection-metrics'>
                <div className='fitness-page__connection-metric'>
                  <div className='fitness-page__connection-metric-label'>Trạng thái kết nối</div>
                  <div className='fitness-page__connection-metric-value'>{friendlyConnectionStatus}</div>
                </div>
                <div className='fitness-page__connection-metric'>
                  <div className='fitness-page__connection-metric-label'>Lần đồng bộ gần nhất</div>
                  <div className='fitness-page__connection-metric-value'>{overviewSyncAt ? formatDateTime(overviewSyncAt) : 'Chưa đồng bộ'}</div>
                </div>
                {syncedActivities > 0 ? (
                  <div className='fitness-page__connection-metric'>
                    <div className='fitness-page__connection-metric-label'>Hoạt động đã đồng bộ</div>
                    <div className='fitness-page__connection-metric-value'>{`${formatNumber(syncedActivities)} hoạt động`}</div>
                  </div>
                ) : null}
              </div>

              <div className='fitness-page__actions fitness-page__connection-actions'>
                {!isStravaConnected ? (
                  <CButton color='primary' onClick={handleConnectStrava} disabled={connectLoading || disconnectLoading}>
                    <InlineIcon name='link' />
                    <span>{connectLoading ? 'Đang chuyển hướng...' : 'Kết nối Strava'}</span>
                  </CButton>
                ) : (
                  <>
                    <CButton color='primary' onClick={isFailed && syncJob?.canRetry && !reconnectRequired ? handleRetrySyncJob : handleSyncStrava} disabled={syncButtonDisabled}>
                      <InlineIcon name='sync' />
                      <span>{syncStarting ? 'Đang gửi yêu cầu...' : isFailed && syncJob?.canRetry && !reconnectRequired ? 'Thử đồng bộ lại' : 'Đồng bộ ngay'}</span>
                    </CButton>
                    <CButton color='danger' variant='outline' onClick={handleDisconnectStrava} disabled={disconnectLoading || connectLoading}>
                      <InlineIcon name='link' />
                      <span>{disconnectLoading ? 'Đang ngắt kết nối...' : 'Ngắt kết nối'}</span>
                    </CButton>
                  </>
                )}
              </div>

              <div className='fitness-page__connection-policy'>
                <div className='fitness-page__connection-policy-line'>
                  Khi kết nối Strava, bạn đồng ý với <a href={VKL_RUNNERS_PRIVACY_URL} target='_blank' rel='noreferrer'>Chính sách bảo mật của VKL Runners</a> và <a href={COGI_PRIVACY_URL} target='_blank' rel='noreferrer'>Chính sách bảo mật của nền tảng COGI</a>.
                </div>
                <div className='fitness-page__connection-policy-line'>Hệ thống không lưu mật khẩu Strava và chỉ truy cập dữ liệu trong phạm vi bạn cấp quyền.</div>
              </div>
            </div>
          )}
        </CCardBody>
      </CCard>
    )
  }

  function renderOverviewTab() {
    if (!isStravaConnected) {
      return <EmptyPanel title='Chưa có dữ liệu thành tích' description='Hãy kết nối Strava để đồng bộ hoạt động thể thao của bạn.' />
    }
    if ((overviewLoading || activitiesLoading) && !hasOverviewData) {
      return <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /><span className='text-muted'>Đang tải dữ liệu tổng quan...</span></div>
    }
    if (!hasOverviewData && isSyncActive && syncStatus === 'running') {
      return <EmptyPanel title='Hệ thống đang tải dữ liệu từ Strava' description='Hệ thống đang tải dữ liệu gần đây từ Strava. Bạn có thể tiếp tục ở lại trang này để theo dõi tiến độ đồng bộ.' />
    }
    if (!hasOverviewData && isPartialReady) {
      return <EmptyPanel title='Dữ liệu gần đây đã sẵn sàng' description='Số liệu đang được hoàn thiện. Bảng tổng quan sẽ được cập nhật ngay khi dữ liệu đủ để phân tích.' />
    }
    if (!hasOverviewData) {
      return <EmptyPanel title='Chưa có đủ dữ liệu để phân tích' description='Bạn chưa có đủ dữ liệu để phân tích. Hãy đồng bộ hoạt động từ Strava.' />
    }

    return (
      <div className='d-grid gap-4'>
        <div>
          <SectionHeader title='Nhịp luyện tập' description='Các thống kê mở rộng giúp nhìn nhanh mức độ đều đặn và hiệu suất gần nhất.' />
          <CRow className='g-3'>
            <CCol md={6} xl={4}><SummaryCard icon='recent' label='Hoạt động gần nhất' value={latestActivity ? formatDistanceMeters(latestActivity.distance) : '—'} helper={latestActivity ? `${latestActivity.name || 'Hoạt động'} • ${new Date(latestActivity.startDateLocal || latestActivity.startDate).toLocaleString('vi-VN')}` : '—'} /></CCol>
            <CCol md={6} xl={4}><SummaryCard icon='distance' label='Khoảng cách trung bình / hoạt động' value={overview.allTime.totalActivities ? formatDistanceMeters(overview.allTime.averageDistance) : '—'} helper='Tính từ toàn bộ lịch sử.' /></CCol>
            <CCol md={6} xl={4}><SummaryCard icon='clock' label='Thời gian trung bình / hoạt động' value={overview.allTime.totalActivities ? formatDurationSeconds(overview.allTime.averageMovingTime) : '—'} helper='Tính theo moving time.' /></CCol>
            <CCol md={6} xl={4}><SummaryCard icon='calendar' label='Số ngày có hoạt động' value={formatNumber(overview.allTime.activeDays)} helper='Mỗi ngày chỉ tính một lần.' /></CCol>
            <CCol md={6} xl={4}><SummaryCard icon='streak' label='Chuỗi ngày hiện tại' value={formatNumber(overview.allTime.currentStreak)} helper='Tính theo ngày local của activity.' /></CCol>
            <CCol md={6} xl={4}><SummaryCard icon='challenge' label='Chuỗi dài nhất' value={formatNumber(overview.allTime.longestStreak)} helper='Chuỗi liên tiếp dài nhất toàn lịch sử.' /></CCol>
          </CRow>
        </div>

        <CCard className='fitness-page__panel'>
          <CCardHeader className='bg-white border-0 pb-0'>
            <SectionHeader title='Năm hiện tại' description='Tổng hợp hiệu suất từ đầu năm để so sánh với mục tiêu cá nhân.' />
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3'>
              <CCol sm={6} xl={3}><SummaryCard icon='distance' label='Quãng đường từ đầu năm' value={formatDistanceMeters(overview.currentYear.totalDistance)} /></CCol>
              <CCol sm={6} xl={3}><SummaryCard icon='activities' label='Số hoạt động từ đầu năm' value={formatNumber(overview.currentYear.totalActivities)} /></CCol>
              <CCol sm={6} xl={3}><SummaryCard icon='clock' label='Thời gian từ đầu năm' value={formatDurationSeconds(overview.currentYear.totalMovingTime)} /></CCol>
              <CCol sm={6} xl={3}><SummaryCard icon='elevation' label='Độ cao từ đầu năm' value={formatElevationMeters(overview.currentYear.totalElevationGain)} /></CCol>
            </CRow>
          </CCardBody>
        </CCard>

        <CRow className='g-4'>
          <CCol lg={5}>
            <CCard className='fitness-page__panel h-100'>
              <CCardHeader className='bg-white border-0 pb-0'>
                <SectionHeader title='Môn thể thao' description='Phân bổ hoạt động theo từng môn để thấy trọng tâm luyện tập.' />
              </CCardHeader>
              <CCardBody>
                {(overview.sportBreakdown || []).length === 0 ? <div className='text-muted'>Chưa có dữ liệu môn thể thao.</div> : (
                  <div className='d-grid gap-3'>
                    {overview.sportBreakdown.map((item) => {
                      const total = Number(overview.allTime.totalActivities || 1)
                      const width = Math.max(4, Math.round((Number(item.activityCount || 0) / total) * 100))
                      return (
                        <div key={item.name}>
                          <div className='d-flex justify-content-between small mb-1'>
                            <span>{item.name}</span>
                            <span>{formatNumber(item.activityCount)} hoạt động</span>
                          </div>
                          <div style={{ height: 10, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                            <div style={{ width: `${width}%`, height: '100%', background: '#2563eb' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={7}>
            <CCard className='fitness-page__panel fitness-page__table-card h-100'>
              <CCardHeader className='bg-white border-0 pb-0'>
                <SectionHeader title='Hoạt động gần đây' description='Năm hoạt động mới nhất được giữ ngay trong tầm nhìn, không cần cuộn sâu.' />
              </CCardHeader>
              <CCardBody>
                {recentActivities.length === 0 ? <div className='text-muted'>Chưa có hoạt động gần đây.</div> : (
                  <div className='table-responsive'>
                    <table className='table table-hover align-middle mb-0'>
                      <thead>
                        <tr>
                          <th>Tên hoạt động</th>
                          <th>Môn</th>
                          <th>Ngày giờ</th>
                          <th>Quãng đường</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentActivities.map((activity) => (
                          <tr key={activity.id || activity.stravaActivityId}>
                            <td>{activity.name || 'Hoạt động Strava'}</td>
                            <td>{activity.sportType || activity.type || '-'}</td>
                            <td>{activity.startDate ? new Date(activity.startDate).toLocaleString('vi-VN') : '-'}</td>
                            <td>{formatDistanceMeters(activity.distance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </div>
    )
  }

  function renderTrendsTab() {
    if (!isStravaConnected) {
      return <EmptyPanel title='Chưa có đủ dữ liệu để phân tích' description='Hãy kết nối Strava để xem xu hướng luyện tập.' />
    }
    if (trendsLoading || yearlyLoading) {
      return <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /><span className='text-muted'>Đang tải dữ liệu xu hướng...</span></div>
    }
    if (!(trends.items || []).length && !(yearly.items || []).length) {
      return <EmptyPanel title='Chưa có đủ dữ liệu để phân tích' description='Bạn chưa có đủ dữ liệu để phân tích. Hãy đồng bộ hoạt động từ Strava.' />
    }

    return (
      <div className='d-grid gap-4'>
        <CCard className='fitness-page__panel'>
          <CCardHeader className='bg-white border-0 pb-0'>
            <div className='d-flex flex-wrap gap-3 align-items-end'>
              <div>
                <div className='small text-muted mb-1'>Khoảng thời gian</div>
                <CFormSelect value={trendRange} onChange={(e) => handleChangeRange(e.target.value)}>
                  <option value='12m'>12 tháng gần nhất</option>
                  <option value='current-year'>Năm hiện tại</option>
                  <option value='previous-year'>Năm trước</option>
                  <option value='all'>Toàn bộ lịch sử</option>
                </CFormSelect>
              </div>
              <div>
                <div className='small text-muted mb-1'>Nhóm dữ liệu</div>
                <CFormSelect value={trendGroupBy} onChange={(e) => setTrendGroupBy(e.target.value)} disabled={trendRange === '12m'}>
                  <option value='week'>Theo tuần</option>
                  <option value='month'>Theo tháng</option>
                  <option value='year'>Theo năm</option>
                </CFormSelect>
              </div>
              <div>
                <div className='small text-muted mb-1'>Chỉ số</div>
                <CFormSelect value={trendMetric} onChange={(e) => setTrendMetric(e.target.value)}>
                  <option value='distance'>Quãng đường</option>
                  <option value='activities'>Số hoạt động</option>
                  <option value='movingTime'>Thời gian</option>
                  <option value='elevation'>Độ cao</option>
                </CFormSelect>
              </div>
            </div>
          </CCardHeader>
          <CCardBody>
            {(trends.items || []).length === 0 ? <div className='text-muted'>Chưa có dữ liệu xu hướng.</div> : (
              <div className='fitness-page__chart'>
                <ResponsiveContainer>
                  <AreaChart data={trends.items} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id='fitnessTrend' x1='0' y1='0' x2='0' y2='1'>
                        <stop offset='5%' stopColor='#2563eb' stopOpacity={0.28} />
                        <stop offset='95%' stopColor='#2563eb' stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray='3 3' stroke='#e2e8f0' />
                    <XAxis dataKey='label' tick={{ fontSize: 12 }} interval='preserveStartEnd' />
                    <YAxis tickFormatter={(value) => trendMetric === 'distance' ? formatNumber(Math.round((Number(value || 0) / 1000) * 10) / 10) : formatNumber(value)} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => formatTrendValue(trendMetric, value)} labelFormatter={(label) => `Kỳ: ${label}`} />
                    <Area type='monotone' dataKey='value' stroke='#2563eb' fill='url(#fitnessTrend)' strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CCardBody>
        </CCard>

        <CCard className='fitness-page__panel fitness-page__table-card'>
          <CCardHeader className='bg-white border-0 pb-0'><div style={{ fontSize: 18, fontWeight: 700 }}>Lịch sử nhiều năm</div></CCardHeader>
          <CCardBody>
            {(yearly.items || []).length === 0 ? <div className='text-muted'>Chưa có dữ liệu theo năm.</div> : (
              <div className='table-responsive'>
                <table className='table table-hover align-middle'>
                  <thead>
                    <tr>
                      <th>Năm</th>
                      <th>Quãng đường</th>
                      <th>Thời gian</th>
                      <th>Số hoạt động</th>
                      <th>Độ cao</th>
                      <th>Quãng đường TB / hoạt động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearly.items.map((item) => (
                      <tr key={item.year} style={{ cursor: 'pointer' }} onClick={() => { setTrendRange(item.year === new Date().getUTCFullYear() ? 'current-year' : item.year === new Date().getUTCFullYear() - 1 ? 'previous-year' : 'all'); setTrendGroupBy('month') }}>
                        <td>{item.year}</td>
                        <td>{formatDistanceMeters(item.totalDistance)}</td>
                        <td>{formatDurationSeconds(item.totalMovingTime)}</td>
                        <td>{formatNumber(item.totalActivities)}</td>
                        <td>{formatElevationMeters(item.totalElevationGain)}</td>
                        <td>{formatDistanceMeters(item.averageDistance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CCardBody>
        </CCard>
      </div>
    )
  }

  function renderActivitiesTab() {
    if (!isStravaConnected) {
      return <EmptyPanel title='Chưa có dữ liệu thành tích' description='Hãy kết nối Strava để đồng bộ hoạt động thể thao của bạn.' />
    }
    if (activitiesLoading && activities.length === 0) {
      return <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /><span className='text-muted'>Đang tải hoạt động...</span></div>
    }
    if (activities.length === 0 && isSyncActive) {
      return <EmptyPanel title='Đang tải hoạt động từ Strava' description='Hệ thống đang tải dữ liệu hoạt động. Nội dung sẽ xuất hiện tại đây ngay khi có dữ liệu gần đây.' />
    }
    if (activities.length === 0) {
      return <EmptyPanel title='Chưa có dữ liệu thành tích' description='Bạn chưa có hoạt động nào được đồng bộ từ Strava.' />
    }

    return (
      <CCard className='fitness-page__panel fitness-page__table-card'>
        <CCardHeader className='bg-white border-0 pb-0'><div style={{ fontSize: 18, fontWeight: 700 }}>Danh sách hoạt động</div></CCardHeader>
        <CCardBody>
          <div className='table-responsive'>
            <table className='table table-hover align-middle'>
              <thead>
                <tr>
                  <th>Tên hoạt động</th>
                  <th>Môn thể thao</th>
                  <th>Ngày giờ</th>
                  <th>Quãng đường</th>
                  <th>Thời gian vận động</th>
                  <th>Độ cao tích lũy</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity) => (
                  <tr key={activity.id || activity.stravaActivityId}>
                    <td>{activity.name || 'Hoạt động Strava'}</td>
                    <td>{activity.sportType || activity.type || '-'}</td>
                    <td>{activity.startDate ? new Date(activity.startDate).toLocaleString('vi-VN') : '-'}</td>
                    <td>{formatDistanceMeters(activity.distance)}</td>
                    <td>{formatDurationSeconds(activity.movingTime)}</td>
                    <td>{activity.totalElevationGain ? formatElevationMeters(activity.totalElevationGain) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className='d-flex justify-content-between align-items-center mt-3'>
            <div className='small text-muted'>Tổng: {formatNumber(pagination.total || 0)} hoạt động</div>
            <div className='d-flex gap-2 align-items-center'>
              <CButton size='sm' color='secondary' variant='outline' disabled={(pagination.page || 1) <= 1 || activitiesLoading} onClick={() => loadActivities((pagination.page || 1) - 1)}>Trang trước</CButton>
              <span className='small'>Trang {pagination.page || 1}/{pagination.pageCount || 1}</span>
              <CButton size='sm' color='secondary' variant='outline' disabled={(pagination.page || 1) >= (pagination.pageCount || 1) || activitiesLoading} onClick={() => loadActivities((pagination.page || 1) + 1)}>Trang sau</CButton>
            </div>
          </div>
        </CCardBody>
      </CCard>
    )
  }

  function renderComparisonValue(change, formatter) {
    if (!change) return '—'
    return (
      <div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{formatter(change.currentValue)}</div>
        <div className='small text-secondary'>So với kỳ trước: {formatDelta(change.delta, formatter)} ({formatChangePercent(change.percent)})</div>
      </div>
    )
  }

  function renderInsightsTab() {
    if (!isStravaConnected) {
      return <EmptyPanel title='Chưa có dữ liệu insight' description='Hãy kết nối Strava để xem thói quen và nhịp luyện tập của bạn.' />
    }
    if (insightsLoading) {
      return <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /><span className='text-muted'>Đang tải insight luyện tập...</span></div>
    }
    if (insightsError) {
      return <EmptyPanel title='Không tải được insight' description={insightsError} />
    }

    const weekdayItems = Array.isArray(insights?.weekday?.items) ? insights.weekday.items : []
    const timeOfDayItems = Array.isArray(insights?.timeOfDay?.items) ? insights.timeOfDay.items : []
    const distanceDistributionItems = Array.isArray(insights?.distanceDistribution?.items) ? insights.distanceDistribution.items : []
    const durationDistributionItems = Array.isArray(insights?.durationDistribution?.items) ? insights.durationDistribution.items : []
    const sportDistributionItems = Array.isArray(insights?.sportDistribution?.items) ? insights.sportDistribution.items : []
    const statements = Array.isArray(insights?.statements) ? insights.statements : []
    const hasData = weekdayItems.length > 0 || timeOfDayItems.length > 0 || statements.length > 0

    if (!hasData) {
      return <EmptyPanel title='Chưa có đủ dữ liệu để tạo insight' description='Hãy đồng bộ thêm hoạt động Strava để hệ thống nhận diện thói quen luyện tập.' />
    }

    return (
      <div className='d-grid gap-4'>
        <CCard className='fitness-page__panel'>
          <CCardHeader className='bg-white border-0 pb-0'>
            <div className='d-flex flex-wrap gap-3 align-items-end justify-content-between'>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Bộ lọc insight</div>
              <div className='d-flex gap-3 flex-wrap'>
                <div>
                  <div className='small text-muted mb-1'>Khoảng thời gian</div>
                  <CFormSelect value={insightRange} onChange={(e) => setInsightRange(e.target.value)}>
                    <option value='30d'>30 ngày gần nhất</option>
                    <option value='90d'>90 ngày gần nhất</option>
                    <option value='12m'>12 tháng gần nhất</option>
                    <option value='current-year'>Năm hiện tại</option>
                    <option value='all'>Toàn bộ lịch sử</option>
                  </CFormSelect>
                </div>
                <div>
                  <div className='small text-muted mb-1'>Môn thể thao</div>
                  <CFormSelect value={insightSportType} onChange={(e) => setInsightSportType(e.target.value)}>
                    <option value='all'>Tất cả</option>
                    <option value='run'>Chạy bộ</option>
                    <option value='ride'>Đạp xe</option>
                    <option value='walk'>Đi bộ</option>
                    <option value='other'>Khác</option>
                  </CFormSelect>
                </div>
              </div>
            </div>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3'>
              <CCol md={6} xl={3}><SummaryCard icon='calendar' label='Ngày hoạt động nổi bật' value={insights?.weekday?.topWeekday?.label || '—'} helper={insights?.weekday?.topWeekday ? `${formatNumber(insights.weekday.topWeekday.activityCount)} hoạt động` : '—'} /></CCol>
              <CCol md={6} xl={3}><SummaryCard icon='clock' label='Khung giờ quen thuộc' value={insights?.timeOfDay?.topPeriod?.label || '—'} helper={insights?.timeOfDay?.topPeriod ? `${formatNumber(insights.timeOfDay.topPeriod.activityCount)} hoạt động` : '—'} /></CCol>
              <CCol md={6} xl={3}><SummaryCard icon='activities' label='Tần suất trung bình' value={`${formatNumber(insights?.frequency?.averageActivitiesPerWeek || 0, { minimumFractionDigits: 0, maximumFractionDigits: 1 })} buổi/tuần`} helper={`${formatNumber(insights?.frequency?.averageActiveDaysPerWeek || 0, { minimumFractionDigits: 0, maximumFractionDigits: 1 })} ngày hoạt động/tuần`} /></CCol>
              <CCol md={6} xl={3}><SummaryCard icon='streak' label='Điểm đều đặn' value={`${formatNumber(insights?.consistency?.score || 0)}/100`} helper={insights?.consistency?.level || '—'} /></CCol>
            </CRow>
          </CCardBody>
        </CCard>

        <CRow className='g-4'>
          <CCol lg={7}>
            <CCard className='fitness-page__panel h-100'>
              <CCardHeader className='bg-white border-0 pb-0'><div style={{ fontSize: 18, fontWeight: 700 }}>Thói quen theo ngày trong tuần</div></CCardHeader>
              <CCardBody>
                <div className='fitness-page__chart'>
                  <ResponsiveContainer>
                    <BarChart data={weekdayItems} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray='3 3' stroke='#e2e8f0' />
                      <XAxis dataKey='label' tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor='end' height={60} />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip formatter={(value) => [formatNumber(value), 'Hoạt động']} />
                      <Bar dataKey='activityCount' fill='#2563eb' radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className='d-flex flex-wrap gap-4 mt-3 small text-secondary'>
                  <div>Ngày mạnh nhất: {insights?.weekday?.topWeekday?.label || '—'}</div>
                  <div>Tỷ lệ cuối tuần: {formatPercent(insights?.weekday?.weekendRate || 0)}</div>
                  <div>Ngày ít hoạt động nhất: {insights?.weekday?.leastWeekday?.label || '—'}</div>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={5}>
            <CCard className='fitness-page__panel h-100'>
              <CCardHeader className='bg-white border-0 pb-0'><div style={{ fontSize: 18, fontWeight: 700 }}>Thói quen theo thời điểm trong ngày</div></CCardHeader>
              <CCardBody>
                <div className='d-grid gap-3'>
                  {timeOfDayItems.map((item) => {
                    const maxCount = Math.max(1, ...timeOfDayItems.map((entry) => Number(entry.activityCount || 0)))
                    const width = Math.max(6, Math.round((Number(item.activityCount || 0) / maxCount) * 100))
                    return (
                      <div key={item.key}>
                        <div className='d-flex justify-content-between small mb-1'>
                          <span>{item.label}</span>
                          <span>{formatNumber(item.activityCount)} hoạt động</span>
                        </div>
                        <div style={{ height: 10, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                          <div style={{ width: `${width}%`, height: '100%', background: '#0f766e' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className='small text-secondary mt-3'>
                  Khung giờ quãng đường trung bình cao nhất: {insights?.timeOfDay?.bestDistancePeriod?.label || '—'}
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>

        <CRow className='g-4'>
          <CCol lg={6}>
            <CCard className='fitness-page__panel h-100'>
              <CCardHeader className='bg-white border-0 pb-0'><div style={{ fontSize: 18, fontWeight: 700 }}>Tần suất và mức độ đều đặn</div></CCardHeader>
              <CCardBody>
                <CRow className='g-3'>
                  <CCol sm={6}><SummaryCard icon='calendar' label='Tuần có hoạt động' value={formatNumber(insights?.frequency?.activeWeeks || 0)} helper={`${formatPercent(insights?.frequency?.activeWeekRate || 0)} số tuần trong kỳ`} /></CCol>
                  <CCol sm={6}><SummaryCard icon='distance' label='Quãng đường trung bình / tuần' value={formatDistanceMeters(insights?.frequency?.averageDistancePerWeek || 0)} helper={formatDurationSeconds(insights?.frequency?.averageMovingTimePerWeek || 0)} /></CCol>
                </CRow>
                <div className='mt-3'>
                  <div className='small text-muted mb-1'>Điểm đều đặn</div>
                  <div style={{ height: 12, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.max(0, Math.min(100, Number(insights?.consistency?.score || 0)))}%`, height: '100%', background: '#f59e0b' }} />
                  </div>
                  <div className='small text-secondary mt-2'>{insights?.consistency?.description || '—'}</div>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={6}>
            <CCard className='fitness-page__panel h-100'>
              <CCardHeader className='bg-white border-0 pb-0'><div style={{ fontSize: 18, fontWeight: 700 }}>So sánh 30 ngày gần đây</div></CCardHeader>
              <CCardBody>
                <CRow className='g-3'>
                  <CCol sm={6}>{renderComparisonValue(insights?.recentComparison?.changes?.totalActivities, (value) => formatNumber(value))}</CCol>
                  <CCol sm={6}>{renderComparisonValue(insights?.recentComparison?.changes?.totalDistance, (value) => formatDistanceMeters(value))}</CCol>
                  <CCol sm={6}>{renderComparisonValue(insights?.recentComparison?.changes?.activeDays, (value) => formatNumber(value))}</CCol>
                  <CCol sm={6}>{renderComparisonValue(insights?.recentComparison?.changes?.averageDistancePerActivity, (value) => formatDistanceMeters(value))}</CCol>
                </CRow>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>

        <CRow className='g-4'>
          <CCol lg={6}>
            <CCard className='fitness-page__panel h-100'>
              <CCardHeader className='bg-white border-0 pb-0'><div style={{ fontSize: 18, fontWeight: 700 }}>Phân bố quãng đường</div></CCardHeader>
              <CCardBody>
                <div className='fitness-page__chart'>
                  <ResponsiveContainer>
                    <BarChart data={distanceDistributionItems} layout='vertical' margin={{ top: 8, right: 12, left: 28, bottom: 0 }}>
                      <CartesianGrid strokeDasharray='3 3' stroke='#e2e8f0' />
                      <XAxis type='number' tick={{ fontSize: 12 }} allowDecimals={false} />
                      <YAxis type='category' dataKey='label' tick={{ fontSize: 12 }} width={120} />
                      <Tooltip formatter={(value) => [formatNumber(value), 'Hoạt động']} />
                      <Bar dataKey='activityCount' fill='#1d4ed8' radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={6}>
            <CCard className='fitness-page__panel h-100'>
              <CCardHeader className='bg-white border-0 pb-0'><div style={{ fontSize: 18, fontWeight: 700 }}>Phân bố thời lượng</div></CCardHeader>
              <CCardBody>
                <div className='fitness-page__chart'>
                  <ResponsiveContainer>
                    <BarChart data={durationDistributionItems} layout='vertical' margin={{ top: 8, right: 12, left: 28, bottom: 0 }}>
                      <CartesianGrid strokeDasharray='3 3' stroke='#e2e8f0' />
                      <XAxis type='number' tick={{ fontSize: 12 }} allowDecimals={false} />
                      <YAxis type='category' dataKey='label' tick={{ fontSize: 12 }} width={120} />
                      <Tooltip formatter={(value) => [formatNumber(value), 'Hoạt động']} />
                      <Bar dataKey='activityCount' fill='#0f766e' radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>

        <CRow className='g-4'>
          <CCol lg={5}>
            <CCard className='fitness-page__panel h-100'>
              <CCardHeader className='bg-white border-0 pb-0'><div style={{ fontSize: 18, fontWeight: 700 }}>Cơ cấu môn thể thao</div></CCardHeader>
              <CCardBody>
                {sportDistributionItems.length === 0 ? <div className='text-muted'>Chưa có dữ liệu môn thể thao.</div> : (
                  <div className='d-grid gap-3'>
                    {sportDistributionItems.map((item) => {
                      const total = Math.max(1, sportDistributionItems.reduce((sum, entry) => sum + Number(entry.activityCount || 0), 0))
                      const width = Math.max(6, Math.round((Number(item.activityCount || 0) / total) * 100))
                      return (
                        <div key={item.key}>
                          <div className='d-flex justify-content-between small mb-1'>
                            <span>{item.label}</span>
                            <span>{formatNumber(item.activityCount)} hoạt động</span>
                          </div>
                          <div style={{ height: 10, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
                            <div style={{ width: `${width}%`, height: '100%', background: '#9333ea' }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={7}>
            <CCard className='fitness-page__panel h-100'>
              <CCardHeader className='bg-white border-0 pb-0'><div style={{ fontSize: 18, fontWeight: 700 }}>Insight tự động</div></CCardHeader>
              <CCardBody>
                {statements.length === 0 ? <div className='text-muted'>Chưa có đủ dữ liệu để tạo insight tự động.</div> : (
                  <div className='d-grid gap-3'>
                    {statements.map((statement, index) => (
                      <div key={`${index}-${statement}`} style={{ borderRadius: 14, background: '#f8fafc', border: '1px solid #e2e8f0', padding: 14 }}>
                        <div style={{ fontWeight: 600 }}>{statement}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </div>
    )
  }

  function formatSpeedKmh(value) {
    const speed = Number(value || 0)
    if (!Number.isFinite(speed) || speed <= 0) return '—'
    return `${formatNumber(speed, { minimumFractionDigits: 0, maximumFractionDigits: 1 })} km/h`
  }

  function formatPace(secondsPerKm) {
    const totalSeconds = Number(secondsPerKm || 0)
    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '—'
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = Math.round(totalSeconds % 60)
    return `${formatNumber(minutes)}:${String(seconds).padStart(2, '0')}/km`
  }

  function renderRecordCard(title, value, helper, action = null) {
    return (
      <CCard className='fitness-page__summary-card'>
        <CCardBody>
          <div className='small text-muted mb-1'>{title}</div>
          <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>{value || '—'}</div>
          {helper ? <div className='small text-secondary mt-2'>{helper}</div> : <div className='small text-secondary mt-2'>—</div>}
          {action ? <div className='mt-3'>{action}</div> : null}
        </CCardBody>
      </CCard>
    )
  }

  function renderRecordsTab() {
    if (!isStravaConnected) {
      return <EmptyPanel title='Chưa có đủ dữ liệu để xác định thành tích cá nhân.' description='Hãy kết nối Strava và đồng bộ hoạt động để xem các kỷ lục cá nhân.' />
    }
    if (recordsLoading) {
      return <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /><span className='text-muted'>Đang tải dữ liệu thành tích...</span></div>
    }
    if (!overview?.allTime?.totalActivities) {
      return <EmptyPanel title='Chưa có đủ dữ liệu để xác định thành tích cá nhân.' description='Bạn chưa có đủ dữ liệu để xác định thành tích cá nhân.' />
    }

    const recordSet = records?.records || {}
    const topItems = Array.isArray(topActivities?.items) ? topActivities.items : []
    const yearlyItems = Array.isArray(yearlyRecords?.items) ? yearlyRecords.items : []

    return (
      <div className='d-grid gap-4'>
        <div>
          <div className='d-flex flex-wrap gap-3 align-items-end mb-3'>
            <div>
              <div className='small text-muted mb-1'>Nhóm môn thể thao</div>
              <CFormSelect value={recordSportType} onChange={(e) => setRecordSportType(e.target.value)}>
                <option value='all'>Tất cả</option>
                <option value='run'>Chạy bộ</option>
                <option value='ride'>Đạp xe</option>
                <option value='walk'>Đi bộ</option>
              </CFormSelect>
            </div>
          </div>
          <CRow className='g-3'>
            <CCol md={6} xl={3}>{renderRecordCard('Hoạt động dài nhất', recordSet.longestDistance?.activity ? formatDistanceMeters(recordSet.longestDistance.value) : '—', recordSet.longestDistance?.activity ? `${recordSet.longestDistance.activity.name || 'Hoạt động'} • ${new Date(recordSet.longestDistance.activity.startDateLocal || recordSet.longestDistance.activity.startDate).toLocaleString('vi-VN')}` : '—', recordSet.longestDistance?.activity ? <CButton size='sm' color='secondary' variant='outline' onClick={() => setSelectedActivityDetail(recordSet.longestDistance.activity)}>Xem hoạt động</CButton> : null)}</CCol>
            <CCol md={6} xl={3}>{renderRecordCard('Thời gian vận động dài nhất', recordSet.longestMovingTime?.activity ? formatDurationSeconds(recordSet.longestMovingTime.value) : '—', recordSet.longestMovingTime?.activity ? `${recordSet.longestMovingTime.activity.name || 'Hoạt động'} • ${recordSet.longestMovingTime.activity.sportType || '—'}` : '—', recordSet.longestMovingTime?.activity ? <CButton size='sm' color='secondary' variant='outline' onClick={() => setSelectedActivityDetail(recordSet.longestMovingTime.activity)}>Xem hoạt động</CButton> : null)}</CCol>
            <CCol md={6} xl={3}>{renderRecordCard('Độ cao tích lũy lớn nhất', recordSet.highestElevation?.activity ? formatElevationMeters(recordSet.highestElevation.value) : '—', recordSet.highestElevation?.activity ? `${recordSet.highestElevation.activity.name || 'Hoạt động'} • ${recordSet.highestElevation.activity.sportType || '—'}` : '—', recordSet.highestElevation?.activity ? <CButton size='sm' color='secondary' variant='outline' onClick={() => setSelectedActivityDetail(recordSet.highestElevation.activity)}>Xem hoạt động</CButton> : null)}</CCol>
            <CCol md={6} xl={3}>{renderRecordCard('Tốc độ trung bình cao nhất', recordSet.highestAverageSpeed?.activity ? formatSpeedKmh(recordSet.highestAverageSpeed.value) : '—', recordSet.highestAverageSpeed?.activity ? `${recordSet.highestAverageSpeed.activity.name || 'Hoạt động'} • ${recordSet.highestAverageSpeed.activity.sportType || '—'}` : '—', recordSet.highestAverageSpeed?.activity ? <CButton size='sm' color='secondary' variant='outline' onClick={() => setSelectedActivityDetail(recordSet.highestAverageSpeed.activity)}>Xem hoạt động</CButton> : null)}</CCol>
            <CCol md={6} xl={3}>{renderRecordCard('Ngày có tổng quãng đường lớn nhất', recordSet.bestDay?.date ? formatDistanceMeters(recordSet.bestDay.distance) : '—', recordSet.bestDay?.date ? `${new Date(`${recordSet.bestDay.date}T00:00:00`).toLocaleDateString('vi-VN')} • ${formatNumber(recordSet.bestDay.activityCount)} hoạt động` : '—')}</CCol>
            <CCol md={6} xl={3}>{renderRecordCard('Tuần có tổng quãng đường lớn nhất', recordSet.bestWeek?.weekStart ? formatDistanceMeters(recordSet.bestWeek.distance) : '—', recordSet.bestWeek?.weekStart ? `${new Date(`${recordSet.bestWeek.weekStart}T00:00:00`).toLocaleDateString('vi-VN')} - ${new Date(`${recordSet.bestWeek.weekEnd}T00:00:00`).toLocaleDateString('vi-VN')}` : '—')}</CCol>
            <CCol md={6} xl={3}>{renderRecordCard('Tháng có tổng quãng đường lớn nhất', recordSet.bestMonth?.year ? formatDistanceMeters(recordSet.bestMonth.distance) : '—', recordSet.bestMonth?.year ? `Tháng ${recordSet.bestMonth.month}/${recordSet.bestMonth.year} • ${formatNumber(recordSet.bestMonth.activityCount)} hoạt động` : '—')}</CCol>
            <CCol md={6} xl={3}>{renderRecordCard('Năm có tổng quãng đường lớn nhất', recordSet.bestYear?.year ? formatDistanceMeters(recordSet.bestYear.distance) : '—', recordSet.bestYear?.year ? `Năm ${recordSet.bestYear.year} • ${formatNumber(recordSet.bestYear.activityCount)} hoạt động` : '—')}</CCol>
          </CRow>
        </div>

        <CCard className='fitness-page__panel fitness-page__table-card'>
          <CCardHeader className='bg-white border-0 pb-0'>
            <div className='d-flex flex-wrap gap-3 align-items-end justify-content-between'>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Hoạt động nổi bật</div>
              <div className='d-flex gap-3 flex-wrap'>
                <div>
                  <div className='small text-muted mb-1'>Tiêu chí</div>
                  <CFormSelect value={topSortBy} onChange={(e) => setTopSortBy(e.target.value)}>
                    <option value='distance'>Quãng đường</option>
                    <option value='movingTime'>Thời gian</option>
                    <option value='elevation'>Độ cao</option>
                    <option value='averageSpeed'>Tốc độ trung bình</option>
                  </CFormSelect>
                </div>
                <div>
                  <div className='small text-muted mb-1'>Năm</div>
                  <CFormSelect value={topYear} onChange={(e) => setTopYear(e.target.value)}>
                    <option value=''>Tất cả</option>
                    {yearlyItems.map((item) => <option key={item.year} value={item.year}>{item.year}</option>)}
                  </CFormSelect>
                </div>
              </div>
            </div>
          </CCardHeader>
          <CCardBody>
            {topItems.length === 0 ? <div className='text-muted'>Chưa có hoạt động nổi bật phù hợp.</div> : (
              <div className='table-responsive'>
                <table className='table table-hover align-middle'>
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Tên hoạt động</th>
                      <th>Loại</th>
                      <th>Quãng đường</th>
                      <th>Thời gian</th>
                      <th>Pace / Tốc độ</th>
                      <th>Độ cao</th>
                      <th>Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topItems.map((item) => {
                      const sportGroup = item.sportGroup || 'other'
                      const paceOrSpeed = sportGroup === 'ride' ? formatSpeedKmh(item.averageSpeed) : formatPace(item.paceSecondsPerKm)
                      return (
                        <tr key={item.id}>
                          <td>{item.startDate ? new Date(item.startDate).toLocaleDateString('vi-VN') : '—'}</td>
                          <td>{item.name || 'Hoạt động Strava'}</td>
                          <td>{item.sportType || '—'}</td>
                          <td>{formatDistanceMeters(item.distance)}</td>
                          <td>{formatDurationSeconds(item.movingTime)}</td>
                          <td>{paceOrSpeed}</td>
                          <td>{item.totalElevationGain > 0 ? formatElevationMeters(item.totalElevationGain) : '—'}</td>
                          <td><CButton size='sm' color='secondary' variant='outline' onClick={() => setSelectedActivityDetail(item)}>Xem chi tiết</CButton></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CCardBody>
        </CCard>

        <CCard className='fitness-page__panel fitness-page__table-card'>
          <CCardHeader className='bg-white border-0 pb-0'><div style={{ fontSize: 18, fontWeight: 700 }}>Thành tích theo năm</div></CCardHeader>
          <CCardBody>
            {yearlyItems.length === 0 ? <div className='text-muted'>Chưa có dữ liệu theo năm.</div> : (
              <div className='table-responsive'>
                <table className='table table-hover align-middle'>
                  <thead>
                    <tr>
                      <th>Năm</th>
                      <th>Hoạt động dài nhất</th>
                      <th>Thời gian dài nhất</th>
                      <th>Elevation lớn nhất</th>
                      <th>Ngày nhiều km nhất</th>
                      <th>Tháng nhiều km nhất</th>
                      <th>Tổng số kỷ lục</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearlyItems.map((item) => (
                      <tr key={item.year} style={{ cursor: 'pointer' }} onClick={() => setTopYear(String(item.year))}>
                        <td>{item.year}</td>
                        <td>{item.longestDistance ? formatDistanceMeters(item.longestDistance.distance) : '—'}</td>
                        <td>{item.longestMovingTime ? formatDurationSeconds(item.longestMovingTime.movingTime) : '—'}</td>
                        <td>{item.highestElevation ? formatElevationMeters(item.highestElevation.totalElevationGain) : '—'}</td>
                        <td>{item.bestDay?.distance ? `${formatDistanceMeters(item.bestDay.distance)} • ${new Date(`${item.bestDay.date}T00:00:00`).toLocaleDateString('vi-VN')}` : '—'}</td>
                        <td>{item.bestMonth?.distance ? `${formatDistanceMeters(item.bestMonth.distance)} • ${item.bestMonth.month}/${item.bestMonth.year}` : '—'}</td>
                        <td>{formatNumber(item.recordCount || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CCardBody>
        </CCard>

        <CCard className='fitness-page__panel'>
          <CCardHeader className='bg-white border-0 pb-0'><div style={{ fontSize: 18, fontWeight: 700 }}>Cột mốc cá nhân</div></CCardHeader>
          <CCardBody>
            <CRow className='g-3'>
              <CCol md={4}>
                <MilestoneCard title='Quãng đường tích lũy' unit='km' milestone={milestones.distance} />
              </CCol>
              <CCol md={4}>
                <MilestoneCard title='Số hoạt động' unit='hoạt động' milestone={milestones.activities} />
              </CCol>
              <CCol md={4}>
                <MilestoneCard title='Số ngày hoạt động' unit='ngày' milestone={milestones.activeDays} />
              </CCol>
            </CRow>
            <div className='small text-muted mt-3'>Kỷ lục theo cự ly 5K, 10K và bán marathon sẽ được bổ sung khi có dữ liệu phân đoạn phù hợp.</div>
          </CCardBody>
        </CCard>

        <CModal visible={!!selectedActivityDetail} onClose={() => setSelectedActivityDetail(null)}>
          <CModalHeader closeButton>
            <CModalTitle>Chi tiết hoạt động</CModalTitle>
          </CModalHeader>
          <CModalBody>
            {selectedActivityDetail ? (
              <div className='d-grid gap-2'>
                <div><strong>Tên:</strong> {selectedActivityDetail.name || 'Hoạt động Strava'}</div>
                <div><strong>Ngày:</strong> {selectedActivityDetail.startDate ? new Date(selectedActivityDetail.startDate).toLocaleString('vi-VN') : '—'}</div>
                <div><strong>Loại:</strong> {selectedActivityDetail.sportType || '—'}</div>
                <div><strong>Quãng đường:</strong> {formatDistanceMeters(selectedActivityDetail.distance)}</div>
                <div><strong>Moving time:</strong> {formatDurationSeconds(selectedActivityDetail.movingTime)}</div>
                <div><strong>Elapsed time:</strong> {selectedActivityDetail.elapsedTime ? formatDurationSeconds(selectedActivityDetail.elapsedTime) : '—'}</div>
                <div><strong>Độ cao:</strong> {selectedActivityDetail.totalElevationGain > 0 ? formatElevationMeters(selectedActivityDetail.totalElevationGain) : '—'}</div>
                <div><strong>Pace / Tốc độ:</strong> {(selectedActivityDetail.sportGroup || 'other') === 'ride' ? formatSpeedKmh(selectedActivityDetail.averageSpeed) : formatPace(selectedActivityDetail.paceSecondsPerKm)}</div>
                {selectedActivityDetail.stravaActivityId ? <div><strong>Strava ID:</strong> {selectedActivityDetail.stravaActivityId}</div> : null}
              </div>
            ) : null}
          </CModalBody>
        </CModal>
      </div>
    )
  }

  function MilestoneCard({ title, unit, milestone }) {
    const achieved = Array.isArray(milestone?.achieved) ? milestone.achieved : []
    const next = milestone?.next || null
    const currentValue = Number(milestone?.currentValue || 0)
    return (
      <CCard className='h-100 border-0 bg-light'>
        <CCardBody>
          <div className='small text-muted mb-1'>{title}</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{formatNumber(currentValue)} {unit}</div>
          <div className='small text-secondary mt-2'>Đã đạt: {achieved.length ? achieved.map((item) => formatNumber(item)).join(', ') : 'Chưa có'}</div>
          {next ? (
            <div className='mt-3'>
              <div className='small text-muted'>Tiếp theo: {formatNumber(next.target)} {unit}</div>
              <div className='small text-muted'>{formatNumber(currentValue)} / {formatNumber(next.target)} {unit}</div>
              <div style={{ height: 10, borderRadius: 999, background: '#e2e8f0', overflow: 'hidden', marginTop: 8 }}>
                <div style={{ width: `${Math.min(100, Math.max(0, Number(next.progress || 0) * 100))}%`, height: '100%', background: '#2563eb' }} />
              </div>
            </div>
          ) : null}
        </CCardBody>
      </CCard>
    )
  }

  return (
    <CContainer fluid className='fitness-page py-4'>
      <div className='fitness-page__hero'>
        <div className='fitness-page__hero-copy'>
          <div className='fitness-page__eyebrow'>
            <InlineIcon name='dashboard' />
            Dashboard thể thao
          </div>
          <div className='d-flex flex-wrap align-items-center gap-2 mb-2'>
            <h1 className='fitness-page__title'>Thể thao</h1>
            <CBadge color='info' shape='rounded-pill'>Beta</CBadge>
          </div>
          <div className='fitness-page__description'>Khu vực dành cho người dùng đã đăng nhập để kết nối ứng dụng thể thao, theo dõi thành tích cá nhân và tham gia challenge tại {tenantName}.</div>
        </div>
      </div>

      {message.text ? <CAlert color={message.type || 'info'}>{message.text}</CAlert> : null}
      {renderStatusBar()}

      <div className='fitness-page__compact-grid'>
        {renderConnectionCard()}
        <StravaSyncStatusCard
          job={syncJob}
          loading={syncJobLoading}
          polling={isPolling}
          error={syncError}
          syncCancelling={syncCancelling}
          syncRetrying={syncRetrying}
          onRetry={handleRetrySyncJob}
          onCancel={handleCancelSyncJob}
          onReconnect={handleConnectStrava}
          fallbackActivityCount={overview?.allTime?.totalActivities || 0}
          fallbackSyncAt={overviewSyncAt}
          fallbackStatus={overviewSyncStatus}
        />
      </div>

      {renderDashboardHighlights()}

      <div className='fitness-page__tabs-wrap'>
        <CNav variant='tabs' className='fitness-page__tabs'>
        {TAB_ITEMS.map((tab) => (
          <CNavItem key={tab.key}>
            <CNavLink active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>
              <InlineIcon name={tab.icon} />
              {tab.label}
            </CNavLink>
          </CNavItem>
        ))}
        </CNav>
      </div>

      <CTabContent>
        <CTabPane visible={activeTab === 'overview'}>{renderOverviewTab()}</CTabPane>
        <CTabPane visible={activeTab === 'trends'}>{renderTrendsTab()}</CTabPane>
        <CTabPane visible={activeTab === 'records'}>{renderRecordsTab()}</CTabPane>
        <CTabPane visible={activeTab === 'insights'}>{renderInsightsTab()}</CTabPane>
        <CTabPane visible={activeTab === 'activities'}>{renderActivitiesTab()}</CTabPane>
        <CTabPane visible={activeTab === 'challenge'}><PlaceholderTab text='Các challenge thể thao sẽ được bổ sung ở bước tiếp theo.' /></CTabPane>
      </CTabContent>
    </CContainer>
  )
}
