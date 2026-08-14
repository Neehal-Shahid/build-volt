import { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../lib/api'

const TOKEN_KEY = 'bb_token'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [store, setStore] = useState(null)
  const [booting, setBooting] = useState(!!localStorage.getItem(TOKEN_KEY))

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!token) {
        setStore(null)
        setBooting(false)
        return
      }
      try {
        const data = await api('/api/me', { token })
        if (!cancelled) setStore(data.store)
      } catch {
        if (!cancelled) {
          localStorage.removeItem(TOKEN_KEY)
          setToken('')
          setStore(null)
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

  function persistSession(nextToken, nextStore) {
    localStorage.setItem(TOKEN_KEY, nextToken)
    setToken(nextToken)
    setStore(nextStore)
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setStore(null)
  }

  async function login(email, password) {
    const data = await api('/api/login', {
      method: 'POST',
      body: { email, password },
    })
    persistSession(data.token, data.store)
    return data
  }

  async function signup(email, password, tosAccepted) {
    return api('/api/signup', {
      method: 'POST',
      body: { email, password, tosAccepted },
    })
  }

  async function verifyOtp(email, otp) {
    const data = await api('/api/verify-email-otp', {
      method: 'POST',
      body: { email, otp },
    })
    persistSession(data.token, data.store)
    return data
  }

  async function verifyToken(verifyToken) {
    const data = await api(`/api/verify-email?token=${encodeURIComponent(verifyToken)}`)
    persistSession(data.token, data.store)
    return data
  }

  async function completeStoreSetup(name) {
    const data = await api('/api/store-setup', {
      method: 'PUT',
      token,
      body: { name },
    })
    persistSession(data.token, data.store)
    return data
  }

  async function refreshStore() {
    if (!token) return null
    const data = await api('/api/me', { token })
    setStore(data.store)
    return data.store
  }

  const value = {
    token,
    store,
    booting,
    isLoggedIn: !!token && !!store,
    login,
    logout,
    signup,
    verifyOtp,
    verifyToken,
    completeStoreSetup,
    refreshStore,
    persistSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
