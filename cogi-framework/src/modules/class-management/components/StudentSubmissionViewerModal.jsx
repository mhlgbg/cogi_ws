import { CAlert, CButton, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle, CSpinner } from '@coreui/react'
import SubmissionViewer from './SubmissionViewer'
import StudentTaskContextSummary from './StudentTaskContextSummary'
import { getSubmissionVersionLabel } from './submissionViewerMeta'

export default function StudentSubmissionViewerModal({ visible = false, loading = false, error = '', assignment = null, task = null, submission = null, onClose }) {
  return (
    <CModal visible={visible} onClose={() => !loading && onClose?.()} size='xl'>
      <CModalHeader>
        <CModalTitle>{submission?.version ? `Bài đã nộp - ${getSubmissionVersionLabel(submission.version)}` : 'Bài đã nộp'}</CModalTitle>
      </CModalHeader>
      <CModalBody className='d-flex flex-column gap-3' style={{ background: '#f7f8fa' }}>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        {loading ? <div className='text-center py-4'><CSpinner color='primary' /></div> : (
          <>
            <StudentTaskContextSummary assignment={assignment} task={task} />
            <SubmissionViewer submission={submission} />
          </>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={() => onClose?.()} disabled={loading}>Đóng</CButton>
      </CModalFooter>
    </CModal>
  )
}