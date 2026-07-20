import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CContainer, CRow, CCol, CCard, CCardBody, CForm, CFormLabel, CFormInput, CButton } from '@coreui/react'
import { createLuckyWheel } from '../services/luckyWheelService'

export default function LuckyWheelCreatePage() {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !code.trim()) return
    setSubmitting(true)
    try {
      const payload = { name: name.trim(), code: code.trim().toUpperCase(), description: description.trim() }
      const res = await createLuckyWheel(payload)
      if (res && res.id) {
        navigate('/lucky-wheels')
      } else {
        window.alert('Tạo thất bại')
      }
    } catch (err) {
      console.error(err)
      window.alert('Lỗi khi tạo')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CContainer className='py-4'>
      <CRow className='justify-content-center'>
        <CCol md={8}>
          <CCard>
            <CCardBody>
              <h4>Tạo vòng quay mới</h4>
              <CForm onSubmit={handleSubmit}>
                <div className='mb-3'>
                  <CFormLabel>Tên</CFormLabel>
                  <CFormInput value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className='mb-3'>
                  <CFormLabel>Mã (unique)</CFormLabel>
                  <CFormInput value={code} onChange={(e) => setCode(e.target.value)} required />
                </div>
                <div className='mb-3'>
                  <CFormLabel>Mô tả</CFormLabel>
                  <CFormInput value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className='d-flex gap-2'>
                  <CButton type='submit' color='primary' disabled={submitting}>{submitting ? 'Đang tạo...' : 'Tạo'}</CButton>
                  <CButton color='secondary' onClick={() => navigate('/lucky-wheels')}>Hủy</CButton>
                </div>
              </CForm>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  )
}
