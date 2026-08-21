import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Input from '../../components/Input'
import Button from '../../components/Button'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleLogin = (e, role) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please fill in both email and password.')
      return
    }
    setError('')
    // Simulate navigation based on selected target role
    if (role === 'teacher') {
      navigate('/teacher')
    } else {
      navigate('/student')
    }
  }

  return (
    <PageContainer size="small" className="py-16">
      <div className="card-panel space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-h2">Sign in to MindMap</h2>
          <p className="text-body text-xs">Access your classroom engagement dashboard</p>
        </div>

        <form className="space-y-4" onSubmit={(e) => handleLogin(e, 'student')}>
          {error && (
            <div className="p-3 bg-danger-50 border border-danger-200 text-danger-600 text-xs rounded font-medium">
              {error}
            </div>
          )}

          <Input
            label="Email Address"
            id="email"
            type="email"
            placeholder="name@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="flex flex-col gap-3 pt-2">
            {/* Quick action buttons to select dashboard roles directly */}
            <Button type="button" variant="primary" onClick={(e) => handleLogin(e, 'student')}>
              Sign In as Student
            </Button>
            
            <Button type="button" variant="secondary" onClick={(e) => handleLogin(e, 'teacher')}>
              Sign In as Teacher
            </Button>
          </div>
        </form>

        <div className="border-t border-neutral-border pt-4 text-center text-xs text-text-muted">
          New to MindMap?{' '}
          <Link to="/register" className="text-primary-600 font-semibold hover:underline">
            Create an account
          </Link>
        </div>
      </div>
    </PageContainer>
  )
}
