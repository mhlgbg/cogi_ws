import { useEffect, useMemo, useState } from 'react'
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
  exportSurveyCampaignLecturerReport,
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

  async function handleExportLecturer(item) {
    const lecturerKey = String(item?.key || item?.lecturerId || item?.lecturerName || '').trim()
    if (!campaignId || !lecturerKey || exportingLecturerKey) return

    setExportingLecturerKey(lecturerKey)
    setError('')

    try {
      const result = await exportSurveyCampaignLecturerReport(campaignId, lecturerKey)
      const blob = result?.blob instanceof Blob
        ? result.blob
        : new Blob([result?.blob], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          })

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result?.fileName || `survey-report-${campaignId}-${lecturerKey}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể export báo cáo giảng viên'))
    } finally {
      setExportingLecturerKey('')
    }
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

        if (!mounted) return

        setSummary(summaryData || null)
        setLecturers(Array.isArray(lecturerData?.items) ? lecturerData.items : [])
        setCourses(Array.isArray(courseData?.items) ? courseData.items : [])
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
              <div className='fw-semibold mb-3'>Giảng viên</div>
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
              <div className='fw-semibold mb-3'>Môn học</div>
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
                      </tr>
                    </thead>
                    <tbody>
                      {courses.map((item, index) => (
                        <tr key={`${item.courseName || 'course'}-${index}`}>
                          <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>{item.courseName || '-'}</td>
                          <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{item.totalResponses || 0}</td>
                          <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 600 }}>{formatScore(item.avgScore)}</td>
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