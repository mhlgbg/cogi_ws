import { CCol, CFormInput, CFormLabel, CFormSelect, CRow } from '@coreui/react'
import { GENDER_OPTIONS } from '../utils/sportsProfileUi'

export default function SportsProfileQuickCreateFields({ form, errors = {}, disabled = false, onChange }) {
  return (
    <CRow className='g-3'>
      <CCol md={4}>
        <CFormLabel>Mã hồ sơ</CFormLabel>
        <CFormInput value={form.code} onChange={(event) => onChange('code', event.target.value.toUpperCase())} disabled={disabled} />
        {errors.code ? <div className='small text-danger mt-1'>{errors.code}</div> : null}
      </CCol>
      <CCol md={4}>
        <CFormLabel>Họ và tên</CFormLabel>
        <CFormInput value={form.fullName} onChange={(event) => onChange('fullName', event.target.value)} disabled={disabled} />
        {errors.fullName ? <div className='small text-danger mt-1'>{errors.fullName}</div> : null}
      </CCol>
      <CCol md={4}>
        <CFormLabel>Tên hiển thị</CFormLabel>
        <CFormInput value={form.displayName} onChange={(event) => onChange('displayName', event.target.value)} disabled={disabled} />
      </CCol>
      <CCol md={3}>
        <CFormLabel>Giới tính</CFormLabel>
        <CFormSelect value={form.gender} onChange={(event) => onChange('gender', event.target.value)} disabled={disabled}>
          {GENDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </CFormSelect>
      </CCol>
      <CCol md={3}>
        <CFormLabel>Ngày sinh</CFormLabel>
        <CFormInput type='date' value={form.dateOfBirth} onChange={(event) => onChange('dateOfBirth', event.target.value)} disabled={disabled} />
      </CCol>
      <CCol md={3}>
        <CFormLabel>Năm sinh</CFormLabel>
        <CFormInput type='number' min='1900' max='2100' value={form.birthYear} onChange={(event) => onChange('birthYear', event.target.value)} disabled={Boolean(form.dateOfBirth) || disabled} />
        {errors.birthYear ? <div className='small text-danger mt-1'>{errors.birthYear}</div> : null}
      </CCol>
      <CCol md={3}>
        <CFormLabel>Số điện thoại</CFormLabel>
        <CFormInput value={form.contactPhone} onChange={(event) => onChange('contactPhone', event.target.value)} disabled={disabled} />
      </CCol>
      <CCol md={6}>
        <CFormLabel>Email liên hệ</CFormLabel>
        <CFormInput value={form.contactEmail} onChange={(event) => onChange('contactEmail', event.target.value)} disabled={disabled} />
        {errors.contactEmail ? <div className='small text-danger mt-1'>{errors.contactEmail}</div> : null}
      </CCol>
      <CCol md={6}>
        <CFormLabel>Quê quán</CFormLabel>
        <CFormInput value={form.hometown} onChange={(event) => onChange('hometown', event.target.value)} disabled={disabled} />
      </CCol>
    </CRow>
  )
}