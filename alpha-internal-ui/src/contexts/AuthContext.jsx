import React, { createContext, useContext, useEffect, useState } from "react"
import { iamMeApi } from "../api/authApi"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [me, setMe] = useState(() => {
    const cached = localStorage.getItem("me")
    return cached ? JSON.parse(cached) : null
  })
  const [loading, setLoading] = useState(true)

  async function reloadMe() {
    const token = localStorage.getItem("token")
    if (!token) {
      setMe(null)
      setLoading(false)
      return
    }
    try {
      const iamPayload = await iamMeApi()
      const user = iamPayload?.user || null

      if (!user?.id) {
        throw new Error("Unauthorized")
      }

      const roleText = iamPayload?.role || "-"

      const data = {
        ...user,
        roleText,
      }

      setMe(data)
      localStorage.setItem("me", JSON.stringify(data))
    } catch {
      setMe(null)
      localStorage.removeItem("token")
      localStorage.removeItem("me")
      localStorage.removeItem("permissionKeys")
      localStorage.removeItem("iamRole")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reloadMe()
  }, [])

  function logout() {
    setMe(null)
    localStorage.removeItem("token")
    localStorage.removeItem("me")
    localStorage.removeItem("permissionKeys")
    localStorage.removeItem("iamRole")
    window.location.href = "/login"
  }

  return (
    <AuthContext.Provider value={{ me, loading, reloadMe, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
