import { createContext, useContext, useMemo, useState } from 'react'

const AuthContext = createContext(null)
const TENANT_STORAGE_KEYS = ['tenantCode', 'tenantName', 'tenantShortName', 'tenantLogoUrl', 'tenantLogo', 'tenantId', 'userTenantId', 'tenantRoles', 'featureContext']

function readAuthFromStorage() {
  const token = localStorage.getItem('authJwt')
  const userRaw = localStorage.getItem('authUser')

  let user = null
  if (userRaw) {
    try {
      user = JSON.parse(userRaw)
    } catch {
      user = null
    }
  }

  if (!token || !user) {
    return { token: null, user: null }
  }

  return { token, user }
}

export function useAuth() {
  return useContext(AuthContext)
}

export default function AuthContextProvider({ children }) {
  const [authState, setAuthState] = useState(() => readAuthFromStorage())

  const login = (jwt, user) => {
    if (!jwt || !user) return

    localStorage.setItem('authJwt', jwt)
    localStorage.setItem('authUser', JSON.stringify(user))
    setAuthState({ token: jwt, user })
  }

  const logout = () => {
    localStorage.removeItem('authJwt')
    localStorage.removeItem('authUser')
    TENANT_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
    setAuthState({ token: null, user: null })
  }

  const value = useMemo(
    () => ({
      user: authState.user,
      token: authState.token,
      isAuthenticated: Boolean(authState.token),
      login,
      logout,
    }),
    [authState],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthContext }