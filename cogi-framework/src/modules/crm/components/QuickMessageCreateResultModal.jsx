import {
  CAlert,
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
} from '@coreui/react'

export default function QuickMessageCreateResultModal({ visible, result, onClose }) {
  const accessCode = String(result?.code || '').trim()
  const plainPin = String(result?.plainPin || '').trim()

  async function copyText(text) {
    if (!text) return
    await navigator.clipboard?.writeText(text)
  }

  async function copyAll() {
    const lines = [`Mã truy cập: ${accessCode}`]
    if (plainPin) lines.push(`PIN: ${plainPin}`)
    await copyText(lines.join('\n'))
  }

  return (
    <CModal visible={visible} onClose={onClose} backdrop='static' alignment='center'>
      <CModalHeader>
        <CModalTitle>Thông điệp đã được tạo</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className='mb-3'>
          <div><strong>Mã truy cập:</strong> {accessCode || '-'}</div>
          <div><strong>PIN:</strong> {plainPin || '-'}</div>
        </div>
        <CAlert color='warning' className='mb-0'>PIN chỉ được hiển thị tại thời điểm này. Hãy sao chép trước khi đóng cửa sổ.</CAlert>
      </CModalBody>
      <CModalFooter className='justify-content-between flex-wrap gap-2'>
        <div className='d-flex gap-2 flex-wrap'>
          <CButton color='secondary' variant='outline' onClick={() => copyText(accessCode)} disabled={!accessCode}>Sao chép mã</CButton>
          <CButton color='secondary' variant='outline' onClick={() => copyText(plainPin)} disabled={!plainPin}>Sao chép PIN</CButton>
          <CButton color='secondary' variant='outline' onClick={copyAll} disabled={!accessCode}>Sao chép thông tin</CButton>
        </div>
        <CButton color='primary' onClick={onClose}>Tiếp tục</CButton>
      </CModalFooter>
    </CModal>
  )
}