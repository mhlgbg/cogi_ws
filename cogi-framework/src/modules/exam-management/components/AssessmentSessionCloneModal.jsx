import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
  CFormInput,
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
} from '@coreui/react'

function buildPreviewRows(sourceSession, count) {
  if (!sourceSession || !sourceSession.subject || !sourceSession.slot) {
    return []
  }

  const subjectCode = String(sourceSession.subject.code || sourceSession.subject.title || sourceSession.subject.name || 'SUBJECT').trim() || 'SUBJECT'
  const slotCode = String(sourceSession.slot.code || sourceSession.slot.name || 'SLOT').trim() || 'SLOT'
  const rows = []
  const limit = Math.max(1, Math.min(10, Number(count) || 1))

  for (let index = 0; index < limit; index += 1) {
    const codeNumber = index + 1
    rows.push({
      code: `PT${String(codeNumber).padStart(3, '0')}`,
      name: `${subjectCode}-${slotCode}-PT${String(index + 1).padStart(2, '0')}`,
    })
  }

  return rows
}

export default function AssessmentSessionCloneModal({
  visible,
  sourceSession,
  saving = false,
  onClose,
  onClone,
}) {
  const [count, setCount] = useState(1)

  useEffect(() => {
    if (visible) {
      setCount(1)
    }
  }, [visible, sourceSession?.id, sourceSession?.documentId])

  const rows = useMemo(() => buildPreviewRows(sourceSession, count), [sourceSession, count])

  return (
    <CModal visible={visible} onClose={onClose} alignment='center' size='lg'>
      <CModalHeader>
        <CModalTitle>Nhân bản phiên thi</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {sourceSession ? (
          <div className='mb-3'>
            <div className='small text-medium-emphasis'>Phiên nguồn</div>
            <div className='fw-semibold'>{sourceSession.code || '—'} — {sourceSession.name || '—'}</div>
            <div className='small text-medium-emphasis mt-2'>Ca thi: {sourceSession.slot?.code || sourceSession.slot?.name || '—'}</div>
            <div className='small text-medium-emphasis'>Môn thi: {sourceSession.subject?.code || sourceSession.subject?.title || sourceSession.subject?.name || '—'}</div>
            <div className='small text-medium-emphasis'>Thời lượng: {sourceSession.durationMinutes || '—'} phút</div>
          </div>
        ) : null}

        <CRow className='g-3 align-items-end'>
          <CCol md={6}>
            <CFormLabel htmlFor='clone-session-count'>Số phiên cần nhân bản</CFormLabel>
            <CFormInput
              id='clone-session-count'
              type='number'
              min={1}
              max={10}
              step={1}
              value={count}
              onChange={(event) => {
                const nextValue = Number(event.target.value)
                if (Number.isNaN(nextValue)) {
                  setCount(1)
                  return
                }
                setCount(Math.min(10, Math.max(1, nextValue)))
              }}
            />
          </CCol>
        </CRow>

        <div className='mt-4'>
          <div className='small text-medium-emphasis mb-2'>Xem trước phiên dự kiến</div>
          <ul className='mb-0 ps-3'>
            {rows.map((row, index) => (
              <li key={`${row.code}-${index}`} className='mb-1'>
                <span className='fw-semibold'>{row.code}</span> — {row.name}
              </li>
            ))}
          </ul>
        </div>

        {!sourceSession ? <CAlert color='danger' className='mt-3 mb-0'>Không có phiên để nhân bản.</CAlert> : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose} disabled={saving}>Hủy</CButton>
        <CButton color='primary' onClick={() => onClone?.(count)} disabled={saving || !sourceSession}>
          {saving ? 'Đang nhân bản...' : `Nhân bản ${count} phiên`}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}
