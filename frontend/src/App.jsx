import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import PatientPage from './pages/PatientPage';
import StaffPage from './pages/StaffPage';
import { AuthProvider, useAuth } from './context/AuthContext';

// Protected Route Guard for Patients
function PatientRoute({ children }) {
  const { role, patientToken } = useAuth();
  if (role !== 'PATIENT' || !patientToken) {
    return <Navigate to="/" replace />;
  }
  return children;
}

// Protected Route Guard for Doctors
function DoctorRoute({ children }) {
  const { role } = useAuth();
  if (role === 'PATIENT') {
    // If a patient tries to navigate to /staff, redirect back to patient view
    return <Navigate to="/patient" replace />;
  }
  if (role !== 'DOCTOR') {
    // If unauthenticated, redirect to role selection
    return <Navigate to="/" replace />;
  }
  return children;
}

function AppContent() {
  const [dataVersion, setDataVersion] = useState(0);

  const triggerRefresh = () => {
    setDataVersion((v) => v + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      <Navbar onDataMutated={triggerRefresh} />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage key={`landing-${dataVersion}`} />} />
          
          {/* Protected Patient Routes (both /patient and /patient/:token lock to session token) */}
          <Route
            path="/patient"
            element={
              <PatientRoute>
                <PatientPage key={`patient-${dataVersion}`} />
              </PatientRoute>
            }
          />
          <Route
            path="/patient/:token"
            element={
              <PatientRoute>
                <PatientPage key={`patient-token-${dataVersion}`} />
              </PatientRoute>
            }
          />

          {/* Protected Staff / Doctor Route */}
          <Route
            path="/staff"
            element={
              <DoctorRoute>
                <StaffPage key={`staff-${dataVersion}`} />
              </DoctorRoute>
            }
          />

          {/* Fallback to Role Selection */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
