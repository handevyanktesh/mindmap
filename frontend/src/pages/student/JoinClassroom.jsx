import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Input from '../../components/Input'
import Button from '../../components/Button'

export default function JoinClassroom() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const handleJoin = (e) => {
    e.preventDefault()
    if (!code.trim()) {
      setError('Classroom access code is required.')
      return
    }
    
    // Simulate simple valid code check (e.g. must be alphanumeric and > 3 characters)
    if (code.length < 4) {
      setError('Invalid code format. Codes must contain at least 4 characters.')
      return
    }

    setError('')
    // After joining, we send them to the Device Check page (as step before classroom) 
    // or directly to the classroom. Let's send them to the check page or room.
    // The requirement says: Join Classroom page -> Camera/device check page -> Student classroom page.
    // So we navigate to `/student/check` passing the classroom code state if needed.
    navigate('/student/check', { state: { classroomId: code.trim().toLowerCase() } })
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

          <Button type="submit" variant="primary" className="w-full pt-2">
            Verify Code
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
