import { CBadge, CButton, CCard, CCardBody } from '@coreui/react'
import { getClubTypeLabel, getParentClubLabel, getSportTypeLabel, getSportsClubStatusMeta } from '../utils/sportsClubUi'

export default function ManagedClubHeader({ club, onBack }) {
  const statusMeta = getSportsClubStatusMeta(club?.status)
  return (
    <CCard className='mb-4'>
      <CCardBody>
        <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap'>
          <div className='d-flex gap-3 align-items-start'>
            <div>
              {club?.logo?.url
                ? <img src={club.logo.url} alt={club.name || club.code} style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 16 }} />
                : <div className='d-inline-flex align-items-center justify-content-center rounded bg-body-tertiary text-body-secondary' style={{ width: 96, height: 96 }}>N/A</div>}
            </div>
            <div>
              <div className='fs-4 fw-semibold'>{club?.name || '-'}</div>
              <div className='text-body-secondary'>{[club?.shortName, club?.code].filter(Boolean).join(' · ') || '-'}</div>
              <div className='d-flex gap-2 mt-2 flex-wrap'>
                <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
                <CBadge color='info'>{getClubTypeLabel(club?.clubType)}</CBadge>
                <CBadge color='secondary'>{getSportTypeLabel(club?.sportType)}</CBadge>
                {club?.parentClub?.id ? <CBadge color='light' textColor='dark'>{getParentClubLabel(club.parentClub)}</CBadge> : null}
              </div>
            </div>
          </div>
          <CButton color='secondary' variant='outline' onClick={onBack}>Quay lại CLB tôi quản lý</CButton>
        </div>
      </CCardBody>
    </CCard>
  )
}