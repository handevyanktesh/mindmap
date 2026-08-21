import React from 'react'
import { Link } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'

export default function TeacherDashboard() {
  // Mock data for classrooms and recent sessions
  const activeClassrooms = [
    { id: 'math-101', name: 'Calculus I', code: 'CAL-101', students: 42, status: 'live' },
    { id: 'cs-301', name: 'Introduction to Algorithms', code: 'CS-301', students: 0, status: 'scheduled' }
  ]

  const recentSessions = [
    { date: '2026-08-19', name: 'Calculus I (Lecture 14)', avgAttention: '82%', peakConfusion: '18%' },
    { date: '2026-08-18', name: 'Intro to Algorithms (Lecture 2)', avgAttention: '78%', peakConfusion: '22%' },
  ]

  return (
    <PageContainer size="default" className="space-y-8">
      {/* Dashboard Welcome */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-border pb-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Instructor Portal
          </span>
          <h2 className="text-h1 mt-1">Instructor Dashboard</h2>
        </div>
        <Link to="/teacher/create">
          <Button variant="accent">Create Classroom Session</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Main Class List */}
        <div className="md:col-span-2 space-y-6">
          <div className="space-y-4">
            <h3 className="text-h3">Active & Scheduled Classrooms <span className="text-[10px] font-normal text-warning-600 bg-warning-50 px-2 py-0.5 rounded ml-2 align-middle">Demo Data</span></h3>
            
            <div className="space-y-3">
              {activeClassrooms.map((room) => (
                <div key={room.id} className="card-panel flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-panel-bg">
                  <div>
                    <h4 className="font-semibold text-brand-navy">{room.name}</h4>
                    <div className="text-xs text-text-muted mt-1 space-x-2">
                      <span>Code: <code className="bg-neutral-light border px-1 rounded">{room.code}</code></span>
                      <span>&bull;</span>
                      <span>{room.students} enrolled students</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {room.status === 'live' ? (
                      <>
                        <StatusBadge status="success" label="Active Live" />
                        <Link to={`/teacher/classroom/${room.id}`}>
                          <Button variant="primary" className="text-xs py-1.5 px-3">View Live Dashboard</Button>
                        </Link>
                      </>
                    ) : (
                      <>
                        <StatusBadge status="info" label="Inactive" />
                        <Link to={`/teacher/classroom/${room.id}`}>
                          <Button variant="secondary" className="text-xs py-1.5 px-3">Activate Session</Button>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent History Table */}
          <div className="space-y-4">
            <h3 className="text-h3">Recent Session Performance Logs <span className="text-[10px] font-normal text-warning-600 bg-warning-50 px-2 py-0.5 rounded ml-2 align-middle">Demo Data</span></h3>
            <div className="border border-neutral-border rounded overflow-hidden shadow-sm bg-panel-bg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-neutral-light border-b border-neutral-border font-semibold text-brand-navy">
                    <th className="p-3">Date</th>
                    <th className="p-3">Session Topic</th>
                    <th className="p-3">Avg Engagement</th>
                    <th className="p-3">Peak Confusion Signal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-border text-text-muted">
                  {recentSessions.map((session, idx) => (
                    <tr key={idx} className="hover:bg-neutral-light/35">
                      <td className="p-3 font-mono">{session.date}</td>
                      <td className="p-3 font-semibold text-brand-navy-light">{session.name}</td>
                      <td className="p-3 text-primary-600 font-bold">{session.avgAttention}</td>
                      <td className="p-3 text-warning-600 font-bold">{session.peakConfusion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Action Panel sidebar */}
        <div className="space-y-6">
          <div className="card-panel bg-neutral-light/50 space-y-4">
            <h3 className="text-h3 text-xs uppercase tracking-wider text-text-muted">Classroom Integration</h3>
            <p className="text-xs text-text-muted leading-relaxed">
              Create a classroom session, copy the generated code, and share it with students. Once students authorize camera checks, derived behavioural signals will start feeding into the live analytics graphs.
            </p>
          </div>
        </div>

      </div>
    </PageContainer>
  )
}
