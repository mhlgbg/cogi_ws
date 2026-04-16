import { Link, useParams } from 'react-router-dom'
import api from '../api/axios'
import { useTenant } from '../contexts/TenantContext'
import { buildTenantUrl } from '../utils/tenantRouting'

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
  const raw = String(url || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw

  try {
    const apiBase = String(api.defaults.baseURL || window.location.origin)
    const origin = new URL(apiBase, window.location.origin).origin
    return new URL(raw, origin).toString()
  } catch {
    return raw
  }
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

function formatDisplayDate(value) {
  const timestamp = Date.parse(String(value || ''))
  if (Number.isNaN(timestamp)) return '-'

  return new Date(timestamp).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export default function ArticleCard({ article }) {
  const tenant = useTenant()
  const params = useParams()

  const tenantCode = String(params?.tenantCode || tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode || '').trim()
  const isMainDomain = Boolean(tenant?.isMainDomain)
  const slug = String(article?.slug || '').trim()
  const articlePath = buildTenantUrl(`/article/${encodeURIComponent(slug)}`, { tenantCode, isMainDomain }) || `/article/${encodeURIComponent(slug)}`

  const thumbnail = normalizeMedia(article?.thumbnail)
  const cover = normalizeMedia(article?.cover)
  const imageUrl = String(thumbnail?.formats?.thumbnail?.url || thumbnail?.url || cover?.formats?.thumbnail?.url || cover?.url || '').trim()
  const title = String(article?.title || article?.slug || `Bài viết #${article?.id || ''}`).trim()
  const displayDate = article?.publicAt || article?.publishedAt || ''

  return (
    <Link to={articlePath} className='public-homepage-article-card public-category-article-card text-decoration-none'>
      <div className='public-homepage-article-media public-category-article-media'>
        {imageUrl ? (
          <img src={imageUrl} alt={title || 'Article cover'} className='public-homepage-article-image' />
        ) : (
          <div className='public-homepage-article-image-fallback'>Không có ảnh</div>
        )}
      </div>

      <div className='public-homepage-article-body public-category-article-body'>
        <div>
          <div className='public-homepage-article-title public-category-article-title'>{title || '-'}</div>
          <div className='public-homepage-article-date'>{formatDisplayDate(displayDate)}</div>
        </div>

        <div className='public-category-article-action'>
          <span className='public-category-article-button'>Xem thêm</span>
        </div>
      </div>
    </Link>
  )
}