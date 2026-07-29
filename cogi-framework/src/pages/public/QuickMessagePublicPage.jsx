import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CContainer,
  CSpinner,
} from '@coreui/react'
import { useTenant } from '../../contexts/TenantContext'
import QuickMessageContent from '../../components/public/QuickMessageContent'
import QuickMessagePublicConversation from '../../components/public/QuickMessagePublicConversation'
import QuickMessagePinForm from '../../components/public/QuickMessagePinForm'
import QuickMessageTenantHeader from '../../components/public/QuickMessageTenantHeader'
import QuickMessageUnavailable from '../../components/public/QuickMessageUnavailable'
import {
  applyTenantFavicon,
  resetTenantFavicon,
  setPageTitle,
} from '../../utils/tenantBranding'
import {
  getApiErrorCode,
  getApiMessage,
  lookupQuickMessage,
  normalizeQuickMessageCode,
  openQuickMessage,
  requestQuickMessageAccess,
  verifyQuickMessagePin,
} from '../../modules/crm/services/quickMessagePublicService'

const pendingAutoAccessByCode = new Map()
const OPEN_RESULT_CACHE_TTL_MS = 5000
const openedTokenRequests = new Map()

function clearOpenedTokenRequest(key) {
  const cached = openedTokenRequests.get(key)
  if (cached?.cleanupTimer) {
    window.clearTimeout(cached.cleanupTimer)
  }
  openedTokenRequests.delete(key)
}

function getOrCreateOpenedTokenRequest(key, factory) {
  const existing = openedTokenRequests.get(key)
  if (existing?.promise) {
    return existing.promise
  }

  const entry = {
    promise: null,
    cleanupTimer: null,
  }

  entry.promise = Promise.resolve()
    .then(factory)
    .then((data) => {
      entry.cleanupTimer = window.setTimeout(() => {
        clearOpenedTokenRequest(key)
      }, OPEN_RESULT_CACHE_TTL_MS)
      return data
    })
    .catch((error) => {
      clearOpenedTokenRequest(key)
      throw error
    })

  openedTokenRequests.set(key, entry)
  return entry.promise
}

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function validatePinInput(value) {
  return /^\d{4,6}$/.test(String(value || '').trim())
}

function buildUnavailableState(errorCode, fallbackStatus = '') {
  if (errorCode === 'QUICK_MESSAGE_NOT_FOUND') return 'not_found'
  if (errorCode === 'TOO_MANY_REQUESTS' || errorCode === 'TOO_MANY_PIN_ATTEMPTS') return 'rate_limited'
  return fallbackStatus ? 'unavailable' : 'generic_error'
}

export default function QuickMessagePublicPage() {
  const tenant = useTenant()
  const params = useParams()
  const pinInputRef = useRef(null)
  const openRequestKeyRef = useRef('')
  const previousTitleRef = useRef('')

  const rawCode = toText(params?.code)
  const normalizedCode = useMemo(() => normalizeQuickMessageCode(rawCode), [rawCode])

  const [phase, setPhase] = useState('loading_lookup')
  const [lookupData, setLookupData] = useState(null)
  const [contentData, setContentData] = useState(null)
  const [publicToken, setPublicToken] = useState('')
  const [pinValue, setPinValue] = useState('')
  const [pinError, setPinError] = useState('')
  const [pageError, setPageError] = useState('')
  const [rateLimitMessage, setRateLimitMessage] = useState('')
  const [replyDraft, setReplyDraft] = useState('')

  const branding = contentData?.tenant || lookupData?.tenant || tenant?.resolvedTenant || tenant?.currentTenant || null

  useEffect(() => {
    previousTitleRef.current = document.title
    return () => {
      setPublicToken('')
      resetTenantFavicon()
      if (previousTitleRef.current) {
        document.title = previousTitleRef.current
      } else {
        setPageTitle('', tenant?.resolvedTenant || tenant?.currentTenant)
      }
    }
  }, [tenant])

  useEffect(() => {
    const title = contentData?.message?.title
      ? `${contentData.message.title} - ${toText(branding?.name) || 'COGI'}`
      : `Chuyển nhanh - ${toText(branding?.name) || 'COGI'}`
    document.title = title

    let cancelled = false
    void applyTenantFavicon({
      logo: branding?.logo || '',
      favicon: branding?.favicon || '',
    }, {
      isCancelled: () => cancelled,
    })
    return () => {
      cancelled = true
    }
  }, [branding, contentData?.message?.title])

  async function performLookup(options = {}) {
    const autoAccess = options.autoAccess !== false
    if (!normalizedCode) {
      setPhase('not_found')
      setLookupData(null)
      setContentData(null)
      setPageError('Mã truy cập không hợp lệ.')
      return null
    }

    setPhase('loading_lookup')
    setPinError('')
    setPageError('')
    setRateLimitMessage('')

    try {
      const data = await lookupQuickMessage(normalizedCode)
      setLookupData(data)
      setContentData(null)

      if (!data?.available) {
        setPhase('unavailable')
        return data
      }

      if (data?.requiresPin) {
        setPhase('pin_required')
        return data
      }

      if (autoAccess) {
        await requestAccessFlow(normalizedCode)
      } else {
        setPhase('requesting_access')
      }
      return data
    } catch (error) {
      const errorCode = getApiErrorCode(error)
      setLookupData(null)
      setContentData(null)
      setPageError(getApiMessage(error, 'Không thể tra cứu thông điệp.'))
      const nextState = buildUnavailableState(errorCode)
      if (nextState === 'rate_limited') {
        setRateLimitMessage(getApiMessage(error, 'Bạn đang thao tác quá nhanh.'))
      }
      setPhase(nextState)
      return null
    }
  }

  async function requestAccessFlow(code) {
    const cacheKey = `access:${code}`
    setPhase('requesting_access')
    setPageError('')
    setRateLimitMessage('')

    let requestPromise = pendingAutoAccessByCode.get(cacheKey)
    if (!requestPromise) {
      requestPromise = requestQuickMessageAccess(code)
      pendingAutoAccessByCode.set(cacheKey, requestPromise)
    }

    try {
      const tokenData = await requestPromise
      setPublicToken(tokenData?.accessToken || '')
      await openContentOnce(code, tokenData?.accessToken || '')
    } catch (error) {
      const errorCode = getApiErrorCode(error)
      if (errorCode === 'PIN_REQUIRED') {
        setPinError('Mã truy cập này yêu cầu PIN.')
        setPhase('pin_required')
        return
      }
      if (errorCode === 'TOO_MANY_REQUESTS') {
        setRateLimitMessage(getApiMessage(error, 'Bạn đang thao tác quá nhanh.'))
        setPhase('rate_limited')
        return
      }
      if (errorCode === 'QUICK_MESSAGE_NOT_AVAILABLE') {
        await performLookup({ autoAccess: false })
        return
      }
      setPageError(getApiMessage(error, 'Không thể xin quyền truy cập tạm thời.'))
      setPhase('generic_error')
    } finally {
      pendingAutoAccessByCode.delete(cacheKey)
    }
  }

  async function openContentOnce(code, token) {
    if (!token) {
      setPageError('Phiên truy cập không hợp lệ.')
      setPhase('token_expired')
      return
    }

    const openKey = `${code}:${token}`
    openRequestKeyRef.current = openKey
    setPhase('opening_content')
    setPageError('')

    try {
      const data = await getOrCreateOpenedTokenRequest(openKey, () => openQuickMessage(code, token))
      setContentData(data)
      setPhase('content_ready')
      setPinValue('')
      setPinError('')
    } catch (error) {
      const errorCode = getApiErrorCode(error)
      if (errorCode === 'INVALID_PUBLIC_ACCESS_TOKEN' || errorCode === 'PUBLIC_ACCESS_REVOKED') {
        setPublicToken('')
        setPageError(getApiMessage(error, 'Phiên truy cập không hợp lệ hoặc đã hết hạn.'))
        setPhase('token_expired')
        return
      }
      if (errorCode === 'QUICK_MESSAGE_NOT_AVAILABLE') {
        setPublicToken('')
        await performLookup({ autoAccess: false })
        return
      }
      if (errorCode === 'TOO_MANY_REQUESTS') {
        setRateLimitMessage(getApiMessage(error, 'Bạn đang thao tác quá nhanh.'))
        setPhase('rate_limited')
        return
      }
      setPageError(getApiMessage(error, 'Không thể mở thông điệp. Nếu thử lại, thao tác có thể được tính thêm một lượt nếu request trước đã tới server.'))
      setPhase('generic_error')
    }
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const result = await performLookup({ autoAccess: true })
      if (cancelled || !result) return
    })()
    return () => {
      cancelled = true
    }
  }, [normalizedCode])

  async function handleVerifyPin(event) {
    event.preventDefault()
    const normalizedPin = toText(pinValue)
    if (!validatePinInput(normalizedPin)) {
      setPinError('PIN phải gồm 4-6 chữ số.')
      if (pinInputRef.current) pinInputRef.current.focus()
      return
    }

    setPhase('verifying_pin')
    setPinError('')
    setPageError('')

    try {
      const tokenData = await verifyQuickMessagePin(normalizedCode, normalizedPin)
      setPinValue('')
      setPublicToken(tokenData?.accessToken || '')
      await openContentOnce(normalizedCode, tokenData?.accessToken || '')
    } catch (error) {
      setPinValue('')
      const errorCode = getApiErrorCode(error)
      if (errorCode === 'INVALID_PIN') {
        setPinError(getApiMessage(error, 'PIN không đúng. Vui lòng kiểm tra lại.'))
        setPhase('pin_required')
        if (pinInputRef.current) pinInputRef.current.focus()
        return
      }
      if (errorCode === 'TOO_MANY_PIN_ATTEMPTS') {
        setRateLimitMessage(getApiMessage(error, 'Bạn đã thử quá nhiều lần. Vui lòng thử lại sau.'))
        setPhase('rate_limited')
        return
      }
      if (errorCode === 'PIN_NOT_REQUIRED') {
        await requestAccessFlow(normalizedCode)
        return
      }
      if (errorCode === 'QUICK_MESSAGE_NOT_AVAILABLE') {
        await performLookup({ autoAccess: false })
        return
      }
      setPageError(getApiMessage(error, 'Không thể xác minh PIN.'))
      setPhase('generic_error')
    }
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(normalizedCode)
    } catch {
      setPageError('Không thể sao chép mã truy cập.')
    }
  }

  async function handleReauthenticate() {
    setPublicToken('')
    setContentData(null)
    clearOpenedTokenRequest(openRequestKeyRef.current)
    openRequestKeyRef.current = ''
    await performLookup({ autoAccess: true })
  }

  return (
    <CContainer className='py-4 py-md-5'>
      <div className='mx-auto d-flex flex-column gap-4' style={{ maxWidth: 860 }}>
        <QuickMessageTenantHeader tenant={branding} message='Tra cứu và mở thông điệp chia sẻ nhanh.' />

        {(phase === 'loading_lookup' || phase === 'requesting_access' || phase === 'verifying_pin' || phase === 'opening_content') ? (
          <CCard className='border-0 shadow-sm'>
            <CCardBody className='d-flex align-items-center gap-3 p-4'>
              <CSpinner size='sm' />
              <div>
                {phase === 'loading_lookup' ? 'Đang tra cứu mã truy cập...' : null}
                {phase === 'requesting_access' ? 'Đang mở thông điệp...' : null}
                {phase === 'verifying_pin' ? 'Đang xác minh PIN...' : null}
                {phase === 'opening_content' ? 'Đang mở nội dung thông điệp...' : null}
              </div>
            </CCardBody>
          </CCard>
        ) : null}

        {phase === 'not_found' ? (
          <CCard className='border-0 shadow-sm'>
            <CCardBody className='p-4'>
              <div className='fw-semibold fs-5 mb-2'>Không tìm thấy thông điệp</div>
              <div className='text-body-secondary mb-2'>Mã: {normalizedCode || '-'}</div>
              <CAlert color='warning' className='mb-0'>Mã truy cập không tồn tại hoặc không còn khả dụng.</CAlert>
            </CCardBody>
          </CCard>
        ) : null}

        {phase === 'unavailable' ? (
          <QuickMessageUnavailable code={normalizedCode} effectiveStatus={lookupData?.effectiveStatus} onRetry={() => performLookup({ autoAccess: true })} />
        ) : null}

        {phase === 'pin_required' ? (
          <QuickMessagePinForm
            value={pinValue}
            error={pinError}
            loading={false}
            inputRef={pinInputRef}
            onChange={setPinValue}
            onSubmit={handleVerifyPin}
          />
        ) : null}

        {phase === 'token_expired' ? (
          <CCard className='border-0 shadow-sm'>
            <CCardBody className='p-4'>
              <CAlert color='warning'>{pageError || 'Phiên truy cập đã hết hạn. Vui lòng xác thực lại.'}</CAlert>
              <CButton color='primary' onClick={handleReauthenticate}>Xác thực lại</CButton>
            </CCardBody>
          </CCard>
        ) : null}

        {phase === 'rate_limited' ? (
          <CCard className='border-0 shadow-sm'>
            <CCardBody className='p-4'>
              <CAlert color='warning'>{rateLimitMessage || 'Bạn đang thao tác quá nhanh. Vui lòng thử lại sau.'}</CAlert>
              <CButton color='secondary' variant='outline' onClick={() => performLookup({ autoAccess: false })}>Thử lại</CButton>
            </CCardBody>
          </CCard>
        ) : null}

        {phase === 'generic_error' ? (
          <CCard className='border-0 shadow-sm'>
            <CCardBody className='p-4'>
              <CAlert color='danger'>{pageError || 'Không thể xử lý yêu cầu của bạn vào lúc này.'}</CAlert>
              <CButton color='secondary' variant='outline' onClick={() => performLookup({ autoAccess: true })}>Thử lại</CButton>
            </CCardBody>
          </CCard>
        ) : null}

        {phase === 'content_ready' && contentData ? (
          <>
            <QuickMessageContent data={contentData} code={normalizedCode} onCopyCode={handleCopyCode} />
            <QuickMessagePublicConversation
              code={normalizedCode}
              accessToken={publicToken}
              initialReplyEnabled={contentData?.message?.replyEnabled === true}
              draft={replyDraft}
              onDraftChange={setReplyDraft}
              onReauthenticate={() => void handleReauthenticate()}
            />
          </>
        ) : null}
      </div>
    </CContainer>
  )
}