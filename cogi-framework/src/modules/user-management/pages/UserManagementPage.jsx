import { useEffect, useMemo, useState } from 'react'
import api from '../../../api/axios'

function toRoleName(role) {
  return role?.name || role?.type || `Role #${role?.id || ''}`
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

  const fetchUsers = async () => {
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
  }

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
                    <div>Username: {item?.user?.username || '-'}</div>
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
    </div>
  )
}
