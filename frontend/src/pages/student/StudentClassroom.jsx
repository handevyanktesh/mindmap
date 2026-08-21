import React from 'react'
import { useParams, Link } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'

export default function StudentClassroom() {
  const { id } = useParams()

  // Format ID for clean display
  const courseTitle = id === 'math-101' ? 'Calculus I (CAL-101)' : `Classroom session: ${id?.toUpperCase()}`

  return (
    <PageContainer size="large" className="py-6 space-y-6">
      {/* Classroom Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-panel-bg border border-neutral-border rounded p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <StatusBadge status="success" label="Active Sync" />
          <div>
            <h2 className="font-bold text-brand-navy text-base">{courseTitle}</h2>
            <p className="text-[10px] text-text-muted">Instructor: Dr. Alan Turing &bull; Live Lecture Session</p>
          </div>
        </div>
        <Link to="/student">
          <Button variant="secondary" className="text-xs py-1.5 px-3">Exit Room</Button>
        </Link>
      </div>

      {/* Main Classroom Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Lecture Content Panel (Slides/Stream mock) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-panel-bg border border-neutral-border rounded-lg overflow-hidden shadow-sm">
            {/* Aspect Ratio slide mock container */}
            <div className="bg-brand-navy text-white flex flex-col justify-between p-8 aspect-video select-none">
              <div className="flex justify-between items-center text-xs font-mono text-neutral-400">
                <span>Lecture Slide #12 &mdash; Fundamental Theorem of Calculus</span>
                <span>MindMap Player</span>
              </div>
              
              <div className="text-center my-auto space-y-4">
                <h2 className="text-xl md:text-2xl font-bold font-sans">
                  {"f(x) = \u222B[a, b] f'(t) dt"}
                </h2>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto font-sans leading-relaxed">
                  The derivative of an integral function yields the original continuous curve parameters. Pay close attention to bounds definition.
                </p>
              </div>
              
              <div className="flex justify-between items-center text-xs text-neutral-400 pt-4 border-t border-neutral-800">
                <span>Live Audio Stream: Connected</span>
                <span>Lecture Mode: Broadcast</span>
              </div>
            </div>

            {/* Slide Navigation Mock */}
            <div className="p-3 bg-neutral-light border-t border-neutral-border flex justify-between items-center text-xs text-text-muted">
              <span>Synchronized with Instructor's Presentation screen</span>
              <div className="flex gap-2">
                <button type="button" className="px-2.5 py-1 bg-panel-bg border border-neutral-border rounded disabled:opacity-50" disabled>&larr; Prev</button>
                <button type="button" className="px-2.5 py-1 bg-panel-bg border border-neutral-border rounded disabled:opacity-50" disabled>Next &rarr;</button>
              </div>
            </div>
          </div>
        </div>

        {/* Local Diagnostics & Metrics sidebar */}
        <div className="space-y-6">
          {/* Self view camera wrapper */}
          <div className="card-panel bg-panel-bg space-y-4">
            <h3 className="text-h3 text-xs uppercase tracking-wider text-text-muted">Self-View Monitor</h3>
            
            {/* Simulated webcam video feed placeholder */}
            <div className="bg-neutral-light border border-neutral-border rounded aspect-video flex flex-col items-center justify-center text-center p-4 relative overflow-hidden">
              <span className="text-xs text-text-muted font-mono bg-panel-bg px-2 py-1 rounded shadow-sm z-10 border border-neutral-border">
                [ CAMERA PREVIEW ACTIVE ]
              </span>
              <p className="text-[9px] text-text-muted mt-2 max-w-[140px] z-10 font-sans">
                Webcam stream processed 100% locally.
              </p>
              {/* Subtle design frame layout */}
              <div className="absolute inset-0 border-2 border-neutral-border/60"></div>
              <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-emerald-500 rounded-full"></div>
            </div>
          </div>

          {/* Behavioural coefficients */}
          <div className="card-panel bg-panel-bg space-y-4">
            <h3 className="text-h3 text-xs uppercase tracking-wider text-text-muted">Your Local Metrics</h3>
            
            <div className="space-y-3 font-sans text-xs">
              <div>
                <div className="flex justify-between mb-1 font-semibold text-text-navy">
                  <span>Engagement Estimate</span>
                  <span>92%</span>
                </div>
                <div className="w-full bg-neutral-light border border-neutral-border rounded-full h-2">
                  <div className="bg-primary-600 h-full rounded-full" style={{ width: '92%' }}></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1 font-semibold text-text-navy">
                  <span>Confusion-related Signal</span>
                  <span>5%</span>
                </div>
                <div className="w-full bg-neutral-light border border-neutral-border rounded-full h-2">
                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: '5%' }}></div>
                </div>
              </div>
            </div>
            
            <div className="border-t border-neutral-border pt-3 text-[9px] text-text-muted leading-relaxed">
              * Local values represent temporary measurements based on simulated behavioural signals. Only derived numerical values are pushed.
            </div>
          </div>
        </div>

      </div>
    </PageContainer>
  )
}
