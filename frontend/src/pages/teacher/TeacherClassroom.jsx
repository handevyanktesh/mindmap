import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'

export default function TeacherClassroom() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [classroom, setClassroom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchClassroom = async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await fetch(`http://localhost:8000/api/classrooms/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (response.status === 401 || response.status === 403) {
          navigate('/teacher')
          return
        }
        
        if (!response.ok) {
          throw new Error('Failed to load classroom details')
        }
        
        const data = await response.json()
        setClassroom(data)
      } catch (err) {
        console.error(err)
        setError('Could not load classroom.')
      } finally {
        setLoading(false)
      }
    }
    
    fetchClassroom()
  }, [id, navigate])

  const courseTitle = classroom ? classroom.name : `Classroom session: ${id?.toUpperCase()}`

  // Mock student tracking roster
  const studentRoster = [
    { name: 'Alice Smith', status: 'attentive', attention: '94%', confusion: '2%' },
    { name: 'Bob Johnson', status: 'confused', attention: '65%', confusion: '45%' },
    { name: 'Charlie Brown', status: 'attentive', attention: '88%', confusion: '8%' },
    { name: 'Diana Prince', status: 'away', attention: '15%', confusion: '0%' },
    { name: 'Evan Wright', status: 'confused', attention: '58%', confusion: '52%' }
  ]

  // Mock alerts list
  const activeAlerts = [
    { type: 'warning', message: 'High confusion indices detected (Topic: Bounds integration)', time: '3 mins ago' },
    { type: 'danger', message: 'Student "Diana Prince" camera feed inactive', time: '5 mins ago' }
  ]

  if (loading) {
    return <PageContainer size="large" className="py-6"><p className="text-text-muted">Loading...</p></PageContainer>
  }

  if (error) {
    return <PageContainer size="large" className="py-6"><p className="text-danger-600">{error}</p></PageContainer>
  }

  return (
    <PageContainer size="large" className="py-6 space-y-6">
      
      {/* Session header banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-panel-bg border border-neutral-border rounded p-4 shadow-sm">
        <div className="flex items-center gap-3">
          {classroom?.is_active ? <StatusBadge status="success" label="Active Live Feed" /> : <StatusBadge status="info" label="Inactive" />}
          <div>
            <h2 className="font-bold text-brand-navy text-base">
              {courseTitle} 
              <span className="text-[10px] font-normal text-warning-600 bg-warning-50 px-2 py-0.5 rounded ml-2 align-middle">Demo Data</span>
            </h2>
            <p className="text-[10px] text-text-muted">Live Code: <code className="bg-neutral-light border px-1 rounded font-semibold uppercase">{classroom?.join_code}</code></p>
          </div>
        </div>
        <Link to="/teacher">
          <Button variant="secondary" className="text-xs py-1.5 px-3">Dashboard</Button>
        </Link>
      </div>

      {/* Metric summaries widget grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card-panel text-center">
          <span className="text-[10px] uppercase font-mono text-text-muted">Avg Engagement Estimate</span>
          <div className="text-3xl font-extrabold text-primary-600 mt-1">82%</div>
          <span className="text-[9px] text-success-600 font-bold block mt-1">&#8593; Optimal Range</span>
        </div>

        <div className="card-panel text-center">
          <span className="text-[10px] uppercase font-mono text-text-muted">Avg Confusion-related Signal</span>
          <div className="text-3xl font-extrabold text-warning-600 mt-1">16%</div>
          <span className="text-[9px] text-text-muted block mt-1">Baseline Reference</span>
        </div>

        <div className="card-panel text-center">
          <span className="text-[10px] uppercase font-mono text-text-muted">Active Warnings</span>
          <div className="text-3xl font-extrabold text-danger-600 mt-1">{activeAlerts.length}</div>
          <span className="text-[9px] text-danger-600 font-semibold block mt-1">Requires Interaction</span>
        </div>
      </div>

      {/* Engagement Timeline Graph Card */}
      <div className="card-panel space-y-4">
        <div className="flex justify-between items-center border-b border-neutral-border pb-3">
          <h3 className="text-h3 text-xs uppercase tracking-wider text-text-muted">Live Engagement Trend Timeline</h3>
          <span className="text-[9px] font-mono text-text-muted">[ Updated every 5 seconds ]</span>
        </div>

        {/* Mock Line Graph visual placeholder */}
        <div className="border border-neutral-border rounded p-6 bg-neutral-light/35 flex flex-col justify-center items-center text-center h-40">
          <div className="w-full flex items-end justify-between gap-2 max-w-2xl h-24 pt-4 border-b border-l border-neutral-border select-none">
            <div className="w-full bg-primary-600/20 h-16 hover:bg-primary-600/30 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">70%</span>
            </div>
            <div className="w-full bg-primary-600/30 h-18 hover:bg-primary-600/40 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">75%</span>
            </div>
            <div className="w-full bg-primary-600/40 h-20 hover:bg-primary-600/50 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">80%</span>
            </div>
            <div className="w-full bg-primary-600/50 h-20 hover:bg-primary-600/60 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">80%</span>
            </div>
            <div className="w-full bg-primary-600/70 h-22 hover:bg-primary-600/80 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">88%</span>
            </div>
            <div className="w-full bg-primary-600 h-24 hover:bg-primary-700 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">92%</span>
            </div>
            <div className="w-full bg-primary-600 h-22 hover:bg-primary-700 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">88%</span>
            </div>
            <div className="w-full bg-primary-600/80 h-16 hover:bg-primary-600/90 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">70%</span>
            </div>
            <div className="w-full bg-primary-600/60 h-14 hover:bg-primary-600/70 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">65%</span>
            </div>
            <div className="w-full bg-primary-600/80 h-20 hover:bg-primary-600/95 rounded-t-sm relative group">
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 bg-brand-navy text-white text-[8px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">82%</span>
            </div>
          </div>
          <div className="flex justify-between w-full max-w-2xl text-[9px] text-text-muted mt-2 font-mono">
            <span>10:00 AM</span>
            <span>10:10 AM</span>
            <span>10:20 AM</span>
            <span>10:30 AM (Current)</span>
          </div>
        </div>
      </div>

      {/* Roster & Anomaly Alert Split Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Student metrics list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card-panel space-y-4">
            <h3 className="text-h3 border-b border-neutral-border pb-3">Student Engagement Logs</h3>
            
            <div className="divide-y divide-neutral-border">
              {studentRoster.map((student, idx) => (
                <div key={idx} className="flex justify-between items-center py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-light border border-neutral-border flex items-center justify-center font-bold text-xs text-brand-navy">
                      {student.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-brand-navy">{student.name}</div>
                      <div className="text-[10px] text-text-muted">Metrics calculated locally</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right text-xs">
                      <div>Engagement: <strong className="text-primary-600">{student.attention}</strong></div>
                      <div>Confusion Signal: <strong className="text-warning-600">{student.confusion}</strong></div>
                    </div>
                    {student.status === 'attentive' ? (
                      <StatusBadge status="success" label="Active" />
                    ) : student.status === 'confused' ? (
                      <StatusBadge status="warning" label="Confused" />
                    ) : (
                      <StatusBadge status="danger" label="Away" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side: Alert dashboard warnings */}
        <div className="space-y-4">
          <div className="card-panel space-y-4">
            <h3 className="text-h3 border-b border-neutral-border pb-3">Anomalous Activity Logs</h3>
            
            <div className="space-y-3">
              {activeAlerts.map((alert, idx) => (
                <div key={idx} className={`p-4 rounded border text-xs leading-relaxed ${
                  alert.type === 'danger'
                    ? 'bg-danger-50 border-danger-200 text-danger-600'
                    : 'bg-warning-50 border-warning-200 text-warning-600'
                }`}>
                  <div className="flex justify-between font-bold mb-1">
                    <span className="uppercase text-[9px]">{alert.type === 'danger' ? 'Critical Action' : 'Notice Alert'}</span>
                    <span className="font-mono font-normal text-text-muted">{alert.time}</span>
                  </div>
                  <p>{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </PageContainer>
  )
}
