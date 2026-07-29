import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CAlert, CButton, CCard, CCardBody, CContainer, CSpinner } from '@coreui/react'
import { useTenant } from '../../../contexts/TenantContext'
import { buildTenantUrl } from '../../../utils/tenantRouting'
import { completePublicRegistration, getApiMessage } from '../services/registrationCampaignPublicService'

export default function RegistrationCampaignCompletePage() {
  const navigate = useNavigate()
  const tenant = useTenant()
  const { tenantCode } = useParams()
  const [searchParams] = useSearchParams()
  const token = String(searchParams.get('token') || '').trim()
  const resolvedTenantCode = useMemo(() => String(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim(), [tenant?.currentTenant?.tenantCode, tenant?.resolvedTenant?.tenantCode, tenantCode])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const alertColor = result?.completionBlocked ? 'warning' : 'success'

  useEffect(() => {
    let cancelled = false
    async function runComplete() {
      if (!token) {
        setError('Thiếu thông tin tiếp tục đăng ký.')
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const payload = await completePublicRegistration({ token }, resolvedTenantCode)
        if (cancelled) return
        setResult(payload)
      } catch (requestError) {
        if (cancelled) return
        setError(getApiMessage(requestError, 'Không thể hoàn tất đăng ký'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    runComplete()
    return () => { cancelled = true }
  }, [resolvedTenantCode, token])

  function handleContinue() {
    const targetPath = buildTenantUrl(result?.redirectPath || '/dashboard', { tenantCode: resolvedTenantCode, isMainDomain: tenant?.isMainDomain })
    navigate(targetPath, { replace: true })
  }

  return (
    <div className='py-4 py-lg-5'>
      <CContainer style={{ maxWidth: 760 }}>
        <CCard>
          <CCardBody className='p-4 p-lg-5'>
            {loading ? <div className='text-center py-5'><CSpinner /></div> : null}
            {!loading && error ? <CAlert color='danger'>{error}</CAlert> : null}
            {!loading && result ? (
              <>
                <CAlert color={alertColor}>{result.message || 'Bạn đã tham gia chiến dịch thành công.'}</CAlert>
                {result?.completionBlocked ? <div className='text-body-secondary'>Hệ thống đã xác minh đăng ký nhưng chưa thể hoàn tất cấp quyền tự động.</div> : null}
                {!result?.completionBlocked ? (
                  <div className='d-flex justify-content-end'>
                    <CButton color='primary' onClick={handleContinue}>Tiếp tục</CButton>
                  </div>
                ) : null}
              </>
            ) : null}
          </CCardBody>
        </CCard>
      </CContainer>
    </div>
  )
}