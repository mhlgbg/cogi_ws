import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import * as XLSX from 'xlsx'
import api from '../../../api/axios'

function toRoleName(role) {
  return role?.name || role?.type || `Role #${role?.id || ''}`
}

function normalizeImportText(value) {
  return typeof value === 'string' ? value.trim() : String(value ?? '').trim()
}

function normalizeImportEmail(value) {
  return normalizeImportText(value).toLowerCase()
}

function normalizePreviewRow(row) {
  return {
    username: normalizeImportText(row?.username),
    email: normalizeImportEmail(row?.email),
    fullName: normalizeImportText(row?.fullName),
    password: normalizeImportText(row?.password),
  }
}

function normalizeRoleUpdatePreviewRow(row) {
  return {
    username: normalizeImportText(row?.username),
  }
}

function parseWorkbookPreview(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const bytes = new Uint8Array(event.target?.result || [])
        const workbook = XLSX.read(bytes, { type: 'array' })
        const firstSheetName = workbook.SheetNames?.[0]

        if (!firstSheetName) {
          reject(new Error('File Excel không có sheet dữ liệu'))
          return
        }

        const worksheet = workbook.Sheets[firstSheetName]
        const rows = XLSX.utils.sheet_to_json(worksheet, {
          defval: '',
          raw: false,
        })

        if (!Array.isArray(rows) || rows.length === 0) {
          reject(new Error('File Excel không có dòng dữ liệu'))
          return
        }

        const sampleRows = rows.slice(0, 5).map(normalizePreviewRow)
        const firstRowKeys = Object.keys(rows[0] || {}).map((key) => normalizeImportText(key).toLowerCase())
        const requiredColumns = ['username', 'email', 'fullName', 'password']
        const missingColumns = requiredColumns.filter((key) => !firstRowKeys.includes(key.toLowerCase()))

        resolve({
          totalRows: rows.length,
          sampleRows,
          missingColumns,
        })
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Không thể đọc file Excel'))
    reader.readAsArrayBuffer(file)
  })
}

function parseRoleUpdateWorkbookPreview(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const bytes = new Uint8Array(event.target?.result || [])
        const workbook = XLSX.read(bytes, { type: 'array' })
        const firstSheetName = workbook.SheetNames?.[0]

        if (!firstSheetName) {
          reject(new Error('File Excel không có sheet dữ liệu'))
          return
        }

        const worksheet = workbook.Sheets[firstSheetName]
        const rows = XLSX.utils.sheet_to_json(worksheet, {
          defval: '',
          raw: false,
        })

        if (!Array.isArray(rows) || rows.length === 0) {
          reject(new Error('File Excel không có dòng dữ liệu'))
          return
        }

        const sampleRows = rows.slice(0, 5).map(normalizeRoleUpdatePreviewRow)
        const firstRowKeys = Object.keys(rows[0] || {}).map((key) => normalizeImportText(key).toLowerCase())
        const requiredColumns = ['username']
        const missingColumns = requiredColumns.filter((key) => !firstRowKeys.includes(key.toLowerCase()))

        resolve({
          totalRows: rows.length,
          sampleRows,
          missingColumns,
        })
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => reject(new Error('Không thể đọc file Excel'))
    reader.readAsArrayBuffer(file)
  })
}

function downloadImportTemplate() {
  const rows = [
    {
      username: 'student01',
      email: 'student01@example.com',
      fullName: 'Nguyen Van A',
      password: 'Abc123!@#',
    },
    {
      username: 'student02',
      email: 'student02@example.com',
      fullName: 'Tran Thi B',
      password: 'Xyz456!@#',
    },
  ]

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Users')

  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([content], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'user-import-template.xlsx'
  link.click()
  URL.revokeObjectURL(url)
}

function downloadImportUpdateRoleTemplate() {
  const rows = [
    { username: 'student01' },
    { username: 'student02' },
  ]

  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Users')

  const content = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([content], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'user-import-update-role-template.xlsx'
  link.click()
  URL.revokeObjectURL(url)
}

export default function UserManagementPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [users, setUsers] = useState([])
  const [availableRoles, setAvailableRoles] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [pageCount, setPageCount] = useState(1)
  const [total, setTotal] = useState(0)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const [draftRoleIdsByUserTenant, setDraftRoleIdsByUserTenant] = useState({})
  const [savingByUserTenant, setSavingByUserTenant] = useState({})
  const [showImportModal, setShowImportModal] = useState(false)
  const [showImportUpdateRoleModal, setShowImportUpdateRoleModal] = useState(false)
  const [loadingImportOptions, setLoadingImportOptions] = useState(false)
  const [importRoleId, setImportRoleId] = useState('')
  const [importFile, setImportFile] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importPreviewError, setImportPreviewError] = useState('')
  const [importResult, setImportResult] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importJob, setImportJob] = useState(null)
  const [updateRoleOldRoleId, setUpdateRoleOldRoleId] = useState('')
  const [updateRoleNewRoleId, setUpdateRoleNewRoleId] = useState('')
  const [updateRoleFile, setUpdateRoleFile] = useState(null)
  const [updateRolePreview, setUpdateRolePreview] = useState(null)
  const [updateRoleResult, setUpdateRoleResult] = useState(null)
  const [updateRoleError, setUpdateRoleError] = useState('')
  const [updatingRoleImport, setUpdatingRoleImport] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setSearch(searchInput.trim())
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (!success) return undefined

    const timer = setTimeout(() => {
      setSuccess('')
    }, 2500)

    return () => clearTimeout(timer)
  }, [success])

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError('')

      const response = await api.get('/admin/tenant-users', {
        params: {
          page,
          pageSize,
          search,
        },
      })

      if (!response.data?.ok) {
        setError('Không thể tải danh sách user')
        return
      }

      const nextUsers = Array.isArray(response.data?.data) ? response.data.data : []
      const nextRoles = Array.isArray(response.data?.availableRoles) ? response.data.availableRoles : []
      const meta = response.data?.meta || {}

      setUsers(nextUsers)
      setAvailableRoles(nextRoles)
      setPage(Number(meta.page || page) || 1)
      setPageSize(Number(meta.pageSize || pageSize) || 10)
      setPageCount(Number(meta.pageCount || 1) || 1)
      setTotal(Number(meta.total || 0) || 0)

      const nextDraft = {}
      for (const user of nextUsers) {
        const userTenantId = user?.userTenantId
        if (!userTenantId) continue
        nextDraft[userTenantId] = Array.isArray(user?.activeRoleIds)
          ? user.activeRoleIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
          : []
      }
      setDraftRoleIdsByUserTenant(nextDraft)
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error?.message
        || requestError?.response?.data?.message
        || requestError?.message
        || 'Không thể tải danh sách user'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search])

  useEffect(() => {
    fetchUsers()
  }, [page, pageSize, search])

  const originalRoleIdsByUserTenant = useMemo(() => {
    const map = {}
    for (const user of users) {
      const userTenantId = user?.userTenantId
      if (!userTenantId) continue
      map[userTenantId] = Array.isArray(user?.activeRoleIds)
        ? user.activeRoleIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
        : []
    }
    return map
  }, [users])

  const toggleRole = (userTenantId, roleId) => {
    setDraftRoleIdsByUserTenant((prev) => {
      const current = Array.isArray(prev[userTenantId]) ? prev[userTenantId] : []
      const hasRole = current.includes(roleId)
      return {
        ...prev,
        [userTenantId]: hasRole
          ? current.filter((id) => id !== roleId)
          : [...current, roleId],
      }
    })
  }

  const handleSaveRoles = async (userTenantId) => {
    const roleIds = Array.isArray(draftRoleIdsByUserTenant[userTenantId])
      ? draftRoleIdsByUserTenant[userTenantId]
      : []

    if (roleIds.length === 0) {
      setError('Mỗi user phải có ít nhất một quyền')
      return
    }

    setSavingByUserTenant((prev) => ({ ...prev, [userTenantId]: true }))
    setError('')
    setSuccess('')

    try {
      const response = await api.patch(`/admin/tenant-users/${userTenantId}/roles`, {
        roleIds,
      })

      if (!response.data?.ok) {
        setError('Không thể cập nhật quyền user')
        return
      }

      await fetchUsers()
      setSuccess('Cập nhật quyền user thành công')
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error?.message
        || requestError?.response?.data?.message
        || requestError?.message
        || 'Không thể cập nhật quyền user'
      setError(message)
    } finally {
      setSavingByUserTenant((prev) => ({ ...prev, [userTenantId]: false }))
    }
  }

  const resetImportState = () => {
    setImportRoleId('')
    setImportFile(null)
    setImportPreview(null)
    setImportPreviewError('')
    setImportResult(null)
    setImportJob(null)
  }

  const resetImportUpdateRoleState = () => {
    setUpdateRoleOldRoleId('')
    setUpdateRoleNewRoleId('')
    setUpdateRoleFile(null)
    setUpdateRolePreview(null)
    setUpdateRoleResult(null)
    setUpdateRoleError('')
  }

  const isImportJobActive = ['queued', 'running'].includes(String(importJob?.status || ''))

  useEffect(() => {
    if (!importJob?.id || !isImportJobActive) return undefined

    const timer = window.setInterval(async () => {
      try {
        const response = await api.get(`/users/import/${importJob.id}`)
        const nextJob = response.data?.data || null
        setImportJob(nextJob)

        if (!nextJob) return

        if (nextJob.status === 'completed') {
          setImportResult(nextJob.result || null)
          setSuccess(
            nextJob.result?.summary?.createdCount > 0
              ? `Import thành công ${nextJob.result.summary.createdCount} user mới`
              : 'Import hoàn tất, không có user mới được tạo',
          )
          await fetchUsers()
        }

        if (nextJob.status === 'cancelled') {
          setImportResult(nextJob.result || null)
          setSuccess('Đã dừng tác vụ import')
          await fetchUsers()
        }

        if (nextJob.status === 'failed') {
          setImportPreviewError(nextJob.error || 'Không thể import user')
        }
      } catch (requestError) {
        const message =
          requestError?.response?.data?.error?.message
          || requestError?.response?.data?.message
          || requestError?.message
          || 'Không thể tải tiến độ import user'
        setImportPreviewError(message)
      }
    }, 2000)

    return () => {
      window.clearInterval(timer)
    }
  }, [fetchUsers, importJob?.id, isImportJobActive])

  const loadImportOptions = async () => {
    setLoadingImportOptions(true)
    setImportPreviewError('')
    setUpdateRoleError('')

    try {
      const response = await api.get('/admin/tenant-users', {
        params: {
          page: 1,
          pageSize: 1,
          search: '',
        },
      })
      if (!response.data?.ok) {
        setAvailableRoles([])
        setImportRoleId('')
        setImportPreviewError('Không thể tải danh sách quyền cho thao tác import')
        setUpdateRoleError('Không thể tải danh sách quyền cho thao tác import')
        return
      }

      const nextRoles = Array.isArray(response.data?.availableRoles) ? response.data.availableRoles : []
      setAvailableRoles(nextRoles)
      setImportRoleId('')

      if (nextRoles.length === 0) {
        setImportPreviewError('Tenant hiện chưa có quyền khả dụng để import')
        setUpdateRoleError('Tenant hiện chưa có quyền khả dụng để import')
      }
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error?.message
        || requestError?.response?.data?.message
        || requestError?.message
        || 'Không thể tải danh sách quyền cho thao tác import'
      setAvailableRoles([])
      setImportRoleId('')
      setImportPreviewError(message)
      setUpdateRoleError(message)
    } finally {
      setLoadingImportOptions(false)
    }
  }

  const handleOpenImportModal = async () => {
    resetImportState()
    setShowImportModal(true)
    await loadImportOptions()
  }

  const handleOpenImportUpdateRoleModal = async () => {
    resetImportUpdateRoleState()
    setShowImportUpdateRoleModal(true)
    await loadImportOptions()
  }

  const handleCloseImportModal = () => {
    if (importing) return
    setShowImportModal(false)
  }

  const handleCloseImportUpdateRoleModal = () => {
    if (updatingRoleImport) return
    setShowImportUpdateRoleModal(false)
  }

  const handleImportFileChange = async (event) => {
    const file = event.target.files?.[0] || null
    setImportFile(file)
    setImportResult(null)
    setImportPreview(null)
    setImportPreviewError('')

    if (!file) return

    try {
      const preview = await parseWorkbookPreview(file)
      setImportPreview(preview)
    } catch (previewError) {
      setImportPreviewError(previewError?.message || 'Không thể xem trước file import')
    }
  }

  const handleImportUpdateRoleFileChange = async (event) => {
    const file = event.target.files?.[0] || null
    setUpdateRoleFile(file)
    setUpdateRolePreview(null)
    setUpdateRoleResult(null)
    setUpdateRoleError('')

    if (!file) return

    try {
      const preview = await parseRoleUpdateWorkbookPreview(file)
      setUpdateRolePreview(preview)
    } catch (previewError) {
      setUpdateRoleError(previewError?.message || 'Không thể xem trước file cập nhật role')
    }
  }

  const handleImportUsers = async () => {
    if (!importFile) {
      setImportPreviewError('Vui lòng chọn file Excel để import')
      return
    }

    if (!importRoleId) {
      setImportPreviewError('Vui lòng chọn quyền tenant cho user import')
      return
    }

    setImporting(true)
    setImportPreviewError('')
    setImportResult(null)
    setImportJob(null)
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()
      formData.append('file', importFile)
      formData.append('roleId', importRoleId)

      const response = await api.post('/users/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      const job = response.data?.data || null
      setImportJob(job)
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error?.message
        || requestError?.response?.data?.message
        || requestError?.message
        || 'Không thể import user'
      setImportPreviewError(message)
    } finally {
      setImporting(false)
    }
  }

  const handleCancelImportJob = async () => {
    if (!importJob?.id || !isImportJobActive) return

    setImporting(true)
    setImportPreviewError('')

    try {
      const response = await api.post(`/users/import/${importJob.id}/cancel`)
      setImportJob(response.data?.data || null)
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error?.message
        || requestError?.response?.data?.message
        || requestError?.message
        || 'Không thể dừng tác vụ import user'
      setImportPreviewError(message)
    } finally {
      setImporting(false)
    }
  }

  const handleImportUpdateRole = async () => {
    if (!updateRoleFile) {
      setUpdateRoleError('Vui lòng chọn file Excel để cập nhật role')
      return
    }

    if (!updateRoleOldRoleId) {
      setUpdateRoleError('Vui lòng chọn Old Role')
      return
    }

    if (!updateRoleNewRoleId) {
      setUpdateRoleError('Vui lòng chọn New Role')
      return
    }

    if (updateRoleOldRoleId === updateRoleNewRoleId) {
      setUpdateRoleError('Old Role và New Role phải khác nhau')
      return
    }

    setUpdatingRoleImport(true)
    setUpdateRoleError('')
    setUpdateRoleResult(null)
    setError('')
    setSuccess('')

    try {
      const formData = new FormData()
      formData.append('file', updateRoleFile)
      formData.append('oldRoleId', updateRoleOldRoleId)
      formData.append('newRoleId', updateRoleNewRoleId)

      const response = await api.post('/users/import-update-role', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      const result = response.data?.data || null
      setUpdateRoleResult(result)
      setSuccess(`Cập nhật role hoàn tất: ${result?.updated || 0} user được cập nhật`)
      await fetchUsers()
    } catch (requestError) {
      const message =
        requestError?.response?.data?.error?.message
        || requestError?.response?.data?.message
        || requestError?.message
        || 'Không thể import cập nhật role'
      setUpdateRoleError(message)
    } finally {
      setUpdatingRoleImport(false)
    }
  }

  const importProgressPercent = importJob?.progress?.percent || 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ margin: 0 }}>Quản lý user theo tenant</h2>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Tìm theo email, username, họ tên"
          style={{ minWidth: 280, padding: '8px 10px' }}
        />

        <select
          value={pageSize}
          onChange={(event) => {
            setPage(1)
            setPageSize(Number(event.target.value))
          }}
          style={{ padding: '8px 10px' }}
        >
          <option value={10}>10 / trang</option>
          <option value={20}>20 / trang</option>
          <option value={50}>50 / trang</option>
        </select>

        <button type="button" onClick={fetchUsers} disabled={loading} style={{ padding: '8px 12px' }}>
          {loading ? 'Đang tải...' : 'Tải lại'}
        </button>

        <CButton color="primary" onClick={handleOpenImportModal} disabled={loading}>
          Import Users
        </CButton>
        <CButton color="warning" variant="outline" onClick={handleOpenImportUpdateRoleModal} disabled={loading}>
          Import Update Role
        </CButton>
      </div>

      {error ? (
        <div style={{ color: '#b00020', background: '#ffe8ea', border: '1px solid #ffcdd2', padding: '8px 10px', borderRadius: 6 }}>
          {error}
        </div>
      ) : null}

      {success ? (
        <div style={{ color: '#0f5132', background: '#d1e7dd', border: '1px solid #badbcc', padding: '8px 10px', borderRadius: 6 }}>
          {success}
        </div>
      ) : null}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>User</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Thông tin</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Quyền tenant</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '12px 8px' }}>
                  {loading ? 'Đang tải dữ liệu...' : 'Không có user phù hợp'}
                </td>
              </tr>
            ) : users.map((item) => {
              const userTenantId = item?.userTenantId
              const draftRoleIds = Array.isArray(draftRoleIdsByUserTenant[userTenantId])
                ? draftRoleIdsByUserTenant[userTenantId]
                : []
              const originalRoleIds = Array.isArray(originalRoleIdsByUserTenant[userTenantId])
                ? originalRoleIdsByUserTenant[userTenantId]
                : []

              const draftKey = [...draftRoleIds].sort((a, b) => a - b).join(',')
              const originalKey = [...originalRoleIds].sort((a, b) => a - b).join(',')
              const dirty = draftKey !== originalKey
              const saving = Boolean(savingByUserTenant[userTenantId])

              return (
                <tr key={userTenantId}>
                  <td style={{ borderBottom: '1px solid #eee', padding: '10px 8px', verticalAlign: 'top' }}>
                    <div><strong>{item?.user?.fullName || item?.user?.username || '(no name)'}</strong></div>
                    <div style={{ color: '#666' }}>{item?.user?.email || '-'}</div>
                  </td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '10px 8px', verticalAlign: 'top' }}>
                    <div>
                      Username: {item?.user?.username || '-'}
                      {item?.user?.fullName ? ` - ${item.user.fullName}` : ''}
                    </div>
                    <div>Tenant status: {item?.userTenantStatus || '-'}</div>
                    <div>Confirmed: {item?.user?.confirmed ? 'Yes' : 'No'}</div>
                    <div>Blocked: {item?.user?.blocked ? 'Yes' : 'No'}</div>
                  </td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '10px 8px', verticalAlign: 'top' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(180px, 1fr))', gap: 6 }}>
                      {availableRoles.map((role) => {
                        const roleId = Number(role.id)
                        const checked = draftRoleIds.includes(roleId)
                        return (
                          <label key={`${userTenantId}-${roleId}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleRole(userTenantId, roleId)}
                            />
                            <span>{toRoleName(role)}</span>
                          </label>
                        )
                      })}
                    </div>
                  </td>
                  <td style={{ borderBottom: '1px solid #eee', padding: '10px 8px', verticalAlign: 'top' }}>
                    <button
                      type="button"
                      disabled={!dirty || saving}
                      onClick={() => handleSaveRoles(userTenantId)}
                      style={{ padding: '8px 12px', cursor: !dirty || saving ? 'not-allowed' : 'pointer' }}
                    >
                      {saving ? 'Đang lưu...' : 'Lưu quyền'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>Tổng: <strong>{total}</strong> user</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1 || loading}
            style={{ padding: '6px 10px' }}
          >
            Prev
          </button>
          <span>Trang {page} / {pageCount}</span>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(pageCount, prev + 1))}
            disabled={page >= pageCount || loading}
            style={{ padding: '6px 10px' }}
          >
            Next
          </button>
        </div>
      </div>

      <CModal visible={showImportModal} backdrop="static" size="lg" onClose={handleCloseImportModal}>
        <CModalHeader>
          <CModalTitle>Import Users</CModalTitle>
        </CModalHeader>
        <CModalBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loadingImportOptions ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#666' }}>
              <CSpinner size="sm" />
              <span>Đang tải quyền import...</span>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 240, flex: '1 1 260px' }}>
              <CFormLabel htmlFor="user-import-role">Quyền tenant áp dụng</CFormLabel>
              <CFormSelect
                id="user-import-role"
                value={importRoleId}
                onChange={(event) => setImportRoleId(event.target.value)}
                disabled={importing || loadingImportOptions || availableRoles.length === 0 || isImportJobActive}
              >
                <option value="">Chọn role</option>
                {availableRoles.map((role) => (
                  <option key={role.id} value={role.id}>{toRoleName(role)}</option>
                ))}
              </CFormSelect>
            </div>

            <div>
              <CButton color="secondary" variant="outline" onClick={downloadImportTemplate} disabled={importing || loadingImportOptions}>
                Tải file mẫu
              </CButton>
            </div>
          </div>

          <div>
            <CFormLabel htmlFor="user-import-file">File Excel</CFormLabel>
            <CFormInput
              id="user-import-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportFileChange}
              disabled={importing || loadingImportOptions || availableRoles.length === 0 || isImportJobActive}
            />
            <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
              Template cần các cột: <strong>username</strong>, <strong>email</strong>, <strong>fullName</strong>, <strong>password</strong>.
            </div>
          </div>

          {importPreviewError ? <CAlert color="danger">{importPreviewError}</CAlert> : null}

          {importJob ? (
            <CAlert color={importJob.status === 'failed' ? 'danger' : importJob.status === 'cancelled' ? 'warning' : importJob.status === 'completed' ? 'success' : 'info'}>
              <div><strong>Trạng thái:</strong> {importJob.status}</div>
              <div>
                Tiến độ: {importJob.progress?.processedRows || 0}/{importJob.progress?.totalRows || 0} dòng
                {typeof importProgressPercent === 'number' ? ` (${importProgressPercent}%)` : ''}
              </div>
              <div>
                Tạo mới: {importJob.progress?.createdCount || 0} · Bỏ qua: {importJob.progress?.skippedCount || 0} · Lỗi: {importJob.progress?.errorCount || 0}
              </div>
              {importJob.error ? <div style={{ marginTop: 4 }}>{importJob.error}</div> : null}
            </CAlert>
          ) : null}

          {importPreview ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>Tổng số dòng dữ liệu: <strong>{importPreview.totalRows}</strong></div>
                <div>Xem trước 5 dòng đầu</div>
              </div>

              {Array.isArray(importPreview.missingColumns) && importPreview.missingColumns.length > 0 ? (
                <CAlert color="warning">
                  Thiếu cột bắt buộc: {importPreview.missingColumns.join(', ')}
                </CAlert>
              ) : null}

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Username</th>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Email</th>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Họ tên</th>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.sampleRows.map((row, index) => (
                      <tr key={`${row.username || row.email || 'row'}-${index}`}>
                        <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{row.username || '-'}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{row.email || '-'}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{row.fullName || '-'}</td>
                        <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{row.password || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {importResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CAlert color="success">
                Tổng: {importResult.summary?.totalRows || 0} dòng, tạo mới: {importResult.summary?.createdCount || 0}, bỏ qua: {importResult.summary?.skippedCount || 0}, lỗi: {importResult.summary?.errorCount || 0}.
              </CAlert>

              {Array.isArray(importResult.skipped) && importResult.skipped.length > 0 ? (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Các dòng bị bỏ qua</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Dòng</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Username</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Email</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Lý do</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.skipped.slice(0, 10).map((item) => (
                          <tr key={`skipped-${item.rowNumber}-${item.username}`}>
                            <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.rowNumber}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.username || '-'}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.email || '-'}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {Array.isArray(importResult.errors) && importResult.errors.length > 0 ? (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Các dòng lỗi</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Dòng</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Username</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Email</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Lỗi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.errors.slice(0, 10).map((item) => (
                          <tr key={`error-${item.rowNumber}-${item.username}`}>
                            <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.rowNumber}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.username || '-'}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.email || '-'}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={handleCloseImportModal} disabled={importing}>
            Đóng
          </CButton>
          {isImportJobActive ? (
            <CButton color="danger" variant="outline" onClick={handleCancelImportJob} disabled={importing}>
              {importing ? 'Đang dừng...' : 'Dừng tác vụ'}
            </CButton>
          ) : null}
          <CButton color="primary" onClick={handleImportUsers} disabled={importing || loadingImportOptions || !importFile || availableRoles.length === 0 || isImportJobActive}>
            {importing ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <CSpinner size="sm" />
                Đang khởi chạy...
              </span>
            ) : isImportJobActive ? 'Đang import...' : 'Bắt đầu import'}
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal visible={showImportUpdateRoleModal} backdrop="static" size="lg" onClose={handleCloseImportUpdateRoleModal}>
        <CModalHeader>
          <CModalTitle>Import Update Role</CModalTitle>
        </CModalHeader>
        <CModalBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {loadingImportOptions ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#666' }}>
              <CSpinner size="sm" />
              <span>Đang tải danh sách role...</span>
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ minWidth: 220, flex: '1 1 220px' }}>
              <CFormLabel htmlFor="user-import-update-old-role">Old Role</CFormLabel>
              <CFormSelect
                id="user-import-update-old-role"
                value={updateRoleOldRoleId}
                onChange={(event) => setUpdateRoleOldRoleId(event.target.value)}
                disabled={updatingRoleImport || loadingImportOptions || availableRoles.length === 0}
              >
                <option value="">Chọn role cũ</option>
                {availableRoles.map((role) => (
                  <option key={`old-role-${role.id}`} value={role.id}>{toRoleName(role)}</option>
                ))}
              </CFormSelect>
            </div>

            <div style={{ minWidth: 220, flex: '1 1 220px' }}>
              <CFormLabel htmlFor="user-import-update-new-role">New Role</CFormLabel>
              <CFormSelect
                id="user-import-update-new-role"
                value={updateRoleNewRoleId}
                onChange={(event) => setUpdateRoleNewRoleId(event.target.value)}
                disabled={updatingRoleImport || loadingImportOptions || availableRoles.length === 0}
              >
                <option value="">Chọn role mới</option>
                {availableRoles.map((role) => (
                  <option key={`new-role-${role.id}`} value={role.id}>{toRoleName(role)}</option>
                ))}
              </CFormSelect>
            </div>

            <div>
              <CButton color="secondary" variant="outline" onClick={downloadImportUpdateRoleTemplate} disabled={updatingRoleImport || loadingImportOptions}>
                Tải file mẫu
              </CButton>
            </div>
          </div>

          <div>
            <CFormLabel htmlFor="user-import-update-role-file">File Excel</CFormLabel>
            <CFormInput
              id="user-import-update-role-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportUpdateRoleFileChange}
              disabled={updatingRoleImport || loadingImportOptions || availableRoles.length === 0}
            />
            <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
              Template chỉ cần cột: <strong>username</strong>.
            </div>
          </div>

          {updateRoleError ? <CAlert color="danger">{updateRoleError}</CAlert> : null}

          {updateRolePreview ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>Tổng số dòng dữ liệu: <strong>{updateRolePreview.totalRows}</strong></div>
                <div>Xem trước 5 dòng đầu</div>
              </div>

              {Array.isArray(updateRolePreview.missingColumns) && updateRolePreview.missingColumns.length > 0 ? (
                <CAlert color="warning">
                  Thiếu cột bắt buộc: {updateRolePreview.missingColumns.join(', ')}
                </CAlert>
              ) : null}

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Username</th>
                    </tr>
                  </thead>
                  <tbody>
                    {updateRolePreview.sampleRows.map((row, index) => (
                      <tr key={`${row.username || 'row'}-${index}`}>
                        <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{row.username || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {updateRoleResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <CAlert color="success">
                Tổng: {updateRoleResult.total || 0} dòng, cập nhật: {updateRoleResult.updated || 0}, bỏ qua: {updateRoleResult.skipped || 0}, lỗi: {updateRoleResult.errors || 0}.
              </CAlert>

              {Array.isArray(updateRoleResult.skippedRows) && updateRoleResult.skippedRows.length > 0 ? (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Các dòng bị bỏ qua</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Dòng</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Username</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Lý do</th>
                        </tr>
                      </thead>
                      <tbody>
                        {updateRoleResult.skippedRows.slice(0, 10).map((item) => (
                          <tr key={`update-role-skipped-${item.rowNumber}-${item.username}`}>
                            <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.rowNumber}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.username || '-'}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {Array.isArray(updateRoleResult.errorRows) && updateRoleResult.errorRows.length > 0 ? (
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Các dòng lỗi</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Dòng</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Username</th>
                          <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: '8px' }}>Lỗi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {updateRoleResult.errorRows.slice(0, 10).map((item) => (
                          <tr key={`update-role-error-${item.rowNumber}-${item.username}`}>
                            <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.rowNumber}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.username || '-'}</td>
                            <td style={{ borderBottom: '1px solid #eee', padding: '8px' }}>{item.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={handleCloseImportUpdateRoleModal} disabled={updatingRoleImport}>
            Đóng
          </CButton>
          <CButton color="primary" onClick={handleImportUpdateRole} disabled={updatingRoleImport || loadingImportOptions || !updateRoleFile}>
            {updatingRoleImport ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <CSpinner size="sm" />
                Đang cập nhật...
              </span>
            ) : 'Bắt đầu cập nhật role'}
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}
