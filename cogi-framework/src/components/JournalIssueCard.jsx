import { Link, useParams } from 'react-router-dom'
import { useTenant } from '../contexts/TenantContext'
import { buildTenantUrl } from '../utils/tenantRouting'
import { formatDisplayDate } from '../pages/journal/journalPublicUtils'

export default function JournalIssueCard({ issue }) {
  const tenant = useTenant()
  const params = useParams()

  const tenantCode = String(params?.tenantCode || tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode || '').trim()
  const isMainDomain = Boolean(tenant?.isMainDomain)
  const slug = String(issue?.slug || '').trim()
  const issuePath = buildTenantUrl(`/journal-issue/${encodeURIComponent(slug)}`, { tenantCode, isMainDomain }) || `/journal-issue/${encodeURIComponent(slug)}`

  const cover = issue?.coverImage
  const imageUrl = String(cover?.formats?.thumbnail?.url || cover?.url || '').trim()
  const title = String(issue?.title || issue?.slug || `Tap chi #${issue?.id || ''}`).trim()
  const displayDate = issue?.publicAt || issue?.publishedAt || ''
  const categoryTitle = String(issue?.journalCategory?.title || '').trim()

  return (
    <Link to={issuePath} className='public-homepage-article-card public-category-article-card text-decoration-none'>
      <div className='public-homepage-article-media public-category-article-media'>
        {imageUrl ? (
          <img src={imageUrl} alt={title || 'Journal issue cover'} className='public-homepage-article-image' />
        ) : (
          <div className='public-homepage-article-image-fallback'>Khong co anh</div>
        )}
      </div>

      <div className='public-homepage-article-body public-category-article-body'>
        <div>
          {categoryTitle ? <div className='small text-body-secondary mb-1'>{categoryTitle}</div> : null}
          <div className='public-homepage-article-title public-category-article-title'>{title || '-'}</div>
          <div className='public-homepage-article-date'>
            So {issue?.issueNumber || '-'}
            {issue?.volume ? ` | Tap ${issue.volume}` : ''}
            {issue?.year ? ` | ${issue.year}` : ''}
          </div>
          <div className='public-homepage-article-date'>{formatDisplayDate(displayDate)}</div>
        </div>

        <div className='public-category-article-action'>
          <span className='public-category-article-button'>Xem tap chi</span>
        </div>
      </div>
    </Link>
  )
}