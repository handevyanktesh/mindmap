import React from 'react'
import { Link } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'

export default function StudentDashboard() {
  // Mock data for recent/active classrooms
  const activeClassrooms = [
    { id: 'math-101', name: 'Calculus I', code: 'CAL-101', time: '10:00 AM - 11:30 AM', status: 'live' },
    { id: 'cs-202', name: 'Data Structures', code: 'CS-202', time: '02:00 PM - 03:30 PM', status: 'scheduled' },
  ]

  return (
    <PageContainer size="default" className="space-y-8">
      {/* Welcome banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-border pb-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Student Portal
          </span>
          <h2 className="text-h1 mt-1">Welcome back, Student</h2>
        </div>
        <Link to="/student/join">
          <Button variant="primary">Join New Classroom</Button>
        </Link>
      </div>

      {/* Privacy reminder notice */}
      <div className="p-4 rounded-md bg-success-50 border border-success-200 text-success-600 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-medium">
        <span>
          <strong>Privacy Active:</strong> Webcam processing is done 100% locally on your computer. No raw video feed is uploaded to school or cloud servers.
        </span>
        <Link to="/student/check" className="text-primary-600 hover:underline shrink-0">
          Check Camera &rarr;
        </Link>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Classrooms List */}
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-h3">Today's Classrooms</h3>
          
          <div className="space-y-3">
            {activeClassrooms.map((room) => (
              <div key={room.id} className="card-panel flex justify-between items-center bg-panel-bg">
                <div>
                  <h4 className="font-semibold text-brand-navy">{room.name}</h4>
                  <div className="text-xs text-text-muted mt-1 space-x-2">
                    <span>Code: <code className="bg-neutral-light border px-1 rounded">{room.code}</code></span>
                    <span>&bull;</span>
                    <span>{room.time}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {room.status === 'live' ? (
                    <>
                      <StatusBadge status="success" label="LIVE" />
                      <Link to={`/student/classroom/${room.id}`}>
                        <Button variant="accent" className="text-xs py-1.5 px-3">Enter Room</Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      <StatusBadge status="info" label="Scheduled" />
                      <Button variant="secondary" className="text-xs py-1.5 px-3" disabled>Upcoming</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info panel / Sidebar */}
        <div className="space-y-6">
          <div className="card-panel bg-neutral-light/50 space-y-4">
            <h3 className="text-h3 text-xs uppercase tracking-wider text-text-muted">How to participate</h3>
            <ol className="text-xs text-text-muted space-y-2 list-decimal list-inside">
              <li>Check device configurations before the lecture.</li>
              <li>Enter classroom using the classroom code.</li>
              <li>Keep your camera view unobstructed during the session so MindMap can estimate engagement-related behaviour.</li>
              <li>View real-time estimates of your engagement-related behavior.</li>
            </ol>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
