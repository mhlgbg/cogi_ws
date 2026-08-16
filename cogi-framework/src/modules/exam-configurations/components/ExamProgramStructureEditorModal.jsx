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
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { listExamSubjects } from '../services/examSubjectApi'

function buildSelectedItems(programSubjects = []) {
  return Array.isArray(programSubjects)
    ? programSubjects.map((item, index) => ({
        id: item.id,
        key: String(item.examSubjectId || item.examSubjectDocumentId || item.id || index),
        examSubjectId: item.examSubjectId,
        examSubjectDocumentId: item.examSubjectDocumentId,
        examSubjectCode: item.examSubjectCode,
        examSubjectName: item.examSubjectName,
        examSubjectIsActive: item.examSubjectIsActive,
        displayOrder: Number(item.displayOrder || index + 1) || index + 1,
      }))
    : []
}

export default function ExamProgramStructureEditorModal({
  visible,
  program,
  saving = false,
  saveError = '',
  onClose,
  onSubmit,
}) {
  const [selectedItems, setSelectedItems] = useState(() => buildSelectedItems(program?.programSubjects))
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [lookupSearch, setLookupSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [lookupOptions, setLookupOptions] = useState([])
  const [pendingSubjectId, setPendingSubjectId] = useState('')

  useEffect(() => {
    if (!visible) return
    setSelectedItems(buildSelectedItems(program?.programSubjects))
    setLookupSearch('')
    setDebouncedSearch('')
    setPendingSubjectId('')
    setLookupError('')
  }, [program?.programSubjects, visible])

  useEffect(() => {
    if (!visible) return undefined
    const timer = window.setTimeout(() => setDebouncedSearch(String(lookupSearch || '').trim()), 300)
    return () => window.clearTimeout(timer)
  }, [lookupSearch, visible])

  useEffect(() => {
    if (!visible) return
    let mounted = true
    async function loadOptions() {
      setLookupLoading(true)
      setLookupError('')
      try {
        const result = await listExamSubjects({ page: 1, pageSize: 100, search: debouncedSearch, isActive: 'true' })
        if (!mounted) return
        setLookupOptions(Array.isArray(result?.rows) ? result.rows : [])
      } catch (requestError) {
        if (!mounted) return
        setLookupOptions([])
        setLookupError(requestError?.message || 'Không tải được danh sách môn để thêm vào chương trình.')
      } finally {
        if (mounted) setLookupLoading(false)
      }
    }
    loadOptions()
    return () => { mounted = false }
  }, [debouncedSearch, visible])

  const selectedKeys = useMemo(() => new Set(selectedItems.map((item) => String(item.examSubjectId || item.examSubjectDocumentId || item.key))), [selectedItems])
  const availableOptions = useMemo(() => lookupOptions.filter((item) => !selectedKeys.has(String(item.id || item.documentId))), [lookupOptions, selectedKeys])

  function addSelectedSubject() {
    const chosen = availableOptions.find((item) => String(item.id || item.documentId) === String(pendingSubjectId || ''))
    if (!chosen) return
    setSelectedItems((current) => ([
      ...current,
      {
        key: String(chosen.id || chosen.documentId),
        examSubjectId: chosen.id,
        examSubjectDocumentId: chosen.documentId,
        examSubjectCode: chosen.code,
        examSubjectName: chosen.name,
        examSubjectIsActive: chosen.isActive !== false,
        displayOrder: current.length + 1,
      },
    ]))
    setPendingSubjectId('')
  }

  function moveItem(index, direction) {
    setSelectedItems((current) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      const temp = next[index]
      next[index] = next[nextIndex]
      next[nextIndex] = temp
      return next.map((item, itemIndex) => ({ ...item, displayOrder: itemIndex + 1 }))
    })
  }

  function removeItem(index) {
    setSelectedItems((current) => current.filter((_, itemIndex) => itemIndex !== index).map((item, itemIndex) => ({ ...item, displayOrder: itemIndex + 1 })))
  }

  function handleSubmit() {
    onSubmit?.(selectedItems.map((item) => item.examSubjectId || item.examSubjectDocumentId))
  }

  return (
    <CModal visible={visible} onClose={() => !saving && onClose?.()} size='xl' backdrop='static' scrollable>
      <CModalHeader>
        <CModalTitle>Chỉnh sửa cấu trúc môn thi</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {saveError ? <CAlert color='danger'>{saveError}</CAlert> : null}
        <CAlert color='info'>Tại đây bạn có thể thêm, loại bỏ hoặc sắp xếp các môn trong chương trình. Các cấu hình override của những môn được giữ lại sẽ không bị thay đổi.</CAlert>
        <CAlert color='warning'>Việc loại môn khỏi chương trình chỉ ảnh hưởng cấu hình sử dụng cho các đợt thi được tạo sau này. Các đợt thi đã tạo trước đó sử dụng snapshot riêng và không bị thay đổi.</CAlert>

        <CRow className='g-3 mb-4'>
          <CCol lg={5} md={6} xs={12}>
            <CFormLabel>Tìm môn để thêm</CFormLabel>
            <CFormInput value={lookupSearch} onChange={(event) => setLookupSearch(event.target.value)} placeholder='Tìm theo mã hoặc tên môn' disabled={saving} />
          </CCol>
          <CCol lg={5} md={6} xs={12}>
            <CFormLabel>Chọn môn</CFormLabel>
            <CFormSelect value={pendingSubjectId} onChange={(event) => setPendingSubjectId(event.target.value)} disabled={saving || lookupLoading}>
              <option value=''>{lookupLoading ? 'Đang tải...' : 'Chọn môn để thêm'}</option>
              {availableOptions.map((item) => <option key={item.id || item.documentId} value={item.id || item.documentId}>{item.code} - {item.name}</option>)}
            </CFormSelect>
          </CCol>
          <CCol lg={2} md={12} xs={12} className='d-flex align-items-end'>
            <CButton color='primary' className='w-100' onClick={addSelectedSubject} disabled={saving || lookupLoading || !pendingSubjectId}>Thêm môn</CButton>
          </CCol>
        </CRow>

        {lookupError ? <CAlert color='warning'>{lookupError}</CAlert> : null}
        {lookupLoading ? <div className='d-flex align-items-center gap-2 mb-3'><CSpinner size='sm' />Đang tải danh sách môn...</div> : null}

        <CTable responsive hover align='middle'>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Thứ tự</CTableHeaderCell>
              <CTableHeaderCell>Môn thi</CTableHeaderCell>
              <CTableHeaderCell>Trạng thái</CTableHeaderCell>
              <CTableHeaderCell>Thao tác</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {selectedItems.length > 0 ? selectedItems.map((item, index) => (
              <CTableRow key={item.key}>
                <CTableDataCell>{index + 1}</CTableDataCell>
                <CTableDataCell>
                  <div className='fw-semibold'>{item.examSubjectName || '-'}</div>
                  <div className='small text-body-secondary'>{item.examSubjectCode || '-'}</div>
                </CTableDataCell>
                <CTableDataCell>{item.examSubjectIsActive === false ? 'Inactive' : 'Active'}</CTableDataCell>
                <CTableDataCell>
                  <div className='d-flex gap-2 flex-wrap'>
                    <CButton size='sm' color='secondary' variant='outline' onClick={() => moveItem(index, -1)} disabled={saving || index === 0}>Lên</CButton>
                    <CButton size='sm' color='secondary' variant='outline' onClick={() => moveItem(index, 1)} disabled={saving || index === selectedItems.length - 1}>Xuống</CButton>
                    <CButton size='sm' color='danger' variant='outline' onClick={() => removeItem(index)} disabled={saving}>Xóa</CButton>
                  </div>
                </CTableDataCell>
              </CTableRow>
            )) : (
              <CTableRow>
                <CTableDataCell colSpan={4} className='text-center text-body-secondary'>Chưa có môn nào trong chương trình này.</CTableDataCell>
              </CTableRow>
            )}
          </CTableBody>
        </CTable>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={saving}>Đóng</CButton>
        <CButton color='primary' onClick={handleSubmit} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu cấu trúc môn'}</CButton>
      </CModalFooter>
    </CModal>
  )
}