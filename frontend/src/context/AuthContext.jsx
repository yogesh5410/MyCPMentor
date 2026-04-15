/**
 * context/AuthContext.jsx
 *
 * Global auth context: on mount, fetches /api/auth/me to populate the
 * current user (id, email, name, avatar, rating, coins, role).
 *
 * Exposes:
 *   user          — the full user object (or null while loading / not logged in)
 *   loading       — true until the initial /me fetch completes
 *   setUser       — replace entire user object (used after login/signup response)
 *   updateCoins   — update just the coins field without a full re-fetch
 *   refreshUser   — re-fetch /api/auth/me (call after publishing, refund etc.)
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const { data } = await api.get('/api/auth/me')
      setUser(data.user)
    } catch {
      // Token invalid / expired — clean up
      localStorage.removeItem('token')
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  /** Patch only the coins field — avoids a round-trip after coin-spending actions */
  const updateCoins = (newBalance) => {
    setUser((prev) => (prev ? { ...prev, coins: newBalance } : prev))
  }

  return (
    <AuthContext.Provider
      value={{ user, setUser, updateCoins, refreshUser: fetchUser, loading }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
