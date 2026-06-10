import { useEffect, useMemo, useState } from 'react'
import {
  CButton,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'
import SimpleHtmlEditor from '../../admission-management/components/SimpleHtmlEditor'

function formatDateTimeLocalValue(value) {
  const text = String(value || '').trim()
  if (!text) return ''

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function buildInitialState(initialValues) {
  return {
    title: initialValues?.title || '',
    slug: initialValues?.slug || '',
    pageType: initialValues?.pageType || 'page',
    summary: initialValues?.summary || '',
    contentHtml: initialValues?.contentHtml || '',
    leadCampaign: initialValues?.leadCampaign?.id ? String(initialValues.leadCampaign.id) : '',
    leadFormPosition: initialValues?.leadFormPosition || 'bottom',
    publicPageStatus: initialValues?.publicPageStatus || initialValues?.status || 'draft',
    seoTitle: initialValues?.seoTitle || '',
    seoDescription: initialValues?.seoDescription || '',
    seoKeywords: initialValues?.seoKeywords || '',
    publishedAt: formatDateTimeLocalValue(initialValues?.publishedAt),
  }
}

function slugifyVietnamese(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, (char) => (char === 'Đ' ? 'D' : 'd'))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 160)
    .replace(/-+$/g, '')
}

export default function PublicPageFormModal({
  visible,
  initialValues,
  formOptions,
  submitting = false,
  seoImagePreviewUrl = '',
  pendingSeoImageName = '',
  onSeoImageChange,
  onSeoImageRemove,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(buildInitialState(initialValues))
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false)

  useEffect(() => {
    if (!visible) return
    setForm(buildInitialState(initialValues))
    setIsSlugManuallyEdited(Boolean(initialValues?.id))
  }, [initialValues, visible])

  const leadCampaignOptions = useMemo(
    () => Array.isArray(formOptions?.leadCampaigns) ? formOptions.leadCampaigns : [],
    [formOptions?.leadCampaigns],
  )

  const selectedLeadCampaign = useMemo(
    () => leadCampaignOptions.find((item) => String(item?.id || '') === String(form.leadCampaign || '')) || null,
    [form.leadCampaign, leadCampaignOptions],
  )

  const previewLeadFormTokenVisible = useMemo(() => String(form.contentHtml || '').includes('[LEAD_FORM]'), [form.contentHtml])

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleTitleChange(nextValue) {
    updateField('title', nextValue)
    if (!isSlugManuallyEdited) {
      updateField('slug', slugifyVietnamese(nextValue))
    }
  }

  function handleSlugChange(nextValue) {
    setIsSlugManuallyEdited(true)
    updateField('slug', slugifyVietnamese(nextValue))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit?.({
      title: String(form.title || '').trim(),
      slug: String(form.slug || '').trim(),
      pageType: String(form.pageType || 'page').trim(),
      summary: String(form.summary || '').trim(),
      contentHtml: String(form.contentHtml || '').trim(),
      leadCampaign: Number(form.leadCampaign || 0) || null,
      leadFormPosition: String(form.leadFormPosition || 'bottom').trim(),
      publicPageStatus: String(form.publicPageStatus || 'draft').trim(),
      seoTitle: String(form.seoTitle || '').trim(),
      seoDescription: String(form.seoDescription || '').trim(),
      seoKeywords: String(form.seoKeywords || '').trim(),
      publishedAt: String(form.publishedAt || '').trim() || null,
    })
  }

  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()} size='xl' scrollable backdrop='static'>
      <CModalHeader>
        <CModalTitle>{initialValues?.id ? 'Chỉnh sửa PublicPage' : 'Thêm PublicPage'}</CModalTitle>
      </CModalHeader>
      <form onSubmit={handleSubmit}>
        <CModalBody style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <CRow className='g-3'>
            <CCol md={8}>
              <CFormLabel>Tiêu đề</CFormLabel>
              <CFormInput value={form.title} onChange={(event) => handleTitleChange(event.target.value)} required disabled={submitting} />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Slug</CFormLabel>
              <CFormInput value={form.slug} onChange={(event) => handleSlugChange(event.target.value)} required disabled={submitting} />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Page type</CFormLabel>
              <CFormSelect value={form.pageType} onChange={(event) => updateField('pageType', event.target.value)} disabled={submitting}>
                {(Array.isArray(formOptions?.pageTypes) ? formOptions.pageTypes : ['page', 'landing', 'lead', 'thank_you', 'default_page']).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={4}>
              <CFormLabel>Trạng thái</CFormLabel>
              <CFormSelect value={form.publicPageStatus} onChange={(event) => updateField('publicPageStatus', event.target.value)} disabled={submitting}>
                {(Array.isArray(formOptions?.statuses) ? formOptions.statuses : ['draft', 'published', 'archived']).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={4}>
              <CFormLabel>Published at</CFormLabel>
              <CFormInput type='datetime-local' value={form.publishedAt} onChange={(event) => updateField('publishedAt', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Tóm tắt</CFormLabel>
              <CFormTextarea rows={3} value={form.summary} onChange={(event) => updateField('summary', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol xs={12}>
              <SimpleHtmlEditor
                label='Nội dung HTML'
                rows={14}
                value={form.contentHtml}
                onChange={(nextValue) => updateField('contentHtml', nextValue)}
                disabled={submitting}
                placeholder='<div><h1>Landing page</h1><p>[LEAD_FORM]</p></div>'
                helperText='Có thể dùng token [LEAD_FORM] để chèn form lead tại vị trí mong muốn khi leadFormPosition = shortcode.'
              />
            </CCol>
            <CCol xs={12}>
              <div className='border rounded p-3 bg-body-tertiary'>
                <div className='fw-semibold mb-2'>Preview hiển thị public</div>
                <div className='small text-body-secondary mb-3'>Preview này dùng cùng wrapper typography với trang /page/:slug. Nếu chọn shortcode thì token [LEAD_FORM] sẽ được thay bằng placeholder form.</div>

                {form.title ? <h2 className='h4 mb-2'>{form.title}</h2> : null}
                {form.summary ? <div className='text-body-secondary public-page-summary mb-3'>{form.summary}</div> : null}

                {form.leadCampaign && form.leadFormPosition === 'top' ? (
                  <div className='border rounded p-3 mb-3 bg-white'>[Lead form preview]</div>
                ) : null}

                <div
                  className='public-page-html-content'
                  dangerouslySetInnerHTML={{
                    __html: String(form.contentHtml || '').includes('[LEAD_FORM]')
                      ? String(form.contentHtml || '').split('[LEAD_FORM]').join('<div class="border rounded p-3 my-3 bg-white">[Lead form preview]</div>')
                      : String(form.contentHtml || ''),
                  }}
                />

                {form.leadCampaign && (form.leadFormPosition === 'bottom' || (!previewLeadFormTokenVisible && form.leadFormPosition === 'shortcode')) ? (
                  <div className='border rounded p-3 mt-3 bg-white'>[Lead form preview]</div>
                ) : null}
              </div>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Lead campaign</CFormLabel>
              <CFormSelect value={form.leadCampaign} onChange={(event) => updateField('leadCampaign', event.target.value)} disabled={submitting}>
                <option value=''>Không gắn LeadCampaign</option>
                {leadCampaignOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </CFormSelect>
              <div className='small text-body-secondary mt-1'>FormTemplate: {selectedLeadCampaign?.formTemplate?.name ? `${selectedLeadCampaign.formTemplate.name} v${selectedLeadCampaign.formTemplate.version || 0}` : '-'}</div>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Vị trí form lead</CFormLabel>
              <CFormSelect value={form.leadFormPosition} onChange={(event) => updateField('leadFormPosition', event.target.value)} disabled={submitting}>
                {(Array.isArray(formOptions?.leadFormPositions) ? formOptions.leadFormPositions : ['top', 'bottom', 'shortcode']).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol md={6}>
              <CFormLabel>SEO title</CFormLabel>
              <CFormInput value={form.seoTitle} onChange={(event) => updateField('seoTitle', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>SEO keywords</CFormLabel>
              <CFormInput value={form.seoKeywords} onChange={(event) => updateField('seoKeywords', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>SEO description</CFormLabel>
              <CFormTextarea rows={3} value={form.seoDescription} onChange={(event) => updateField('seoDescription', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol xs={12}>
              <div className='border rounded p-3'>
                <div className='fw-semibold mb-2'>SEO image</div>
                {seoImagePreviewUrl ? (
                  <img src={seoImagePreviewUrl} alt={form.seoTitle || form.title || 'SEO image'} style={{ width: 180, height: 100, objectFit: 'cover', borderRadius: 8 }} />
                ) : null}
                {pendingSeoImageName ? <div className='small text-body-secondary mt-2'>Sẽ upload SEO image mới: {pendingSeoImageName}</div> : null}
                {!seoImagePreviewUrl && !pendingSeoImageName ? <div className='small text-body-secondary mb-2'>Chưa có SEO image</div> : null}
                <div className='d-flex gap-2 mt-3'>
                  <CButton color='secondary' variant='outline' component='label' disabled={submitting}>
                    Chọn ảnh
                    <input
                      type='file'
                      accept='image/*'
                      hidden
                      onChange={(event) => onSeoImageChange?.(event.target.files?.[0] || null)}
                    />
                  </CButton>
                  <CButton color='danger' variant='outline' onClick={onSeoImageRemove} disabled={submitting || (!seoImagePreviewUrl && !pendingSeoImageName)}>
                    Gỡ SEO image
                  </CButton>
                </div>
              </div>
            </CCol>
            <CCol xs={12}>
              <CFormCheck label='Xem nhanh public route sẽ dùng /page/:slug và /t/:tenantCode/page/:slug' checked readOnly disabled />
            </CCol>
          </CRow>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={onClose} disabled={submitting}>Hủy</CButton>
          <CButton color='primary' type='submit' disabled={submitting}>{submitting ? 'Đang lưu...' : 'Lưu'}</CButton>
        </CModalFooter>
      </form>
    </CModal>
  )
}
