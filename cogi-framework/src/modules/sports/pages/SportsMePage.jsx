import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CNav,
  CNavItem,
  CNavLink,
  CRow,
  CSpinner,
} from '@coreui/react'
import {
  createMySportsProfile,
  getMySportsAchievement,
  getMySportsAchievementSubmission,
  getMySportsClubMembership,
  getMySportsProfile,
  getSportsMeApiCode,
  getSportsMeApiMessage,
  listMySportsAchievements,
  listMySportsAchievementSubmissions,
  listMySportsClubs,
  listMySportsClubMembershipHistory,
  updateMySportsProfile,
  uploadMySportsProfileAvatar,
} from '../services/sportsMeService'
import SportsProfileQuickCreateFields from '../components/SportsProfileQuickCreateFields'
import {
  formatSportsDate,
  formatSportsDateTime,
  getClubMembershipRoleLabel,
  getClubMembershipSourceLabel,
  getClubMembershipStatusMeta,
} from '../utils/clubMembershipUi'
import {
  ACHIEVEMENT_STATUS_FILTER_OPTIONS,
  getAchievementSourceLabel,
  getAchievementTypeLabel,
  getSportTypeLabel,
} from '../utils/sportsAchievementUi'
import {
  formatSportsBirthDateOrYear,
  GENDER_OPTIONS,
  getSportsProfileGenderLabel,
  getSportsProfileStatusMeta,
} from '../utils/sportsProfileUi'
import { buildInitialQuickSportsProfileForm, buildQuickSportsProfilePayload, validateQuickSportsProfileForm } from '../utils/sportsProfileQuickCreate'
import './SportsMePage.css'

const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'clubs', label: 'Câu lạc bộ' },
  { key: 'achievements', label: 'Thành tích' },
]

const ACHIEVEMENT_VIEWS = [
  { key: 'records', label: 'Thành tích đã ghi nhận' },
  { key: 'submissions', label: 'Đề nghị của tôi' },
]

const SUBMISSION_FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'draft', label: 'Bản nháp' },
  { value: 'submitted', label: 'Đã gửi' },
  { value: 'verified', label: 'Đã xác minh' },
  { value: 'rejected', label: 'Đã từ chối' },
  { value: 'cancelled', label: 'Đã hủy' },
]

function toText(value) {
  if (value === null || value === undefined) return ''
  return String(value).trim()
}

function getMemberAchievementStatusMeta(status) {
  const normalized = toText(status).toLowerCase()
  if (normalized === 'revoked') return { color: 'dark', label: 'Đã rút ghi nhận' }
  return { color: 'success', label: 'Đang ghi nhận' }
}

function getMemberSubmissionStatusMeta(status) {
  const normalized = toText(status).toLowerCase()
  if (normalized === 'verified') return { color: 'success', label: 'Đã xác minh' }
  if (normalized === 'rejected') return { color: 'danger', label: 'Đã từ chối' }
  if (normalized === 'cancelled') return { color: 'dark', label: 'Đã hủy' }
  if (normalized === 'draft') return { color: 'secondary', label: 'Bản nháp' }
  return { color: 'warning', label: 'Đã gửi' }
}

function getMembershipHistoryEventLabel(eventType) {
  const normalized = toText(eventType).toLowerCase()
  if (normalized === 'joined') return 'Gia nhập'
  if (normalized === 'approved') return 'Được duyệt'
  if (normalized === 'rejected') return 'Bị từ chối'
  if (normalized === 'left') return 'Rời CLB'
  if (normalized === 'rejoined') return 'Gia nhập lại'
  if (normalized === 'activated') return 'Hoạt động'
  if (normalized === 'deactivated') return 'Dừng hoạt động'
  if (normalized === 'suspended') return 'Tạm đình chỉ'
  if (normalized === 'reactivated') return 'Hoạt động lại'
  if (normalized === 'role_changed') return 'Đổi vai trò'
  if (normalized === 'position_changed') return 'Đổi chức danh'
  if (normalized === 'member_code_changed') return 'Đổi mã thành viên'
  return 'Cập nhật'
}

function resolveAchievementResultText(item) {
  const resultText = toText(item?.resultText)
  if (resultText) return resultText
  const value = item?.resultValue === null || item?.resultValue === undefined ? '' : String(item.resultValue)
  const unit = toText(item?.resultUnit)
  return [value, unit].filter(Boolean).join(' ') || '-'
}

function buildProfileFormValues(profile = null) {
  return {
    code: toText(profile?.code),
    displayName: toText(profile?.displayName),
    avatar: profile?.avatar || null,
    gender: toText(profile?.gender) || 'unspecified',
    fullName: toText(profile?.fullName),
    dateOfBirth: profile?.dateOfBirth || '',
    birthYear: Number.isInteger(Number(profile?.birthYear)) ? String(profile.birthYear) : '',
    hometown: toText(profile?.hometown),
    bio: toText(profile?.bio),
    contactPhone: toText(profile?.contactPhone),
    contactEmail: toText(profile?.contactEmail),
  }
}

function buildProfileUpdatePayload(form) {
  return {
    code: toText(form.code).toUpperCase() || null,
    displayName: toText(form.displayName) || null,
    avatar: form.avatar?.id || null,
    gender: toText(form.gender) || 'unspecified',
    dateOfBirth: form.dateOfBirth || null,
    birthYear: toText(form.birthYear) ? Number(form.birthYear) : null,
    hometown: toText(form.hometown) || null,
    bio: toText(form.bio) || null,
    contactPhone: toText(form.contactPhone) || null,
    contactEmail: toText(form.contactEmail).toLowerCase() || null,
  }
}

function validateProfileForm(form) {
  const errors = validateQuickSportsProfileForm({
    code: form.code,
    fullName: form.fullName || 'profile-owner',
    birthYear: form.birthYear,
    contactEmail: form.contactEmail,
  })
  delete errors.fullName
  return errors
}

function CreateSportsProfileCard({ form, errors, submitting, onChange, onSubmit }) {
  return (
    <CCard className='sports-me-section-card border-0 shadow-sm'>
      <CCardBody>
        <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
          <div>
            <div className='sports-me-section-title mb-1'>Tạo hồ sơ thể thao</div>
            <div className='small text-body-secondary'>Tạo hồ sơ thể thao gắn trực tiếp với tài khoản đang đăng nhập của bạn trong tenant hiện tại.</div>
          </div>
          <CButton color='primary' onClick={onSubmit} disabled={submitting}>{submitting ? 'Đang tạo hồ sơ...' : 'Tạo hồ sơ thể thao'}</CButton>
        </div>

        <SportsProfileQuickCreateFields form={form} errors={errors} disabled={submitting} onChange={onChange} />
      </CCardBody>
    </CCard>
  )
}

function SummaryCard({ label, value }) {
  return (
    <CCard className='sports-me-summary-card border-0 shadow-sm'>
      <CCardBody>
        <div className='sports-me-summary-value'>{value}</div>
        <div className='sports-me-summary-label'>{label}</div>
      </CCardBody>
    </CCard>
  )
}

function SectionCard({ title, children }) {
  return (
    <CCard className='sports-me-section-card border-0 shadow-sm'>
      <CCardBody>
        <div className='sports-me-section-title'>{title}</div>
        {children}
      </CCardBody>
    </CCard>
  )
}

function DetailGrid({ items = [] }) {
  return (
    <div className='sports-me-detail-grid'>
      {items.map((item) => (
        <div key={item.label} className='sports-me-detail-item'>
          <div className='sports-me-detail-label'>{item.label}</div>
          <div className='sports-me-detail-value'>{item.value || '-'}</div>
        </div>
      ))}
    </div>
  )
}

function SportsMeProfileHero({ profile, refreshing, editing, onRefresh, onEdit }) {
  const statusMeta = getSportsProfileStatusMeta(profile?.status)
  const detailBits = [
    getSportsProfileGenderLabel(profile?.gender),
    formatSportsBirthDateOrYear(profile?.dateOfBirth, profile?.birthYear),
    toText(profile?.hometown),
  ].filter(Boolean)

  return (
    <CCard className='sports-me-hero border-0 shadow-sm mb-4'>
      <CCardBody>
        <div className='sports-me-hero-layout'>
          <div className='sports-me-hero-main'>
            {profile?.avatar?.url
              ? <img className='sports-me-hero-avatar' src={profile.avatar.url} alt={profile.fullName || profile.code} />
              : <div className='sports-me-hero-avatar sports-me-hero-avatar-fallback'>N/A</div>}
            <div className='sports-me-hero-copy'>
              <div className='sports-me-hero-title'>{profile?.fullName || 'Hồ sơ thể thao của tôi'}</div>
              <div className='sports-me-hero-subtitle'>{[toText(profile?.displayName), toText(profile?.code)].filter(Boolean).join(' · ') || 'Hồ sơ thể thao'}</div>
              <div className='sports-me-hero-meta'>{detailBits.join(' · ') || 'Chưa cập nhật thông tin cá nhân'}</div>
              <div className='sports-me-hero-status-row'>
                <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
                {profile?.contactEmail ? <span className='sports-me-hero-email'>{profile.contactEmail}</span> : null}
              </div>
            </div>
          </div>
          <div className='sports-me-hero-actions'>
            <CButton color='secondary' variant='outline' size='sm' onClick={onRefresh} disabled={refreshing}>{refreshing ? 'Đang tải...' : 'Làm mới'}</CButton>
            {!editing ? <CButton color='primary' onClick={onEdit}>Chỉnh sửa hồ sơ</CButton> : null}
          </div>
        </div>
      </CCardBody>
    </CCard>
  )
}

function ProfileEditCard({ profile, form, errors, submitting, uploading, onChange, onAvatarChange, onCancel, onSubmit }) {
  return (
    <CCard className='sports-me-section-card border-0 shadow-sm mb-4'>
      <CCardBody>
        <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
          <div>
            <div className='sports-me-section-title mb-1'>Chỉnh sửa hồ sơ thể thao</div>
            <div className='small text-body-secondary'>Bạn có thể cập nhật các thông tin cá nhân cơ bản hiển thị trên hồ sơ thể thao của mình.</div>
          </div>
          <div className='d-flex gap-2'>
            <CButton color='secondary' variant='outline' onClick={onCancel} disabled={submitting || uploading}>Hủy</CButton>
            <CButton color='primary' onClick={onSubmit} disabled={submitting || uploading}>{submitting ? 'Đang lưu...' : 'Lưu thay đổi'}</CButton>
          </div>
        </div>

        <CRow className='g-4'>
          <CCol lg={4}>
            <div className='small text-body-secondary mb-2'>Ảnh đại diện</div>
            {form.avatar?.url ? <img className='sports-me-edit-avatar' src={form.avatar.url} alt={profile?.fullName || profile?.code} /> : <div className='sports-me-edit-avatar sports-me-hero-avatar-fallback'>Chưa có avatar</div>}
            <CFormLabel className='mt-3'>Chọn ảnh mới</CFormLabel>
            <CFormInput type='file' accept='image/*' disabled={submitting || uploading} onChange={(event) => { const file = event.target.files?.[0] || null; onAvatarChange(file); event.target.value = '' }} />
            <div className='small text-body-secondary mt-1'>{uploading ? 'Đang tải ảnh đại diện...' : 'Ảnh đại diện chỉ áp dụng cho hồ sơ thể thao của bạn.'}</div>
          </CCol>
          <CCol lg={8}>
            <CRow className='g-3'>
              <CCol md={6}>
                <CFormLabel>Mã hồ sơ</CFormLabel>
                <CFormInput value={form.code} onChange={(event) => onChange('code', event.target.value.toUpperCase())} disabled={submitting || uploading} />
                {errors.code ? <div className='small text-danger mt-1'>{errors.code}</div> : null}
              </CCol>
              <CCol md={6}>
                <CFormLabel>Tên hiển thị</CFormLabel>
                <CFormInput value={form.displayName} onChange={(event) => onChange('displayName', event.target.value)} disabled={submitting || uploading} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Giới tính</CFormLabel>
                <CFormSelect value={form.gender} onChange={(event) => onChange('gender', event.target.value)} disabled={submitting || uploading}>
                  {GENDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </CFormSelect>
              </CCol>
              <CCol md={6}>
                <CFormLabel>Ngày sinh</CFormLabel>
                <CFormInput type='date' value={form.dateOfBirth} onChange={(event) => onChange('dateOfBirth', event.target.value)} disabled={submitting || uploading} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Năm sinh</CFormLabel>
                <CFormInput type='number' value={form.birthYear} onChange={(event) => onChange('birthYear', event.target.value)} disabled={submitting || uploading} />
                {errors.birthYear ? <div className='small text-danger mt-1'>{errors.birthYear}</div> : null}
              </CCol>
              <CCol md={6}>
                <CFormLabel>Quê quán</CFormLabel>
                <CFormInput value={form.hometown} onChange={(event) => onChange('hometown', event.target.value)} disabled={submitting || uploading} />
              </CCol>
              <CCol md={6}>
                <CFormLabel>Điện thoại</CFormLabel>
                <CFormInput value={form.contactPhone} onChange={(event) => onChange('contactPhone', event.target.value)} disabled={submitting || uploading} />
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Email</CFormLabel>
                <CFormInput value={form.contactEmail} onChange={(event) => onChange('contactEmail', event.target.value)} disabled={submitting || uploading} />
                {errors.contactEmail ? <div className='small text-danger mt-1'>{errors.contactEmail}</div> : null}
              </CCol>
              <CCol xs={12}>
                <CFormLabel>Giới thiệu</CFormLabel>
                <CFormTextarea rows={4} value={form.bio} onChange={(event) => onChange('bio', event.target.value)} disabled={submitting || uploading} />
              </CCol>
            </CRow>
          </CCol>
        </CRow>
      </CCardBody>
    </CCard>
  )
}

function ClubCard({ item, onOpen }) {
  const statusMeta = getClubMembershipStatusMeta(item.status)
  return (
    <CCard className='sports-me-card border-0 shadow-sm h-100'>
      <CCardBody>
        <div className='sports-me-card-head'>
          <div className='sports-me-club-head-main'>
            {item.club?.logo?.url ? <img className='sports-me-club-logo' src={item.club.logo.url} alt={item.club.name || item.club.code} /> : <div className='sports-me-club-logo sports-me-hero-avatar-fallback'>CLB</div>}
            <div>
              <div className='sports-me-card-title'>{item.club?.name || item.club?.code || 'Câu lạc bộ'}</div>
              <div className='sports-me-card-subtitle'>{item.memberCode || 'Chưa có mã thành viên'}</div>
              <div className='sports-me-card-meta'>{getClubMembershipRoleLabel(item.role)}{item.positionTitle ? ` · ${item.positionTitle}` : ''}</div>
            </div>
          </div>
          <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
        </div>
        <div className='sports-me-card-detail'>Tham gia từ: {formatSportsDate(item.joinedAt)}</div>
        {item.leftAt ? <div className='sports-me-card-detail'>Rời CLB: {formatSportsDate(item.leftAt)}</div> : null}
        <div className='d-flex justify-content-end mt-3'>
          <CButton color='secondary' variant='outline' onClick={() => onOpen(item)}>Xem chi tiết</CButton>
        </div>
      </CCardBody>
    </CCard>
  )
}

function AchievementCard({ item, onOpen }) {
  const statusMeta = getMemberAchievementStatusMeta(item.status)
  return (
    <CCard className={`sports-me-card border-0 shadow-sm h-100 ${item.status === 'revoked' ? 'sports-me-card-muted' : ''}`}>
      <CCardBody>
        <div className='sports-me-card-head'>
          <div>
            <div className='sports-me-card-title'>{item.title || '-'}</div>
            <div className='sports-me-card-subtitle'>{getAchievementTypeLabel(item.achievementType)} · {getSportTypeLabel(item.sportType)}</div>
          </div>
          <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
        </div>
        <div className='sports-me-result-text'>{resolveAchievementResultText(item)}</div>
        {(item.resultValue !== null && item.resultValue !== undefined && toText(item.resultText)) ? <div className='sports-me-card-meta'>{String(item.resultValue)} {item.resultUnit || ''}</div> : null}
        <div className='sports-me-card-detail'>{item.club?.name || 'Không gắn câu lạc bộ'}</div>
        <div className='sports-me-card-meta'>{formatSportsDate(item.achievedAt)}{item.sourceReference ? ` · ${item.sourceReference}` : ''}</div>
        <div className='d-flex justify-content-end mt-3'>
          <CButton color='secondary' variant='outline' onClick={() => onOpen(item)}>Xem chi tiết</CButton>
        </div>
      </CCardBody>
    </CCard>
  )
}

function SubmissionCard({ item, onOpen }) {
  const statusMeta = getMemberSubmissionStatusMeta(item.status)
  return (
    <CCard className='sports-me-card border-0 shadow-sm h-100'>
      <CCardBody>
        <div className='sports-me-card-head'>
          <div>
            <div className='sports-me-card-title'>{item.title || '-'}</div>
            <div className='sports-me-card-subtitle'>{getAchievementTypeLabel(item.achievementType)} · {getSportTypeLabel(item.sportType)}</div>
          </div>
          <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
        </div>
        <div className='sports-me-result-text'>{resolveAchievementResultText(item)}</div>
        <div className='sports-me-card-detail'>CLB: {item.club?.name || 'Không gắn câu lạc bộ'}</div>
        <div className='sports-me-card-meta'>Gửi lúc: {formatSportsDateTime(item.submittedAt)}</div>
        {item.status === 'verified' ? <div className='sports-me-card-meta'>Xác minh lúc: {formatSportsDateTime(item.reviewedAt)}</div> : null}
        {item.status === 'rejected' ? <div className='sports-me-card-meta'>Từ chối lúc: {formatSportsDateTime(item.reviewedAt)}</div> : null}
        <div className='d-flex justify-content-end mt-3'>
          <CButton color='secondary' variant='outline' onClick={() => onOpen(item)}>Xem chi tiết</CButton>
        </div>
      </CCardBody>
    </CCard>
  )
}

function MembershipDetailModal({ visible, membership, historyRows, loadingHistory, onClose }) {
  return (
    <CModal visible={visible} onClose={onClose} size='lg' scrollable>
      <CModalHeader>
        <CModalTitle>Thông tin tham gia câu lạc bộ</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {!membership ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải thông tin tham gia...</div> : (
          <>
            <DetailGrid items={[
              { label: 'Câu lạc bộ', value: membership.club?.name || membership.club?.code || '-' },
              { label: 'Mã thành viên', value: membership.memberCode || '-' },
              { label: 'Vai trò', value: getClubMembershipRoleLabel(membership.role) },
              { label: 'Chức danh', value: membership.positionTitle || '-' },
              { label: 'Trạng thái', value: getClubMembershipStatusMeta(membership.status).label },
              { label: 'Tham gia từ', value: formatSportsDate(membership.joinedAt) },
              { label: 'Rời câu lạc bộ', value: formatSportsDate(membership.leftAt) },
              { label: 'Nguồn', value: getClubMembershipSourceLabel(membership.source) },
            ]} />

            <SectionCard title='Lời nhắn tham gia'>
              <div style={{ whiteSpace: 'pre-wrap' }}>{membership.joinMessage || 'Không có.'}</div>
            </SectionCard>

            <SectionCard title='Lịch sử tham gia'>
              {loadingHistory ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải lịch sử...</div> : historyRows.length === 0 ? <CAlert color='secondary' className='mb-0'>Chưa có cập nhật nào trong lịch sử tham gia.</CAlert> : (
                <div className='sports-me-history-list'>
                  {historyRows.map((row) => (
                    <div key={row.id} className='sports-me-history-item'>
                      <div className='sports-me-history-item-header'>
                        <div className='fw-semibold'>{getMembershipHistoryEventLabel(row.eventType)}</div>
                        <div className='small text-body-secondary'>{formatSportsDateTime(row.eventAt)}</div>
                      </div>
                      {(row.fromStatus || row.toStatus) ? <div className='sports-me-history-item-body'>Trạng thái: {toText(row.fromStatus) || '-'} → {toText(row.toStatus) || '-'}</div> : null}
                      {(row.fromRole || row.toRole) ? <div className='sports-me-history-item-body'>Vai trò: {toText(row.fromRole) || '-'} → {toText(row.toRole) || '-'}</div> : null}
                      {(row.fromPositionTitle || row.toPositionTitle) ? <div className='sports-me-history-item-body'>Chức danh: {toText(row.fromPositionTitle) || '-'} → {toText(row.toPositionTitle) || '-'}</div> : null}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose}>Đóng</CButton>
      </CModalFooter>
    </CModal>
  )
}

function AchievementDetailModal({ visible, achievement, onClose }) {
  const statusMeta = getMemberAchievementStatusMeta(achievement?.status)
  return (
    <CModal visible={visible} onClose={onClose} size='lg' scrollable>
      <CModalHeader>
        <CModalTitle>Chi tiết thành tích</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {!achievement ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải chi tiết thành tích...</div> : (
          <>
            <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
              <div>
                <div className='fs-5 fw-semibold'>{achievement.title || '-'}</div>
                <div className='text-body-secondary'>{getAchievementTypeLabel(achievement.achievementType)} · {getSportTypeLabel(achievement.sportType)}</div>
              </div>
              <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
            </div>
            <div className='sports-me-result-text mb-3'>{resolveAchievementResultText(achievement)}</div>
            <DetailGrid items={[
              { label: 'Câu lạc bộ', value: achievement.club?.name || 'Không gắn câu lạc bộ' },
              { label: 'Nguồn', value: getAchievementSourceLabel(achievement.source) },
              { label: 'Thời điểm đạt', value: formatSportsDateTime(achievement.achievedAt) },
              { label: 'Thời điểm xác minh', value: formatSportsDateTime(achievement.verifiedAt) },
              { label: 'Tham chiếu', value: achievement.sourceReference || '-' },
            ]} />
            <SectionCard title='Mô tả'>
              <div style={{ whiteSpace: 'pre-wrap' }}>{achievement.description || 'Không có.'}</div>
            </SectionCard>
            {achievement.status === 'revoked' ? <CAlert color='warning'>Đã rút ghi nhận vào {formatSportsDateTime(achievement.revokedAt)}.{achievement.revokeReason ? ` Lý do: ${achievement.revokeReason}` : ''}</CAlert> : null}
            <SectionCard title='Minh chứng'>
              {achievement.evidence.length === 0 ? <div className='text-body-secondary'>Chưa có minh chứng.</div> : <div className='d-flex flex-column gap-2'>{achievement.evidence.map((item) => <a key={item.id} href={item.url} target='_blank' rel='noreferrer'>{item.name || item.url || `Media #${item.id}`}</a>)}</div>}
            </SectionCard>
          </>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose}>Đóng</CButton>
      </CModalFooter>
    </CModal>
  )
}

function SubmissionDetailModal({ visible, submission, onClose }) {
  const statusMeta = getMemberSubmissionStatusMeta(submission?.status)
  return (
    <CModal visible={visible} onClose={onClose} size='lg' scrollable>
      <CModalHeader>
        <CModalTitle>Chi tiết đề nghị của tôi</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {!submission ? <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải chi tiết đề nghị...</div> : (
          <>
            <div className='d-flex justify-content-between align-items-start gap-3 flex-wrap mb-3'>
              <div>
                <div className='fs-5 fw-semibold'>{submission.title || '-'}</div>
                <div className='text-body-secondary'>{getAchievementTypeLabel(submission.achievementType)} · {getSportTypeLabel(submission.sportType)}</div>
              </div>
              <CBadge color={statusMeta.color}>{statusMeta.label}</CBadge>
            </div>
            <div className='sports-me-result-text mb-3'>{resolveAchievementResultText(submission)}</div>
            <DetailGrid items={[
              { label: 'Câu lạc bộ', value: submission.club?.name || 'Không gắn câu lạc bộ' },
              { label: 'Nguồn', value: getAchievementSourceLabel(submission.source) },
              { label: 'Ngày gửi', value: formatSportsDateTime(submission.submittedAt) },
              { label: 'Ngày phản hồi', value: formatSportsDateTime(submission.reviewedAt) },
              { label: 'Tham chiếu', value: submission.sourceReference || '-' },
            ]} />
            <SectionCard title='Mô tả'>
              <div style={{ whiteSpace: 'pre-wrap' }}>{submission.description || 'Không có.'}</div>
            </SectionCard>
            <SectionCard title='Phản hồi'>
              <div style={{ whiteSpace: 'pre-wrap' }}>{submission.reviewNote || 'Chưa có phản hồi.'}</div>
            </SectionCard>
            <SectionCard title='Minh chứng'>
              {submission.evidence.length === 0 ? <div className='text-body-secondary'>Chưa có minh chứng.</div> : <div className='d-flex flex-column gap-2'>{submission.evidence.map((item) => <a key={item.id} href={item.url} target='_blank' rel='noreferrer'>{item.name || item.url || `Media #${item.id}`}</a>)}</div>}
            </SectionCard>
          </>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color='secondary' variant='outline' onClick={onClose}>Đóng</CButton>
      </CModalFooter>
    </CModal>
  )
}

export default function SportsMePage() {
  const navigate = useNavigate()
  const { tenantCode, meTabKey } = useParams()
  const activeTab = TABS.some((item) => item.key === meTabKey) ? meTabKey : 'overview'
  const basePath = tenantCode ? `/t/${encodeURIComponent(tenantCode)}/sports/me` : '/sports/me'

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [noProfile, setNoProfile] = useState(false)
  const [profileBundle, setProfileBundle] = useState({ profile: null, summary: null })
  const [clubs, setClubs] = useState([])
  const [achievements, setAchievements] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [clubsError, setClubsError] = useState('')
  const [achievementsError, setAchievementsError] = useState('')
  const [submissionsError, setSubmissionsError] = useState('')
  const [editing, setEditing] = useState(false)
  const [profileForm, setProfileForm] = useState(buildProfileFormValues())
  const [profileFormErrors, setProfileFormErrors] = useState({})
  const [createForm, setCreateForm] = useState(buildInitialQuickSportsProfileForm())
  const [createFormErrors, setCreateFormErrors] = useState({})
  const [submittingProfile, setSubmittingProfile] = useState(false)
  const [creatingProfile, setCreatingProfile] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [success, setSuccess] = useState('')
  const [achievementStatusFilter, setAchievementStatusFilter] = useState('active')
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState('all')
  const [achievementView, setAchievementView] = useState('records')
  const [membershipModal, setMembershipModal] = useState({ visible: false, membership: null, history: [], loading: false })
  const [achievementModal, setAchievementModal] = useState({ visible: false, achievement: null })
  const [submissionModal, setSubmissionModal] = useState({ visible: false, submission: null })

  const filteredAchievements = useMemo(() => {
    if (achievementStatusFilter === 'all') return achievements
    return achievements.filter((item) => item.status === achievementStatusFilter)
  }, [achievementStatusFilter, achievements])

  const filteredSubmissions = useMemo(() => {
    if (submissionStatusFilter === 'all') return submissions
    return submissions.filter((item) => item.status === submissionStatusFilter)
  }, [submissionStatusFilter, submissions])

  async function loadSecondaryData() {
    const [clubsResult, achievementsResult, submissionsResult] = await Promise.allSettled([
      listMySportsClubs(),
      listMySportsAchievements({ status: 'all' }),
      listMySportsAchievementSubmissions({ status: 'all' }),
    ])

    if (clubsResult.status === 'fulfilled') {
      setClubs(clubsResult.value)
      setClubsError('')
    } else {
      setClubs([])
      setClubsError(getSportsMeApiMessage(clubsResult.reason, 'Không tải được danh sách câu lạc bộ.'))
    }

    if (achievementsResult.status === 'fulfilled') {
      setAchievements(achievementsResult.value)
      setAchievementsError('')
    } else {
      setAchievements([])
      setAchievementsError(getSportsMeApiMessage(achievementsResult.reason, 'Không tải được danh sách thành tích.'))
    }

    if (submissionsResult.status === 'fulfilled') {
      setSubmissions(submissionsResult.value)
      setSubmissionsError('')
    } else {
      setSubmissions([])
      setSubmissionsError(getSportsMeApiMessage(submissionsResult.reason, 'Không tải được danh sách đề nghị của bạn.'))
    }
  }

  async function loadPage(isRefresh = false) {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const data = await getMySportsProfile()
      setNoProfile(false)
      setProfileBundle(data)
      setProfileForm(buildProfileFormValues(data.profile))
      setCreateForm(buildInitialQuickSportsProfileForm())
      setCreateFormErrors({})
      await loadSecondaryData()
    } catch (requestError) {
      const code = getSportsMeApiCode(requestError)
      if (code === 'SPORTS_PROFILE_NOT_FOUND') {
        setNoProfile(true)
        setProfileBundle({ profile: null, summary: null })
        setEditing(false)
        setClubs([])
        setAchievements([])
        setSubmissions([])
        setClubsError('')
        setAchievementsError('')
        setSubmissionsError('')
      } else {
        setNoProfile(false)
        setError(getSportsMeApiMessage(requestError, 'Không tải được hồ sơ thể thao của bạn.'))
      }
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }

  useEffect(() => {
    loadPage(false)
  }, [])

  useEffect(() => {
    if (!success) return undefined
    const timer = window.setTimeout(() => setSuccess(''), 2500)
    return () => window.clearTimeout(timer)
  }, [success])

  function updateProfileField(field, value) {
    setProfileForm((current) => ({ ...current, [field]: value }))
    setProfileFormErrors((current) => {
      if (!current[field]) return current
      return { ...current, [field]: '' }
    })
  }

  function updateCreateField(field, value) {
    setCreateForm((current) => ({ ...current, [field]: value }))
    setCreateFormErrors((current) => {
      if (!current[field]) return current
      return { ...current, [field]: '' }
    })
  }

  async function handleAvatarChange(file) {
    if (!file) return
    setUploadingAvatar(true)
    try {
      const uploaded = await uploadMySportsProfileAvatar(file)
      setProfileForm((current) => ({
        ...current,
        avatar: uploaded ? { id: uploaded.id || null, name: toText(uploaded.name), url: toText(uploaded.url) } : null,
      }))
    } catch (requestError) {
      setError(getSportsMeApiMessage(requestError, 'Không thể tải ảnh đại diện mới.'))
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleProfileSubmit() {
    const nextErrors = validateProfileForm(profileForm)
    setProfileFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmittingProfile(true)
    try {
      const updated = await updateMySportsProfile(buildProfileUpdatePayload(profileForm))
      setProfileBundle(updated)
      setProfileForm(buildProfileFormValues(updated.profile))
      setEditing(false)
      setSuccess('Đã cập nhật hồ sơ thể thao của bạn.')
    } catch (requestError) {
      setError(getSportsMeApiMessage(requestError, 'Không thể cập nhật hồ sơ thể thao của bạn.'))
    } finally {
      setSubmittingProfile(false)
    }
  }

  async function handleCreateProfile() {
    const nextErrors = validateQuickSportsProfileForm(createForm)
    setCreateFormErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setCreatingProfile(true)
    setError('')
    try {
      const created = await createMySportsProfile(buildQuickSportsProfilePayload(createForm))
      setProfileBundle(created)
      setNoProfile(false)
      setProfileForm(buildProfileFormValues(created.profile))
      setCreateForm(buildInitialQuickSportsProfileForm())
      setCreateFormErrors({})
      setSuccess('Đã tạo hồ sơ thể thao của bạn.')
      await loadPage(true)
    } catch (requestError) {
      setError(getSportsMeApiMessage(requestError, 'Không thể tạo hồ sơ thể thao của bạn.'))
    } finally {
      setCreatingProfile(false)
    }
  }

  async function openMembershipDetail(item) {
    setMembershipModal({ visible: true, membership: null, history: [], loading: true })
    try {
      const detail = await getMySportsClubMembership(item.id)
      const history = await listMySportsClubMembershipHistory(item.id)
      setMembershipModal({ visible: true, membership: history.membership || detail, history: history.rows || [], loading: false })
    } catch (requestError) {
      setMembershipModal({ visible: false, membership: null, history: [], loading: false })
      setClubsError(getSportsMeApiMessage(requestError, 'Không tải được thông tin tham gia câu lạc bộ.'))
    }
  }

  async function openAchievementDetail(item) {
    setAchievementModal({ visible: true, achievement: null })
    try {
      const detail = await getMySportsAchievement(item.id)
      setAchievementModal({ visible: true, achievement: detail })
    } catch (requestError) {
      setAchievementModal({ visible: false, achievement: null })
      setAchievementsError(getSportsMeApiMessage(requestError, 'Không tải được chi tiết thành tích.'))
    }
  }

  async function openSubmissionDetail(item) {
    setSubmissionModal({ visible: true, submission: null })
    try {
      const detail = await getMySportsAchievementSubmission(item.id)
      setSubmissionModal({ visible: true, submission: detail })
    } catch (requestError) {
      setSubmissionModal({ visible: false, submission: null })
      setSubmissionsError(getSportsMeApiMessage(requestError, 'Không tải được chi tiết đề nghị.'))
    }
  }

  function renderOverviewTab() {
    const profile = profileBundle.profile
    const summary = profileBundle.summary || { activeClubCount: 0, activeAchievementCount: 0, pendingSubmissionCount: 0 }

    return (
      <>
        {editing ? <ProfileEditCard profile={profile} form={profileForm} errors={profileFormErrors} submitting={submittingProfile} uploading={uploadingAvatar} onChange={updateProfileField} onAvatarChange={handleAvatarChange} onCancel={() => { setEditing(false); setProfileForm(buildProfileFormValues(profile)); setProfileFormErrors({}) }} onSubmit={handleProfileSubmit} /> : null}

        <div className='sports-me-summary-grid mb-4'>
          <SummaryCard label='CLB đang tham gia' value={summary.activeClubCount} />
          <SummaryCard label='Thành tích đã ghi nhận' value={summary.activeAchievementCount} />
          <SummaryCard label='Đề nghị đang chờ' value={summary.pendingSubmissionCount} />
        </div>

        <div className='sports-me-section-stack'>
          <SectionCard title='Thông tin cá nhân'>
            <DetailGrid items={[
              { label: 'Mã hồ sơ', value: profile?.code },
              { label: 'Họ và tên', value: profile?.fullName },
              { label: 'Tên hiển thị', value: profile?.displayName || '-' },
              { label: 'Giới tính', value: getSportsProfileGenderLabel(profile?.gender) },
              { label: 'Ngày/Năm sinh', value: formatSportsBirthDateOrYear(profile?.dateOfBirth, profile?.birthYear) },
              { label: 'Quê quán', value: profile?.hometown || '-' },
            ]} />
          </SectionCard>
          <SectionCard title='Liên hệ'>
            <DetailGrid items={[
              { label: 'Điện thoại', value: profile?.contactPhone || '-' },
              { label: 'Email', value: profile?.contactEmail || '-' },
            ]} />
          </SectionCard>
          <SectionCard title='Tài khoản'>
            <DetailGrid items={[{ label: 'Tài khoản đăng nhập', value: profile?.user?.username || '-' }]} />
            {profile?.user?.email ? <div className='sports-me-detail-hint mt-2'>{profile.user.email}</div> : null}
          </SectionCard>
          {profile?.bio ? (
            <SectionCard title='Giới thiệu'>
              <div style={{ whiteSpace: 'pre-wrap' }}>{profile.bio}</div>
            </SectionCard>
          ) : null}
        </div>
      </>
    )
  }

  function renderClubsTab() {
    return (
      <>
        {clubsError ? <CAlert color='danger'>{clubsError}</CAlert> : null}
        {clubs.length === 0 ? <CAlert color='secondary' className='mb-0'>Bạn chưa tham gia câu lạc bộ nào.</CAlert> : (
          <div className='sports-me-card-grid sports-me-card-grid-clubs'>
            {clubs.map((item) => <ClubCard key={item.id} item={item} onOpen={openMembershipDetail} />)}
          </div>
        )}
      </>
    )
  }

  function renderAchievementsTab() {
    const isRecordsView = achievementView === 'records'

    return (
      <>
        <div className='sports-me-subview-bar'>
          <CNav variant='pills' className='sports-me-subview-nav'>
            {ACHIEVEMENT_VIEWS.map((item) => (
              <CNavItem key={item.key}>
                <CNavLink active={achievementView === item.key} onClick={() => setAchievementView(item.key)} role='button'>
                  {item.key === 'records' ? `${item.label} (${achievements.length})` : `${item.label} (${submissions.length})`}
                </CNavLink>
              </CNavItem>
            ))}
          </CNav>
          <div className='sports-me-filter-toolbar'>
            <div className='sports-me-filter-control'>
              <CFormLabel>{isRecordsView ? 'Trạng thái thành tích' : 'Trạng thái đề nghị'}</CFormLabel>
              {isRecordsView ? (
                <CFormSelect value={achievementStatusFilter} onChange={(event) => setAchievementStatusFilter(event.target.value)}>
                  <option value='all'>Tất cả</option>
                  {ACHIEVEMENT_STATUS_FILTER_OPTIONS.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </CFormSelect>
              ) : (
                <CFormSelect value={submissionStatusFilter} onChange={(event) => setSubmissionStatusFilter(event.target.value)}>
                  {SUBMISSION_FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </CFormSelect>
              )}
            </div>
          </div>
        </div>

        {isRecordsView ? (
          <>
            {achievementsError ? <CAlert color='danger'>{achievementsError}</CAlert> : null}
            {filteredAchievements.length === 0 ? <CAlert color='secondary' className='mb-0'>Bạn chưa có thành tích nào được ghi nhận.</CAlert> : (
              <div className='sports-me-card-grid'>
                {filteredAchievements.map((item) => <AchievementCard key={item.id} item={item} onOpen={openAchievementDetail} />)}
              </div>
            )}
          </>
        ) : (
          <>
            {submissionsError ? <CAlert color='danger'>{submissionsError}</CAlert> : null}
            {filteredSubmissions.length === 0 ? <CAlert color='secondary' className='mb-0'>Bạn chưa gửi đề nghị ghi nhận thành tích nào.</CAlert> : (
              <div className='sports-me-card-grid'>
                {filteredSubmissions.map((item) => <SubmissionCard key={item.id} item={item} onOpen={openSubmissionDetail} />)}
              </div>
            )}
          </>
        )}
      </>
    )
  }

  if (loading) {
    return <div className='d-flex align-items-center gap-2'><CSpinner size='sm' />Đang tải hồ sơ thể thao của bạn...</div>
  }

  if (noProfile) {
    return (
      <div>
        <div className='fs-5 fw-semibold mb-2'>Hồ sơ thể thao của tôi</div>
        {error ? <CAlert color='danger'>{error}</CAlert> : null}
        {success ? <CAlert color='success'>{success}</CAlert> : null}
        <div className='mb-3'>
          <CAlert color='secondary' className='mb-0'>Bạn chưa có hồ sơ thể thao trong tenant hiện tại. Bạn có thể tự tạo hồ sơ cho chính mình.</CAlert>
        </div>
        <CreateSportsProfileCard form={createForm} errors={createFormErrors} submitting={creatingProfile} onChange={updateCreateField} onSubmit={handleCreateProfile} />
      </div>
    )
  }

  if (!profileBundle.profile) {
    return <CAlert color='danger'>{error || 'Không tải được hồ sơ thể thao của bạn.'}</CAlert>
  }

  return (
    <div className='sports-me-page'>
      <div className='mb-4'>
        <div className='fs-5 fw-semibold'>Hồ sơ thể thao của tôi</div>
        <div className='text-body-secondary'>Hồ sơ, câu lạc bộ và hành trình thể thao của bạn.</div>
      </div>

      {error ? <CAlert color='danger'>{error}</CAlert> : null}
      {success ? <CAlert color='success'>{success}</CAlert> : null}

      <SportsMeProfileHero profile={profileBundle.profile} refreshing={refreshing} editing={editing} onRefresh={() => loadPage(true)} onEdit={() => { setEditing(true); setProfileForm(buildProfileFormValues(profileBundle.profile)) }} />

      <CNav variant='tabs' className='sports-me-tabs mb-4 flex-nowrap overflow-auto'>
        {TABS.map((item) => (
          <CNavItem key={item.key}>
            <CNavLink active={activeTab === item.key} onClick={() => navigate(item.key === 'overview' ? basePath : `${basePath}/${item.key}`)} role='button'>
              {item.label}
            </CNavLink>
          </CNavItem>
        ))}
      </CNav>

      {activeTab === 'overview' ? renderOverviewTab() : null}
      {activeTab === 'clubs' ? renderClubsTab() : null}
      {activeTab === 'achievements' ? renderAchievementsTab() : null}

      <MembershipDetailModal visible={membershipModal.visible} membership={membershipModal.membership} historyRows={membershipModal.history} loadingHistory={membershipModal.loading} onClose={() => setMembershipModal({ visible: false, membership: null, history: [], loading: false })} />
      <AchievementDetailModal visible={achievementModal.visible} achievement={achievementModal.achievement} onClose={() => setAchievementModal({ visible: false, achievement: null })} />
      <SubmissionDetailModal visible={submissionModal.visible} submission={submissionModal.submission} onClose={() => setSubmissionModal({ visible: false, submission: null })} />
    </div>
  )
}
