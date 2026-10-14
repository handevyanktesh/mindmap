import React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function DashboardLayout() {
  const location = useLocation()
  const { user, logout } = useAuth()
  const isTeacherRoute = location.pathname.startsWith('/teacher')

  const studentNav = [
    { label: 'Overview', path: '/student' },
    { label: 'Enter Classroom', path: '/student/join' },
    { label: 'Camera & Mic Check', path: '/student/check' },
  ]

  const teacherNav = [
    { label: 'Classrooms & Logs', path: '/teacher' },
    { label: 'New Classroom Session', path: '/teacher/create' },
  ]

  const activeNav = isTeacherRoute ? teacherNav : studentNav

  const getInitials = (name) => {
    if (!name) return 'U'
    return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
  }

  return (
    <div className="min-h-screen bg-app-bg text-text-navy flex flex-col font-sans">
      {/* Dashboard Top Bar */}
      <header className="bg-panel-bg border-b border-neutral-border py-3 px-4 sm:px-6 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-sm shadow-xs group-hover:bg-primary-700 transition-colors">
                M
              </div>
              <div className="hidden sm:block">
                <span className="text-brand-navy font-bold text-base tracking-tight leading-none block">
                  MindMap
                </span>
                <span className="text-[10px] text-text-muted font-medium tracking-tight block">
                  Attention &amp; Confusion Detector
                </span>
              </div>
            </Link>

            {/* Context Switcher for Student / Teacher */}
            <nav aria-label="Portal selector" className="flex items-center bg-neutral-light border border-neutral-border rounded-md p-0.5 text-xs font-semibold">
              <Link
                to="/student"
                className={`px-3 py-1 rounded transition-all ${
                  !isTeacherRoute
                    ? 'bg-panel-bg text-primary-600 shadow-xs font-bold'
                    : 'text-text-muted hover:text-text-navy'
                }`}
              >
                Student Portal
              </Link>
              <Link
                to="/teacher"
                className={`px-3 py-1 rounded transition-all ${
                  isTeacherRoute
                    ? 'bg-panel-bg text-accent-600 shadow-xs font-bold'
                    : 'text-text-muted hover:text-text-navy'
                }`}
              >
                Teacher Portal
              </Link>
            </nav>
          </div>

          {/* User Profile & Sign Out */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-100 border border-neutral-border flex items-center justify-center text-[11px] font-bold text-brand-navy">
                {getInitials(user?.name)}
              </div>
              <div className="hidden md:block text-left">
                <span className="text-xs font-semibold text-brand-navy block leading-none">
                  {user?.name || 'User'}
                </span>
                <span className="text-[10px] text-text-muted capitalize block mt-0.5">
                  {user?.role || 'Guest'}
                </span>
              </div>
            </div>

            <button
              onClick={logout}
              className="text-xs font-medium text-danger-600 hover:text-danger-700 hover:bg-danger-50 px-2.5 py-1 rounded-md border border-transparent hover:border-danger-200 transition-colors"
              title="Sign out of your account"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Sub Navigation Bar with Active Route Indicators */}
      <nav aria-label="Dashboard views" className="bg-panel-bg border-b border-neutral-border/80 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center gap-6 text-xs font-medium overflow-x-auto scrollbar-none">
          {activeNav.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`py-2.5 border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary-600 text-primary-700 font-semibold'
                    : 'border-transparent text-text-muted hover:text-brand-navy hover:border-slate-300'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Main Dashboard Workspace Content */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-panel-bg border-t border-neutral-border py-4 px-4 sm:px-6 text-xs text-text-muted">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>MindMap: Real-Time Student Attention and Confusion Detector</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Client-side privacy boundary active
          </span>
        </div>
      </footer>
    </div>
  )
}

