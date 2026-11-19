import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'

function getVersionStatusLabel(value) {
  const status = String(value || '').trim().toLowerCase()
  const labels = {
    draft: 'Bản nháp',
    published: 'Đã xuất bản',
    retired: 'Ngừng sử dụng',
    ready: 'Sẵn sàng',
    locked: 'Đã khóa',
    finalized: 'Đã chốt',
  }
  return labels[status] || (value ? String(value) : 'Không xác định')
}

function unwrapRelationValue(value) {
  if (!value) return value
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value[0] || null
  if (value.data && typeof value.data === 'object') return value.data
  return value
}

function getEntityId(value) {
  const normalized = unwrapRelationValue(value)
  if (!normalized) return ''
  if (typeof normalized === 'string' || typeof normalized === 'number') return String(normalized)
  if (typeof normalized === 'object') return String(normalized.documentId || normalized.id || '')
  return String(normalized)
}

function entityMatches(left, right) {
  const leftSet = new Set()
  const rightSet = new Set()

  const collect = (record, target) => {
    if (!record) return
    const normalized = unwrapRelationValue(record)
    if (typeof normalized === 'string' || typeof normalized === 'number') {
      target.add(String(normalized))
      return
    }
    if (normalized && typeof normalized === 'object') {
      if (normalized.id != null) target.add(String(normalized.id))
      if (normalized.documentId) target.add(String(normalized.documentId))
    }
  }

  collect(left, leftSet)
  collect(right, rightSet)

  for (const value of leftSet) {
    if (rightSet.has(value)) return true
  }
  return false
}

export default function SessionExamFormModal({
  visible,
  session,
  assessments = [],
  versions = [],
  usedVersionDocumentIds = [],
  saving = false,
  onClose,
  onSubmit,
}) {
  const [selectedAssessment, setSelectedAssessment] = useState('')
  const [selectedVersion, setSelectedVersion] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) {
      setSelectedAssessment('')
      setSelectedVersion('')
      setError('')
      return
    }

    setSelectedAssessment('')
    setSelectedVersion('')
    setError('')
  }, [visible])

  const usedVersionDocumentIdSet = useMemo(() => {
    return new Set(
      (Array.isArray(usedVersionDocumentIds) ? usedVersionDocumentIds : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    )
  }, [usedVersionDocumentIds])

  const filteredVersions = useMemo(() => {
    if (!selectedAssessment) return []
    return versions.filter((item) => {
      const matchesAssessment = entityMatches(item.assessment, selectedAssessment)
      if (!matchesAssessment) return false
      const versionDocumentId = String(unwrapRelationValue(item)?.documentId || '').trim()
      if (!versionDocumentId) return true
      return !usedVersionDocumentIdSet.has(versionDocumentId)
    })
  }, [selectedAssessment, versions, usedVersionDocumentIdSet])

  const totalVersionsForSelectedAssessment = useMemo(() => {
    if (!selectedAssessment) return 0
    return versions.filter((item) => entityMatches(item.assessment, selectedAssessment)).length
  }, [selectedAssessment, versions])

  const versionEligibility = useMemo(() => {
    const map = new Map()
    for (const item of filteredVersions) {
      const key = String(getEntityId(item.id || item.documentId || item))
      const status = String(item?.versionStatus || '').toLowerCase()
      const eligible = status !== 'retired'
      const reason = eligible
        ? ''
        : `Không thể chọn vì trạng thái hiện tại là "${getVersionStatusLabel(item?.versionStatus || 'retired')}".`
      map.set(key, { eligible, reason })
    }
    return map
  }, [filteredVersions])

  const selectedVersionMeta = useMemo(() => {
    if (!selectedVersion) return null
    return versions.find((item) => String(getEntityId(item.id || item.documentId || item)) === String(getEntityId(selectedVersion)) || entityMatches(item, selectedVersion)) || null
  }, [selectedVersion, versions])

  async function handleSubmit() {
    if (!selectedAssessment) {
      setError('Vui lòng chọn đề thi')
      return
    }
    if (!selectedVersion) {
      setError('Vui lòng chọn Assessment Version')
      return
    }

    const selectedEligibility = versionEligibility.get(String(selectedVersion))
    if (selectedEligibility && !selectedEligibility.eligible) {
      setError(selectedEligibility.reason || 'Assessment Version chưa đủ điều kiện sử dụng')
      return
    }

    setError('')
    await onSubmit?.({ assessment: selectedAssessment, assessmentVersion: selectedVersion })
  }

  return (
    <CModal visible={visible} onClose={onClose} alignment='center' size='lg'>
      <CModalHeader>
        <CModalTitle>Thêm đề thi</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CRow className='g-3'>
          <CCol md={12}>
            <CFormLabel>Môn học</CFormLabel>
            <div className='form-control-plaintext border rounded px-3 py-2'>
              {session?.subject?.code ? `${session.subject.code} - ${session.subject.title || session.subject.name || ''}` : '-'}
            </div>
          </CCol>

          <CCol md={6}>
            <CFormLabel>Assessment</CFormLabel>
            <CFormSelect value={selectedAssessment} onChange={(event) => {
              setSelectedAssessment(event.target.value)
              setSelectedVersion('')
            }}>
              <option value=''>-- Chọn đề thi --</option>
              {assessments.map((item) => (
                <option key={getEntityId(item.id || item.documentId || item)} value={getEntityId(item.id || item.documentId || item)}>
                  {item.code ? `${item.code} - ${item.name || item.title || 'Assessment'}` : (item.name || item.title || 'Assessment')}
                </option>
              ))}
            </CFormSelect>
          </CCol>

          <CCol md={6}>
            <CFormLabel>Assessment Version</CFormLabel>
            <CFormSelect value={selectedVersion} onChange={(event) => setSelectedVersion(event.target.value)} disabled={!selectedAssessment}>
              <option value=''>-- Chọn version --</option>
              {filteredVersions.map((item) => (
                <option
                  key={getEntityId(item.id || item.documentId || item)}
                  value={getEntityId(item.id || item.documentId || item)}
                  disabled={!versionEligibility.get(String(getEntityId(item.id || item.documentId || item)))?.eligible}
                >
                  {item.code
                    ? `${item.code} - ${item.title || 'Version'} (${getVersionStatusLabel(item.versionStatus)})`
                    : `${item.title || 'Version'} (${getVersionStatusLabel(item.versionStatus)})`}
                </option>
              ))}
            </CFormSelect>
            {selectedAssessment && filteredVersions.length === 0 ? (
              <div className='text-body-secondary small mt-1'>
                {totalVersionsForSelectedAssessment === 0
                  ? 'Assessment này chưa có Version.'
                  : 'Tất cả phiên bản đề của Assessment này đã được thêm vào phiên thi.'}
              </div>
            ) : null}
            {selectedAssessment && filteredVersions.some((item) => !versionEligibility.get(String(getEntityId(item.id || item.documentId || item)))?.eligible) ? (
              <div className='text-warning small mt-1'>Một số Version đã ngừng sử dụng nên không thể chọn.</div>
            ) : null}
          </CCol>
        </CRow>

        {selectedVersionMeta ? (
          <div className='mt-4 border rounded p-3 bg-light'>
            <div className='fw-semibold mb-2'>Xem trước đề</div>
            <div><strong>Mã đề:</strong> {selectedVersionMeta.code || '-'}</div>
            <div><strong>Tên:</strong> {selectedVersionMeta.title || '-'}</div>
            <div><strong>Thời lượng:</strong> {selectedVersionMeta.durationMinutes || 0} phút</div>
            <div><strong>Số câu:</strong> {selectedVersionMeta.questionCount || 0}</div>
            <div><strong>Trạng thái:</strong> {getVersionStatusLabel(selectedVersionMeta.versionStatus || 'draft')}</div>
            {!versionEligibility.get(String(selectedVersion))?.eligible ? (
              <div className='text-warning mt-1'>{versionEligibility.get(String(selectedVersion))?.reason}</div>
            ) : null}
          </div>
        ) : null}

        {error ? <CAlert color='danger' className='mt-3 mb-0'>{error}</CAlert> : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={saving}>Hủy</CButton>
        <CButton color='primary' onClick={handleSubmit} disabled={saving || !selectedAssessment || !selectedVersion}>
          {saving ? 'Đang lưu...' : 'Thêm đề'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}
