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

function toAbsoluteUrl(url) {
  return resolveMediaUrl(url)
}

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

function normalizeMedia(value) {
  const relation = normalizeRelation(value)
  if (!relation || typeof relation !== 'object') return relation

  return {
    ...relation,
    url: toAbsoluteUrl(relation.url),
    attributes: relation.attributes
      ? {
        ...relation.attributes,
        url: toAbsoluteUrl(relation.attributes.url),
      }
      : relation.attributes,
  }
}

function normalizeBlock(block) {
  if (!block || typeof block !== 'object') return null
  const componentKey = String(block.__component || block.component || '').trim()
  if (!componentKey) return null

  if (componentKey === 'shared.media') {
    return {
      ...block,
      __component: componentKey,
      file: normalizeMedia(block.file),
    }
  }

  if (componentKey === 'shared.slider') {
    const filesSource = Array.isArray(block.files)
      ? block.files
      : Array.isArray(block.files?.data)
        ? block.files.data
        : []

    return {
      ...block,
      __component: componentKey,
      files: filesSource.map(normalizeMedia).filter(Boolean),
    }
  }

  return {
    ...block,
    __component: componentKey,
  }
}

function normalizeArticlePayload(payload) {
  const rawRows = Array.isArray(payload?.data) ? payload.data : []
  const firstRow = rawRows[0] || null
  if (!firstRow || typeof firstRow !== 'object') return null

  const article = firstRow.attributes && typeof firstRow.attributes === 'object'
    ? {
      id: firstRow.id,
      ...firstRow.attributes,
    }
    : firstRow

  return {
    ...article,
    cover: normalizeMedia(article.cover),
    blocks: Array.isArray(article.blocks) ? article.blocks.map(normalizeBlock).filter(Boolean) : [],
  }
}

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
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

function getMediaUrl(file) {
  return toAbsoluteUrl(file?.url || file?.attributes?.url || '')
}

function getMediaName(file) {
  return String(file?.name || file?.attributes?.name || '').trim()
}

function getMediaMimeType(file) {
  return String(file?.mime || file?.attributes?.mime || '').trim().toLowerCase()
}

function isPdfFile(file) {
  const mediaUrl = getMediaUrl(file).toLowerCase()
  const mediaName = getMediaName(file).toLowerCase()
  const mimeType = getMediaMimeType(file)

  return mimeType === 'application/pdf' || mediaUrl.endsWith('.pdf') || mediaName.endsWith('.pdf')
}

function isImageFile(file) {
  const mediaUrl = getMediaUrl(file).toLowerCase()
  const mediaName = getMediaName(file).toLowerCase()
  const mimeType = getMediaMimeType(file)

  if (mimeType.startsWith('image/')) return true

  return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif'].some((extension) => (
    mediaUrl.endsWith(extension) || mediaName.endsWith(extension)
  ))
}

function PdfPreviewBlock({ file, title }) {
  const mediaUrl = getMediaUrl(file)
  const mediaName = getMediaName(file) || title || 'PDF preview'
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''

    async function loadPreview() {
      if (!mediaUrl) {
        setPreviewUrl('')
        setPreviewError('')
        return
      }

      setPreviewLoading(true)
      setPreviewError('')

      try {
        const response = await fetch(mediaUrl)
        if (!response.ok) {
          throw new Error(`Failed to load PDF (${response.status})`)
        }

        const pdfBlob = await response.blob()
        if (cancelled) return

        objectUrl = URL.createObjectURL(pdfBlob)
        setPreviewUrl(objectUrl)
      } catch (error) {
        if (cancelled) return
        setPreviewUrl('')
        setPreviewError(getApiMessage(error, 'Không thể tải bản xem trước PDF trong trình duyệt.'))
      } finally {
        if (!cancelled) {
          setPreviewLoading(false)
        }
      }
    }

    loadPreview()

    return () => {
      cancelled = true
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [mediaUrl])

  if (!mediaUrl) return null

  return (
    <div className='d-flex flex-column gap-3 p-3 border rounded-4 bg-light-subtle'>
      {previewLoading ? (
        <div className='d-flex align-items-center gap-2 text-body-secondary'>
          <CSpinner size='sm' />
          <span>Đang tải bản xem trước PDF...</span>
        </div>
      ) : previewUrl ? (
        <iframe
          src={previewUrl}
          title={mediaName}
          width='100%'
          height='600'
          style={{ border: 'none', borderRadius: 12, backgroundColor: '#fff' }}
        />
      ) : null}
      <div className='d-flex flex-wrap gap-2'>
        <CButton component='a' href={mediaUrl} target='_blank' rel='noreferrer' color='primary' variant='outline'>
          Mở file PDF
        </CButton>
        <CButton component='a' href={mediaUrl} download={mediaName} color='secondary' variant='outline'>
          Tải PDF
        </CButton>
      </div>
      <div className='small text-body-secondary'>
        {previewError || 'Nếu trình duyệt không hiển thị được PDF, vui lòng dùng nút mở file hoặc tải về.'}
      </div>
    </div>
  )
}

function renderPdfBlock(file, key, title) {
  return <PdfPreviewBlock key={key} file={file} title={title} />
}

function renderDocumentBlock(file, key, title) {
  const mediaUrl = getMediaUrl(file)
  if (!mediaUrl) return null

  const mediaName = getMediaName(file) || title || 'Tệp đính kèm'

  return (
    <div
      key={key}
      className='d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 p-3 border rounded-4 bg-light-subtle'
    >
      <div>
        <div className='fw-semibold'>{mediaName}</div>
        <div className='text-body-secondary small'>Tệp đính kèm</div>
      </div>
      <div className='d-flex flex-wrap gap-2'>
        <CButton component='a' href={mediaUrl} target='_blank' rel='noreferrer' color='primary' variant='outline'>
          Mở tệp
        </CButton>
        <CButton component='a' href={mediaUrl} download={mediaName} color='secondary' variant='outline'>
          Tải xuống
        </CButton>
      </div>
    </div>
  )
}

export default function ArticleDetailPage() {
  const tenant = useTenant()
  const params = useParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [article, setArticle] = useState(null)

  const tenantCode = String(params?.tenantCode || tenant?.currentTenant?.tenantCode || tenant?.resolvedTenant?.tenantCode || '').trim()
  const slug = String(params?.slug || '').trim()
  const isMainDomain = Boolean(tenant?.isMainDomain)
  const journalPath = buildTenantUrl('/journal', { tenantCode, isMainDomain }) || '/journal'

  useEffect(() => {
    let cancelled = false

    async function loadArticle() {
      if (!slug) {
        setArticle(null)
        setError('Slug bài viết không hợp lệ')
        return
      }

      setLoading(true)
      setError('')

      try {
        const response = await api.get('/articles', {
          params: {
            'filters[slug]': slug,
            populate: '*',
          },
        })

        if (cancelled) return
        const nextArticle = normalizeArticlePayload(response.data)
        if (!nextArticle) {
          setArticle(null)
          setError('Không tìm thấy bài viết')
          return
        }

        setArticle(nextArticle)
      } catch (requestError) {
        if (cancelled) return
        setArticle(null)
        setError(getApiMessage(requestError, 'Không tải được bài viết'))
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadArticle()

    return () => {
      cancelled = true
    }
  }, [slug])

  const contentBlocks = useMemo(
    () => Array.isArray(article?.blocks) ? article.blocks : [],
    [article?.blocks],
  )

  return (
    <CCard>
      <CCardHeader>
        <strong>Article Detail</strong>
      </CCardHeader>
      <CCardBody>
        <div className='mb-4'>
          <CButton component={Link} to={journalPath} color='secondary' variant='outline'>Back to list</CButton>
        </div>

        {loading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span>Đang tải bài viết...</span>
          </div>
        ) : null}

        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        {!loading && !error && article ? (
          <article>
            <h1 className='h2 mb-2'>{article.title || slug}</h1>
            <div className='text-body-secondary mb-4'>Ngày đăng: {formatPublishedDate(article.publishedAt)}</div>

            {contentBlocks.length > 0 ? (
              <div className='d-flex flex-column gap-4'>
                {contentBlocks.map((block, index) => {
                  if (block.__component === 'shared.rich-text') {
                    const safeHtml = sanitizeHtml(block.body)
                    if (!safeHtml) return null

                    return (
                      <div
                        key={`${block.__component}-${index}`}
                        className='lh-lg'
                        dangerouslySetInnerHTML={{ __html: safeHtml }}
                      />
                    )
                  }

                  if (block.__component === 'shared.quote') {
                    return (
                      <blockquote key={`${block.__component}-${index}`} className='border-start border-4 ps-3 m-0'>
                        {block.title ? <div className='fw-semibold mb-2'>{block.title}</div> : null}
                        <p className='mb-0'>{block.body || ''}</p>
                      </blockquote>
                    )
                  }

                  if (block.__component === 'shared.media') {
                    const mediaFile = block.file
                    const mediaUrl = getMediaUrl(mediaFile)
                    if (!mediaUrl) return null

                    if (isPdfFile(mediaFile)) {
                      return renderPdfBlock(mediaFile, `${block.__component}-${index}`, article.title || 'Article media')
                    }

                    if (!isImageFile(mediaFile)) {
                      return renderDocumentBlock(mediaFile, `${block.__component}-${index}`, article.title || 'Article media')
                    }

                    return (
                      <figure key={`${block.__component}-${index}`} className='m-0'>
                        <img src={mediaUrl} alt={article.title || 'Article media'} style={{ maxWidth: '100%', borderRadius: 12 }} />
                      </figure>
                    )
                  }

                  if (block.__component === 'shared.slider') {
                    const files = Array.isArray(block.files) ? block.files : []
                    if (files.length === 0) return null

                    return (
                      <div key={`${block.__component}-${index}`} className='d-flex flex-column gap-3'>
                        {files.map((file, fileIndex) => {
                          const mediaUrl = getMediaUrl(file)
                          if (!mediaUrl) return null

                          if (isPdfFile(file)) {
                            return renderPdfBlock(file, `${block.__component}-${index}-${fileIndex}`, article.title || `Slide ${fileIndex + 1}`)
                          }

                          if (!isImageFile(file)) {
                            return renderDocumentBlock(file, `${block.__component}-${index}-${fileIndex}`, article.title || `Slide ${fileIndex + 1}`)
                          }

                          return (
                            <img
                              key={`${block.__component}-${index}-${fileIndex}`}
                              src={mediaUrl}
                              alt={article.title || `Slide ${fileIndex + 1}`}
                              style={{ maxWidth: '100%', borderRadius: 12 }}
                            />
                          )
                        })}
                      </div>
                    )
                  }

                  return null
                })}
              </div>
            ) : article.description ? (
              <div className='lh-lg' dangerouslySetInnerHTML={{ __html: sanitizeHtml(article.description) }} />
            ) : (
              <div className='text-body-secondary'>Bài viết chưa có nội dung.</div>
            )}
          </article>
        ) : null}
      </CCardBody>
    </CCard>
  )
}