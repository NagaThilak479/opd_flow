import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginDoctor as loginDoctorApi, loginPatient as loginPatientApi } from '../services/api';

const AuthContext = createContext(null);

const STORAGE_KEY = 'opd_flow_auth_session';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to parse stored auth session", e);
    }
    return {
      role: 'NONE', // 'NONE' | 'PATIENT' | 'DOCTOR'
      patientToken: null,
      patientName: null,
      doctor: null,
      sessionToken: null,
    };
  });

  const [loading, setLoading] = useState(false);

  // Sync to sessionStorage
  useEffect(() => {
    try {
      if (session.role !== 'NONE') {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error("Failed to persist auth session", e);
    }
  }, [session]);

  const loginPatient = async (tokenNumber) => {
    setLoading(true);
    try {
      const formatted = tokenNumber.trim().toUpperCase();
      const res = await loginPatientApi(formatted);
      const newSession = {
        role: 'PATIENT',
        patientToken: res.token_number,
        patientName: res.patient_name,
        doctor: null,
        sessionToken: res.session_token,
      };
      setSession(newSession);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      return { success: true, data: res };
    } catch (err) {
      const msg = err.response?.data?.detail || "OPD Token lookup failed. Please verify your OPD number.";
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const loginDoctor = async (doctorId, pin) => {
    setLoading(true);
    try {
      const res = await loginDoctorApi(doctorId.trim(), pin.trim());
      const newSession = {
        role: 'DOCTOR',
        patientToken: null,
        patientName: null,
        doctor: {
          id: res.doctor_id,
          name: res.doctor_name,
          department: res.department,
          room: res.room_number,
        },
        sessionToken: res.session_token,
      };
      setSession(newSession);
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      return { success: true, data: res };
    } catch (err) {
      const msg = err.response?.data?.detail || "Invalid Doctor ID or PIN.";
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setSession({
      role: 'NONE',
      patientToken: null,
      patientName: null,
      doctor: null,
      sessionToken: null,
    });
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const value = {
    session,
    role: session.role,
    patientToken: session.patientToken,
    patientName: session.patientName,
    doctor: session.doctor,
    isPatient: session.role === 'PATIENT',
    isDoctor: session.role === 'DOCTOR',
    isAuthenticated: session.role !== 'NONE',
    loading,
    loginPatient,
    loginDoctor,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export default AuthContext;
