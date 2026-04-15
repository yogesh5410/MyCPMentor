import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Features from '../components/Features'
import HowItWorks from '../components/HowItWorks'
import ProblemEcosystem from '../components/ProblemEcosystem'
import RatingSystem from '../components/RatingSystem'
import Footer from '../components/Footer'
import OTPInput from '../components/OTPInput'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const RESEND_COOLDOWN = 60

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

export default function LandingPage({ isDark, toggleDark }) {
  const navigate = useNavigate()
  const emailRef = useRef(null)

  const [mode, setMode] = useState('signin')
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendCountdown, setResendCountdown] = useState(0)

  useEffect(() => {
    if (step === 'email') emailRef.current?.focus()
  }, [step])

  useEffect(() => {
    if (resendCountdown <= 0) return
    const t = setTimeout(() => setResendCountdown((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCountdown])

  useEffect(() => {
    if (otp.length === 6 && !loading) handleVerifyOTP(otp)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp])

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
      setOtp('')
      setLoading(false)
    }
  }

  const handleGoogleLogin = () => { window.location.href = `${API}/api/auth/google` }
  const switchMode = (m) => { setMode(m); setStep('email'); setOtp(''); setError('') }
  const goBack = () => { setStep('email'); setOtp(''); setError('') }

  return (
    <div className="bg-white dark:bg-gray-950 min-h-screen">
      <Navbar isDark={isDark} toggleDark={toggleDark} />

      <div className="flex pt-16 min-h-screen">

        {/* ── LEFT: scrollable landing sections ── */}
        <div className="hidden md:block flex-1 min-w-0 overflow-y-auto">
          <Hero />
          <Features />
          <HowItWorks />
          <ProblemEcosystem />
          <RatingSystem />
          <Footer />
        </div>

        {/* ── RIGHT: sticky auth panel ── */}
        <div className="w-full md:w-[42%] xl:w-[38%] shrink-0 md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:overflow-y-auto bg-white dark:bg-gray-900 border-l-0 md:border-l border-gray-200 dark:border-gray-800 flex flex-col">

          {/* Accent bar */}
          <div className="h-[3px] bg-linear-to-r from-violet-500 via-purple-400 to-emerald-500 shrink-0" />

          {/* Glow blobs */}
          <div className="absolute pointer-events-none select-none md:w-[42%] xl:w-[38%] right-0 top-16 h-[calc(100vh-4rem)] overflow-hidden">
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
            <div className="absolute bottom-10 right-0 w-48 h-48 bg-emerald-500/8 rounded-full blur-3xl" />
          </div>

          {/* Form content */}
          <div className="relative z-10 flex flex-col flex-1 items-center justify-center px-8 xl:px-12 py-10 text-center">

            {/* Brand */}
            <div className="mb-1">
              <span className="text-xl font-black bg-linear-to-r from-violet-500 to-emerald-400 bg-clip-text text-transparent">
                MyCPMentor
              </span>
            </div>

            {/* Step progress dots */}
            <div className="flex items-center gap-2 mb-8 mt-3">
              <div className={`w-2 h-2 rounded-full transition-colors ${step === 'email' ? 'bg-violet-500' : 'bg-violet-200 dark:bg-violet-800'}`} />
              <div className="w-6 h-px bg-gray-200 dark:bg-gray-700" />
              <div className={`w-2 h-2 rounded-full transition-colors ${step === 'otp' ? 'bg-violet-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
            </div>

            {/* ─── EMAIL STEP ─── */}
            {step === 'email' && (
              <div className="w-full max-w-sm">
                {/* Mode toggle */}
                <div className="relative flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6">
                  <div
                    className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-[0.6rem] bg-white dark:bg-gray-700 shadow transition-all duration-200 ease-out"
                    style={{ left: mode === 'signin' ? '4px' : 'calc(50%)' }}
                  />
                  {[['signin', 'Sign in'], ['signup', 'Sign up']].map(([m, label]) => (
                    <button
                      key={m}
                      onClick={() => switchMode(m)}
                      className={`relative z-10 flex-1 py-2.5 text-sm font-semibold rounded-[0.6rem] transition-colors duration-150 ${
                        mode === m ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Heading */}
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  {mode === 'signin' ? 'Welcome back 👋' : 'Join MyCPMentor'}
                </h2>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-6 leading-relaxed">
                  {mode === 'signin'
                    ? 'Continue your competitive programming journey'
                    : 'Start mastering algorithms with AI today'}
                </p>

                {/* Google */}
                <button
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-2.5 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800/60 rounded-xl py-2.5 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 hover:shadow-sm active:scale-[0.99] transition-all mb-5"
                >
                  <GoogleLogo />
                  Continue with Google
                </button>

                {/* Divider */}
                <div className="relative mb-5">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-800" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white dark:bg-gray-900 px-3 text-xs text-gray-400 dark:text-gray-600">or with email</span>
                  </div>
                </div>

                {/* Email form */}
                <form onSubmit={handleSendOTP} noValidate className="text-left">
                  <label htmlFor="email" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 text-sm focus:outline-none focus:border-violet-500 dark:focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition"
                  />
                  {error && (
                    <p role="alert" className="text-xs text-red-500 dark:text-red-400 mt-2 text-left">{error}</p>
                  )}
                  <button
                    type="submit"
                    disabled={loading || !email.trim()}
                    className="mt-3.5 w-full bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl text-sm transition-all hover:shadow-md hover:shadow-violet-500/25"
                  >
                    {loading ? 'Sending code…' : 'Continue →'}
                  </button>
                </form>
              </div>
            )}

            {/* ─── OTP STEP ─── */}
            {step === 'otp' && (
              <div className="w-full max-w-sm">
                {/* Back link — top-left inside this container */}
                <div className="flex justify-start mb-6">
                  <button
                    onClick={goBack}
                    className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors font-medium"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                    </svg>
                    Change email
                  </button>
                </div>

                {/* Envelope icon */}
                <div className="flex justify-center mb-5">
                  <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center border border-violet-200 dark:border-violet-800/50">
                    <svg className="w-7 h-7 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>

                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Check your inbox</h2>
                <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-1">6-digit code sent to</p>
                <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 mb-6 truncate">{email}</p>

                <OTPInput value={otp} onChange={setOtp} disabled={loading} />

                {loading && (
                  <p className="text-xs text-violet-500 mt-4 animate-pulse">Verifying…</p>
                )}
                {error && !loading && (
                  <p role="alert" className="text-xs text-red-500 dark:text-red-400 mt-3">{error}</p>
                )}

                <div className="mt-6">
                  {resendCountdown > 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Resend in <span className="font-semibold text-violet-500 tabular-nums">{resendCountdown}s</span>
                    </p>
                  ) : (
                    <button
                      onClick={handleSendOTP}
                      disabled={loading}
                      className="text-xs text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50"
                    >
                      Didn't get it? Resend code
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Terms */}
            <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-8 max-w-xs">
              By continuing you agree to our{' '}
              <a href="#" className="underline hover:text-gray-600 dark:hover:text-gray-400 transition-colors">Terms</a>
              {' '}&amp;{' '}
              <a href="#" className="underline hover:text-gray-600 dark:hover:text-gray-400 transition-colors">Privacy</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

