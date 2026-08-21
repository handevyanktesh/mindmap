import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Layouts
import PublicLayout from './layouts/PublicLayout'
import DashboardLayout from './layouts/DashboardLayout'

// Public Pages
import LandingPage from './pages/public/LandingPage'
import LoginPage from './pages/public/LoginPage'
import RegisterPage from './pages/public/RegisterPage'

// Student Pages
import StudentDashboard from './pages/student/StudentDashboard'
import JoinClassroom from './pages/student/JoinClassroom'
import DeviceCheck from './pages/student/DeviceCheck'
import StudentClassroom from './pages/student/StudentClassroom'

// Teacher Pages
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import CreateClassroom from './pages/teacher/CreateClassroom'
import TeacherClassroom from './pages/teacher/TeacherClassroom'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes wrapped inside PublicLayout */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Dashboard Routes wrapped inside DashboardLayout */}
        <Route element={<DashboardLayout />}>
          {/* Student routes */}
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/join" element={<JoinClassroom />} />
          <Route path="/student/check" element={<DeviceCheck />} />
          <Route path="/student/classroom/:id" element={<StudentClassroom />} />

          {/* Teacher routes */}
          <Route path="/teacher" element={<TeacherDashboard />} />
          <Route path="/teacher/create" element={<CreateClassroom />} />
          <Route path="/teacher/classroom/:id" element={<TeacherClassroom />} />
        </Route>

        {/* Fallback route - redirect to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
