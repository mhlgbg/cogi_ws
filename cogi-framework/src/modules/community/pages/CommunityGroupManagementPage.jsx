import { useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import AsyncCombobox from '../../../components/AsyncCombobox'
import api from '../../../api/axios'
import { listSportsClubs } from '../../sports/services/sportsClubService'
import {
  addCommunityGroupMember,
  archiveCommunityGroup,
  createCommunityGroup,
  getCommunityApiMessage,
  getCommunityGroupMembers,
  getCommunityGroups,
  removeCommunityGroupMember,
  updateCommunityGroup,
  updateCommunityGroupMember,
} from '../services/communityRuntimeService'

function toDateTimeLabel(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

function createGroupForm() {
  return {
    name: '',
    slug: '',
    description: '',
    visibility: 'members',
    linkedType: 'none',
    linkedClub: '',
    allowMemberPost: true,
    memberPostRequiresApproval: true,
  }
}

function normalizeClubOption(club) {
  if (!club || typeof club !== 'object') return null
  const id = Number(club.id || 0)
  if (!id) return null

  return {
    value: id,
    label: [club.name, club.code || club.slug].filter(Boolean).join(' — '),
    id,
    name: club.name || '',
    code: club.code || '',
    slug: club.slug || '',
    logo: club.logo || null,
  }
}

function normalizeUserOption(user) {
  if (!user || typeof user !== 'object') return null
  const id = Number(user.id || 0)
  if (!id) return null

  const fullName = String(user.fullName || user.name || '').trim()
  const username = String(user.username || '').trim()
  const email = String(user.email || '').trim()

  return {
    value: id,
    label: [fullName || username || email || `User #${id}`, username ? `@${username}` : '', email].filter(Boolean).join(' • '),
    id,
    fullName,
    username,
    email,
    avatar: user.avatar || null,
  }
}

export default function CommunityGroupManagementPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showFormModal, setShowFormModal] = useState(false)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [groupForm, setGroupForm] = useState(createGroupForm())
  const [clubSearchLoading, setClubSearchLoading] = useState(false)
  const [selectedClubOption, setSelectedClubOption] = useState(null)
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [memberRows, setMemberRows] = useState([])
  const [activeGroupForMember, setActiveGroupForMember] = useState(null)
  const [selectedMemberOption, setSelectedMemberOption] = useState(null)
  const [memberSearchLoading, setMemberSearchLoading] = useState(false)
  const [newMemberRole, setNewMemberRole] = useState('member')

  async function loadGroups() {
    setLoading(true)
    setError('')
    try {
      const result = await getCommunityGroups({ page: 1, pageSize: 100, status: '' })
      setRows(result?.rows || [])
    } catch (requestError) {
      setRows([])
      setError(getCommunityApiMessage(requestError, 'Không tải được danh sách group.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGroups()
  }, [])

  function openCreate() {
    setEditingGroup(null)
    setGroupForm(createGroupForm())
    setShowFormModal(true)
  }

  function openEdit(group) {
    setEditingGroup(group)
    const club = group?.linkedClub && typeof group.linkedClub === 'object' ? group.linkedClub : null
    const clubOption = club ? normalizeClubOption(club) : null
    setSelectedClubOption(clubOption)
    setGroupForm({
      name: group.name || '',
      slug: group.slug || '',
      description: group.description || '',
      visibility: group.visibility || 'members',
      linkedType: group.linkedType || 'none',
      linkedClub: clubOption ? String(clubOption.id) : '',
      allowMemberPost: group.allowMemberPost !== false,
      memberPostRequiresApproval: group.memberPostRequiresApproval !== false,
    })
    setShowFormModal(true)
  }

  async function loadClubOptions(inputValue = '') {
    const query = String(inputValue || '').trim()
    if (query.length < 2) return []
    setClubSearchLoading(true)
    try {
      const result = await listSportsClubs({ page: 1, pageSize: 20, search: query, sort: 'name:asc' })
      const rows = Array.isArray(result?.rows) ? result.rows : []
      return rows.map(normalizeClubOption).filter(Boolean)
    } catch (requestError) {
      return []
    } finally {
      setClubSearchLoading(false)
    }
  }

  async function submitGroup() {
    setFormSubmitting(true)
    setError('')
    try {
      const payload = {
        ...groupForm,
        linkedClub: groupForm.linkedType === 'club' ? Number(groupForm.linkedClub || 0) || null : null,
      }
      if (editingGroup?.id) {
        await updateCommunityGroup(editingGroup.id, payload)
        setSuccess('Cập nhật group thành công.')
      } else {
        await createCommunityGroup(payload)
        setSuccess('Tạo group thành công.')
      }
      setShowFormModal(false)
      await loadGroups()
    } catch (requestError) {
      setError(getCommunityApiMessage(requestError, 'Không thể lưu group.'))
    } finally {
      setFormSubmitting(false)
    }
  }

  async function runArchive(group) {
    if (!window.confirm(`Archive group "${group.name || group.id}"?`)) return
    setError('')
    try {
      await archiveCommunityGroup(group.id)
      setSuccess('Đã archive group.')
      await loadGroups()
    } catch (requestError) {
      setError(getCommunityApiMessage(requestError, 'Không thể archive group.'))
    }
  }

  async function loadMemberOptions(inputValue = '') {
    const query = String(inputValue || '').trim()
    if (query.length < 2) return []
    setMemberSearchLoading(true)
    try {
      const response = await api.get('/admin/tenant-users', {
        params: { page: 1, pageSize: 20, search: query },
      })
      const rows = Array.isArray(response?.data?.data) ? response.data.data : []
      const existingMemberIds = new Set((memberRows || []).map((member) => Number(member.user?.id || 0)).filter(Boolean))
      return rows
        .map((row) => normalizeUserOption(row.user || row))
        .filter(Boolean)
        .filter((option) => !existingMemberIds.has(option.id))
        .slice(0, 20)
    } catch (requestError) {
      return []
    } finally {
      setMemberSearchLoading(false)
    }
  }

  async function openMemberManagement(group) {
    setActiveGroupForMember(group)
    setShowMemberModal(true)
    setSelectedMemberOption(null)
    setError('')
    try {
      const rows = await getCommunityGroupMembers(group.id)
      setMemberRows(rows || [])
    } catch (requestError) {
      setMemberRows([])
      setError(getCommunityApiMessage(requestError, 'Không tải được danh sách thành viên.'))
    }
  }

  async function addMember() {
    if (!activeGroupForMember?.id || !selectedMemberOption?.id) return
    setError('')
    try {
      await addCommunityGroupMember(activeGroupForMember.id, {
        userId: Number(selectedMemberOption.id),
        role: newMemberRole,
      })
      setSelectedMemberOption(null)
      const rows = await getCommunityGroupMembers(activeGroupForMember.id)
      setMemberRows(rows || [])
    } catch (requestError) {
      setError(getCommunityApiMessage(requestError, 'Không thể thêm thành viên.'))
    }
  }

  async function updateMemberRole(member, nextRole) {
    if (!activeGroupForMember?.id) return
    setError('')
    try {
      await updateCommunityGroupMember(activeGroupForMember.id, member.id, { role: nextRole })
      const rows = await getCommunityGroupMembers(activeGroupForMember.id)
      setMemberRows(rows || [])
    } catch (requestError) {
      setError(getCommunityApiMessage(requestError, 'Không thể cập nhật role.'))
    }
  }

  async function removeMember(member) {
    if (!activeGroupForMember?.id) return
    if (!window.confirm(`Xóa thành viên ${member.user?.username || member.user?.email || member.user?.id}?`)) return
    setError('')
    try {
      await removeCommunityGroupMember(activeGroupForMember.id, member.id)
      const rows = await getCommunityGroupMembers(activeGroupForMember.id)
      setMemberRows(rows || [])
    } catch (requestError) {
      setError(getCommunityApiMessage(requestError, 'Không thể xóa thành viên.'))
    }
  }

  return (
    <CCard>
      <CCardHeader className='d-flex justify-content-between align-items-center'>
        <strong>Community Group Management</strong>
        <div className='d-flex gap-2'>
          <CButton color='secondary' variant='outline' onClick={loadGroups}>Tải lại</CButton>
          <CButton color='primary' onClick={openCreate}>Tạo Group</CButton>
        </div>
      </CCardHeader>
      <CCardBody>
        {success ? <CAlert color='success'>{success}</CAlert> : null}
        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        {loading ? (
          <div className='d-flex gap-2 align-items-center'><CSpinner size='sm' />Đang tải...</div>
        ) : (
          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Name</CTableHeaderCell>
                <CTableHeaderCell>Visibility</CTableHeaderCell>
                <CTableHeaderCell>Status</CTableHeaderCell>
                <CTableHeaderCell>Linked Club</CTableHeaderCell>
                <CTableHeaderCell>Updated At</CTableHeaderCell>
                <CTableHeaderCell className='text-end'>Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {rows.length === 0 ? (
                <CTableRow><CTableDataCell colSpan={6} className='text-center text-body-secondary py-4'>Chưa có group.</CTableDataCell></CTableRow>
              ) : rows.map((group) => (
                <CTableRow key={`group:${group.id}`}>
                  <CTableDataCell>
                    <div className='fw-semibold'>{group.name || `Group #${group.id}`}</div>
                    <div className='small text-body-secondary'>/{group.slug}</div>
                  </CTableDataCell>
                  <CTableDataCell>{group.visibility}</CTableDataCell>
                  <CTableDataCell>{group.status}</CTableDataCell>
                  <CTableDataCell>{group.linkedClub?.name || '—'}</CTableDataCell>
                  <CTableDataCell>{toDateTimeLabel(group.updatedAt)}</CTableDataCell>
                  <CTableDataCell className='text-end'>
                    <div className='d-flex gap-2 justify-content-end'>
                      <CButton size='sm' color='light' onClick={() => openEdit(group)}>Edit</CButton>
                      <CButton size='sm' color='info' variant='outline' onClick={() => openMemberManagement(group)}>Members</CButton>
                      <CButton size='sm' color='warning' variant='outline' disabled={group.status === 'archived'} onClick={() => runArchive(group)}>Archive</CButton>
                    </div>
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        )}
      </CCardBody>

      <CModal visible={showFormModal} onClose={() => setShowFormModal(false)}>
        <CModalHeader><CModalTitle>{editingGroup?.id ? 'Edit Group' : 'Create Group'}</CModalTitle></CModalHeader>
        <CModalBody>
          <div className='d-flex flex-column gap-2'>
            <CFormInput placeholder='Name' value={groupForm.name} onChange={(event) => setGroupForm((prev) => ({ ...prev, name: event.target.value }))} />
            <CFormInput placeholder='Slug (optional)' value={groupForm.slug} onChange={(event) => setGroupForm((prev) => ({ ...prev, slug: event.target.value }))} />
            <CFormTextarea rows={3} placeholder='Description' value={groupForm.description} onChange={(event) => setGroupForm((prev) => ({ ...prev, description: event.target.value }))} />
            <CFormSelect value={groupForm.visibility} onChange={(event) => setGroupForm((prev) => ({ ...prev, visibility: event.target.value }))}>
              <option value='public'>public</option>
              <option value='members'>members</option>
            </CFormSelect>
            <CFormSelect value={groupForm.linkedType} onChange={(event) => {
              const linkedType = event.target.value
              setGroupForm((prev) => ({
                ...prev,
                linkedType,
                linkedClub: linkedType === 'club' ? prev.linkedClub : '',
              }))
              if (linkedType !== 'club') {
                setSelectedClubOption(null)
              }
            }}>
              <option value='none'>none</option>
              <option value='club'>club</option>
            </CFormSelect>
            {groupForm.linkedType === 'club' ? (
              <div className='d-flex flex-column gap-2'>
                <label className='form-label mb-0'>Linked Club</label>
                <AsyncCombobox
                  loadOptions={loadClubOptions}
                  value={selectedClubOption}
                  onChange={(option) => {
                    setSelectedClubOption(option || null)
                    setGroupForm((prev) => ({ ...prev, linkedClub: option ? String(option.value) : '' }))
                  }}
                  placeholder='Tìm CLB theo tên...'
                  isLoading={clubSearchLoading}
                  defaultOptions={false}
                  noOptionsMessage={() => 'Không tìm thấy kết quả phù hợp.'}
                  formatOptionLabel={(option) => (
                    <div className='d-flex flex-column'>
                      <span className='fw-semibold'>{option?.name || option?.label}</span>
                      {option?.code || option?.slug ? <small className='text-body-secondary'>{option.code || option.slug}</small> : null}
                    </div>
                  )}
                />
              </div>
            ) : null}
            <CFormCheck label='Allow member post' checked={groupForm.allowMemberPost} onChange={(event) => setGroupForm((prev) => ({ ...prev, allowMemberPost: event.target.checked }))} />
            <CFormCheck label='Member post requires approval' checked={groupForm.memberPostRequiresApproval} onChange={(event) => setGroupForm((prev) => ({ ...prev, memberPostRequiresApproval: event.target.checked }))} />
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color='light' onClick={() => setShowFormModal(false)}>Hủy</CButton>
          <CButton color='primary' onClick={submitGroup} disabled={formSubmitting}>{formSubmitting ? 'Đang lưu...' : 'Lưu'}</CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={showMemberModal} onClose={() => setShowMemberModal(false)} size='lg'>
        <CModalHeader><CModalTitle>Members · {activeGroupForMember?.name || 'Group'}</CModalTitle></CModalHeader>
        <CModalBody>
          <div className='d-flex flex-column flex-md-row gap-2 mb-3'>
            <div className='flex-grow-1'>
              <label className='form-label mb-1'>Tìm thành viên</label>
              <AsyncCombobox
                loadOptions={loadMemberOptions}
                value={selectedMemberOption}
                onChange={(option) => {
                  setSelectedMemberOption(option || null)
                }}
                placeholder='Nhập tên, username hoặc email...'
                isLoading={memberSearchLoading}
                defaultOptions={false}
                isClearable
                noOptionsMessage={() => 'Không tìm thấy kết quả phù hợp.'}
                formatOptionLabel={(option) => (
                  <div className='d-flex flex-column'>
                    <span className='fw-semibold'>{option?.fullName || option?.username || option?.email || option?.label}</span>
                    <small className='text-body-secondary'>
                      {option?.username ? `@${option.username}` : ''}
                      {option?.username && option?.email ? ' • ' : ''}
                      {option?.email || ''}
                    </small>
                  </div>
                )}
              />
            </div>
            <div style={{ minWidth: 180 }}>
              <label className='form-label mb-1'>Role</label>
              <CFormSelect value={newMemberRole} onChange={(event) => setNewMemberRole(event.target.value)}>
                <option value='member'>member</option>
                <option value='moderator'>moderator</option>
                <option value='owner'>owner</option>
              </CFormSelect>
            </div>
          </div>
          <div className='d-flex justify-content-end mb-3'>
            <CButton onClick={addMember} disabled={!selectedMemberOption}>Thêm</CButton>
          </div>
          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>User</CTableHeaderCell>
                <CTableHeaderCell>Role</CTableHeaderCell>
                <CTableHeaderCell>Status</CTableHeaderCell>
                <CTableHeaderCell>Joined At</CTableHeaderCell>
                <CTableHeaderCell className='text-end'>Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {memberRows.length === 0 ? (
                <CTableRow><CTableDataCell colSpan={5} className='text-center text-body-secondary py-3'>Chưa có thành viên.</CTableDataCell></CTableRow>
              ) : memberRows.map((member) => (
                <CTableRow key={`member:${member.id}`}>
                  <CTableDataCell>{member.user?.fullName || member.user?.username || member.user?.email || member.user?.id}</CTableDataCell>
                  <CTableDataCell>
                    <CFormSelect size='sm' value={member.role} onChange={(event) => updateMemberRole(member, event.target.value)}>
                      <option value='member'>member</option>
                      <option value='moderator'>moderator</option>
                      <option value='owner'>owner</option>
                    </CFormSelect>
                  </CTableDataCell>
                  <CTableDataCell>{member.status}</CTableDataCell>
                  <CTableDataCell>{toDateTimeLabel(member.joinedAt)}</CTableDataCell>
                  <CTableDataCell className='text-end'>
                    <CButton size='sm' color='danger' variant='outline' onClick={() => removeMember(member)}>Remove</CButton>
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </CModalBody>
      </CModal>
    </CCard>
  )
}

