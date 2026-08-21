import React from 'react'
import { Link, Outlet } from 'react-router-dom'

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-app-bg text-text-navy flex flex-col justify-between font-sans">
      {/* Navbar */}
      <header className="bg-panel-bg border-b border-neutral-border py-4 px-6 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-brand-navy font-bold text-lg">
            <span>MindMap</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-text-muted">
            <a href="/#how-it-works" className="hover:text-text-navy transition-colors">How it works</a>
            <a href="/#privacy" className="hover:text-text-navy transition-colors">Privacy</a>
            <Link to="/login" className="hover:text-text-navy transition-colors">Login</Link>
            <Link to="/register" className="inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold text-white bg-primary-600 rounded hover:bg-primary-700 transition-colors">
              Get Started
            </Link>
          </nav>

          {/* Quick links for mobile / compact layout */}
          <div className="flex md:hidden items-center gap-3">
            <Link to="/login" className="text-xs text-text-muted hover:text-text-navy">Login</Link>
            <Link to="/register" className="text-xs font-semibold text-primary-600">Register</Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-panel-bg border-t border-neutral-border py-8 px-6 text-center text-xs text-text-muted">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>MindMap &copy; {new Date().getFullYear()} &mdash; Classroom Analytics Platform</p>
          <div className="flex gap-4">
            <a href="/#privacy" className="hover:text-text-navy">Privacy Policy</a>
            <a href="/#how-it-works" className="hover:text-text-navy">Documentation</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
