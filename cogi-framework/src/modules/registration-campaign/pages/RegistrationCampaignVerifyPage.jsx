import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { CAlert, CButton, CCard, CCardBody, CContainer, CSpinner } from '@coreui/react'
import { useTenant } from '../../../contexts/TenantContext'
import { buildTenantUrl } from '../../../utils/tenantRouting'
import { getApiMessage, verifyPublicRegistration } from '../services/registrationCampaignPublicService'

const verifyRequestCache = new Map()

function getOrCreateVerifyRequest(token, tenantCode) {
  const normalizedToken = String(token || '').trim()
  if (!normalizedToken) return Promise.resolve(null)

  const requestKey = `${normalizedToken}::${String(tenantCode || '').trim()}`
  const existing = verifyRequestCache.get(requestKey)
  if (existing) return existing

  const request = verifyPublicRegistration(normalizedToken, tenantCode)
    .finally(() => {
      verifyRequestCache.delete(requestKey)
    })

  verifyRequestCache.set(requestKey, request)
  return request
}

export default function RegistrationCampaignVerifyPage() {
  const navigate = useNavigate()
  const tenant = useTenant()
  const { tenantCode } = useParams()
  const [searchParams] = useSearchParams()
  const token = String(searchParams.get('token') || '').trim()
  const resolvedTenantCode = useMemo(() => String(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim(), [tenant?.currentTenant?.tenantCode, tenant?.resolvedTenant?.tenantCode, tenantCode])
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const alertColor = result?.completionBlocked ? 'warning' : 'success'

  useEffect(() => {
    let cancelled = false
    async function runVerify() {
      if (!token) {
        setError('Liên kết xác minh không hợp lệ.')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')
      try {
        const payload = await getOrCreateVerifyRequest(token, resolvedTenantCode)
        if (cancelled) return
        setResult(payload)
      } catch (requestError) {
        if (cancelled) return
        setError(getApiMessage(requestError, 'Không thể xác minh đăng ký'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    runVerify()
    return () => { cancelled = true }
  }, [resolvedTenantCode, token])

  function handleContinue() {
    if (result?.completeAccountPath) {
      navigate(result.completeAccountPath, { replace: true })
      return
    }
    if (result?.loginPath) {
      navigate(result.loginPath, { replace: true })
      return
    }
    if (result?.redirectPath) {
      navigate(buildTenantUrl(result.redirectPath, { tenantCode: resolvedTenantCode, isMainDomain: tenant?.isMainDomain }), { replace: true })
    }
  }

  function handleGoLogin() {
    navigate(buildTenantUrl('/login', { tenantCode: resolvedTenantCode, isMainDomain: tenant?.isMainDomain }), { replace: true })
  }

  return (
    <div className='py-4 py-lg-5'>
      <CContainer style={{ maxWidth: 760 }}>
        <CCard>
          <CCardBody className='p-4 p-lg-5'>
            {loading ? (
              <div className='text-center py-5'><CSpinner /></div>
            ) : (
              <>
                {error ? <CAlert color='danger'>{error}</CAlert> : null}
                {result?.message ? <CAlert color={alertColor}>{result.message}</CAlert> : null}
                {result?.nextAction === 'await_approval' ? <div className='text-body-secondary'>Email đã được xác minh. Đăng ký của bạn đang chờ phê duyệt.</div> : null}
                {result?.nextAction === 'login' ? <div className='text-body-secondary'>Email này đã có tài khoản. Hãy đăng nhập để hoàn tất tham gia chiến dịch.</div> : null}
                {result?.nextAction === 'complete_account' ? <div className='text-body-secondary'>Email đã được xác minh. Hãy đặt mật khẩu để hoàn tất tài khoản.</div> : null}
                {result?.nextAction === 'await_support' ? <div className='text-body-secondary'>Đăng ký của bạn đã được xác minh, nhưng chiến dịch đang thiếu cấu hình hoàn tất tự động.</div> : null}
                <div className='d-flex flex-wrap gap-2 mt-4'>
                  {(result?.completeAccountPath || result?.loginPath || result?.redirectPath) ? <CButton color='primary' onClick={handleContinue}>Tiếp tục</CButton> : null}
                  <CButton color='secondary' variant='outline' onClick={handleGoLogin}>Về trang đăng nhập</CButton>
                </div>
              </>
            )}
          </CCardBody>
        </CCard>
      </CContainer>
    </div>
  )
}