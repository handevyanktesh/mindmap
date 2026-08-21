import React from 'react'
import { Link } from 'react-router-dom'
import PageContainer from '../../components/PageContainer'
import Button from '../../components/Button'
import StatusBadge from '../../components/StatusBadge'

export default function LandingPage() {
  return (
    <div className="space-y-16 py-8">
      {/* Hero Section */}
      <section className="text-center py-12 bg-panel-bg border-b border-neutral-border/50">
        <PageContainer size="default" className="space-y-6">
          <StatusBadge status="info" label="Privacy-First EdTech Solution" />
          <h1 className="text-h1 tracking-tight">
            Understand classroom engagement while the lesson is happening.
          </h1>
          <p className="text-body text-base max-w-xl mx-auto">
            MindMap provides behavioral engagement insights and estimated engagement behavior in real-time, keeping all raw webcam video processing entirely local on the student's device.
          </p>
          <div className="flex flex-wrap justify-center gap-4 pt-2">
            <Link to="/register">
              <Button variant="primary">Get Started</Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="secondary">How it works</Button>
            </a>
          </div>
        </PageContainer>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="scroll-mt-20">
        <PageContainer size="default">
          <div className="text-center mb-10">
            <h2 className="text-h2">A Simple, Privacy-Preserving Workflow</h2>
            <p className="text-body mt-2">Insights generated dynamically without compromising student data.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card-panel flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs font-semibold text-primary-600 uppercase">Step 01</span>
                <h3 className="text-h3 mt-2 mb-3">Student Browser</h3>
                <p className="text-body text-xs">
                  Students join the live classroom sessions directly via their web browser. Webcam feeds are activated locally.
                </p>
              </div>
            </div>

            <div className="card-panel flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs font-semibold text-accent-600 uppercase">Step 02</span>
                <h3 className="text-h3 mt-2 mb-3">Behavioral Signals</h3>
                <p className="text-body text-xs">
                  On-device ML algorithms compute head pose, blink rate, and expressions to generate raw behavioural and confusion-related signal markers.
                </p>
              </div>
            </div>

            <div className="card-panel flex flex-col justify-between">
              <div>
                <span className="font-mono text-xs font-semibold text-text-navy uppercase">Step 03</span>
                <h3 className="text-h3 mt-2 mb-3">Teacher Insights</h3>
                <p className="text-body text-xs">
                  Derived engagement signals are securely pushed to the teacher's dashboard, plotting real-time estimated class engagement trends.
                </p>
              </div>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Privacy Section */}
      <section id="privacy" className="bg-panel-bg py-12 border-y border-neutral-border/50 scroll-mt-20">
        <PageContainer size="default" className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <StatusBadge status="success" label="Local AI Processing" />
            <h2 className="text-h2 mt-3 mb-4">Your Video Never Leaves Your Device</h2>
            <p className="text-body text-sm mb-4">
              MindMap uses advanced browser-based computer vision frameworks. The camera capture is processed within the browser sandbox.
            </p>
            <p className="text-body text-sm">
              Only derived aggregate integers representing engagement signals (0 to 100) are securely transmitted to the server. No video frames or face templates are ever uploaded or stored.
            </p>
          </div>
          <div className="border border-neutral-border rounded p-6 bg-app-bg font-mono text-xs space-y-3">
            <div className="text-text-muted">// Local privacy enforcement verification</div>
            <div className="flex justify-between border-b border-neutral-border pb-1">
              <span>Webcam Access:</span>
              <span className="text-success-600 font-semibold">Local Sandbox Only</span>
            </div>
            <div className="flex justify-between border-b border-neutral-border pb-1">
              <span>Data Streamed:</span>
              <span className="text-accent-600 font-semibold">&#123; engagementScore, confusionSignal &#125;</span>
            </div>
            <div className="flex justify-between">
              <span>Video Transmission:</span>
              <span className="text-danger-600 font-semibold">DISABLED / BLOCKED</span>
            </div>
          </div>
        </PageContainer>
      </section>

      {/* Dashboard Preview Section */}
      <section className="pb-8">
        <PageContainer size="large">
          <div className="text-center mb-10">
            <h2 className="text-h2 font-semibold">Teacher Dashboard Preview (Demo Data)</h2>
            <p className="text-body mt-2">Sample session showing real-time aggregate engagement graphs during live lectures.</p>
          </div>

          <div className="card-panel bg-panel-bg max-w-4xl mx-auto space-y-6">
            {/* Dashboard Header Bar */}
            <div className="flex justify-between items-center border-b border-neutral-border pb-4">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-text-muted">Demo Data - Live Session Preview</span>
                <h3 className="font-semibold text-brand-navy">Introduction to Algorithms (CS-301)</h3>
              </div>
              <div className="flex gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse mt-1"></span>
                <span className="text-xs font-semibold text-emerald-800">42 Students Active</span>
              </div>
            </div>

            {/* Dashboard Mock Widgets */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="border border-neutral-border rounded p-4 text-center">
                <div className="text-xs text-text-muted uppercase font-semibold">Average Engagement Estimate</div>
                <div className="text-2xl font-bold text-primary-600 mt-1">84%</div>
                <span className="text-[9px] text-success-600 font-bold">&#8593; 3% compared to baseline</span>
              </div>
              <div className="border border-neutral-border rounded p-4 text-center">
                <div className="text-xs text-text-muted uppercase font-semibold">Confusion-related signal</div>
                <div className="text-2xl font-bold text-warning-600 mt-1">12%</div>
                <span className="text-[9px] text-text-muted">Sample baseline signal</span>
              </div>
              <div className="border border-neutral-border rounded p-4 text-center">
                <div className="text-xs text-text-muted uppercase font-semibold">Action Alerts</div>
                <div className="text-2xl font-bold text-text-navy mt-1">None</div>
                <span className="text-[9px] text-text-muted">No high confusion-related behavior alerts</span>
              </div>
            </div>

            {/* Graphic Chart Placeholder */}
            <div className="border border-neutral-border/80 border-dashed rounded-lg p-8 bg-neutral-light/50 flex flex-col justify-center items-center text-center h-48">
              <div className="font-mono text-xs text-text-muted mb-2">[ Demo Data - Live Engagement Estimate Graph (0m - 45m) ]</div>
              <div className="w-full flex items-end justify-between gap-1 max-w-lg h-24 pt-4 border-b border-l border-neutral-border">
                <div className="w-full bg-primary-600/20 h-10 hover:bg-primary-600/30 rounded-t-sm"></div>
                <div className="w-full bg-primary-600/30 h-12 hover:bg-primary-600/40 rounded-t-sm"></div>
                <div className="w-full bg-primary-600/40 h-16 hover:bg-primary-600/50 rounded-t-sm"></div>
                <div className="w-full bg-primary-600/60 h-20 hover:bg-primary-600/70 rounded-t-sm"></div>
                <div className="w-full bg-primary-600/80 h-22 hover:bg-primary-600/90 rounded-t-sm"></div>
                <div className="w-full bg-primary-600 h-24 hover:bg-primary-700 rounded-t-sm"></div>
                <div className="w-full bg-primary-600/90 h-20 hover:bg-primary-600/90 rounded-t-sm"></div>
                <div className="w-full bg-primary-600/70 h-16 hover:bg-primary-600/70 rounded-t-sm"></div>
              </div>
              <span className="text-[10px] text-text-muted mt-2 font-mono">X-Axis: Lecture Timeline &bull; Y-Axis: Aggregated Engagement Estimate %</span>
            </div>
          </div>
        </PageContainer>
      </section>
    </div>
  )
}
