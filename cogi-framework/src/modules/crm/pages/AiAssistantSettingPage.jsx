import { useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
  CSpinner,
} from '@coreui/react'
import { getAiAssistant, saveAiAssistant, testAiAssistant } from '../services/aiService'
import {
  getTenantConfigByKey,
  createTenantConfig,
  updateTenantConfig,
} from '../../content-management/services/tenantConfigService'
import api from '../../../api/axios'

const PROVIDER_OPTIONS = ['OPENAI', 'GEMINI', 'ANTHROPIC']
const ENABLED_OPTIONS = [
  { value: 'false', label: 'Tắt' },
  { value: 'true', label: 'Bật' },
]

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function createFormState(payload = {}) {
  return {
    id: payload?.id || null,
    assistantName: String(payload?.assistantName || '').trim(),
    name: String(payload?.name || '').trim(),
    provider: String(payload?.provider || 'OPENAI').trim() || 'OPENAI',
    model: String(payload?.model || 'gpt-4o-mini').trim() || 'gpt-4o-mini',
    systemPrompt: String(payload?.systemPrompt || '').trim(),
    welcomeMessage: String(payload?.welcomeMessage || '').trim(),
    enabled: payload?.enabled === true ? 'true' : 'false',
    temperature: String(payload?.temperature ?? '0.3').trim() || '0.3',
    maxTokens: String(payload?.maxTokens ?? '800').trim() || '800',
    providerStatus: {
      openAiApiKeyConfigured: payload?.providerStatus?.openAiApiKeyConfigured === true,
      endpointConfigured: payload?.providerStatus?.endpointConfigured === true,
    },
  }
}

export default function AiAssistantSettingPage() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(() => createFormState())
  const [testResult, setTestResult] = useState(null)
  const [widgetConfig, setWidgetConfig] = useState({
    id: null,
    enabled: true,
    available: true,
    widgetTitle: '',
    offlineMessage: 'Cảm ơn Anh/Chị đã để lại tin nhắn. Hiện bộ phận tư vấn đang tạm thời không trực tuyến. Trung tâm sẽ phản hồi trong thời gian sớm nhất.',
    allowedDomainsText: '',
  })
  const [embedCode, setEmbedCode] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadAssistant() {
      setLoading(true)
      setError('')
      setSuccess('')

      try {
        const payload = await getAiAssistant()
        if (cancelled) return
        setForm(createFormState(payload))
      } catch (requestError) {
        if (cancelled) return
        setForm(createFormState())
        setError(getApiMessage(requestError, 'Không tải được cấu hình AI Assistant'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadAssistant()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadWidgetConfig() {
      try {
        const row = await getTenantConfigByKey('chatWidgetConfig')
        if (cancelled) return
        if (!row) return
        const json = row.jsonContent || row.jsonContentText || {}
        setWidgetConfig({
          id: row.id || null,
          enabled: json.enabled === false ? false : true,
          available: json.available === false ? false : true,
          // prefer empty string so frontend falls back to tenantCode-based title when empty
          widgetTitle: String(json.widgetTitle || '').trim() || '',
          offlineMessage: String(json.offlineMessage || widgetConfig.offlineMessage).trim(),
          allowedDomainsText: Array.isArray(json.allowedDomains) ? json.allowedDomains.join('\n') : (json.allowedDomains || ''),
        })
      } catch (err) {
        // ignore
      }
    }

    loadWidgetConfig()
    return () => { cancelled = true }
  }, [])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (error) setError('')
    if (success) setSuccess('')
  }

  async function handleTestAi() {
    setTesting(true)
    setError('')
    setSuccess('')
    setTestResult(null)

    try {
      const payload = await testAiAssistant()
      if (payload?.success === true) {
        setTestResult({
          success: true,
          response: String(payload.response || '').trim(),
          provider: String(payload.provider || '').trim(),
          model: String(payload.model || '').trim(),
        })
        return
      }

      setTestResult({
        success: false,
        error: getApiMessage({ response: { data: payload } }, 'OpenAI connection error'),
      })
    } catch (requestError) {
      setTestResult({
        success: false,
        error: getApiMessage(requestError, 'OpenAI connection error'),
      })
    } finally {
      setTesting(false)
    }
  }

  async function handleSave() {
    if (!String(form.name || '').trim()) {
      setError('Vui lòng nhập tên trợ lý AI')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = await saveAiAssistant({
        id: form.id || undefined,
        assistantName: String(form.assistantName || '').trim(),
        name: String(form.name || '').trim(),
        provider: String(form.provider || 'OPENAI').trim(),
        model: String(form.model || '').trim(),
        systemPrompt: String(form.systemPrompt || '').trim(),
        welcomeMessage: String(form.welcomeMessage || '').trim(),
        enabled: form.enabled === 'true',
        temperature: Number(form.temperature || 0.3),
        maxTokens: Number(form.maxTokens || 800),
      })

      setForm(createFormState(payload))
      setSuccess('Lưu cấu hình AI Assistant thành công')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được cấu hình AI Assistant'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-3'>
            <strong>Cấu hình trợ lý AI</strong>
            <CButton color='secondary' variant='outline' onClick={() => window.location.reload()} disabled={loading || saving}>Tải lại</CButton>
          </CCardHeader>
          <CCardBody>
            {loading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Đang tải cấu hình AI Assistant...</span>
              </div>
            ) : (
              <>
                {error ? <CAlert color='danger'>{error}</CAlert> : null}
                {success ? <CAlert color='success'>{success}</CAlert> : null}
                <div className='border rounded-3 p-3 mb-4'>
                  <div className='d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3'>
                    <div className='fw-semibold'>Kiểm tra trợ lý AI</div>
                    <CButton color='info' variant='outline' onClick={handleTestAi} disabled={testing || loading || saving}>
                      {testing ? 'Đang test...' : 'Test AI'}
                    </CButton>
                  </div>
                  {testResult?.success === true ? (
                    <CAlert color='success' className='mb-0'>
                      <div><strong>Response:</strong> {testResult.response || '-'}</div>
                      <div><strong>Provider:</strong> {testResult.provider || '-'}</div>
                      <div><strong>Model:</strong> {testResult.model || '-'}</div>
                    </CAlert>
                  ) : null}
                  {testResult?.success === false ? (
                    <CAlert color='danger' className='mb-0'>
                      <strong>Lỗi:</strong> {testResult.error || 'OpenAI connection error'}
                    </CAlert>
                  ) : null}
                </div>
                <div className='border rounded-3 p-3 mb-4'>
                  <div className='fw-semibold mb-3'>AI Provider Status</div>
                  <div className='mb-2'>
                    <strong>OPENAI API KEY:</strong>{' '}
                    {form.providerStatus.openAiApiKeyConfigured ? '✓ Configured' : '✗ Missing OPENAI_API_KEY'}
                  </div>
                  <div>
                    <strong>Endpoint:</strong>{' '}
                    {form.providerStatus.endpointConfigured ? 'Configured' : 'Not Configured'}
                  </div>
                </div>
                <CRow className='g-3'>
                  <CCol md={6}>
                    <CFormLabel>Tên trợ lý</CFormLabel>
                    <CFormInput value={form.name} onChange={(event) => updateField('name', event.target.value)} disabled={saving} />
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>Tên hiển thị trợ lý</CFormLabel>
                    <CFormInput value={form.assistantName} onChange={(event) => updateField('assistantName', event.target.value)} disabled={saving} placeholder='(Ví dụ: Cô Hồng, Trợ lý COGI)' />
                  </CCol>
                  <CCol md={3}>
                    <CFormLabel>Provider</CFormLabel>
                    <CFormSelect value={form.provider} onChange={(event) => updateField('provider', event.target.value)} disabled={saving}>
                      {PROVIDER_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </CFormSelect>
                  </CCol>
                  <CCol md={3}>
                    <CFormLabel>Trạng thái</CFormLabel>
                    <CFormSelect value={form.enabled} onChange={(event) => updateField('enabled', event.target.value)} disabled={saving}>
                      {ENABLED_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </CFormSelect>
                  </CCol>
                  <CCol md={6}>
                    <CFormLabel>Model</CFormLabel>
                    <CFormInput value={form.model} onChange={(event) => updateField('model', event.target.value)} disabled={saving} />
                  </CCol>
                  <CCol md={3}>
                    <CFormLabel>Temperature</CFormLabel>
                    <CFormInput type='number' step='0.1' min='0' max='2' value={form.temperature} onChange={(event) => updateField('temperature', event.target.value)} disabled={saving} />
                  </CCol>
                  <CCol md={3}>
                    <CFormLabel>Max Tokens</CFormLabel>
                    <CFormInput type='number' min='1' value={form.maxTokens} onChange={(event) => updateField('maxTokens', event.target.value)} disabled={saving} />
                  </CCol>
                  <CCol xs={12}>
                    <CFormLabel>Welcome Message</CFormLabel>
                    <CFormTextarea rows={4} value={form.welcomeMessage} onChange={(event) => updateField('welcomeMessage', event.target.value)} disabled={saving} />
                  </CCol>
                  <CCol xs={12}>
                    <CFormLabel>System Prompt</CFormLabel>
                    <CFormTextarea rows={10} value={form.systemPrompt} onChange={(event) => updateField('systemPrompt', event.target.value)} disabled={saving} />
                  </CCol>
                </CRow>
                  <div className='mt-4 d-flex justify-content-end'>
                    <CButton color='primary' onClick={handleSave} disabled={saving || testing}>{saving ? 'Đang lưu...' : 'Lưu cấu hình'}</CButton>
                  </div>

                  {/* Chat Widget section */}
                  <div className='border rounded-3 p-3 mt-4'>
                    <div className='d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3'>
                      <div className='fw-semibold'>Chat Widget</div>
                    </div>
                    <CRow className='g-3'>
                      <CCol md={3}>
                        <CFormLabel>Bật Chat Widget</CFormLabel>
                        <CFormSelect value={widgetConfig.enabled ? 'true' : 'false'} onChange={(e) => setWidgetConfig((p) => ({ ...p, enabled: e.target.value === 'true' }))}>
                          <option value='true'>Bật</option>
                          <option value='false'>Tắt</option>
                        </CFormSelect>
                      </CCol>
                      <CCol md={3}>
                        <CFormLabel>Đang trực tuyến</CFormLabel>
                        <CFormSelect value={widgetConfig.available ? 'true' : 'false'} onChange={(e) => setWidgetConfig((p) => ({ ...p, available: e.target.value === 'true' }))}>
                          <option value='true'>Trực tuyến</option>
                          <option value='false'>Đi vắng</option>
                        </CFormSelect>
                      </CCol>
                      <CCol md={6}>
                        <CFormLabel>Tiêu đề widget</CFormLabel>
                        <CFormInput value={widgetConfig.widgetTitle} onChange={(e) => setWidgetConfig((p) => ({ ...p, widgetTitle: e.target.value }))} />
                      </CCol>
                      <CCol xs={12}>
                        <CFormLabel>Tin nhắn khi đi vắng</CFormLabel>
                        <CFormTextarea rows={4} value={widgetConfig.offlineMessage} onChange={(e) => setWidgetConfig((p) => ({ ...p, offlineMessage: e.target.value }))} />
                      </CCol>
                      <CCol xs={12}>
                        <CFormLabel>Domain được phép nhúng (mỗi dòng một domain)</CFormLabel>
                        <CFormTextarea rows={4} value={widgetConfig.allowedDomainsText} onChange={(e) => setWidgetConfig((p) => ({ ...p, allowedDomainsText: e.target.value }))} />
                      </CCol>
                    </CRow>
                    <div className='mt-3 d-flex justify-content-end gap-2'>
                      <CButton color='secondary' onClick={async () => {
                        // reload config
                        try {
                          const row = await getTenantConfigByKey('chatWidgetConfig')
                          if (!row) return
                          const json = row.jsonContent || row.jsonContentText || {}
                          setWidgetConfig((p) => ({
                            ...p,
                            id: row.id || null,
                            enabled: json.enabled === false ? false : true,
                            available: json.available === false ? false : true,
                            widgetTitle: String(json.widgetTitle || '').trim() || p.widgetTitle,
                            offlineMessage: String(json.offlineMessage || p.offlineMessage).trim(),
                            allowedDomainsText: Array.isArray(json.allowedDomains) ? json.allowedDomains.join('\n') : (json.allowedDomains || p.allowedDomainsText),
                          }))
                        } catch (err) {
                          // ignore
                        }
                      }}>Tải lại</CButton>
                      <CButton color='primary' onClick={async () => {
                        // save tenant config
                        try {
                          const parsed = {
                            enabled: !!widgetConfig.enabled,
                            available: !!widgetConfig.available,
                            widgetTitle: String(widgetConfig.widgetTitle || '').trim(),
                            offlineMessage: String(widgetConfig.offlineMessage || '').trim(),
                            allowedDomains: String(widgetConfig.allowedDomainsText || '').split('\n').map((s) => String(s || '').trim()).filter(Boolean),
                          }
                          if (widgetConfig.id) {
                            await updateTenantConfig(widgetConfig.id, { key: 'chatWidgetConfig', jsonContent: parsed })
                          } else {
                            await createTenantConfig({ key: 'chatWidgetConfig', jsonContent: parsed })
                          }
                          setSuccess('Lưu cấu hình Chat Widget thành công')
                        } catch (err) {
                          setError(getApiMessage(err, 'Không lưu được cấu hình Chat Widget'))
                        }
                      }}>Lưu Chat Widget</CButton>
                    </div>
                  </div>

                  {/* Embed code section */}
                  <div className='border rounded-3 p-3 mt-4'>
                    <div className='fw-semibold mb-2'>Mã nhúng Chat Widget</div>
                    {widgetConfig.enabled === false ? <CAlert color='warning'>Chat Widget hiện đang tắt.</CAlert> : null}
                    {widgetConfig.available === false ? <CAlert color='info'>Chat Widget đang ở chế độ đi vắng.</CAlert> : null}
                    <div className='small mb-2'>Domain của website bên ngoài phải nằm trong <code>allowedDomains</code>.</div>
                    <CFormTextarea rows={8} value={embedCode} readOnly style={{ fontFamily: 'monospace' }} />
                    <div className='mt-3 d-flex justify-content-end gap-2'>
                      <CButton color='primary' onClick={async () => {
                        // build embed code
                        try {
                          const envWidgetUrl = import.meta.env.VITE_CHAT_WIDGET_PUBLIC_URL || ''
                          const chatWidgetPublicUrl = (envWidgetUrl && String(envWidgetUrl).trim()) || (typeof window !== 'undefined' ? window.location.origin : '')
                          const envApi = import.meta.env.VITE_API_BASE_URL || ''
                          let apiCandidate = envApi && String(envApi).trim()
                          if (!apiCandidate) {
                            try { apiCandidate = String(api?.defaults?.baseURL || '').trim() } catch { apiCandidate = '' }
                          }
                          if (!apiCandidate && typeof window !== 'undefined') apiCandidate = window.location.origin
                          const baseNoApi = apiCandidate.replace(/\/api\/?$/i, '')
                          const finalApiBase = `${baseNoApi}/api`
                          const tenantCode = String(localStorage.getItem('tenantCode') || '').trim()
                          // Let embed consumer fall back to tenant-aware title when title is empty
                          const title = String(widgetConfig.widgetTitle || '').trim() || ''
                          const scriptSrc = `${chatWidgetPublicUrl.replace(/\/$/, '')}/chat-widget.js`
                          const code = `<div id="cogi-chat-root"></div>\n<script src="${scriptSrc}"></script>\n<script>\nwindow.COGIChat.init({\n  tenantCode: "${tenantCode}",\n  apiBaseUrl: "${finalApiBase}",\n  title: "${String(title).replace(/\"/g, '\\"')}"\n})\n<\/script>`
                          setEmbedCode(code)
                        } catch (err) {
                          setError('Không thể sinh mã nhúng')
                        }
                      }}>Sinh mã nhúng</CButton>
                      <CButton color='secondary' onClick={async () => {
                        if (!embedCode) return
                        try {
                          await navigator.clipboard.writeText(embedCode)
                          setSuccess('Đã sao chép mã nhúng')
                        } catch {
                          setError('Không thể sao chép')
                        }
                      }}>Copy mã nhúng</CButton>
                    </div>
                  </div>
              </>
            )}
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}