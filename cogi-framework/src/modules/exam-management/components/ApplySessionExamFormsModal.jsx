import { useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

function getDecisionColor(decision) {
  const value = String(decision || '').toUpperCase()
  if (value === 'APPLY') return 'success'
  if (value === 'SKIP') return 'secondary'
  if (value === 'REPLACE') return 'warning'
  if (value === 'BLOCKED') return 'danger'
  return 'light'
}

function getDecisionLabel(decision) {
  const value = String(decision || '').toUpperCase()
  if (value === 'APPLY') return 'APPLY'
  if (value === 'SKIP') return 'SKIP'
  if (value === 'REPLACE') return 'REPLACE'
  if (value === 'BLOCKED') return 'BLOCKED'
  return value || '—'
}

function formatStatusLabel(value) {
  const status = String(value || '').toLowerCase()
  const map = {
    draft: 'Nháp',
    ready: 'Sẵn sàng',
    active: 'Đang diễn ra',
    ended: 'Đã kết thúc',
    finalized: 'Đã hoàn tất',
  }
  return map[status] || status || '—'
}

export default function ApplySessionExamFormsModal({
  visible,
  sourceSession,
  sourceForms = [],
  targetSessions = [],
  previewData = null,
  confirmData = null,
  loadingTargets = false,
  previewing = false,
  confirming = false,
  onClose,
  onPreview,
  onConfirm,
}) {
  const [selectedIds, setSelectedIds] = useState([])
  const [searchText, setSearchText] = useState('')
  const [subjectFilter, setSubjectFilter] = useState('')
  const [confirmedReplaceIds, setConfirmedReplaceIds] = useState([])

  const subjectOptions = useMemo(() => {
    const map = new Map()
    for (const session of targetSessions || []) {
      const id = String(session?.subject?.id || session?.subject?.documentId || '')
      if (!id) continue
      map.set(id, {
        value: id,
        label: session?.subject?.code
          ? `${session.subject.code} - ${session.subject.name || session.subject.title || ''}`
          : (session?.subject?.name || session?.subject?.title || id),
      })
    }
    return Array.from(map.values())
  }, [targetSessions])

  const filteredTargetSessions = useMemo(() => {
    const keyword = String(searchText || '').trim().toLocaleLowerCase('vi-VN')
    return (targetSessions || []).filter((session) => {
      if (!session?.id || Number(session.id) === Number(sourceSession?.id)) return false
      const subjectId = String(session?.subject?.id || session?.subject?.documentId || '')
      if (subjectFilter && subjectFilter !== subjectId) return false
      if (!keyword) return true
      const code = String(session?.code || '').toLocaleLowerCase('vi-VN')
      const name = String(session?.name || '').toLocaleLowerCase('vi-VN')
      return code.includes(keyword) || name.includes(keyword)
    })
  }, [targetSessions, sourceSession?.id, searchText, subjectFilter])

  const replaceRows = useMemo(() => {
    return (previewData?.targets || []).filter((item) => String(item?.decision || '').toUpperCase() === 'REPLACE')
  }, [previewData])

  const actionableRows = useMemo(() => {
    return (previewData?.targets || []).filter((item) => {
      const decision = String(item?.decision || '').toUpperCase()
      return decision === 'APPLY' || decision === 'REPLACE'
    })
  }, [previewData])

  const allReplaceConfirmed = replaceRows.every((item) => confirmedReplaceIds.includes(Number(item.targetSessionId)))

  function toggleSelected(id, checked) {
    setSelectedIds((current) => {
      const set = new Set(current.map((value) => Number(value)))
      if (checked) set.add(Number(id))
      else set.delete(Number(id))
      return Array.from(set)
    })
  }

  function selectAllFiltered() {
    setSelectedIds(Array.from(new Set(filteredTargetSessions.map((item) => Number(item.id)))))
  }

  function clearSelected() {
    setSelectedIds([])
  }

  async function handlePreview() {
    await onPreview?.(selectedIds)
  }

  async function handleConfirm() {
    if (!previewData?.previewToken) return
    await onConfirm?.({
      previewToken: previewData.previewToken,
      confirmedReplaceSessionIds: confirmedReplaceIds,
    })
  }

  return (
    <CModal visible={visible} onClose={onClose} size='xl' alignment='center'>
      <CModalHeader>
        <CModalTitle>Áp dụng bộ đề cho phiên khác</CModalTitle>
      </CModalHeader>
      <CModalBody className='d-flex flex-column gap-3'>
        <div className='border rounded p-3'>
          <div className='fw-semibold mb-2'>Phiên nguồn</div>
          <div><strong>Mã phiên:</strong> {sourceSession?.code || '—'}</div>
          <div><strong>Tên phiên:</strong> {sourceSession?.name || '—'}</div>
          <div><strong>Đợt thi:</strong> {sourceSession?.campaign?.name || sourceSession?.campaign?.code || '—'}</div>
          <div><strong>Môn thi:</strong> {sourceSession?.subject?.name || sourceSession?.subject?.title || sourceSession?.subject?.code || '—'}</div>
          <div className='mt-2'><strong>Bộ đề hiện tại:</strong></div>
          <ul className='mb-0'>
            {(sourceForms || []).map((form) => (
              <li key={form.id || `${form.assessmentVersionId}-${form.code}`}>
                {(form.code || '—')} - {(form.title || 'Đề thi')} ({Number(form.questionCount || 0)} câu, {Number(form.totalPoints || 0)} điểm)
              </li>
            ))}
          </ul>
        </div>

        <div className='border rounded p-3'>
          <div className='fw-semibold mb-2'>Phiên đích</div>
          <div className='row g-2 mb-3'>
            <div className='col-md-6'>
              <CFormLabel>Tìm kiếm mã/tên phiên</CFormLabel>
              <CFormInput value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder='VD: PT004' />
            </div>
            <div className='col-md-4'>
              <CFormLabel>Lọc theo môn thi</CFormLabel>
              <CFormSelect value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
                <option value=''>Tất cả môn thi</option>
                {subjectOptions.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </CFormSelect>
            </div>
            <div className='col-md-2 d-flex align-items-end'>
              <div className='d-flex gap-2 flex-wrap'>
                <CButton size='sm' color='secondary' variant='outline' onClick={selectAllFiltered}>Chọn tất cả</CButton>
                <CButton size='sm' color='secondary' variant='outline' onClick={clearSelected}>Bỏ chọn</CButton>
              </div>
            </div>
          </div>

          {loadingTargets ? <div>Đang tải danh sách phiên đích...</div> : null}
          {!loadingTargets && filteredTargetSessions.length === 0 ? (
            <CAlert color='info' className='mb-0'>Không có phiên đích phù hợp.</CAlert>
          ) : null}
          {!loadingTargets && filteredTargetSessions.length > 0 ? (
            <CTable responsive hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell />
                  <CTableHeaderCell>Mã phiên</CTableHeaderCell>
                  <CTableHeaderCell>Tên phiên</CTableHeaderCell>
                  <CTableHeaderCell>Môn thi</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {filteredTargetSessions.map((session) => (
                  <CTableRow key={session.id}>
                    <CTableDataCell>
                      <CFormCheck
                        checked={selectedIds.includes(Number(session.id))}
                        onChange={(event) => toggleSelected(session.id, event.target.checked)}
                      />
                    </CTableDataCell>
                    <CTableDataCell>{session.code || '—'}</CTableDataCell>
                    <CTableDataCell>{session.name || '—'}</CTableDataCell>
                    <CTableDataCell>{session.subject?.name || session.subject?.title || session.subject?.code || '—'}</CTableDataCell>
                    <CTableDataCell>{formatStatusLabel(session.status)}</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          ) : null}
        </div>

        {previewData ? (
          <div className='border rounded p-3'>
            <div className='fw-semibold mb-2'>Kết quả preview</div>
            <div className='small mb-2'>
              APPLY: {previewData?.summary?.apply || 0} · SKIP: {previewData?.summary?.skip || 0} · REPLACE: {previewData?.summary?.replace || 0} · BLOCKED: {previewData?.summary?.blocked || 0}
            </div>
            <CTable responsive hover>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Phiên</CTableHeaderCell>
                  <CTableHeaderCell>Trạng thái</CTableHeaderCell>
                  <CTableHeaderCell>Số đề hiện có</CTableHeaderCell>
                  <CTableHeaderCell>Thay đổi</CTableHeaderCell>
                  <CTableHeaderCell>Lý do</CTableHeaderCell>
                  <CTableHeaderCell>Xác nhận REPLACE</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {(previewData.targets || []).map((item) => {
                  const isReplace = String(item?.decision || '').toUpperCase() === 'REPLACE'
                  return (
                    <CTableRow key={`${item.targetSessionId}-${item.decision}`}>
                      <CTableDataCell>
                        <div>{item?.session?.code || `#${item.targetSessionId}`}</div>
                        <div className='small text-body-secondary'>{item?.session?.name || ''}</div>
                      </CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={getDecisionColor(item?.decision)}>{getDecisionLabel(item?.decision)}</CBadge>
                      </CTableDataCell>
                      <CTableDataCell>{Number(item?.currentFormCount || 0)}</CTableDataCell>
                      <CTableDataCell>
                        +{Number(item?.change?.addCount || 0)} / -{Number(item?.change?.removeCount || 0)}
                      </CTableDataCell>
                      <CTableDataCell>{(item?.reasons || []).join('; ') || '—'}</CTableDataCell>
                      <CTableDataCell>
                        {isReplace ? (
                          <CFormCheck
                            label='Tôi xác nhận thay thế'
                            checked={confirmedReplaceIds.includes(Number(item.targetSessionId))}
                            onChange={(event) => {
                              const checked = event.target.checked
                              const targetId = Number(item.targetSessionId)
                              setConfirmedReplaceIds((current) => {
                                const set = new Set(current.map((id) => Number(id)))
                                if (checked) set.add(targetId)
                                else set.delete(targetId)
                                return Array.from(set)
                              })
                            }}
                          />
                        ) : <span className='text-body-secondary'>—</span>}
                      </CTableDataCell>
                    </CTableRow>
                  )
                })}
              </CTableBody>
            </CTable>
          </div>
        ) : null}

        {confirmData ? (
          <CAlert color='info' className='mb-0'>
            Kết quả confirm — Áp dụng: {confirmData?.summary?.applied || 0}, Thay thế: {confirmData?.summary?.replaced || 0}, Bỏ qua: {confirmData?.summary?.skipped || 0}, Chặn: {confirmData?.summary?.blocked || 0}, Lỗi: {confirmData?.summary?.failed || 0}
          </CAlert>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={previewing || confirming}>Đóng</CButton>
        <CButton color='secondary' onClick={handlePreview} disabled={previewing || confirming || selectedIds.length === 0}>
          {previewing ? 'Đang preview...' : 'Preview'}
        </CButton>
        <CButton
          color='primary'
          onClick={handleConfirm}
          disabled={confirming || previewing || !previewData?.previewToken || actionableRows.length === 0 || !allReplaceConfirmed}
        >
          {confirming ? 'Đang áp dụng...' : 'Xác nhận áp dụng'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}
