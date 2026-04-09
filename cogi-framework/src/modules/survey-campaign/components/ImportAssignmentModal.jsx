import { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import * as XLSX from 'xlsx'
import { importSurveyAssignments } from '../services/surveyCampaignService'

function getApiMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.message || error?.message || fallback
}

function downloadTemplate() {
  const rows = [
    {
      studentCode: 'SV001',
      courseId: 'INT1306',
      courseName: 'React Fundamentals',
      classSectionId: 'CLC01',
      lecturerId: 'GV001',
      lecturerName: 'Nguyen Van A',
    },
  ]

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Assignments')
  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

  const blob = new Blob([content], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'survey-assignment-template.xlsx'
  link.click()
  URL.revokeObjectURL(url)
}

export default function ImportAssignmentModal({
  visible,
  campaignId,
  campaignName,
  onClose,
  onSuccess,
}) {
  const [contextType, setContextType] = useState('COURSE_LECTURER')
  const [file, setFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!visible) {
      setContextType('COURSE_LECTURER')
      setFile(null)
      setSubmitting(false)
      setError('')
      setResult(null)
    }
  }, [visible])

  const canSubmit = useMemo(
    () => Boolean(campaignId) && Boolean(contextType) && Boolean(file) && !submitting,
    [campaignId, contextType, file, submitting],
  )

  async function handleSubmit() {
    if (!campaignId || !file) return

    setSubmitting(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('campaignId', String(campaignId))
      formData.append('contextType', contextType)
      formData.append('file', file)

      const response = await importSurveyAssignments(formData)
      setResult(response)
      onSuccess?.(response)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể import danh sách khảo sát'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CModal visible={visible} backdrop='static' size='lg' onClose={() => !submitting && onClose?.()}>
      <CModalHeader>
        <CModalTitle>Import assignment {campaignName ? `- ${campaignName}` : ''}</CModalTitle>
      </CModalHeader>
      <CModalBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <CFormLabel htmlFor='survey-import-context'>Context type</CFormLabel>
          <CFormSelect
            id='survey-import-context'
            value={contextType}
            onChange={(event) => setContextType(event.target.value)}
            disabled={submitting}
          >
            <option value='COURSE_LECTURER'>COURSE_LECTURER</option>
            <option value='GRADUATION_EXIT'>GRADUATION_EXIT</option>
          </CFormSelect>
        </div>

        <div>
          <CFormLabel htmlFor='survey-import-file'>Upload file</CFormLabel>
          <CFormInput
            id='survey-import-file'
            type='file'
            accept='.xlsx,.xls'
            disabled={submitting}
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
            Columns: <strong>studentCode</strong>, <strong>courseId</strong>, <strong>courseName</strong>, <strong>classSectionId</strong>, <strong>lecturerId</strong>, <strong>lecturerName</strong>
          </div>
        </div>

        <div>
          <CButton color='secondary' variant='outline' onClick={downloadTemplate} disabled={submitting}>
            Download template
          </CButton>
        </div>

        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        {result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <CAlert color='success' className='mb-0'>
              Total: {result.total || 0} | Created: {result.created || 0} | Skipped: {result.skipped || 0} | Errors: {result.errors || 0}
            </CAlert>

            {Array.isArray(result.skippedRows) && result.skippedRows.length > 0 ? (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Skipped rows</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Row</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Student</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.skippedRows.slice(0, 10).map((item, index) => (
                        <tr key={`skipped-${item.rowNumber || index}-${item.studentCode || index}`}>
                          <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.rowNumber || '-'}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.studentCode || '-'}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.message || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {Array.isArray(result.errorRows) && result.errorRows.length > 0 ? (
              <div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Error rows</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Row</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Student</th>
                        <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.errorRows.slice(0, 10).map((item, index) => (
                        <tr key={`error-${item.rowNumber || index}-${item.studentCode || index}`}>
                          <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.rowNumber || '-'}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.studentCode || '-'}</td>
                          <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.message || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={submitting}>
          Đóng
        </CButton>
        <CButton color='primary' onClick={handleSubmit} disabled={!canSubmit}>
          {submitting ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <CSpinner size='sm' />
              Đang import...
            </span>
          ) : 'Submit'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}