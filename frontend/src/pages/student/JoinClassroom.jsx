import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Input from '../../components/Input'
import Button from '../../components/Button'

export default function JoinClassroom() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const [loading, setLoading] = useState(false)

  const handleJoin = async (e) => {
    e.preventDefault()
    const cleanCode = code.trim().toUpperCase()
    if (!cleanCode) {
      setError('Classroom access code is required.')
      return
    }
    
    setError('')
    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`http://localhost:8000/api/classrooms/code/${cleanCode}/active-session`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (res.status === 401) {
        navigate('/login')
        return
      }

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.detail || 'Could not find an active session for this code.')
      }

      const data = await res.json()
      navigate('/student/check', {
        state: {
          classroomId: data.classroom_id,
          classroomName: data.classroom_name,
          joinCode: data.join_code,
          sessionId: data.session_id,
          sessionTitle: data.session_title
        }
      })
    } catch (err) {
      setError(err.message || 'Error connecting to session.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageContainer size="small" className="py-16">
      <div className="card-panel space-y-6">
        <div className="space-y-1">
          <Link to="/student" className="text-xs text-primary-600 font-semibold hover:underline">
            &larr; Back to Dashboard
          </Link>
          <h2 className="text-h2 pt-2">Join Classroom</h2>
          <p className="text-body text-xs">Enter code provided by your instructor</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <Input
            label="Classroom Access Code"
            id="class-code"
            placeholder="e.g. CAL-101"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={error}
            maxLength={10}
            className="uppercase"
            autoFocus
          />

          <Button type="submit" variant="primary" className="w-full pt-2" disabled={loading}>
            {loading ? 'Verifying Code...' : 'Verify Code'}
          </Button>
        </form>

        <div className="border-t border-neutral-border pt-4 text-xs text-text-muted space-y-2 leading-relaxed">
          <h4 className="font-semibold text-brand-navy">What happens next?</h4>
          <p>
            1. The code will verify class accessibility on our secure networks.
          </p>
          <p>
            2. You will go to the pre-class device diagnostic step to authorize sandboxed camera access.
          </p>
          <p>
            3. Derivations will calculate metrics local to your machine before stream syncing.
          </p>
        </div>
      </div>
    </PageContainer>
  )
}
