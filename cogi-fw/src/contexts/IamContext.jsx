import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { iamMeApi } from "../api/authApi"
import { useAuth } from "./AuthContext"

const IamContext = createContext(null)

export function IamProvider({ children }) {
  const { loading: authLoading } = useAuth()

  const [permissionKeys, setPermissionKeys] = useState(() => {
    const cached = localStorage.getItem("permissionKeys")
    return cached ? JSON.parse(cached) : []
  })
  const [role, setRole] = useState(() => localStorage.getItem("iamRole") || null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isCancelled = false

    async function bootstrapIam() {
      if (authLoading) return

      const token = localStorage.getItem("token")
      if (!token) {
        if (!isCancelled) {
          setPermissionKeys([])
          setRole(null)
          setLoading(false)
        }
        localStorage.removeItem("permissionKeys")
        localStorage.removeItem("iamRole")
        return
      }

      setLoading(true)

      try {
        const payload = await iamMeApi()
        const keys = Array.isArray(payload?.permissionKeys) ? payload.permissionKeys : []
        const currentRole = payload?.role || null

        if (!isCancelled) {
          setPermissionKeys(keys)
          setRole(currentRole)
          setLoading(false)
        }

        localStorage.setItem("permissionKeys", JSON.stringify(keys))
        if (currentRole) {
          localStorage.setItem("iamRole", currentRole)
        } else {
          localStorage.removeItem("iamRole")
        }
      } catch {
        if (!isCancelled) {
          setPermissionKeys([])
          setRole(null)
          setLoading(false)
        }
        localStorage.removeItem("permissionKeys")
        localStorage.removeItem("iamRole")
      }
    }

    bootstrapIam()

    return () => {
      isCancelled = true
    }
  }, [authLoading])

  const value = useMemo(() => {
    const can = (key) => {
      if (!key) return false
      return permissionKeys.includes(key)
    }

    const canAny = (keys) => {
      if (!Array.isArray(keys) || keys.length === 0) return false
      return keys.some((key) => can(key))
    }

    return {
      role,
      permissionKeys,
      loading,
      can,
      canAny,
    }
  }, [role, permissionKeys, loading])

  return <IamContext.Provider value={value}>{children}</IamContext.Provider>
}

export function useIam() {
  return useContext(IamContext)
}
