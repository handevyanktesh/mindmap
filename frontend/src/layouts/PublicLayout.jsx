import React from 'react'
import { Link, Outlet } from 'react-router-dom'

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-app-bg text-text-navy flex flex-col justify-between font-sans">
      {/* Navbar */}
      <header className="bg-panel-bg border-b border-neutral-border py-3.5 px-4 sm:px-6 sticky top-0 z-50 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white font-bold text-sm shadow-xs group-hover:bg-primary-700 transition-colors">
              M
            </div>
            <div>
              <span className="text-brand-navy font-bold text-base tracking-tight leading-none block">
                MindMap
              </span>
              <span className="text-[10px] text-text-muted font-medium tracking-tight block">
                Attention &amp; Confusion Detector
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-text-muted">
            <a href="/#how-it-works" className="hover:text-brand-navy transition-colors">How it works</a>
            <a href="/#privacy" className="hover:text-brand-navy transition-colors">Privacy</a>
            <Link to="/login" className="hover:text-brand-navy transition-colors">Sign in</Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 active:bg-primary-800 shadow-xs transition-colors"
            >
              Get started
            </Link>
          </nav>

          {/* Quick links for mobile layout */}
          <div className="flex md:hidden items-center gap-2">
            <Link to="/login" className="text-xs font-medium text-text-muted hover:text-brand-navy px-2 py-1">
              Sign in
            </Link>
            <Link to="/register" className="text-xs font-semibold text-primary-600 bg-primary-50 px-2.5 py-1 rounded">
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-panel-bg border-t border-neutral-border py-8 px-4 sm:px-6 text-center text-xs text-text-muted">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <p className="font-semibold text-brand-navy">MindMap: Real-Time Student Attention and Confusion Detector</p>
            <p className="text-[11px] text-text-muted mt-0.5">Non-invasive classroom telemetry powered by browser-local computer vision.</p>
          </div>
          <div className="flex gap-6 text-xs">
            <a href="/#privacy" className="hover:text-brand-navy">Privacy Architecture</a>
            <a href="/#how-it-works" className="hover:text-brand-navy">How It Works</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

