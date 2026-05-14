import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeContext } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import LandingPage from './pages/LandingPage'
import AuthCallback from './pages/AuthCallback'
import DashboardLayout from './layouts/DashboardLayout'
import Overview from './pages/dashboard/Overview'
import POTD from './pages/dashboard/POTD'
import Roadmap from './pages/dashboard/Roadmap'
import Practice from './pages/dashboard/Practice'
import Problems from './pages/dashboard/Problems'
import ProblemSolvePage from './pages/dashboard/ProblemSolvePage'
import Sheets from './pages/dashboard/Sheets'
import Revision from './pages/dashboard/Revision'
import Battles from './pages/dashboard/Battles'
import Contests from './pages/dashboard/Contests'
import Leaderboard from './pages/dashboard/Leaderboard'
import Analytics from './pages/dashboard/Analytics'
import Rating from './pages/dashboard/Rating'
import CFSync from './pages/dashboard/CFSync'
import Notifications from './pages/dashboard/Notifications'
import Community from './pages/dashboard/Community'
import CreateProblem from './pages/dashboard/CreateProblem'
import MyRequests from './pages/dashboard/MyRequests'
import AdminUsers from './pages/dashboard/admin/AdminUsers'
import AdminProblemReview from './pages/dashboard/admin/AdminProblemReview'
import AdminProblems from './pages/dashboard/admin/AdminProblems'
import AdminContests from './pages/dashboard/admin/AdminContests'
import AdminModeration from './pages/dashboard/admin/AdminModeration'
import AdminSystem from './pages/dashboard/admin/AdminSystem'
import Profile from './pages/dashboard/Profile'
import Settings from './pages/dashboard/Settings'

function RequireAuth({ children }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/" replace />
  return children
}

function App() {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') !== 'light'
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      root.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])

  const toggleDark = () => setIsDark((d) => !d)

  return (
    <AuthProvider>
    <ThemeContext.Provider value={{ isDark, toggleDark }}>
      <BrowserRouter>
        <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-white transition-colors duration-300">
          <Routes>
            <Route path="/" element={<LandingPage isDark={isDark} toggleDark={toggleDark} />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route
              path="/dashboard"
              element={<RequireAuth><DashboardLayout /></RequireAuth>}
            >
              <Route index element={<Overview />} />
              <Route path="potd" element={<POTD />} />
              <Route path="roadmap" element={<Roadmap />} />
              <Route path="practice" element={<Practice />} />
              <Route path="problems" element={<Problems />} />
              <Route path="problems/:slug" element={<ProblemSolvePage />} />
              <Route path="sheets" element={<Sheets />} />
              <Route path="revision" element={<Revision />} />
              <Route path="battles" element={<Battles />} />
              <Route path="contests" element={<Contests />} />
              <Route path="leaderboard" element={<Leaderboard />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="rating" element={<Rating />} />
              <Route path="cf-sync" element={<CFSync />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="community" element={<Community />} />
              <Route path="create-problem" element={<CreateProblem />} />
              <Route path="my-requests" element={<MyRequests />} />
              <Route path="admin/users" element={<AdminUsers />} />
              <Route path="admin/problems" element={<AdminProblemReview />} />
              <Route path="admin/ai-problems" element={<AdminProblems />} />
              <Route path="admin/contests" element={<AdminContests />} />
              <Route path="admin/moderation" element={<AdminModeration />} />
              <Route path="admin/system" element={<AdminSystem />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeContext.Provider>
    </AuthProvider>
  )
}

export default App
