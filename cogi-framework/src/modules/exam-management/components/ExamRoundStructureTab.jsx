import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CRow,
} from '@coreui/react'
import ExamErrorAlert from './ExamErrorAlert'
import {
  buildExamRoundStructurePayload,
  canEditExamRound,
  getExamMethodLabel,
  getExamRoundConfigurationAccess,
  getExamRoundEditLockMessage,
  getSubjectCalculationMethodLabel,
  normalizeStatus,
} from '../utils/examRoundUi'

function buildSubjects(round) {
  return Array.isArray(round?.subjects)
    ? round.subjects.map((subject) => ({
        ...subject,
        components: Array.isArray(subject.components) ? subject.components.map((component) => ({ ...component })) : [],
      }))
    : []
}

export default function ExamRoundStructureTab({ round, permissions, saving = false, errorMessage = '', errorCode = '', errorDetails = [], onSave }) {
  const editable = canEditExamRound(round, permissions)
  const configurationAccess = getExamRoundConfigurationAccess(round)
  const lockMessage = getExamRoundEditLockMessage(round, permissions)
  const [subjects, setSubjects] = useState(() => buildSubjects(round))
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    setSubjects(buildSubjects(round))
    setLocalError('')
  }, [round])

  const summary = useMemo(() => {
    const activeSubjects = subjects.filter((subject) => normalizeStatus(subject.status) === 'active').length
    const componentCount = subjects.reduce((total, subject) => total + (Array.isArray(subject.components) ? subject.components.length : 0), 0)
    return {
      subjectCount: subjects.length,
      activeSubjects,
      componentCount,
    }
  }, [subjects])

  function updateSubject(subjectId, key, value) {
    setSubjects((current) => current.map((subject) => (subject.id === subjectId ? { ...subject, [key]: value } : subject)))
    setLocalError('')
  }

  function updateComponent(subjectId, componentId, key, value) {
    setSubjects((current) => current.map((subject) => {
      if (subject.id !== subjectId) return subject
      return {
        ...subject,
        components: subject.components.map((component) => (component.id === componentId ? { ...component, [key]: value } : component)),
      }
    }))
    setLocalError('')
  }

  async function handleSave() {
    if (!subjects.length) {
      setLocalError('Đợt thi hiện chưa có snapshot môn thi để cấu hình.')
      return
    }
    const payload = buildExamRoundStructurePayload({ ...round, subjects })
    await onSave?.(payload, 'Đã cập nhật tab Cấu trúc môn thi của đợt thi.')
  }

  return (
    <div className='d-flex flex-column gap-3'>
      <CCard>
        <CCardHeader><strong>Cấu trúc môn thi</strong></CCardHeader>
        <CCardBody>
          <CAlert color='info'>Tab này chỉnh snapshot môn và kỹ năng ngay trên đợt thi. Mọi thay đổi ở đây chỉ áp dụng cho đợt thi hiện tại.</CAlert>
          {editable && configurationAccess.message ? <CAlert color='warning'>{configurationAccess.message}</CAlert> : null}
          {editable && configurationAccess.warningMessage ? <CAlert color='warning'>{configurationAccess.warningMessage}</CAlert> : null}
          {!editable && lockMessage ? <CAlert color='warning'>{lockMessage}</CAlert> : null}
          {localError ? <CAlert color='danger'>{localError}</CAlert> : null}
          <ExamErrorAlert message={errorMessage} code={errorCode} details={errorDetails} />
          <CRow className='g-3'>
            <CCol md={4}><div className='small text-body-secondary'>Số môn snapshot</div><div className='fw-semibold'>{summary.subjectCount}</div></CCol>
            <CCol md={4}><div className='small text-body-secondary'>Môn đang active</div><div className='fw-semibold'>{summary.activeSubjects}</div></CCol>
            <CCol md={4}><div className='small text-body-secondary'>Tổng kỹ năng/phần thi</div><div className='fw-semibold'>{summary.componentCount}</div></CCol>
          </CRow>
        </CCardBody>
      </CCard>

      {subjects.map((subject, subjectIndex) => (
        <CCard key={subject.id}>
          <CCardHeader>
            <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
              <div>
                <strong>{subjectIndex + 1}. {subject.nameSnapshot || `Môn #${subject.id}`}</strong>
                <div className='small text-body-secondary'>Phương thức kết quả: {getSubjectCalculationMethodLabel(subject.calculationMethodSnapshot)}</div>
              </div>
              <div className='small text-body-secondary'>{Array.isArray(subject.components) ? `${subject.components.length} kỹ năng/phần thi` : '0 kỹ năng/phần thi'}</div>
            </div>
          </CCardHeader>
          <CCardBody>
            <CRow className='g-3 mb-3'>
              <CCol lg={2} md={4}>
                <CFormLabel>Trạng thái</CFormLabel>
                <CFormSelect value={subject.status} onChange={(event) => updateSubject(subject.id, 'status', event.target.value)} disabled={!editable || saving}>
                  <option value='active'>Active</option>
                  <option value='inactive'>Inactive</option>
                </CFormSelect>
              </CCol>
              <CCol lg={2} md={4}>
                <CFormLabel>Thứ tự</CFormLabel>
                <CFormInput type='number' value={subject.displayOrder ?? ''} onChange={(event) => updateSubject(subject.id, 'displayOrder', event.target.value)} disabled={!editable || saving} />
              </CCol>
              <CCol lg={2} md={4}>
                <CFormLabel>Lệ phí</CFormLabel>
                <CFormInput value={subject.fee ?? ''} onChange={(event) => updateSubject(subject.id, 'fee', event.target.value)} disabled={!editable || saving} placeholder='Để trống nếu không áp dụng' />
              </CCol>
              <CCol lg={3} md={6}>
                <CFormLabel>Phương thức tính kết quả</CFormLabel>
                <CFormSelect value={subject.calculationMethodSnapshot} onChange={(event) => updateSubject(subject.id, 'calculationMethodSnapshot', event.target.value)} disabled={!editable || saving}>
                  <option value='total'>Tổng điểm</option>
                  <option value='average'>Trung bình</option>
                  <option value='all_components_pass'>Tất cả kỹ năng phải đạt</option>
                  <option value='custom'>Theo mô tả riêng</option>
                </CFormSelect>
              </CCol>
              <CCol lg={3} md={6}>
                <CFormLabel>Điểm tổng hợp yêu cầu</CFormLabel>
                <CFormInput value={subject.requiredAggregateScoreSnapshot ?? ''} onChange={(event) => updateSubject(subject.id, 'requiredAggregateScoreSnapshot', event.target.value)} disabled={!editable || saving} placeholder='Để trống nếu không áp dụng' />
              </CCol>
              <CCol md={4}><CFormCheck label='Môn bắt buộc' checked={subject.isRequired === true} onChange={(event) => updateSubject(subject.id, 'isRequired', event.target.checked)} disabled={!editable || saving} /></CCol>
              <CCol md={4}><CFormCheck label='Cho phép đăng ký riêng môn này' checked={subject.allowSeparateRegistration === true} onChange={(event) => updateSubject(subject.id, 'allowSeparateRegistration', event.target.checked)} disabled={!editable || saving} /></CCol>
              <CCol md={4}><CFormCheck label='Yêu cầu tất cả kỹ năng đạt' checked={subject.requireAllComponentsSnapshot === true} onChange={(event) => updateSubject(subject.id, 'requireAllComponentsSnapshot', event.target.checked)} disabled={!editable || saving} /></CCol>
              <CCol xs={12}>
                <CFormLabel>Mô tả quy tắc</CFormLabel>
                <CFormTextarea rows={3} value={subject.ruleDescriptionSnapshot || ''} onChange={(event) => updateSubject(subject.id, 'ruleDescriptionSnapshot', event.target.value)} disabled={!editable || saving} placeholder='Mô tả điều kiện đạt hoặc cách áp dụng môn thi này' />
              </CCol>
            </CRow>

            <div className='d-flex flex-column gap-3'>
              {Array.isArray(subject.components) && subject.components.length > 0 ? subject.components.map((component, componentIndex) => (
                <div key={component.id} className='border rounded p-3 bg-body-tertiary'>
                  <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
                    <div>
                      <div className='fw-semibold'>{subjectIndex + 1}.{componentIndex + 1} {component.nameSnapshot || `Kỹ năng #${component.id}`}</div>
                      <div className='small text-body-secondary'>Hình thức hiện tại: {getExamMethodLabel(component.examMethod)}</div>
                    </div>
                  </div>
                  <CRow className='g-3'>
                    <CCol lg={2} md={4}>
                      <CFormLabel>Trạng thái</CFormLabel>
                      <CFormSelect value={component.status} onChange={(event) => updateComponent(subject.id, component.id, 'status', event.target.value)} disabled={!editable || saving}>
                        <option value='active'>Active</option>
                        <option value='inactive'>Inactive</option>
                      </CFormSelect>
                    </CCol>
                    <CCol lg={2} md={4}>
                      <CFormLabel>Thứ tự</CFormLabel>
                      <CFormInput type='number' value={component.displayOrder ?? ''} onChange={(event) => updateComponent(subject.id, component.id, 'displayOrder', event.target.value)} disabled={!editable || saving} />
                    </CCol>
                    <CCol lg={2} md={4}>
                      <CFormLabel>Thời lượng</CFormLabel>
                      <CFormInput type='number' value={component.durationMinutes ?? ''} onChange={(event) => updateComponent(subject.id, component.id, 'durationMinutes', event.target.value)} disabled={!editable || saving} placeholder='Phút' />
                    </CCol>
                    <CCol lg={3} md={6}>
                      <CFormLabel>Hình thức thi</CFormLabel>
                      <CFormSelect value={component.examMethod} onChange={(event) => updateComponent(subject.id, component.id, 'examMethod', event.target.value)} disabled={!editable || saving}>
                        <option value='computer'>Máy tính</option>
                        <option value='paper'>Trên giấy</option>
                        <option value='oral'>Vấn đáp</option>
                        <option value='practical'>Thực hành</option>
                        <option value='mixed'>Kết hợp</option>
                        <option value='other'>Khác</option>
                      </CFormSelect>
                    </CCol>
                    <CCol lg={3} md={6}>
                      <CFormLabel>Mã external</CFormLabel>
                      <CFormInput value={component.externalExamCode || ''} onChange={(event) => updateComponent(subject.id, component.id, 'externalExamCode', event.target.value)} disabled={!editable || saving} placeholder='Mã đối soát nếu có' />
                    </CCol>
                    <CCol md={3}><CFormLabel>Lệ phí</CFormLabel><CFormInput value={component.fee ?? ''} onChange={(event) => updateComponent(subject.id, component.id, 'fee', event.target.value)} disabled={!editable || saving} /></CCol>
                    <CCol md={3}><CFormLabel>Điểm tối thiểu</CFormLabel><CFormInput value={component.minimumScoreSnapshot ?? ''} onChange={(event) => updateComponent(subject.id, component.id, 'minimumScoreSnapshot', event.target.value)} disabled={!editable || saving} /></CCol>
                    <CCol md={3}><CFormLabel>Điểm tối đa</CFormLabel><CFormInput value={component.maximumScoreSnapshot ?? ''} onChange={(event) => updateComponent(subject.id, component.id, 'maximumScoreSnapshot', event.target.value)} disabled={!editable || saving} /></CCol>
                    <CCol md={3}><CFormLabel>Điểm đạt</CFormLabel><CFormInput value={component.passingScoreSnapshot ?? ''} onChange={(event) => updateComponent(subject.id, component.id, 'passingScoreSnapshot', event.target.value)} disabled={!editable || saving} /></CCol>
                    <CCol md={3}><CFormLabel>Điểm liệt</CFormLabel><CFormInput value={component.eliminationScoreSnapshot ?? ''} onChange={(event) => updateComponent(subject.id, component.id, 'eliminationScoreSnapshot', event.target.value)} disabled={!editable || saving} /></CCol>
                    <CCol md={4}><CFormCheck label='Kỹ năng bắt buộc' checked={component.isRequired === true} onChange={(event) => updateComponent(subject.id, component.id, 'isRequired', event.target.checked)} disabled={!editable || saving} /></CCol>
                    <CCol md={5}><CFormCheck label='Cho phép learner đăng ký riêng kỹ năng này' checked={component.allowSeparateRegistration === true} onChange={(event) => updateComponent(subject.id, component.id, 'allowSeparateRegistration', event.target.checked)} disabled={!editable || saving} /></CCol>
                  </CRow>
                </div>
              )) : <div className='text-body-secondary'>Môn này chưa có kỹ năng/phần thi.</div>}
            </div>
          </CCardBody>
        </CCard>
      ))}

      <div className='d-flex gap-2'>
        <CButton color='primary' onClick={handleSave} disabled={!editable || saving}>{saving ? 'Đang lưu...' : 'Lưu cấu trúc môn thi'}</CButton>
      </div>
    </div>
  )
}