import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
    CButton,
    CCard,
    CCardBody,
    CCol,
    CContainer,
    CRow,
    CSpinner,
} from '@coreui/react'
import ErrorBoundary from '../../../components/ErrorBoundary'
import LuckyWheelDisplay from '../components/LuckyWheelDisplay'
import { getPublicLuckyWheel, lookupPublicParticipant, preparePublicParticipant, spinPublic } from '../services/luckyWheelService'

const SESSION_PREFIX = 'lucky-wheel'
const SYSTEM_FIELD_ORDER = ['participantCode', 'fullName', 'phone', 'email', 'className']
const POINTER_ANGLE = -90
const SVG_START_ANGLE = -90
const EXTRA_TURNS = 6

function buildSessionKey(code) {
    return `${SESSION_PREFIX}:${String(code || '').trim().toUpperCase()}:play-session`
}

function decodeBase64UrlJson(token) {
    const text = String(token || '').trim()
    if (!text) return null
    const parts = text.split('.')
    const payloadPart = parts.length >= 2 ? parts[1] : parts[0]
    if (!payloadPart) return null
    try {
        const padded = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
        const normalized = padded + '='.repeat((4 - padded.length % 4) % 4)
        const json = atob(normalized)
        return JSON.parse(json)
    } catch {
        return null
    }
}

function parseTokenExpiry(token) {
    const payload = decodeBase64UrlJson(token)
    const exp = Number(payload?.exp || 0)
    return Number.isFinite(exp) && exp > 0 ? exp * 1000 : 0
}

function buildSpinRequestId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
    return `spin-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function normalizeFieldConfig(participantFormConfig) {
    const source = Array.isArray(participantFormConfig?.fields) ? participantFormConfig.fields : []
    const byKey = new Map(source.map((field) => [String(field?.key || ''), field]))
    return SYSTEM_FIELD_ORDER
        .map((key) => {
            const field = byKey.get(key)
            if (!field || field.enabled === false) return null
            return {
                key,
                label: String(field.label || key),
                enabled: true,
                required: Boolean(field.required),
                editable: field.editable !== false,
                placeholder: String(field.placeholder || ''),
            }
        })
        .filter(Boolean)
}

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

function normalizeAngle(angle) {
    let next = Number(angle || 0) % 360
    if (next < 0) next += 360
    return next
}

function extractSegmentKey(segment) {
    return String(segment?.documentId || segment?.id || '')
}

function extractResultKey(result) {
    return String(result?.resultKey || result?.prizeDocumentId || result?.prizeId || '')
}

function calculateFinalRotation(targetIndex, currentRotation, segmentCount, extraTurns = EXTRA_TURNS) {
    if (!Number.isInteger(targetIndex) || targetIndex < 0 || segmentCount <= 0) return currentRotation
    const segmentAngle = 360 / segmentCount
    const segmentCenterAngle = SVG_START_ANGLE + targetIndex * segmentAngle + segmentAngle / 2
    const alignmentRotation = normalizeAngle(POINTER_ANGLE - segmentCenterAngle)
    const currentNormalized = normalizeAngle(currentRotation)
    const delta = normalizeAngle(alignmentRotation - currentNormalized)
    return currentRotation + extraTurns * 360 + delta
}

function getSegmentIndexAtPointer(rotation, segmentCount) {
    if (segmentCount <= 0) return -1
    const segmentAngle = 360 / segmentCount
    const relative = normalizeAngle(POINTER_ANGLE - rotation - SVG_START_ANGLE)
    return Math.floor(relative / segmentAngle) % segmentCount
}

function runForceTargetChecks(segmentCount, currentRotation = 0) {
    if (segmentCount <= 0) return []
    return Array.from({ length: segmentCount }, (_, index) => {
        const finalRotation = calculateFinalRotation(index, currentRotation, segmentCount, 0)
        const resolvedIndex = getSegmentIndexAtPointer(finalRotation, segmentCount)
        return {
            index,
            finalRotation,
            resolvedIndex,
            pass: resolvedIndex === index,
        }
    })
}

function SpinnerCenter() {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <CSpinner />
        </div>
    )
}

export default function LuckyWheelPublicPage() {
    const { code } = useParams()
    const sessionKey = useMemo(() => buildSessionKey(code), [code])
    const [loading, setLoading] = useState(true)
    const [wheel, setWheel] = useState(null)
    const [stage, setStage] = useState('lookup')
    const [participantCode, setParticipantCode] = useState('')
    const [participant, setParticipant] = useState(null)
    const [fieldConfigs, setFieldConfigs] = useState([])
    const [formValues, setFormValues] = useState({})
    const [fieldErrors, setFieldErrors] = useState({})
    const [generalError, setGeneralError] = useState('')
    const [lookupLoading, setLookupLoading] = useState(false)
    const [prepareLoading, setPrepareLoading] = useState(false)
    const [spinLoading, setSpinLoading] = useState(false)
    const [isSpinning, setIsSpinning] = useState(false)
    const [playToken, setPlayToken] = useState('')
    const [expiresAt, setExpiresAt] = useState(0)
    const [readyNotice, setReadyNotice] = useState('')
    const [requestId, setRequestId] = useState('')
    const [rotation, setRotation] = useState(0)
    const [spinRecord, setSpinRecord] = useState(null)
    const [spinResult, setSpinResult] = useState(null)
    const pendingCompletionRef = useRef(null)
    const spinAnimationFrameRef = useRef(null)

    const normalizedSegments = useMemo(() => normalizePrizeSegments(wheel?.prizes || []), [wheel])
    const centerLabel = stage === 'completed' ? 'Đã quay' : (spinLoading || isSpinning ? 'Đang quay...' : 'Quay')
    const centerDisabled = stage !== 'ready' || !playToken || spinLoading || isSpinning
    const actionsDisabled = spinLoading || isSpinning

    useEffect(() => {
        return () => {
            if (spinAnimationFrameRef.current) {
                cancelAnimationFrame(spinAnimationFrameRef.current)
            }
        }
    }, [])

    useEffect(() => {
        let mounted = true
        async function load() {
            setLoading(true)
            setGeneralError('')
            try {
                const res = await getPublicLuckyWheel(code)
                if (!mounted) return
                const nextWheel = res?.data || res || null
                setWheel(nextWheel)
            } catch (error) {
                if (!mounted) return
                setGeneralError(String(error?.response?.data?.error || error?.message || 'Lỗi khi tải vòng quay'))
            } finally {
                if (mounted) setLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [code])

    useEffect(() => {
        if (!wheel) return
        setFieldConfigs(normalizeFieldConfig(wheel.participantFormConfig))
    }, [wheel])

    useEffect(() => {
        if (!wheel) return
        const restoredRaw = String(window.sessionStorage.getItem(sessionKey) || '').trim()
        if (!restoredRaw) return
        try {
            const restored = JSON.parse(restoredRaw)
            if (restored?.completed && restored?.result && restored?.participant && restored?.spin) {
                setParticipant(restored.participant)
                setSpinRecord(restored.spin)
                setSpinResult(restored.result)
                setPlayToken('')
                setExpiresAt(0)
                setRequestId(restored.spin?.requestId || '')
                setStage('completed')
                setFormValues({
                    participantCode: restored.participant.participantCode || '',
                    fullName: restored.participant.fullName || '',
                    phone: restored.participant.phone || '',
                    email: restored.participant.email || '',
                    className: restored.participant.className || '',
                })
                const targetIndex = normalizedSegments.findIndex((segment) => extractSegmentKey(segment) === extractResultKey(restored.result))
                if (targetIndex >= 0) {
                    setRotation(calculateFinalRotation(targetIndex, 0, normalizedSegments.length, 0))
                }
                return
            }

            const restoredToken = String(restored?.playToken || '').trim()
            const restoredParticipant = restored?.participant || null
            const restoredExpiresAt = Number(restored?.expiresAt || 0)
            if (!restoredToken || !restoredParticipant || restoredExpiresAt <= Date.now()) {
                window.sessionStorage.removeItem(sessionKey)
                return
            }
            const tokenPayload = decodeBase64UrlJson(restoredToken)
            if (String(tokenPayload?.purpose || '') !== 'lucky-wheel-play') {
                window.sessionStorage.removeItem(sessionKey)
                return
            }
            if (String(tokenPayload?.luckyWheelId || '') !== String(wheel.id)) {
                window.sessionStorage.removeItem(sessionKey)
                return
            }
            setParticipant(restoredParticipant)
            setFormValues({
                participantCode: restoredParticipant.participantCode || '',
                fullName: restoredParticipant.fullName || '',
                phone: restoredParticipant.phone || '',
                email: restoredParticipant.email || '',
                className: restoredParticipant.className || '',
            })
            setPlayToken(restoredToken)
            setExpiresAt(restoredExpiresAt)
            setStage('ready')
        } catch {
            window.sessionStorage.removeItem(sessionKey)
        }
    }, [wheel, sessionKey, normalizedSegments])

    useEffect(() => {
        if (!import.meta.env.DEV || !normalizedSegments.length) return
        const results = runForceTargetChecks(normalizedSegments.length)
        const failed = results.filter((item) => !item.pass)
        if (failed.length) {
            console.error('WHEEL_VISUAL_RESULT_MISMATCH', failed)
        } else {
            console.info('[lucky-wheel] forceTargetIndex checks passed', results)
        }
        window.__luckyWheelDebug = {
            forceTargetIndex: (index) => {
                const finalRotation = calculateFinalRotation(index, rotation, normalizedSegments.length, 0)
                setRotation(finalRotation)
                return {
                    finalRotation,
                    resolvedIndex: getSegmentIndexAtPointer(finalRotation, normalizedSegments.length),
                }
            },
            calculateFinalRotation: (index, current = rotation) => calculateFinalRotation(index, current, normalizedSegments.length),
            getSegmentIndexAtPointer: (current = rotation) => getSegmentIndexAtPointer(current, normalizedSegments.length),
            runForceTargetChecks: () => runForceTargetChecks(normalizedSegments.length, rotation),
        }
    }, [normalizedSegments, rotation])

    function storeReadySession(nextParticipant, nextPlayToken, nextExpiresAt) {
        window.sessionStorage.setItem(sessionKey, JSON.stringify({
            participant: nextParticipant,
            playToken: nextPlayToken,
            expiresAt: nextExpiresAt,
            completed: false,
        }))
    }

    function storeCompletedSession(nextParticipant, nextSpin, nextResult, nextRotation) {
        window.sessionStorage.setItem(sessionKey, JSON.stringify({
            participant: nextParticipant,
            spin: nextSpin,
            result: nextResult,
            rotation: nextRotation,
            completed: true,
        }))
    }

    function clearSessionState() {
        window.sessionStorage.removeItem(sessionKey)
    }

    function buildFormValues(nextParticipant) {
        return {
            participantCode: nextParticipant?.participantCode || participantCode || '',
            fullName: nextParticipant?.fullName || '',
            phone: nextParticipant?.phone || '',
            email: nextParticipant?.email || '',
            className: nextParticipant?.className || '',
        }
    }

    function validateClientForm(values) {
        const nextErrors = {}
        for (const field of fieldConfigs) {
            const value = String(values[field.key] || '').trim()
            if (field.required && !value) nextErrors[field.key] = 'Trường bắt buộc'
            if (field.key === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) nextErrors.email = 'Email không hợp lệ'
        }
        return nextErrors
    }

    async function handleLookup(event) {
        event.preventDefault()
        if (lookupLoading) return
        setGeneralError('')
        setFieldErrors({})
        const codeValue = String(participantCode || '').trim()
        if (!codeValue) {
            setGeneralError('Nhập mã tham gia')
            return
        }
        setLookupLoading(true)
        try {
            const res = await lookupPublicParticipant(code, { participantCode: codeValue })
            const data = res?.data || res
            const nextParticipant = data?.participant || null
            if (!nextParticipant) {
                setGeneralError('Mã không hợp lệ')
                return
            }
            const nextFieldConfigs = Array.isArray(data?.requiredFields) && data.requiredFields.length > 0
                ? data.requiredFields.filter((field) => field && field.enabled)
                : normalizeFieldConfig(wheel?.participantFormConfig)
            setParticipant(nextParticipant)
            setFieldConfigs(nextFieldConfigs.map((field) => ({
                key: field.key,
                label: field.label || field.key,
                required: Boolean(field.required),
                editable: field.editable !== false,
                enabled: field.enabled !== false,
                placeholder: field.placeholder || '',
            })).filter((field) => field.enabled && SYSTEM_FIELD_ORDER.includes(field.key)))
            setFormValues(buildFormValues(nextParticipant))
            setStage('form')
        } catch (error) {
            setGeneralError(String(error?.response?.data?.error || error?.message || 'Lỗi khi kiểm tra mã'))
        } finally {
            setLookupLoading(false)
        }
    }

    async function handlePrepare(event) {
        event.preventDefault()
        if (prepareLoading || !participant) return
        const nextErrors = validateClientForm(formValues)
        if (Object.keys(nextErrors).length > 0) {
            setFieldErrors(nextErrors)
            setGeneralError('')
            return
        }
        setPrepareLoading(true)
        setGeneralError('')
        setFieldErrors({})
        try {
            const payload = { participantCode: participant.participantCode }
            for (const field of fieldConfigs) {
                if (!field.enabled) continue
                payload[field.key] = formValues[field.key]
            }
            const res = await preparePublicParticipant(code, payload)
            const data = res?.data || res
            const nextParticipant = data?.participant || null
            const nextPlayToken = String(data?.playToken || '').trim()
            const nextExpiresAt = Number.isFinite(Number(data?.expiresIn))
                ? Date.now() + Number(data.expiresIn) * 1000
                : parseTokenExpiry(nextPlayToken)
            if (!nextParticipant || !nextPlayToken) throw new Error('PREPARE_FAILED')
            setParticipant(nextParticipant)
            setPlayToken(nextPlayToken)
            setExpiresAt(nextExpiresAt)
            setRequestId('')
            setSpinRecord(null)
            setSpinResult(null)
            setFormValues(buildFormValues(nextParticipant))
            setStage('ready')
            setReadyNotice('Sẵn sàng quay')
            storeReadySession(nextParticipant, nextPlayToken, nextExpiresAt)
        } catch (error) {
            const backendError = String(error?.response?.data?.error || error?.message || 'Lỗi khi xác nhận thông tin')
            const backendField = String(error?.response?.data?.field || '')
            if (backendField) setFieldErrors({ [backendField]: backendError })
            setGeneralError(backendError)
        } finally {
            setPrepareLoading(false)
        }
    }

    function finalizeCompletedState(nextParticipant, nextSpin, nextResult, nextRotation, notice = '') {
        setParticipant((current) => ({ ...current, ...nextParticipant }))
        setSpinRecord(nextSpin)
        setSpinResult(nextResult)
        setPlayToken('')
        setExpiresAt(0)
        setStage('completed')
        setReadyNotice(notice)
        setRotation(nextRotation)
        storeCompletedSession({ ...(participant || {}), ...(nextParticipant || {}) }, nextSpin, nextResult, nextRotation)
    }

    async function handleSpinClick() {
        if (!playToken || spinLoading || isSpinning || stage === 'completed') return
        if (!normalizedSegments.length) {
            setGeneralError('Không có ô quay hợp lệ')
            return
        }

        setGeneralError('')
        setReadyNotice('')
        setSpinLoading(true)
        const activeRequestId = requestId || buildSpinRequestId()
        if (!requestId) setRequestId(activeRequestId)

        try {
            const res = await spinPublic(code, { playToken, requestId: activeRequestId })
            const data = res?.data || res
            const nextSpin = data?.spin || null
            const nextResult = data?.result || null
            const nextParticipant = data?.participant || null
            if (!nextSpin || !nextResult || !nextParticipant) throw new Error('SPIN_TRANSACTION_FAILED')

            const resultKey = extractResultKey(nextResult)
            const targetIndex = normalizedSegments.findIndex((segment) => extractSegmentKey(segment) === resultKey)
            if (targetIndex < 0) {
                console.error('WHEEL_RESULT_SEGMENT_NOT_FOUND', { resultKey, normalizedSegments })
                finalizeCompletedState(nextParticipant, nextSpin, nextResult, rotation, 'Kết quả đã được ghi nhận nhưng không thể định vị ô quay tương ứng')
                setGeneralError('Kết quả đã được ghi nhận nhưng giao diện không xác định được ô tương ứng')
                return
            }

            const finalRotation = calculateFinalRotation(targetIndex, rotation, normalizedSegments.length)
            pendingCompletionRef.current = {
                participant: nextParticipant,
                spin: nextSpin,
                result: nextResult,
                finalRotation,
                replayed: Boolean(data?.replayed),
            }
            setSpinRecord(nextSpin)
            setSpinResult(nextResult)
            setParticipant((current) => ({ ...current, ...nextParticipant }))

            // Bật transition trước, sau đó mới đổi rotation ở frame kế tiếp.
            // Nếu đổi cả hai trong cùng một render, trình duyệt có thể chỉ "giật" tới vị trí cuối.
            setIsSpinning(true)
            if (spinAnimationFrameRef.current) {
                cancelAnimationFrame(spinAnimationFrameRef.current)
            }
            spinAnimationFrameRef.current = requestAnimationFrame(() => {
                spinAnimationFrameRef.current = requestAnimationFrame(() => {
                    setRotation(finalRotation)
                    spinAnimationFrameRef.current = null
                })
            })
        } catch (error) {
            const message = String(error?.response?.data?.error || error?.message || 'Lỗi khi quay vòng')
            setGeneralError(message)
        } finally {
            setSpinLoading(false)
        }
    }

    function handleSpinEnd() {
        if (!pendingCompletionRef.current) return
        const completion = pendingCompletionRef.current
        pendingCompletionRef.current = null
        setIsSpinning(false)
        const resolvedIndex = getSegmentIndexAtPointer(completion.finalRotation, normalizedSegments.length)
        const expectedIndex = normalizedSegments.findIndex((segment) => extractSegmentKey(segment) === extractResultKey(completion.result))
        if (expectedIndex >= 0 && resolvedIndex !== expectedIndex) {
            console.error('WHEEL_VISUAL_RESULT_MISMATCH', { resolvedIndex, expectedIndex, finalRotation: completion.finalRotation })
        }
        finalizeCompletedState(
            completion.participant,
            completion.spin,
            completion.result,
            completion.finalRotation,
            completion.replayed ? 'Đã khôi phục kết quả quay trước đó' : '',
        )
    }

    function handleUseDifferentCode() {
        clearSessionState()
        pendingCompletionRef.current = null
        if (spinAnimationFrameRef.current) {
            cancelAnimationFrame(spinAnimationFrameRef.current)
            spinAnimationFrameRef.current = null
        }
        setParticipant(null)
        setParticipantCode('')
        setFormValues({})
        setFieldErrors({})
        setGeneralError('')
        setPlayToken('')
        setExpiresAt(0)
        setRequestId('')
        setSpinRecord(null)
        setSpinResult(null)
        setReadyNotice('')
        setStage('lookup')
        setIsSpinning(false)
    }

    function renderField(field) {
        const value = formValues[field.key] ?? ''
        const readOnly = field.key === 'participantCode' || field.editable === false
        return (
            <div className='mb-3' key={field.key}>
                <label className='form-label'>
                    {field.label}
                    {field.required ? ' *' : ''}
                </label>
                <input
                    className='form-control'
                    value={value}
                    placeholder={field.placeholder || ''}
                    readOnly={readOnly}
                    onChange={(event) => {
                        if (readOnly) return
                        setFormValues((current) => ({ ...current, [field.key]: event.target.value }))
                    }}
                />
                {fieldErrors[field.key] ? <div className='text-danger mt-1'>{fieldErrors[field.key]}</div> : null}
            </div>
        )
    }

    if (loading) return <SpinnerCenter />

    if (!wheel) {
        return (
            <ErrorBoundary>
                <CContainer className='py-5'>
                    <CCard>
                        <CCardBody className='text-center'>
                            {generalError || 'Không tìm thấy vòng quay.'}
                        </CCardBody>
                    </CCard>
                </CContainer>
            </ErrorBoundary>
        )
    }

    return (
        <ErrorBoundary>
            <CContainer className='py-4'>
                <CRow className='justify-content-center'>
                    <CCol xs={12} md={10} lg={8}>
                        <CCard>
                            <CCardBody>
                                <div className='mb-3'>
                                    <h3 className='mb-1'>{wheel.name}</h3>
                                    <div className='text-muted'>{wheel.description}</div>
                                </div>

                                {generalError ? <div className='alert alert-danger py-2'>{generalError}</div> : null}

                                {stage === 'lookup' ? (
                                    <form onSubmit={handleLookup}>
                                        <div className='mb-3'>
                                            <div className='mb-2'><strong>Mã tham gia</strong></div>
                                            <input
                                                className='form-control'
                                                value={participantCode}
                                                onChange={(event) => setParticipantCode(event.target.value)}
                                                placeholder='Nhập mã tham gia'
                                                autoComplete='off'
                                            />
                                        </div>
                                        <div className='d-flex justify-content-end'>
                                            <CButton color='primary' type='submit' disabled={lookupLoading || !String(participantCode || '').trim()}>
                                                {lookupLoading ? 'Đang kiểm tra...' : 'Kiểm tra'}
                                            </CButton>
                                        </div>
                                    </form>
                                ) : null}

                                {stage === 'form' ? (
                                    <form onSubmit={handlePrepare}>
                                        <div className='mb-3'>
                                            <div className='text-muted'>Xin chào, <strong>{participant?.fullName || participant?.participantCode}</strong></div>
                                            <div className='small text-secondary'>Mã tham gia: {participant?.participantCode || '-'}</div>
                                        </div>

                                        {fieldConfigs.map(renderField)}

                                        <div className='d-flex flex-wrap gap-2 justify-content-end'>
                                            <CButton color='secondary' type='button' variant='outline' onClick={handleUseDifferentCode} disabled={prepareLoading}>
                                                Dùng mã khác
                                            </CButton>
                                            <CButton color='primary' type='submit' disabled={prepareLoading}>
                                                {prepareLoading ? 'Đang xác nhận...' : 'Xác nhận thông tin'}
                                            </CButton>
                                        </div>
                                    </form>
                                ) : null}

                                {stage === 'ready' || stage === 'completed' ? (
                                    <div>
                                        <div className='mb-3 text-center'>
                                            <div className='small text-secondary'>{wheel.publicMessage || ''}</div>
                                            <div className='mt-2'>Xin chào, <strong>{participant?.fullName || participant?.participantCode}</strong></div>
                                            <div className='small text-secondary'>Mã tham gia: {participant?.participantCode || '-'}</div>
                                            {readyNotice ? <div className='small text-success mt-1'>{readyNotice}</div> : null}
                                        </div>

                                        <LuckyWheelDisplay
                                            segments={normalizedSegments}
                                            rotation={rotation}
                                            isSpinning={isSpinning}
                                            interactive
                                            centerLabel={centerLabel}
                                            centerDisabled={centerDisabled}
                                            onCenterClick={handleSpinClick}
                                            onSpinEnd={handleSpinEnd}
                                        />

                                        <div className='d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3'>
                                            <CButton color='secondary' variant='outline' onClick={handleUseDifferentCode} disabled={actionsDisabled}>
                                                Dùng mã khác
                                            </CButton>
                                            <div className='small text-secondary'>
                                                {stage === 'ready' && expiresAt ? `Mã quay còn hiệu lực tới ${new Date(expiresAt).toLocaleTimeString()}` : ''}
                                            </div>
                                        </div>

                                        {stage === 'completed' && spinResult ? (
                                            <CCard className='mt-4'>
                                                <CCardBody>
                                                    <div className='mb-2'>Bạn đã quay được ô:</div>
                                                    <div style={{ fontSize: 22, fontWeight: 700 }}>{spinResult.name || '-'}</div>
                                                    {spinResult.resultMessage ? <div className='mt-2'>{spinResult.resultMessage}</div> : null}
                                                    {wheel.resultNotice ? <div className='mt-2 text-muted'>{wheel.resultNotice}</div> : null}
                                                    {spinResult.image?.resolvedUrl || spinResult.image?.url ? (
                                                        <div className='mt-3'>
                                                            <img
                                                                src={spinResult.image.resolvedUrl || spinResult.image.url}
                                                                alt={spinResult.name || 'Prize'}
                                                                style={{ maxWidth: '100%', width: 220, borderRadius: 12 }}
                                                            />
                                                        </div>
                                                    ) : null}
                                                    <div className='mt-3 small text-secondary'>Mã xác thực: <strong>{spinRecord?.verificationCode || '-'}</strong></div>
                                                </CCardBody>
                                            </CCard>
                                        ) : null}
                                    </div>
                                ) : null}
                            </CCardBody>
                        </CCard>
                    </CCol>
                </CRow>
            </CContainer>
        </ErrorBoundary>
    )
}
