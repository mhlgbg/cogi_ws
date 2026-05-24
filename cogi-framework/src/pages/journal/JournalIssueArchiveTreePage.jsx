import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api/axios'
import { useTenant } from '../../contexts/TenantContext'
import { buildTenantUrl } from '../../utils/tenantRouting'
import {
  formatDisplayDate,
  getApiMessage,
  getMediaUrl,
  normalizeJournalCategoryList,
  normalizeJournalIssueList,
} from './journalPublicUtils'

const PAGE_SIZE = 1000

function toCategoryTitle(name, slug) {
  const text = String(name || '').trim()
  if (text) return text
  return String(slug || '').trim() || 'Archive'
}

function buildArchiveGroups(issues) {
  const grouped = {}

  issues.forEach((issue) => {
    const displayDate = issue?.publicAt || issue?.publishedAt || ''
    const timestamp = Date.parse(String(displayDate || ''))
    const year = Number.isNaN(timestamp)
      ? (String(issue?.year || '').trim() || 'Khac')
      : String(new Date(timestamp).getFullYear())

    if (!grouped[year]) grouped[year] = []
    grouped[year].push({
      ...issue,
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

export default function JournalIssueArchiveTreePage() {
  const tenant = useTenant()
  const params = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [years, setYears] = useState([])
  const [groupedIssues, setGroupedIssues] = useState({})
  const [expandedYears, setExpandedYears] = useState([])
  const [expandedIssues, setExpandedIssues] = useState([])
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
        setYears([])
        setGroupedIssues({})
        setExpandedYears([])
        setExpandedIssues([])
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
            'pagination[pageSize]': PAGE_SIZE,
          },
        })

        if (cancelled) return

        const rows = normalizeJournalIssueList(response.data).filter((item) => item?.slug)
        const nextGroups = buildArchiveGroups(rows)
        setYears(nextGroups.years)
        setGroupedIssues(nextGroups.grouped)
        setExpandedYears(nextGroups.years.length > 0 ? [nextGroups.years[0]] : [])
        setExpandedIssues([])
      } catch (requestError) {
        if (cancelled) return
        setYears([])
        setGroupedIssues({})
        setExpandedYears([])
        setExpandedIssues([])
        setError(getApiMessage(requestError, 'Khong tai duoc archive tap chi'))
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
  }, [slug, tenantCode])

  const categoryName = useMemo(
    () => toCategoryTitle(category?.title, slug),
    [category, slug],
  )

  function toggleYear(year) {
    setExpandedYears((previous) => previous.includes(year)
      ? previous.filter((item) => item !== year)
      : [...previous, year])
  }

  function toggleIssue(issueKey) {
    setExpandedIssues((previous) => previous.includes(issueKey)
      ? previous.filter((item) => item !== issueKey)
      : [...previous, issueKey])
  }

  return (
    <CCard className='public-category-page public-archive-page'>
      <CCardHeader>
        <strong>Journal Archive</strong>
      </CCardHeader>
      <CCardBody>
        <div className='mb-4 d-flex justify-content-between align-items-start gap-3 flex-wrap'>
          <div>
            <h1 className='h2 mb-2'>{categoryName}</h1>
            <div className='text-body-secondary'>Luu tru tap chi theo nam.</div>
          </div>
          <CButton component={Link} to={journalPath} color='secondary' variant='outline'>Back to list</CButton>
        </div>

        {error ? <CAlert color='danger' className='mb-3'>{error}</CAlert> : null}

        {loading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span>Dang tai archive...</span>
          </div>
        ) : years.length === 0 ? (
          <div className='text-center text-body-secondary py-4'>Chua co tap chi trong archive nay</div>
        ) : (
          <div className='public-archive-tree'>
            {years.map((year) => {
              const isExpanded = expandedYears.includes(year)
              const items = Array.isArray(groupedIssues[year]) ? groupedIssues[year] : []

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
                      {items.map((issue) => {
                        const issuePath = buildTenantUrl(`/journal-issue/${encodeURIComponent(issue.slug)}`, { tenantCode, isMainDomain }) || `/journal-issue/${encodeURIComponent(issue.slug)}`
                        const imageUrl = String(issue?.coverImage?.formats?.thumbnail?.url || issue?.coverImage?.url || '').trim()
                        const issueKey = String(issue.documentId || issue.id || `${year}-${issue.slug}`)
                        const isIssueExpanded = expandedIssues.includes(issueKey)
                        const issueItems = Array.isArray(issue?.issueItems)
                          ? [...issue.issueItems].sort((left, right) => Number(left?.orderNo || 0) - Number(right?.orderNo || 0))
                          : []

                        return (
                          <div key={issueKey} className='d-flex flex-column gap-3'>
                            <button
                              type='button'
                              className='public-archive-article-item text-decoration-none text-start border-0 bg-transparent p-0'
                              onClick={() => toggleIssue(issueKey)}
                              aria-expanded={isIssueExpanded}
                            >
                              <div className='public-archive-article-thumb'>
                                {imageUrl ? (
                                  <img src={imageUrl} alt={issue.title || issue.slug || 'Journal issue'} className='public-archive-article-thumb-image' />
                                ) : (
                                  <div className='public-archive-article-thumb-fallback'>No image</div>
                                )}
                              </div>

                              <div className='public-archive-article-copy'>
                                <div className='public-archive-article-title'>{issue.title || issue.slug || `Tap chi #${issue.id}`}</div>
                                <div className='public-archive-article-date'>
                                  So {issue.issueNumber || '-'}{issue.volume ? ` | Tap ${issue.volume}` : ''}
                                </div>
                                <div className='public-archive-article-date'>{formatDisplayDate(issue.displayDate || issue.year)}</div>
                                <div className='small text-body-secondary mt-1'>
                                  {isIssueExpanded ? 'An muc luc bai viet' : 'Nhan de xem nhanh cac item trong tap chi'}
                                </div>
                              </div>
                            </button>

                            {isIssueExpanded ? (
                              <div className='border rounded-4 p-3 bg-body-tertiary'>
                                <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap mb-3'>
                                  <div>
                                    <div className='fw-semibold'>Muc luc bai viet</div>
                                    <div className='small text-body-secondary'>Chon bai viet hoac mo PDF item de di nhanh.</div>
                                  </div>
                                  <CButton component={Link} to={issuePath} size='sm' color='secondary' variant='outline'>Xem trang chi tiet</CButton>
                                </div>

                                {issueItems.length === 0 ? (
                                  <div className='text-body-secondary'>Tap chi nay chua co item nao.</div>
                                ) : (
                                  <CTable hover responsive className='mb-0'>
                                    <CTableHead>
                                      <CTableRow>
                                        <CTableHeaderCell style={{ width: 70 }}>#</CTableHeaderCell>
                                        <CTableHeaderCell>Bai viet</CTableHeaderCell>
                                        <CTableHeaderCell style={{ width: 220 }}>Tac gia</CTableHeaderCell>
                                        <CTableHeaderCell style={{ width: 140 }}>Trang</CTableHeaderCell>
                                        <CTableHeaderCell style={{ width: 220 }}>Xem</CTableHeaderCell>
                                      </CTableRow>
                                    </CTableHead>
                                    <CTableBody>
                                      {issueItems.map((item) => {
                                        const articleSlug = String(item?.article?.slug || '').trim()
                                        const articlePath = articleSlug
                                          ? (buildTenantUrl(`/article/${encodeURIComponent(articleSlug)}`, { tenantCode, isMainDomain }) || `/article/${encodeURIComponent(articleSlug)}`)
                                          : ''
                                        const itemPdfUrl = getMediaUrl(item?.pdfFile)
                                        const pageText = item?.pageText || ((item?.startPage || item?.endPage)
                                          ? `${item?.startPage || ''}${item?.endPage ? ` - ${item.endPage}` : ''}`
                                          : '-')

                                        return (
                                          <CTableRow key={item.documentId || item.id || `${issueKey}-${item.orderNo}` }>
                                            <CTableDataCell>{item.orderNo || '-'}</CTableDataCell>
                                            <CTableDataCell>
                                              <div className='fw-semibold'>{item.articleTitle || '-'}</div>
                                              <div className='small text-body-secondary'>{item?.article?.title || item?.article?.slug || '-'}</div>
                                            </CTableDataCell>
                                            <CTableDataCell>{item.authorsText || '-'}</CTableDataCell>
                                            <CTableDataCell>{pageText}</CTableDataCell>
                                            <CTableDataCell>
                                              <div className='d-flex flex-wrap gap-2'>
                                                {articlePath ? <CButton component={Link} to={articlePath} size='sm' color='primary' variant='outline'>Xem bai</CButton> : null}
                                                {itemPdfUrl ? <CButton component='a' href={itemPdfUrl} target='_blank' rel='noreferrer' size='sm' color='secondary' variant='outline'>Xem PDF</CButton> : null}
                                                {!articlePath && !itemPdfUrl ? <span className='text-body-secondary small'>-</span> : null}
                                              </div>
                                            </CTableDataCell>
                                          </CTableRow>
                                        )
                                      })}
                                    </CTableBody>
                                  </CTable>
                                )}
                              </div>
                            ) : null}
                          </div>
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