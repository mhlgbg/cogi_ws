import { useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
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
import { getQuestions } from '../../learning-management/services/learningObjectApi'
import { getApiMessage } from '../services/assessmentService'
import { getEntityId, getQuestionTypeLabel, truncateText } from '../../learning-management/utils/questionBankUi'

function parsePercentToRatio(value) {
  const text = String(value || '').trim()
  if (text === '') return { ratio: null, error: '' }
  const percent = Number(text)
  if (!Number.isFinite(percent)) return { ratio: null, error: 'Tỷ lệ nghe tối thiểu phải là một số hợp lệ.' }
  if (percent < 0 || percent > 100) return { ratio: null, error: 'Tỷ lệ nghe tối thiểu phải nằm trong khoảng 0 đến 100%.' }
  return { ratio: percent === 0 ? 0 : percent / 100, error: '' }
}

export default function AssessmentQuestionPickerModal({ visible, section, bootstrap, saving, onClose, onAdd }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState({ q: '', qDraft: '', subjectId: '', gradeId: '', skillId: '', type: '', difficulty: '', questionStatus: 'active', hasStimulus: '' })
  const [selectedIds, setSelectedIds] = useState([])
  const [defaults, setDefaults] = useState({ points: '1', required: true, audioPlayLimit: '', allowSeek: true, minListenRatioBeforeAnswerPercent: '', minWords: '', maxWords: '' })

  const subjects = bootstrap?.subjects || []
  const grades = bootstrap?.grades || []
  const skills = bootstrap?.skills || []
  const questionTypes = bootstrap?.questionTypes || []
  const difficulties = bootstrap?.difficulties || []
  const sectionSkillId = getEntityId(section?.skill)

  useEffect(() => {
    if (!visible) return
    setSelectedIds([])
    setError('')
    setFilters((prev) => ({ ...prev, skillId: sectionSkillId || prev.skillId }))
  }, [sectionSkillId, visible])

  useEffect(() => {
    if (!visible) return
    loadQuestions()
  }, [visible, filters.q, filters.subjectId, filters.gradeId, filters.skillId, filters.type, filters.difficulty, filters.questionStatus, filters.hasStimulus])

  async function loadQuestions() {
    setLoading(true)
    setError('')
    try {
      const payload = await getQuestions({
        page: 1,
        pageSize: 100,
        sort: ['code:asc', 'id:asc'],
        q: filters.q || undefined,
        subjectId: filters.subjectId || undefined,
        gradeId: filters.gradeId || undefined,
        skillId: filters.skillId || undefined,
        type: filters.type || undefined,
        difficulty: filters.difficulty || undefined,
        questionStatus: filters.questionStatus || undefined,
        hasStimulus: filters.hasStimulus || undefined,
      })
      setRows(Array.isArray(payload?.data) ? payload.data : [])
    } catch (requestError) {
      setRows([])
      setError(getApiMessage(requestError, 'Không tải được danh sách câu hỏi'))
    } finally {
      setLoading(false)
    }
  }

  function toggleQuestion(id) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
  }

  async function handleConfirm() {
    if (selectedIds.length === 0) {
      setError('Vui lòng chọn ít nhất một câu hỏi')
      return
    }
    try {
      const listenRatio = parsePercentToRatio(defaults.minListenRatioBeforeAnswerPercent)
      if (listenRatio.error) {
        setError(listenRatio.error)
        return
      }
      await onAdd?.({ questionIds: selectedIds, defaults: { ...defaults, minListenRatioBeforeAnswer: listenRatio.ratio } })
      setError('')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thêm được câu hỏi vào phần thi'))
    }
  }

  function handleClose() {
    if (loading || saving) return
    onClose?.()
  }

  return (
    <CModal visible={visible} backdrop='static' size='xl' onClose={handleClose}>
      <CModalHeader>
        <CModalTitle>{`Chọn câu hỏi cho phần ${section?.title || ''}`}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CRow className='g-3 align-items-end mb-4'>
          <CCol md={4}><CFormInput label='Từ khóa' value={filters.qDraft} onChange={(event) => setFilters((prev) => ({ ...prev, qDraft: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') setFilters((prev) => ({ ...prev, q: String(prev.qDraft || '').trim() })) }} placeholder='Tìm theo mã hoặc nội dung...' /></CCol>
          <CCol md={2}><CFormLabel>Môn học</CFormLabel><CFormSelect value={filters.subjectId} onChange={(event) => setFilters((prev) => ({ ...prev, subjectId: event.target.value }))}><option value=''>Tất cả</option>{subjects.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
          <CCol md={2}><CFormLabel>Khối</CFormLabel><CFormSelect value={filters.gradeId} onChange={(event) => setFilters((prev) => ({ ...prev, gradeId: event.target.value }))}><option value=''>Tất cả</option>{grades.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
          <CCol md={2}><CFormLabel>Kỹ năng</CFormLabel><CFormSelect value={filters.skillId} onChange={(event) => setFilters((prev) => ({ ...prev, skillId: event.target.value }))}><option value=''>Tất cả</option>{skills.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}</CFormSelect></CCol>
          <CCol md={2}><CFormLabel>Loại</CFormLabel><CFormSelect value={filters.type} onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}><option value=''>Tất cả</option>{questionTypes.map((item) => <option key={item} value={item}>{getQuestionTypeLabel(item)}</option>)}</CFormSelect></CCol>
          <CCol md={2}><CFormLabel>Độ khó</CFormLabel><CFormSelect value={filters.difficulty} onChange={(event) => setFilters((prev) => ({ ...prev, difficulty: event.target.value }))}><option value=''>Tất cả</option>{difficulties.map((item) => <option key={item} value={item}>{item}</option>)}</CFormSelect></CCol>
          <CCol md={2}><CFormLabel>Trạng thái</CFormLabel><CFormSelect value={filters.questionStatus} onChange={(event) => setFilters((prev) => ({ ...prev, questionStatus: event.target.value }))}><option value=''>Tất cả</option><option value='active'>active</option><option value='draft'>draft</option></CFormSelect></CCol>
          <CCol md={2}><CFormLabel>Có stimulus</CFormLabel><CFormSelect value={filters.hasStimulus} onChange={(event) => setFilters((prev) => ({ ...prev, hasStimulus: event.target.value }))}><option value=''>Tất cả</option><option value='true'>Có</option><option value='false'>Không</option></CFormSelect></CCol>
          <CCol md={2} className='d-flex gap-2'><CButton color='primary' onClick={() => setFilters((prev) => ({ ...prev, q: String(prev.qDraft || '').trim() }))}>Search</CButton><CButton color='secondary' variant='outline' onClick={() => setFilters({ q: '', qDraft: '', subjectId: '', gradeId: '', skillId: sectionSkillId || '', type: '', difficulty: '', questionStatus: 'active', hasStimulus: '' })}>Đặt lại</CButton></CCol>
        </CRow>

        <CRow className='g-3 mb-4'>
          <CCol md={2}><CFormLabel>Điểm mặc định</CFormLabel><CFormInput type='number' value={defaults.points} onChange={(event) => setDefaults((prev) => ({ ...prev, points: event.target.value }))} /></CCol>
          <CCol md={2} className='d-flex align-items-end'><CFormCheck label='Bắt buộc' checked={defaults.required} onChange={(event) => setDefaults((prev) => ({ ...prev, required: event.target.checked }))} /></CCol>
          <CCol md={2}><CFormLabel>Giới hạn lượt nghe</CFormLabel><CFormInput type='number' value={defaults.audioPlayLimit} onChange={(event) => setDefaults((prev) => ({ ...prev, audioPlayLimit: event.target.value }))} /></CCol>
          <CCol md={2} className='d-flex align-items-end'><CFormCheck label='Cho phép tua' checked={defaults.allowSeek} onChange={(event) => setDefaults((prev) => ({ ...prev, allowSeek: event.target.checked }))} /></CCol>
          <CCol md={2}><CFormLabel>Nghe tối thiểu (%)</CFormLabel><CFormInput type='number' min={0} max={100} step='0.01' value={defaults.minListenRatioBeforeAnswerPercent} onChange={(event) => setDefaults((prev) => ({ ...prev, minListenRatioBeforeAnswerPercent: event.target.value }))} placeholder='75' /></CCol>
          <CCol md={2}><CFormLabel>Từ tối thiểu</CFormLabel><CFormInput type='number' value={defaults.minWords} onChange={(event) => setDefaults((prev) => ({ ...prev, minWords: event.target.value }))} /></CCol>
          <CCol md={2}><CFormLabel>Từ tối đa</CFormLabel><CFormInput type='number' value={defaults.maxWords} onChange={(event) => setDefaults((prev) => ({ ...prev, maxWords: event.target.value }))} /></CCol>
        </CRow>
        <div className='small text-body-secondary mb-4'>Chỉ áp dụng khi câu/ngữ liệu có audio. Ví dụ 75%: người thi phải nghe ít nhất 75% một lượt audio trước khi có thể chọn/trả lời. Để trống hoặc 0: người thi vẫn phải bắt đầu nghe ít nhất một lần trước khi trả lời.</div>

        {loading ? <div className='d-flex align-items-center gap-2 py-3'><CSpinner size='sm' /><span>Đang tải câu hỏi...</span></div> : (
          <CTable hover responsive align='middle' className='ai-table'>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell style={{ width: 70 }}>Chọn</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 120 }}>Mã</CTableHeaderCell>
                <CTableHeaderCell>Nội dung</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 140 }}>Loại</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 160 }}>Kỹ năng</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 120 }}>Khối</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 120 }}>Stimulus</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 110 }}>Trạng thái</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.length === 0 ? (
                <CTableRow><CTableDataCell colSpan={8} className='text-center text-body-secondary'>Không có câu hỏi phù hợp.</CTableDataCell></CTableRow>
              ) : rows.map((row) => {
                const id = getEntityId(row)
                const selected = selectedIds.includes(id)
                return (
                  <CTableRow key={id || row.code} active={selected}>
                    <CTableDataCell><CFormCheck checked={selected} onChange={() => toggleQuestion(id)} /></CTableDataCell>
                    <CTableDataCell>{row.code || '-'}</CTableDataCell>
                    <CTableDataCell>{truncateText(row.questionText, 120)}</CTableDataCell>
                    <CTableDataCell>{getQuestionTypeLabel(row.type)}</CTableDataCell>
                    <CTableDataCell>{Array.isArray(row.skills) && row.skills.length > 0 ? row.skills.map((item) => item.title || item.code).join(', ') : '-'}</CTableDataCell>
                    <CTableDataCell>{row.grade?.title || '-'}</CTableDataCell>
                    <CTableDataCell>{row.stimulus ? 'Có' : 'Không'}</CTableDataCell>
                    <CTableDataCell>{row.questionStatus || '-'}</CTableDataCell>
                  </CTableRow>
                )
              })}
            </CTableBody>
          </CTable>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={handleClose} disabled={saving || loading}>Đóng</CButton>
        <CButton color='primary' onClick={handleConfirm} disabled={saving || loading}>{saving ? 'Đang thêm...' : `Thêm ${selectedIds.length} câu vào phần`}</CButton>
      </CModalFooter>
    </CModal>
  )
}
