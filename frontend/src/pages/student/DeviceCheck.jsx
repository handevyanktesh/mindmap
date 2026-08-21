import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'

export default function DeviceCheck() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Retrieve passed classroomId from route state or default to demo ID
  const classroomId = location.state?.classroomId || 'math-101'

  const [camStatus, setCamStatus] = useState('pending')
  const [micStatus, setMicStatus] = useState('pending')

  const triggerCamCheck = () => {
    setCamStatus('checking')
    setTimeout(() => setCamStatus('ready'), 800)
  }

  const triggerMicCheck = () => {
    setMicStatus('checking')
    setTimeout(() => setMicStatus('ready'), 800)
  }

  const handleContinue = () => {
    navigate(`/student/classroom/${classroomId}`)
  }

  return (
    <PageContainer size="default" className="py-12 space-y-8">
      <div className="border-b border-neutral-border pb-6">
        <Link to="/student" className="text-xs text-primary-600 font-semibold hover:underline">
          &larr; Exit Session Setup
        </Link>
        <h2 className="text-h1 mt-2">Device Diagnostics Check</h2>
        <p className="text-body text-xs mt-1">Verify browser capabilities before entering classroom session</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Device checklist */}
        <div className="md:col-span-2 space-y-4">
          <div className="card-panel bg-panel-bg space-y-6">
            <h3 className="text-h3 border-b border-neutral-border pb-3">Hardware Integrity</h3>
            
            {/* Camera mock control */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border border-neutral-border rounded bg-neutral-light/35">
              <div>
                <h4 className="font-semibold text-sm text-brand-navy">Webcam Device</h4>
                <p className="text-xs text-text-muted mt-0.5">Required for tracking head pose & facial engagement indexes</p>
              </div>
              <div className="flex items-center gap-3">
                {camStatus === 'ready' ? (
                  <StatusBadge status="success" label="Connected" />
                ) : camStatus === 'checking' ? (
                  <StatusBadge status="warning" label="Testing..." />
                ) : (
                  <Button variant="secondary" className="text-xs py-1.5 px-3" onClick={triggerCamCheck}>
                    Permit & Check
                  </Button>
                )}
              </div>
            </div>

            {/* Mic mock control */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border border-neutral-border rounded bg-neutral-light/35">
              <div>
                <h4 className="font-semibold text-sm text-brand-navy">Microphone Device</h4>
                <p className="text-xs text-text-muted mt-0.5">Required for optional local voice participation questions</p>
              </div>
              <div className="flex items-center gap-3">
                {micStatus === 'ready' ? (
                  <StatusBadge status="success" label="Connected" />
                ) : micStatus === 'checking' ? (
                  <StatusBadge status="warning" label="Testing..." />
                ) : (
                  <Button variant="secondary" className="text-xs py-1.5 px-3" onClick={triggerMicCheck}>
                    Permit & Check
                  </Button>
                )}
              </div>
            </div>

            {/* Navigation action */}
            <div className="pt-4 border-t border-neutral-border flex justify-end">
              <Button
                variant="primary"
                onClick={handleContinue}
                disabled={camStatus !== 'ready'}
              >
                {camStatus === 'ready' ? 'Continue to Classroom' : 'Camera Authorization Required'}
              </Button>
            </div>
          </div>
        </div>

        {/* Sidebar notes */}
        <div className="space-y-6">
          <div className="card-panel bg-panel-bg space-y-4">
            <StatusBadge status="success" label="Secure Sandbox" />
            <h3 className="text-h3 text-xs uppercase tracking-wider text-text-muted">Privacy Safeguards</h3>
            <div className="text-xs text-text-muted space-y-3 leading-relaxed">
              <p>
                <strong>Local Video Frames:</strong> Your hardware checks run purely inside Chrome/Firefox system hooks. The web server has no direct access to device streams.
              </p>
              <p>
                <strong>Permission Control:</strong> You can revoke webcam access permissions through browser address bar security controls at any point.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
