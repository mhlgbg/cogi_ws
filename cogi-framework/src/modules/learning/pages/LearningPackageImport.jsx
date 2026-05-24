import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormTextarea,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTabContent,
  CTabPane,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { confirmLearningPackage, previewLearningPackage } from '../api/learningPackageImportApi'

const PREVIEW_TABS = [
  { key: 'learningObjects', label: 'Learning Objects' },
  { key: 'questions', label: 'Questions' },
  { key: 'knowledgeNodes', label: 'Knowledge Nodes' },
  { key: 'skills', label: 'Skills' },
  { key: 'formulas', label: 'Formulas' },
  { key: 'visualAssets', label: 'Visual Assets' },
]

function SummaryCard({ label, value, color = 'secondary' }) {
  return (
    <CCard className='h-100'>
      <CCardBody>
        <div className='small text-body-secondary mb-2'>{label}</div>
        <div className={`fs-4 fw-semibold text-${color}`}>{value}</div>
      </CCardBody>
    </CCard>
  )
}

function getActionColor(action) {
  if (action === 'create') return 'success'
  if (action === 'update') return 'warning'
  if (action === 'blocked') return 'danger'
  if (action === 'error') return 'danger'
  return 'secondary'
}

function parseJsonInput(rawInput) {
  const text = String(rawInput || '').trim()
  if (!text) {
    throw new Error('Vui lòng paste JSON hoặc chọn file .json')
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new Error('JSON không hợp lệ, không thể parse dữ liệu')
  }
}

function validatePackageShapeLocal(packageData) {
  const errors = []
  const warnings = []
  const knowledgeNodeCodes = new Set((Array.isArray(packageData?.knowledgeNodes) ? packageData.knowledgeNodes : []).map((item) => String(item?.code || '').trim()).filter(Boolean))
  const skillCodes = new Set((Array.isArray(packageData?.skills) ? packageData.skills : []).map((item) => String(item?.code || '').trim()).filter(Boolean))
  const questionCodes = new Set((Array.isArray(packageData?.questions) ? packageData.questions : []).map((item) => String(item?.code || '').trim()).filter(Boolean))

  if (!packageData || typeof packageData !== 'object' || Array.isArray(packageData)) {
    return { errors: ['JSON package phải là object hợp lệ'], warnings }
  }

  if (!packageData.packageInfo || typeof packageData.packageInfo !== 'object') {
    errors.push('Thiếu packageInfo')
  }

  if (!String(packageData?.packageInfo?.code || '').trim()) {
    errors.push('Thiếu packageInfo.code')
  }

  if (!Array.isArray(packageData.learningObjects)) {
    errors.push('learningObjects phải là array')
  }

  if (packageData.questions !== undefined && !Array.isArray(packageData.questions)) {
    errors.push('questions phải là array nếu được cung cấp')
  }

  ;(Array.isArray(packageData.knowledgeNodes) ? packageData.knowledgeNodes : []).forEach((item, index) => {
    if (!String(item?.code || '').trim() || !String(item?.title || '').trim()) {
      errors.push(`knowledgeNodes[${index}] thiếu code hoặc title`)
    }
  })

  ;(Array.isArray(packageData.skills) ? packageData.skills : []).forEach((item, index) => {
    if (!String(item?.code || '').trim() || !String(item?.title || '').trim()) {
      errors.push(`skills[${index}] thiếu code hoặc title`)
    }
  })

  ;(Array.isArray(packageData.formulas) ? packageData.formulas : []).forEach((item, index) => {
    if (!String(item?.code || '').trim() || !String(item?.title || '').trim()) {
      errors.push(`formulas[${index}] thiếu code hoặc title`)
    }
  })

  ;(Array.isArray(packageData.visualAssets) ? packageData.visualAssets : []).forEach((item, index) => {
    if (!String(item?.code || '').trim() || !String(item?.title || '').trim()) {
      errors.push(`visualAssets[${index}] thiếu code hoặc title`)
    }
  })

  ;(Array.isArray(packageData.questions) ? packageData.questions : []).forEach((item, index) => {
    if (!String(item?.code || '').trim() || !String(item?.type || '').trim() || !String(item?.questionText || '').trim()) {
      errors.push(`questions[${index}] thiếu code, type hoặc questionText`)
    }
  })

  ;(Array.isArray(packageData.learningObjects) ? packageData.learningObjects : []).forEach((item, index) => {
    if (!String(item?.code || '').trim() || !String(item?.title || '').trim()) {
      errors.push(`learningObjects[${index}] thiếu code hoặc title`)
    }

    ;(Array.isArray(item?.contentBlocks) ? item.contentBlocks : []).forEach((block, blockIndex) => {
      if (!String(block?.type || '').trim()) {
        errors.push(`learningObjects[${index}].contentBlocks[${blockIndex}] thiếu type`)
      }
    })

    ;(Array.isArray(item?.questions) ? item.questions : []).forEach((code) => {
      const normalizedCode = String(code || '').trim()
      if (normalizedCode && !questionCodes.has(normalizedCode)) {
        warnings.push(`learningObject ${item?.code || index} tham chiếu question ${normalizedCode} ngoài package, backend sẽ kiểm tra trong tenant DB`)
      }
    })

    ;(Array.isArray(item?.skills) ? item.skills : []).forEach((code) => {
      const normalizedCode = String(code || '').trim()
      if (normalizedCode && !skillCodes.has(normalizedCode)) {
        warnings.push(`learningObject ${item?.code || index} tham chiếu skill ${normalizedCode} ngoài package, backend sẽ kiểm tra trong tenant DB`)
      }
    })

    ;(Array.isArray(item?.knowledgeNodes) ? item.knowledgeNodes : []).forEach((code) => {
      const normalizedCode = String(code || '').trim()
      if (normalizedCode && !knowledgeNodeCodes.has(normalizedCode)) {
        warnings.push(`learningObject ${item?.code || index} tham chiếu knowledgeNode ${normalizedCode} ngoài package, backend sẽ kiểm tra trong tenant DB`)
      }
    })
  })

  return { errors, warnings }
}

function normalizePreview(preview) {
  const safePreview = preview && typeof preview === 'object' ? preview : {}
  return {
    createCount: Number(safePreview.createCount || 0),
    updateCount: Number(safePreview.updateCount || 0),
    blockedCount: Number(safePreview.blockedCount || 0),
    warningCount: Number(safePreview.warningCount || 0),
    errorCount: Number(safePreview.errorCount || 0),
    canImport: safePreview.canImport === true,
    blockedCodes: Array.isArray(safePreview.blockedCodes) ? safePreview.blockedCodes : [],
    warningMessages: Array.isArray(safePreview.warningMessages) ? safePreview.warningMessages : [],
    shapeErrors: Array.isArray(safePreview.shapeErrors) ? safePreview.shapeErrors : [],
    learningObjects: Array.isArray(safePreview.learningObjects) ? safePreview.learningObjects : [],
    questions: Array.isArray(safePreview.questions) ? safePreview.questions : [],
    knowledgeNodes: Array.isArray(safePreview.knowledgeNodes) ? safePreview.knowledgeNodes : [],
    skills: Array.isArray(safePreview.skills) ? safePreview.skills : [],
    formulas: Array.isArray(safePreview.formulas) ? safePreview.formulas : [],
    visualAssets: Array.isArray(safePreview.visualAssets) ? safePreview.visualAssets : [],
    imported: safePreview.imported && typeof safePreview.imported === 'object' ? safePreview.imported : null,
  }
}

export default function LearningPackageImport() {
  const navigate = useNavigate()
  const [selectedFileName, setSelectedFileName] = useState('')
  const [rawInput, setRawInput] = useState('')
  const [activeTab, setActiveTab] = useState('learningObjects')
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [localErrors, setLocalErrors] = useState([])
  const [localWarnings, setLocalWarnings] = useState([])
  const [serverError, setServerError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [previewResult, setPreviewResult] = useState(null)
  const [packageData, setPackageData] = useState(null)

  const normalizedPreview = useMemo(() => normalizePreview(previewResult), [previewResult])

  async function handleFileChange(event) {
    const file = event.target.files?.[0] || null
    setSelectedFileName(file?.name || '')
    setServerError('')
    setSuccessMessage('')

    if (!file) return

    try {
      const text = await file.text()
      setRawInput(text)
    } catch {
      setServerError('Không thể đọc file .json đã chọn')
    }
  }

  function resetAll() {
    setSelectedFileName('')
    setRawInput('')
    setLocalErrors([])
    setLocalWarnings([])
    setServerError('')
    setSuccessMessage('')
    setPreviewResult(null)
    setPackageData(null)
    setActiveTab('learningObjects')
  }

  async function handlePreview() {
    setIsPreviewing(true)
    setServerError('')
    setSuccessMessage('')
    setPreviewResult(null)

    try {
      const parsedPackage = parseJsonInput(rawInput)
      const validation = validatePackageShapeLocal(parsedPackage)
      setLocalErrors(validation.errors)
      setLocalWarnings(validation.warnings)

      if (validation.errors.length > 0) {
        setPackageData(parsedPackage)
        return
      }

      const preview = await previewLearningPackage(parsedPackage)
      setPackageData(parsedPackage)
      setPreviewResult(preview)
    } catch (error) {
      setLocalErrors([])
      setLocalWarnings([])
      setPackageData(null)
      setServerError(error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'Không thể kiểm tra dữ liệu package')
    } finally {
      setIsPreviewing(false)
    }
  }

  async function handleConfirmImport() {
    if (!packageData || !normalizedPreview.canImport) return

    setIsImporting(true)
    setServerError('')
    setSuccessMessage('')

    try {
      const result = await confirmLearningPackage(packageData)
      setPreviewResult(result)
      setSuccessMessage('Import gói học liệu thành công')
    } catch (error) {
      setServerError(error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || 'Không thể import gói học liệu')
    } finally {
      setIsImporting(false)
    }
  }

  const previewVisible = previewResult && typeof previewResult === 'object'

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader>
            <strong>Nhập gói học liệu</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3'>
              <CCol lg={6}>
                <div className='mb-2 fw-semibold'>Tải file JSON</div>
                <CFormInput type='file' accept='.json,application/json' onChange={handleFileChange} disabled={isPreviewing || isImporting} />
                {selectedFileName ? <div className='small text-body-secondary mt-2'>File đã chọn: {selectedFileName}</div> : null}
              </CCol>
              <CCol lg={6}>
                <div className='mb-2 fw-semibold'>Paste JSON package</div>
                <CFormTextarea
                  rows={12}
                  value={rawInput}
                  onChange={(event) => setRawInput(event.target.value)}
                  placeholder='Paste JSON package vào đây...'
                  disabled={isPreviewing || isImporting}
                />
              </CCol>
              <CCol xs={12} className='d-flex flex-wrap gap-2'>
                <CButton color='primary' onClick={handlePreview} disabled={isPreviewing || isImporting || !String(rawInput || '').trim()}>
                  {isPreviewing ? (
                    <span className='d-inline-flex align-items-center gap-2'><CSpinner size='sm' /> Kiểm tra dữ liệu</span>
                  ) : 'Kiểm tra dữ liệu'}
                </CButton>
                <CButton color='secondary' variant='outline' onClick={resetAll} disabled={isPreviewing || isImporting}>
                  Xóa dữ liệu
                </CButton>
                {previewVisible && normalizedPreview.canImport ? (
                  <CButton color='success' onClick={handleConfirmImport} disabled={isImporting || isPreviewing}>
                    {isImporting ? (
                      <span className='d-inline-flex align-items-center gap-2'><CSpinner size='sm' /> Xác nhận import</span>
                    ) : 'Xác nhận import'}
                  </CButton>
                ) : null}
              </CCol>
            </CRow>

            {localErrors.length > 0 ? (
              <CAlert color='danger' className='mt-3 mb-0'>
                <div className='fw-semibold mb-2'>Kiểm tra frontend chưa đạt</div>
                <ul className='mb-0 ps-3'>
                  {localErrors.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                </ul>
              </CAlert>
            ) : null}

            {localWarnings.length > 0 ? (
              <CAlert color='warning' className='mt-3 mb-0'>
                <div className='fw-semibold mb-2'>Cảnh báo frontend</div>
                <ul className='mb-0 ps-3'>
                  {localWarnings.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                </ul>
              </CAlert>
            ) : null}

            {serverError ? <CAlert color='danger' className='mt-3 mb-0'>{serverError}</CAlert> : null}
            {successMessage ? <CAlert color='success' className='mt-3 mb-0'>{successMessage}</CAlert> : null}
          </CCardBody>
        </CCard>
      </CCol>

      {previewVisible ? (
        <>
          <CCol xs={12}>
            <CRow className='g-3'>
              <CCol md={6} xl={2}><SummaryCard label='Sẽ tạo mới' value={normalizedPreview.createCount} color='success' /></CCol>
              <CCol md={6} xl={2}><SummaryCard label='Sẽ cập nhật' value={normalizedPreview.updateCount} color='warning' /></CCol>
              <CCol md={6} xl={2}><SummaryCard label='Bị chặn' value={normalizedPreview.blockedCount} color='danger' /></CCol>
              <CCol md={6} xl={2}><SummaryCard label='Cảnh báo' value={normalizedPreview.warningCount} color='info' /></CCol>
              <CCol md={6} xl={2}><SummaryCard label='Lỗi' value={normalizedPreview.errorCount} color='danger' /></CCol>
            </CRow>
          </CCol>

          {normalizedPreview.blockedCount > 0 || normalizedPreview.errorCount > 0 ? (
            <CCol xs={12}>
              <CAlert color='warning' className='mb-0'>
                Có dữ liệu đang ở trạng thái không được phép cập nhật hoặc có lỗi. Vui lòng xử lý trước khi import.
              </CAlert>
            </CCol>
          ) : null}

          {normalizedPreview.blockedCodes.length > 0 ? (
            <CCol xs={12}>
              <CAlert color='danger' className='mb-0'>
                Các code đang tồn tại nhưng không ở trạng thái draft/pending: {normalizedPreview.blockedCodes.join(', ')}
              </CAlert>
            </CCol>
          ) : null}

          {normalizedPreview.shapeErrors.length > 0 ? (
            <CCol xs={12}>
              <CAlert color='danger' className='mb-0'>
                <ul className='mb-0 ps-3'>
                  {normalizedPreview.shapeErrors.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                </ul>
              </CAlert>
            </CCol>
          ) : null}

          {normalizedPreview.warningMessages.length > 0 ? (
            <CCol xs={12}>
              <CAlert color='info' className='mb-0'>
                <ul className='mb-0 ps-3'>
                  {normalizedPreview.warningMessages.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                </ul>
              </CAlert>
            </CCol>
          ) : null}

          <CCol xs={12}>
            <CCard>
              <CCardHeader>
                <strong>Preview import</strong>
              </CCardHeader>
              <CCardBody>
                <CNav variant='tabs' role='tablist'>
                  {PREVIEW_TABS.map((tab) => (
                    <CNavItem key={tab.key}>
                      <CNavLink active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)} role='button'>
                        {tab.label}
                      </CNavLink>
                    </CNavItem>
                  ))}
                </CNav>

                <CTabContent className='pt-3'>
                  {PREVIEW_TABS.map((tab) => {
                    const rows = Array.isArray(normalizedPreview?.[tab.key]) ? normalizedPreview[tab.key] : []
                    return (
                      <CTabPane key={tab.key} visible={activeTab === tab.key}>
                        <CTable hover responsive>
                          <CTableHead>
                            <CTableRow>
                              <CTableHeaderCell>Code</CTableHeaderCell>
                              <CTableHeaderCell>Title</CTableHeaderCell>
                              <CTableHeaderCell>Action</CTableHeaderCell>
                              <CTableHeaderCell>Current Status</CTableHeaderCell>
                              <CTableHeaderCell>Message</CTableHeaderCell>
                            </CTableRow>
                          </CTableHead>
                          <CTableBody>
                            {rows.length === 0 ? (
                              <CTableRow>
                                <CTableDataCell colSpan={5} className='text-center text-body-secondary'>Không có dữ liệu trong nhóm này.</CTableDataCell>
                              </CTableRow>
                            ) : rows.map((item, index) => (
                              <CTableRow key={`${tab.key}-${item?.code || index}`}>
                                <CTableDataCell>{item?.code || '-'}</CTableDataCell>
                                <CTableDataCell>{item?.title || '-'}</CTableDataCell>
                                <CTableDataCell><CBadge color={getActionColor(item?.action)}>{item?.action || 'unknown'}</CBadge></CTableDataCell>
                                <CTableDataCell>{item?.currentStatus || '-'}</CTableDataCell>
                                <CTableDataCell>{item?.message || '-'}</CTableDataCell>
                              </CTableRow>
                            ))}
                          </CTableBody>
                        </CTable>
                      </CTabPane>
                    )
                  })}
                </CTabContent>
              </CCardBody>
            </CCard>
          </CCol>

          {successMessage && normalizedPreview.imported ? (
            <CCol xs={12}>
              <CCard>
                <CCardHeader>
                  <strong>Kết quả import</strong>
                </CCardHeader>
                <CCardBody>
                  <CRow className='g-3'>
                    <CCol md={4}><SummaryCard label='Tổng số tạo mới' value={normalizedPreview.createCount} color='success' /></CCol>
                    <CCol md={4}><SummaryCard label='Tổng số cập nhật' value={normalizedPreview.updateCount} color='warning' /></CCol>
                    <CCol md={4}><SummaryCard label='Số lỗi' value={normalizedPreview.errorCount} color='danger' /></CCol>
                  </CRow>
                  <div className='d-flex flex-wrap gap-2 mt-3'>
                    <CButton color='primary' variant='outline' onClick={() => navigate('/learning/learning-objects')}>
                      Đi tới danh sách Learning Objects
                    </CButton>
                    <CButton color='secondary' variant='outline' onClick={resetAll}>
                      Nhập gói khác
                    </CButton>
                  </div>
                </CCardBody>
              </CCard>
            </CCol>
          ) : null}
        </>
      ) : null}
    </CRow>
  )
}
