import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import axios from 'axios'
import OTPInput from '../components/OTPInput'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// Google SVG logo (avoids external icon dep)
function GoogleLogo() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

const RESEND_COOLDOWN = 60 // seconds

export default function AuthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const emailRef = useRef(null)

  const [step, setStep] = useState('email') // 'email' | 'otp'
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCountdown, setResendCountdown] = useState(0)

  // Show OAuth error if redirected back with ?error=
  useEffect(() => {
    if (searchParams.get('error')) {
      setError('Google sign-in failed. Please try again or use email.')
    }
  }, [searchParams])

  // Autofocus email input when on email step
  useEffect(() => {
    if (step === 'email') emailRef.current?.focus()
  }, [step])

  // Resend countdown ticker
  useEffect(() => {
    if (resendCountdown <= 0) return
    const t = setTimeout(() => setResendCountdown((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCountdown])

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    if (otp.length === 6 && !loading) {
      handleVerifyOTP(otp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp])

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleSendOTP = async (e) => {
    e?.preventDefault()
    setError('')
    setLoading(true)
    try {
      await axios.post(`${API}/api/auth/send-otp`, { email })
      setStep('otp')
      setResendCountdown(RESEND_COOLDOWN)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async (code = otp) => {
    if (code.length < 6 || loading) return
    setError('')
    setLoading(true)
    try {
      const { data } = await axios.post(
        `${API}/api/auth/verify-otp`,
        { email, otp: code },
        { withCredentials: true }
      )
      localStorage.setItem('token', data.token)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid code. Please try again.')
      setOtp('') // reset boxes for retry
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => {
    window.location.href = `${API}/api/auth/google`
  }

  const goBack = () => {
    setStep('email')
    setOtp('')
    setError('')
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 sm:p-8 shadow-xl shadow-gray-200/50 dark:shadow-gray-950/50">

          {/* Logo */}
          <div className="mb-8 text-center">
            <Link
              to="/"
              className="text-2xl font-black bg-linear-to-r from-violet-500 to-emerald-400 bg-clip-text text-transparent"
            >
              MyCPMentor
            </Link>
          </div>

          {/* ── STEP 1: Email ── */}
          {step === 'email' && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                Welcome back
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">
                Sign in or create a new account
              </p>

              {/* Google button */}
              <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 border border-gray-300 dark:border-gray-700 rounded-xl py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-[0.98] transition-all mb-6"
              >
                <GoogleLogo />
                Continue with Google
              </button>

              {/* Divider */}
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200 dark:border-gray-800" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white dark:bg-gray-900 px-3 text-xs text-gray-400 dark:text-gray-600">
                    or continue with email
                  </span>
                </div>
              </div>

              {/* Email form */}
              <form onSubmit={handleSendOTP} noValidate>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="email"
                  ref={emailRef}
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-violet-500 dark:focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition"
                />

                {error && (
                  <p role="alert" className="text-sm text-red-500 dark:text-red-400 mt-2">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="mt-4 w-full bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  {loading ? 'Sending code…' : 'Continue with Email →'}
                </button>
              </form>
            </>
          )}

          {/* ── STEP 2: OTP ── */}
          {step === 'otp' && (
            <>
              {/* Back button */}
              <button
                onClick={goBack}
                className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 mb-6 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                Check your inbox
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                We sent a 6-digit code to
              </p>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-8 truncate">
                {email}
              </p>

              {/* OTP boxes */}
              <OTPInput value={otp} onChange={setOtp} disabled={loading} />

              {/* Feedback */}
              {loading && (
                <p className="text-center text-sm text-violet-500 mt-4 animate-pulse">
                  Verifying…
                </p>
              )}
              {error && !loading && (
                <p role="alert" className="text-center text-sm text-red-500 dark:text-red-400 mt-3">
                  {error}
                </p>
              )}

              {/* Resend */}
              <div className="text-center mt-6">
                {resendCountdown > 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Resend in{' '}
                    <span className="font-semibold text-violet-500 tabular-nums">
                      {resendCountdown}s
                    </span>
                  </p>
                ) : (
                  <button
                    onClick={handleSendOTP}
                    disabled={loading}
                    className="text-sm text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50 transition-opacity"
                  >
                    Didn't receive a code? Resend
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-6">
          By continuing you agree to our{' '}
          <a href="#" className="underline hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
            Terms
          </a>{' '}
          &amp;{' '}
          <a href="#" className="underline hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  )
}
