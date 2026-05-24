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
  getMediaName,
  getMediaUrl,
  normalizeSingleJournalIssue,
  sanitizeHtml,
} from './journalPublicUtils'

function renderIssueFile(file, label) {
  const mediaUrl = getMediaUrl(file)
  if (!mediaUrl) return null

  const mediaName = getMediaName(file) || label
  return (
    <div className='d-flex flex-wrap gap-2'>
      <CButton component='a' href={mediaUrl} target='_blank' rel='noreferrer' color='primary' variant='outline'>
        Mo tep
      </CButton>
      <CButton component='a' href={mediaUrl} download={mediaName} color='secondary' variant='outline'>
        Tai xuong
      </CButton>
    </div>
  )
}

export default function JournalIssueDetailPage() {
  const tenant = useTenant()
  const params = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [issue, setIssue] = useState(null)

  const tenantCode = String(params?.tenantCode || tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode || '').trim()
  const slug = String(params?.slug || '').trim()
  const isMainDomain = Boolean(tenant?.isMainDomain)
  const journalPath = buildTenantUrl('/journal', { tenantCode, isMainDomain }) || '/journal'

  useEffect(() => {
    let cancelled = false

    async function loadIssue() {
      if (!slug) {
        setIssue(null)
        setError('Slug tap chi khong hop le')
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await api.get('/journal-issues', {
          params: {
            'filters[slug][$eq]': slug,
            'pagination[page]': 1,
            'pagination[pageSize]': 1,
          },
        })

        if (cancelled) return
        const nextIssue = normalizeSingleJournalIssue(response.data)
        if (!nextIssue) {
          setIssue(null)
          setError('Khong tim thay tap chi')
          return
        }

        setIssue(nextIssue)
      } catch (requestError) {
        if (cancelled) return
        setIssue(null)
        setError(getApiMessage(requestError, 'Khong tai duoc tap chi'))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadIssue()

    return () => {
      cancelled = true
    }
  }, [slug])

  const issueItems = useMemo(
    () => Array.isArray(issue?.issueItems)
      ? [...issue.issueItems].sort((left, right) => Number(left?.orderNo || 0) - Number(right?.orderNo || 0))
      : [],
    [issue?.issueItems],
  )

  const issueCategoryPath = useMemo(() => {
    const categorySlug = String(issue?.journalCategory?.slug || '').trim()
    if (!categorySlug) return ''
    return buildTenantUrl(`/journal-category/${encodeURIComponent(categorySlug)}`, { tenantCode, isMainDomain }) || `/journal-category/${encodeURIComponent(categorySlug)}`
  }, [issue?.journalCategory?.slug, tenantCode, isMainDomain])

  const issueArchivePath = useMemo(() => {
    const categorySlug = String(issue?.journalCategory?.slug || '').trim()
    if (!categorySlug) return ''
    return buildTenantUrl(`/journal-archive/${encodeURIComponent(categorySlug)}`, { tenantCode, isMainDomain }) || `/journal-archive/${encodeURIComponent(categorySlug)}`
  }, [issue?.journalCategory?.slug, tenantCode, isMainDomain])

  return (
    <CCard>
      <CCardHeader>
        <strong>Journal Issue Detail</strong>
      </CCardHeader>
      <CCardBody>
        <div className='mb-4 d-flex flex-wrap gap-2'>
          <CButton component={Link} to={journalPath} color='secondary' variant='outline'>Back to list</CButton>
          {issueCategoryPath ? <CButton component={Link} to={issueCategoryPath} color='secondary' variant='outline'>Back to category</CButton> : null}
          {issueArchivePath ? <CButton component={Link} to={issueArchivePath} color='secondary' variant='outline'>View archive</CButton> : null}
        </div>

        {loading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span>Dang tai tap chi...</span>
          </div>
        ) : null}

        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        {!loading && !error && issue ? (
          <article className='d-flex flex-column gap-4'>
            <div className='d-flex flex-column flex-lg-row gap-4 align-items-start'>
              <div style={{ width: '100%', maxWidth: 320 }}>
                {getMediaUrl(issue.coverImage) ? (
                  <img
                    src={getMediaUrl(issue.coverImage)}
                    alt={issue.title || issue.slug || 'Journal issue cover'}
                    style={{ width: '100%', borderRadius: 16, objectFit: 'cover' }}
                  />
                ) : (
                  <div className='border rounded-4 p-4 text-center text-body-secondary'>Khong co anh bia</div>
                )}
              </div>

              <div className='flex-grow-1 d-flex flex-column gap-3'>
                <div>
                  <h1 className='h2 mb-2'>{issue.title || slug}</h1>
                  <div className='text-body-secondary d-flex flex-wrap gap-3'>
                    <span>So: {issue.issueNumber || '-'}</span>
                    <span>Tap: {issue.volume || '-'}</span>
                    <span>Nam: {issue.year || '-'}</span>
                    <span>Cong khai: {formatDisplayDate(issue.publicAt || issue.publishedAt)}</span>
                  </div>
                </div>

                {issue.journalCategory?.title ? (
                  <div>
                    <div className='small text-body-secondary'>Danh muc</div>
                    {issueCategoryPath ? (
                      <Link to={issueCategoryPath} className='text-decoration-none fw-semibold'>{issue.journalCategory.title}</Link>
                    ) : (
                      <div className='fw-semibold'>{issue.journalCategory.title}</div>
                    )}
                  </div>
                ) : null}

                {issue.summary ? (
                  <div className='lh-lg' dangerouslySetInnerHTML={{ __html: sanitizeHtml(issue.summary) }} />
                ) : (
                  <div className='text-body-secondary'>Tap chi chua co tom tat.</div>
                )}

                {getMediaUrl(issue.pdfFile) ? (
                  <div>
                    <div className='small text-body-secondary mb-2'>Tep tap chi</div>
                    {renderIssueFile(issue.pdfFile, issue.title || 'Tap chi')}
                  </div>
                ) : null}
              </div>
            </div>

            <section>
              <h2 className='h4 mb-3'>Danh muc bai viet trong tap chi</h2>

              {issueItems.length === 0 ? (
                <div className='text-body-secondary'>Tap chi nay chua co item nao.</div>
              ) : (
                <CTable hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell style={{ width: 70 }}>#</CTableHeaderCell>
                      <CTableHeaderCell>Bai viet</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 220 }}>Tac gia</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>Trang</CTableHeaderCell>
                      <CTableHeaderCell style={{ width: 140 }}>DOI</CTableHeaderCell>
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
                        <CTableRow key={item.documentId || item.id || `${item.orderNo}-${item.articleTitle}`}>
                          <CTableDataCell>{item.orderNo || '-'}</CTableDataCell>
                          <CTableDataCell>
                            <div className='fw-semibold'>{item.articleTitle || '-'}</div>
                            <div className='small text-body-secondary'>{item?.article?.title || item?.article?.slug || '-'}</div>
                          </CTableDataCell>
                          <CTableDataCell>{item.authorsText || '-'}</CTableDataCell>
                          <CTableDataCell>{pageText}</CTableDataCell>
                          <CTableDataCell>{item.doi || '-'}</CTableDataCell>
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
            </section>
          </article>
        ) : null}
      </CCardBody>
    </CCard>
  )
}