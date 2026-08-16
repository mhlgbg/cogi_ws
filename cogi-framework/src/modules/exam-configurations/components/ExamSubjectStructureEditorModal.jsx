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
import { getExamComponents } from '../services/examComponentApi'
import { getExamMethodLabel } from '../utils/examConfigurationUi'

function buildSelectedItems(subjectComponents = []) {
  return Array.isArray(subjectComponents)
    ? subjectComponents.map((item, index) => ({
        id: item.id,
        key: String(item.examComponentId || item.examComponentDocumentId || item.id || index),
        examComponentId: item.examComponentId,
        examComponentDocumentId: item.examComponentDocumentId,
        examComponentCode: item.examComponentCode,
        examComponentName: item.examComponentName,
        examMethod: item.examMethod,
        examComponentIsActive: item.examComponentIsActive,
        displayOrder: Number(item.displayOrder || index + 1) || index + 1,
      }))
    : []
}

export default function ExamSubjectStructureEditorModal({
  visible,
  subject,
  saving = false,
  saveError = '',
  onClose,
  onSubmit,
}) {
  const [selectedItems, setSelectedItems] = useState(() => buildSelectedItems(subject?.subjectComponents))
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')
  const [lookupSearch, setLookupSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [lookupOptions, setLookupOptions] = useState([])
  const [pendingComponentId, setPendingComponentId] = useState('')

  useEffect(() => {
    if (!visible) return
    setSelectedItems(buildSelectedItems(subject?.subjectComponents))
    setLookupSearch('')
    setDebouncedSearch('')
    setPendingComponentId('')
    setLookupError('')
  }, [subject?.subjectComponents, visible])

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
        const result = await getExamComponents({
          page: 1,
          pageSize: 100,
          search: debouncedSearch,
          componentType: 'skill',
          isActive: 'true',
        })
        if (!mounted) return
        setLookupOptions(Array.isArray(result?.rows) ? result.rows : [])
      } catch (requestError) {
        if (!mounted) return
        setLookupOptions([])
        setLookupError(requestError?.message || 'Không tải được danh sách kỹ năng để gán vào môn thi.')
      } finally {
        if (mounted) setLookupLoading(false)
      }
    }

    loadOptions()
    return () => { mounted = false }
  }, [debouncedSearch, visible])

  const selectedKeys = useMemo(() => new Set(selectedItems.map((item) => String(item.examComponentId || item.examComponentDocumentId || item.key))), [selectedItems])
  const availableOptions = useMemo(
    () => lookupOptions.filter((item) => !selectedKeys.has(String(item.id || item.documentId))),
    [lookupOptions, selectedKeys],
  )

  function addSelectedComponent() {
    const chosen = availableOptions.find((item) => String(item.id || item.documentId) === String(pendingComponentId || ''))
    if (!chosen) return
    setSelectedItems((current) => ([
      ...current,
      {
        key: String(chosen.id || chosen.documentId),
        examComponentId: chosen.id,
        examComponentDocumentId: chosen.documentId,
        examComponentCode: chosen.code,
        examComponentName: chosen.name,
        examMethod: chosen.examMethod,
        examComponentIsActive: chosen.isActive !== false,
        displayOrder: current.length + 1,
      },
    ]))
    setPendingComponentId('')
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
    onSubmit?.(selectedItems.map((item) => item.examComponentId || item.examComponentDocumentId))
  }

  return (
    <CModal visible={visible} onClose={() => !saving && onClose?.()} size='xl' backdrop='static' scrollable>
      <CModalHeader>
        <CModalTitle>Chỉnh sửa cấu trúc kỹ năng</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {saveError ? <CAlert color='danger'>{saveError}</CAlert> : null}
        <CAlert color='info'>Thao tác ở bước này chỉ thêm, xóa hoặc sắp xếp kỹ năng trong môn. Các cấu hình override hiện có trên những kỹ năng được giữ lại sẽ không bị thay đổi.</CAlert>

        <CRow className='g-3 mb-4'>
          <CCol lg={5} md={6} xs={12}>
            <CFormLabel>Tìm kỹ năng để thêm</CFormLabel>
            <CFormInput value={lookupSearch} onChange={(event) => setLookupSearch(event.target.value)} placeholder='Tìm theo mã hoặc tên kỹ năng' disabled={saving} />
          </CCol>
          <CCol lg={5} md={6} xs={12}>
            <CFormLabel>Chọn kỹ năng</CFormLabel>
            <CFormSelect value={pendingComponentId} onChange={(event) => setPendingComponentId(event.target.value)} disabled={saving || lookupLoading}>
              <option value=''>{lookupLoading ? 'Đang tải...' : 'Chọn kỹ năng để thêm'}</option>
              {availableOptions.map((item) => <option key={item.id || item.documentId} value={item.id || item.documentId}>{item.code} - {item.name}</option>)}
            </CFormSelect>
          </CCol>
          <CCol lg={2} md={12} xs={12} className='d-flex align-items-end'>
            <CButton color='primary' className='w-100' onClick={addSelectedComponent} disabled={saving || lookupLoading || !pendingComponentId}>Thêm kỹ năng</CButton>
          </CCol>
        </CRow>

        {lookupError ? <CAlert color='warning'>{lookupError}</CAlert> : null}
        {lookupLoading ? <div className='d-flex align-items-center gap-2 mb-3'><CSpinner size='sm' />Đang tải danh sách kỹ năng...</div> : null}

        <CTable responsive hover align='middle'>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Thứ tự</CTableHeaderCell>
              <CTableHeaderCell>Kỹ năng</CTableHeaderCell>
              <CTableHeaderCell>Trạng thái</CTableHeaderCell>
              <CTableHeaderCell>Thao tác</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {selectedItems.length > 0 ? selectedItems.map((item, index) => (
              <CTableRow key={item.key}>
                <CTableDataCell>{index + 1}</CTableDataCell>
                <CTableDataCell>
                  <div className='fw-semibold'>{item.examComponentName || '-'}</div>
                  <div className='small text-body-secondary'>{item.examComponentCode || '-'} • {getExamMethodLabel(item.examMethod)}</div>
                </CTableDataCell>
                <CTableDataCell>{item.examComponentIsActive === false ? 'Inactive' : 'Active'}</CTableDataCell>
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
                <CTableDataCell colSpan={4} className='text-center text-body-secondary'>Chưa có kỹ năng nào trong môn thi này.</CTableDataCell>
              </CTableRow>
            )}
          </CTableBody>
        </CTable>
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={saving}>Đóng</CButton>
        <CButton color='primary' onClick={handleSubmit} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu cấu trúc kỹ năng'}</CButton>
      </CModalFooter>
    </CModal>
  )
}