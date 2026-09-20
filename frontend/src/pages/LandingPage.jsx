import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Stethoscope, ArrowRight, ArrowLeft, 
  AlertCircle 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { loginPatient, loginDoctor } = useAuth();

  // 'select' (role selection panels) | 'patient' (Patient OPD entry) | 'doctor' (Doctor Login)
  const [viewMode, setViewMode] = useState('select');

  // Patient access state
  const [opdNumber, setOpdNumber] = useState('');
  const [patientError, setPatientError] = useState(null);
  const [patientSubmitting, setPatientSubmitting] = useState(false);

  // Doctor login state
  const [doctorId, setDoctorId] = useState('DR-SARAH-001');
  const [doctorPin, setDoctorPin] = useState('1234');
  const [doctorError, setDoctorError] = useState(null);
  const [doctorSubmitting, setDoctorSubmitting] = useState(false);

  // Handle Patient OPD submit
  const handlePatientSubmit = async (e) => {
    e.preventDefault();
    const cleanToken = opdNumber.trim().toUpperCase();
    if (!cleanToken) {
      setPatientError("Please enter your OPD number (e.g. A108).");
      return;
    }

    setPatientSubmitting(true);
    setPatientError(null);

    const result = await loginPatient(cleanToken);
    setPatientSubmitting(false);

    if (result.success) {
      navigate('/patient');
    } else {
      setPatientError(result.error);
    }
  };

  // Handle Doctor login submit
  const handleDoctorSubmit = async (e) => {
    e.preventDefault();
    if (!doctorId.trim() || !doctorPin.trim()) {
      setDoctorError("Please enter both Doctor ID and PIN.");
      return;
    }

    setDoctorSubmitting(true);
    setDoctorError(null);

    const result = await loginDoctor(doctorId, doctorPin);
    setDoctorSubmitting(false);

    if (result.success) {
      navigate('/staff');
    } else {
      setDoctorError(result.error);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] flex flex-col justify-between overflow-hidden bg-zinc-50 text-zinc-900">
      
      {/* ============================================================ */}
      {/* SUBTLE ARCHITECTURAL HOSPITAL BACKGROUND                     */}
      {/* Clean, bright, visible through gentle softening light veil   */}
      {/* ============================================================ */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none opacity-30"
        style={{ 
          backgroundImage: "url('/images/hospital-hero.jpg')" 
        }}
        aria-hidden="true"
      />
      <div 
        className="absolute inset-0 bg-gradient-to-b from-white/85 via-zinc-50/75 to-zinc-50/90 backdrop-blur-[1px] pointer-events-none" 
        aria-hidden="true" 
      />

      {/* Main Content Area */}
      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 w-full flex-1 flex flex-col justify-center">
        
        {/* Calm, Strong Brand Header */}
        <div className="text-center max-w-xl mx-auto mb-10 sm:mb-12 animate-hero-brand">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900">
            OPD FLOW
          </h1>
          <p className="text-base sm:text-lg font-medium text-zinc-700 mt-2">
            &ldquo;Know your place. Know your wait.&rdquo;
          </p>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1 leading-relaxed">
            Real-time outpatient queue tracking.
          </p>
        </div>

        {/* ============================================================ */}
        {/* VIEW 1: ROLE SELECTION (PATIENT & DOCTOR ELEGANT PANELS)      */}
        {/* ============================================================ */}
        {viewMode === 'select' && (
          <div className="max-w-2xl mx-auto w-full">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* ----------------- PATIENT PANEL ----------------- */}
              <div 
                role="button"
                tabIndex={0}
                onClick={() => { setViewMode('patient'); setPatientError(null); }}
                onKeyDown={(e) => { 
                  if (e.key === 'Enter' || e.key === ' ') { 
                    e.preventDefault(); 
                    setViewMode('patient'); 
                    setPatientError(null); 
                  } 
                }}
                aria-label="Continue as Patient"
                className="group relative flex flex-col justify-between overflow-hidden bg-white/95 rounded-xl border border-zinc-200/90 hover:border-zinc-300 shadow-xs hover:shadow-md transition-all duration-300 ease-out hover:-translate-y-[3px] cursor-pointer text-left focus:outline-hidden focus:ring-2 focus:ring-blue-600 backdrop-blur-xs animate-hero-patient"
              >
                {/* Photograph with soft bottom gradient fade */}
                <div className="relative h-44 sm:h-48 w-full overflow-hidden bg-zinc-100">
                  <img 
                    src="/images/patient-panel.jpg" 
                    alt="Patient calmly waiting in modern outpatient area"
                    className="w-full h-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.02]"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=600&q=80';
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
                </div>

                {/* Content Section */}
                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold tracking-wider text-zinc-900 uppercase">
                        PATIENT
                      </h2>
                      <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed mt-2.5">
                      Track your queue position and estimated waiting time.
                    </p>
                  </div>

                  {/* Action Link */}
                  <div className="mt-5 pt-3.5 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-xs text-zinc-400 font-medium">Queue &amp; wait</span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 group-hover:bg-blue-700 text-white text-xs font-medium transition-colors shadow-2xs">
                      <span>Enter OPD</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-[3px]" />
                    </span>
                  </div>
                </div>
              </div>

              {/* ----------------- DOCTOR PANEL ----------------- */}
              <div 
                role="button"
                tabIndex={0}
                onClick={() => { setViewMode('doctor'); setDoctorError(null); }}
                onKeyDown={(e) => { 
                  if (e.key === 'Enter' || e.key === ' ') { 
                    e.preventDefault(); 
                    setViewMode('doctor'); 
                    setDoctorError(null); 
                  } 
                }}
                aria-label="Continue as Doctor"
                className="group relative flex flex-col justify-between overflow-hidden bg-white/95 rounded-xl border border-zinc-200/90 hover:border-zinc-300 shadow-xs hover:shadow-md transition-all duration-300 ease-out hover:-translate-y-[3px] cursor-pointer text-left focus:outline-hidden focus:ring-2 focus:ring-blue-600 backdrop-blur-xs animate-hero-doctor"
              >
                {/* Photograph with soft bottom gradient fade */}
                <div className="relative h-44 sm:h-48 w-full overflow-hidden bg-zinc-100">
                  <img 
                    src="/images/doctor-panel.jpg" 
                    alt="Doctor in clinical consultation setting"
                    className="w-full h-full object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.02]"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=600&q=80';
                    }}
                  />
                  <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
                </div>

                {/* Content Section */}
                <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold tracking-wider text-zinc-900 uppercase">
                        DOCTOR
                      </h2>
                      <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                        <Stethoscope className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed mt-2.5">
                      Manage the live OPD queue and patient flow.
                    </p>
                  </div>

                  {/* Action Link */}
                  <div className="mt-5 pt-3.5 border-t border-zinc-100 flex items-center justify-between">
                    <span className="text-xs text-zinc-400 font-medium">Physician access</span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 group-hover:bg-blue-600 text-white text-xs font-medium transition-colors shadow-2xs">
                      <span>Doctor Login</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-[3px]" />
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 2: PATIENT OPD NUMBER ENTRY                              */}
        {/* Consistent styling, background, typography, button tokens    */}
        {/* ============================================================ */}
        {viewMode === 'patient' && (
          <div className="max-w-sm mx-auto w-full animate-hero-patient">
            <button
              type="button"
              onClick={() => { setViewMode('select'); setPatientError(null); }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 mb-3 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to role selection</span>
            </button>

            <div className="bg-white/95 rounded-xl p-6 sm:p-7 border border-zinc-200/90 shadow-sm text-left backdrop-blur-xs">
              <div className="text-center mb-5">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2.5 border border-blue-100">
                  <Users className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wide">
                  Enter your OPD number
                </h2>
                <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
                  Your queue position and estimated waiting time will be shown after verification.
                </p>
              </div>

              {patientError && (
                <div className="mb-3.5 p-2.5 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2 text-rose-700 text-xs font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{patientError}</span>
                </div>
              )}

              <form onSubmit={handlePatientSubmit} className="space-y-4">
                <div>
                  <input
                    id="patient-opd-input"
                    type="text"
                    autoFocus
                    placeholder="e.g. A108"
                    value={opdNumber}
                    onChange={(e) => setOpdNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-base font-bold uppercase tracking-wider text-center focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors text-zinc-900 placeholder:text-zinc-400 placeholder:normal-case placeholder:font-normal"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1.5 text-center">
                    Found on your hospital registration ticket.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={patientSubmitting || !opdNumber.trim()}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 text-xs tracking-wide cursor-pointer shadow-2xs"
                >
                  {patientSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Demo Helper Tokens */}
              <div className="mt-5 pt-3.5 border-t border-zinc-100 text-center">
                <p className="text-[11px] text-zinc-400 mb-1.5">
                  Demo OPD Tokens:
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {['A108', 'A105', 'A112', 'A104'].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setOpdNumber(t)}
                      className="px-2.5 py-0.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded text-xs font-mono font-medium transition-colors cursor-pointer"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* VIEW 3: DOCTOR LOGIN                                         */}
        {/* Consistent styling, background, typography, button tokens    */}
        {/* ============================================================ */}
        {viewMode === 'doctor' && (
          <div className="max-w-sm mx-auto w-full animate-hero-doctor">
            <button
              type="button"
              onClick={() => { setViewMode('select'); setDoctorError(null); }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 mb-3 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to role selection</span>
            </button>

            <div className="bg-white/95 rounded-xl p-6 sm:p-7 border border-zinc-200/90 shadow-sm text-left backdrop-blur-xs">
              <div className="text-center mb-5">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2.5 border border-blue-100">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-zinc-900 uppercase tracking-wide">
                  Doctor Login
                </h2>
                <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
                  Physician authentication for live queue control.
                </p>
              </div>

              {doctorError && (
                <div className="mb-3.5 p-2.5 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2 text-rose-700 text-xs font-medium">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>{doctorError}</span>
                </div>
              )}

              <form onSubmit={handleDoctorSubmit} className="space-y-3.5">
                <div>
                  <label htmlFor="doctor-id-input" className="block text-xs font-medium text-zinc-700 mb-1">
                    Doctor ID
                  </label>
                  <input
                    id="doctor-id-input"
                    type="text"
                    autoFocus
                    placeholder="DR-SARAH-001"
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-medium uppercase tracking-wide focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors text-zinc-900"
                  />
                </div>

                <div>
                  <label htmlFor="doctor-pin-input" className="block text-xs font-medium text-zinc-700 mb-1">
                    PIN
                  </label>
                  <input
                    id="doctor-pin-input"
                    type="password"
                    placeholder="••••"
                    value={doctorPin}
                    onChange={(e) => setDoctorPin(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-zinc-300 rounded-lg text-xs font-medium tracking-widest focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors text-zinc-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={doctorSubmitting || !doctorId.trim() || !doctorPin.trim()}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 text-xs tracking-wide mt-2 cursor-pointer shadow-2xs"
                >
                  {doctorSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Sign in</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Demo Helper */}
              <div className="mt-5 pt-3.5 border-t border-zinc-100 text-center">
                <p className="text-[11px] text-zinc-400 font-mono">
                  Demo: <strong className="text-zinc-600">DR-SARAH-001</strong> / <strong className="text-zinc-600">1234</strong>
                </p>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Clean Minimal Healthcare Footer */}
      <footer className="relative z-10 border-t border-zinc-200/80 bg-white/80 py-3.5 backdrop-blur-xs">
        <div className="max-w-4xl mx-auto px-4 text-center text-xs text-zinc-500">
          OPD Flow &bull; Outpatient Queue System &bull; Modern Minimal
        </div>
      </footer>

    </div>
  );
}
