import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CSpinner,
} from '@coreui/react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api/axios'
import { useTenant } from '../../contexts/TenantContext'
import { resolveMediaUrl } from '../../utils/mediaUrl'
import { buildTenantUrl } from '../../utils/tenantRouting'

const PAGE_SIZE = 1000

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

function toAbsoluteUrl(url) {
  return resolveMediaUrl(url)
}

function normalizeMedia(value) {
  const media = normalizeRelation(value)
  if (!media || typeof media !== 'object') return null

  return {
    ...media,
    url: toAbsoluteUrl(media.url),
    formats: media.formats && typeof media.formats === 'object'
      ? Object.fromEntries(
        Object.entries(media.formats).map(([key, item]) => [
          key,
          item && typeof item === 'object'
            ? { ...item, url: toAbsoluteUrl(item.url) }
            : item,
        ]),
      )
      : media.formats,
  }
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
      cover: normalizeMedia(normalized.cover),
      thumbnail: normalizeMedia(normalized.thumbnail),
    }
  }).filter(Boolean)
}

function normalizeCategory(payload) {
  const row = Array.isArray(payload?.data) ? payload.data[0] : null
  if (!row || typeof row !== 'object') return null

  return row.attributes && typeof row.attributes === 'object'
    ? { id: row.id, ...row.attributes }
    : row
}

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function toCategoryTitle(name, slug) {
  const text = String(name || '').trim()
  if (text) return text
  return String(slug || '').trim() || 'Archive'
}

function formatDisplayDate(value) {
  const timestamp = Date.parse(String(value || ''))
  if (Number.isNaN(timestamp)) return '-'

  return new Date(timestamp).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function buildArchiveGroups(articles) {
  const grouped = {}

  articles.forEach((article) => {
    const displayDate = article?.publicAt || article?.publishedAt || ''
    const timestamp = Date.parse(String(displayDate || ''))
    const year = Number.isNaN(timestamp) ? 'Khac' : String(new Date(timestamp).getFullYear())
    if (!grouped[year]) grouped[year] = []
    grouped[year].push({
      ...article,
      displayDate,
    })
  })

  const years = Object.keys(grouped).sort((left, right) => {
    if (left === 'Khac') return 1
    if (right === 'Khac') return -1
    return Number(right) - Number(left)
  })

  return { years, grouped }
}

export default function CategoryArchiveTreePage() {
  const tenant = useTenant()
  const params = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [years, setYears] = useState([])
  const [groupedArticles, setGroupedArticles] = useState({})
  const [expandedYears, setExpandedYears] = useState([])
  const [category, setCategory] = useState(null)

  const tenantCode = String(params?.tenantCode || tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode || '').trim()
  const slug = String(params?.slug || '').trim()
  const isMainDomain = Boolean(tenant?.isMainDomain)
  const journalPath = buildTenantUrl('/journal', { tenantCode, isMainDomain }) || '/journal'

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
        setYears([])
        setGroupedArticles({})
        setExpandedYears([])
        setError('Slug category không hợp lệ')
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await api.get('/articles', {
          params: {
            'filters[category][slug][$eq]': slug,
            'sort[0]': 'publicAt:desc',
            'sort[1]': 'publishedAt:desc',
            'pagination[pageSize]': PAGE_SIZE,
            'populate[0]': 'cover',
          },
        })

        if (cancelled) return

        const rows = normalizeArticleList(response.data).filter((item) => item?.slug)
        const nextGroups = buildArchiveGroups(rows)
        setYears(nextGroups.years)
        setGroupedArticles(nextGroups.grouped)
        setExpandedYears(nextGroups.years.length > 0 ? [nextGroups.years[0]] : [])
      } catch (requestError) {
        if (cancelled) return
        setYears([])
        setGroupedArticles({})
        setExpandedYears([])
        setError(getApiMessage(requestError, 'Không tải được archive bài viết'))
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
  }, [slug, tenantCode])

  const categoryName = useMemo(
    () => toCategoryTitle(category?.name, slug),
    [category, slug],
  )

  function toggleYear(year) {
    setExpandedYears((previous) => previous.includes(year)
      ? previous.filter((item) => item !== year)
      : [...previous, year])
  }

  return (
    <CCard className='public-category-page public-archive-page'>
      <CCardHeader>
        <strong>Archive</strong>
      </CCardHeader>
      <CCardBody>
        <div className='mb-4 d-flex justify-content-between align-items-start gap-3 flex-wrap'>
          <div>
            <h1 className='h2 mb-2'>{categoryName}</h1>
            <div className='text-body-secondary'>Lưu trữ bài viết theo năm.</div>
          </div>
          <CButton component={Link} to={journalPath} color='secondary' variant='outline'>Back to list</CButton>
        </div>

        {error ? <CAlert color='danger' className='mb-3'>{error}</CAlert> : null}

        {loading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span>Đang tải archive...</span>
          </div>
        ) : years.length === 0 ? (
          <div className='text-center text-body-secondary py-4'>Chưa có bài viết trong archive này</div>
        ) : (
          <div className='public-archive-tree'>
            {years.map((year) => {
              const isExpanded = expandedYears.includes(year)
              const items = Array.isArray(groupedArticles[year]) ? groupedArticles[year] : []

              return (
                <section key={year} className='public-archive-year-group'>
                  <button
                    type='button'
                    className='public-archive-year-toggle'
                    onClick={() => toggleYear(year)}
                    aria-expanded={isExpanded}
                  >
                    <span className='public-archive-year-icon'>{isExpanded ? '▼' : '▶'}</span>
                    <span className='public-archive-year-label'>{year}</span>
                    <span className='public-archive-year-count'>{items.length}</span>
                  </button>

                  {isExpanded ? (
                    <div className='public-archive-year-items'>
                      {items.map((article) => {
                        const articlePath = buildTenantUrl(`/article/${encodeURIComponent(article.slug)}`, { tenantCode, isMainDomain }) || `/article/${encodeURIComponent(article.slug)}`
                        const imageUrl = String(article?.thumbnail?.formats?.thumbnail?.url || article?.thumbnail?.url || article?.cover?.formats?.thumbnail?.url || article?.cover?.url || '').trim()

                        return (
                          <Link key={article.id || `${year}-${article.slug}`} to={articlePath} className='public-archive-article-item text-decoration-none'>
                            <div className='public-archive-article-thumb'>
                              {imageUrl ? (
                                <img src={imageUrl} alt={article.title || article.slug || 'Article'} className='public-archive-article-thumb-image' />
                              ) : (
                                <div className='public-archive-article-thumb-fallback'>No image</div>
                              )}
                            </div>

                            <div className='public-archive-article-copy'>
                              <div className='public-archive-article-title'>{article.title || article.slug || `Bài viết #${article.id}`}</div>
                              <div className='public-archive-article-date'>{formatDisplayDate(article.displayDate)}</div>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  ) : null}
                </section>
              )
            })}
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}