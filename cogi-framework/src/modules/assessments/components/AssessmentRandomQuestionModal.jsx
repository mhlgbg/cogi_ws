import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
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
} from '@coreui/react'
import { getKnowledgeNodes } from '../../learning-management/services/learningObjectApi'
import { getApiMessage } from '../services/assessmentService'
import { getEntityId } from './assessmentUi'

const DEFAULT_ROW = { knowledgeNodeId: '', difficulty: 'easy', count: '1', points: '1' }

export default function AssessmentRandomQuestionModal({ visible, section, assessmentSubject, saving, onClose, onAdd, onPreview }) {
  const [error, setError] = useState('')
  const [loadingNodes, setLoadingNodes] = useState(false)
  const [subjectId, setSubjectId] = useState('')
  const [includeDraft, setIncludeDraft] = useState(false)
  const [rows, setRows] = useState([DEFAULT_ROW])
  const [knowledgeNodes, setKnowledgeNodes] = useState([])
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)

  const resolvedAssessmentSubject = useMemo(() => {
    const directId = String(getEntityId(assessmentSubject) || assessmentSubject?.id || '').trim()
    if (directId) {
      return {
        id: directId,
        title: assessmentSubject?.title || assessmentSubject?.code || `#${directId}`,
      }
    }
    return null
  }, [assessmentSubject])
  const knowledgeNodeOptions = useMemo(() => {
    const filtered = subjectId ? knowledgeNodes.filter((item) => String(getEntityId(item?.subject) || item?.subjectId || item?.subject) === String(subjectId)) : knowledgeNodes
    return filtered
  }, [knowledgeNodes, subjectId])

  useEffect(() => {
    if (!visible) return
    setError('')
    setPreview(null)
    setRows([DEFAULT_ROW])
    setIncludeDraft(false)
    setSubjectId(resolvedAssessmentSubject?.id || '')
  }, [visible, section, resolvedAssessmentSubject?.id])

  useEffect(() => {
    if (!visible) return
    async function loadKnowledgeNodes() {
      if (!subjectId) {
        setKnowledgeNodes([])
        setLoadingNodes(false)
        return
      }
      try {
        setLoadingNodes(true)
        const payload = await getKnowledgeNodes({ subjectId: subjectId || undefined, page: 1, pageSize: 200, sort: ['title:asc', 'id:asc'] })
        const list = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : []
        setKnowledgeNodes(list)
      } catch (requestError) {
        setKnowledgeNodes([])
        setError(getApiMessage(requestError, 'Không tải được sơ đồ kiến thức'))
      } finally {
        setLoadingNodes(false)
      }
    }
    loadKnowledgeNodes()
  }, [subjectId, visible])

  function updateRow(index, field, value) {
    setRows((prev) => prev.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row))
  }

  function addRow() {
    setRows((prev) => [...prev, { ...DEFAULT_ROW, difficulty: prev[prev.length - 1]?.difficulty || 'easy' }])
  }

  function removeRow(index) {
    setRows((prev) => prev.length <= 1 ? [DEFAULT_ROW] : prev.filter((_, rowIndex) => rowIndex !== index))
  }

  async function handlePreview() {
    const payloadRows = rows
      .filter((row) => row.knowledgeNodeId && Number(row.count) > 0)
      .map((row) => ({
        knowledgeNodeId: row.knowledgeNodeId,
        difficulty: String(row.difficulty || 'easy').toLowerCase(),
        count: Number(row.count || 0),
        points: Number(row.points || 1),
      }))

    if (!subjectId) {
      setError('Assessment chưa được gán môn học hợp lệ')
      return
    }
    if (payloadRows.length === 0) {
      setError('Vui lòng thêm ít nhất một hàng ma trận')
      return
    }

    try {
      setError('')
      setPreviewing(true)
      const payload = await onPreview?.(getEntityId(section), { includeDraft, rows: payloadRows })
      if (!payload) {
        setPreview(null)
        return
      }
      setPreview(payload)
    } catch (requestError) {
      setPreview(null)
      setError(getApiMessage(requestError, 'Không preview được câu hỏi ngẫu nhiên'))
    } finally {
      setPreviewing(false)
    }
  }

  async function handleConfirm() {
    const payloadRows = rows
      .filter((row) => row.knowledgeNodeId && Number(row.count) > 0)
      .map((row) => ({
        knowledgeNodeId: row.knowledgeNodeId,
        difficulty: String(row.difficulty || 'easy').toLowerCase(),
        count: Number(row.count || 0),
        points: Number(row.points || 1),
      }))

    if (!subjectId) {
      setError('Assessment chưa được gán môn học hợp lệ')
      return
    }
    if (payloadRows.length === 0) {
      setError('Vui lòng thêm ít nhất một hàng ma trận')
      return
    }
    try {
      setError('')
      await onAdd?.({ includeDraft, rows: payloadRows })
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thêm được câu hỏi ngẫu nhiên'))
    }
  }

  function handleClose() {
    if (loadingNodes || saving || previewing) return
    setPreview(null)
    onClose?.()
  }

  function getRowStatusLabel(row) {
    if (!row) return 'Đang tính toán'
    if (row.status === 'enough') return 'Đủ câu'
    if (row.status === 'insufficient') return `Thiếu ${row.shortageCount || 0} câu`
    if (row.status === 'none') return 'Không có câu phù hợp'
    return 'Không thể lấy thống kê'
  }

  return (
    <CModal visible={visible} backdrop='static' size='xl' onClose={handleClose}>
      <CModalHeader>
        <CModalTitle>{`Sinh câu hỏi ngẫu nhiên cho phần ${section?.title || ''}`}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CRow className='g-3 mb-4'>
          <CCol md={4}>
            <CFormLabel>Môn học</CFormLabel>
            <CFormInput value={resolvedAssessmentSubject?.title || ''} readOnly placeholder='Assessment chưa gắn môn học' />
          </CCol>
          <CCol md={8} className='d-flex align-items-end'>
            <label className='form-check mb-0 d-flex align-items-center gap-2'>
              <input
                type='checkbox'
                checked={includeDraft}
                onChange={(event) => setIncludeDraft(event.target.checked)}
              />
              <span>Cho phép lấy cả câu hỏi Draft (bản nháp)</span>
            </label>
          </CCol>
        </CRow>
        {!subjectId ? <CAlert color='warning'>Assessment chưa được gán Subject hợp lệ. Không thể preview hoặc thêm câu hỏi ngẫu nhiên.</CAlert> : null}

        <div className='d-grid gap-3 mb-4'>
          {rows.map((row, index) => (
            <div key={`${index}-${row.knowledgeNodeId || 'new'}`} className='border rounded p-3'>
              <CRow className='g-3 align-items-end'>
                <CCol md={4}>
                  <CFormLabel>Kiến thức</CFormLabel>
                  <CFormSelect value={row.knowledgeNodeId} onChange={(event) => updateRow(index, 'knowledgeNodeId', event.target.value)} disabled={loadingNodes || !subjectId}>
                    <option value=''>Chọn khối kiến thức</option>
                    {knowledgeNodeOptions.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}
                  </CFormSelect>
                </CCol>
                <CCol md={2}>
                  <CFormLabel>Độ khó</CFormLabel>
                  <CFormSelect value={row.difficulty} onChange={(event) => updateRow(index, 'difficulty', event.target.value)}>
                    <option value='easy'>easy</option>
                    <option value='medium'>medium</option>
                    <option value='hard'>hard</option>
                  </CFormSelect>
                </CCol>
                <CCol md={2}>
                  <CFormLabel>Số câu</CFormLabel>
                  <CFormInput type='number' min={1} value={row.count} onChange={(event) => updateRow(index, 'count', event.target.value)} />
                </CCol>
                <CCol md={2}>
                  <CFormLabel>Điểm</CFormLabel>
                  <CFormInput type='number' min={1} step='0.5' value={row.points} onChange={(event) => updateRow(index, 'points', event.target.value)} />
                </CCol>
                <CCol md={2} className='d-flex gap-2'>
                  <CButton color='secondary' variant='outline' onClick={() => addRow()} size='sm'>+</CButton>
                  <CButton color='secondary' variant='outline' onClick={() => removeRow(index)} size='sm' disabled={rows.length <= 1}>-</CButton>
                </CCol>
              </CRow>
            </div>
          ))}
        </div>

        {preview ? (
          <div className='border rounded p-3 bg-light'>
            <div className='fw-semibold mb-2'>Preview lựa chọn</div>
            <div className='small text-body-secondary mb-2'>{`Tổng cần chọn: ${preview.totalRequired || 0} câu · Tổng điểm: ${preview.totalPoints || 0} · Tổng khả dụng: ${preview.totalAvailable || 0} câu`}</div>
            <div className='small mb-2'>
              <span className='fw-semibold'>Toàn bộ ma trận: </span>
              <span className={preview.isEnough ? 'text-success' : 'text-warning'}>
                {preview.isEnough ? 'Đủ' : `Thiếu ${preview.totalShortage || 0} câu`}
              </span>
            </div>
            {preview.warnings?.length ? <CAlert color='warning'>{preview.warnings.join(' ')}</CAlert> : null}
            {preview.insufficientRows?.length ? <CAlert color='warning'>{`Thiếu câu: ${preview.insufficientRows.map((item) => `${item.knowledgeNodeId}(${item.difficulty})` ).join(', ')}`}</CAlert> : null}
            <div className='d-grid gap-2'>
              {(preview.rows || []).map((row) => (
                <div key={`${row.knowledgeNodeId}-${row.difficulty}`} className='border rounded p-2 bg-white'>
                  <div className='fw-semibold'>
                    {`${row.knowledgeNodeTitle || row.knowledgeNodeCode || row.knowledgeNodeId} · ${row.difficulty}`}
                  </div>
                  <div className='small text-body-secondary d-flex flex-wrap gap-3 mt-1'>
                    <span>Tổng phù hợp: {row.matchedCount ?? 0}</span>
                    <span>Đã có trong đề: {row.existingCount ?? 0}</span>
                    <span>Còn khả dụng: {row.availableCount ?? 0}</span>
                    <span>Yêu cầu: {row.requestedCount ?? 0}</span>
                    <span>Trạng thái: {getRowStatusLabel(row)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={handleClose} disabled={saving || previewing}>Đóng</CButton>
        <CButton color='info' variant='outline' onClick={handlePreview} disabled={saving || previewing || loadingNodes || !subjectId}>{previewing ? 'Đang preview...' : 'Preview'}</CButton>
        <CButton color='primary' onClick={handleConfirm} disabled={saving || previewing || loadingNodes || !subjectId}>{saving ? 'Đang thêm...' : 'Thêm câu hỏi'}</CButton>
      </CModalFooter>
    </CModal>
  )
}
