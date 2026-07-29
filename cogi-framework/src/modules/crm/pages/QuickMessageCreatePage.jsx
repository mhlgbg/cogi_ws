import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
} from '@coreui/react'
import QuickMessageForm from '../components/QuickMessageForm'
import { createQuickMessage, getApiMessage } from '../services/quickMessageService'

export default function QuickMessageCreatePage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(payload) {
    setSubmitting(true)
    setError('')
    try {
      const result = await createQuickMessage(payload)
      const messageId = result?.message?.id || result?.message?.documentId
      const accessCode = result?.access?.code || ''
      const plainPin = result?.plainPin || ''
      if (!messageId) {
        throw new Error('Không nhận được mã thông điệp sau khi tạo')
      }

      navigate(`/quick-messages/${messageId}`, {
        replace: true,
        state: {
          quickMessageCreateNotice: plainPin
            ? {
                type: 'pin',
                code: accessCode,
                plainPin,
              }
            : {
                type: 'success',
                message: 'Tạo thông điệp thành công.',
              },
        },
      })
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Không thể tạo thông điệp'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CRow className='g-4'>
      <CCol xs={12}>
        <CCard className='border-0 shadow-sm'>
          <CCardHeader className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
            <div>
              <strong>Tạo thông điệp</strong>
              <div className='small text-body-secondary mt-1'>Nhập nội dung cần gửi. Hệ thống sẽ tạo một mã truy cập đầu tiên để sử dụng.</div>
            </div>
            <CButton color='secondary' variant='outline' onClick={() => navigate('/quick-messages')} disabled={submitting}>Quay lại danh sách</CButton>
          </CCardHeader>
          <CCardBody>
            {error ? <CAlert color='danger'>{error}</CAlert> : null}

            <QuickMessageForm
              mode='create'
              submitting={submitting}
              errorMessage={error}
              submitLabel='Tạo thông điệp'
              onCancel={() => navigate('/quick-messages')}
              onSubmit={handleSubmit}
            />
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}