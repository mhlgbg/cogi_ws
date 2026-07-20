export function normalizeParticipantFormConfig(cfg) {
  if (!cfg) return { fields: [] }
  const fields = Array.isArray(cfg.fields) ? cfg.fields.map((f, idx) => ({
    key: f.key || `field_${idx}`,
    label: f.label || f.key || `Field ${idx + 1}`,
    placeholder: f.placeholder || '',
    editable: f.editable !== false,
    required: !!f.required,
    value: f.value || null,
  })) : []
  return { ...cfg, fields }
}
const ALLOWED_KEYS = ['participantCode','fullName','phone','email','className']

export function getDefaultParticipantFormConfig(mode = 'predefined') {
  if (mode === 'open') {
    return {
      fields: [
        { key: 'participantCode', label: 'Mã tham gia', enabled: false, required: false, editable: false, placeholder: '' },
        { key: 'fullName', label: 'Họ và tên', enabled: true, required: false, editable: true, placeholder: 'Nhập họ và tên' },
        { key: 'phone', label: 'Số điện thoại', enabled: true, required: true, editable: true, placeholder: 'Nhập số điện thoại để Ban tổ chức xác nhận khi nhận thưởng' },
        { key: 'email', label: 'Email', enabled: false, required: false, editable: true, placeholder: 'Nhập email' },
        { key: 'className', label: 'Lớp/Đơn vị', enabled: false, required: false, editable: true, placeholder: 'Nhập lớp hoặc đơn vị' },
      ],
    }
  }
  return {
    fields: [
      { key: 'participantCode', label: 'Mã tham gia', enabled: true, required: true, editable: true, placeholder: 'Nhập mã được Ban tổ chức cấp' },
      { key: 'fullName', label: 'Họ và tên', enabled: true, required: false, editable: true, placeholder: 'Nhập hoặc bổ sung họ và tên' },
      { key: 'phone', label: 'Số điện thoại', enabled: false, required: false, editable: true, placeholder: 'Nhập số điện thoại' },
      { key: 'email', label: 'Email', enabled: false, required: false, editable: true, placeholder: 'Nhập email' },
      { key: 'className', label: 'Lớp/Đơn vị', enabled: false, required: false, editable: true, placeholder: 'Nhập lớp hoặc đơn vị' },
    ],
  }
}

function findFieldIndex(fields, key) {
  return (fields || []).findIndex(f => String(f.key) === String(key))
}

export function normalizeParticipantFormConfig(raw, mode = 'predefined') {
  const def = getDefaultParticipantFormConfig(mode)
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.fields) || raw.fields.length === 0) return def
  const outFields = []
  for (const k of ALLOWED_KEYS) {
    const idx = findFieldIndex(raw.fields, k)
    if (idx >= 0) {
      const r = raw.fields[idx]
      const entry = {
        key: k,
        label: typeof r.label === 'string' ? r.label.trim() : (def.fields.find(d=>d.key===k).label),
        enabled: Boolean(r.enabled),
        required: Boolean(r.enabled) && Boolean(r.required),
        editable: Boolean(r.editable),
        placeholder: typeof r.placeholder === 'string' ? r.placeholder.trim() : (def.fields.find(d=>d.key===k).placeholder),
      }
      outFields.push(entry)
    } else {
      const d = def.fields.find(d=>d.key===k)
      outFields.push(Object.assign({}, d))
    }
  }
  return { fields: outFields }
}

export function sanitizeForSubmit(cfg) {
  if (!cfg || !Array.isArray(cfg.fields)) return null
  const seen = new Set()
  const fields = []
  for (const k of ALLOWED_KEYS) {
    const f = cfg.fields.find(x => String(x.key) === String(k))
    if (!f) continue
    if (seen.has(f.key)) continue
    seen.add(f.key)
    const label = (f.label || '').toString().trim() || getDefaultParticipantFormConfig().fields.find(d=>d.key===k).label
    const placeholder = (f.placeholder || '').toString().trim()
    const enabled = Boolean(f.enabled)
    const required = enabled ? Boolean(f.required) : false
    const editable = Boolean(f.editable)
    fields.push({ key: k, label, enabled, required, editable, placeholder })
  }
  return { fields }
}

export function isDefaultConfig(cfg, mode='predefined'){
  const def = getDefaultParticipantFormConfig(mode)
  return JSON.stringify(normalizeParticipantFormConfig(cfg, mode)) === JSON.stringify(def)
}

export default { getDefaultParticipantFormConfig, normalizeParticipantFormConfig, sanitizeForSubmit, isDefaultConfig }
