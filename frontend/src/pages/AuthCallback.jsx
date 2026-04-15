// This page handles the redirect from Google OAuth.
//
// Flow:
//   1. User clicks "Continue with Google" on AuthPage
//   2. Browser goes to GET /api/auth/google (backend)
//   3. Passport redirects to Google → user consents
//   4. Google redirects to GET /api/auth/google/callback (backend)
//   5. Passport verifies, backend sets HTTP-only cookie AND redirects here:
//      /auth/callback?token=<jwt>
//   6. This page reads the token, saves it, redirects to home

import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      localStorage.setItem('token', token)
      navigate('/dashboard', { replace: true })
    } else {
      navigate('/auth?error=oauth_failed', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-gray-950">
      {/* Simple spinner */}
      <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Signing you in…</p>
    </div>
  )
}
