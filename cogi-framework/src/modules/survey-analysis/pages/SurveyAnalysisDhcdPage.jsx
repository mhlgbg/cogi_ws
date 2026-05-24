import { useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { useTenant } from '../../../contexts/TenantContext'
import {
  analyzeDhcdSurveyExcelFile,
  exportDhcdStudentsByMajor,
  exportDhcdSurveyMajorProgressReport,
  exportDhcdSurveyAnalysisReport,
} from '../services/surveyAnalysisExcelService'

function formatPercent(value) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`
}

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

export default function SurveyAnalysisDhcdPage() {
  const tenant = useTenant()
  const currentTenant = tenant?.currentTenant || null

  const [file, setFile] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const tenantLabel = useMemo(() => {
    const code = String(currentTenant?.tenantCode || '').trim()
    const name = String(currentTenant?.tenantName || '').trim()
    return [name, code ? `(${code})` : ''].filter(Boolean).join(' ')
  }, [currentTenant?.tenantCode, currentTenant?.tenantName])

  async function handleAnalyze() {
    if (!file) return

    setIsAnalyzing(true)
    setError('')

    try {
      const analysis = await analyzeDhcdSurveyExcelFile(file)
      setResult(analysis)
    } catch (analysisError) {
      setResult(null)
      setError(analysisError?.message || 'Không thể phân tích file Excel')
    } finally {
      setIsAnalyzing(false)
    }
  }

  function handleExport() {
    if (!result) return
    exportDhcdSurveyAnalysisReport(result)
  }

  function handleExportMajorProgress() {
    if (!result) return
    exportDhcdSurveyMajorProgressReport(result)
  }

  function handleExportStudentsByMajor() {
    if (!result) return
    exportDhcdStudentsByMajor(result)
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard>
          <CCardHeader>
            <strong>Phân tích khảo sát ĐH Công Đoàn</strong>
          </CCardHeader>
          <CCardBody>
            <div className='mb-3 text-body-secondary'>
              Phân tích tiến độ khảo sát từ file Excel xuất ra bởi hệ thống khảo sát.
            </div>
            <div className='d-flex flex-wrap align-items-center gap-2'>
              <CBadge color='info'>Tenant hiện tại: {tenantLabel || 'Chưa xác định'}</CBadge>
              <CBadge color='secondary'>Chuẩn parser: ĐH Công Đoàn</CBadge>
            </div>
          </CCardBody>
        </CCard>
      </CCol>

      <CCol xs={12}>
        <CCard>
          <CCardHeader>
            <strong>Tải file Excel</strong>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 align-items-end'>
              <CCol lg={8}>
                <CFormInput
                  type='file'
                  accept='.xlsx,.xls'
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  disabled={isAnalyzing}
                />
              </CCol>
              <CCol lg={4} className='d-flex gap-2'>
                <CButton color='primary' onClick={handleAnalyze} disabled={!file || isAnalyzing}>
                  {isAnalyzing ? 'Đang phân tích...' : 'Phân tích'}
                </CButton>
                <CButton color='success' variant='outline' onClick={handleExport} disabled={!result || isAnalyzing}>
                  Xuất Excel báo cáo
                </CButton>
                <CButton color='success' onClick={handleExportMajorProgress} disabled={!result || isAnalyzing}>
                  Xuất Excel theo ngành
                </CButton>
                <CButton color='info' variant='outline' onClick={handleExportStudentsByMajor} disabled={!result || isAnalyzing}>
                  Tách sinh viên theo ngành
                </CButton>
              </CCol>
            </CRow>
            {file ? <div className='small text-body-secondary mt-2'>File đã chọn: {file.name}</div> : null}
            {isAnalyzing ? (
              <div className='d-flex align-items-center gap-2 mt-3'>
                <CSpinner size='sm' />
                <span>Đang đọc file và tổng hợp dữ liệu...</span>
              </div>
            ) : null}
            {error ? <CAlert color='danger' className='mt-3 mb-0'>{error}</CAlert> : null}
          </CCardBody>
        </CCard>
      </CCol>

      {result ? (
        <>
          <CCol xs={12}>
            <CRow className='g-3'>
              <CCol md={6} xl={3}><SummaryCard label='Tổng số dòng đọc được' value={result.summary.totalRows} color='primary' /></CCol>
              <CCol md={6} xl={3}><SummaryCard label='Số dòng hợp lệ' value={result.summary.validRowCount} color='success' /></CCol>
              <CCol md={6} xl={3}><SummaryCard label='Số dòng lỗi/cảnh báo' value={result.summary.warningCount} color='warning' /></CCol>
              <CCol md={6} xl={3}><SummaryCard label='Tổng số sinh viên' value={result.summary.totalStudents} color='info' /></CCol>
              <CCol md={6} xl={3}><SummaryCard label='Tổng số khảo sát phải làm' value={result.summary.requiredTotal} /></CCol>
              <CCol md={6} xl={3}><SummaryCard label='Tổng số khảo sát đã hoàn thành' value={result.summary.completedTotal} color='success' /></CCol>
              <CCol md={6} xl={3}><SummaryCard label='Tổng số khảo sát đang làm' value={result.summary.doingTotal} color='warning' /></CCol>
              <CCol md={6} xl={3}><SummaryCard label='Tỷ lệ hoàn thành chung' value={formatPercent(result.summary.completionRate)} color='primary' /></CCol>
            </CRow>
          </CCol>

          {result.missingColumns.length > 0 ? (
            <CCol xs={12}>
              <CAlert color='warning' className='mb-0'>
                Thiếu cột bắt buộc: {result.missingColumns.join(', ')}
              </CAlert>
            </CCol>
          ) : null}

          <CCol xs={12}>
            <CCard>
              <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
                <strong>Tổng hợp theo Khóa + Ngành</strong>
                <CBadge color='secondary'>{result.groupedRows.length} nhóm</CBadge>
              </CCardHeader>
              <CCardBody>
                <CTable hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>STT</CTableHeaderCell>
                      <CTableHeaderCell>Khóa</CTableHeaderCell>
                      <CTableHeaderCell>Năm tuyển sinh</CTableHeaderCell>
                      <CTableHeaderCell>Mã ngành</CTableHeaderCell>
                      <CTableHeaderCell>Ngành</CTableHeaderCell>
                      <CTableHeaderCell>Số sinh viên</CTableHeaderCell>
                      <CTableHeaderCell>Tổng khảo sát phải làm</CTableHeaderCell>
                      <CTableHeaderCell>Đã hoàn thành</CTableHeaderCell>
                      <CTableHeaderCell>Đang làm</CTableHeaderCell>
                      <CTableHeaderCell>Chưa làm</CTableHeaderCell>
                      <CTableHeaderCell>Tỷ lệ hoàn thành</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {result.groupedRows.length === 0 ? (
                      <CTableRow>
                        <CTableDataCell colSpan={11} className='text-center text-body-secondary'>Không có dữ liệu hợp lệ để tổng hợp.</CTableDataCell>
                      </CTableRow>
                    ) : result.groupedRows.map((item, index) => (
                      <CTableRow key={`${item.cohort}-${item.majorCode}-${index}`}>
                        <CTableDataCell>{index + 1}</CTableDataCell>
                        <CTableDataCell>{item.cohort}</CTableDataCell>
                        <CTableDataCell>{item.admissionYear}</CTableDataCell>
                        <CTableDataCell>{item.majorCode}</CTableDataCell>
                        <CTableDataCell>{item.majorName}</CTableDataCell>
                        <CTableDataCell>{item.studentCount}</CTableDataCell>
                        <CTableDataCell>{item.requiredTotal}</CTableDataCell>
                        <CTableDataCell>{item.completedTotal}</CTableDataCell>
                        <CTableDataCell>{item.doingTotal}</CTableDataCell>
                        <CTableDataCell>{item.notStartedTotal}</CTableDataCell>
                        <CTableDataCell>{formatPercent(item.completionRate)}</CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </CCardBody>
            </CCard>
          </CCol>

          <CCol xs={12}>
            <CCard>
              <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
                <strong>Cảnh báo dữ liệu</strong>
                <CBadge color={result.warnings.length > 0 ? 'warning' : 'success'}>{result.warnings.length}</CBadge>
              </CCardHeader>
              <CCardBody>
                {result.warnings.length === 0 ? (
                  <CAlert color='success' className='mb-0'>Không có cảnh báo dữ liệu.</CAlert>
                ) : (
                  <CTable hover responsive>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>STT</CTableHeaderCell>
                        <CTableHeaderCell>Dòng</CTableHeaderCell>
                        <CTableHeaderCell>Mã sinh viên</CTableHeaderCell>
                        <CTableHeaderCell>Loại cảnh báo</CTableHeaderCell>
                        <CTableHeaderCell>Thông điệp</CTableHeaderCell>
                        <CTableHeaderCell>Chi tiết</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {result.warnings.map((item, index) => (
                        <CTableRow key={`${item.type}-${item.rowNumber || 'global'}-${index}`}>
                          <CTableDataCell>{index + 1}</CTableDataCell>
                          <CTableDataCell>{item.rowNumber || '-'}</CTableDataCell>
                          <CTableDataCell>{item.studentCode || '-'}</CTableDataCell>
                          <CTableDataCell>{item.type}</CTableDataCell>
                          <CTableDataCell>{item.message}</CTableDataCell>
                          <CTableDataCell>{item.detail || '-'}</CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        </>
      ) : null}
    </CRow>
  )
}
