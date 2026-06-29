import { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  CButton,
  CAlert,
  CCard,
  CCardBody,
  CCol,
  CRow,
  CSpinner,
} from '@coreui/react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  downloadSurveyCampaignAnswersReportLatestFile,
  exportSurveyCampaignCourseReport,
  exportSurveyCampaignLecturerReport,
  generateSurveyCampaignAnswersReportFile,
  getSurveyCampaignAnswersReportLatestFile,
  getSurveyCampaignReportCourses,
  getSurveyCampaignReportLecturers,
  getSurveyCampaignReportSummary,
} from '../services/surveyCampaignService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function formatScore(value) {
  const numeric = Number(value || 0)
  return numeric.toFixed(2)
}

function EmptyState({ text }) {
  return <div className='text-body-secondary text-center py-4'>{text}</div>
}

export default function CampaignReport({ campaignId, active, reloadKey = 0 }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)
  const [lecturers, setLecturers] = useState([])
  const [courses, setCourses] = useState([])
  const [exportingLecturerKey, setExportingLecturerKey] = useState('')
  const [exportingCourseKey, setExportingCourseKey] = useState('')
  const [generatingAnswersReport, setGeneratingAnswersReport] = useState(false)
  const [downloadingAnswersReport, setDownloadingAnswersReport] = useState(false)
  const [answersReportInfo, setAnswersReportInfo] = useState(null)

  function downloadBlob(blob, fileName) {
    const nextBlob = blob instanceof Blob
      ? blob
      : new Blob([blob], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })

    const url = URL.createObjectURL(nextBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportGridToExcel(rows, sheetName, fileName) {
    if (!Array.isArray(rows) || rows.length === 0) {
      setError('Không có dữ liệu để xuất Excel')
      return
    }

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    XLSX.writeFile(workbook, fileName)
  }

  async function handleExportLecturer(item) {
    const lecturerKey = String(item?.key || item?.lecturerId || item?.lecturerName || '').trim()
    if (!campaignId || !lecturerKey || exportingLecturerKey) return

    setExportingLecturerKey(lecturerKey)
    setError('')

    try {
      const result = await exportSurveyCampaignLecturerReport(campaignId, lecturerKey)
      downloadBlob(result?.blob, result?.fileName || `survey-report-${campaignId}-${lecturerKey}.xlsx`)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể export báo cáo giảng viên'))
    } finally {
      setExportingLecturerKey('')
    }
  }

  async function handleExportCourse(item) {
    const courseKey = String(item?.key || item?.courseId || item?.courseName || '').trim()
    if (!campaignId || !courseKey || exportingCourseKey) return

    setExportingCourseKey(courseKey)
    setError('')

    try {
      const result = await exportSurveyCampaignCourseReport(campaignId, courseKey)
      downloadBlob(result?.blob, result?.fileName || `survey-report-${campaignId}-${courseKey}.xlsx`)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể export báo cáo môn học'))
    } finally {
      setExportingCourseKey('')
    }
  }

  async function loadLatestAnswersReportInfo() {
    if (!campaignId) {
      setAnswersReportInfo(null)
      return
    }

    try {
      const info = await getSurveyCampaignAnswersReportLatestFile(campaignId)
      setAnswersReportInfo(info || null)
    } catch {
      setAnswersReportInfo(null)
    }
  }

  async function handleGenerateAnswersReport() {
    if (!campaignId || generatingAnswersReport) return

    setGeneratingAnswersReport(true)
    setError('')

    try {
      const info = await generateSurveyCampaignAnswersReportFile(campaignId)
      setAnswersReportInfo((current) => ({
        ...(current || {}),
        ...(info || {}),
        hasFile: true,
      }))
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tạo file report toàn bộ câu trả lời'))
    } finally {
      setGeneratingAnswersReport(false)
    }
  }

  async function handleDownloadAnswersReport() {
    if (!campaignId || downloadingAnswersReport) return

    if (!answersReportInfo?.hasFile) {
      setError('Chưa có file report. Hãy nhấn "Tạo file report" trước.')
      return
    }

    setDownloadingAnswersReport(true)
    setError('')

    try {
      const result = await downloadSurveyCampaignAnswersReportLatestFile(campaignId)
      downloadBlob(result?.blob, result?.fileName || `survey-answers-${campaignId}.xlsx`)
      await loadLatestAnswersReportInfo()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tải file report toàn bộ câu trả lời'))
    } finally {
      setDownloadingAnswersReport(false)
    }
  }

  function handleExportLecturerGrid() {
    exportGridToExcel(
      lecturers.map((item) => ({
        'Giảng viên': item?.lecturerName || '-',
        'Số lượt': item?.totalResponses || 0,
        'Điểm TB': formatScore(item?.avgScore),
      })),
      'GiangVien',
      `survey-campaign-${campaignId}-lecturers.xlsx`,
    )
  }

  function handleExportCourseGrid() {
    exportGridToExcel(
      courses.map((item) => ({
        'Môn học': item?.courseName || '-',
        'Số lượt': item?.totalResponses || 0,
        'Điểm TB': formatScore(item?.avgScore),
      })),
      'MonHoc',
      `survey-campaign-${campaignId}-courses.xlsx`,
    )
  }

  useEffect(() => {
    let mounted = true

    async function load() {
      if (!active || !campaignId) return

      setLoading(true)
      setError('')

      try {
        const [summaryData, lecturerData, courseData] = await Promise.all([
          getSurveyCampaignReportSummary(campaignId),
          getSurveyCampaignReportLecturers(campaignId),
          getSurveyCampaignReportCourses(campaignId),
        ])

        let answersReportInfoData = null
        try {
          answersReportInfoData = await getSurveyCampaignAnswersReportLatestFile(campaignId)
        } catch {
          answersReportInfoData = null
        }

        if (!mounted) return

        setSummary(summaryData || null)
        setLecturers(Array.isArray(lecturerData?.items) ? lecturerData.items : [])
        setCourses(Array.isArray(courseData?.items) ? courseData.items : [])
        setAnswersReportInfo(answersReportInfoData || null)
      } catch (requestError) {
        if (!mounted) return
        setError(getApiMessage(requestError, 'Không thể tải báo cáo campaign'))
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [active, campaignId, reloadKey])

  const topLecturers = useMemo(() => lecturers.slice(0, 8), [lecturers])

  if (!active) return null

  if (loading) {
    return (
      <div className='text-center py-5'>
        <CSpinner color='primary' />
      </div>
    )
  }

  if (error) {
    return <CAlert color='danger'>{error}</CAlert>
  }

  return (
    <div className='d-flex flex-column gap-4'>
      <CRow className='g-3'>
        <CCol md={4}>
          <CCard className='border-0 shadow-sm h-100'>
            <CCardBody>
              <div className='text-medium-emphasis small'>Total assignments</div>
              <div className='fs-4 fw-semibold'>{summary?.totalAssignments || 0}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={4}>
          <CCard className='border-0 shadow-sm h-100'>
            <CCardBody>
              <div className='text-medium-emphasis small'>Completed</div>
              <div className='fs-4 fw-semibold'>{summary?.completedAssignments || 0}</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={4}>
          <CCard className='border-0 shadow-sm h-100'>
            <CCardBody>
              <div className='text-medium-emphasis small'>Completion rate</div>
              <div className='fs-4 fw-semibold'>{formatScore(summary?.completionRate)}%</div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CCard className='border-0 shadow-sm'>
        <CCardBody>
          <div className='fw-semibold mb-3'>Top giảng viên theo điểm trung bình</div>
          {topLecturers.length === 0 ? (
            <EmptyState text='Chưa có dữ liệu biểu đồ' />
          ) : (
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={topLecturers} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray='3 3' vertical={false} />
                  <XAxis
                    dataKey='lecturerName'
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    angle={-18}
                    textAnchor='end'
                    height={72}
                  />
                  <YAxis tickLine={false} axisLine={false} domain={[0, 'dataMax']} />
                  <Tooltip formatter={(value) => formatScore(value)} />
                  <Bar dataKey='avgScore' radius={[8, 8, 0, 0]}>
                    {topLecturers.map((item, index) => (
                      <Cell key={`${item.lecturerName}-${index}`} fill={index % 2 === 0 ? '#321fdb' : '#9da5b1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CCardBody>
      </CCard>

      <CRow className='g-4'>
        <CCol xl={6}>
          <CCard className='border-0 shadow-sm h-100'>
            <CCardBody>
              <div className='d-flex justify-content-between align-items-center gap-2 mb-3'>
                <div className='fw-semibold'>Giảng viên</div>
                <div className='d-flex gap-2 flex-wrap justify-content-end'>
                  <CButton size='sm' color='success' variant='outline' onClick={handleExportLecturerGrid} disabled={lecturers.length === 0}>Xuất Excel</CButton>
                  <CButton size='sm' color='primary' variant='outline' onClick={handleGenerateAnswersReport} disabled={generatingAnswersReport || !campaignId}>
                    {generatingAnswersReport ? 'Đang tạo...' : 'Tạo file report'}
                  </CButton>
                  <CButton size='sm' color='info' variant='outline' onClick={handleDownloadAnswersReport} disabled={downloadingAnswersReport || !answersReportInfo?.hasFile}>
                    {downloadingAnswersReport ? 'Đang tải...' : 'Tải file report'}
                  </CButton>
                </div>
              </div>
              <div className='small text-body-secondary mb-3'>
                Prefix: {answersReportInfo?.prefix || '-'}
                {' | '}
                File mới nhất: {answersReportInfo?.fileName || 'chưa có'}
                {' | '}
                Thời điểm: {answersReportInfo?.generatedAt ? new Date(answersReportInfo.generatedAt).toLocaleString('vi-VN') : '-'}
              </div>
              {lecturers.length === 0 ? (
                <EmptyState text='Chưa có dữ liệu giảng viên' />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Giảng viên</th>
                        <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>Số lượt</th>
                        <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>Điểm TB</th>
                        <th style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid #ddd' }}>Export</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lecturers.map((item, index) => (
                        <tr key={`${item.lecturerName || 'lecturer'}-${index}`}>
                          <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>{item.lecturerName || '-'}</td>
                          <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{item.totalResponses || 0}</td>
                          <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 600 }}>{formatScore(item.avgScore)}</td>
                          <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                            <CButton
                              size='sm'
                              color='success'
                              variant='outline'
                              onClick={() => handleExportLecturer(item)}
                              disabled={!item?.key || exportingLecturerKey === String(item.key)}
                            >
                              {exportingLecturerKey === String(item?.key || '') ? 'Đang export...' : 'Export Excel'}
                            </CButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>

        <CCol xl={6}>
          <CCard className='border-0 shadow-sm h-100'>
            <CCardBody>
              <div className='d-flex justify-content-between align-items-center gap-2 mb-3'>
                <div className='fw-semibold'>Môn học</div>
                <CButton size='sm' color='success' variant='outline' onClick={handleExportCourseGrid} disabled={courses.length === 0}>Xuất Excel</CButton>
              </div>
              {courses.length === 0 ? (
                <EmptyState text='Chưa có dữ liệu môn học' />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 420, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Môn học</th>
                        <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>Số lượt</th>
                        <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>Điểm TB</th>
                        <th style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid #ddd' }}>Export</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map((item, index) => (
                        <tr key={`${item.courseName || 'course'}-${index}`}>
                          <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>{item.courseName || '-'}</td>
                          <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{item.totalResponses || 0}</td>
                          <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 600 }}>{formatScore(item.avgScore)}</td>
                          <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                            <CButton
                              size='sm'
                              color='success'
                              variant='outline'
                              onClick={() => handleExportCourse(item)}
                              disabled={!item?.key || exportingCourseKey === String(item.key)}
                            >
                              {exportingCourseKey === String(item?.key || '') ? 'Đang export...' : 'Export Excel'}
                            </CButton>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </div>
  )
}