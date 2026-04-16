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
import ArticleCard from '../../components/ArticleCard'
import SimplePagination from '../../components/SimplePagination'
import { useTenant } from '../../contexts/TenantContext'
import { buildTenantUrl } from '../../utils/tenantRouting'

const PAGE_SIZE = 10

function normalizeRelation(value) {
  if (!value) return null

  if (value.data && typeof value.data === 'object') {
    const row = value.data
    if (row.attributes && typeof row.attributes === 'object') {
      return {
        id: row.id,
        ...row.attributes,
      }
    }

    return row
  }

  if (value.attributes && typeof value.attributes === 'object') {
    return {
      id: value.id,
      ...value.attributes,
    }
  }

  return value
}

function normalizeArticleList(payload) {
  const rawRows = Array.isArray(payload?.data) ? payload.data : []

  return rawRows.map((row) => {
    if (!row || typeof row !== 'object') return null

    const normalized = row.attributes && typeof row.attributes === 'object'
      ? {
        id: row.id,
        ...row.attributes,
      }
      : row

    return {
      ...normalized,
      category: normalizeRelation(normalized.category),
      cover: normalizeRelation(normalized.cover),
      thumbnail: normalizeRelation(normalized.thumbnail),
    }
  }).filter(Boolean)
}

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function toCategoryTitle(name, slug) {
  const text = String(name || '').trim()
  if (text) return text
  return String(slug || '').trim() || 'Category'
}

function normalizeCategory(payload) {
  const row = Array.isArray(payload?.data) ? payload.data[0] : null
  if (!row || typeof row !== 'object') return null

  return row.attributes && typeof row.attributes === 'object'
    ? { id: row.id, ...row.attributes }
    : row
}

function normalizePagination(payload) {
  const pagination = payload?.meta?.pagination
  return {
    page: Number(pagination?.page || 1),
    pageCount: Math.max(1, Number(pagination?.pageCount || 1)),
    pageSize: Number(pagination?.pageSize || PAGE_SIZE),
    total: Number(pagination?.total || 0),
  }
}

export default function CategoryPage() {
  const tenant = useTenant()
  const params = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [articles, setArticles] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageCount: 1, pageSize: PAGE_SIZE, total: 0 })
  const [category, setCategory] = useState(null)

  const tenantCode = String(params?.tenantCode || tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode || '').trim()
  const slug = String(params?.slug || '').trim()
  const isMainDomain = Boolean(tenant?.isMainDomain)
  const journalPath = buildTenantUrl('/journal', { tenantCode, isMainDomain }) || '/journal'

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
        const response = await api.get('/categories', {
          params: {
            'filters[slug][$eq]': slug,
            'pagination[page]': 1,
            'pagination[pageSize]': 1,
          },
        })

        if (cancelled) return
        setCategory(normalizeCategory(response.data))
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

    async function loadArticles() {
      if (!slug) {
        setArticles([])
        setPagination({ page: 1, pageCount: 1, pageSize: PAGE_SIZE, total: 0 })
        setError('Slug category không hợp lệ')
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await api.get('/articles', {
          params: {
            'filters[category][slug][$eq]': slug,
            sort: 'publicAt:desc,publishedAt:desc',
            'pagination[page]': currentPage,
            'pagination[pageSize]': PAGE_SIZE,
            'populate[0]': 'cover',
          },
        })

        if (cancelled) return
        setArticles(normalizeArticleList(response.data))
        setPagination(normalizePagination(response.data))
      } catch (requestError) {
        if (cancelled) return
        setArticles([])
        setPagination({ page: currentPage, pageCount: 1, pageSize: PAGE_SIZE, total: 0 })
        setError(getApiMessage(requestError, 'Không tải được bài viết theo category'))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadArticles()

    return () => {
      cancelled = true
    }
  }, [slug, currentPage, tenantCode])

  const rows = useMemo(
    () => articles.filter((item) => item?.slug),
    [articles],
  )

  const categoryName = useMemo(
    () => toCategoryTitle(category?.name || rows[0]?.category?.name, slug),
    [category, rows, slug],
  )

  return (
    <CCard className='public-category-page'>
      <CCardHeader>
        <strong>Category</strong>
      </CCardHeader>
      <CCardBody>
        <div className='mb-4 d-flex justify-content-between align-items-start gap-3 flex-wrap'>
          <div>
            <h1 className='h2 mb-2'>{categoryName}</h1>
            <div className='text-body-secondary'>Danh sách bài viết thuộc category hiện tại.</div>
          </div>
          <CButton component={Link} to={journalPath} color='secondary' variant='outline'>Back to list</CButton>
        </div>

        {error ? <CAlert color='danger' className='mb-3'>{error}</CAlert> : null}

        {loading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span>Đang tải bài viết...</span>
          </div>
        ) : (
          <div>
            {rows.length === 0 ? (
              <div className='text-center text-body-secondary py-4'>Chưa có bài viết trong category này</div>
            ) : (
              <CRow className='g-4 public-category-grid'>
                {rows.map((article) => (
                  <CCol key={article.id || article.slug} xs={12}>
                    <ArticleCard article={article} />
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