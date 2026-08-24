import { useEffect, useState } from 'react'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import AssessmentSpeakingCriterionEditorModal from './AssessmentSpeakingCriterionEditorModal'
import { createAssessmentSpeakingCriterion, deleteAssessmentSpeakingCriterion, getApiMessage, getAssessmentSpeakingCriteria, updateAssessmentSpeakingCriterion } from '../services/assessmentService'

export default function AssessmentSpeakingCriteriaTab({ versionId, versionStatus }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editorVisible, setEditorVisible] = useState(false)
  const [editingCriterion, setEditingCriterion] = useState(null)

  useEffect(() => {
    if (!versionId) return
    loadCriteria()
  }, [versionId])

  async function loadCriteria() {
    setLoading(true)
    setError('')
    try {
      const payload = await getAssessmentSpeakingCriteria(versionId)
      setRows(Array.isArray(payload) ? payload : [])
    } catch (requestError) {
      setRows([])
      setError(getApiMessage(requestError, 'Không tải được cấu hình Speaking'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(payload) {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (editingCriterion) await updateAssessmentSpeakingCriterion(editingCriterion.id, payload)
      else await createAssessmentSpeakingCriterion(versionId, payload)
      await loadCriteria()
      setEditorVisible(false)
      setEditingCriterion(null)
      setSuccess(editingCriterion ? 'Đã cập nhật tiêu chí Speaking' : 'Đã tạo tiêu chí Speaking')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không lưu được tiêu chí Speaking'))
      throw requestError
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    if (!window.confirm(`Xóa tiêu chí ${row.label || row.code}?`)) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await deleteAssessmentSpeakingCriterion(row.id)
      await loadCriteria()
      setSuccess('Đã xóa tiêu chí Speaking')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không xóa được tiêu chí Speaking'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}
      {versionStatus === 'published' ? <CAlert color='warning'>Thay đổi này chỉ áp dụng cho Speaking Review tạo sau thời điểm cập nhật. Các review đã snapshot trước đó sẽ không đổi.</CAlert> : null}
      <CCard className='ai-card'>
        <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
          <div>
            <strong>Cấu hình Speaking</strong>
            <div className='small text-body-secondary'>Quản lý tiêu chí chấm Speaking cho phiên bản đề hiện tại.</div>
          </div>
          <CButton color='primary' onClick={() => { setEditingCriterion(null); setEditorVisible(true) }} disabled={saving || !versionId}>+ Thêm tiêu chí</CButton>
        </CCardHeader>
        <CCardBody>
          {loading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải cấu hình Speaking...</span></div> : rows.length === 0 ? <div className='text-body-secondary'>Phiên bản này chưa có tiêu chí Speaking.</div> : (
            <CTable responsive hover align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Code</CTableHeaderCell>
                  <CTableHeaderCell>Tên tiêu chí</CTableHeaderCell>
                  <CTableHeaderCell>Mô tả</CTableHeaderCell>
                  <CTableHeaderCell>Hướng dẫn chấm</CTableHeaderCell>
                  <CTableHeaderCell>Điểm tối đa</CTableHeaderCell>
                  <CTableHeaderCell>Bắt buộc</CTableHeaderCell>
                  <CTableHeaderCell>Thứ tự</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Actions</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.map((row) => (
                  <CTableRow key={row.id}>
                    <CTableDataCell>{row.code}</CTableDataCell>
                    <CTableDataCell>{row.label}</CTableDataCell>
                    <CTableDataCell>{row.description || '-'}</CTableDataCell>
                    <CTableDataCell>{row.guidance || '-'}</CTableDataCell>
                    <CTableDataCell>{row.maxScore ?? '-'}</CTableDataCell>
                    <CTableDataCell>{row.required === false ? 'Không' : 'Có'}</CTableDataCell>
                    <CTableDataCell>{row.order}</CTableDataCell>
                    <CTableDataCell><CBadge color={row.status === 'active' ? 'success' : 'secondary'}>{row.status === 'active' ? 'Hoạt động' : 'Ngưng dùng'}</CBadge></CTableDataCell>
                    <CTableDataCell>
                      <div className='d-flex gap-2 flex-wrap'>
                        <CButton size='sm' color='secondary' variant='outline' onClick={() => { setEditingCriterion(row); setEditorVisible(true) }} disabled={saving}>Sửa</CButton>
                        <CButton size='sm' color='danger' variant='outline' onClick={() => handleDelete(row)} disabled={saving}>Xóa</CButton>
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>
      <AssessmentSpeakingCriterionEditorModal visible={editorVisible} saving={saving} criterion={editingCriterion} onClose={() => { if (!saving) { setEditorVisible(false); setEditingCriterion(null) } }} onSubmit={handleSubmit} />
    </>
  )
}