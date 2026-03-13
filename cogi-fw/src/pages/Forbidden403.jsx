import React from "react"
import { Link } from "react-router-dom"
import { CButton, CCard, CCardBody, CCardHeader, CCol, CContainer, CRow } from "@coreui/react"

export default function Forbidden403() {
  return (
    <CContainer className="py-5">
      <CRow className="justify-content-center">
        <CCol md={6} style={{ maxWidth: 560, width: "100%" }}>
          <CCard>
            <CCardHeader><b>403 - Forbidden</b></CCardHeader>
            <CCardBody>
              <p className="mb-3">Bạn không có quyền truy cập chức năng này.</p>
              <Link to="/">
                <CButton color="primary">Về Dashboard</CButton>
              </Link>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </CContainer>
  )
}
