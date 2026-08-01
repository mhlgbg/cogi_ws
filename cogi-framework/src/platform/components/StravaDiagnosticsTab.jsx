import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormLabel,
  CFormSelect,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

function formatDateTime(value) {
  const timestamp = Date.parse(String(value || ''))
  if (Number.isNaN(timestamp)) return '-'
  return new Date(timestamp).toLocaleString('vi-VN')
}

function formatNumber(value) {
  const numeric = Number(value || 0)
  return Number.isFinite(numeric) ? numeric.toLocaleString('vi-VN') : '0'
}

function formatDurationSeconds(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
  const seconds = Math.max(0, Math.round(Number(value)))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainder}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function healthColor(status) {
  if (status === 'healthy') return 'success'
  if (status === 'warning') return 'warning'
  if (status === 'critical') return 'danger'
  return 'secondary'
}

function severityColor(severity) {
  if (severity === 'critical') return 'danger'
  if (severity === 'warning') return 'warning'
  return 'info'
}

function runnerLabel(status) {
  if (status === 'disabled') return 'Disabled'
  if (status === 'active') return 'Active'
  if (status === 'recent_activity') return 'Recent activity'
  if (status === 'no_recent_activity') return 'No recent activity'
  return 'Unknown runtime state'
}

function InfoRow({ label, value, right }) {
  return (
    <div className="d-flex justify-content-between align-items-start gap-3 py-1">
      <span className="text-body-secondary">{label}</span>
      <div className="text-end">
        {right ? <div className="mb-1">{right}</div> : null}
        <strong>{value ?? '-'}</strong>
      </div>
    </div>
  )
}

function SectionCard({ title, children }) {
  return (
    <CCard className="h-100 shadow-sm border-0">
      <CCardHeader className="bg-white border-bottom-0">
        <strong>{title}</strong>
      </CCardHeader>
      <CCardBody>{children}</CCardBody>
    </CCard>
  )
}

function SmallTable({ headers, rows, emptyText = 'Khong co du lieu.' }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return <div className="text-body-secondary small">{emptyText}</div>
  }

  return (
    <div className="table-responsive">
      <CTable small hover className="align-middle mb-0">
        <CTableHead>
          <CTableRow>
            {headers.map((header) => <CTableHeaderCell key={header}>{header}</CTableHeaderCell>)}
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {rows.map((row, index) => (
            <CTableRow key={row.key || index}>
              {row.cells.map((cell, cellIndex) => <CTableDataCell key={`${row.key || index}-${cellIndex}`}>{cell}</CTableDataCell>)}
            </CTableRow>
          ))}
        </CTableBody>
      </CTable>
    </div>
  )
}

function ShortcutList({ links }) {
  const items = [
    ['View Failed Sync Jobs', links?.failedSyncJobs],
    ['View Running Sync Jobs', links?.runningSyncJobs],
    ['View Stale Sync Jobs', links?.staleSyncJobs],
    ['View Dead Letter Webhooks', links?.deadLetterWebhooks],
    ['View Failed Webhooks', links?.failedWebhooks],
    ['View Processing Webhooks', links?.processingWebhooks],
    ['View Revoked Connections', links?.revokedConnections],
    ['View Stale Connections', links?.staleConnections],
    ['View Subscription', links?.subscription],
  ].filter((item) => item[1])

  return (
    <div className="d-flex flex-wrap gap-2">
      {items.map(([label, href]) => (
        <a key={label} href={href} className="btn btn-outline-secondary btn-sm">{label}</a>
      ))}
    </div>
  )
}

export default function StravaDiagnosticsTab({ data, loading, error, window, onWindowChange, onRefresh }) {
  const warnings = Array.isArray(data?.warnings) ? data.warnings : []
  const isEmpty = data
    && Number(data?.connections?.total || 0) === 0
    && Number(data?.webhookQueue?.pending || 0) === 0
    && Number(data?.webhookQueue?.processing || 0) === 0
    && Number(data?.syncQueue?.queued || 0) === 0
    && Number(data?.syncQueue?.running || 0) === 0
    && Number(data?.syncQueue?.partialReady || 0) === 0
    && warnings.length === 0

  if (loading && !data) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <CSpinner className="me-2" />
        <span>Dang tai diagnostics...</span>
      </div>
    )
  }

  if (error && !data) {
    return <CAlert color="danger">{error}</CAlert>
  }

  if (!loading && !error && !data) {
    return <CAlert color="info">Khong co diagnostics snapshot.</CAlert>
  }

  return (
    <div className="d-flex flex-column gap-4">
      <CCard className="shadow-sm border-0">
        <CCardBody>
          <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 align-items-lg-center">
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
                <CBadge color={healthColor(data?.health?.status)} className="fs-6 px-3 py-2 text-uppercase">
                  {String(data?.health?.status || 'unknown')}
                </CBadge>
                <span className="fw-semibold">Diagnostics & Maintenance</span>
              </div>
              <div className="text-body-secondary small">Generated at {formatDateTime(data?.generatedAt)}</div>
            </div>

            <div className="d-flex flex-column flex-sm-row gap-2 align-items-sm-end">
              <div>
                <CFormLabel htmlFor="strava-diagnostics-window" className="small text-body-secondary mb-1">Window</CFormLabel>
                <CFormSelect id="strava-diagnostics-window" value={window} onChange={(event) => onWindowChange?.(event.target.value)} disabled={loading}>
                  <option value="24h">24h</option>
                  <option value="7d">7d</option>
                  <option value="30d">30d</option>
                </CFormSelect>
              </div>
              <CButton color="primary" onClick={onRefresh} disabled={loading}>
                {loading ? <CSpinner size="sm" className="me-2" /> : null}
                Refresh Diagnostics
              </CButton>
            </div>
          </div>

          {Array.isArray(data?.health?.reasons) && data.health.reasons.length > 0 ? (
            <div className="d-flex flex-wrap gap-2 mt-3">
              {data.health.reasons.map((item) => (
                <CBadge key={`${item.code}-${item.severity}`} color={severityColor(item.severity)}>{item.code}</CBadge>
              ))}
            </div>
          ) : null}
        </CCardBody>
      </CCard>

      {error && data ? <CAlert color="warning">{error}</CAlert> : null}
      {isEmpty ? <CAlert color="info">Chua co connection, queue, stale item hoac warning nao trong snapshot hien tai.</CAlert> : null}

      <CRow className="g-4">
        <CCol xs={12} xl={6}>
          <SectionCard title="Runtime">
            {[
              ['Webhook Runner', data?.runners?.webhookRunner],
              ['Webhook Handler', data?.runners?.webhookHandler],
              ['Sync Runner', data?.runners?.syncRunner],
              ['Subscription Check On Boot', data?.runners?.subscriptionCheckOnBoot],
            ].map(([label, item]) => (
              <div key={label} className="pb-3 mb-3 border-bottom last-child-border-0">
                <div className="d-flex justify-content-between align-items-center mb-2 gap-2">
                  <strong>{label}</strong>
                  <CBadge color={healthColor(item?.enabled ? (item?.alive === true ? 'healthy' : 'warning') : 'unknown')}>{runnerLabel(item?.observedStatus)}</CBadge>
                </div>
                <InfoRow label="Enabled" value={item?.enabled ? 'Yes' : 'No'} />
                <InfoRow label="Alive" value={item?.alive === true ? 'Yes' : item?.alive === false ? 'No' : 'Unknown'} />
                <InfoRow label="Last observed" value={formatDateTime(item?.lastObservedActivityAt)} />
                <InfoRow label="Active items" value={formatNumber(item?.activeItems)} />
                <InfoRow label="Stale items" value={formatNumber(item?.staleItems)} />
              </div>
            ))}
          </SectionCard>
        </CCol>

        <CCol xs={12} xl={6}>
          <SectionCard title="Subscription">
            {data?.subscription?.error ? <CAlert color="warning">{data.subscription.error.message}</CAlert> : null}
            <InfoRow label="Status" value={String(data?.subscription?.status || 'unknown')} right={<CBadge color={healthColor(data?.subscription?.status)}>{String(data?.subscription?.status || 'unknown')}</CBadge>} />
            <InfoRow label="Configured" value={data?.subscription?.configured ? 'Yes' : 'No'} />
            <InfoRow label="Subscription exists" value={data?.subscription?.subscriptionExists ? 'Yes' : 'No'} />
            <InfoRow label="Subscription count" value={formatNumber(data?.subscription?.subscriptionCount)} />
            <InfoRow label="Callback matches" value={data?.subscription?.callbackMatches ? 'Yes' : 'No'} />
            <InfoRow label="Client configured" value={data?.subscription?.clientConfigured ? 'Yes' : 'No'} />
            <InfoRow label="Verify token configured" value={data?.subscription?.verifyTokenConfigured ? 'Yes' : 'No'} />
            <InfoRow label="Callback URL configured" value={data?.subscription?.callbackUrlConfigured ? 'Yes' : 'No'} />
            <InfoRow label="Last checked" value={formatDateTime(data?.subscription?.lastCheckedAt)} />
          </SectionCard>
        </CCol>

        <CCol xs={12} md={6} xl={3}>
          <SectionCard title="Connections">
            <InfoRow label="Total" value={formatNumber(data?.connections?.total)} />
            <InfoRow label="Active" value={formatNumber(data?.connections?.active)} />
            <InfoRow label="Disconnected" value={formatNumber(data?.connections?.disconnected)} />
            <InfoRow label="Error" value={formatNumber(data?.connections?.error)} />
            <InfoRow label="Token expired" value={formatNumber(data?.connections?.tokenExpired)} />
            <InfoRow label="Token expiring soon" value={formatNumber(data?.connections?.tokenExpiringSoon)} />
            <InfoRow label="Never synced" value={formatNumber(data?.connections?.neverSynced)} />
            <InfoRow label="Stale sync" value={formatNumber(data?.connections?.staleSync)} />
            <InfoRow label="Reconnect recommended" value={formatNumber(data?.connections?.reconnectRecommended)} />
          </SectionCard>
        </CCol>

        <CCol xs={12} md={6} xl={4}>
          <SectionCard title="Webhook Queue">
            <InfoRow label="Pending" value={formatNumber(data?.webhookQueue?.pending)} />
            <InfoRow label="Processing" value={formatNumber(data?.webhookQueue?.processing)} />
            <InfoRow label="Retry waiting" value={formatNumber(data?.webhookQueue?.retryWaiting)} />
            <InfoRow label="Failed" value={formatNumber(data?.webhookQueue?.failed)} />
            <InfoRow label="Dead letter" value={formatNumber(data?.webhookQueue?.deadLetter)} />
            <InfoRow label="Stale processing" value={formatNumber(data?.webhookQueue?.staleProcessing)} />
            <InfoRow label="Oldest pending" value={formatDateTime(data?.webhookQueue?.oldestPendingAt)} />
            <InfoRow label="Latest received" value={formatDateTime(data?.webhookQueue?.latestReceivedAt)} />
            <InfoRow label="Latest processed" value={formatDateTime(data?.webhookQueue?.latestProcessedAt)} />
          </SectionCard>
        </CCol>

        <CCol xs={12} md={6} xl={5}>
          <SectionCard title="Sync Queue">
            <InfoRow label="Queued" value={formatNumber(data?.syncQueue?.queued)} />
            <InfoRow label="Running" value={formatNumber(data?.syncQueue?.running)} />
            <InfoRow label="Partial ready" value={formatNumber(data?.syncQueue?.partialReady)} />
            <InfoRow label="Retry waiting" value={formatNumber(data?.syncQueue?.retryWaiting)} />
            <InfoRow label="Failed" value={formatNumber(data?.syncQueue?.failed)} />
            <InfoRow label="Stale running" value={formatNumber(data?.syncQueue?.staleRunning)} />
            <InfoRow label="Oldest queued" value={formatDateTime(data?.syncQueue?.oldestQueuedAt)} />
            <InfoRow label="Oldest running" value={formatDateTime(data?.syncQueue?.oldestRunningAt)} />
            <InfoRow label="Latest requested" value={formatDateTime(data?.syncQueue?.latestRequestedAt)} />
            <InfoRow label="Latest completed" value={formatDateTime(data?.syncQueue?.latestCompletedAt)} />
          </SectionCard>
        </CCol>

        <CCol xs={12} xl={6}>
          <SectionCard title="Webhook Statistics">
            <InfoRow label="Total" value={formatNumber(data?.webhookStats?.total)} />
            <InfoRow label="Create / Update / Delete" value={`${formatNumber(data?.webhookStats?.create)} / ${formatNumber(data?.webhookStats?.update)} / ${formatNumber(data?.webhookStats?.delete)}`} />
            <InfoRow label="Processed / Ignored / Failed" value={`${formatNumber(data?.webhookStats?.processed)} / ${formatNumber(data?.webhookStats?.ignored)} / ${formatNumber(data?.webhookStats?.failed)}`} />
            <InfoRow label="Dead letter" value={formatNumber(data?.webhookStats?.deadLetter)} />
            <InfoRow label="Average processing" value={formatDurationSeconds(data?.webhookStats?.averageProcessingDurationSeconds)} />
            <InfoRow label="Max processing" value={formatDurationSeconds(data?.webhookStats?.maxProcessingDurationSeconds)} />
            <InfoRow label="Latest event" value={formatDateTime(data?.webhookStats?.latestEventAt)} />
          </SectionCard>
        </CCol>

        <CCol xs={12} xl={6}>
          <SectionCard title="Sync Statistics">
            <InfoRow label="Requested / Completed" value={`${formatNumber(data?.syncStats?.requested)} / ${formatNumber(data?.syncStats?.completed)}`} />
            <InfoRow label="Partial ready / Failed / Cancelled" value={`${formatNumber(data?.syncStats?.partialReady)} / ${formatNumber(data?.syncStats?.failed)} / ${formatNumber(data?.syncStats?.cancelled)}`} />
            <InfoRow label="Processed activities" value={formatNumber(data?.syncStats?.processedActivities)} />
            <InfoRow label="Created / Updated" value={`${formatNumber(data?.syncStats?.createdActivities)} / ${formatNumber(data?.syncStats?.updatedActivities)}`} />
            <InfoRow label="Skipped / Failed activities" value={`${formatNumber(data?.syncStats?.skippedActivities)} / ${formatNumber(data?.syncStats?.failedActivities)}`} />
            <InfoRow label="Average duration" value={formatDurationSeconds(data?.syncStats?.averageDurationSeconds)} />
            <InfoRow label="Max duration" value={formatDurationSeconds(data?.syncStats?.maxDurationSeconds)} />
            <InfoRow label="Latest completed" value={formatDateTime(data?.syncStats?.latestCompletedAt)} />
          </SectionCard>
        </CCol>

        <CCol xs={12} xl={6}>
          <SectionCard title="Stale Webhook Events">
            <div className="small text-body-secondary mb-3">Count: {formatNumber(data?.staleItems?.webhookEvents?.count)}</div>
            <SmallTable
              headers={['Event', 'Tenant', 'Connection', 'Age', 'Link']}
              rows={(data?.staleItems?.webhookEvents?.items || []).map((item) => ({
                key: `webhook-${item.id}`,
                cells: [
                  `${item.id} • ${item.objectType}/${item.aspectType}`,
                  item?.tenant?.name || '-',
                  item?.connection?.athleteName || '-',
                  formatDurationSeconds(item?.ageSeconds),
                  <a href={item.detailUrl}>Open</a>,
                ],
              }))}
              emptyText="Khong co webhook stale item."
            />
          </SectionCard>
        </CCol>

        <CCol xs={12} xl={6}>
          <SectionCard title="Stale Sync Jobs">
            <div className="small text-body-secondary mb-3">Count: {formatNumber(data?.staleItems?.syncJobs?.count)}</div>
            <SmallTable
              headers={['Job', 'Tenant', 'Connection', 'Age', 'Link']}
              rows={(data?.staleItems?.syncJobs?.items || []).map((item) => ({
                key: `sync-${item.id}`,
                cells: [
                  `${item.id} • ${item.phase || '-'}`,
                  item?.tenant?.name || '-',
                  item?.connection?.athleteName || '-',
                  formatDurationSeconds(item?.ageSeconds),
                  <a href={item.detailUrl}>Open</a>,
                ],
              }))}
              emptyText="Khong co sync stale item."
            />
          </SectionCard>
        </CCol>

        <CCol xs={12} xl={6}>
          <SectionCard title="Error Summary">
            <div className="fw-semibold mb-2">Webhook</div>
            <SmallTable
              headers={['Summary', 'Count']}
              rows={(data?.errors?.webhook?.topLastErrorSummaries || []).map((item, index) => ({ key: `we-${index}`, cells: [item.summary, formatNumber(item.count)] }))}
              emptyText="Khong co webhook error summary."
            />
            <div className="fw-semibold mt-4 mb-2">Sync Jobs</div>
            <SmallTable
              headers={['Summary', 'Count']}
              rows={(data?.errors?.syncJobs?.topLastErrorSummaries || []).map((item, index) => ({ key: `se-${index}`, cells: [item.summary, formatNumber(item.count)] }))}
              emptyText="Khong co sync error summary."
            />
          </SectionCard>
        </CCol>

        <CCol xs={12} xl={6}>
          <SectionCard title="Warnings">
            {warnings.length === 0 ? <div className="text-body-secondary small">Khong co warning rule nao duoc kich hoat.</div> : null}
            <div className="d-flex flex-column gap-2">
              {warnings.map((item) => (
                <div key={`${item.code}-${item.severity}`} className="border rounded px-3 py-2">
                  <div className="d-flex justify-content-between align-items-center gap-2 mb-1">
                    <strong>{item.code}</strong>
                    <CBadge color={severityColor(item.severity)}>{item.severity}</CBadge>
                  </div>
                  <div className="small text-body-secondary">{item.message}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </CCol>

        <CCol xs={12}>
          <SectionCard title="Maintenance Shortcuts">
            <div className="text-body-secondary small mb-3">Read-only dieu huong nhanh den cac man hinh chi tiet da co san.</div>
            <ShortcutList links={data?.links} />
          </SectionCard>
        </CCol>
      </CRow>
    </div>
  )
}