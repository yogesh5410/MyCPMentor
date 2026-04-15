import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'

// ─── Sidebar Navigation Data ─────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    group: null,
    items: [{ to: '/dashboard', label: 'Overview', end: true, icon: 'grid' }],
  },
  {
    group: 'LEARN',
    items: [
      { to: '/dashboard/potd', label: 'POTD', icon: 'calendar' },
      { to: '/dashboard/roadmap', label: 'Roadmap', icon: 'map' },
      { to: '/dashboard/ai-mentor', label: 'AI Mentor', icon: 'bot' },
    ],
  },
  {
    group: 'PRACTICE',
    items: [
      { to: '/dashboard/practice', label: 'Practice', icon: 'zap' },
      { to: '/dashboard/problems', label: 'Problems', icon: 'code' },
      { to: '/dashboard/sheets', label: 'Sheets', icon: 'layers' },
      { to: '/dashboard/revision', label: 'Revision', icon: 'refresh' },
      { to: '/dashboard/create-problem', label: 'Create Problem', icon: 'sparkle' },
      { to: '/dashboard/my-requests', label: 'My Requests', icon: 'inbox' },
    ],
  },
  {
    group: 'COMPETE',
    items: [
      { to: '/dashboard/battles', label: 'Battles', icon: 'swords' },
      { to: '/dashboard/contests', label: 'Contests', icon: 'trophy' },
      { to: '/dashboard/leaderboard', label: 'Leaderboard', icon: 'chart-bar' },
    ],
  },
  {
    group: 'INSIGHTS',
    items: [
      { to: '/dashboard/analytics', label: 'Analytics', icon: 'chart-line' },
      { to: '/dashboard/rating', label: 'My Rating', icon: 'star' },
    ],
  },
  {
    group: 'FEATURES',
    items: [
      { to: '/dashboard/cf-sync', label: 'CF Sync', icon: 'link' },
      { to: '/dashboard/notifications', label: 'Notifications', icon: 'bell' },
      { to: '/dashboard/community', label: 'Community', icon: 'globe' },
    ],
  },
  {
    group: 'ADMIN',
    items: [
      { to: '/dashboard/admin/users', label: 'User Management', icon: 'users' },
      { to: '/dashboard/admin/problems', label: 'Problem Bank', icon: 'database' },
      { to: '/dashboard/admin/contests', label: 'Contest Manager', icon: 'flag' },
      { to: '/dashboard/admin/moderation', label: 'Moderation', icon: 'shield' },
      { to: '/dashboard/admin/system', label: 'System Health', icon: 'server' },
    ],
  },
]

const BOTTOM_NAV = [
  { to: '/dashboard/profile', label: 'Profile', icon: 'user' },
  { to: '/dashboard/settings', label: 'Settings', icon: 'settings' },
]

// ─── Icon Renderer ────────────────────────────────────────────────────────────
function Icon({ name, className = 'w-5 h-5' }) {
  const paths = {
    grid: 'M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z',
    calendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    map: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7',
    bot: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    zap: 'M13 10V3L4 14h7v7l9-11h-7z',
    code: 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
    layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    refresh: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
    swords: 'M14.5 10.5L19 6M5 5l5.5 5.5M9 21l3-3m3 3l-3-3m-6-6l3 3M3 3l18 18',
    trophy: 'M8 21h8m-4-4v4m-4-4a4 4 0 01-4-4V5h16v8a4 4 0 01-4 4H8zM4 5h16',
    'chart-bar': 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    'chart-line': 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4v16',
    user: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
    settings: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    sun: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z',
    moon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
    bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    star: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
    link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
    globe: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
    users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    database: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
    flag: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9',
    shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
    server: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01',
    logout: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
    menu: 'M4 6h16M4 12h16M4 18h16',
    close: 'M6 18L18 6M6 6l12 12',
    chevronLeft: 'M15 19l-7-7 7-7',
    sparkle: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z',
    inbox: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4m8-5v5',
  }

  // Settings icon has two paths — handle separately
  if (name === 'settings') {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  }

  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[name] || paths.grid} />
    </svg>
  )
}

// ─── Sidebar Nav Item ─────────────────────────────────────────────────────────
function NavItem({ to, label, icon, end = false, collapsed, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) => [
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100',
        collapsed ? 'justify-center px-2' : '',
      ].join(' ')}
      title={collapsed ? label : undefined}
    >
      <Icon name={icon} className="w-5 h-5 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  )
}

// ─── Sidebar Content ──────────────────────────────────────────────────────────
function SidebarContent({ collapsed, onNavClick }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const handleLogout = () => {
    localStorage.removeItem('token')
    navigate('/', { replace: true })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`h-16 flex items-center shrink-0 px-4 border-b border-gray-200 dark:border-gray-800 ${collapsed ? 'justify-center' : 'gap-2'}`}>
        {collapsed ? (
          <span className="text-lg font-black text-violet-500">M</span>
        ) : (
          <span className="text-lg font-black bg-linear-to-r from-violet-500 to-emerald-400 bg-clip-text text-transparent">
            MyCPMentor
          </span>
        )}
      </div>

      {/* Nav groups (scrollable) */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
        {NAV_GROUPS.map((grp, gi) => {
          // Only show ADMIN nav group for admin users
          if (grp.group === 'ADMIN' && !isAdmin) return null
          return (
          <div key={gi}>
            {grp.group && !collapsed && (
              <p className="px-3 mb-1 text-xs font-semibold text-gray-400 dark:text-gray-600 tracking-wider uppercase">
                {grp.group}
              </p>
            )}
            {grp.group && collapsed && <div className="h-px bg-gray-200 dark:bg-gray-800 mx-2 mb-2" />}
            <div className="space-y-0.5">
              {grp.items.map(item => (
                <NavItem key={item.to} {...item} collapsed={collapsed} onClick={onNavClick} />
              ))}
            </div>
          </div>
          )
        })}
      </nav>

      {/* Bottom: Profile, Settings, Logout */}
      <div className="px-2 py-3 border-t border-gray-200 dark:border-gray-800 space-y-0.5">
        {BOTTOM_NAV.map(item => (
          <NavItem key={item.to} {...item} collapsed={collapsed} onClick={onNavClick} />
        ))}
        <button
          onClick={handleLogout}
          className={`w-full group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-500 dark:text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors ${collapsed ? 'justify-center px-2' : ''}`}
          title={collapsed ? 'Logout' : undefined}
        >
          <Icon name="logout" className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  )
}

// ─── Main Layout ──────────────────────────────────────────────────────────────
export default function DashboardLayout() {
  const { isDark, toggleDark } = useTheme()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)

  const closeMobile = () => setMobileSidebarOpen(false)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">

      {/* ── Desktop Sidebar ───────────────────────────────────────────────── */}
      <aside
        className={[
          'hidden lg:flex flex-col shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-200',
          desktopCollapsed ? 'w-17' : 'w-60',
        ].join(' ')}
      >
        <SidebarContent collapsed={desktopCollapsed} />
      </aside>

      {/* ── Mobile Sidebar Overlay ────────────────────────────────────────── */}
      {mobileSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}
      <aside
        className={[
          'lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-transform duration-200',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <SidebarContent collapsed={false} onNavClick={closeMobile} />
      </aside>

      {/* ── Right side: header + content ─────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Header */}
        <header className="h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 gap-3">

          {/* Left: hamburger (mobile) + collapse toggle (desktop) */}
          <div className="flex items-center gap-2">
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Open sidebar"
            >
              <Icon name="menu" className="w-5 h-5" />
            </button>

            {/* Desktop collapse toggle */}
            <button
              onClick={() => setDesktopCollapsed(c => !c)}
              className="hidden lg:flex p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg
                className={`w-5 h-5 transition-transform duration-200 ${desktopCollapsed ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Mobile logo */}
            <span className="lg:hidden text-base font-black bg-linear-to-r from-violet-500 to-emerald-400 bg-clip-text text-transparent">
              MyCPMentor
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">

            {/* Coin balance */}
            {user && (
              <div className="hidden sm:flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-800/50">
                <span>🪙</span>
                <span>{(user.coins ?? 0).toLocaleString()}</span>
              </div>
            )}

            {/* Rating badge */}
            <div className="hidden sm:flex items-center gap-1.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-xs font-bold px-3 py-1.5 rounded-full border border-violet-200 dark:border-violet-800/50">
              <span>⭐</span>
              <span>{user?.rating ?? 1200}</span>
            </div>

            {/* Notifications */}
            <button
              onClick={() => navigate('/dashboard/notifications')}
              className="relative p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Icon name="bell" className="w-5 h-5" />
              {/* Unread dot */}
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-violet-500 rounded-full" />
            </button>

            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDark ? <Icon name="sun" className="w-5 h-5" /> : <Icon name="moon" className="w-5 h-5" />}
            </button>

            {/* Avatar */}
            <button className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
              <div className="w-7 h-7 rounded-full bg-linear-to-br from-violet-500 to-emerald-400 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user?.name ? user.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="hidden sm:block text-sm font-medium text-gray-700 dark:text-gray-300 max-w-24 truncate">
                {user?.name || user?.email?.split('@')[0] || 'User'}
              </span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
