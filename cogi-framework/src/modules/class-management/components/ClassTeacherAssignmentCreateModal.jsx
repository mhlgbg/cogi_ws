import { useEffect, useState } from 'react'
import {
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CFormSwitch,
} from '@coreui/react'
import { getClassFormOptions, createClassTeacherAssignment, updateClassTeacherAssignment } from '../services/classService'

export default function ClassTeacherAssignmentCreateModal({ show, classId, onClose, onSuccess, existingRows = [], assignment = null }) {
  const [teachers, setTeachers] = useState([])
  const [loadingTeachers, setLoadingTeachers] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [teacherId, setTeacherId] = useState('')
  const [subject, setSubject] = useState('')
  const [subjectCode, setSubjectCode] = useState('')
  const [role, setRole] = useState('co_teacher')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isPayable, setIsPayable] = useState(true)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!show) return
    let cancelled = false
    async function load() {
      setLoadingTeachers(true)
      try {
        const opts = await getClassFormOptions()
        if (!cancelled) setTeachers(Array.isArray(opts) ? opts : [])
      } catch {
        if (!cancelled) setTeachers([])
      } finally {
        if (!cancelled) setLoadingTeachers(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [show])

  useEffect(() => {
    if (!show) {
      // reset form
      setTeacherId('')
      setSubject('')
      setSubjectCode('')
      setRole('co_teacher')
      setStartDate('')
      setEndDate('')
      setIsPayable(true)
      setNote('')
      setError('')
    } else {
      // if editing, populate
      if (assignment && typeof assignment === 'object') {
        setTeacherId(String(assignment.teacher?.id || assignment.teacher || ''))
        setSubject(assignment.subject || '')
        setSubjectCode(assignment.subjectCode || '')
        setRole(assignment.role || 'co_teacher')
        setStartDate(assignment.startDate || '')
        setEndDate(assignment.endDate || '')
        setIsPayable(Boolean(assignment.isPayable))
        setNote(assignment.note || '')
        setError('')
      }
    }
  }, [show])

  function validate() {
    if (!String(teacherId || '').trim()) {
      setError('Bạn cần chọn giáo viên')
      return false
    }

    if (startDate && endDate) {
      const s = new Date(startDate).getTime()
      const e = new Date(endDate).getTime()
      if (!Number.isNaN(s) && !Number.isNaN(e) && e < s) {
        setError('Ngày kết thúc không được nhỏ hơn ngày bắt đầu')
        return false
      }
    }

    // check duplicate in existingRows: same class (implicit), same teacher, same role, active
    const dup = (existingRows || []).some((r) => {
      // when editing, skip the current assignment id
      if (assignment && r && String(r.id || '') === String(assignment.id || '')) return false
      return r.teacher && String(r.teacher.id || r.teacher) === String(teacherId) && String(r.role || '') === String(role || '') && String(r.assignmentStatus || 'active') === 'active'
    })

    if (dup) {
      setError('Giáo viên này đã có một phân công đang hoạt động với cùng vai trò trong lớp.')
      return false
    }

    setError('')
    return true
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      const payload = {
        teacher: Number(teacherId),
        subject: String(subject || '').trim() || null,
        subjectCode: String(subjectCode || '').trim() || null,
        role: String(role || 'co_teacher'),
        startDate: startDate || null,
        endDate: endDate || null,
        assignmentStatus: 'active',
        isPayable: Boolean(isPayable),
        note: String(note || '').trim() || null,
      }

      if (assignment && assignment.id) {
        // update
        const updated = await updateClassTeacherAssignment(classId, assignment.id, payload)
        if (onSuccess) onSuccess(updated)
        if (onClose) onClose()
      } else {
        const created = await createClassTeacherAssignment(classId, payload)
        if (onSuccess) onSuccess(created)
        if (onClose) onClose()
      }
    } catch (err) {
      const msg = err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Không thể thêm phân công chuyên môn.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CModal visible={!!show} onClose={onClose} alignment="center">
      <CModalHeader>
        <CModalTitle>Thêm phân công</CModalTitle>
      </CModalHeader>
      <CForm onSubmit={handleSave}>
        <CModalBody>
          {error && <div className='text-danger mb-2'>{error}</div>}

          <div className='mb-3'>
            <CFormLabel>Giáo viên *</CFormLabel>
            <CFormSelect value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
              <option value=''>-- Chọn giáo viên --</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.label || t.fullName || t.username || t.email || `User #${t.id}`}</option>
              ))}
            </CFormSelect>
          </div>

          <div className='mb-3'>
            <CFormLabel>Chuyên môn</CFormLabel>
            <CFormInput value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className='mb-3'>
            <CFormLabel>Mã chuyên môn</CFormLabel>
            <CFormInput value={subjectCode} onChange={(e) => setSubjectCode(e.target.value)} />
          </div>

          <div className='mb-3'>
            <CFormLabel>Vai trò</CFormLabel>
            <CFormSelect value={role} onChange={(e) => setRole(e.target.value)}>
              <option value='main'>Phụ trách</option>
              <option value='co_teacher'>Đồng giảng</option>
              <option value='assistant'>Trợ giảng</option>
              <option value='substitute'>Dạy thay</option>
            </CFormSelect>
          </div>

          <div className='mb-3'>
            <CFormLabel>Ngày bắt đầu</CFormLabel>
            <CFormInput type='date' value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div className='mb-3'>
            <CFormLabel>Ngày kết thúc</CFormLabel>
            <CFormInput type='date' value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <div className='mb-3 d-flex align-items-center'>
            <CFormSwitch id='isPayable' checked={!!isPayable} onChange={(e) => setIsPayable(e.target.checked)} />
            <CFormLabel htmlFor='isPayable' className='mb-0 ms-2'>Được tính công</CFormLabel>
          </div>

          <div className='mb-3'>
            <CFormLabel>Ghi chú</CFormLabel>
            <CFormTextarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
        </CModalBody>

        <CModalFooter>
          <CButton color='secondary' onClick={onClose} disabled={submitting}>Hủy</CButton>
          <CButton color='primary' type='submit' disabled={submitting}>{submitting ? 'Đang lưu...' : 'Lưu phân công'}</CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}
