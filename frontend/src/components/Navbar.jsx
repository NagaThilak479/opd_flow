import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Activity, RotateCcw, 
  LogOut, Lock, Stethoscope 
} from 'lucide-react';
import { getDoctor, resetDemoQueue } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onDataMutated }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, patientToken, logout } = useAuth();

  const isHomePage = location.pathname === '/';

  const [doctor, setDoctor] = useState(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const fetchDoctorInfo = async () => {
    try {
      const data = await getDoctor();
      setDoctor(data);
    } catch (err) {
      console.error("Failed to load doctor info", err);
    }
  };

  useEffect(() => {
    fetchDoctorInfo();
    const interval = setInterval(fetchDoctorInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleReset = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      await resetDemoQueue();
      setResetSuccess(true);
      await fetchDoctorInfo();
      if (onDataMutated) onDataMutated();
      setTimeout(() => setResetSuccess(false), 2000);
    } catch (err) {
      console.error("Reset failed", err);
    } finally {
      setIsResetting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const getDoctorBadge = () => {
    if (!doctor) return null;
    if (doctor.status === 'AVAILABLE') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-50 text-zinc-700 border border-zinc-200 rounded-md text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          <span>{doctor.name} &bull; Ready</span>
        </div>
      );
    }
    if (doctor.status === 'PAUSED') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50/60 text-amber-800 border border-amber-200/80 rounded-md text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
          <span>{doctor.name} &bull; Paused</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50/60 text-blue-700 border border-blue-200/80 rounded-md text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
        <span>{doctor.name} &bull; Consulting</span>
      </div>
    );
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xs border-b border-zinc-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white transition-opacity group-hover:opacity-90">
            <Activity className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold tracking-tight text-zinc-900">OPD Flow</span>
            <span className="text-xs text-zinc-500 font-normal hidden sm:inline">Queue Intelligence</span>
          </div>
        </Link>

        {/* Doctor Status Badge (Visible ONLY on Doctor Dashboard /staff) */}
        {!isHomePage && role === 'DOCTOR' && (
          <div className="hidden md:flex items-center">
            {getDoctorBadge()}
          </div>
        )}

        {/* Navigation & Session Controls */}
        <div className="flex items-center gap-2">
          
          {/* HOMEPAGE HEADER: Simple Role Selection indicator */}
          {isHomePage ? (
            <span className="text-xs font-medium text-zinc-500 px-2 py-1">
              Role Selection
            </span>
          ) : (
            <>
              {/* PATIENT SESSION NAV */}
              {role === 'PATIENT' && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 text-zinc-800 border border-zinc-200 rounded-md text-xs font-medium">
                    <Lock className="w-3 h-3 text-blue-600" />
                    <span>Session: <strong className="font-semibold text-zinc-950">{patientToken}</strong></span>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-900 border border-zinc-200 rounded-md text-xs font-medium transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3 h-3 text-zinc-500" />
                    <span>Exit</span>
                  </button>
                </div>
              )}

              {/* DOCTOR SESSION NAV */}
              {role === 'DOCTOR' && (
                <div className="flex items-center gap-2">
                  <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 text-zinc-700 border border-zinc-200 rounded-md text-xs font-medium">
                    <Stethoscope className="w-3 h-3 text-blue-600" />
                    <span>Physician</span>
                  </span>

                  {/* Demo Reset Button */}
                  <button
                    onClick={handleReset}
                    disabled={isResetting}
                    title="Reset queue to initial demo state"
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 rounded-md transition-colors border border-zinc-200 disabled:opacity-50 cursor-pointer"
                  >
                    <RotateCcw className={`w-3 h-3 ${isResetting ? 'animate-spin text-blue-600' : 'text-zinc-500'}`} />
                    <span>{resetSuccess ? 'Reset' : 'Reset Demo'}</span>
                  </button>

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-900 border border-zinc-200 rounded-md text-xs font-medium transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3 h-3 text-zinc-500" />
                    <span>Log Out</span>
                  </button>
                </div>
              )}

              {/* FALLBACK IF ROLE NONE ON OTHER PAGE */}
              {role === 'NONE' && (
                <button
                  onClick={() => navigate('/')}
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
                >
                  Role Selection
                </button>
              )}
            </>
          )}

        </div>
      </div>
    </header>
  );
}
