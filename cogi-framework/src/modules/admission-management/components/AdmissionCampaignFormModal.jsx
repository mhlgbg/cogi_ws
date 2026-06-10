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
import SimpleHtmlEditor from './SimpleHtmlEditor'
import { TS2026_DEFAULT_REVIEW_DISPLAY_CONFIG } from '../utils/reviewDisplayConfig'

const DEFAULT_APPLICATION_STATUS_GUIDE = {
  draft: {
    title: 'Hồ sơ chưa được nộp đúng hạn',
    message: 'Đã hết hạn nộp hồ sơ.',
    color: 'warning',
    nextSteps: [
      'Nhà trường cảm ơn Phụ huynh đã quan tâm đến thông tin kỳ tuyển sinh.',
    ],
  },
  submitted: {
    title: 'Đã nộp hồ sơ',
    message: 'Hồ sơ của học sinh đã được gửi tới Nhà trường và đang chờ rà soát.',
    color: 'info',
    nextSteps: [
      'Phụ huynh vui lòng theo dõi trạng thái hồ sơ trên hệ thống.',
      'Nhà trường sẽ cập nhật kết quả sau khi rà soát.',
    ],
  },
  reviewing: {
    title: 'Đang xét duyệt hồ sơ',
    message: 'Cán bộ tuyển sinh đang kiểm tra thông tin và minh chứng trong hồ sơ.',
    color: 'warning',
    nextSteps: [
      'Phụ huynh vui lòng chờ thông báo tiếp theo từ Nhà trường.',
    ],
  },
  need_update: {
    title: 'Cần bổ sung hồ sơ',
    message: 'Hồ sơ cần được bổ sung hoặc điều chỉnh theo yêu cầu của Nhà trường.',
    color: 'danger',
    nextSteps: [
      'Phụ huynh vui lòng đọc kỹ nội dung trao đổi với Nhà trường.',
      'Thực hiện bổ sung theo hướng dẫn và nộp lại hồ sơ.',
    ],
  },
  accepted: {
    title: 'Đã tiếp nhận hồ sơ',
    message: 'Hồ sơ của học sinh đã được Nhà trường tiếp nhận.',
    color: 'success',
    nextSteps: [
      'Phụ huynh tiếp tục theo dõi các thông tin tiếp theo.',
      'Chậm nhất ngày 03/06/2026, phụ huynh có thể tải và tự in thẻ dự thi trên hệ thống.',
    ],
  },
  rejected: {
    title: 'Không tiếp nhận hồ sơ',
    message: 'Hồ sơ chưa đáp ứng điều kiện tiếp nhận theo quy định của kỳ tuyển sinh.',
    color: 'secondary',
    nextSteps: [
      'Phụ huynh vui lòng theo dõi thông báo cụ thể từ Nhà trường nếu có.',
    ],
  },
}

const EXAM_CARD_TEMPLATE_VARIABLES = [
  { label: 'Logo tenant', value: '{{tenantLogo}}', description: 'Logo đơn vị' },
  { label: 'Tên tenant', value: '{{tenantName}}', description: 'Tên đơn vị' },
  { label: 'Tên kỳ TS', value: '{{campaignName}}', description: 'Tên chiến dịch tuyển sinh' },
  { label: 'Họ tên', value: '{{studentName}}', description: 'Họ tên thí sinh' },
  { label: 'Mã HS', value: '{{studentCode}}', description: 'Mã học sinh' },
  { label: 'Mã hồ sơ', value: '{{applicationCode}}', description: 'Mã hồ sơ' },
  { label: 'SBD', value: '{{candidateNumber}}', description: 'Số báo danh' },
  { label: 'Ngày sinh', value: '{{dateOfBirth}}', description: 'Ngày sinh' },
  { label: 'Địa điểm', value: '{{examLocation}}', description: 'Địa điểm kiểm tra' },
  { label: 'Phòng', value: '{{examRoom}}', description: 'Phòng kiểm tra' },
  { label: 'Ảnh thẻ', value: '{{cardImagePath}}', description: 'Đường dẫn ảnh thẻ 3x4' },
  { label: 'URL tra cứu QR', value: '{{qrCodeUrl}}', description: 'Đường dẫn công khai dùng để sinh QR' },
  { label: 'Ảnh QR base64', value: '{{qrCodeDataUrl}}', description: 'Ảnh QR code dạng data URL để gắn trực tiếp vào template' },
]

const EXAM_CARD_REMINDER_VARIABLES = [
  { label: 'Họ tên', value: '{{fullName}}', description: 'Họ tên học sinh/phụ huynh trong email nhắc' },
  { label: 'Mã HS', value: '{{studentCode}}', description: 'Mã học sinh' },
  { label: 'Mã hồ sơ', value: '{{applicationCode}}', description: 'Mã hồ sơ' },
  { label: 'SBD', value: '{{candidateNumber}}', description: 'Số báo danh' },
  { label: 'Phòng', value: '{{examRoom}}', description: 'Phòng kiểm tra' },
  { label: 'Địa điểm', value: '{{examLocation}}', description: 'Địa điểm kiểm tra' },
  { label: 'Link tra cứu', value: '{{lookupUrl}}', description: 'Đường dẫn để phụ huynh mở thẻ dự kiểm tra' },
]

const SCORE_REPORT_TEMPLATE_VARIABLES = [
  { label: 'Logo tenant', value: '{{tenantLogo}}', description: 'Logo đơn vị' },
  { label: 'Tên tenant', value: '{{tenantName}}', description: 'Tên đơn vị' },
  { label: 'Tên kỳ TS', value: '{{campaignName}}', description: 'Tên chiến dịch tuyển sinh' },
  { label: 'Họ tên', value: '{{studentName}}', description: 'Họ tên thí sinh' },
  { label: 'Mã HS', value: '{{studentCode}}', description: 'Mã học sinh' },
  { label: 'Mã hồ sơ', value: '{{applicationCode}}', description: 'Mã hồ sơ' },
  { label: 'SBD', value: '{{candidateNumber}}', description: 'Số báo danh' },
  { label: 'Tổng điểm', value: '{{totalScore}}', description: 'Tổng điểm đánh giá' },
  { label: 'Kết quả', value: '{{finalResult}}', description: 'Kết quả tổng hợp' },
]

const DEFAULT_EXAM_CARD_REMINDER_EMAIL_SUBJECT = 'Nhắc in thẻ dự kiểm tra đánh giá năng lực'
const DEFAULT_EXAM_CARD_REMINDER_EMAIL_HTML = [
  '<p>Kính gửi Quý phụ huynh <strong>{{fullName}}</strong>,</p>',
  '<p>Nhà trường trân trọng nhắc Quý phụ huynh kiểm tra và tải/in thẻ dự kiểm tra cho học sinh.</p>',
  '<ul>',
  '<li>Mã học sinh: <strong>{{studentCode}}</strong></li>',
  '<li>Mã hồ sơ: <strong>{{applicationCode}}</strong></li>',
  '<li>Số báo danh: <strong>{{candidateNumber}}</strong></li>',
  '<li>Phòng kiểm tra: <strong>{{examRoom}}</strong></li>',
  '<li>Địa điểm kiểm tra: <strong>{{examLocation}}</strong></li>',
  '</ul>',
  '<p>Quý phụ huynh vui lòng truy cập đường dẫn sau để xem thông tin chi tiết và tải/in thẻ dự kiểm tra:</p>',
  '<p><a href="{{lookupUrl}}">{{lookupUrl}}</a></p>',
  '<p>Trân trọng.</p>',
].join('')

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

function buildInitialReviewDisplayConfig(initialValues) {
  if (initialValues?.reviewDisplayConfig) {
    return JSON.stringify(initialValues.reviewDisplayConfig, null, 2)
  }

  if (String(initialValues?.code || '').trim().toLowerCase() === 'ts2026') {
    return JSON.stringify(TS2026_DEFAULT_REVIEW_DISPLAY_CONFIG, null, 2)
  }

  return ''
}

function buildInitialApplicationStatusGuide(initialValues) {
  if (initialValues?.applicationStatusGuide) {
    return JSON.stringify(initialValues.applicationStatusGuide, null, 2)
  }

  return JSON.stringify(DEFAULT_APPLICATION_STATUS_GUIDE, null, 2)
}

function buildInitialState(initialValues) {
  return {
    name: initialValues?.name || '',
    code: initialValues?.code || '',
    year: initialValues?.year ? String(initialValues.year) : '',
    grade: initialValues?.grade || '',
    startDate: initialValues?.startDate || '',
    endDate: initialValues?.endDate || '',
    campaignStatus: initialValues?.campaignStatus || initialValues?.status || 'draft',
    description: initialValues?.description || '',
    examCardTemplateHtml: initialValues?.examCardTemplateHtml || '',
    scoreReportTemplateHtml: initialValues?.scoreReportTemplateHtml || '',
    scorePublishedAt: formatDateTimeLocalValue(initialValues?.scorePublishedAt),
    examCardReminderEmailSubject: initialValues?.examCardReminderEmailSubject || DEFAULT_EXAM_CARD_REMINDER_EMAIL_SUBJECT,
    examCardReminderEmailHtml: initialValues?.examCardReminderEmailHtml || DEFAULT_EXAM_CARD_REMINDER_EMAIL_HTML,
    allowExamCardPrinting: initialValues?.allowExamCardPrinting === true,
    examCardPrintStartAt: formatDateTimeLocalValue(initialValues?.examCardPrintStartAt),
    examCardPrintEndAt: formatDateTimeLocalValue(initialValues?.examCardPrintEndAt),
    isActive: initialValues?.isActive !== false,
    formTemplate: initialValues?.formTemplate?.id ? String(initialValues.formTemplate.id) : '',
    reviewDisplayConfig: buildInitialReviewDisplayConfig(initialValues),
    applicationStatusGuide: buildInitialApplicationStatusGuide(initialValues),
  }
}

export default function AdmissionCampaignFormModal({
  visible,
  initialValues,
  formTemplateOptions = [],
  onClose,
  onSubmit,
  submitting = false,
}) {
  const [form, setForm] = useState(buildInitialState(initialValues))

  useEffect(() => {
    if (!visible) return
    setForm(buildInitialState(initialValues))
  }, [initialValues, visible])

  const selectedTemplate = useMemo(
    () => (Array.isArray(formTemplateOptions) ? formTemplateOptions : []).find((item) => String(item?.id || '') === String(form.formTemplate || '')) || null,
    [form.formTemplate, formTemplateOptions],
  )

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onSubmit?.({
      name: String(form.name || '').trim(),
      code: String(form.code || '').trim(),
      year: Number(form.year || 0),
      grade: String(form.grade || '').trim(),
      startDate: String(form.startDate || '').trim() || null,
      endDate: String(form.endDate || '').trim() || null,
      campaignStatus: String(form.campaignStatus || 'draft').trim(),
      description: String(form.description || '').trim(),
      examCardTemplateHtml: String(form.examCardTemplateHtml || '').trim(),
      scoreReportTemplateHtml: String(form.scoreReportTemplateHtml || '').trim(),
      scorePublishedAt: String(form.scorePublishedAt || '').trim() || null,
      examCardReminderEmailSubject: String(form.examCardReminderEmailSubject || '').trim(),
      examCardReminderEmailHtml: String(form.examCardReminderEmailHtml || '').trim(),
      allowExamCardPrinting: form.allowExamCardPrinting === true,
      examCardPrintStartAt: String(form.examCardPrintStartAt || '').trim() || null,
      examCardPrintEndAt: String(form.examCardPrintEndAt || '').trim() || null,
      reviewDisplayConfig: String(form.reviewDisplayConfig || '').trim() || null,
      applicationStatusGuide: String(form.applicationStatusGuide || '').trim() || null,
      isActive: form.isActive === true,
      formTemplate: Number(form.formTemplate || 0),
    })
  }

  return (
    <CModal visible={visible} onClose={() => !submitting && onClose?.()} size='lg' backdrop='static'>
      <CModalHeader>
        <CModalTitle>{initialValues?.id ? 'Chỉnh sửa chiến dịch tuyển sinh' : 'Thêm chiến dịch tuyển sinh'}</CModalTitle>
      </CModalHeader>
      <form onSubmit={handleSubmit}>
        <CModalBody>
          <CRow className='g-3'>
            <CCol md={8}>
              <CFormLabel>Tên chiến dịch</CFormLabel>
              <CFormInput value={form.name} onChange={(event) => updateField('name', event.target.value)} required disabled={submitting} />
            </CCol>
            <CCol md={4}>
              <CFormLabel>Mã chiến dịch</CFormLabel>
              <CFormInput value={form.code} onChange={(event) => updateField('code', event.target.value)} required disabled={submitting} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Năm</CFormLabel>
              <CFormInput type='number' min={1} value={form.year} onChange={(event) => updateField('year', event.target.value)} required disabled={submitting} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Khối</CFormLabel>
              <CFormInput value={form.grade} onChange={(event) => updateField('grade', event.target.value)} required disabled={submitting} />
            </CCol>
            <CCol md={6}>
              <CFormLabel>FormTemplate</CFormLabel>
              <CFormSelect value={form.formTemplate} onChange={(event) => updateField('formTemplate', event.target.value)} required disabled={submitting}>
                <option value=''>Chọn FormTemplate</option>
                {(Array.isArray(formTemplateOptions) ? formTemplateOptions : []).map((item) => (
                  <option key={item.id} value={item.id}>{item.label || `${item.name || '-'} v${item.version || 0}`}</option>
                ))}
              </CFormSelect>
              <div className='small text-body-secondary mt-1'>Version hiện tại: {selectedTemplate?.version || 0}</div>
            </CCol>
            <CCol md={3}>
              <CFormLabel>Từ ngày</CFormLabel>
              <CFormInput type='date' value={form.startDate} onChange={(event) => updateField('startDate', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Đến ngày</CFormLabel>
              <CFormInput type='date' value={form.endDate} onChange={(event) => updateField('endDate', event.target.value)} disabled={submitting} />
            </CCol>
            <CCol md={3}>
              <CFormLabel>Trạng thái</CFormLabel>
              <CFormSelect value={form.campaignStatus} onChange={(event) => updateField('campaignStatus', event.target.value)} disabled={submitting}>
                <option value='draft'>draft</option>
                <option value='open'>open</option>
                <option value='closed'>closed</option>
              </CFormSelect>
            </CCol>
            <CCol md={3} className='d-flex align-items-end'>
              <CFormCheck label='Đang hoạt động' checked={form.isActive} onChange={(event) => updateField('isActive', event.target.checked)} disabled={submitting} />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Review Display Config (JSON)</CFormLabel>
              <CFormTextarea
                rows={12}
                value={form.reviewDisplayConfig}
                onChange={(event) => updateField('reviewDisplayConfig', event.target.value)}
                disabled={submitting}
                placeholder='{"sections": [{"title": "Thông tin học sinh", "fields": [{"key": "studentName", "label": "Họ tên học sinh"}]}]}'
              />
              <div className='small text-body-secondary mt-1'>Nếu để trống, màn review sẽ fallback về cách hiển thị hiện tại. Riêng mã chiến dịch TS2026 sẽ dùng cấu hình mặc định trong code.</div>
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Application Status Guide (JSON)</CFormLabel>
              <CFormTextarea
                rows={16}
                value={form.applicationStatusGuide}
                onChange={(event) => updateField('applicationStatusGuide', event.target.value)}
                disabled={submitting}
                placeholder='{"submitted":{"title":"Hồ sơ đã được nộp","message":"...","color":"info","nextSteps":["..."]}}'
              />
              <div className='small text-body-secondary mt-1'>Cấu hình thông điệp phụ huynh nhìn thấy ở trang tra cứu kết quả theo các key: submitted, reviewing, need_update, accepted, rejected.</div>
            </CCol>
            <CCol xs={12}>
              <SimpleHtmlEditor
                label='Mô tả HTML'
                rows={10}
                value={form.description}
                onChange={(nextValue) => updateField('description', nextValue)}
                disabled={submitting}
                placeholder='<p>Giới thiệu kỳ tuyển sinh...</p><ul><li>Điểm nổi bật</li></ul>'
              />
            </CCol>
            <CCol xs={12}>
              <SimpleHtmlEditor
                label='Mẫu HTML thẻ dự kiểm tra'
                rows={12}
                value={form.examCardTemplateHtml}
                onChange={(nextValue) => updateField('examCardTemplateHtml', nextValue)}
                disabled={submitting}
                placeholder='<div><img src="{{tenantLogo}}" alt="Logo" /><h2>THẺ DỰ KIỂM TRA</h2><p>{{studentName}}</p><p>SBD: {{candidateNumber}}</p></div>'
                variableTokens={EXAM_CARD_TEMPLATE_VARIABLES}
                helperText='Có thể soạn HTML mẫu thẻ dự kiểm tra và chèn trực tiếp các biến bên trên vào nội dung. Dữ liệu này sẽ được dùng cho tính năng in thẻ sau này.'
              />
            </CCol>
            <CCol xs={12}>
              <SimpleHtmlEditor
                label='Mẫu HTML phiếu báo điểm'
                rows={12}
                value={form.scoreReportTemplateHtml}
                onChange={(nextValue) => updateField('scoreReportTemplateHtml', nextValue)}
                disabled={submitting}
                placeholder='<div><img src="{{tenantLogo}}" alt="Logo" /><h2>PHIẾU BÁO ĐIỂM</h2><p>{{studentName}}</p><p>Mã HS: {{studentCode}}</p><p>Tổng điểm: {{totalScore}}</p></div>'
                variableTokens={SCORE_REPORT_TEMPLATE_VARIABLES}
                helperText='Có thể soạn HTML mẫu phiếu báo điểm và chèn trực tiếp các biến bên trên vào nội dung.'
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Thời điểm công bố điểm</CFormLabel>
              <CFormInput
                type='datetime-local'
                value={form.scorePublishedAt}
                onChange={(event) => updateField('scorePublishedAt', event.target.value)}
                disabled={submitting}
              />
            </CCol>
            <CCol xs={12}>
              <CFormLabel>Tiêu đề email nhắc tải thẻ</CFormLabel>
              <CFormInput
                value={form.examCardReminderEmailSubject}
                onChange={(event) => updateField('examCardReminderEmailSubject', event.target.value)}
                disabled={submitting}
                placeholder={DEFAULT_EXAM_CARD_REMINDER_EMAIL_SUBJECT}
              />
            </CCol>
            <CCol xs={12}>
              <SimpleHtmlEditor
                label='Nội dung email nhắc tải thẻ'
                rows={12}
                value={form.examCardReminderEmailHtml}
                onChange={(nextValue) => updateField('examCardReminderEmailHtml', nextValue)}
                disabled={submitting}
                placeholder={DEFAULT_EXAM_CARD_REMINDER_EMAIL_HTML}
                variableTokens={EXAM_CARD_REMINDER_VARIABLES}
                helperText='Các biến hỗ trợ: {{fullName}}, {{studentCode}}, {{applicationCode}}, {{candidateNumber}}, {{examRoom}}, {{examLocation}}, {{lookupUrl}}.'
              />
            </CCol>
            <CCol xs={12}>
              <CFormCheck
                label='Cho phép phụ huynh xem/in thẻ dự kiểm tra'
                checked={form.allowExamCardPrinting}
                onChange={(event) => updateField('allowExamCardPrinting', event.target.checked)}
                disabled={submitting}
              />
            </CCol>
            <CCol md={6}>
              <CFormLabel>Thời gian bắt đầu phát hành thẻ</CFormLabel>
              <CFormInput
                type='datetime-local'
                value={form.examCardPrintStartAt}
                onChange={(event) => updateField('examCardPrintStartAt', event.target.value)}
                disabled={submitting}
              />
              <div className='small text-body-secondary mt-1'>Nếu chưa nhập thời gian bắt đầu, hệ thống hiểu là cho phép ngay khi bật.</div>
            </CCol>
            <CCol md={6}>
              <CFormLabel>Thời gian kết thúc phát hành thẻ</CFormLabel>
              <CFormInput
                type='datetime-local'
                value={form.examCardPrintEndAt}
                onChange={(event) => updateField('examCardPrintEndAt', event.target.value)}
                disabled={submitting}
              />
              <div className='small text-body-secondary mt-1'>Nếu chưa nhập thời gian kết thúc, hệ thống hiểu là không giới hạn thời gian kết thúc.</div>
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