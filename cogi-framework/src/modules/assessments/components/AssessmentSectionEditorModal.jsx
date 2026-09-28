import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CButtonGroup,
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
import FileAssetPickerModal from '../../learning-management/components/FileAssetPickerModal'
import { STIMULUS_CONTENT_TYPE_OPTIONS, normalizeStimulusContentType } from '../../learning-management/components/StimulusContent'
import { buildInlineFillPlaceholderToken, getInlineFillQuestionCode, getInlineFillQuestionLabel, validateInlineFillLayout } from './inlineFillLayoutUtils'
import { getApiMessage } from '../services/assessmentService'
import { getEntityId, getFileAssetUrl, getStimulusTypeLabel } from '../../learning-management/utils/questionBankUi'

function emptyForm() {
  return {
    code: '',
    title: '',
    description: '',
    instruction: '',
    instructionContentType: 'plain_text',
    instructionImageAsset: null,
    stimulus: '',
    questionDisplayMode: 'single',
    questionLayoutContent: '',
    questionLayoutContentType: 'html',
    audioPlayLimit: '',
    order: '0',
    skill: '',
  }
}

function normalizeForm(section) {
  return {
    code: section?.code || '',
    title: section?.title || '',
    description: section?.description || '',
    instruction: section?.instruction || '',
    instructionContentType: normalizeStimulusContentType(section?.instructionContentType),
    instructionImageAsset: section?.instructionImageAsset || null,
    stimulus: getEntityId(section?.stimulus),
    questionDisplayMode: section?.questionDisplayMode || 'single',
    questionLayoutContent: section?.questionLayoutContent || '',
    questionLayoutContentType: section?.questionLayoutContentType || 'html',
    audioPlayLimit: section?.audioPlayLimit === null || section?.audioPlayLimit === undefined ? '' : String(section.audioPlayLimit),
    order: String(section?.order ?? 0),
    skill: getEntityId(section?.skill),
  }
}

export default function AssessmentSectionEditorModal({ visible, saving, section, versionId, skills = [], stimuli = [], assessmentQuestions = [], onClose, onSubmit }) {
  const [form, setForm] = useState(emptyForm())
  const [error, setError] = useState('')
  const [stimulusFilter, setStimulusFilter] = useState('')
  const [showInstructionImagePicker, setShowInstructionImagePicker] = useState(false)
  const [selectedQuestionCode, setSelectedQuestionCode] = useState('')

  const filteredStimuli = useMemo(() => {
    const query = String(stimulusFilter || '').trim().toLowerCase()
    if (!query) return Array.isArray(stimuli) ? stimuli : []
    return (Array.isArray(stimuli) ? stimuli : []).filter((item) => `${item?.code || ''} ${item?.title || ''} ${item?.type || ''}`.toLowerCase().includes(query))
  }, [stimuli, stimulusFilter])

  const partQuestions = useMemo(() => (Array.isArray(assessmentQuestions) ? assessmentQuestions : []).filter((item) => getInlineFillQuestionCode(item)), [assessmentQuestions])
  const inlineLayoutValidation = useMemo(() => validateInlineFillLayout(form.questionLayoutContent, partQuestions), [form.questionLayoutContent, partQuestions])

  useEffect(() => {
    if (!visible) return
    setForm(section ? normalizeForm(section) : emptyForm())
    setError('')
    setStimulusFilter('')
    setShowInstructionImagePicker(false)
    setSelectedQuestionCode('')
  }, [section, visible])

  function handleClose() {
    if (saving) return
    setError('')
    onClose?.()
  }

  async function handleSave() {
    if (!String(form.code || '').trim()) {
      setError('Mã phần là bắt buộc')
      return
    }
    if (!String(form.title || '').trim()) {
      setError('Tên phần là bắt buộc')
      return
    }

    if (form.questionDisplayMode === 'inline_fill') {
      const layoutContent = String(form.questionLayoutContent || '').trim()
      if (!layoutContent) {
        setError('Bố cục câu hỏi là bắt buộc khi chọn chế độ điền trực tiếp trong nội dung')
        return
      }
      if (partQuestions.length > 0 && inlineLayoutValidation.hasRenderablePlaceholders === false) {
        setError('Bố cục hiện chưa chứa placeholder nào trỏ tới câu hỏi thuộc phần này')
        return
      }
      if (inlineLayoutValidation.unknownCodes.length > 0) {
        setError(`Layout chứa placeholder không hợp lệ: ${inlineLayoutValidation.unknownCodes.join(', ')}`)
        return
      }
    }

    try {
      await onSubmit?.({
        assessmentVersion: versionId,
        code: String(form.code || '').trim(),
        title: String(form.title || '').trim(),
        description: String(form.description || '').trim() || null,
        instruction: String(form.instruction || '').trim() || null,
        instructionContentType: normalizeStimulusContentType(form.instructionContentType),
        instructionImageAsset: form.instructionImageAsset ? (form.instructionImageAsset.documentId || form.instructionImageAsset.id) : null,
        stimulus: form.stimulus || null,
        questionDisplayMode: form.questionDisplayMode === 'all' ? 'all' : form.questionDisplayMode === 'inline_fill' ? 'inline_fill' : 'single',
        questionLayoutContent: form.questionDisplayMode === 'inline_fill' ? String(form.questionLayoutContent || '').trim() || null : null,
        questionLayoutContentType: 'html',
        audioPlayLimit: form.audioPlayLimit === '' ? null : Number(form.audioPlayLimit),
        order: Number(form.order || 0),
        skill: form.skill || null,
      })
      setError('')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được phần thi'))
    }
  }

  function handleInsertQuestionToken() {
    const token = buildInlineFillPlaceholderToken(selectedQuestionCode)
    if (!token) return
    setForm((prev) => ({
      ...prev,
      questionLayoutContent: `${String(prev.questionLayoutContent || '')}${String(prev.questionLayoutContent || '').endsWith(' ') || !String(prev.questionLayoutContent || '') ? '' : ' '}${token}`,
    }))
  }

  const instructionImageUrl = getFileAssetUrl(form.instructionImageAsset)

  return (
    <>
      <CModal visible={visible} backdrop='static' size='xl' fullscreen='md-down' onClose={handleClose}>
        <CModalHeader>
          <CModalTitle>{section ? 'Sửa phần thi' : 'Tạo phần thi'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error ? <CAlert color='danger'>{error}</CAlert> : null}
          <div className='d-grid gap-4'>
            <section className='border rounded-3 p-3'>
              <div className='fw-semibold mb-3'>Thông tin chung</div>
              <CRow className='g-3'>
                <CCol md={4}><CFormLabel>Mã phần</CFormLabel><CFormInput value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} /></CCol>
                <CCol md={8}><CFormLabel>Tên phần</CFormLabel><CFormInput value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} /></CCol>
                <CCol md={4}><CFormLabel>Thứ tự</CFormLabel><CFormInput type='number' value={form.order} onChange={(event) => setForm((prev) => ({ ...prev, order: event.target.value }))} /></CCol>
                <CCol md={8}><CFormLabel>Kỹ năng</CFormLabel><CFormSelect value={form.skill} onChange={(event) => setForm((prev) => ({ ...prev, skill: event.target.value }))}><option value=''>Không chọn</option>{skills.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
                <CCol xs={12}><CFormLabel>Mô tả</CFormLabel><CFormTextarea rows={3} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></CCol>
              </CRow>
            </section>

            <section className='border rounded-3 p-3'>
              <div className='fw-semibold mb-3'>Hướng dẫn</div>
              <CRow className='g-3'>
                <CCol xs={12}>
                  <div className='d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2'>
                    <CFormLabel className='mb-0'>Nội dung hướng dẫn</CFormLabel>
                    <CButtonGroup size='sm' role='group' aria-label='Instruction content type'>
                      {STIMULUS_CONTENT_TYPE_OPTIONS.map((item) => (
                        <CButton
                          key={item.value}
                          type='button'
                          color={normalizeStimulusContentType(form.instructionContentType) === item.value ? 'primary' : 'secondary'}
                          variant={normalizeStimulusContentType(form.instructionContentType) === item.value ? undefined : 'outline'}
                          onClick={() => setForm((prev) => ({ ...prev, instructionContentType: item.value }))}
                          disabled={saving}
                        >
                          {item.label}
                        </CButton>
                      ))}
                    </CButtonGroup>
                  </div>
                  {normalizeStimulusContentType(form.instructionContentType) === 'html' ? (
                    <SimpleHtmlEditor
                      label=''
                      value={form.instruction}
                      onChange={(value) => setForm((prev) => ({ ...prev, instruction: value }))}
                      disabled={saving}
                      rows={8}
                      showImageControls={false}
                      allowHtmlMode
                      helperText='HTML đơn giản sẽ được sanitize an toàn khi lưu và khi render ở runner.'
                      placeholder='<p>There are seven questions in this part.</p><p>For each question, choose the correct answer A, B or C.</p>'
                    />
                  ) : (
                    <>
                      <CFormTextarea rows={5} value={form.instruction} onChange={(event) => setForm((prev) => ({ ...prev, instruction: event.target.value }))} />
                      <div className='small text-body-secondary mt-1'>Chế độ văn bản thuần giữ nguyên xuống dòng và không render thẻ HTML.</div>
                    </>
                  )}
                </CCol>
                <CCol xs={12}>
                  <CFormLabel>Ảnh hướng dẫn / Example</CFormLabel>
                  <div className='border rounded-3 p-3 bg-body-tertiary'>
                    {form.instructionImageAsset ? (
                      <div>
                        {instructionImageUrl ? <img src={instructionImageUrl} alt={form.instructionImageAsset.originalName || form.title || form.code || 'instruction-image'} style={{ width: '100%', maxWidth: 360, maxHeight: 240, objectFit: 'contain', borderRadius: 12 }} /> : null}
                        <div className='small text-body-secondary mt-2'>{form.instructionImageAsset.originalName || form.instructionImageAsset.fileName || 'Đã gắn ảnh hướng dẫn'}</div>
                        <div className='d-flex gap-2 mt-3 flex-wrap'>
                          <CButton color='secondary' variant='outline' onClick={() => setShowInstructionImagePicker(true)} size='sm' disabled={saving}>Thay ảnh</CButton>
                          <CButton color='danger' variant='outline' onClick={() => setForm((prev) => ({ ...prev, instructionImageAsset: null }))} size='sm' disabled={saving}>Xóa ảnh</CButton>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className='small text-body-secondary mb-3'>Chưa có ảnh hướng dẫn.</div>
                        <div className='d-flex gap-2 flex-wrap'>
                          <CButton color='secondary' variant='outline' onClick={() => setShowInstructionImagePicker(true)} size='sm' disabled={saving}>Chọn từ thư viện</CButton>
                          <CButton color='secondary' variant='outline' onClick={() => setShowInstructionImagePicker(true)} size='sm' disabled={saving}>Upload ảnh</CButton>
                        </div>
                      </div>
                    )}
                  </div>
                </CCol>
              </CRow>
            </section>

            <section className='border rounded-3 p-3'>
              <div className='fw-semibold mb-3'>Stimulus dùng chung</div>
              <CRow className='g-3'>
                <CCol md={4}><CFormLabel>Tìm stimulus</CFormLabel><CFormInput value={stimulusFilter} onChange={(event) => setStimulusFilter(event.target.value)} placeholder='Tìm theo code, title, type...' /></CCol>
                <CCol md={8}><CFormLabel>Chọn stimulus</CFormLabel><CFormSelect value={form.stimulus} onChange={(event) => setForm((prev) => ({ ...prev, stimulus: event.target.value }))}><option value=''>Không dùng stimulus chung</option>{filteredStimuli.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{`${item.code || '-'} · ${item.title || '-'} · ${getStimulusTypeLabel(item.type)}`}</option>)}</CFormSelect></CCol>
              </CRow>
            </section>

            <section className='border rounded-3 p-3'>
              <div className='fw-semibold mb-3'>Thiết lập hiển thị</div>
              <CRow className='g-3'>
                <CCol md={4}><CFormLabel>Số lần nghe</CFormLabel><CFormInput type='number' min={1} value={form.audioPlayLimit} onChange={(event) => setForm((prev) => ({ ...prev, audioPlayLimit: event.target.value }))} placeholder='Để trống = theo câu hỏi' /></CCol>
                <CCol md={8} className='d-flex align-items-end'><div className='small text-body-secondary'>Áp dụng cho audio dùng chung của phần. Nếu để trống, runner tiếp tục dùng cấu hình nghe ở từng câu như hiện tại.</div></CCol>
                <CCol xs={12}>
                  <CFormLabel className='d-block'>Hiển thị câu hỏi</CFormLabel>
                  <div className='d-flex gap-4 flex-wrap'>
                    <CFormCheck type='radio' name='questionDisplayMode' id='section-display-mode-single' label='Từng câu' checked={form.questionDisplayMode === 'single'} onChange={() => setForm((prev) => ({ ...prev, questionDisplayMode: 'single' }))} />
                    <CFormCheck type='radio' name='questionDisplayMode' id='section-display-mode-all' label='Tất cả câu trong phần' checked={form.questionDisplayMode === 'all'} onChange={() => setForm((prev) => ({ ...prev, questionDisplayMode: 'all' }))} />
                    <CFormCheck type='radio' name='questionDisplayMode' id='section-display-mode-inline-fill' label='Điền trực tiếp trong nội dung' checked={form.questionDisplayMode === 'inline_fill'} onChange={() => setForm((prev) => ({ ...prev, questionDisplayMode: 'inline_fill' }))} />
                  </div>
                </CCol>
              </CRow>
            </section>

            {form.questionDisplayMode === 'inline_fill' ? (
              <section className='border rounded-3 p-3'>
                <div className='fw-semibold mb-3'>Bố cục câu hỏi</div>
                <CRow className='g-3'>
                  <CCol md={8}>
                    <CFormLabel>Chèn câu hỏi</CFormLabel>
                    <div className='d-flex gap-2 flex-wrap'>
                      <CFormSelect value={selectedQuestionCode} onChange={(event) => setSelectedQuestionCode(event.target.value)} disabled={saving || partQuestions.length === 0}>
                        <option value=''>Chọn câu hỏi</option>
                        {partQuestions.map((item) => {
                          const questionCode = getInlineFillQuestionCode(item)
                          return <option key={questionCode} value={questionCode}>{getInlineFillQuestionLabel(item)}</option>
                        })}
                      </CFormSelect>
                      <CButton color='secondary' variant='outline' onClick={handleInsertQuestionToken} disabled={saving || !selectedQuestionCode}>Chèn</CButton>
                    </div>
                    <div className='small text-body-secondary mt-1'>Token được lưu theo cú pháp ổn định {'{{QUESTION_CODE}}'}.</div>
                  </CCol>
                  <CCol xs={12}>
                    <SimpleHtmlEditor
                      label=''
                      value={form.questionLayoutContent}
                      onChange={(value) => setForm((prev) => ({ ...prev, questionLayoutContent: value, questionLayoutContentType: 'html' }))}
                      disabled={saving}
                      rows={10}
                      showImageControls={false}
                      allowHtmlMode
                      helperText='HTML layout sẽ được sanitize an toàn. Placeholder hợp lệ sẽ được thay bằng answer control ở runner.'
                      placeholder='<h2>Caspar and the Circus Family</h2><p>Caspar’s mother dances across a {{PET1-T3-P2-L-PT3-Q14}} in the circus.</p>'
                    />
                  </CCol>
                  {inlineLayoutValidation.unknownCodes.length > 0 ? <CCol xs={12}><CAlert color='danger' className='mb-0'>{`Placeholder không thuộc phần này: ${inlineLayoutValidation.unknownCodes.join(', ')}`}</CAlert></CCol> : null}
                  {inlineLayoutValidation.duplicateCodes.length > 0 ? <CCol xs={12}><CAlert color='warning' className='mb-0'>{`Placeholder bị lặp: ${inlineLayoutValidation.duplicateCodes.join(', ')}`}</CAlert></CCol> : null}
                  {inlineLayoutValidation.missingQuestionCodes.length > 0 ? <CCol xs={12}><CAlert color='warning' className='mb-0'>{`Layout chưa chứa: ${inlineLayoutValidation.missingQuestionCodes.join(', ')}`}</CAlert></CCol> : null}
                  {partQuestions.length === 0 ? <CCol xs={12}><CAlert color='info' className='mb-0'>Phần này chưa có câu hỏi để chèn placeholder. Bạn có thể cấu hình layout trước, rồi thêm câu hỏi sau.</CAlert></CCol> : null}
                </CRow>
              </section>
            ) : null}
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color='secondary' variant='outline' onClick={handleClose} disabled={saving}>Đóng</CButton>
          <CButton color='primary' onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu phần'}</CButton>
        </CModalFooter>
      </CModal>

      <FileAssetPickerModal
        visible={showInstructionImagePicker}
        acceptedKind='image'
        title='Chọn ảnh hướng dẫn'
        moduleKey='question-bank'
        onClose={() => setShowInstructionImagePicker(false)}
        onSelect={(fileAsset) => {
          setForm((prev) => ({ ...prev, instructionImageAsset: fileAsset }))
          setShowInstructionImagePicker(false)
        }}
      />
    </>
  )
}
