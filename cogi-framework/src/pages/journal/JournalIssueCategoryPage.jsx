import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CSpinner,
} from '@coreui/react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api/axios'
import JournalIssueCard from '../../components/JournalIssueCard'
import SimplePagination from '../../components/SimplePagination'
import { useTenant } from '../../contexts/TenantContext'
import { buildTenantUrl } from '../../utils/tenantRouting'
import {
  getApiMessage,
  normalizeJournalCategoryList,
  normalizeJournalIssueList,
  normalizePagination,
} from './journalPublicUtils'

const PAGE_SIZE = 10

function toCategoryTitle(name, slug) {
  const text = String(name || '').trim()
  if (text) return text
  return String(slug || '').trim() || 'Danh muc tap chi'
}

export default function JournalIssueCategoryPage() {
  const tenant = useTenant()
  const params = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [issues, setIssues] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageCount: 1, pageSize: PAGE_SIZE, total: 0 })
  const [category, setCategory] = useState(null)

  const tenantCode = String(params?.tenantCode || tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode || '').trim()
  const slug = String(params?.slug || '').trim()
  const isMainDomain = Boolean(tenant?.isMainDomain)
  const journalPath = buildTenantUrl('/journal', { tenantCode, isMainDomain }) || '/journal'
  const archivePath = buildTenantUrl(`/journal-archive/${encodeURIComponent(slug)}`, { tenantCode, isMainDomain }) || `/journal-archive/${encodeURIComponent(slug)}`

  useEffect(() => {
    setCurrentPage(1)
  }, [slug])

  useEffect(() => {
    let cancelled = false

    async function loadCategory() {
      if (!slug) {
        setCategory(null)
        return
      }

      try {
        const response = await api.get('/journal-categories', {
          params: {
            'filters[slug][$eq]': slug,
            'pagination[page]': 1,
            'pagination[pageSize]': 1,
          },
        })

        if (cancelled) return
        setCategory(normalizeJournalCategoryList(response.data)[0] || null)
      } catch {
        if (cancelled) return
        setCategory(null)
      }
    }

    loadCategory()

    return () => {
      cancelled = true
    }
  }, [slug, tenantCode])

  useEffect(() => {
    let cancelled = false

    async function loadIssues() {
      if (!slug) {
        setIssues([])
        setPagination({ page: 1, pageCount: 1, pageSize: PAGE_SIZE, total: 0 })
        setError('Slug danh muc tap chi khong hop le')
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await api.get('/journal-issues', {
          params: {
            'filters[journalCategory][slug][$eq]': slug,
            'sort[0]': 'publicAt:desc',
            'sort[1]': 'year:desc',
            'sort[2]': 'updatedAt:desc',
            'pagination[page]': currentPage,
            'pagination[pageSize]': PAGE_SIZE,
          },
        })

        if (cancelled) return
        setIssues(normalizeJournalIssueList(response.data))
        setPagination(normalizePagination(response.data, PAGE_SIZE))
      } catch (requestError) {
        if (cancelled) return
        setIssues([])
        setPagination({ page: currentPage, pageCount: 1, pageSize: PAGE_SIZE, total: 0 })
        setError(getApiMessage(requestError, 'Khong tai duoc tap chi theo danh muc'))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadIssues()

    return () => {
      cancelled = true
    }
  }, [slug, currentPage, tenantCode])

  const rows = useMemo(
    () => issues.filter((item) => item?.slug),
    [issues],
  )

  const categoryName = useMemo(
    () => toCategoryTitle(category?.title || rows[0]?.journalCategory?.title, slug),
    [category, rows, slug],
  )

  return (
    <CCard className='public-category-page'>
      <CCardHeader>
        <strong>Journal Category</strong>
      </CCardHeader>
      <CCardBody>
        <div className='mb-4 d-flex justify-content-between align-items-start gap-3 flex-wrap'>
          <div>
            <h1 className='h2 mb-2'>{categoryName}</h1>
            <div className='text-body-secondary'>Danh sach tap chi thuoc danh muc hien tai.</div>
          </div>
          <div className='d-flex gap-2 flex-wrap'>
            <CButton component={Link} to={archivePath} color='secondary' variant='outline'>Xem archive</CButton>
            <CButton component={Link} to={journalPath} color='secondary' variant='outline'>Back to list</CButton>
          </div>
        </div>

        {error ? <CAlert color='danger' className='mb-3'>{error}</CAlert> : null}

        {loading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span>Dang tai tap chi...</span>
          </div>
        ) : (
          <div>
            {rows.length === 0 ? (
              <div className='text-center text-body-secondary py-4'>Chua co tap chi trong danh muc nay</div>
            ) : (
              <CRow className='g-4 public-category-grid'>
                {rows.map((issue) => (
                  <CCol key={issue.documentId || issue.id || issue.slug} xs={12} md={6}>
                    <JournalIssueCard issue={issue} />
                  </CCol>
                ))}
              </CRow>
            )}

            <div className='public-category-pagination-wrap'>
              <SimplePagination
                currentPage={pagination.page}
                pageCount={pagination.pageCount}
                disabled={loading}
                onPageChange={(nextPage) => {
                  if (nextPage === currentPage) return
                  setCurrentPage(nextPage)
                }}
              />
            </div>
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}