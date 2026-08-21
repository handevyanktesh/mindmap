import React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

export default function DashboardLayout() {
  const location = useLocation()
  const isTeacherRoute = location.pathname.startsWith('/teacher')

  return (
    <div className="min-h-screen bg-app-bg text-text-navy flex flex-col font-sans">
      {/* Dashboard Top bar */}
      <header className="bg-panel-bg border-b border-neutral-border py-3.5 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-brand-navy font-bold text-lg">
              MindMap
            </Link>
            
            {/* Context Switcher for Student / Teacher */}
            <div className="flex items-center bg-neutral-light border border-neutral-border rounded p-0.5 text-xs font-semibold">
              <Link
                to="/student"
                className={`px-3 py-1 rounded-sm transition-colors ${
                  !isTeacherRoute
                    ? 'bg-panel-bg text-primary-600 shadow-sm border border-neutral-border/50'
                    : 'text-text-muted hover:text-text-navy'
                }`}
              >
                Student Portal
              </Link>
              <Link
                to="/teacher"
                className={`px-3 py-1 rounded-sm transition-colors ${
                  isTeacherRoute
                    ? 'bg-panel-bg text-accent-600 shadow-sm border border-neutral-border/50'
                    : 'text-text-muted hover:text-text-navy'
                }`}
              >
                Teacher Portal
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-xs text-text-muted font-medium hidden sm:inline">
              Mock User ({isTeacherRoute ? 'Instructor' : 'Student'})
            </span>
            <Link
              to="/"
              className="text-xs font-semibold text-danger-600 hover:text-danger-700 bg-danger-50 px-2.5 py-1 rounded"
            >
              Sign Out
            </Link>
          </div>
        </div>
      </header>

      {/* Sub navigation bar for Dashboard links */}
      <div className="bg-panel-bg border-b border-neutral-border/60 py-2 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs font-medium text-text-muted">
          {!isTeacherRoute ? (
            <div className="flex items-center gap-6">
              <Link to="/student" className="hover:text-text-navy transition-colors">Dashboard</Link>
              <Link to="/student/join" className="hover:text-text-navy transition-colors">Join Class</Link>
              <Link to="/student/check" className="hover:text-text-navy transition-colors">Device Setup</Link>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <Link to="/teacher" className="hover:text-text-navy transition-colors">Dashboard</Link>
              <Link to="/teacher/create" className="hover:text-text-navy transition-colors">Create Session</Link>
            </div>
          )}
        </div>
      </div>

      {/* Dashboard Content */}
      <main className="flex-grow">
        <Outlet />
      </main>

      <footer className="bg-panel-bg border-t border-neutral-border/50 py-6 px-6 text-center text-xs text-text-muted">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span>MindMap Dashboard Portal</span>
          <span className="font-mono">Local processing enabled</span>
        </div>
      </footer>
    </div>
  )
}
