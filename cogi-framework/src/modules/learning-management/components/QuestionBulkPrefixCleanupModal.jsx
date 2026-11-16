import { useMemo, useState } from 'react'
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
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { executeBulkPrefixCleanupQuestions, previewBulkPrefixCleanupQuestions } from '../services/learningObjectApi'
import { getApiMessage, getEntityId } from '../utils/questionBankUi'

function normalizeText(value) {
  return String(value ?? '').trim()
}

export default function QuestionBulkPrefixCleanupModal({ visible, subjects = [], knowledgeNodes = [], onClose, onUpdated }) {
  const [subjectId, setSubjectId] = useState('')
  const [knowledgeNodeId, setKnowledgeNodeId] = useState('')
  const [prefix, setPrefix] = useState('')
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [confirmText, setConfirmText] = useState('')

  const selectedSubject = useMemo(() => subjects.find((subject) => String(getEntityId(subject)) === String(subjectId)) || null, [subjects, subjectId])
  const selectedKnowledgeNode = useMemo(() => knowledgeNodes.find((node) => String(getEntityId(node)) === String(knowledgeNodeId)) || null, [knowledgeNodes, knowledgeNodeId])

  const expectedConfirm = `${normalizeText(selectedSubject?.code) || 'subject'}:${normalizeText(selectedKnowledgeNode?.code || 'all')}:${normalizeText(prefix)}`
  const isConfirmValid = normalizeText(confirmText) === expectedConfirm && expectedConfirm.includes(':') && normalizeText(prefix)
  const canExecute = !previewing && !executing && Number(preview?.cleanableCount || 0) > 0 && isConfirmValid

  function resetState() {
    setSubjectId('')
    setKnowledgeNodeId('')
    setPrefix('')
    setPreview(null)
    setPreviewing(false)
    setExecuting(false)
    setError('')
    setResult(null)
    setConfirmText('')
  }

  function handleClose() {
    if (previewing || executing) return
    resetState()
    onClose?.()
  }

  async function handlePreview() {
    if (!subjectId || !prefix) {
      setError('Vui lòng chọn môn học và nhập tiền tố cần xóa.')
      return
    }

    setPreviewing(true)
    setError('')
    setResult(null)
    setConfirmText('')

    try {
      const payload = await previewBulkPrefixCleanupQuestions({ subjectId, knowledgeNodeId: knowledgeNodeId || undefined, prefix })
      setPreview(payload || null)
    } catch (requestError) {
      setPreview(null)
      setError(getApiMessage(requestError, 'Không kiểm tra được nội dung cần làm sạch.'))
    } finally {
      setPreviewing(false)
    }
  }

  async function handleExecute() {
    if (!canExecute) return
    if (!window.confirm('Bạn chắc chắn muốn xóa tiền tố ở đầu nội dung các câu hỏi đủ điều kiện?')) return

    setExecuting(true)
    setError('')
    setResult(null)

    try {
      const payload = await executeBulkPrefixCleanupQuestions({
        subjectId,
        knowledgeNodeId: knowledgeNodeId || undefined,
        prefix,
        previewToken: preview?.previewToken,
      })
      setResult(payload || null)
      onUpdated?.(payload || null)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thực thi được thao tác làm sạch nội dung.'))
    } finally {
      setExecuting(false)
    }
  }

  const filteredKnowledgeNodes = useMemo(
    () => (subjectId ? knowledgeNodes.filter((item) => String(item?.subject?.id ?? item?.subjectId ?? '') === String(subjectId) || !item?.subject) : knowledgeNodes),
    [knowledgeNodes, subjectId],
  )

  return (
    <CModal visible={visible} backdrop='static' size='xl' onClose={handleClose}>
      <CModalHeader>
        <CModalTitle>Làm sạch nội dung câu hỏi</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        <CRow className='g-3'>
          <CCol md={4}>
            <CFormLabel>Môn học</CFormLabel>
            <CFormSelect value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setPreview(null); setResult(null); setConfirmText('') }} disabled={previewing || executing}>
              <option value=''>Chọn môn học</option>
              {subjects.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}
            </CFormSelect>
          </CCol>

          <CCol md={4}>
            <CFormLabel>Knowledge Node</CFormLabel>
            <CFormSelect value={knowledgeNodeId} onChange={(event) => { setKnowledgeNodeId(event.target.value); setPreview(null); setResult(null); setConfirmText('') }} disabled={previewing || executing}>
              <option value=''>Tất cả Knowledge Node</option>
              {filteredKnowledgeNodes.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}
            </CFormSelect>
          </CCol>

          <CCol md={4}>
            <CFormLabel>Tiền tố cần xóa</CFormLabel>
            <CFormInput value={prefix} onChange={(event) => { setPrefix(event.target.value); setPreview(null); setResult(null); setConfirmText('') }} disabled={previewing || executing} placeholder='Ví dụ: Choose the correct answer (A, B, C or D):' />
          </CCol>
        </CRow>

        <div className='mt-3 d-flex gap-2'>
          <CButton color='primary' onClick={handlePreview} disabled={previewing || executing}>{previewing ? 'Đang kiểm tra...' : 'Xem trước'}</CButton>
        </div>

        {preview ? (
          <div className='mt-4'>
            <CAlert color='warning'>
              <div className='fw-semibold'>Cảnh báo an toàn</div>
              <div>Chỉ xóa tiền tố ở đầu nội dung, không thay đổi đáp án, option, hoặc dữ liệu khảo thí đã phát hành.</div>
            </CAlert>

            <CTable responsive className='ai-table'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Chỉ số</CTableHeaderCell>
                  <CTableHeaderCell>Giá trị</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                <CTableRow><CTableDataCell>Tổng câu hỏi phù hợp</CTableDataCell><CTableDataCell>{Number(preview.totalCount || 0)}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Khớp tiền tố</CTableDataCell><CTableDataCell>{Number(preview.matchedCount || 0)}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Có thể cập nhật</CTableDataCell><CTableDataCell>{Number(preview.cleanableCount || 0)}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Chặn an toàn</CTableDataCell><CTableDataCell>{Number(preview.blockedCount || 0)}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Không an toàn</CTableDataCell><CTableDataCell>{Number(preview.unsafeCount || 0)}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Bỏ qua</CTableDataCell><CTableDataCell>{Number(preview.skippedCount || 0)}</CTableDataCell></CTableRow>
              </CTableBody>
            </CTable>

            {Array.isArray(preview.results) && preview.results.length > 0 ? (
              <div className='mt-3'>
                <div className='fw-semibold mb-2'>Danh sách xem trước</div>
                <CTable responsive className='ai-table'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Code</CTableHeaderCell>
                      <CTableHeaderCell>Title</CTableHeaderCell>
                      <CTableHeaderCell>Trước</CTableHeaderCell>
                      <CTableHeaderCell>Sau</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {preview.results.map((item, index) => (
                      <CTableRow key={`${item?.code || 'row'}-${index}`}>
                        <CTableDataCell>{item?.code || '-'}</CTableDataCell>
                        <CTableDataCell>{item?.title || '-'}</CTableDataCell>
                        <CTableDataCell style={{ whiteSpace: 'pre-wrap' }}>{item?.before || '-'}</CTableDataCell>
                        <CTableDataCell style={{ whiteSpace: 'pre-wrap' }}>{item?.after || '-'}</CTableDataCell>
                        <CTableDataCell>{item?.status || 'unknown'}</CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </div>
            ) : null}

            <div className='mt-3'>
              <CFormLabel>Xác nhận phạm vi</CFormLabel>
              <CFormInput
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder={`Nhập chính xác: ${expectedConfirm}`}
                disabled={executing}
              />
              <div className='small text-body-secondary mt-1'>Nhập chuỗi xác nhận theo định dạng: {expectedConfirm}</div>
            </div>
          </div>
        ) : null}

        {result ? (
          <CAlert color={Number(result?.result?.failedCount || 0) > 0 ? 'warning' : 'success'} className='mt-3'>
            <div className='fw-semibold'>Kết quả thực thi</div>
            <div>Updated: {Number(result?.result?.updatedCount || 0)} | Blocked: {Number(result?.result?.blockedCount || 0)} | Failed: {Number(result?.result?.failedCount || 0)}</div>
          </CAlert>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={handleClose} disabled={previewing || executing}>Đóng</CButton>
        <CButton color='primary' onClick={handleExecute} disabled={!canExecute}>{executing ? 'Đang cập nhật...' : 'Cập nhật hàng loạt'}</CButton>
      </CModalFooter>
    </CModal>
  )
}
