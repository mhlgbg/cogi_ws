import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import { createSurveyAssignment } from '../services/surveyCampaignService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

const INITIAL_FORM = {
  contextType: 'COURSE_LECTURER',
  studentCode: '',
  courseId: '',
  courseName: '',
  classSectionId: '',
  lecturerId: '',
  lecturerName: '',
}

export default function CreateAssignmentModal({
  visible,
  campaignId,
  campaignName,
  onClose,
  onSuccess,
}) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!visible) {
      setForm(INITIAL_FORM)
      setSubmitting(false)
      setError('')
    }
  }, [visible])

  const isCourseLecturer = form.contextType === 'COURSE_LECTURER'
  const canSubmit = useMemo(
    () => Boolean(campaignId) && Boolean(String(form.studentCode || '').trim()) && !submitting,
    [campaignId, form.studentCode, submitting],
  )

  function setField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit() {
    if (!campaignId) return

    setSubmitting(true)
    setError('')

    try {
      const payload = {
        campaignId,
        contextType: form.contextType,
        studentCode: String(form.studentCode || '').trim(),
        courseId: isCourseLecturer ? String(form.courseId || '').trim() : '',
        courseName: isCourseLecturer ? String(form.courseName || '').trim() : '',
        classSectionId: isCourseLecturer ? String(form.classSectionId || '').trim() : '',
        lecturerId: isCourseLecturer ? String(form.lecturerId || '').trim() : '',
        lecturerName: isCourseLecturer ? String(form.lecturerName || '').trim() : '',
      }

      const response = await createSurveyAssignment(payload)
      onSuccess?.(response)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể thêm assignment'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CModal visible={visible} backdrop='static' size='lg' onClose={() => !submitting && onClose?.()}>
      <CModalHeader>
        <CModalTitle>Thêm assignment {campaignName ? `- ${campaignName}` : ''}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <CRow className='g-3'>
          <CCol md={6}>
            <CFormLabel htmlFor='create-assignment-context'>Context type</CFormLabel>
            <CFormSelect
              id='create-assignment-context'
              value={form.contextType}
              onChange={(event) => setField('contextType', event.target.value)}
              disabled={submitting}
            >
              <option value='COURSE_LECTURER'>COURSE_LECTURER</option>
              <option value='GRADUATION_EXIT'>GRADUATION_EXIT</option>
            </CFormSelect>
          </CCol>
          <CCol md={6}>
            <CFormLabel htmlFor='create-assignment-student-code'>Mã sinh viên</CFormLabel>
            <CFormInput
              id='create-assignment-student-code'
              value={form.studentCode}
              onChange={(event) => setField('studentCode', event.target.value)}
              disabled={submitting}
              placeholder='Nhập mã sinh viên'
            />
          </CCol>

          {isCourseLecturer ? (
            <>
              <CCol md={6}>
                <CFormLabel htmlFor='create-assignment-course-id'>courseId</CFormLabel>
                <CFormInput
                  id='create-assignment-course-id'
                  value={form.courseId}
                  onChange={(event) => setField('courseId', event.target.value)}
                  disabled={submitting}
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel htmlFor='create-assignment-course-name'>courseName</CFormLabel>
                <CFormInput
                  id='create-assignment-course-name'
                  value={form.courseName}
                  onChange={(event) => setField('courseName', event.target.value)}
                  disabled={submitting}
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel htmlFor='create-assignment-class-section-id'>classSectionId</CFormLabel>
                <CFormInput
                  id='create-assignment-class-section-id'
                  value={form.classSectionId}
                  onChange={(event) => setField('classSectionId', event.target.value)}
                  disabled={submitting}
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel htmlFor='create-assignment-lecturer-id'>lecturerId</CFormLabel>
                <CFormInput
                  id='create-assignment-lecturer-id'
                  value={form.lecturerId}
                  onChange={(event) => setField('lecturerId', event.target.value)}
                  disabled={submitting}
                />
              </CCol>
              <CCol md={12}>
                <CFormLabel htmlFor='create-assignment-lecturer-name'>lecturerName</CFormLabel>
                <CFormInput
                  id='create-assignment-lecturer-name'
                  value={form.lecturerName}
                  onChange={(event) => setField('lecturerName', event.target.value)}
                  disabled={submitting}
                />
              </CCol>
            </>
          ) : null}
        </CRow>

        {error ? <CAlert color='danger' className='mt-3 mb-0'>{error}</CAlert> : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={submitting}>
          Hủy
        </CButton>
        <CButton color='primary' onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <CSpinner size='sm' />
              Đang thêm...
            </span>
          ) : 'Thêm mới'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}