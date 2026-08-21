import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Input from '../../components/Input'
import Button from '../../components/Button'

export default function CreateClassroom() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name || !subject) {
      setError('Classroom Name and Subject are required.')
      return
    }

    setError('')
    // Simulate successful creation and redirect back to dashboard
    // In future versions this will connect to the FastAPI backend API
    navigate('/teacher')
  }

  return (
    <PageContainer size="small" className="py-12">
      <div className="card-panel space-y-6">
        <div className="space-y-1">
          <Link to="/teacher" className="text-xs text-primary-600 font-semibold hover:underline">
            &larr; Back to Dashboard
          </Link>
          <h2 className="text-h2 pt-2">Create Classroom</h2>
          <p className="text-body text-xs">Set up a new live session for students to join</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-danger-50 border border-danger-200 text-danger-600 text-xs rounded font-medium">
              {error}
            </div>
          )}

          <Input
            label="Classroom Name"
            id="class-name"
            placeholder="e.g. Advanced Calculus Section A"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Input
            label="Subject / Topic"
            id="subject"
            placeholder="e.g. Mathematics"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            required
          />

          <div>
            <label htmlFor="description" className="block text-xs font-semibold text-brand-navy-light mb-1.5">
              Description (Optional)
            </label>
            <textarea
              id="description"
              rows="3"
              className="input-text resize-none"
              placeholder="Provide context or instructions for this session..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="primary" className="flex-grow">
              Create and Open Room
            </Button>
            <Link to="/teacher" className="flex-grow flex">
              <Button variant="secondary" className="w-full">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </PageContainer>
  )
}
