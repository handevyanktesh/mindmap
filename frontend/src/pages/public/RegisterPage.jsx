import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Input from '../../components/Input'
import Button from '../../components/Button'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('student')
  const [error, setError] = useState('')

  const handleRegister = (e) => {
    e.preventDefault()
    if (!name || !email || !password) {
      setError('All fields are required.')
      return
    }
    setError('')
    // Mock routing based on registration role selection
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
          <h2 className="text-h2">Create an account</h2>
          <p className="text-body text-xs">Start monitoring classroom attention metrics</p>
        </div>

        <form className="space-y-4" onSubmit={handleRegister}>
          {error && (
            <div className="p-3 bg-danger-50 border border-danger-200 text-danger-600 text-xs rounded font-medium">
              {error}
            </div>
          )}

          <Input
            label="Full Name"
            id="name"
            placeholder="Jane Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="University Email"
            id="email"
            type="email"
            placeholder="j.doe@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            id="password"
            type="password"
            placeholder="Minimum 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {/* Role selection radio grid */}
          <div>
            <span className="block text-xs font-semibold text-brand-navy-light mb-2">
              Registration Role
            </span>
            <div className="grid grid-cols-2 gap-3">
              <label className={`border rounded p-3 text-center cursor-pointer transition-colors ${
                role === 'student'
                  ? 'border-primary-600 bg-primary-50/55 text-primary-600 font-semibold'
                  : 'border-neutral-border hover:bg-neutral-light'
              }`}>
                <input
                  type="radio"
                  name="role"
                  value="student"
                  className="sr-only"
                  checked={role === 'student'}
                  onChange={() => setRole('student')}
                />
                <span className="text-xs">Student</span>
              </label>

              <label className={`border rounded p-3 text-center cursor-pointer transition-colors ${
                role === 'teacher'
                  ? 'border-accent-600 bg-accent-50/55 text-accent-600 font-semibold'
                  : 'border-neutral-border hover:bg-neutral-light'
              }`}>
                <input
                  type="radio"
                  name="role"
                  value="teacher"
                  className="sr-only"
                  checked={role === 'teacher'}
                  onChange={() => setRole('teacher')}
                />
                <span className="text-xs">Teacher</span>
              </label>
            </div>
          </div>

          <Button type="submit" variant="primary" className="w-full pt-2">
            Create Account
          </Button>
        </form>

        <div className="border-t border-neutral-border pt-4 text-center text-xs text-text-muted">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </PageContainer>
  )
}
