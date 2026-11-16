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
import { executeBulkDeleteImportedQuestions, previewBulkDeleteImportedQuestions } from '../services/learningObjectApi'
import { getApiMessage, getEntityId } from '../utils/questionBankUi'

const IMPORT_SOURCE_OPTIONS = [
  { value: 'HCTD-TN-Q-', label: 'MSSQL Trắc nghiệm (HCTD-TN-Q-)' },
]

function normalizeText(value) {
  return String(value || '').trim()
}

export default function QuestionBulkDeleteImportedModal({ visible, subjects = [], onClose, onDeleted }) {
  const [subjectId, setSubjectId] = useState('')
  const [prefix, setPrefix] = useState(IMPORT_SOURCE_OPTIONS[0]?.value || '')
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [confirmText, setConfirmText] = useState('')

  const selectedSubject = useMemo(() => subjects.find((item) => String(getEntityId(item)) === String(subjectId)) || null, [subjects, subjectId])
  const expectedConfirm = `${normalizeText(selectedSubject?.code)}:${normalizeText(prefix)}`
  const isConfirmValid = normalizeText(confirmText) === expectedConfirm && expectedConfirm !== ':'
  const canExecute = !executing && !previewing && Number(preview?.deletableCount || 0) > 0 && isConfirmValid

  function resetState() {
    setSubjectId('')
    setPrefix(IMPORT_SOURCE_OPTIONS[0]?.value || '')
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
      setError('Vui lòng chọn môn học và nguồn import.')
      return
    }

    setPreviewing(true)
    setError('')
    setResult(null)
    setConfirmText('')
    try {
      const payload = await previewBulkDeleteImportedQuestions({ subjectId, prefix })
      setPreview(payload || null)
    } catch (requestError) {
      setPreview(null)
      setError(getApiMessage(requestError, 'Không kiểm tra được dữ liệu xóa.'))
    } finally {
      setPreviewing(false)
    }
  }

  async function handleExecute() {
    if (!canExecute) return
    if (!window.confirm('Bạn chắc chắn muốn xóa các câu hỏi đủ điều kiện trong phạm vi đã chọn? Thao tác này không thể hoàn tác trực tiếp.')) return

    setExecuting(true)
    setError('')
    setResult(null)
    try {
      const payload = await executeBulkDeleteImportedQuestions({ subjectId, prefix })
      setResult(payload || null)
      onDeleted?.(payload || null)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thực thi được thao tác xóa.'))
    } finally {
      setExecuting(false)
    }
  }

  return (
    <CModal visible={visible} backdrop='static' size='xl' onClose={handleClose}>
      <CModalHeader>
        <CModalTitle>Xóa câu hỏi đã import</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        <CRow className='g-3'>
          <CCol md={6}>
            <CFormLabel>Môn học</CFormLabel>
            <CFormSelect
              value={subjectId}
              onChange={(event) => {
                setSubjectId(event.target.value)
                setPreview(null)
                setResult(null)
                setConfirmText('')
              }}
              disabled={previewing || executing}
            >
              <option value=''>Chọn môn học</option>
              {subjects.map((item) => <option key={getEntityId(item)} value={getEntityId(item)}>{item.title || item.code}</option>)}
            </CFormSelect>
          </CCol>
          <CCol md={6}>
            <CFormLabel>Nguồn import</CFormLabel>
            <CFormSelect
              value={prefix}
              onChange={(event) => {
                setPrefix(event.target.value)
                setPreview(null)
                setResult(null)
                setConfirmText('')
              }}
              disabled={previewing || executing}
            >
              {IMPORT_SOURCE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </CFormSelect>
          </CCol>
        </CRow>

        <div className='mt-3 d-flex gap-2'>
          <CButton color='primary' onClick={handlePreview} disabled={previewing || executing}>{previewing ? 'Đang kiểm tra...' : 'Kiểm tra dữ liệu'}</CButton>
        </div>

        {preview ? (
          <div className='mt-4'>
            <CAlert color='warning'>
              <div className='fw-semibold'>Cảnh báo</div>
              <div>Thao tác xóa là không thể hoàn tác trực tiếp. Hệ thống sẽ chỉ xóa Question đủ điều kiện, không xóa Subject/Knowledge Node và dữ liệu khảo thí.</div>
            </CAlert>
            <CTable responsive className='ai-table'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Nội dung</CTableHeaderCell>
                  <CTableHeaderCell>Số lượng</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                <CTableRow><CTableDataCell>Tenant hiện tại</CTableDataCell><CTableDataCell>{preview?.tenantId || '-'}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Môn học</CTableDataCell><CTableDataCell>{preview?.scope?.subject?.title || preview?.scope?.subject?.code || '-'}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Prefix nguồn</CTableDataCell><CTableDataCell>{preview?.scope?.prefix || '-'}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Câu hỏi khớp điều kiện</CTableDataCell><CTableDataCell>{Number(preview?.matchedCount || 0)}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Đủ điều kiện xóa</CTableDataCell><CTableDataCell>{Number(preview?.deletableCount || 0)}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Bị chặn</CTableDataCell><CTableDataCell>{Number(preview?.blockedCount || 0)}</CTableDataCell></CTableRow>
                <CTableRow><CTableDataCell>Question Options dự kiến xóa</CTableDataCell><CTableDataCell>{Number(preview?.estimatedOptionDeleteCount || 0)}</CTableDataCell></CTableRow>
              </CTableBody>
            </CTable>

            {Array.isArray(preview?.blockedQuestions) && preview.blockedQuestions.length > 0 ? (
              <div className='mt-3'>
                <div className='fw-semibold mb-2'>Danh sách câu hỏi bị chặn (tối đa {preview?.limits?.blockedDetailsLimit || 200})</div>
                <CTable responsive className='ai-table'>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Code</CTableHeaderCell>
                      <CTableHeaderCell>Tiêu đề</CTableHeaderCell>
                      <CTableHeaderCell>Lý do</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {preview.blockedQuestions.map((item, index) => (
                      <CTableRow key={`${item?.code || 'blocked'}-${index}`}>
                        <CTableDataCell>{item?.code || '-'}</CTableDataCell>
                        <CTableDataCell>{item?.title || '-'}</CTableDataCell>
                        <CTableDataCell>{Array.isArray(item?.reasons) ? item.reasons.join('; ') : '-'}</CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </div>
            ) : null}

            <CRow className='g-3 mt-2'>
              <CCol md={12}>
                <CFormLabel>Xác nhận phạm vi xóa</CFormLabel>
                <CFormInput
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder={`Nhập chính xác: ${expectedConfirm}`}
                  disabled={executing}
                />
                <div className='small text-body-secondary mt-1'>Để bật nút xóa, nhập đúng chuỗi xác nhận gồm mã môn và prefix nguồn.</div>
              </CCol>
            </CRow>
          </div>
        ) : null}

        {result ? (
          <CAlert color={Number(result?.result?.failedCount || 0) > 0 ? 'warning' : 'success'} className='mt-3'>
            <div className='fw-semibold'>Kết quả thực thi</div>
            <div>Deleted: {Number(result?.result?.deletedCount || 0)} | Blocked: {Number(result?.result?.blockedCount || 0)} | Failed: {Number(result?.result?.failedCount || 0)} | Options deleted: {Number(result?.result?.deletedOptionCount || 0)}</div>
          </CAlert>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={handleClose} disabled={previewing || executing}>Đóng</CButton>
        <CButton color='danger' onClick={handleExecute} disabled={!canExecute}>{executing ? 'Đang xóa...' : 'Xóa câu hỏi đủ điều kiện'}</CButton>
      </CModalFooter>
    </CModal>
  )
}
