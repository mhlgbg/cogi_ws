import { useEffect, useState } from 'react'
import { CAlert, CBadge, CButton, CCard, CCardBody, CCardHeader, CSpinner, CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow } from '@coreui/react'
import AssessmentPlacementRuleEditorModal from './AssessmentPlacementRuleEditorModal'
import { createAssessmentPlacementRule, deleteAssessmentPlacementRule, getApiMessage, getAssessmentPlacementRules, updateAssessmentPlacementRule } from '../services/assessmentService'
import { getCefrLabel } from './assessmentUi'

function renderRange(rule) {
  if (rule?.ruleType === 'raw_score') return `${rule?.minRawScore ?? '-'} → ${rule?.maxRawScore ?? '-'}`
  return `${rule?.minPercentage ?? '-'}% → ${rule?.maxPercentage ?? '-'}%`
}

export default function AssessmentPlacementRulesTab({ versionId, versionStatus }) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editorVisible, setEditorVisible] = useState(false)
  const [editingRule, setEditingRule] = useState(null)

  useEffect(() => {
    if (!versionId) {
      setRows([])
      return
    }
    loadRules()
  }, [versionId])

  function openCreateEditor() {
    if (!versionId) {
      setError('Không xác định được phiên bản đề hiện tại.')
      return
    }
    setError('')
    setEditingRule(null)
    setEditorVisible(true)
  }

  function openEditEditor(rule) {
    if (!versionId) {
      setError('Không xác định được phiên bản đề hiện tại.')
      return
    }
    setError('')
    setEditingRule(rule)
    setEditorVisible(true)
  }

  async function loadRules() {
    setLoading(true)
    setError('')
    try {
      const payload = await getAssessmentPlacementRules({ assessmentVersion: versionId })
      setRows(Array.isArray(payload) ? payload : [])
    } catch (requestError) {
      setRows([])
      setError(getApiMessage(requestError, 'Không tải được quy tắc xếp mức'))
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(payload) {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (editingRule) await updateAssessmentPlacementRule(editingRule.id, payload)
      else await createAssessmentPlacementRule(payload)
      await loadRules()
      setEditorVisible(false)
      setEditingRule(null)
      setSuccess(editingRule ? 'Đã cập nhật quy tắc xếp mức' : 'Đã tạo quy tắc xếp mức')
    } catch (requestError) {
      const fallback = /overlap/i.test(String(requestError?.response?.data?.error?.message || ''))
        ? 'Khoảng điểm này chồng lấn với một quy tắc đang hoạt động.'
        : 'Không lưu được quy tắc xếp mức'
      setError(getApiMessage(requestError, fallback))
      throw requestError
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(rule) {
    if (!window.confirm(`Xóa quy tắc ${rule.label || rule.code}?`)) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await deleteAssessmentPlacementRule(rule.id)
      await loadRules()
      setSuccess('Đã xóa quy tắc xếp mức')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không xóa được quy tắc xếp mức'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}
      <CCard className='ai-card'>
        <CCardHeader className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
          <div>
            <strong>Quy tắc xếp mức</strong>
            <div className='small text-body-secondary'>Quản lý band sơ bộ theo Assessment Version hiện tại.</div>
            {versionStatus && versionStatus !== 'draft' ? <div className='small text-body-secondary'>Phiên bản đã phát hành vẫn có thể cấu hình quy tắc xếp mức nếu backend cho phép.</div> : null}
          </div>
          <CButton color='primary' onClick={openCreateEditor} disabled={saving}>+ Thêm quy tắc</CButton>
        </CCardHeader>
        <CCardBody>
          {!versionId ? <div className='text-body-secondary'>Không xác định được phiên bản đề hiện tại.</div> : loading ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' /><span>Đang tải quy tắc xếp mức...</span></div> : rows.length === 0 ? <div className='text-body-secondary'>Phiên bản này chưa có quy tắc xếp mức.</div> : (
            <CTable responsive hover align='middle'>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Order</CTableHeaderCell>
                  <CTableHeaderCell>Label</CTableHeaderCell>
                  <CTableHeaderCell>Rule type</CTableHeaderCell>
                  <CTableHeaderCell>Score basis</CTableHeaderCell>
                  <CTableHeaderCell>Range</CTableHeaderCell>
                  <CTableHeaderCell>Level</CTableHeaderCell>
                  <CTableHeaderCell>Status</CTableHeaderCell>
                  <CTableHeaderCell>Actions</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {rows.map((rule) => (
                  <CTableRow key={rule.id}>
                    <CTableDataCell>{rule.order}</CTableDataCell>
                    <CTableDataCell><div className='fw-semibold'>{rule.label}</div><div className='small text-body-secondary'>{rule.code}</div></CTableDataCell>
                    <CTableDataCell>{rule.ruleType}</CTableDataCell>
                    <CTableDataCell>{rule.scoreBasis}</CTableDataCell>
                    <CTableDataCell>{renderRange(rule)}</CTableDataCell>
                    <CTableDataCell>{getCefrLabel(rule.level)}</CTableDataCell>
                    <CTableDataCell><CBadge color={rule.status === 'active' ? 'success' : 'secondary'}>{rule.status === 'active' ? 'Hoạt động' : 'Ngưng dùng'}</CBadge></CTableDataCell>
                    <CTableDataCell>
                      <div className='d-flex gap-2 flex-wrap'>
                        <CButton size='sm' color='secondary' variant='outline' disabled={saving} onClick={() => openEditEditor(rule)}>Sửa</CButton>
                        <CButton size='sm' color='danger' variant='outline' disabled={saving} onClick={() => handleDelete(rule)}>Xóa</CButton>
                      </div>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>
      <AssessmentPlacementRuleEditorModal visible={editorVisible} saving={saving} versionId={versionId} rule={editingRule} onClose={() => { if (!saving) { setEditorVisible(false); setEditingRule(null) } }} onSubmit={handleSubmit} />
    </>
  )
}