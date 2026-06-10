import { useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
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
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { getApiMessage, getPlatformSettings, updatePlatformSetting } from '../services/platformApi'
import SimpleHtmlEditor from '../../modules/admission-management/components/SimpleHtmlEditor'

function toDisplayValue(value, dataType) {
  if (dataType === 'json') {
    try {
      return JSON.stringify(value ?? null)
    } catch {
      return String(value ?? '')
    }
  }

  if (dataType === 'html') {
    const text = String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    if (!text) return '<html>'
    return text.length > 120 ? `${text.slice(0, 117)}...` : text
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  if (value === null || value === undefined) return ''
  return String(value)
}

function createFormState(setting) {
  const dataType = String(setting?.dataType || '').trim() || 'string'
  const valueInput = dataType === 'json'
    ? JSON.stringify(setting?.value ?? null, null, 2)
    : dataType === 'boolean'
      ? (setting?.value === true ? 'true' : 'false')
      : setting?.value === null || setting?.value === undefined
        ? ''
        : String(setting.value)

  return {
    key: String(setting?.key || ''),
    valueInput,
    description: String(setting?.description || ''),
    group: String(setting?.group || ''),
    dataType,
    status: String(setting?.status || 'active') || 'active',
  }
}

function parseValueByDataType(dataType, valueInput) {
  if (dataType === 'number') {
    if (String(valueInput).trim() === '') return null
    const parsed = Number(valueInput)
    if (!Number.isFinite(parsed)) {
      throw new Error('Gia tri number khong hop le')
    }
    return parsed
  }

  if (dataType === 'boolean') {
    return String(valueInput) === 'true'
  }

  if (dataType === 'json') {
    const source = String(valueInput || '').trim()
    if (!source) return null

    try {
      return JSON.parse(source)
    } catch {
      throw new Error('JSON khong hop le')
    }
  }

  if (dataType === 'html') {
    return String(valueInput || '')
  }

  return String(valueInput || '')
}

export default function PlatformSettingsPage() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [settings, setSettings] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editingSetting, setEditingSetting] = useState(null)
  const [form, setForm] = useState(createFormState(null))

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setLoading(true)
      setError('')

      try {
        const result = await getPlatformSettings()
        if (cancelled) return
        setSettings(Array.isArray(result?.settings) ? result.settings : [])
      } catch (requestError) {
        if (cancelled) return
        setError(getApiMessage(requestError, 'Khong tai duoc danh sach platform settings'))
        setSettings([])
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [])

  async function reloadSettings() {
    const result = await getPlatformSettings()
    setSettings(Array.isArray(result?.settings) ? result.settings : [])
  }

  function handleOpenEdit(setting) {
    setIsModalOpen(true)
    setIsCreating(false)
    setEditingSetting(setting)
    setForm(createFormState(setting))
    setError('')
    setSuccess('')
  }

  function handleOpenCreate() {
    setIsModalOpen(true)
    setIsCreating(true)
    setEditingSetting(null)
    setForm(createFormState({ status: 'active' }))
    setError('')
    setSuccess('')
  }

  function handleCloseModal() {
    if (saving) return
    setIsModalOpen(false)
    setIsCreating(false)
    setEditingSetting(null)
    setForm(createFormState(null))
  }

  async function handleSubmit(event) {
    event?.preventDefault?.()

    const key = String(form.key || '').trim()

    if (!key) {
      setError('Vui long nhap setting key')
      return
    }

    if (!/^[A-Za-z0-9._-]+$/.test(key)) {
      setError('Setting key chi duoc gom chu, so, dau cham, gach ngang va gach duoi')
      return
    }

    if (isCreating && settings.some((setting) => String(setting?.key || '').trim().toLowerCase() === key.toLowerCase())) {
      setError('Setting key da ton tai')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const payload = {
        value: parseValueByDataType(form.dataType, form.valueInput),
        description: form.description,
        group: form.group,
        dataType: form.dataType,
        status: form.status,
      }

      await updatePlatformSetting(key, payload)
      await reloadSettings()
      setSuccess(isCreating ? 'Them moi platform setting thanh cong' : 'Cap nhat platform setting thanh cong')
      setIsModalOpen(false)
      setIsCreating(false)
      setEditingSetting(null)
      setForm(createFormState(null))
    } catch (requestError) {
      setError(getApiMessage(requestError, requestError?.message || 'Khong luu duoc platform setting'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <CCard>
        <CCardHeader>
          <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
            <strong>Platform Settings</strong>
            <CButton color='primary' size='sm' onClick={handleOpenCreate}>
              Them moi
            </CButton>
          </div>
        </CCardHeader>
        <CCardBody>
          <div className='mb-4 text-body-secondary'>
            Quan ly cau hinh global cap platform cho toan he thong multi-tenant.
          </div>

          {success ? <CAlert color='success'>{success}</CAlert> : null}
          {error ? <CAlert color='danger'>{error}</CAlert> : null}

          {loading ? (
            <div className='d-flex align-items-center gap-2'>
              <CSpinner size='sm' />
              <span>Dang tai platform settings...</span>
            </div>
          ) : settings.length === 0 ? (
            <div className='text-body-secondary'>Chua co platform setting nao.</div>
          ) : (
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell style={{ width: 160 }}>Group</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 220 }}>Key</CTableHeaderCell>
                  <CTableHeaderCell>Value</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 140 }}>Data Type</CTableHeaderCell>
                  <CTableHeaderCell>Description</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 120 }}>Status</CTableHeaderCell>
                  <CTableHeaderCell style={{ width: 120 }}>Actions</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {settings.map((setting) => (
                  <CTableRow key={setting.id || setting.key}>
                    <CTableDataCell>{setting.group || '-'}</CTableDataCell>
                    <CTableDataCell>{setting.key || '-'}</CTableDataCell>
                    <CTableDataCell>{toDisplayValue(setting.value, setting.dataType) || '-'}</CTableDataCell>
                    <CTableDataCell>{setting.dataType || '-'}</CTableDataCell>
                    <CTableDataCell>{setting.description || '-'}</CTableDataCell>
                    <CTableDataCell>{setting.status || '-'}</CTableDataCell>
                    <CTableDataCell>
                      <CButton color='primary' variant='outline' size='sm' onClick={() => handleOpenEdit(setting)}>
                        Edit
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>

      <CModal visible={isModalOpen} onClose={handleCloseModal} size={form.dataType === 'html' ? 'xl' : undefined}>
        <CModalHeader closeButton={!saving}>
          <CModalTitle>{isCreating ? 'Them moi Platform Setting' : 'Chinh sua Platform Setting'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <CForm onSubmit={handleSubmit}>
            <CRow className='g-3'>
              <CCol md={12}>
                <CFormLabel htmlFor='platform-setting-key'>Key</CFormLabel>
                <CFormInput
                  id='platform-setting-key'
                  value={form.key}
                  onChange={(event) => setForm((previous) => ({ ...previous, key: event.target.value }))}
                  readOnly={!isCreating}
                  disabled={saving || !isCreating}
                  placeholder='tenantAdminRoleCode'
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel htmlFor='platform-setting-group'>Group</CFormLabel>
                <CFormInput
                  id='platform-setting-group'
                  value={form.group}
                  onChange={(event) => setForm((previous) => ({ ...previous, group: event.target.value }))}
                  disabled={saving}
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel htmlFor='platform-setting-data-type'>Data Type</CFormLabel>
                <CFormSelect
                  id='platform-setting-data-type'
                  value={form.dataType}
                  onChange={(event) => setForm((previous) => ({ ...previous, dataType: event.target.value }))}
                  disabled={saving}
                >
                  <option value='string'>string</option>
                  <option value='number'>number</option>
                  <option value='boolean'>boolean</option>
                  <option value='json'>json</option>
                  <option value='html'>html</option>
                </CFormSelect>
              </CCol>
              <CCol md={12}>
                <CFormLabel htmlFor='platform-setting-value'>Value</CFormLabel>
                {form.dataType === 'html' ? (
                  <SimpleHtmlEditor
                    label=''
                    rows={14}
                    value={form.valueInput}
                    onChange={(nextValue) => setForm((previous) => ({ ...previous, valueInput: nextValue }))}
                    disabled={saving}
                    placeholder='<p>Noi dung HTML cua platform setting...</p>'
                    helperText='Dung trinh soan thao HTML de cau hinh noi dung rich text cap platform.'
                  />
                ) : form.dataType === 'json' ? (
                  <CFormTextarea
                    id='platform-setting-value'
                    rows={10}
                    value={form.valueInput}
                    onChange={(event) => setForm((previous) => ({ ...previous, valueInput: event.target.value }))}
                    disabled={saving}
                  />
                ) : form.dataType === 'boolean' ? (
                  <CFormSelect
                    id='platform-setting-value'
                    value={form.valueInput}
                    onChange={(event) => setForm((previous) => ({ ...previous, valueInput: event.target.value }))}
                    disabled={saving}
                  >
                    <option value='true'>true</option>
                    <option value='false'>false</option>
                  </CFormSelect>
                ) : (
                  <CFormInput
                    id='platform-setting-value'
                    type={form.dataType === 'number' ? 'number' : 'text'}
                    value={form.valueInput}
                    onChange={(event) => setForm((previous) => ({ ...previous, valueInput: event.target.value }))}
                    disabled={saving}
                  />
                )}
              </CCol>
              <CCol md={12}>
                <CFormLabel htmlFor='platform-setting-description'>Description</CFormLabel>
                <CFormTextarea
                  id='platform-setting-description'
                  rows={4}
                  value={form.description}
                  onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                  disabled={saving}
                />
              </CCol>
              <CCol md={12}>
                <CFormLabel htmlFor='platform-setting-status'>Status</CFormLabel>
                <CFormInput
                  id='platform-setting-status'
                  value={form.status}
                  onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value }))}
                  disabled={saving}
                />
              </CCol>
            </CRow>
          </CForm>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={handleCloseModal} disabled={saving}>
            Dong
          </CButton>
          <CButton color='primary' onClick={handleSubmit} disabled={saving}>
            {saving ? 'Dang luu...' : 'Luu'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}