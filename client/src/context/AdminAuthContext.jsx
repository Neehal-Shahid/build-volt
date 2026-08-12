import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'

const TOKEN_KEY = 'bb_admin_token'
const AdminAuthContext = createContext(null)

export function AdminAuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [admin, setAdmin] = useState(null)
  const [booting, setBooting] = useState(!!localStorage.getItem(TOKEN_KEY))

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!token) {
        setAdmin(null)
        setBooting(false)
        return
      }
      try {
        const data = await api('/api/admin/me', { token })
        if (!cancelled) setAdmin(data.admin)
      } catch {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY)
          setToken('')
          setAdmin(null)
        }
      } finally {
        if (!cancelled) setBooting(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [token])

  function persist(nextToken, nextAdmin) {
    localStorage.setItem(TOKEN_KEY, nextToken)
    setToken(nextToken)
    setAdmin(nextAdmin)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setAdmin(null)
  }

  async function login(email, password) {
    const data = await api('/api/admin/login', {
      method: 'POST',
      body: { email, password },
    })
    persist(data.token, data.admin)
    return data
  }

  return (
    <AdminAuthContext.Provider
      value={{
        token,
        admin,
        booting,
        isAdmin: !!token && !!admin,
        login,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used inside AdminAuthProvider')
  return ctx
}
