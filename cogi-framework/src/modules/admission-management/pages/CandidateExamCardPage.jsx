import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CAlert, CButton, CSpinner } from '@coreui/react'
import { getCandidateExamExamCard } from '../services/admissionManagementService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

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

export default function CandidateExamCardPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [html, setHtml] = useState('')

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!id) {
        setError('Không tìm thấy mã thí sinh dự kiểm tra')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')
      try {
        const result = await getCandidateExamExamCard(id)
        if (!mounted) return
        setHtml(String(result?.html || '').trim())
      } catch (requestError) {
        if (!mounted) return
        setHtml('')
        setError(getApiMessage(requestError, 'Không thể tải thẻ dự kiểm tra'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [id])

  const renderedHtml = useMemo(() => normalizeRenderableHtml(html), [html])

  function handleBack() {
    if (window.opener && !window.opener.closed) {
      window.close()
      return
    }
    navigate(-1)
  }

  function handlePrint() {
    window.print()
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
          <div className='fw-semibold'>Xem thẻ dự kiểm tra</div>
          <div className='small text-body-secondary'>Thẻ được render từ mẫu HTML của kỳ tuyển sinh hiện tại.</div>
        </div>
        <div className='d-flex gap-2'>
          <CButton color='secondary' variant='outline' onClick={handleBack}>Quay lại</CButton>
          <CButton color='primary' onClick={handlePrint} disabled={loading || Boolean(error)}>In thẻ</CButton>
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
