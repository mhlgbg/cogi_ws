import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { CAlert, CButton, CSpinner } from '@coreui/react'
import { useTenant } from '../../../contexts/TenantContext'
import useTenantPageTitle from '../../../utils/useTenantPageTitle'
import {
  buildAdmissionResultLookupPath,
  getAdmissionV1ErrorMessage,
  getPublicAdmissionExamCard,
  logPublicAdmissionExamCardPrint,
} from '../services/admissionV1Service'

function normalizeRenderableHtml(rawHtml) {
  const source = String(rawHtml || '').trim()
  if (!source) return ''
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') return source

  try {
    const parser = new window.DOMParser()
    const doc = parser.parseFromString(source, 'text/html')
    const styles = Array.from(doc.head?.querySelectorAll('style') || []).map((node) => node.outerHTML).join('')
    const bodyHtml = doc.body?.innerHTML || source
    return `${styles}${bodyHtml}`
  } catch {
    return source
  }
}

function readSearchParams(search) {
  const params = new URLSearchParams(search || '')
  return {
    studentCode: String(params.get('studentCode') || '').trim(),
    applicationCode: String(params.get('applicationCode') || '').trim(),
  }
}

export default function AdmissionPublicExamCardPage() {
  useTenantPageTitle('Thẻ dự kiểm tra')
  const navigate = useNavigate()
  const location = useLocation()
  const tenant = useTenant()
  const { tenantCode, campaignCode } = useParams()
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [error, setError] = useState('')
  const [html, setHtml] = useState('')
  const [candidateNumber, setCandidateNumber] = useState('')
  const [applicationCode, setApplicationCode] = useState('')

  const lookupParams = useMemo(() => readSearchParams(location.search), [location.search])

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!campaignCode || !lookupParams.studentCode || !lookupParams.applicationCode) {
        setError('Thiếu thông tin để xem thẻ dự kiểm tra')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')

      try {
        const resolvedTenantCode = String(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim()
        const result = await getPublicAdmissionExamCard(campaignCode, lookupParams, resolvedTenantCode)
        if (!mounted) return
        setHtml(String(result?.html || '').trim())
        setCandidateNumber(String(result?.candidateNumber || '').trim())
        setApplicationCode(String(result?.applicationCode || lookupParams.applicationCode || '').trim())
      } catch (requestError) {
        if (!mounted) return
        setHtml('')
        setCandidateNumber('')
        setApplicationCode('')
        setError(getAdmissionV1ErrorMessage(requestError, 'Không thể tải thẻ dự kiểm tra'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [campaignCode, lookupParams, tenant, tenantCode])

  const renderedHtml = useMemo(() => normalizeRenderableHtml(html), [html])

  async function handleExportPdf() {
    if (loading || exportingPdf || !renderedHtml) return

    const targetElement = document.querySelector('.exam-card-rendered .exam-card-page') || document.querySelector('.exam-card-rendered')
    if (!(targetElement instanceof HTMLElement)) {
      setError('Không tìm thấy vùng thẻ dự kiểm tra để xuất PDF')
      return
    }

    setExportingPdf(true)
    setError('')

    try {
      const html2pdfModule = await import('html2pdf.js')
      const html2pdf = html2pdfModule?.default || html2pdfModule
      const safeCandidateNumber = String(candidateNumber || 'unknown').trim() || 'unknown'
      const safeApplicationCode = String(applicationCode || lookupParams.applicationCode || 'unknown').trim() || 'unknown'

      await html2pdf()
        .set({
          margin: 0,
          filename: `The-du-kiem-tra-${safeCandidateNumber}-${safeApplicationCode}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
          },
          jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
          },
        })
        .from(targetElement)
        .save()
    } catch (requestError) {
      setError(getAdmissionV1ErrorMessage(requestError, 'Không thể xuất PDF thẻ dự kiểm tra'))
    } finally {
      setExportingPdf(false)
    }
  }

  async function handlePrint() {
    if (printing) return

    setPrinting(true)
    try {
      if (campaignCode && lookupParams.studentCode && lookupParams.applicationCode) {
        const resolvedTenantCode = String(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim()
        await logPublicAdmissionExamCardPrint(campaignCode, lookupParams, resolvedTenantCode)
      }
    } catch {
      // Keep print flow non-blocking for parents.
    } finally {
      setPrinting(false)
      window.print()
    }
  }

  function handleBack() {
    const resolvedTenantCode = String(tenantCode || tenant?.resolvedTenant?.tenantCode || tenant?.currentTenant?.tenantCode || '').trim()
    navigate(buildAdmissionResultLookupPath(campaignCode, resolvedTenantCode), {
      replace: false,
      state: {
        studentCode: lookupParams.studentCode,
        applicationCode: lookupParams.applicationCode,
      },
    })
  }

  return (
    <div className='candidate-exam-card-screen' style={{ minHeight: '100vh', background: '#eef1f4', padding: '16px' }}>
      <style>{`
        .exam-card-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
          padding: 12px 16px;
          background: #ffffff;
          border: 1px solid #d8dbe0;
          border-radius: 12px;
          position: sticky;
          top: 16px;
          z-index: 20;
        }
        .exam-card-preview {
          overflow-x: auto;
          overflow-y: visible;
          background: #f3f4f7;
          padding: 16px;
        }
        .exam-card-rendered {
          background: #ffffff;
          color: #111827;
          min-width: fit-content;
        }
        @media print {
          .exam-card-toolbar {
            display: none !important;
          }
          .candidate-exam-card-screen {
            padding: 0 !important;
            background: #ffffff !important;
          }
          .exam-card-preview {
            overflow: visible !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .exam-card-rendered {
            min-width: 0 !important;
          }
        }
      `}</style>

      <div className='exam-card-toolbar'>
        <div>
          <div className='fw-semibold'>Thẻ dự kiểm tra</div>
          <div className='small text-body-secondary'>Quý phụ huynh có thể xem, in và xuất PDF trực tiếp từ trình duyệt.</div>
        </div>
        <div className='d-flex gap-2'>
          <CButton color='primary' onClick={handlePrint} disabled={loading || Boolean(error) || printing}>
            {printing ? 'Đang chuẩn bị in...' : 'In thẻ'}
          </CButton>
          <CButton color='success' onClick={handleExportPdf} disabled={loading || Boolean(error) || exportingPdf}>
            {exportingPdf ? 'Đang xuất PDF...' : 'Xuất PDF'}
          </CButton>
          <CButton color='secondary' variant='outline' onClick={handleBack}>Quay lại tra cứu</CButton>
        </div>
      </div>

      <div className='exam-card-preview'>
        {loading ? (
          <div className='d-flex align-items-center gap-2 p-4'>
            <CSpinner size='sm' />
            <span>Đang tải thẻ dự kiểm tra...</span>
          </div>
        ) : error ? (
          <div className='p-4'>
            <CAlert color='danger' className='mb-0'>{error}</CAlert>
          </div>
        ) : (
          <div className='exam-card-rendered' dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        )}
      </div>
    </div>
  )
}