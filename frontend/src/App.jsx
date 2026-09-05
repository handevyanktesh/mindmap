import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

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

// Route Protection Wrapper
const ProtectedRoute = ({ children, allowedRole }) => {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRole && user.role !== allowedRole) {
    // Redirect to their own dashboard if wrong role
    return <Navigate to={`/${user.role}`} replace />;
  }
  
  return children;
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
            <Route path="/student" element={<ProtectedRoute allowedRole="student"><StudentDashboard /></ProtectedRoute>} />
            <Route path="/student/join" element={<ProtectedRoute allowedRole="student"><JoinClassroom /></ProtectedRoute>} />
            <Route path="/student/check" element={<ProtectedRoute allowedRole="student"><DeviceCheck /></ProtectedRoute>} />
            <Route path="/student/classroom/:id" element={<ProtectedRoute allowedRole="student"><StudentClassroom /></ProtectedRoute>} />

            {/* Teacher routes */}
            <Route path="/teacher" element={<ProtectedRoute allowedRole="teacher"><TeacherDashboard /></ProtectedRoute>} />
            <Route path="/teacher/create" element={<ProtectedRoute allowedRole="teacher"><CreateClassroom /></ProtectedRoute>} />
            <Route path="/teacher/classroom/:id" element={<ProtectedRoute allowedRole="teacher"><TeacherClassroom /></ProtectedRoute>} />
          </Route>

          {/* Fallback route - redirect to landing */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
