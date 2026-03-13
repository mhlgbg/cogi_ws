import React from "react"
import { Navigate } from "react-router-dom"
import { useIam } from "../contexts/IamContext"
import { useAuth } from "../contexts/AuthContext"
import { isLeadershipUser } from "../utils/leadership"

export default function RequireLeadership({ children }) {
  const { loading: iamLoading, role } = useIam()
  const { loading: authLoading, me } = useAuth()

  if (iamLoading || authLoading) {
    return <div>Loading permissions...</div>
  }

  const allowed = isLeadershipUser({
    iamRole: role,
    meRole: me?.roleText || me?.role,
  })

  if (!allowed) {
    return <Navigate to="/403" replace />
  }

  return children
}
