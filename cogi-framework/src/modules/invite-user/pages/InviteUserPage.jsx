import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { useTenant } from '../../../contexts/TenantContext'
import api from '../../../api/axios'

export default function InviteUserPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { currentTenant } = useTenant()
  const tenantCode = currentTenant?.tenantCode
  const tenantName = currentTenant?.tenantName

  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(null)

  const [roles, setRoles] = useState([])
  const [departments, setDepartments] = useState([])

  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    roleId: '',
    departmentId: '',
  })

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
    }
  }, [isAuthenticated, navigate])

  // Load roles and departments on mount
  useEffect(() => {
    if (!tenantCode) {
      setError('Tenant context required. Please select a tenant first.')
      return
    }

    const loadInviteOptions = async () => {
      try {
        setLoading(true)
        setError('')
        const response = await api.get('/admin/invite-options')
        if (response.data?.ok) {
          setRoles(response.data.roles || [])
          setDepartments(response.data.departments || [])
        } else {
          setError('Failed to load invite options')
        }
      } catch (err) {
        const message =
          err.response?.data?.message ||
          err.message ||
          'Failed to load invite options'
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    loadInviteOptions()
  }, [tenantCode])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(null)

    // Validation
    if (!formData.email?.trim()) {
      setError('Email is required')
      return
    }

    if (!formData.roleId) {
      setError('Role is required')
      return
    }

    try {
      setSubmitting(true)

      const payload = {
        email: formData.email.trim().toLowerCase(),
        roleId: Number(formData.roleId),
      }

      if (formData.fullName?.trim()) {
        payload.fullName = formData.fullName.trim()
      }

      if (formData.departmentId) {
        payload.departmentId = Number(formData.departmentId)
      }

      const response = await api.post('/admin/invite-user', payload)

      if (response.data?.ok) {
        const result = response.data
        setSuccess({
          userId: result.userId,
          email: result.email,
          caseType: result.caseType,
          emailSent: result.emailSent,
          expiresAt: result.expiresAt,
          emailError: result.emailError,
          userTenantId: result.userTenantId,
        })

        // Reset form
        setFormData({
          email: '',
          fullName: '',
          roleId: '',
          departmentId: '',
        })

        // Auto-scroll to success message
        setTimeout(
          () =>
            document
              .getElementById('success-message')
              ?.scrollIntoView({ behavior: 'smooth' }),
          100
        )
      }
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.statusText ||
        err.message ||
        'Failed to invite user'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h1>Invite User</h1>
      <p style={{ color: '#666' }}>
        Invite a new user or add existing user to{' '}
        <strong>{tenantName || tenantCode}</strong>
      </p>

      {error && (
        <div
          style={{
            backgroundColor: '#fee',
            color: '#c33',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '20px',
            border: '1px solid #fcc',
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          id="success-message"
          style={{
            backgroundColor: '#efe',
            color: '#063',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '20px',
            border: '1px solid #cfc',
          }}
        >
          <p style={{ marginTop: 0 }}>
            <strong>✓ Invitation sent successfully!</strong>
          </p>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li>Email: <strong>{success.email}</strong></li>
            <li>Case: <strong>{success.caseType === 'NEW_USER' ? 'New User' : 'Existing User'}</strong></li>
            {success.caseType === 'NEW_USER' && (
              <li>Email Status: <strong>{success.emailSent ? '✓ Sent' : '✗ Failed'}</strong></li>
            )}
            {success.caseType === 'NEW_USER' && success.emailError && (
              <li style={{ color: '#c33' }}>Error: {success.emailError}</li>
            )}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ backgroundColor: '#f5f5f5', padding: '20px', borderRadius: '4px' }}>
        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="email" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Email <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            required
            placeholder="user@example.com"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="fullName" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Full Name
          </label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={handleInputChange}
            placeholder="John Doe"
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="roleId" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Role <span style={{ color: 'red' }}>*</span>
          </label>
          {loading ? (
            <div style={{ padding: '8px', color: '#666' }}>Loading roles...</div>
          ) : (
            <select
              id="roleId"
              name="roleId"
              value={formData.roleId}
              onChange={handleInputChange}
              required
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            >
              <option value="">-- Select a role --</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                  {role.description ? ` (${role.description})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label htmlFor="departmentId" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
            Department (optional)
          </label>
          {loading ? (
            <div style={{ padding: '8px', color: '#666' }}>Loading departments...</div>
          ) : (
            <select
              id="departmentId"
              name="departmentId"
              value={formData.departmentId}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            >
              <option value="">-- No department --</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} {dept.code ? `(${dept.code})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
          <button
            type="submit"
            disabled={submitting || loading}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: submitting || loading ? 'not-allowed' : 'pointer',
              opacity: submitting || loading ? 0.6 : 1,
              fontWeight: 'bold',
              fontSize: '14px',
            }}
          >
            {submitting ? 'Sending...' : 'Invite User'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px',
            }}
          >
            Go Back
          </button>
        </div>
      </form>
    </div>
  )
}
