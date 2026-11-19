import { useMemo, useState } from 'react'
import {
  CAlert,
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

function getPreviewStatusLabel(status) {
  if (status === 'eligible') return 'Được cập nhật'
  if (status === 'blocked') return 'Bị chặn'
  if (status === 'unchanged') return 'Không thay đổi'
  if (status === 'skipped') return 'Không thay đổi'
  return status || 'unknown'
}

export default function QuestionBulkPrefixCleanupModal({ visible, subjects = [], knowledgeNodes = [], onClose, onUpdated }) {
  const [subjectId, setSubjectId] = useState('')
  const [knowledgeNodeId, setKnowledgeNodeId] = useState('')
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [matchMode, setMatchMode] = useState('prefix')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [trimAfterReplace, setTrimAfterReplace] = useState(true)
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [confirmText, setConfirmText] = useState('')

  const selectedSubject = useMemo(() => subjects.find((subject) => String(getEntityId(subject)) === String(subjectId)) || null, [subjects, subjectId])
  const selectedKnowledgeNode = useMemo(() => knowledgeNodes.find((node) => String(getEntityId(node)) === String(knowledgeNodeId)) || null, [knowledgeNodes, knowledgeNodeId])

  const expectedConfirm = `${normalizeText(selectedSubject?.code) || 'subject'}:${normalizeText(selectedKnowledgeNode?.code || 'all')}:${normalizeText(findText)}:${normalizeText(replaceText)}:${matchMode}`
  const isConfirmValid = normalizeText(confirmText) === expectedConfirm && expectedConfirm.includes(':') && normalizeText(findText)
  const canExecute = !previewing && !executing && Number(preview?.cleanableCount || 0) > 0 && isConfirmValid

  function resetState() {
    setSubjectId('')
    setKnowledgeNodeId('')
    setFindText('')
    setReplaceText('')
    setMatchMode('prefix')
    setCaseSensitive(false)
    setTrimAfterReplace(true)
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
    if (!subjectId || !findText) {
      setError('Vui lòng chọn môn học và nhập chuỗi cần tìm.')
      return
    }

    setPreviewing(true)
    setError('')
    setResult(null)
    setConfirmText('')

    try {
      const payload = await previewBulkPrefixCleanupQuestions({
        subjectId,
        knowledgeNodeId: knowledgeNodeId || undefined,
        findText,
        replaceText,
        matchMode,
        caseSensitive,
        trimAfterReplace,
      })
      setPreview(payload || null)
    } catch (requestError) {
      setPreview(null)
      setError(getApiMessage(requestError, 'Không kiểm tra được nội dung cần tìm và thay thế.'))
    } finally {
      setPreviewing(false)
    }
  }

  async function handleExecute() {
    if (!canExecute) return
    if (!window.confirm('Bạn chắc chắn muốn cập nhật các câu hỏi đã được xem trước?')) return

    setExecuting(true)
    setError('')
    setResult(null)

    try {
      const payload = await executeBulkPrefixCleanupQuestions({
        subjectId,
        knowledgeNodeId: knowledgeNodeId || undefined,
        findText,
        replaceText,
        matchMode,
        caseSensitive,
        trimAfterReplace,
        previewToken: preview?.previewToken,
      })
      setResult(payload || null)
      onUpdated?.(payload || null)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thực thi được thay thế hàng loạt.'))
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
        <CModalTitle>Tìm kiếm &amp; Thay thế</CModalTitle>
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
            <CFormLabel>Chế độ tìm kiếm</CFormLabel>
            <CFormSelect value={matchMode} onChange={(event) => { setMatchMode(event.target.value); setPreview(null); setResult(null); setConfirmText('') }} disabled={previewing || executing}>
              <option value='prefix'>Chỉ tìm ở đầu nội dung</option>
              <option value='all'>Tìm trong toàn bộ nội dung</option>
            </CFormSelect>
          </CCol>
        </CRow>

        <CRow className='g-3 mt-1'>
          <CCol md={6}>
            <CFormLabel>Nội dung cần tìm</CFormLabel>
            <CFormTextarea value={findText} onChange={(event) => { setFindText(event.target.value); setPreview(null); setResult(null); setConfirmText('') }} disabled={previewing || executing} rows={4} placeholder='Ví dụ: Choose the correct answer (A, B, C or D):' />
          </CCol>

          <CCol md={6}>
            <CFormLabel>Thay thế bằng</CFormLabel>
            <CFormTextarea value={replaceText} onChange={(event) => { setReplaceText(event.target.value); setPreview(null); setResult(null); setConfirmText('') }} disabled={previewing || executing} rows={4} placeholder='Có thể để trống để xóa' />
          </CCol>
        </CRow>

        <div className='mt-3 d-grid gap-2'>
          <CFormCheck id='bulk-find-replace-case' label='Phân biệt chữ hoa/chữ thường' checked={caseSensitive} onChange={(event) => { setCaseSensitive(event.target.checked); setPreview(null); setResult(null); setConfirmText('') }} disabled={previewing || executing} />
          <CFormCheck id='bulk-find-replace-trim' label='Loại bỏ khoảng trắng thừa sau khi thay thế' checked={trimAfterReplace} onChange={(event) => { setTrimAfterReplace(event.target.checked); setPreview(null); setResult(null); setConfirmText('') }} disabled={previewing || executing} />
        </div>

        <div className='mt-3 d-flex gap-2'>
          <CButton color='primary' onClick={handlePreview} disabled={previewing || executing}>{previewing ? 'Đang kiểm tra...' : 'Xem trước'}</CButton>
        </div>

        {preview ? (
          <div className='mt-4'>
            <CAlert color='warning'>
              <div className='fw-semibold'>Cảnh báo an toàn</div>
              <div>Thay thế chỉ trong nội dung câu hỏi đã lọc, không chạm vào answer, explanation, metadata hoặc các câu hỏi ngoài phạm vi.</div>
            </CAlert>

            <CTable responsive className='ai-table'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Chỉ số</CTableHeaderCell>
                  <CTableHeaderCell>Giá trị</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                <CTableRow><CTableDataCell>Tổng câu hỏi trong phạm vi</CTableDataCell><CTableDataCell>{Number(preview.totalCount || 0)}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Câu hỏi có chuỗi khớp</CTableDataCell><CTableDataCell>{Number(preview.matchedCount || 0)}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Có nội dung thực sự thay đổi</CTableDataCell><CTableDataCell>{Number(preview.cleanableCount || 0)}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Được phép cập nhật</CTableDataCell><CTableDataCell>{Number(preview.cleanableCount || 0)}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Bị chặn</CTableDataCell><CTableDataCell>{Number(preview.blockedCount || 0)}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Không thay đổi</CTableDataCell><CTableDataCell>{Number(preview.unchangedCount || 0)}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Không thể xử lý an toàn</CTableDataCell><CTableDataCell>{Number(preview.unsafeCount || 0)}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Bỏ qua</CTableDataCell><CTableDataCell>{Number(preview.skippedCount || 0)}</CTableDataCell></CTableRow>
              </CTableBody>
            </CTable>

            {Array.isArray(preview.results) && preview.results.length > 0 ? (
              <div className='mt-3'>
                <div className='fw-semibold mb-2'>Preview thay đổi</div>
                <CTable responsive className='ai-table'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Code</CTableHeaderCell>
                      <CTableHeaderCell>Trước</CTableHeaderCell>
                      <CTableHeaderCell>Sau</CTableHeaderCell>
                      <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                      <CTableHeaderCell>Nguyên nhân</CTableHeaderCell>
                      <CTableHeaderCell>Tham chiếu liên quan</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {preview.results.map((item, index) => (
                      <CTableRow key={`${item?.code || 'row'}-${index}`}>
                        <CTableDataCell>{item?.code || '-'}</CTableDataCell>
                        <CTableDataCell style={{ whiteSpace: 'pre-wrap' }}>{item?.before || '-'}</CTableDataCell>
                        <CTableDataCell style={{ whiteSpace: 'pre-wrap' }}>{item?.after || '-'}</CTableDataCell>
                        <CTableDataCell>{getPreviewStatusLabel(item?.status)}</CTableDataCell>
                        <CTableDataCell style={{ whiteSpace: 'pre-wrap' }}>
                          {Array.isArray(item?.reasons) && item.reasons.length > 0
                            ? item.reasons.join('\n')
                            : item?.reason || '-'}
                        </CTableDataCell>
                        <CTableDataCell style={{ whiteSpace: 'pre-wrap' }}>
                          {[
                            ...(Array.isArray(item?.relatedReferences) ? item.relatedReferences : []),
                            item?.relatedAttemptSummary?.totalAttemptCount
                              ? `Phiên thi liên quan: ${Number(item.relatedAttemptSummary.totalAttemptCount || 0)} (đã bắt đầu/kết thúc: ${Number(item.relatedAttemptSummary.startedOrFinishedCount || 0)}, chưa bắt đầu: ${Number(item.relatedAttemptSummary.scheduledNotStartedCount || 0)})`
                              : null,
                          ].filter(Boolean).join('\n') || '-'}
                        </CTableDataCell>
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
