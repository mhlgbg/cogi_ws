import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CSpinner,
} from '@coreui/react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api/axios'
import SliderComponent from '../../components/SliderComponent'
import UsefulLinks from '../../components/UsefulLinks'
import { useTenant } from '../../contexts/TenantContext'
import { getTenantConfigByKey } from '../../modules/content-management/services/tenantConfigService'
import { getSliderByCode } from '../../modules/content-management/services/sliderService'
import { buildTenantUrl } from '../../utils/tenantRouting'

const PAGE_SIZE = 3

function normalizeHomepageLayout(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      sliderCode: '',
      sloganHtml: '',
      mainSectionCategorySlug: '',
      sideBanner: {
        alt: '',
        imageUrl: '',
        link: '',
        openInNewTab: false,
      },
      usefulLinks: {
        code: '',
        items: [],
      },
    }
  }

  const directSliderCode = String(payload?.slider?.code || '').trim()
  const nestedSliderCode = String(payload?.homepageLayout?.slider?.code || '').trim()
  const directSloganHtml = String(payload?.slogan?.html || '').trim()
  const nestedSloganHtml = String(payload?.homepageLayout?.slogan?.html || '').trim()
  const directMainSectionCategorySlug = String(payload?.mainSection?.categorySlug || '').trim()
  const nestedMainSectionCategorySlug = String(payload?.homepageLayout?.mainSection?.categorySlug || '').trim()
  const directSideBanner = payload?.sideBanner && typeof payload.sideBanner === 'object' ? payload.sideBanner : null
  const nestedSideBanner = payload?.homepageLayout?.sideBanner && typeof payload.homepageLayout.sideBanner === 'object'
    ? payload.homepageLayout.sideBanner
    : null
  const sideBanner = directSideBanner || nestedSideBanner || null
  const directUsefulLinks = payload?.usefulLinks && typeof payload.usefulLinks === 'object' ? payload.usefulLinks : null
  const nestedUsefulLinks = payload?.homepageLayout?.usefulLinks && typeof payload.homepageLayout.usefulLinks === 'object'
    ? payload.homepageLayout.usefulLinks
    : null
  const usefulLinks = directUsefulLinks || nestedUsefulLinks || null

  return {
    sliderCode: directSliderCode || nestedSliderCode || '',
    sloganHtml: directSloganHtml || nestedSloganHtml || '',
    mainSectionCategorySlug: directMainSectionCategorySlug || nestedMainSectionCategorySlug || '',
    sideBanner: {
      alt: String(sideBanner?.alt || '').trim(),
      imageUrl: String(sideBanner?.imageUrl || '').trim(),
      link: String(sideBanner?.link || '').trim(),
      openInNewTab: Boolean(sideBanner?.openInNewTab),
    },
    usefulLinks: {
      code: String(usefulLinks?.code || usefulLinks?.sliderCode || '').trim(),
      items: Array.isArray(usefulLinks?.items) ? usefulLinks.items : [],
    },
  }
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

function sanitizeHtml(html) {
  const source = String(html || '').trim()
  if (!source) return ''

  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return source
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
      .replace(/\s(href|src)\s*=\s*(['"])javascript:.*?\2/gi, '')
  }

  const parser = new DOMParser()
  const documentNode = parser.parseFromString(source, 'text/html')
  const blockedTags = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base']

  blockedTags.forEach((tagName) => {
    documentNode.querySelectorAll(tagName).forEach((node) => node.remove())
  })

  documentNode.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = String(attribute.name || '').toLowerCase()
      const value = String(attribute.value || '')

      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name)
        return
      }

      if ((name === 'href' || name === 'src') && /^javascript:/i.test(value.trim())) {
        element.removeAttribute(attribute.name)
      }
    })
  })

  return documentNode.body.innerHTML
}

function normalizeArticleList(payload) {
  const rawRows = Array.isArray(payload?.data) ? payload.data : []

  return rawRows.map((row) => {
    if (!row || typeof row !== 'object') return null

    const base = row.attributes && typeof row.attributes === 'object'
      ? {
        id: row.id,
        ...row.attributes,
      }
      : row

    const cover = base?.cover?.data?.attributes && typeof base.cover.data.attributes === 'object'
      ? {
        id: base.cover.data.id,
        ...base.cover.data.attributes,
        url: toAbsoluteUrl(base.cover.data.attributes.url),
      }
      : base?.cover?.attributes && typeof base.cover.attributes === 'object'
        ? {
          id: base.cover.id,
          ...base.cover.attributes,
          url: toAbsoluteUrl(base.cover.attributes.url),
        }
        : base?.cover && typeof base.cover === 'object'
          ? {
            ...base.cover,
            url: toAbsoluteUrl(base.cover.url),
          }
          : null

    const category = base?.category?.data?.attributes && typeof base.category.data.attributes === 'object'
      ? {
        id: base.category.data.id,
        ...base.category.data.attributes,
      }
      : base?.category?.attributes && typeof base.category.attributes === 'object'
        ? {
          id: base.category.id,
          ...base.category.attributes,
        }
        : base?.category && typeof base.category === 'object'
          ? base.category
          : null

    return {
      ...base,
      cover,
      category,
    }
  }).filter(Boolean)
}

function formatPublishedDate(value) {
  const timestamp = Date.parse(String(value || ''))
  if (Number.isNaN(timestamp)) return '-'
  return new Date(timestamp).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

export default function JournalHomePage() {
  const tenant = useTenant()
  const params = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [articles, setArticles] = useState([])
  const [homepageSliderCode, setHomepageSliderCode] = useState('')
  const [homepageSloganHtml, setHomepageSloganHtml] = useState('')
  const [mainSectionCategorySlug, setMainSectionCategorySlug] = useState('')
  const [sideBanner, setSideBanner] = useState({ alt: '', imageUrl: '', link: '', openInNewTab: false })
  const [sideBannerImageFailed, setSideBannerImageFailed] = useState(false)
  const [usefulLinksItems, setUsefulLinksItems] = useState([])

  const tenantCode = String(params?.tenantCode || tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode || '').trim()
  const isMainDomain = Boolean(tenant?.isMainDomain)

  useEffect(() => {
    let cancelled = false

    async function loadHomepageData() {
      setLoading(true)
      setError('')

      try {
        const homepageLayoutConfig = await getTenantConfigByKey('homepageLayout', { tenantCode })

        if (cancelled) return
        const homepageLayout = normalizeHomepageLayout(homepageLayoutConfig?.jsonContent)
        const articleParams = {
          sort: 'publicAt:desc,publishedAt:desc',
          'populate[0]': 'cover',
          'populate[1]': 'category',
          'pagination[page]': 1,
          'pagination[pageSize]': PAGE_SIZE,
        }

        if (homepageLayout.mainSectionCategorySlug) {
          articleParams['filters[category][slug][$eq]'] = homepageLayout.mainSectionCategorySlug
        }

        const [response, usefulLinksRows] = await Promise.all([
          api.get('/articles', {
            params: articleParams,
          }),
          homepageLayout.usefulLinks.code
            ? getSliderByCode(homepageLayout.usefulLinks.code)
            : Promise.resolve(homepageLayout.usefulLinks.items),
        ])

        if (cancelled) return
        setArticles(normalizeArticleList(response.data))
        setHomepageSliderCode(homepageLayout.sliderCode)
        setHomepageSloganHtml(sanitizeHtml(homepageLayout.sloganHtml))
        setMainSectionCategorySlug(homepageLayout.mainSectionCategorySlug)
        setSideBanner({
          ...homepageLayout.sideBanner,
          imageUrl: toAbsoluteUrl(homepageLayout.sideBanner.imageUrl),
        })
        setSideBannerImageFailed(false)
        setUsefulLinksItems(Array.isArray(usefulLinksRows) ? usefulLinksRows : [])
      } catch (requestError) {
        if (cancelled) return
        setArticles([])
        setHomepageSliderCode('')
        setHomepageSloganHtml('')
        setMainSectionCategorySlug('')
        setSideBanner({ alt: '', imageUrl: '', link: '', openInNewTab: false })
        setSideBannerImageFailed(false)
        setUsefulLinksItems([])
        setError(getApiMessage(requestError, 'Không tải được danh sách bài viết'))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadHomepageData()

    return () => {
      cancelled = true
    }
  }, [tenantCode])

  const rows = useMemo(
    () => articles.slice(0, PAGE_SIZE),
    [articles],
  )

  const bannerAlt = String(sideBanner?.alt || '').trim() || 'Banner'
  const bannerImageUrl = String(sideBanner?.imageUrl || '').trim()
  const bannerLink = String(sideBanner?.link || '').trim()
  const showBannerImage = Boolean(bannerImageUrl) && !sideBannerImageFailed

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader>
            <strong>Journal</strong>
          </CCardHeader>
          <CCardBody>
            {homepageSliderCode ? <SliderComponent code={homepageSliderCode} className='mb-4' /> : null}

            {homepageSloganHtml ? (
              <div className='public-homepage-slogan'>
                <div
                  className='public-homepage-slogan-inner'
                  dangerouslySetInnerHTML={{ __html: homepageSloganHtml }}
                />
              </div>
            ) : null}

            {error ? <CAlert color='danger' className='mb-3'>{error}</CAlert> : null}

            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải bài viết...</span>
              </div>
            ) : (
              <div className='public-homepage-main-section'>
                <div className='public-homepage-main-column'>
                  {/*mainSectionCategorySlug ? (
                    <div className='public-homepage-section-heading'>Chuyên mục: {mainSectionCategorySlug}</div>
                  ) : null*/}

                  {rows.length === 0 ? (
                    <div className='text-center text-body-secondary py-4'>Chưa có bài viết để hiển thị</div>
                  ) : (
                    <CRow className='g-3'>
                      {rows.map((article) => {
                        const articlePath = buildTenantUrl(`/article/${encodeURIComponent(article.slug)}`, { tenantCode, isMainDomain }) || `/article/${encodeURIComponent(article.slug)}`
                        const hasArticleLink = Boolean(String(article?.slug || '').trim())
                        const coverUrl = String(article?.cover?.url || '').trim()
                        const displayDate = article?.publicAt || article?.publishedAt || ''

                        return (
                          <CCol key={article.id || article.slug} xs={12} md={4}>
                            {hasArticleLink ? (
                              <Link to={articlePath} className='public-homepage-article-card text-decoration-none'>
                                <div className='public-homepage-article-media'>
                                  {coverUrl ? (
                                    <img src={coverUrl} alt={article.title || article.slug || 'Article cover'} className='public-homepage-article-image' />
                                  ) : (
                                    <div className='public-homepage-article-image-fallback'>Không có ảnh</div>
                                  )}
                                </div>
                                <div className='public-homepage-article-body'>
                                  <div className='public-homepage-article-title'>{article.title || article.slug || `Bài viết #${article.id}`}</div>
                                  <div className='public-homepage-article-date'>{formatPublishedDate(displayDate)}</div>
                                </div>
                              </Link>
                            ) : (
                              <div className='public-homepage-article-card'>
                                <div className='public-homepage-article-media'>
                                  {coverUrl ? (
                                    <img src={coverUrl} alt={article.title || article.slug || 'Article cover'} className='public-homepage-article-image' />
                                  ) : (
                                    <div className='public-homepage-article-image-fallback'>Không có ảnh</div>
                                  )}
                                </div>
                                <div className='public-homepage-article-body'>
                                  <div className='public-homepage-article-title'>{article.title || article.slug || `Bài viết #${article.id}`}</div>
                                  <div className='public-homepage-article-date'>{formatPublishedDate(displayDate)}</div>
                                </div>
                              </div>
                            )}
                          </CCol>
                        )
                      })}
                    </CRow>
                  )}
                </div>

                <aside className='public-homepage-side-column'>
                  {bannerLink ? (
                    <a
                      href={bannerLink}
                      className='public-homepage-side-banner'
                      {...(sideBanner.openInNewTab ? { target: '_blank', rel: 'noreferrer' } : {})}
                    >
                      {showBannerImage ? (
                        <img
                          src={bannerImageUrl}
                          alt={bannerAlt}
                          className='public-homepage-side-banner-image'
                          onError={() => setSideBannerImageFailed(true)}
                        />
                      ) : (
                        <div className='public-homepage-side-banner-fallback'>{bannerAlt}</div>
                      )}
                    </a>
                  ) : showBannerImage ? (
                    <img
                      src={bannerImageUrl}
                      alt={bannerAlt}
                      className='public-homepage-side-banner-image public-homepage-side-banner-standalone'
                      onError={() => setSideBannerImageFailed(true)}
                    />
                  ) : (
                    <div className='public-homepage-side-banner-fallback public-homepage-side-banner-standalone'>{bannerAlt}</div>
                  )}
                </aside>
              </div>
            )}

            {usefulLinksItems.length > 0 ? (
              <section className='public-homepage-useful-links-section'>
                <h2 className='public-homepage-useful-links-title'>Liên kết hữu ích</h2>
                <UsefulLinks items={usefulLinksItems} />
              </section>
            ) : null}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}