import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CBadge, CButton, CCard, CCardBody, CCardHeader, CSpinner } from '@coreui/react'
import ImportAssignmentModal from '../components/ImportAssignmentModal'
import { getSurveyCampaigns, updateSurveyCampaign } from '../services/surveyCampaignService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function statusColor(status) {
  if (status === 'OPEN') return 'success'
  if (status === 'CLOSED') return 'secondary'
  return 'warning'
}

export default function CampaignList() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [campaigns, setCampaigns] = useState([])
  const [busyById, setBusyById] = useState({})
  const [importTarget, setImportTarget] = useState(null)

  async function loadCampaigns() {
    setLoading(true)
    setError('')

    try {
      const response = await getSurveyCampaigns()
      setCampaigns(Array.isArray(response?.data) ? response.data : [])
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tải danh sách campaign'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCampaigns()
  }, [])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [success])

  const rows = useMemo(() => campaigns, [campaigns])

  async function handleToggleStatus(item) {
    const nextStatus = item?.campaignStatus === 'OPEN' ? 'CLOSED' : 'OPEN'
    setBusyById((prev) => ({ ...prev, [item.id]: true }))
    setError('')
    setSuccess('')

    try {
      const updated = await updateSurveyCampaign(item.id, {
        ...item,
        survey_template: item?.surveyTemplate?.id,
        campaignStatus: nextStatus,
      })

      setCampaigns((prev) => prev.map((campaign) => (campaign.id === item.id ? updated : campaign)))
      setSuccess('Cập nhật trạng thái campaign thành công')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể cập nhật trạng thái campaign'))
    } finally {
      setBusyById((prev) => ({ ...prev, [item.id]: false }))
    }
  }

  return (
    <div className='container-fluid py-4'>
      <CCard className='border-0 shadow-sm'>
        <CCardHeader className='d-flex align-items-center justify-content-between gap-3 flex-wrap bg-white'>
          <div>
            <strong>Survey Campaign Management</strong>
          </div>
          <div className='d-flex gap-2'>
            <CButton color='secondary' variant='outline' onClick={loadCampaigns} disabled={loading}>Tải lại</CButton>
            <CButton color='primary' onClick={() => navigate('/survey/campaigns/create')}>Create</CButton>
          </div>
        </CCardHeader>
        <CCardBody>
          {error ? <div className='alert alert-danger'>{error}</div> : null}
          {success ? <div className='alert alert-success'>{success}</div> : null}

          {loading ? (
            <div className='d-flex align-items-center gap-2'>
              <CSpinner size='sm' />
              <span>Đang tải dữ liệu...</span>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Tên</th>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Năm học</th>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Kỳ</th>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Trạng thái</th>
                    <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>Tổng</th>
                    <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>Đã làm</th>
                    <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid #ddd' }}>%</th>
                    <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #ddd' }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '12px 8px' }}>Không có campaign nào</td>
                    </tr>
                  ) : rows.map((item) => {
                    const busy = Boolean(busyById[item.id])
                    return (
                      <tr key={item.id}>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>
                          <div style={{ fontWeight: 600 }}>{item.name || '-'}</div>
                          <div style={{ color: '#666', fontSize: 13 }}>{item.surveyTemplate?.name || '-'}</div>
                        </td>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>{item.academicYear || '-'}</td>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>{item.semester || '-'}</td>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}><CBadge color={statusColor(item.campaignStatus)}>{item.campaignStatus || 'DRAFT'}</CBadge></td>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{item.totalAssignments || 0}</td>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{item.completedAssignments || 0}</td>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{item.progressPercent || 0}%</td>
                        <td style={{ padding: '10px 8px', borderBottom: '1px solid #eee' }}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <CButton size='sm' color='info' variant='outline' onClick={() => navigate(`/survey/campaigns/${item.id}`)}>View Detail</CButton>
                            <CButton size='sm' color='warning' variant='outline' onClick={() => navigate(`/survey/campaigns/create?id=${item.id}`)}>Edit</CButton>
                            <CButton size='sm' color='primary' variant='outline' onClick={() => setImportTarget(item)}>Import Assignment</CButton>
                            <CButton size='sm' color='secondary' variant='outline' disabled={busy} onClick={() => handleToggleStatus(item)}>
                              {busy ? 'Đang cập nhật...' : item.campaignStatus === 'OPEN' ? 'Close' : 'Open'}
                            </CButton>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CCardBody>
      </CCard>

      <ImportAssignmentModal
        visible={Boolean(importTarget)}
        campaignId={importTarget?.id}
        campaignName={importTarget?.name}
        onClose={() => setImportTarget(null)}
        onSuccess={loadCampaigns}
      />
    </div>
  )
}