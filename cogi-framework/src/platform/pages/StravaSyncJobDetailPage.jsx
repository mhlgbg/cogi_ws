import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CSpinner,
} from '@coreui/react'
import { getApiMessage, getPlatformStravaSyncJobDetail } from '../services/platformApi'

function formatDateTime(value) {
  const timestamp = Date.parse(String(value || ''))
  if (Number.isNaN(timestamp)) return '-'
  return new Date(timestamp).toLocaleString('vi-VN')
}

function getSyncJobStatusBadge(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'queued') return { color: 'secondary', label: 'Queued' }
  if (normalized === 'running') return { color: 'primary', label: 'Running' }
  if (normalized === 'partial_ready') return { color: 'info', label: 'Partial Ready' }
  if (normalized === 'completed') return { color: 'success', label: 'Completed' }
  if (normalized === 'cancelled') return { color: 'dark', label: 'Cancelled' }
  if (normalized === 'failed') return { color: 'danger', label: 'Failed' }
  return { color: 'warning', label: String(status || 'Unknown') }
}

function DetailField({ label, value, preWrap = false }) {
  return (
    <div className="py-2 border-bottom">
      <div className="small text-body-secondary mb-1">{label}</div>
      <div style={preWrap ? { whiteSpace: 'pre-wrap', wordBreak: 'break-word' } : undefined}>{value || '-'}</div>
    </div>
  )
}

function safeJson(value) {
  try {
    return JSON.stringify(value ?? null, null, 2)
  } catch {
    return String(value || '')
  }
}

export default function StravaSyncJobDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copyMessage, setCopyMessage] = useState('')
  const [detail, setDetail] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadDetail() {
      setLoading(true)
      setError('')

      try {
        const nextDetail = await getPlatformStravaSyncJobDetail(id)
        if (cancelled) return
        setDetail(nextDetail)
      } catch (requestError) {
        if (cancelled) return
        setDetail(null)
        setError(getApiMessage(requestError, 'Khong tai duoc chi tiet sync job'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadDetail()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!copyMessage) return undefined
    const timer = setTimeout(() => setCopyMessage(''), 2000)
    return () => clearTimeout(timer)
  }, [copyMessage])

  const statusBadge = useMemo(() => getSyncJobStatusBadge(detail?.status), [detail?.status])

  async function copyText(value, successText) {
    if (!value) return
    try {
      await navigator.clipboard.writeText(String(value))
      setCopyMessage(successText)
    } catch {
      setCopyMessage('Khong the copy vao clipboard')
    }
  }

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
        <div>
          <h2 className="mb-1">Sync Job Detail</h2>
          <p className="text-body-secondary mb-0">Chi tiet job dong bo Strava.</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <CButton color="secondary" variant="outline" onClick={() => navigate('/platform/integrations/strava?tab=sync-jobs')}>
            Back to Sync Jobs
          </CButton>
          <CButton color="secondary" variant="outline" onClick={() => copyText(detail?.jobId, 'Copied job id')} disabled={!detail?.jobId}>
            Copy Job ID
          </CButton>
          {detail?.connection?.id ? (
            <CButton color="secondary" variant="outline" onClick={() => navigate(`/platform/integrations/strava?tab=sync-jobs&connectionId=${detail.connection.id}`)}>
              Filter by Connection
            </CButton>
          ) : null}
        </div>
      </div>

      {copyMessage ? <CAlert color="info" className="mb-3">{copyMessage}</CAlert> : null}
      {error ? <CAlert color="danger" className="mb-3">{error}</CAlert> : null}

      {loading ? (
        <div className="d-flex justify-content-center align-items-center py-5">
          <CSpinner className="me-2" />
          <span>Dang tai chi tiet sync job...</span>
        </div>
      ) : null}

      {!loading && detail ? (
        <CRow className="g-4">
          <CCol xs={12} xl={5}>
            <CCard className="border-0 shadow-sm h-100">
              <CCardHeader className="bg-white d-flex justify-content-between align-items-center">
                <strong>Job Overview</strong>
                <CBadge color={statusBadge.color}>{statusBadge.label}</CBadge>
              </CCardHeader>
              <CCardBody>
                <DetailField label="Job ID" value={String(detail.jobId || '-')} />
                <DetailField label="Status" value={statusBadge.label} />
                <DetailField label="Phase" value={detail.phase || '-'} />
                <DetailField label="Sync Mode" value={detail.syncMode || '-'} />
                <DetailField label="Requested" value={formatDateTime(detail.requestedAt)} />
                <DetailField label="Started" value={formatDateTime(detail.startedAt)} />
                <DetailField label="Finished" value={formatDateTime(detail.finishedAt)} />
                <DetailField label="Attempts" value={String(detail.attempts || 0)} />
                <DetailField label="Tenant" value={detail?.tenant ? `${detail.tenant.name}${detail.tenant.code ? ` (${detail.tenant.code})` : ''}` : '-'} />
                <DetailField label="User" value={detail?.user ? `${detail.user.name}${detail.user.email ? ` - ${detail.user.email}` : ''}` : '-'} />
                <DetailField label="Athlete" value={detail?.connection ? `${detail.connection.athleteName}${detail.connection.athleteId ? ` (${detail.connection.athleteId})` : ''}` : '-'} />
                <DetailField label="Connection ID" value={detail?.connection?.id ? String(detail.connection.id) : '-'} />
                <DetailField label="Connection Status" value={detail?.connection?.status || '-'} />
              </CCardBody>
            </CCard>
          </CCol>
          <CCol xs={12} xl={7}>
            <CCard className="border-0 shadow-sm mb-4">
              <CCardHeader className="bg-white">
                <strong>Processing</strong>
              </CCardHeader>
              <CCardBody>
                <DetailField label="Claimed At" value={formatDateTime(detail.claimedAt)} />
                <DetailField label="Claimed By" value={detail.claimedBy || '-'} />
                <DetailField label="Heartbeat" value={formatDateTime(detail.heartbeatAt)} />
                <DetailField label="Next Retry" value={formatDateTime(detail.nextRetryAt)} />
                <DetailField label="Current Page" value={String(detail.currentPage || 0)} />
                <DetailField label="Per Page" value={String(detail.perPage || 0)} />
                <DetailField label="Oldest Synced At" value={formatDateTime(detail.oldestSyncedAt)} />
                <DetailField label="Newest Synced At" value={formatDateTime(detail.newestSyncedAt)} />
                <DetailField label="Recent Ready At" value={formatDateTime(detail.recentReadyAt)} />
                <DetailField label="Progress Message" value={detail.progressMessage || '-'} preWrap />
              </CCardBody>
            </CCard>
            <CCard className="border-0 shadow-sm mb-4">
              <CCardHeader className="bg-white">
                <strong>Result</strong>
              </CCardHeader>
              <CCardBody>
                <DetailField label="Processed Activities" value={String(detail.processedActivities || 0)} />
                <DetailField label="Created Activities" value={String(detail.createdActivities || 0)} />
                <DetailField label="Updated Activities" value={String(detail.updatedActivities || 0)} />
                <DetailField label="Skipped Activities" value={String(detail.skippedActivities || 0)} />
                <DetailField label="Failed Activities" value={String(detail.failedActivities || 0)} />
                <DetailField label="Total Activities" value={detail.totalActivities === null ? '-' : String(detail.totalActivities)} />
              </CCardBody>
            </CCard>
            <CCard className="border-0 shadow-sm mb-4">
              <CCardHeader className="bg-white">
                <strong>Error</strong>
              </CCardHeader>
              <CCardBody>
                <DetailField label="Error Code" value={detail.errorCode || '-'} />
                <DetailField label="Last Error" value={detail.lastError || '-'} preWrap />
                <DetailField label="Retryable" value={detail.retryable ? 'Yes' : 'No'} />
                <DetailField label="Cancellable" value={detail.cancellable ? 'Yes' : 'No'} />
              </CCardBody>
            </CCard>
            <CCard className="border-0 shadow-sm mb-4">
              <CCardHeader className="bg-white">
                <strong>Timeline</strong>
              </CCardHeader>
              <CCardBody>
                {Array.isArray(detail.timeline) && detail.timeline.length > 0 ? detail.timeline.map((item) => (
                  <div key={`${item.key}-${item.time || 'none'}`} className="py-2 border-bottom">
                    <div className="d-flex justify-content-between gap-3">
                      <strong>{item.label}</strong>
                      <span className="text-body-secondary small">{formatDateTime(item.time)}</span>
                    </div>
                    {item.note ? <div className="small text-body-secondary mt-1" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{item.note}</div> : null}
                  </div>
                )) : <div className="text-body-secondary">Chua co timeline.</div>}
              </CCardBody>
            </CCard>
            <CCard className="border-0 shadow-sm">
              <CCardHeader className="bg-white">
                <strong>Metadata Summary</strong>
              </CCardHeader>
              <CCardBody>
                <pre className="mb-0 small" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '28rem', overflow: 'auto' }}>{safeJson(detail.metadataSummary)}</pre>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      ) : null}
    </div>
  )
}