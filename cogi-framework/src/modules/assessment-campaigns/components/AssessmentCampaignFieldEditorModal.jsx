import { useEffect, useMemo, useState } from 'react'
import { CAlert, CButton, CCol, CFormInput, CFormLabel, CFormSelect, CFormTextarea, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CRow } from '@coreui/react'
import { getApiMessage } from '../services/assessmentCampaignService'

const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'Văn bản' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Số điện thoại' },
  { value: 'number', label: 'Số' },
  { value: 'date', label: 'Ngày' },
  { value: 'select', label: 'Danh sách chọn' },
  { value: 'radio', label: 'Chọn một' },
  { value: 'checkbox', label: 'Chọn nhiều' },
  { value: 'textarea', label: 'Văn bản dài' },
]

const STAGE_OPTIONS = [
  { value: 'before_start', label: 'Trước khi bắt đầu' },
  { value: 'before_result', label: 'Trước khi xem kết quả' },
  { value: 'optional', label: 'Không bắt buộc / bổ sung' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Hoạt động' },
  { value: 'inactive', label: 'Ngừng dùng' },
]

const OPTION_FIELD_TYPES = new Set(['select', 'radio', 'checkbox'])
const PLACEHOLDER_FIELD_TYPES = new Set(['text', 'email', 'phone', 'number', 'date', 'select', 'textarea'])

function normalizeOptionValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = String(value ?? '').trim()
  return text || null
}

function normalizeOptions(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') {
        const normalizedValue = normalizeOptionValue(item)
        return normalizedValue === null ? null : { label: String(item), value: normalizedValue }
      }
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null
      const label = String(item.label ?? '').trim()
      const normalizedValue = normalizeOptionValue(item.value)
      if (!label || normalizedValue === null) return null
      return { label, value: normalizedValue }
    })
    .filter(Boolean)
}

function parseAndValidateOptions(text, fieldType) {
  if (!OPTION_FIELD_TYPES.has(fieldType)) return { options: [], error: '' }
  const trimmed = String(text || '').trim()
  if (!trimmed) return { options: [], error: 'Các lựa chọn là bắt buộc với kiểu trường này.' }
  let parsed
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return { options: [], error: 'JSON lựa chọn không hợp lệ.' }
  }
  if (!Array.isArray(parsed)) return { options: [], error: 'Các lựa chọn phải là một mảng JSON.' }
  const normalized = normalizeOptions(parsed)
  if (normalized.length !== parsed.length) {
    return { options: [], error: 'Mỗi lựa chọn phải có đủ label và value.' }
  }
  if (normalized.length === 0) return { options: [], error: 'Các lựa chọn phải có ít nhất một phần tử.' }
  const seen = new Set()
  for (const item of normalized) {
    const identity = `${typeof item.value}:${String(item.value)}`
    if (seen.has(identity)) return { options: [], error: 'Giá trị value trong các lựa chọn không được trùng nhau.' }
    seen.add(identity)
  }
  return { options: normalized, error: '' }
}

function getStageHelpText(stage) {
  if (stage === 'before_start') return 'Trường này được thu trước khi người dùng bắt đầu bài đánh giá.'
  if (stage === 'before_result') return 'Trường này được thu sau khi nộp bài và trước khi xem kết quả.'
  return 'Trường này thuộc nhóm bổ sung theo semantics backend hiện tại và sẽ không tự động block ở các giai đoạn chính.'
}

function emptyForm() {
  return { key: '', label: '', fieldType: 'text', required: false, order: '1', placeholder: '', helpText: '', optionsText: '', collectStage: 'before_start', status: 'active' }
}

function normalizeForm(field) {
  return {
    key: field?.key || '',
    label: field?.label || '',
    fieldType: field?.fieldType || 'text',
    required: field?.required === true,
    order: String(field?.order ?? 1),
    placeholder: field?.placeholder || '',
    helpText: field?.helpText || '',
    optionsText: field?.options ? JSON.stringify(normalizeOptions(field.options), null, 2) : '',
    collectStage: field?.collectStage || 'before_start',
    status: field?.status || 'active',
  }
}

export default function AssessmentCampaignFieldEditorModal({ visible, saving, field, onClose, onSubmit }) {
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const [optionsError, setOptionsError] = useState('')

  const showOptionsEditor = OPTION_FIELD_TYPES.has(form.fieldType)
  const showPlaceholder = PLACEHOLDER_FIELD_TYPES.has(form.fieldType)
  const parsedOptionsState = useMemo(() => parseAndValidateOptions(form.optionsText, form.fieldType), [form.optionsText, form.fieldType])

  useEffect(() => {
    if (!visible) return
    setForm(field ? normalizeForm(field) : emptyForm())
    setError('')
    setOptionsError('')
  }, [field, visible])

  function handleClose() {
    if (saving) return
    setError('')
    setOptionsError('')
    onClose?.()
  }

  function handleFormatOptions() {
    const nextState = parseAndValidateOptions(form.optionsText, form.fieldType)
    if (nextState.error) {
      setOptionsError(nextState.error)
      return
    }
    setOptionsError('')
    setForm((prev) => ({ ...prev, optionsText: JSON.stringify(nextState.options, null, 2) }))
  }

  async function handleSave() {
    const trimmedKey = String(form.key || '').trim()
    if (!trimmedKey) return setError('Key là bắt buộc')
    if (/\s/.test(trimmedKey)) return setError('Key không được chứa khoảng trắng.')
    if (!String(form.label || '').trim()) return setError('Nhãn là bắt buộc')
    if (showOptionsEditor && parsedOptionsState.error) {
      setOptionsError(parsedOptionsState.error)
      return
    }
    try {
      setOptionsError('')
      await onSubmit?.({
        key: trimmedKey,
        label: String(form.label || '').trim(),
        fieldType: form.fieldType,
        required: form.required,
        order: Number(form.order || 0),
        placeholder: showPlaceholder ? (String(form.placeholder || '').trim() || null) : null,
        helpText: String(form.helpText || '').trim() || null,
        options: showOptionsEditor ? JSON.stringify(parsedOptionsState.options) : null,
        collectStage: form.collectStage,
        status: form.status,
      })
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được trường thu thập'))
    }
  }

  return (
    <CModal visible={visible} backdrop='static' size='lg' onClose={handleClose}>
      <CModalHeader><CModalTitle>{field ? 'Sửa trường thu thập' : 'Thêm trường thu thập'}</CModalTitle></CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CRow className='g-3'>
          <CCol md={4}><CFormLabel>Key</CFormLabel><CFormInput value={form.key} placeholder='learningGoals' onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))} /><div className='small text-body-secondary mt-1'>Dùng key ổn định, không có khoảng trắng. Ví dụ: learningGoals</div></CCol>
          <CCol md={5}><CFormLabel>Nhãn</CFormLabel><CFormInput value={form.label} onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))} /></CCol>
          <CCol md={3}><CFormLabel>Thứ tự</CFormLabel><CFormInput type='number' value={form.order} onChange={(event) => setForm((prev) => ({ ...prev, order: event.target.value }))} /></CCol>
          <CCol md={4}><CFormLabel>Kiểu</CFormLabel><CFormSelect value={form.fieldType} onChange={(event) => setForm((prev) => ({ ...prev, fieldType: event.target.value }))}>{FIELD_TYPE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</CFormSelect></CCol>
          <CCol md={4}><CFormLabel>Giai đoạn</CFormLabel><CFormSelect value={form.collectStage} onChange={(event) => setForm((prev) => ({ ...prev, collectStage: event.target.value }))}>{STAGE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</CFormSelect><div className='small text-body-secondary mt-1'>{getStageHelpText(form.collectStage)}</div></CCol>
          <CCol md={4}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}>{STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</CFormSelect><div className='small text-body-secondary mt-1'>Trường ngừng dùng sẽ không được thu thập trong chiến dịch.</div></CCol>
          <CCol md={4}><CFormLabel>Bắt buộc</CFormLabel><CFormSelect value={form.required ? 'true' : 'false'} onChange={(event) => setForm((prev) => ({ ...prev, required: event.target.value === 'true' }))}><option value='true'>Có</option><option value='false'>Không</option></CFormSelect><div className='small text-body-secondary mt-1'>Nếu bật, người dùng phải hoàn thành trường này ở đúng giai đoạn mới được tiếp tục.</div></CCol>
          {showPlaceholder ? <CCol md={8}><CFormLabel>Placeholder</CFormLabel><CFormInput value={form.placeholder} onChange={(event) => setForm((prev) => ({ ...prev, placeholder: event.target.value }))} /></CCol> : null}
          <CCol xs={12}><CFormLabel>Help text</CFormLabel><CFormTextarea rows={3} value={form.helpText} onChange={(event) => setForm((prev) => ({ ...prev, helpText: event.target.value }))} /></CCol>
          {showOptionsEditor ? (
            <CCol xs={12}>
              <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
                <CFormLabel className='mb-0'>Các lựa chọn</CFormLabel>
                <CButton type='button' size='sm' color='secondary' variant='outline' onClick={handleFormatOptions}>Định dạng JSON</CButton>
              </div>
              <div className='small text-body-secondary mb-2'>Nhập JSON dạng danh sách gồm label và value.</div>
              <CFormTextarea rows={8} placeholder={'[\n  { "label": "Online", "value": "online" },\n  { "label": "Tại trung tâm", "value": "offline" }\n]'} value={form.optionsText} onChange={(event) => { setForm((prev) => ({ ...prev, optionsText: event.target.value })); if (optionsError) setOptionsError('') }} />
              {optionsError || parsedOptionsState.error ? <div className='text-danger small mt-2'>{optionsError || parsedOptionsState.error}</div> : null}
              {!parsedOptionsState.error && parsedOptionsState.options.length > 0 ? (
                <div className='mt-3 border rounded p-3 bg-light'>
                  <div className='fw-semibold small mb-2'>Xem trước</div>
                  {form.fieldType === 'select' ? (
                    <CFormSelect value=''>
                      <option value=''>{parsedOptionsState.options[0]?.label || 'Chọn giá trị'}</option>
                    </CFormSelect>
                  ) : null}
                  {form.fieldType === 'radio' ? (
                    <div className='d-flex flex-column gap-2'>
                      {parsedOptionsState.options.map((item) => <label key={`${item.value}`} className='d-flex align-items-center gap-2'><input type='radio' disabled /><span>{item.label}</span></label>)}
                    </div>
                  ) : null}
                  {form.fieldType === 'checkbox' ? (
                    <div className='d-flex flex-column gap-2'>
                      {parsedOptionsState.options.map((item) => <label key={`${item.value}`} className='d-flex align-items-center gap-2'><input type='checkbox' disabled /><span>{item.label}</span></label>)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CCol>
          ) : null}
        </CRow>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={handleClose} disabled={saving}>Đóng</CButton>
        <CButton color='primary' onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu trường'}</CButton>
      </CModalFooter>
    </CModal>
  )
}