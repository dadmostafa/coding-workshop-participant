import { createContext, useContext, useState, useCallback } from 'react'
import { login as apiLogin, register as apiRegister } from '../services/api'
import { getTimeGreeting } from '../utils/time'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(localStorage.getItem('acme_user')) } catch { return null }
  })
  const [token, setToken] = useState(() => localStorage.getItem('acme_token'))

  const signIn = useCallback(async (username, password) => {
    const data = await apiLogin(username, password)
    localStorage.setItem('acme_token', data.token)
    localStorage.setItem('acme_user',  JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
    return data.user
  }, [])

  const signUp = useCallback(async (formData) => {
    const data = await apiRegister(formData)
    localStorage.setItem('acme_token', data.token)
    localStorage.setItem('acme_user',  JSON.stringify(data.user))
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

  const updateUser = useCallback((updates) => {
    const updated = { ...user, ...updates }
    localStorage.setItem('acme_user', JSON.stringify(updated))
    setUser(updated)
  }, [user])

  const isAdmin   = user?.role === 'admin'
  const isManager = ['admin','manager'].includes(user?.role)
  const canWrite  = ['admin','manager','contributor'].includes(user?.role)
  const canDelete = ['admin','manager'].includes(user?.role)

  const getGreeting = useCallback(() => {
    const name = user?.full_name?.split(' ')[0] || user?.username || 'there'
    return getTimeGreeting(name)
  }, [user])

  return (
    <AuthContext.Provider value={{
      user, token, signIn, signUp, signOut, updateUser,
      isAdmin, isManager, canWrite, canDelete, getGreeting,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

