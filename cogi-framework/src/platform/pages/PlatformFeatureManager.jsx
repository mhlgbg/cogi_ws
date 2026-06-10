import { useEffect, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import {
  activatePlatformFeatureRole,
  createPlatformFeature,
  deactivatePlatformFeatureRole,
  getApiMessage,
  getPlatformFeatureRoles,
  getPlatformFeatures,
  updatePlatformFeature,
} from '../services/platformApi'

function buildGroupSelectValue(group) {
  const code = String(group?.code || '').trim()
  if (code) return `code:${code}`

  const id = Number(group?.id || 0)
  return id > 0 ? `id:${id}` : ''
}

function createFeatureFormState(feature = null, featureGroups = [], selectedGroup = 'all') {
  const preferredGroupId = feature?.group?.id
    || (selectedGroup.startsWith('id:') ? Number(selectedGroup.slice(3)) : 0)
    || (featureGroups[0]?.id || 0)

  return {
    name: String(feature?.name || '').trim(),
    key: String(feature?.key || '').trim(),
    path: String(feature?.path || '').trim(),
    description: String(feature?.description || '').trim(),
    order: String(feature?.order ?? '0').trim() || '0',
    groupId: preferredGroupId > 0 ? String(preferredGroupId) : '',
  }
}

export default function PlatformFeatureManager() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [featureGroups, setFeatureGroups] = useState([])
  const [features, setFeatures] = useState([])
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [roleModalVisible, setRoleModalVisible] = useState(false)
  const [roleModalLoading, setRoleModalLoading] = useState(false)
  const [roleActionKey, setRoleActionKey] = useState('')
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [activeRoles, setActiveRoles] = useState([])
  const [inactiveRoles, setInactiveRoles] = useState([])
  const [unassignedRoles, setUnassignedRoles] = useState([])
  const [selectedActiveRoleIds, setSelectedActiveRoleIds] = useState([])
  const [selectedRightRoleIds, setSelectedRightRoleIds] = useState([])
  const [featureModalVisible, setFeatureModalVisible] = useState(false)
  const [featureModalLoading, setFeatureModalLoading] = useState(false)
  const [editingFeatureId, setEditingFeatureId] = useState(null)
  const [featureForm, setFeatureForm] = useState(() => createFeatureFormState())

  useEffect(() => {
    let cancelled = false

    async function loadData() {
      setLoading(true)
      setError('')
      setSuccess('')

      try {
        const params = {}
        if (selectedGroup.startsWith('code:')) {
          params.groupCode = selectedGroup.slice(5)
        } else if (selectedGroup.startsWith('id:')) {
          params.groupId = selectedGroup.slice(3)
        }

        const result = await getPlatformFeatures(params)
        if (cancelled) return

        setFeatureGroups(Array.isArray(result?.featureGroups) ? result.featureGroups : [])
        setFeatures(Array.isArray(result?.features) ? result.features : [])
      } catch (requestError) {
        if (cancelled) return
        setError(getApiMessage(requestError, 'Khong tai duoc danh sach feature'))
        setFeatures([])
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [selectedGroup])

  async function reloadFeatures() {
    const params = {}
    if (selectedGroup.startsWith('code:')) {
      params.groupCode = selectedGroup.slice(5)
    } else if (selectedGroup.startsWith('id:')) {
      params.groupId = selectedGroup.slice(3)
    }

    const result = await getPlatformFeatures(params)
    setFeatureGroups(Array.isArray(result?.featureGroups) ? result.featureGroups : [])
    setFeatures(Array.isArray(result?.features) ? result.features : [])
  }

  function formatRoleOptionLabel(role) {
    const roleName = String(role?.name || role?.type || '').trim() || '-'
    const roleType = String(role?.type || '').trim()
    return roleType && roleType.toLowerCase() !== roleName.toLowerCase()
      ? `${roleName} (${roleType})`
      : roleName
  }

  function getRoleStateBadge(role) {
    const state = String(role?.assignmentState || '').trim().toLowerCase()
    if (state === 'inactive') {
      return { color: 'warning', label: 'Da tat' }
    }
    if (state === 'unassigned') {
      return { color: 'secondary', label: 'Chua gan' }
    }
    return null
  }

  function toggleRoleSelection(roleId, setSelectedIds) {
    const nextId = String(roleId)
    setSelectedIds((prev) => (prev.includes(nextId) ? prev.filter((item) => item !== nextId) : [...prev, nextId]))
  }

  function handleOpenCreateFeatureModal() {
    setEditingFeatureId(null)
    setFeatureForm(createFeatureFormState(null, featureGroups, selectedGroup))
    setFeatureModalVisible(true)
    setError('')
    setSuccess('')
  }

  function handleOpenEditFeatureModal(feature) {
    setEditingFeatureId(feature?.id || null)
    setFeatureForm(createFeatureFormState(feature, featureGroups, selectedGroup))
    setFeatureModalVisible(true)
    setError('')
    setSuccess('')
  }

  function handleCloseFeatureModal() {
    if (featureModalLoading) return
    setFeatureModalVisible(false)
    setEditingFeatureId(null)
    setFeatureForm(createFeatureFormState(null, featureGroups, selectedGroup))
  }

  async function handleSubmitFeature() {
    const payload = {
      name: String(featureForm.name || '').trim(),
      key: String(featureForm.key || '').trim(),
      path: String(featureForm.path || '').trim() || null,
      description: String(featureForm.description || '').trim() || null,
      order: String(featureForm.order || '').trim(),
      groupId: String(featureForm.groupId || '').trim(),
    }

    if (!payload.name) {
      setError('Ten feature khong duoc de trong')
      return
    }

    if (!payload.key) {
      setError('Feature key khong duoc de trong')
      return
    }

    if (!payload.groupId) {
      setError('Feature group khong duoc de trong')
      return
    }

    setFeatureModalLoading(true)
    setError('')
    setSuccess('')

    try {
      if (editingFeatureId) {
        await updatePlatformFeature(editingFeatureId, payload)
        setSuccess('Da cap nhat feature thanh cong')
      } else {
        await createPlatformFeature(payload)
        setSuccess('Da them moi feature thanh cong')
      }

      await reloadFeatures()
      handleCloseFeatureModal()
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong luu duoc feature'))
    } finally {
      setFeatureModalLoading(false)
    }
  }

  async function loadFeatureRoleData(featureRow) {
    const result = await getPlatformFeatureRoles(featureRow.id)
    setSelectedFeature(result?.feature || featureRow || null)
    setActiveRoles(Array.isArray(result?.activeRoles) ? result.activeRoles : [])
    setInactiveRoles(Array.isArray(result?.inactiveRoles) ? result.inactiveRoles : [])
    setUnassignedRoles(Array.isArray(result?.unassignedRoles) ? result.unassignedRoles : [])
    setSelectedActiveRoleIds([])
    setSelectedRightRoleIds([])
  }

  async function handleOpenRoleModal(featureRow) {
    setRoleModalVisible(true)
    setRoleModalLoading(true)
    setRoleActionKey('')
    setSelectedFeature(featureRow || null)
    setActiveRoles([])
    setInactiveRoles([])
    setUnassignedRoles([])
    setSelectedActiveRoleIds([])
    setSelectedRightRoleIds([])
    setError('')
    setSuccess('')

    try {
      await loadFeatureRoleData(featureRow)
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong tai duoc danh sach role cua feature'))
      setRoleModalVisible(false)
    } finally {
      setRoleModalLoading(false)
    }
  }

  function handleCloseRoleModal() {
    if (roleModalLoading || roleActionKey) return
    setRoleModalVisible(false)
    setSelectedFeature(null)
    setActiveRoles([])
    setInactiveRoles([])
    setUnassignedRoles([])
    setSelectedActiveRoleIds([])
    setSelectedRightRoleIds([])
  }

  async function handleActivateRoles(roles) {
    if (!selectedFeature?.id || !Array.isArray(roles) || roles.length === 0) return

    setRoleActionKey(`${selectedFeature.id}:activate`)
    setError('')
    setSuccess('')

    try {
      for (const role of roles) {
        await activatePlatformFeatureRole(selectedFeature.id, role.id)
      }

      await loadFeatureRoleData(selectedFeature)
      setSuccess(roles.length > 1 ? 'Da kich hoat roles cho feature' : 'Da kich hoat role cho feature')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong kich hoat duoc role cho feature'))
    } finally {
      setRoleActionKey('')
    }
  }

  async function handleDeactivateRoles(roles) {
    if (!selectedFeature?.id || !Array.isArray(roles) || roles.length === 0) return

    setRoleActionKey(`${selectedFeature.id}:deactivate`)
    setError('')
    setSuccess('')

    try {
      for (const role of roles) {
        await deactivatePlatformFeatureRole(selectedFeature.id, role.id)
      }

      await loadFeatureRoleData(selectedFeature)
      setSuccess(roles.length > 1 ? 'Da tat roles cho feature' : 'Da tat role cho feature')
    } catch (requestError) {
      setError(getApiMessage(requestError, 'Khong tat duoc role cho feature'))
    } finally {
      setRoleActionKey('')
    }
  }

  const rightColumnRoles = [...inactiveRoles, ...unassignedRoles].sort((left, right) => formatRoleOptionLabel(left).localeCompare(formatRoleOptionLabel(right)))
  const selectedActiveRoles = activeRoles.filter((item) => selectedActiveRoleIds.includes(String(item.id)))
  const selectedRightRoles = rightColumnRoles.filter((item) => selectedRightRoleIds.includes(String(item.id)))

  return (
    <CCard>
      <CCardHeader>
        <strong>Platform Feature Manager</strong>
      </CCardHeader>
      <CCardBody>
        <div className='mb-4 text-body-secondary'>
          Xem danh sach feature cua he thong va loc theo feature group de chuan bi cho cac action quan tri tiep theo.
        </div>

        {success ? <CAlert color='success'>{success}</CAlert> : null}

        <CRow className='g-3 align-items-end mb-4'>
          <CCol md={4}>
            <CFormLabel htmlFor='platform-feature-group-filter'>Feature group</CFormLabel>
            <CFormSelect
              id='platform-feature-group-filter'
              value={selectedGroup}
              onChange={(event) => setSelectedGroup(event.target.value)}
              disabled={loading}
            >
              <option value='all'>Tat ca group</option>
              {featureGroups.map((group) => (
                <option key={buildGroupSelectValue(group)} value={buildGroupSelectValue(group)}>
                  {group.name || group.code || `Group #${group.id}`}
                </option>
              ))}
            </CFormSelect>
          </CCol>
          <CCol md={8}>
            <div className='d-flex justify-content-between align-items-end gap-3'>
              <div className='small text-body-secondary'>
                Tong so feature hien thi: <strong>{features.length}</strong>
              </div>
              <div>
                <CButton color='primary' onClick={handleOpenCreateFeatureModal} disabled={loading}>
                  Them moi feature
                </CButton>
              </div>
            </div>
          </CCol>
        </CRow>

        {loading ? (
          <div className='d-flex align-items-center gap-2 mb-3'>
            <CSpinner size='sm' />
            <span>Dang tai danh sach feature...</span>
          </div>
        ) : null}

        {error ? <CAlert color='danger'>{error}</CAlert> : null}

        {features.length === 0 && !loading ? (
          <div className='text-body-secondary'>Khong co feature nao phu hop voi bo loc hien tai.</div>
        ) : (
          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell style={{ width: 220 }}>Group</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 240 }}>Name</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 260 }}>Key</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 180 }}>Path</CTableHeaderCell>
                <CTableHeaderCell>Description</CTableHeaderCell>
                <CTableHeaderCell style={{ width: 220 }}>Actions</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {features.map((feature) => (
                <CTableRow key={feature.id || feature.key}>
                  <CTableDataCell>
                    <div className='d-flex flex-column gap-1'>
                      <div>{feature?.group?.name || '-'}</div>
                      {feature?.group?.code ? <CBadge color='secondary'>{feature.group.code}</CBadge> : null}
                    </div>
                  </CTableDataCell>
                  <CTableDataCell>{feature.name || '-'}</CTableDataCell>
                  <CTableDataCell>{feature.key || '-'}</CTableDataCell>
                  <CTableDataCell>{feature.path || '-'}</CTableDataCell>
                  <CTableDataCell>{feature.description || '-'}</CTableDataCell>
                  <CTableDataCell>
                    <div className='d-flex gap-2 flex-wrap'>
                      <CButton color='secondary' variant='outline' size='sm' onClick={() => handleOpenEditFeatureModal(feature)}>
                        Sua
                      </CButton>
                      <CButton color='info' variant='outline' size='sm' onClick={() => handleOpenRoleModal(feature)}>
                        Roles
                      </CButton>
                    </div>
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        )}

        <CModal visible={featureModalVisible} onClose={handleCloseFeatureModal}>
          <CModalHeader closeButton={!featureModalLoading}>
            <CModalTitle>{editingFeatureId ? 'Sua feature' : 'Them moi feature'}</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <CRow className='g-3'>
              <CCol md={12}>
                <CFormLabel htmlFor='platform-feature-name'>Ten feature</CFormLabel>
                <CFormInput
                  id='platform-feature-name'
                  value={featureForm.name}
                  onChange={(event) => setFeatureForm((prev) => ({ ...prev, name: event.target.value }))}
                  disabled={featureModalLoading}
                />
              </CCol>
              <CCol md={12}>
                <CFormLabel htmlFor='platform-feature-key'>Feature key</CFormLabel>
                <CFormInput
                  id='platform-feature-key'
                  value={featureForm.key}
                  onChange={(event) => setFeatureForm((prev) => ({ ...prev, key: event.target.value }))}
                  disabled={featureModalLoading}
                />
              </CCol>
              <CCol md={6}>
                <CFormLabel htmlFor='platform-feature-group'>Feature group</CFormLabel>
                <CFormSelect
                  id='platform-feature-group'
                  value={featureForm.groupId}
                  onChange={(event) => setFeatureForm((prev) => ({ ...prev, groupId: event.target.value }))}
                  disabled={featureModalLoading}
                >
                  <option value=''>Chon feature group</option>
                  {featureGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name || group.code || `Group #${group.id}`}
                    </option>
                  ))}
                </CFormSelect>
              </CCol>
              <CCol md={6}>
                <CFormLabel htmlFor='platform-feature-order'>Order</CFormLabel>
                <CFormInput
                  id='platform-feature-order'
                  type='number'
                  value={featureForm.order}
                  onChange={(event) => setFeatureForm((prev) => ({ ...prev, order: event.target.value }))}
                  disabled={featureModalLoading}
                />
              </CCol>
              <CCol md={12}>
                <CFormLabel htmlFor='platform-feature-path'>Path</CFormLabel>
                <CFormInput
                  id='platform-feature-path'
                  value={featureForm.path}
                  onChange={(event) => setFeatureForm((prev) => ({ ...prev, path: event.target.value }))}
                  disabled={featureModalLoading}
                />
              </CCol>
              <CCol md={12}>
                <CFormLabel htmlFor='platform-feature-description'>Description</CFormLabel>
                <CFormTextarea
                  id='platform-feature-description'
                  rows={4}
                  value={featureForm.description}
                  onChange={(event) => setFeatureForm((prev) => ({ ...prev, description: event.target.value }))}
                  disabled={featureModalLoading}
                />
              </CCol>
            </CRow>
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={handleCloseFeatureModal} disabled={featureModalLoading}>
              Dong
            </CButton>
            <CButton color='primary' onClick={handleSubmitFeature} disabled={featureModalLoading}>
              {featureModalLoading ? 'Dang luu...' : 'Luu'}
            </CButton>
          </CModalFooter>
        </CModal>

        <CModal visible={roleModalVisible} onClose={handleCloseRoleModal} size='xl'>
          <CModalHeader closeButton={!roleModalLoading && !roleActionKey}>
            <CModalTitle>
              Quan ly roles cho feature {selectedFeature?.name ? `- ${selectedFeature.name}` : ''}
            </CModalTitle>
          </CModalHeader>
          <CModalBody>
            {roleModalLoading ? (
              <div className='d-flex align-items-center gap-2'>
                <CSpinner size='sm' />
                <span>Dang tai danh sach role...</span>
              </div>
            ) : (
              <CRow className='g-3 align-items-center'>
                <CCol md={5}>
                  <CFormLabel>Roles dang active</CFormLabel>
                  <div className='border rounded p-2 d-flex flex-column gap-2 overflow-auto' style={{ minHeight: '32rem', maxHeight: '32rem' }}>
                    {activeRoles.length === 0 ? (
                      <div className='text-medium-emphasis small'>Khong co role active nao.</div>
                    ) : (
                      activeRoles.map((role) => {
                        const selected = selectedActiveRoleIds.includes(String(role.id))
                        return (
                          <div
                            key={`active-${role.id}`}
                            className={`border rounded px-3 py-2 ${selected ? 'border-primary bg-primary bg-opacity-10' : ''}`}
                            role='button'
                            tabIndex={0}
                            onClick={() => toggleRoleSelection(role.id, setSelectedActiveRoleIds)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                toggleRoleSelection(role.id, setSelectedActiveRoleIds)
                              }
                            }}
                          >
                            <div className='d-flex gap-2'>
                              <CFormCheck
                                className='mt-1'
                                checked={selected}
                                onChange={() => toggleRoleSelection(role.id, setSelectedActiveRoleIds)}
                                onClick={(event) => event.stopPropagation()}
                              />
                              <div>
                                <div className='fw-semibold'>{formatRoleOptionLabel(role)}</div>
                                {role.description ? <div className='small text-medium-emphasis'>{role.description}</div> : null}
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </CCol>

                <CCol md={2}>
                  <div className='d-flex flex-column gap-2'>
                    <CButton
                      color='primary'
                      onClick={() => handleActivateRoles(selectedRightRoles)}
                      disabled={roleModalLoading || Boolean(roleActionKey) || selectedRightRoles.length === 0}
                    >
                      {'<<'}
                    </CButton>
                    <CButton
                      color='secondary'
                      onClick={() => handleDeactivateRoles(selectedActiveRoles)}
                      disabled={roleModalLoading || Boolean(roleActionKey) || selectedActiveRoles.length === 0}
                    >
                      {'>>'}
                    </CButton>
                  </div>
                </CCol>

                <CCol md={5}>
                  <CFormLabel>Roles inactive va chua gan</CFormLabel>
                  <div className='border rounded p-2 d-flex flex-column gap-2 overflow-auto' style={{ minHeight: '32rem', maxHeight: '32rem' }}>
                    {rightColumnRoles.length === 0 ? (
                      <div className='text-medium-emphasis small'>Khong co role nao o cot phai.</div>
                    ) : (
                      rightColumnRoles.map((role) => {
                        const selected = selectedRightRoleIds.includes(String(role.id))
                        const badge = getRoleStateBadge(role)
                        return (
                          <div
                            key={`${role.assignmentState}-${role.id}`}
                            className={`border rounded px-3 py-2 ${selected ? 'border-primary bg-primary bg-opacity-10' : ''}`}
                            role='button'
                            tabIndex={0}
                            onClick={() => toggleRoleSelection(role.id, setSelectedRightRoleIds)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                toggleRoleSelection(role.id, setSelectedRightRoleIds)
                              }
                            }}
                          >
                            <div className='d-flex justify-content-between align-items-start gap-3'>
                              <div className='d-flex gap-2'>
                                <CFormCheck
                                  className='mt-1'
                                  checked={selected}
                                  onChange={() => toggleRoleSelection(role.id, setSelectedRightRoleIds)}
                                  onClick={(event) => event.stopPropagation()}
                                />
                                <div>
                                  <div className='fw-semibold'>{formatRoleOptionLabel(role)}</div>
                                  {role.description ? <div className='small text-medium-emphasis'>{role.description}</div> : null}
                                </div>
                              </div>
                              {badge ? <CBadge color={badge.color}>{badge.label}</CBadge> : null}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </CCol>
              </CRow>
            )}
          </CModalBody>
          <CModalFooter>
            <CButton color='secondary' variant='outline' onClick={handleCloseRoleModal} disabled={roleModalLoading || Boolean(roleActionKey)}>
              Dong
            </CButton>
          </CModalFooter>
        </CModal>
      </CCardBody>
    </CCard>
  )
}