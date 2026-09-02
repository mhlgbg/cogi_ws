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
import { getApiMessage, getPlatformStravaWebhookEventDetail } from '../services/platformApi'

function formatDateTime(value) {
  const timestamp = Date.parse(String(value || ''))
  if (Number.isNaN(timestamp)) return '-'
  return new Date(timestamp).toLocaleString('vi-VN')
}

function getStatusBadge(status, lastError) {
  const normalized = String(status || '').trim().toLowerCase()
  const errorText = String(lastError || '').trim().toLowerCase()
  if (normalized === 'ignored' && (errorText.includes('duplicate') || errorText.includes('idempotency'))) {
    return { color: 'info', label: 'Duplicate' }
  }
  if (normalized === 'pending') return { color: 'secondary', label: 'Pending' }
  if (normalized === 'processing') return { color: 'primary', label: 'Processing' }
  if (normalized === 'processed') return { color: 'success', label: 'Processed' }
  if (normalized === 'ignored') return { color: 'warning', label: 'Ignored' }
  if (normalized === 'dead_letter') return { color: 'dark', label: 'Dead Letter' }
  return { color: 'danger', label: 'Failed' }
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

export default function StravaWebhookEventDetailPage() {
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
        const nextDetail = await getPlatformStravaWebhookEventDetail(id)
        if (cancelled) return
        setDetail(nextDetail)
      } catch (requestError) {
        if (cancelled) return
        setDetail(null)
        setError(getApiMessage(requestError, 'Khong tai duoc chi tiet webhook event'))
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

  const statusBadge = useMemo(() => getStatusBadge(detail?.status, detail?.lastError), [detail?.lastError, detail?.status])

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
          <h2 className="mb-1">Webhook Event Detail</h2>
          <p className="text-body-secondary mb-0">Chi tiet event webhook Strava.</p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <CButton color="secondary" variant="outline" onClick={() => navigate('/platform/integrations/strava?tab=webhook-events')}>
            Back to Webhook Events
          </CButton>
          <CButton color="secondary" variant="outline" onClick={() => copyText(detail?.eventId, 'Copied event id')} disabled={!detail?.eventId}>
            Copy Event Id
          </CButton>
          <CButton color="secondary" variant="outline" onClick={() => copyText(detail?.objectId, 'Copied object id')} disabled={!detail?.objectId}>
            Copy Object Id
          </CButton>
        </div>
      </div>

      {copyMessage ? <CAlert color="info" className="mb-3">{copyMessage}</CAlert> : null}
      {error ? <CAlert color="danger" className="mb-3">{error}</CAlert> : null}

      {loading ? (
        <div className="d-flex justify-content-center align-items-center py-5">
          <CSpinner className="me-2" />
          <span>Dang tai chi tiet webhook event...</span>
        </div>
      ) : null}

      {!loading && detail ? (
        <CRow className="g-4">
          <CCol xs={12} xl={5}>
            <CCard className="border-0 shadow-sm h-100">
              <CCardHeader className="bg-white d-flex justify-content-between align-items-center">
                <strong>Event</strong>
                <CBadge color={statusBadge.color}>{statusBadge.label}</CBadge>
              </CCardHeader>
              <CCardBody>
                <DetailField label="Event Id" value={String(detail.eventId || '-')} />
                <DetailField label="Event Time" value={formatDateTime(detail.eventTime)} />
                <DetailField label="Tenant" value={detail?.tenant ? `${detail.tenant.name} (ID ${detail.tenant.id})` : '-'} />
                <DetailField label="Connection" value={detail?.connection ? `${detail.connection.athleteName} (ID ${detail.connection.id})` : '-'} />
                <DetailField label="User" value={detail?.user ? `${detail.user.name}${detail.user.email ? ` - ${detail.user.email}` : ''}` : '-'} />
                <DetailField label="Object" value={`${detail.objectType || '-'}${detail.objectId ? ` / ${detail.objectId}` : ''}`} />
                <DetailField label="Aspect" value={detail.aspectType || '-'} />
                <DetailField label="Attempts" value={String(detail.attempts || 0)} />
                <DetailField label="Claimed By" value={detail.claimedBy || '-'} />
                <DetailField label="Claimed At" value={formatDateTime(detail.claimedAt)} />
                <DetailField label="Processed At" value={formatDateTime(detail.processedAt)} />
                <DetailField label="Next Retry" value={formatDateTime(detail.nextAttemptAt)} />
                <DetailField label="Subscription Id" value={detail.subscriptionId ? String(detail.subscriptionId) : '-'} />
                <DetailField label="Owner Id" value={detail.ownerId || '-'} />
                <DetailField label="Last Error" value={detail.lastError || '-'} preWrap />
              </CCardBody>
            </CCard>
          </CCol>
          <CCol xs={12} xl={7}>
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
            <CCard className="border-0 shadow-sm mb-4">
              <CCardHeader className="bg-white">
                <strong>Correlation</strong>
              </CCardHeader>
              <CCardBody>
                <pre className="mb-0 small" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '24rem', overflow: 'auto' }}>{safeJson({
                  subscriptionId: detail.subscriptionId || null,
                  ownerId: detail.ownerId || null,
                  objectType: detail.objectType || null,
                  objectId: detail.objectId || null,
                  aspectType: detail.aspectType || null,
                  idempotencyKey: detail.idempotencyKey || null,
                })}</pre>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      ) : null}
    </div>
  )
}