import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { login as apiLogin } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('acme_user')) } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('acme_token'))

  const signIn = useCallback(async (username, password) => {
    const data = await apiLogin(username, password)
    localStorage.setItem('acme_token', data.token)
    localStorage.setItem('acme_user', JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const signOut = useCallback(() => {
    localStorage.removeItem('acme_token')
    localStorage.removeItem('acme_user')
    setToken(null)
    setUser(null)
  }, [])

  // Helpers
  const isAdmin       = user?.role === 'admin'
  const isManager     = ['admin','manager'].includes(user?.role)
  const canWrite      = ['admin','manager','contributor'].includes(user?.role)
  const canDelete     = ['admin','manager'].includes(user?.role)

  return (
    <AuthContext.Provider value={{ user, token, signIn, signOut, isAdmin, isManager, canWrite, canDelete }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
