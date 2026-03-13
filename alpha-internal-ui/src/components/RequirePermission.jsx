import React from "react"
import { Navigate } from "react-router-dom"
import { useIam } from "../contexts/IamContext"

export default function RequirePermission({
  children,
  permissionKey,
  permissionAny,
  permissionRole,
  permissionAnyRole,
  fallbackPath = "/403",
}) {
  const { loading, role, can, canAny } = useIam()

  const roleText = String(role || "").trim().toLowerCase()
  const targetRole = String(permissionRole || "").trim().toLowerCase()
  const targetRoles = Array.isArray(permissionAnyRole)
    ? permissionAnyRole.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean)
    : []

  const hasRoleConstraint = Boolean(targetRole) || targetRoles.length > 0
  const hasKeyConstraint = Boolean(permissionKey) || (Array.isArray(permissionAny) && permissionAny.length > 0)

  if (loading) {
    return <div>Loading permissions...</div>
  }

  if (!hasRoleConstraint && !hasKeyConstraint) {
    return children
  }

  if (hasRoleConstraint) {
    const matchesRole = !targetRole || roleText === targetRole
    const matchesAnyRole = targetRoles.length === 0 || targetRoles.includes(roleText)

    if (!matchesRole || !matchesAnyRole) {
      return <Navigate to={fallbackPath} replace />
    }

    return children
  }

  const hasPermission =
    (permissionKey ? can(permissionKey) : false) ||
    (Array.isArray(permissionAny) && permissionAny.length > 0 ? canAny(permissionAny) : false)

  if (!hasPermission) {
    return <Navigate to={fallbackPath} replace />
  }

  return children
}
