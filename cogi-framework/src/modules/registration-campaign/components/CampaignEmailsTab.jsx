import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormLabel,
  CFormInput,
  CFormSelect,
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import MailLogDetailModal from '../../mail-monitor/components/MailLogDetailModal'
import {
  getCampaignEmailDetail,
  getCampaignEmailTemplateOptions,
  getCampaignEmails,
  previewCampaignEmailTemplate,
  sendCampaignEmailTemplateTest,
  updateCampaignEmailConfig,
} from '../services/registrationCampaignApi'
import { formatDateTime, getApiMessage, getMailStatusColor } from '../utils/registrationCampaignUi'

function buildPages(currentPage, pageCount) {
  const pages = []
  const maxButtons = 5
  if (pageCount <= maxButtons) {
    for (let index = 1; index <= pageCount; index += 1) pages.push(index)
    return pages
  }
  const left = Math.max(2, currentPage - 1)
  const right = Math.min(pageCount - 1, currentPage + 1)
  pages.push(1)
  if (left > 2) pages.push('...')
  for (let index = left; index <= right; index += 1) pages.push(index)
  if (right < pageCount - 1) pages.push('...')
  pages.push(pageCount)
  return pages
}

export default function CampaignEmailsTab({ campaign, onChanged, onOpenRegistration }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, pageCount: 1 })
  const [filters, setFilters] = useState({ q: '', sendStatus: '', registrationId: '' })
  const [query, setQuery] = useState(filters)
  const [selectedLog, setSelectedLog] = useState(null)
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [templateLoading, setTemplateLoading] = useState(true)
  const [templateError, setTemplateError] = useState('')
  const [templateOptions, setTemplateOptions] = useState({ defaultTestEmail: '', templates: {}, purposes: {} })
  const [emailConfig, setEmailConfig] = useState({
    verificationNotificationTemplate: campaign?.emailTemplates?.verification?.selected?.id ? String(campaign.emailTemplates.verification.selected.id) : '',
    completionNotificationTemplate: campaign?.emailTemplates?.completion?.selected?.id ? String(campaign.emailTemplates.completion.selected.id) : '',
    rejectionNotificationTemplate: campaign?.emailTemplates?.rejection?.selected?.id ? String(campaign.emailTemplates.rejection.selected.id) : '',
  })
  const [savingConfig, setSavingConfig] = useState(false)
  const [previewLoading, setPreviewLoading] = useState('')
  const [previewMap, setPreviewMap] = useState({})
  const [testEmailMap, setTestEmailMap] = useState({
    verificationNotificationTemplate: '',
    completionNotificationTemplate: '',
    rejectionNotificationTemplate: '',
  })
  const [testSending, setTestSending] = useState('')
  const [templateActionMessage, setTemplateActionMessage] = useState({ type: '', text: '' })

  const pages = useMemo(() => buildPages(pagination.page, pagination.pageCount), [pagination.page, pagination.pageCount])

  useEffect(() => {
    setEmailConfig({
      verificationNotificationTemplate: campaign?.emailTemplates?.verification?.selected?.id ? String(campaign.emailTemplates.verification.selected.id) : '',
      completionNotificationTemplate: campaign?.emailTemplates?.completion?.selected?.id ? String(campaign.emailTemplates.completion.selected.id) : '',
      rejectionNotificationTemplate: campaign?.emailTemplates?.rejection?.selected?.id ? String(campaign.emailTemplates.rejection.selected.id) : '',
    })
  }, [campaign])

  useEffect(() => {
    let mounted = true
    async function loadTemplateOptions() {
      setTemplateLoading(true)
      setTemplateError('')
      try {
        const result = await getCampaignEmailTemplateOptions(campaign.id)
        if (!mounted) return
        setTemplateOptions(result || { defaultTestEmail: '', templates: {}, purposes: {} })
        setTestEmailMap({
          verificationNotificationTemplate: result?.defaultTestEmail || '',
          completionNotificationTemplate: result?.defaultTestEmail || '',
          rejectionNotificationTemplate: result?.defaultTestEmail || '',
        })
      } catch (requestError) {
        if (!mounted) return
        setTemplateOptions({ defaultTestEmail: '', templates: {}, purposes: {} })
        setTemplateError(getApiMessage(requestError, 'Không tải được danh sách template email'))
      } finally {
        if (mounted) setTemplateLoading(false)
      }
    }

    if (campaign?.id) loadTemplateOptions()
    return () => { mounted = false }
  }, [campaign?.id])

  useEffect(() => {
    if (!templateActionMessage?.text) return undefined
    const timer = window.setTimeout(() => setTemplateActionMessage({ type: '', text: '' }), 2500)
    return () => window.clearTimeout(timer)
  }, [templateActionMessage])

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getCampaignEmails(campaign.id, {
          page: pagination.page,
          pageSize: pagination.pageSize,
          ...query,
        })
        if (!mounted) return
        setRows(Array.isArray(result?.rows) ? result.rows : [])
        setPagination(result?.pagination || { page: 1, pageSize: 10, total: 0, pageCount: 1 })
      } catch (requestError) {
        if (!mounted) return
        setRows([])
        setError(getApiMessage(requestError, 'Không tải được lịch sử email'))
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (campaign?.id) load()
    return () => { mounted = false }
  }, [campaign?.id, pagination.page, pagination.pageSize, query])

  async function openDetail(row) {
    setSelectedLog(null)
    setDetailVisible(true)
    setDetailLoading(true)
    try {
      const detail = await getCampaignEmailDetail(campaign.id, row.id)
      setSelectedLog(detail)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không tải được chi tiết email'))
      setDetailVisible(false)
    } finally {
      setDetailLoading(false)
    }
  }

  function applyFilters() {
    setPagination((prev) => ({ ...prev, page: 1 }))
    setQuery(filters)
  }

  function resetFilters() {
    const next = { q: '', sendStatus: '', registrationId: '' }
    setFilters(next)
    setQuery(next)
    setPagination((prev) => ({ ...prev, page: 1 }))
  }

  function getPurposeMeta(fieldName) {
    if (fieldName === 'completionNotificationTemplate') return campaign?.emailTemplates?.completion || templateOptions?.purposes?.completion || {}
    if (fieldName === 'rejectionNotificationTemplate') return campaign?.emailTemplates?.rejection || templateOptions?.purposes?.rejection || {}
    return campaign?.emailTemplates?.verification || templateOptions?.purposes?.verification || {}
  }

  function getTemplateOptionsByField(fieldName) {
    if (fieldName === 'completionNotificationTemplate') return Array.isArray(templateOptions?.templates?.completion) ? templateOptions.templates.completion : []
    if (fieldName === 'rejectionNotificationTemplate') return Array.isArray(templateOptions?.templates?.rejection) ? templateOptions.templates.rejection : []
    return Array.isArray(templateOptions?.templates?.verification) ? templateOptions.templates.verification : []
  }

  function getSelectedTemplate(fieldName) {
    const campaignSelected = fieldName === 'completionNotificationTemplate'
      ? campaign?.emailTemplates?.completion?.selected
      : fieldName === 'rejectionNotificationTemplate'
        ? campaign?.emailTemplates?.rejection?.selected
        : campaign?.emailTemplates?.verification?.selected

    if (!campaignSelected?.id) return null
    const options = getTemplateOptionsByField(fieldName)
    const found = options.find((item) => Number(item?.id || 0) === Number(campaignSelected.id))
    return found || campaignSelected
  }

  async function handleSaveConfig() {
    setSavingConfig(true)
    setTemplateError('')
    setTemplateActionMessage({ type: '', text: '' })
    try {
      await updateCampaignEmailConfig(campaign.id, {
        verificationNotificationTemplate: emailConfig.verificationNotificationTemplate ? Number(emailConfig.verificationNotificationTemplate) : null,
        completionNotificationTemplate: emailConfig.completionNotificationTemplate ? Number(emailConfig.completionNotificationTemplate) : null,
        rejectionNotificationTemplate: emailConfig.rejectionNotificationTemplate ? Number(emailConfig.rejectionNotificationTemplate) : null,
      })
      await onChanged?.()
      setTemplateActionMessage({ type: 'success', text: 'Đã lưu cấu hình email.' })
    } catch (requestError) {
      setTemplateError(getApiMessage(requestError, 'Không thể lưu cấu hình email'))
    } finally {
      setSavingConfig(false)
    }
  }

  async function handlePreview(fieldName) {
    const templateId = emailConfig[fieldName] || getSelectedTemplate(fieldName)?.id
    if (!templateId) {
      setTemplateActionMessage({ type: 'warning', text: 'Hãy chọn template trước khi xem trước.' })
      return
    }

    setPreviewLoading(fieldName)
    try {
      const preview = await previewCampaignEmailTemplate(campaign.id, {
        field: fieldName,
        templateId: Number(templateId),
      })
      setPreviewMap((prev) => ({ ...prev, [fieldName]: preview }))
    } catch (requestError) {
      setTemplateError(getApiMessage(requestError, 'Không thể xem trước template'))
    } finally {
      setPreviewLoading('')
    }
  }

  async function handleTestSend(fieldName) {
    const templateId = emailConfig[fieldName] || getSelectedTemplate(fieldName)?.id
    if (!templateId) {
      setTemplateActionMessage({ type: 'warning', text: 'Hãy chọn template trước khi gửi thử.' })
      return
    }

    const email = String(testEmailMap[fieldName] || templateOptions?.defaultTestEmail || '').trim()
    if (!email) {
      setTemplateActionMessage({ type: 'warning', text: 'Cần nhập email nhận thử.' })
      return
    }

    setTestSending(fieldName)
    try {
      await sendCampaignEmailTemplateTest(campaign.id, {
        field: fieldName,
        templateId: Number(templateId),
        email,
      })
      setTemplateActionMessage({ type: 'success', text: 'Đã tạo email gửi thử.' })
    } catch (requestError) {
      setTemplateError(getApiMessage(requestError, 'Không thể gửi thử email'))
    } finally {
      setTestSending('')
    }
  }

  function renderTemplateBlock(fieldName, title, description, hint) {
    const options = getTemplateOptionsByField(fieldName)
    const selected = getSelectedTemplate(fieldName)
    const preview = previewMap[fieldName] || null
    const value = emailConfig[fieldName] || ''
    const purposeMeta = getPurposeMeta(fieldName)

    return (
      <CCard className='mb-3' key={fieldName}>
        <CCardHeader><strong>{title}</strong></CCardHeader>
        <CCardBody>
          <div className='text-body-secondary mb-3'>{description}</div>
          {hint ? <CAlert color='warning' className='py-2'>{hint}</CAlert> : null}

          <CRow className='g-3'>
            <CCol lg={6}>
              <CFormLabel>Chọn template</CFormLabel>
              <CFormSelect value={value} disabled={templateLoading || savingConfig} onChange={(event) => setEmailConfig((prev) => ({ ...prev, [fieldName]: event.target.value }))}>
                <option value=''>{templateLoading ? 'Đang tải template...' : 'Chưa chọn template'}</option>
                {selected?.id && !options.some((item) => Number(item?.id || 0) === Number(selected.id)) ? (
                  <option value={selected.id}>{selected.name || selected.code} - Không còn khả dụng</option>
                ) : null}
                {options.map((item) => (
                  <option key={item.id} value={item.id}>{`${item.name || 'Template'} — ${item.code || '-'}`}</option>
                ))}
              </CFormSelect>
              {!templateLoading && options.length === 0 ? <div className='small text-body-secondary mt-1'>Chưa có template email phù hợp.</div> : null}
              {selected?.id && selected.isAvailable === false ? <div className='small text-danger mt-1'>Template hiện tại không còn khả dụng. Hãy chọn template hợp lệ khác trước khi lưu.</div> : null}
            </CCol>
            <CCol lg={6}>
              <CFormLabel>Email nhận thử</CFormLabel>
              <CFormInput value={testEmailMap[fieldName] || ''} disabled={testSending === fieldName} onChange={(event) => setTestEmailMap((prev) => ({ ...prev, [fieldName]: event.target.value }))} placeholder='email@example.com' />
            </CCol>
            <CCol xs={12} className='d-flex flex-wrap gap-2'>
              <CButton color='secondary' variant='outline' onClick={() => handlePreview(fieldName)} disabled={previewLoading === fieldName || templateLoading}>{previewLoading === fieldName ? 'Đang tải preview...' : 'Xem trước'}</CButton>
              <CButton color='primary' variant='outline' onClick={() => handleTestSend(fieldName)} disabled={testSending === fieldName || templateLoading}>{testSending === fieldName ? 'Đang gửi thử...' : 'Gửi thử'}</CButton>
            </CCol>
          </CRow>

          <div className='mt-3'>
            <div className='small text-body-secondary mb-1'>Variables gợi ý</div>
            <div className='border rounded p-2 bg-light small' style={{ whiteSpace: 'pre-wrap' }}>{Array.isArray(purposeMeta?.requiredVariables) && purposeMeta.requiredVariables.length > 0 ? purposeMeta.requiredVariables.join('\n') : 'Chưa có cấu hình variables.'}</div>
          </div>

          {preview ? (
            <div className='mt-3 border rounded p-3 bg-light'>
              <div><strong>Code:</strong> {preview?.template?.code || '-'}</div>
              <div><strong>Tên:</strong> {preview?.template?.name || '-'}</div>
              <div><strong>Subject:</strong> {preview?.subject || '-'}</div>
              <div className='mt-2'><strong>Variables:</strong></div>
              <div className='small text-body-secondary mb-2' style={{ whiteSpace: 'pre-wrap' }}>{Array.isArray(preview?.template?.variables) ? preview.template.variables.join(', ') : JSON.stringify(preview?.template?.variables || {}, null, 2)}</div>
              <div><strong>Preview content:</strong></div>
              <div className='border rounded bg-white p-3 mt-2' dangerouslySetInnerHTML={{ __html: preview?.content || '' }} />
            </div>
          ) : null}
        </CCardBody>
      </CCard>
    )
  }

  return (
    <div className='d-flex flex-column gap-3'>
      <CCard>
        <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
          <strong>Cấu hình template</strong>
          <div className='d-flex gap-2'>
            <CButton color='primary' onClick={handleSaveConfig} disabled={savingConfig}>{savingConfig ? 'Đang lưu...' : 'Lưu cấu hình email'}</CButton>
          </div>
        </CCardHeader>
        <CCardBody>
          {templateError ? <CAlert color='danger'>{templateError}</CAlert> : null}
          {templateActionMessage.text ? <CAlert color={templateActionMessage.type === 'warning' ? 'warning' : 'success'}>{templateActionMessage.text}</CAlert> : null}

          {renderTemplateBlock(
            'verificationNotificationTemplate',
            'Email xác minh đăng ký',
            'Được gửi sau khi người dùng gửi đăng ký và cần xác minh địa chỉ email.',
            null,
          )}

          {renderTemplateBlock(
            'completionNotificationTemplate',
            'Email hoàn tất đăng ký',
            'Được gửi khi người dùng đã được tạo hoặc liên kết tài khoản, thêm vào tenant, gán vai trò mặc định và hoàn tất quyền truy cập chức năng.',
            null,
          )}

          {renderTemplateBlock(
            'rejectionNotificationTemplate',
            'Email từ chối đăng ký',
            'Được gửi khi quản trị viên từ chối một bản đăng ký.',
            campaign?.autoApprove ? 'Template này chỉ được dùng khi bản đăng ký bị từ chối thủ công.' : null,
          )}
        </CCardBody>
      </CCard>

      <CCard>
        <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
          <strong>Lịch sử gửi email</strong>
          <div className='d-flex gap-2'>
            <CButton color='secondary' variant='outline' onClick={() => window.location.assign('/system/mail-monitor')}>Mở trong quản lý email</CButton>
          </div>
        </CCardHeader>
        <CCardBody>
        <CRow className='g-3 mb-3'>
          <CCol md={5}><CFormInput placeholder='Tìm theo email, tiêu đề, mailType' value={filters.q} onChange={(event) => setFilters((prev) => ({ ...prev, q: event.target.value }))} /></CCol>
          <CCol md={3}>
            <CFormSelect value={filters.sendStatus} onChange={(event) => setFilters((prev) => ({ ...prev, sendStatus: event.target.value }))}>
              <option value=''>Tất cả trạng thái</option>
              <option value='QUEUED'>QUEUED</option>
              <option value='SENDING'>SENDING</option>
              <option value='SENT'>SENT</option>
              <option value='FAILED'>FAILED</option>
              <option value='RETRYING'>RETRYING</option>
              <option value='CANCELLED'>CANCELLED</option>
            </CFormSelect>
          </CCol>
          <CCol md={2}><CFormInput placeholder='Registration ID' value={filters.registrationId} onChange={(event) => setFilters((prev) => ({ ...prev, registrationId: event.target.value }))} /></CCol>
          <CCol md={2} className='d-flex gap-2'>
            <CButton color='primary' onClick={applyFilters}>Lọc</CButton>
            <CButton color='secondary' variant='outline' onClick={resetFilters}>Đặt lại</CButton>
          </CCol>
        </CRow>

        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        {loading ? (
          <div className='d-flex align-items-center gap-2'>
            <CSpinner size='sm' />
            <span>Đang tải lịch sử email...</span>
          </div>
        ) : (
          <>
            <CTable responsive hover align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Người nhận</CTableHeaderCell>
                  <CTableHeaderCell>Loại email</CTableHeaderCell>
                  <CTableHeaderCell>Tiêu đề</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Ngày yêu cầu</CTableHeaderCell>
                  <CTableHeaderCell>Ngày gửi</CTableHeaderCell>
                  <CTableHeaderCell>Số lần thử</CTableHeaderCell>
                  <CTableHeaderCell>Lỗi gần nhất</CTableHeaderCell>
                  <CTableHeaderCell>Registration</CTableHeaderCell>
                  <CTableHeaderCell>Thao tác</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.length > 0 ? rows.map((row) => (
                  <CTableRow key={row.id}>
                    <CTableDataCell>{row.toEmail || '-'}</CTableDataCell>
                    <CTableDataCell>{row.mailType || '-'}</CTableDataCell>
                    <CTableDataCell>{row.subject || '-'}</CTableDataCell>
                    <CTableDataCell><CBadge color={getMailStatusColor(row.sendStatus)}>{row.sendStatus || '-'}</CBadge></CTableDataCell>
                    <CTableDataCell>{formatDateTime(row.queuedAt)}</CTableDataCell>
                    <CTableDataCell>{formatDateTime(row.sentAt)}</CTableDataCell>
                    <CTableDataCell>{row.attempts || 0}</CTableDataCell>
                    <CTableDataCell>{row.lastError || '-'}</CTableDataCell>
                    <CTableDataCell>{row.registrationId ? `#${row.registrationId}` : '-'}</CTableDataCell>
                    <CTableDataCell>
                      <div className='d-flex flex-wrap gap-2'>
                        <CButton size='sm' color='secondary' variant='outline' onClick={() => openDetail(row)}>Xem</CButton>
                        {row.registrationId ? <CButton size='sm' color='primary' variant='outline' onClick={() => onOpenRegistration?.(row.registrationId)}>Mở đăng ký</CButton> : null}
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                )) : (
                  <CTableRow>
                    <CTableDataCell colSpan={10} className='text-center text-body-secondary'>Chưa có lịch sử gửi email cho chiến dịch này.</CTableDataCell>
                  </CTableRow>
                )}
              </CTableBody>
            </CTable>

            {pagination.pageCount > 1 ? (
              <div className='d-flex justify-content-end'>
                <CPagination>
                  <CPaginationItem disabled={pagination.page <= 1} onClick={() => setPagination((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}>Trước</CPaginationItem>
                  {pages.map((item, index) => item === '...'
                    ? <CPaginationItem key={`ellipsis:${index}`} disabled>...</CPaginationItem>
                    : <CPaginationItem key={item} active={pagination.page === item} onClick={() => setPagination((prev) => ({ ...prev, page: item }))}>{item}</CPaginationItem>)}
                  <CPaginationItem disabled={pagination.page >= pagination.pageCount} onClick={() => setPagination((prev) => ({ ...prev, page: Math.min(prev.pageCount, prev.page + 1) }))}>Sau</CPaginationItem>
                </CPagination>
              </div>
            ) : null}
          </>
        )}

        <MailLogDetailModal visible={detailVisible} log={selectedLog} loading={detailLoading} onClose={() => setDetailVisible(false)} />
        </CCardBody>
      </CCard>
    </div>
  )
}