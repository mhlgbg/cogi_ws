import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CButton, CFormInput, CSpinner } from '@coreui/react'
import LuckyWheelDisplay from '../components/LuckyWheelDisplay'
import { getLuckyWheelPresentation, getLuckyWheelPresentationStatus, getLuckyWheelPresentationEligibleParticipants, spinPresentationParticipant, updateLuckyWheelParticipant } from '../services/luckyWheelService'
import { useTenant } from '../../../contexts/TenantContext'
import { useFeature } from '../../../contexts/FeatureContext'

function normalizePrizeSegments(prizes) {
  const source = Array.isArray(prizes) ? prizes : []
  return source
    .filter((prize) => prize && prize.isDeleted !== true && prize.isActive !== false)
    .map((prize, index) => ({
      ...prize,
      sortOrder: Number.isFinite(Number(prize.displayOrder)) ? Number(prize.displayOrder) : index,
      resolvedImageUrl: prize.image?.resolvedUrl || prize.image?.url || prize.imageUrl || '',
    }))
    .sort((a, b) => {
      const byOrder = Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
      if (byOrder !== 0) return byOrder
      return Number(a.id || 0) - Number(b.id || 0)
    })
}

function getStatusMeta(status) {
  const normalized = String(status || '').trim().toLowerCase()
  if (normalized === 'opened') return { label: 'Đang mở', bg: '#dcfce7', color: '#166534' }
  if (normalized === 'closed') return { label: 'Đã đóng', bg: '#e5e7eb', color: '#374151' }
  if (normalized === 'cancelled') return { label: 'Đã hủy', bg: '#fee2e2', color: '#991b1b' }
  return { label: 'Nháp', bg: '#fef3c7', color: '#92400e' }
}

function extractResultKey(result) {
  return String(result?.resultKey || result?.prizeDocumentId || result?.prizeId || '')
}

function normalizeFieldConfig(participantFormConfig) {
  const source = Array.isArray(participantFormConfig?.fields) ? participantFormConfig.fields : []
  return source.filter((field) => field && field.enabled)
}

export default function LuckyWheelPresentationPage() {
  const { id } = useParams()
  const tenant = useTenant()
  const feature = useFeature()
  const containerRef = useRef(null)
  const pollTimeoutRef = useRef(null)
  const pollInFlightRef = useRef(false)
  const latestSpinIdRef = useRef(null)
  const flashTimeoutRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pollError, setPollError] = useState('')
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement))
  const [presentation, setPresentation] = useState(null)
  const [latestSpin, setLatestSpin] = useState(null)
  const [statistics, setStatistics] = useState(null)
  const [flashLatest, setFlashLatest] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [isPresentationSpinning, setIsPresentationSpinning] = useState(false)
  const [participantSearch, setParticipantSearch] = useState('')
  const [eligibleParticipants, setEligibleParticipants] = useState([])
  const [participantLoading, setParticipantLoading] = useState(false)
  const [selectedParticipant, setSelectedParticipant] = useState(null)
  const [participantFormValues, setParticipantFormValues] = useState({})
  const [participantFormErrors, setParticipantFormErrors] = useState({})
  const [prepareParticipantLoading, setPrepareParticipantLoading] = useState(false)
  const [presentationReady, setPresentationReady] = useState(false)
  const [spinForParticipantLoading, setSpinForParticipantLoading] = useState(false)
  const [activeRequestId, setActiveRequestId] = useState('')
  const [presentationResult, setPresentationResult] = useState(null)
  const [controlPanelOpen, setControlPanelOpen] = useState(true)
  const pendingSpinRef = useRef(null)

  const normalizedSegments = useMemo(() => normalizePrizeSegments(presentation?.prizes || []), [presentation])
  const participantFieldConfigs = useMemo(() => normalizeFieldConfig(presentation?.wheel?.participantFormConfig), [presentation])
  const highlightResultKey = useMemo(() => extractResultKey(latestSpin?.result), [latestSpin])
  const statusMeta = getStatusMeta(presentation?.wheel?.status)
  const tenantName = presentation?.tenant?.name || tenant?.currentTenant?.tenantName || tenant?.resolvedTenant?.tenantName || 'Tenant'
  const tenantLogo = presentation?.tenant?.logo?.resolvedUrl || presentation?.tenant?.logo?.url || tenant?.currentTenant?.tenantLogoUrl || tenant?.resolvedTenant?.tenantLogoUrl || ''
  const canSpinForParticipant = Boolean(feature?.hasFeature?.('lucky-wheel.manage'))

  function normalizeAngle(angle) {
    let next = Number(angle || 0) % 360
    if (next < 0) next += 360
    return next
  }

  function calculateFinalRotation(targetIndex, currentRotation, segmentCount, extraTurns = 6) {
    if (!Number.isInteger(targetIndex) || targetIndex < 0 || segmentCount <= 0) return currentRotation
    const segmentAngle = 360 / segmentCount
    const pointerAngle = -90
    const svgStartAngle = -90
    const segmentCenterAngle = svgStartAngle + targetIndex * segmentAngle + segmentAngle / 2
    const alignmentRotation = normalizeAngle(pointerAngle - segmentCenterAngle)
    const currentNormalized = normalizeAngle(currentRotation)
    const delta = normalizeAngle(alignmentRotation - currentNormalized)
    return currentRotation + extraTurns * 360 + delta
  }

  function buildSpinRequestId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
    return `presentation-spin-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }

  function buildParticipantFormValues(participant) {
    return {
      participantCode: participant?.participantCode || '',
      fullName: participant?.fullName || '',
      phone: participant?.phone || '',
      email: participant?.email || '',
      className: participant?.className || '',
    }
  }

  function validateParticipantForm(values) {
    const errors = {}
    for (const field of participantFieldConfigs) {
      const key = String(field?.key || '')
      const value = String(values?.[key] || '').trim()
      if (field.required && !value) {
        errors[key] = 'Trường bắt buộc'
      }
      if (key === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors[key] = 'Email không hợp lệ'
      }
      if (field.editable === false && field.required && !value) {
        errors[key] = 'Trường bắt buộc nhưng không được phép sửa'
      }
    }
    return errors
  }

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const resp = await getLuckyWheelPresentation(id)
        if (!mounted) return
        const data = resp?.data || null
        setPresentation(data)
        setLatestSpin(data?.latestSpin || null)
        setStatistics(data?.statistics || null)
        latestSpinIdRef.current = data?.latestSpin?.documentId || data?.latestSpin?.id || null
      } catch (nextError) {
        if (!mounted) return
        setError(String(nextError?.response?.data?.message || nextError?.response?.data?.error || nextError?.message || 'Không tải được màn hình trình chiếu'))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [id])

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    if (!presentation) return undefined
    let cancelled = false

    async function tick() {
      if (cancelled) return
      if (document.visibilityState === 'hidden') {
        pollTimeoutRef.current = window.setTimeout(tick, 4000)
        return
      }
      if (isPresentationSpinning || spinForParticipantLoading) {
        pollTimeoutRef.current = window.setTimeout(tick, 4000)
        return
      }
      if (pollInFlightRef.current) return
      pollInFlightRef.current = true
      try {
        const resp = await getLuckyWheelPresentationStatus(id)
        if (cancelled) return
        const data = resp?.data || null
        if (data?.statistics) setStatistics(data.statistics)
        if (data?.latestSpin) {
          const nextSpinId = data.latestSpin.documentId || data.latestSpin.id || null
          const previousSpinId = latestSpinIdRef.current
          if (nextSpinId && nextSpinId !== previousSpinId) {
            latestSpinIdRef.current = nextSpinId
            setLatestSpin(data.latestSpin)
            setFlashLatest(true)
            if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current)
            flashTimeoutRef.current = window.setTimeout(() => setFlashLatest(false), 1600)
          } else if (!latestSpinIdRef.current && nextSpinId) {
            latestSpinIdRef.current = nextSpinId
            setLatestSpin(data.latestSpin)
          }
        }
        setPollError('')
      } catch {
        if (!cancelled) setPollError('Không thể cập nhật dữ liệu mới nhất, sẽ thử lại.')
      } finally {
        pollInFlightRef.current = false
        if (!cancelled) pollTimeoutRef.current = window.setTimeout(tick, 4000)
      }
    }

    pollTimeoutRef.current = window.setTimeout(tick, 4000)
    return () => {
      cancelled = true
      pollInFlightRef.current = false
      if (pollTimeoutRef.current) window.clearTimeout(pollTimeoutRef.current)
      if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current)
    }
  }, [id, presentation, isPresentationSpinning, spinForParticipantLoading])

  useEffect(() => {
    if (!canSpinForParticipant) return undefined
    let cancelled = false
    const timeout = window.setTimeout(async () => {
      setParticipantLoading(true)
      try {
        const resp = await getLuckyWheelPresentationEligibleParticipants(id, { page: 1, pageSize: 12, search: participantSearch })
        if (cancelled) return
        const items = Array.isArray(resp?.data) ? resp.data : (resp?.data?.data || [])
        setEligibleParticipants(items)
      } catch {
        if (!cancelled) setEligibleParticipants([])
      } finally {
        if (!cancelled) setParticipantLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [id, participantSearch, canSpinForParticipant])

  useEffect(() => {
    setParticipantFormValues(buildParticipantFormValues(selectedParticipant))
    setParticipantFormErrors({})
  }, [selectedParticipant])

  async function handleToggleFullscreen() {
    if (!document.fullscreenEnabled || !containerRef.current) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await containerRef.current.requestFullscreen()
  }

  async function handleSpinForParticipant() {
    if (!selectedParticipant || !presentationReady || spinForParticipantLoading || isPresentationSpinning) return
    const requestId = activeRequestId || buildSpinRequestId()
    setActiveRequestId(requestId)
    setSpinForParticipantLoading(true)
    setPollError('')
    try {
      const resp = await spinPresentationParticipant(id, { participantId: selectedParticipant.id, requestId })
      const data = resp?.data || null
      const nextSpin = data?.spin || null
      const nextResult = data?.result || null
      const nextParticipant = data?.participant || null
      if (!nextSpin || !nextResult) throw new Error('SPIN_TRANSACTION_FAILED')

      const targetIndex = normalizedSegments.findIndex((segment) => String(segment.documentId || segment.id) === String(nextResult.resultKey || nextResult.prizeDocumentId || nextResult.prizeId || ''))
      setLatestSpin({
        id: nextSpin.id,
        documentId: nextSpin.documentId,
        verificationCode: nextSpin.verificationCode,
        spunAt: nextSpin.spunAt,
        participant: {
          participantCode: nextParticipant?.participantCode || selectedParticipant.participantCode || null,
          fullName: nextParticipant?.fullName || selectedParticipant.fullName || null,
        },
        result: nextResult,
      })
      setStatistics((current) => current ? {
        ...current,
        eligibleParticipants: Math.max(0, Number(current.eligibleParticipants || 0) - (data?.replayed ? 0 : 1)),
        usedParticipants: Number(current.usedParticipants || 0) + (data?.replayed ? 0 : 1),
        totalSpins: Number(current.totalSpins || 0) + (data?.replayed ? 0 : 1),
      } : current)
      latestSpinIdRef.current = nextSpin.documentId || nextSpin.id || latestSpinIdRef.current
      setPresentationResult({ spin: nextSpin, result: nextResult, participant: nextParticipant || selectedParticipant, replayed: Boolean(data?.replayed) })

      if (targetIndex < 0) {
        setSelectedParticipant({ ...(selectedParticipant || {}), ...(nextParticipant || {}) })
        setSpinForParticipantLoading(false)
        return
      }

      pendingSpinRef.current = {
        latestSpin: {
          id: nextSpin.id,
          documentId: nextSpin.documentId,
          verificationCode: nextSpin.verificationCode,
          spunAt: nextSpin.spunAt,
          participant: {
            participantCode: nextParticipant?.participantCode || selectedParticipant.participantCode || null,
            fullName: nextParticipant?.fullName || selectedParticipant.fullName || null,
          },
          result: nextResult,
        },
        finalRotation: calculateFinalRotation(targetIndex, rotation, normalizedSegments.length),
        participant: { ...(selectedParticipant || {}), ...(nextParticipant || {}) },
      }
      setIsPresentationSpinning(true)
      setRotation((current) => calculateFinalRotation(targetIndex, current, normalizedSegments.length))
      setEligibleParticipants((current) => current.filter((item) => String(item.id) !== String(selectedParticipant.id)))
    } catch (error) {
      setPollError(String(error?.response?.data?.error || error?.message || 'Không thể quay cho người tham gia'))
      setActiveRequestId('')
    } finally {
      setSpinForParticipantLoading(false)
    }
  }

  async function handleReadyParticipant() {
    if (!selectedParticipant || prepareParticipantLoading || spinForParticipantLoading || isPresentationSpinning) return
    const nextErrors = validateParticipantForm(participantFormValues)
    if (Object.keys(nextErrors).length > 0) {
      setParticipantFormErrors(nextErrors)
      return
    }

    setPrepareParticipantLoading(true)
    setParticipantFormErrors({})
    setPollError('')
    try {
      const payload = { ...participantFormValues }
      const resp = await updateLuckyWheelParticipant(id, selectedParticipant.id, payload)
      const updated = resp?.data || resp || selectedParticipant
      const normalizedAttrs = updated?.attributes || updated
      const normalized = {
        id: updated?.id || normalizedAttrs?.id || selectedParticipant.id,
        documentId: normalizedAttrs?.documentId || updated?.documentId || selectedParticipant.documentId || null,
        ...normalizedAttrs,
      }
      setSelectedParticipant(normalized)
      setParticipantFormValues(buildParticipantFormValues(normalized))
      setPresentationReady(true)
      setPresentationResult(null)
      setActiveRequestId('')
        setEligibleParticipants((current) => current.map((item) => {
        const attrs = item?.attributes || item || {}
        if (String(item.id || attrs.id) !== String(selectedParticipant.id)) return item
        return { id: normalized.id || selectedParticipant.id, attributes: { ...attrs, ...normalized } }
      }))
    } catch (error) {
      setPollError(String(error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Không thể lưu thông tin người tham gia'))
    } finally {
      setPrepareParticipantLoading(false)
    }
  }

  function handlePresentationSpinEnd() {
    if (!pendingSpinRef.current) return
    const completion = pendingSpinRef.current
    pendingSpinRef.current = null
    setIsPresentationSpinning(false)
    setSelectedParticipant(completion.participant)
    setPresentationReady(false)
  }

  function handleChooseNextParticipant() {
    setSelectedParticipant(null)
    setPresentationReady(false)
    setActiveRequestId('')
    setPresentationResult(null)
    setParticipantSearch('')
  }

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><CSpinner /></div>
  }

  if (error || !presentation) {
    return <div style={{ padding: 32, textAlign: 'center' }}>{error || 'Không tìm thấy dữ liệu trình chiếu.'}</div>
  }

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 45%, #e0f2fe 100%)',
        color: '#0f172a',
        padding: '24px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {tenantLogo ? <img src={tenantLogo} alt={tenantName} style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 16, background: '#fff', padding: 8 }} /> : null}
          <div>
            <div style={{ fontSize: 14, letterSpacing: 1.2, textTransform: 'uppercase', color: '#475569' }}>{tenantName}</div>
            <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>{presentation.wheel?.name || 'Lucky Wheel'}</div>
            <div style={{ marginTop: 6, color: '#475569', maxWidth: 760 }}>{presentation.wheel?.publicMessage || presentation.wheel?.description || ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ display: 'inline-flex', padding: '8px 14px', borderRadius: 999, background: statusMeta.bg, color: statusMeta.color, fontWeight: 700 }}>{statusMeta.label}</span>
          {document.fullscreenEnabled ? (
            <CButton color='primary' variant='outline' onClick={handleToggleFullscreen}>
              {isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'}
            </CButton>
          ) : null}
        </div>
      </div>

      {presentation.wheel?.status !== 'opened' ? (
        <div className='alert alert-warning py-2 mb-4'>Vòng quay hiện chưa mở.</div>
      ) : null}
      {pollError ? <div className='alert alert-warning py-2 mb-4'>{pollError}</div> : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(320px, 0.9fr)', gap: 24 }}>
        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ background: 'rgba(255,255,255,0.72)', border: '1px solid rgba(148,163,184,0.24)', borderRadius: 24, padding: 20, backdropFilter: 'blur(8px)' }}>
            <LuckyWheelDisplay
              segments={normalizedSegments}
              rotation={rotation}
              isSpinning={isPresentationSpinning}
              interactive={Boolean(canSpinForParticipant && selectedParticipant && presentationReady && !prepareParticipantLoading && !spinForParticipantLoading && !isPresentationSpinning)}
              highlightResultKey={highlightResultKey}
              centerLabel={isPresentationSpinning || spinForParticipantLoading ? 'Đang quay...' : (presentationResult ? 'Đã quay' : (presentationReady ? 'Quay' : 'Sẵn sàng'))}
              centerDisabled={!canSpinForParticipant || !selectedParticipant || !presentationReady || prepareParticipantLoading || spinForParticipantLoading || isPresentationSpinning || Boolean(presentationResult)}
              onCenterClick={handleSpinForParticipant}
              onSpinEnd={handlePresentationSpinEnd}
            />
          </div>

          {canSpinForParticipant ? (
            <div style={{ background: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 18px 40px rgba(15,23,42,0.08)' }}>
              <div className='d-flex justify-content-between align-items-center mb-3'>
                <div style={{ fontWeight: 800, fontSize: 18 }}>Quay hộ người tham gia</div>
                <CButton size='sm' color='secondary' variant='outline' onClick={() => setControlPanelOpen((current) => !current)}>
                  {controlPanelOpen ? 'Thu gọn' : 'Điều khiển'}
                </CButton>
              </div>

              {controlPanelOpen ? (
                <div>
                  <div className='mb-3'>
                    <input className='form-control' value={participantSearch} onChange={(e) => setParticipantSearch(e.target.value)} placeholder='Tìm theo mã, họ tên, lớp, số điện thoại' disabled={spinForParticipantLoading || isPresentationSpinning} />
                  </div>

                  <div className='mb-3'>
                    <div className='small text-muted mb-2'>Danh sách tìm được</div>
                    {participantLoading ? <div><CSpinner size='sm' /></div> : (
                      <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                        {eligibleParticipants.length === 0 ? <div className='small text-muted'>Chưa có người phù hợp.</div> : eligibleParticipants.map((item) => {
                          const attrs = item?.attributes || item || {}
                          return (
                            <div key={item.id || attrs.id} className='border rounded p-2 d-flex justify-content-between align-items-center gap-2'>
                              <div>
                                <div style={{ fontWeight: 600 }}>{attrs.fullName || attrs.participantCode || 'Người tham gia'}</div>
                                <div className='small text-muted'>{attrs.participantCode || '—'} {attrs.className ? `• ${attrs.className}` : ''}</div>
                              </div>
                              <CButton size='sm' color='primary' variant='outline' disabled={spinForParticipantLoading || isPresentationSpinning} onClick={() => {
                                setSelectedParticipant({ id: item.id || attrs.id, documentId: attrs.documentId || null, ...attrs })
                                setPresentationReady(false)
                                setPresentationResult(null)
                                setActiveRequestId('')
                              }}>Chọn</CButton>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className='mb-3'>
                    <div className='small text-muted mb-2'>Người đang chọn</div>
                    {selectedParticipant ? (
                      <div className='border rounded p-3'>
                        <div style={{ fontWeight: 700 }}>{selectedParticipant.fullName || selectedParticipant.participantCode}</div>
                        <div className='small text-muted'>{selectedParticipant.participantCode || '—'} {selectedParticipant.className ? `• ${selectedParticipant.className}` : ''}</div>
                        <div className='mt-3' style={{ display: 'grid', gap: 12 }}>
                          {participantFieldConfigs.map((field) => {
                            const key = String(field.key || '')
                            const readOnly = key === 'participantCode' || field.editable === false
                            return (
                              <div key={key}>
                                <label className='form-label small mb-1'>
                                  {field.label || key}
                                  {field.required ? ' *' : ''}
                                </label>
                                <CFormInput
                                  value={participantFormValues[key] ?? ''}
                                  readOnly={readOnly}
                                  onChange={(e) => {
                                    if (readOnly) return
                                    const value = e.target.value
                                    setParticipantFormValues((current) => ({ ...current, [key]: value }))
                                    setPresentationReady(false)
                                  }}
                                />
                                {participantFormErrors[key] ? <div className='text-danger small mt-1'>{participantFormErrors[key]}</div> : null}
                              </div>
                            )
                          })}
                        </div>
                        <div className='mt-2 d-flex gap-2 flex-wrap'>
                          <CButton size='sm' color='secondary' variant='outline' disabled={prepareParticipantLoading || spinForParticipantLoading || isPresentationSpinning} onClick={() => { setSelectedParticipant(null); setPresentationReady(false) }}>Bỏ chọn</CButton>
                          {!presentationResult ? (
                            <CButton size='sm' color='primary' disabled={prepareParticipantLoading || spinForParticipantLoading || isPresentationSpinning} onClick={handleReadyParticipant}>
                              {prepareParticipantLoading ? 'Đang lưu...' : (presentationReady ? 'Đã sẵn sàng' : 'Sẵn sàng')}
                            </CButton>
                          ) : null}
                        </div>
                      </div>
                    ) : <div className='small text-muted'>Chưa chọn người tham gia.</div>}
                  </div>

                  <div className='small text-muted'>Sau khi sẵn sàng, bấm nút giữa vòng quay để thực hiện lượt quay.</div>

                  {presentationResult ? (
                    <div className='mt-3'>
                      <CButton color='secondary' variant='outline' onClick={handleChooseNextParticipant} disabled={spinForParticipantLoading || isPresentationSpinning}>Chọn người tiếp theo</CButton>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div style={{ display: 'grid', gap: 18 }}>
          <div style={{ background: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 18px 40px rgba(15,23,42,0.08)' }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Quét mã để tham gia</div>
            <div style={{ marginTop: 8, color: '#475569' }}>Mã vòng quay: <strong>{presentation.wheel?.code || '—'}</strong></div>
            {presentation.qrCodeDataUrl ? <img src={presentation.qrCodeDataUrl} alt='QR tham gia' style={{ width: '100%', maxWidth: 260, marginTop: 16, borderRadius: 16 }} /> : null}
            <div style={{ marginTop: 12, color: '#64748b', wordBreak: 'break-all' }}>{presentation.publicUrl}</div>
          </div>

          <div style={{ background: '#fff', borderRadius: 24, padding: 20, boxShadow: '0 18px 40px rgba(15,23,42,0.08)' }}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>Thống kê</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><div style={{ color: '#64748b', fontSize: 13 }}>Đã tham gia</div><div style={{ fontSize: 28, fontWeight: 800 }}>{statistics?.totalParticipants ?? 0}</div></div>
              <div><div style={{ color: '#64748b', fontSize: 13 }}>Chưa quay</div><div style={{ fontSize: 28, fontWeight: 800 }}>{statistics?.eligibleParticipants ?? 0}</div></div>
              <div><div style={{ color: '#64748b', fontSize: 13 }}>Đã quay</div><div style={{ fontSize: 28, fontWeight: 800 }}>{statistics?.usedParticipants ?? 0}</div></div>
              <div><div style={{ color: '#64748b', fontSize: 13 }}>Tổng lượt quay</div><div style={{ fontSize: 28, fontWeight: 800 }}>{statistics?.totalSpins ?? 0}</div></div>
            </div>
          </div>

          <div
            style={{
              background: flashLatest ? 'linear-gradient(135deg, #fef3c7 0%, #fff7ed 100%)' : '#fff',
              borderRadius: 24,
              padding: 20,
              boxShadow: '0 18px 40px rgba(15,23,42,0.08)',
              transition: 'background 320ms ease',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>Kết quả mới nhất</div>
            {latestSpin ? (
              <div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{latestSpin.participant?.fullName || latestSpin.participant?.participantCode || 'Người chơi'}</div>
                <div style={{ color: '#475569', marginTop: 4 }}>Mã tham gia: <strong>{latestSpin.participant?.participantCode || '—'}</strong></div>
                <div style={{ marginTop: 16, padding: 16, borderRadius: 16, background: '#f8fafc' }}>
                  <div style={{ fontSize: 14, color: '#64748b' }}>Kết quả</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{latestSpin.result?.name || '—'}</div>
                  {latestSpin.result?.resultMessage ? <div style={{ marginTop: 8 }}>{latestSpin.result.resultMessage}</div> : null}
                  {latestSpin.result?.image?.resolvedUrl || latestSpin.result?.image?.url ? (
                    <img src={latestSpin.result.image.resolvedUrl || latestSpin.result.image.url} alt={latestSpin.result?.name || 'Prize'} style={{ width: 160, maxWidth: '100%', marginTop: 14, borderRadius: 14 }} />
                  ) : null}
                </div>
                <div style={{ marginTop: 12, color: '#475569' }}>Mã xác thực: <strong>{latestSpin.verificationCode || '—'}</strong></div>
                <div style={{ color: '#64748b' }}>{latestSpin.spunAt ? new Date(latestSpin.spunAt).toLocaleString() : ''}</div>
                {presentationResult ? (
                  <div className='mt-3'>
                    <CButton color='secondary' variant='outline' onClick={handleChooseNextParticipant}>Chọn người tiếp theo</CButton>
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ color: '#64748b' }}>Chưa có kết quả quay.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}