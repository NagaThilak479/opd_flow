import axios from 'axios';

// Use explicit backend address or relative proxy
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 8000,
});

// Attach role and session headers for authorization enforcement
api.interceptors.request.use((config) => {
  try {
    const raw = sessionStorage.getItem('opd_flow_auth_session');
    if (raw) {
      const session = JSON.parse(raw);
      if (session.role === 'PATIENT' && session.patientToken) {
        config.headers['X-Patient-Token'] = session.patientToken;
        config.headers['X-User-Role'] = 'PATIENT';
      } else if (session.role === 'DOCTOR') {
        config.headers['X-User-Role'] = 'DOCTOR';
      }
    }
  } catch (e) {
    // Ignore storage parse errors
  }
  return config;
});

export const loginDoctor = async (doctorId, pin) => {
  const response = await api.post('/auth/doctor-login', { doctor_id: doctorId, pin });
  return response.data;
};

export const loginPatient = async (tokenNumber) => {
  const response = await api.post('/auth/patient-login', { token_number: tokenNumber });
  return response.data;
};

export const getPublicQueue = async () => {
  const response = await api.get('/queue/public');
  return response.data;
};

export const getQueue = async () => {
  const response = await api.get('/queue');
  return response.data;
};

export const getPatient = async (token) => {
  const response = await api.get(`/queue/${token.trim()}`);
  return response.data;
};

export const getPrediction = async (token) => {
  const response = await api.get(`/prediction/${token.trim()}`);
  return response.data;
};

export const addPatient = async (data) => {
  const response = await api.post('/queue/patient', data);
  return response.data;
};

export const callNextPatient = async () => {
  const response = await api.post('/queue/next');
  return response.data;
};

export const completePatient = async (token) => {
  const response = await api.post(`/queue/${token.trim()}/complete`);
  return response.data;
};

export const skipPatient = async (token) => {
  const response = await api.post(`/queue/${token.trim()}/skip`);
  return response.data;
};

export const getDoctor = async () => {
  const response = await api.get('/doctor');
  return response.data;
};

export const updateDoctorStatus = async (status) => {
  const response = await api.post('/doctor/status', { status });
  return response.data;
};

export const resetDemoQueue = async () => {
  const response = await api.post('/queue/reset');
  return response.data;
};

export const getHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api;
