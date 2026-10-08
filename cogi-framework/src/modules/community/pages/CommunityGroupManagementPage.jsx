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

export default function CommunityGroupManagementPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showFormModal, setShowFormModal] = useState(false)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const [groupForm, setGroupForm] = useState(createGroupForm())
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [memberRows, setMemberRows] = useState([])
  const [activeGroupForMember, setActiveGroupForMember] = useState(null)
  const [newMemberUserId, setNewMemberUserId] = useState('')
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
    setGroupForm({
      name: group.name || '',
      slug: group.slug || '',
      description: group.description || '',
      visibility: group.visibility || 'members',
      linkedType: group.linkedType || 'none',
      linkedClub: group.linkedClub?.id ? String(group.linkedClub.id) : '',
      allowMemberPost: group.allowMemberPost !== false,
      memberPostRequiresApproval: group.memberPostRequiresApproval !== false,
    })
    setShowFormModal(true)
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

  async function openMemberManagement(group) {
    setActiveGroupForMember(group)
    setShowMemberModal(true)
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
    if (!activeGroupForMember?.id) return
    setError('')
    try {
      await addCommunityGroupMember(activeGroupForMember.id, {
        userId: Number(newMemberUserId || 0),
        role: newMemberRole,
      })
      setNewMemberUserId('')
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
            <CFormSelect value={groupForm.linkedType} onChange={(event) => setGroupForm((prev) => ({ ...prev, linkedType: event.target.value, linkedClub: '' }))}>
              <option value='none'>none</option>
              <option value='club'>club</option>
            </CFormSelect>
            {groupForm.linkedType === 'club' ? <CFormInput placeholder='Linked Club ID' value={groupForm.linkedClub} onChange={(event) => setGroupForm((prev) => ({ ...prev, linkedClub: event.target.value }))} /> : null}
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
          <div className='d-flex gap-2 mb-3'>
            <CFormInput placeholder='User ID' value={newMemberUserId} onChange={(event) => setNewMemberUserId(event.target.value)} />
            <CFormSelect value={newMemberRole} onChange={(event) => setNewMemberRole(event.target.value)}>
              <option value='member'>member</option>
              <option value='moderator'>moderator</option>
              <option value='owner'>owner</option>
            </CFormSelect>
            <CButton onClick={addMember}>Thêm</CButton>
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

