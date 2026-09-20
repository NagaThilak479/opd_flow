import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Stethoscope, Clock, CheckCircle2, AlertTriangle, 
  UserPlus, FastForward, Check, XCircle, RotateCcw, 
  Activity, PauseCircle, LogOut, ShieldCheck 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';
import { 
  getQueue, callNextPatient, completePatient, skipPatient, 
  updateDoctorStatus, resetDemoQueue 
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/StatCard';
import AddPatientModal from '../components/AddPatientModal';

export default function StaffPage() {
  const navigate = useNavigate();
  const { isDoctor, isPatient, doctor, logout } = useAuth();

  // Role protection: patients cannot access staff portal
  useEffect(() => {
    if (isPatient) {
      navigate('/patient', { replace: true });
    } else if (!isDoctor) {
      navigate('/', { replace: true });
    }
  }, [isDoctor, isPatient, navigate]);

  const [queueData, setQueueData] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [recentCompletedToken, setRecentCompletedToken] = useState(null);

  const fetchQueueData = useCallback(async (background = false) => {
    try {
      const data = await getQueue();
      setQueueData(data);
      if (!recentCompletedToken) {
        const completed = data.patients.filter(p => p.status === 'COMPLETED');
        if (completed.length > 0) {
          setRecentCompletedToken(completed[completed.length - 1].token_number);
        }
      }
    } catch (err) {
      console.error("Failed to load queue data", err);
    }
  }, [recentCompletedToken]);

  useEffect(() => {
    fetchQueueData();
    const interval = setInterval(() => {
      fetchQueueData(true);
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchQueueData]);

  const showNotification = (msg, type = 'success') => {
    setFeedbackMessage({ msg, type });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const patients = queueData?.patients || [];
  const activePatient = patients.find(p => p.status === 'IN_CONSULTATION');
  const waitingPatients = patients.filter(p => p.status === 'WAITING');
  const nextPatient = waitingPatients.length > 0 ? waitingPatients[0] : null;
  const followingPatient = waitingPatients.length > 1 ? waitingPatients[1] : null;

  // Primary Action: Call Next Patient
  const handleCallNext = async () => {
    if (!nextPatient) return;
    setActionLoading(true);
    const prevActive = activePatient ? activePatient.token_number : null;
    const calledToken = nextPatient.token_number;
    const upcomingNext = followingPatient ? followingPatient.token_number : 'End of queue';

    try {
      await callNextPatient();
      if (prevActive) {
        setRecentCompletedToken(prevActive);
      }
      showNotification(
        `Advanced: ${prevActive ? `${prevActive} completed | ` : ''}${calledToken} consulting | ${upcomingNext} up next`,
        'success'
      );
      await fetchQueueData();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to call next patient.';
      showNotification(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async (token) => {
    setActionLoading(true);
    try {
      const res = await completePatient(token);
      setRecentCompletedToken(token);
      showNotification(res.message || `Patient ${token} completed`, 'success');
      await fetchQueueData();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to complete consultation.';
      showNotification(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkip = async (token) => {
    setActionLoading(true);
    try {
      const res = await skipPatient(token);
      showNotification(res.message || `Patient ${token} skipped`, 'info');
      await fetchQueueData();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to skip patient.';
      showNotification(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDoctorStatusChange = async (status) => {
    try {
      await updateDoctorStatus(status);
      const label = status === 'BUSY' ? 'In Consultation' : status === 'AVAILABLE' ? 'Available' : 'Paused';
      showNotification(`Doctor status updated to ${label}`, 'info');
      await fetchQueueData();
    } catch (_err) {
      showNotification('Failed to change doctor status', 'error');
    }
  };

  const handleResetDemo = async () => {
    if (confirm("Reset OPD queue and synthetic records back to original demo state?")) {
      try {
        await resetDemoQueue();
        setRecentCompletedToken('A103');
        showNotification("Queue reset to initial demo state!", "success");
        await fetchQueueData();
      } catch (_err) {
        showNotification("Failed to reset queue", "error");
      }
    }
  };

  // Filter patients
  const filteredPatients = patients.filter(p => {
    if (filterStatus === 'ALL') return true;
    return p.status === filterStatus;
  });

  // Chart data
  const chartData = waitingPatients.slice(0, 8).map(p => ({
    name: p.token_number,
    wait: p.estimated_wait_minutes,
    patient: p.name,
  }));

  const rawDoctorStatus = queueData?.doctor?.status || 'AVAILABLE';
  const formattedDoctorStatus = 
    rawDoctorStatus === 'AVAILABLE' ? 'Available' :
    rawDoctorStatus === 'PAUSED' ? 'Paused' : 'In Consultation';

  const getStatusBadge = (status) => {
    switch (status) {
      case 'IN_CONSULTATION':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            In Consultation
          </span>
        );
      case 'WAITING':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            Waiting
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
            <Check className="w-3 h-3 text-emerald-600" />
            Completed
          </span>
        );
      case 'SKIPPED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Skipped
          </span>
        );
      default:
        return <span className="text-xs text-zinc-600">{status}</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">
      {/* Toast Notification */}
      {feedbackMessage && (
        <div className={`fixed bottom-4 right-4 z-50 px-3.5 py-2.5 rounded-md shadow-md border flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-bottom-2 ${
          feedbackMessage.type === 'success'
            ? 'bg-zinc-900 text-white border-zinc-800'
            : feedbackMessage.type === 'error'
            ? 'bg-rose-700 text-white border-rose-800'
            : 'bg-zinc-900 text-white border-zinc-800'
        }`}>
          {feedbackMessage.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
          <span>{feedbackMessage.msg}</span>
        </div>
      )}

      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950">
              Physician Dashboard
            </h1>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-blue-600" />
              <span>{doctor?.id || 'DR-SARAH-001'}</span>
            </span>
          </div>
          <p className="text-xs text-zinc-600 mt-0.5">
            Physician: <strong className="text-zinc-800">{doctor?.name || 'Dr. Sarah Mitchell, MD'}</strong> &bull; Room 102 &bull; General Medicine
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-colors shadow-2xs cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Walk-In</span>
          </button>

          <button
            onClick={handleResetDemo}
            title="Reset queue for demo"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 rounded-md text-xs font-medium transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset Demo</span>
          </button>

          <button
            onClick={() => { logout(); navigate('/'); }}
            title="Log out of Doctor session"
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 rounded-md text-xs font-medium transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3 text-zinc-500" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      {/* TOP KPI ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Doctor Status"
          value={formattedDoctorStatus}
          subtitle={`${queueData?.doctor?.name || 'Dr. Mitchell'} • Room 102`}
          icon={Stethoscope}
          color={rawDoctorStatus === 'AVAILABLE' ? 'emerald' : rawDoctorStatus === 'PAUSED' ? 'amber' : 'blue'}
        />

        <StatCard
          title="Waiting"
          value={queueData?.total_waiting ?? '--'}
          unit="patients"
          subtitle="In waiting queue"
          icon={Clock}
          color="amber"
        />

        <StatCard
          title="Completed Today"
          value={queueData?.total_completed ?? '--'}
          unit="served"
          subtitle={`${queueData?.total_skipped ?? 0} skipped`}
          icon={CheckCircle2}
          color="emerald"
        />

        <StatCard
          title="Average Duration"
          value={queueData?.average_wait_minutes ?? '--'}
          unit="min"
          subtitle="Robust trimmed mean"
          icon={Activity}
          color="indigo"
        />
      </div>

      {/* IMMEDIATE QUEUE STATE: CURRENT, NEXT, FOLLOWING */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* CURRENT */}
        <div className="bg-white rounded-lg p-4 border border-blue-300 ring-1 ring-blue-100 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              CURRENT
            </span>
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold text-zinc-950 tracking-tight font-mono">
              {activePatient ? activePatient.token_number : 'None'}
            </span>
            <p className="text-xs font-semibold text-blue-700 mt-0.5">In Consultation</p>
            <p className="text-[11px] text-zinc-600 truncate mt-0.5">
              {activePatient ? activePatient.name : 'Consultation room ready'}
            </p>
          </div>
        </div>

        {/* NEXT */}
        <div className="bg-white rounded-lg p-4 border border-amber-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              NEXT
            </span>
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold text-zinc-950 tracking-tight font-mono">
              {nextPatient ? nextPatient.token_number : 'None'}
            </span>
            <p className="text-xs font-semibold text-amber-700 mt-0.5">Waiting</p>
            <p className="text-[11px] text-zinc-600 truncate mt-0.5">
              {nextPatient ? `${nextPatient.name} • Est. ${nextPatient.estimated_wait_minutes} min` : 'No waiting patients'}
            </p>
          </div>
        </div>

        {/* FOLLOWING */}
        <div className="bg-white rounded-lg p-4 border border-zinc-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
              FOLLOWING
            </span>
            <span className="w-2 h-2 rounded-full bg-zinc-300"></span>
          </div>
          <div className="mt-2.5">
            <span className="text-2xl font-bold text-zinc-950 tracking-tight font-mono">
              {followingPatient ? followingPatient.token_number : 'None'}
            </span>
            <p className="text-xs font-semibold text-zinc-600 mt-0.5">Waiting</p>
            <p className="text-[11px] text-zinc-600 truncate mt-0.5">
              {followingPatient ? `${followingPatient.name} • Est. ${followingPatient.estimated_wait_minutes} min` : 'Queue clear afterwards'}
            </p>
          </div>
        </div>
      </div>

      {/* PRIMARY QUEUE CONTROL BANNER */}
      <div className="bg-zinc-900 text-white rounded-lg p-4 shadow-2xs border border-zinc-800">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          
          {/* Transition Flow Preview */}
          <div className="w-full lg:w-auto">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 mb-2">
              Queue Advancement Flow
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Completed */}
              <div className="flex items-center gap-1.5 bg-zinc-800 px-2.5 py-1 rounded border border-zinc-700">
                <span className="font-mono font-bold text-zinc-300">
                  {recentCompletedToken || 'A103'}
                </span>
                <span className="text-[10px] text-zinc-400 uppercase">
                  Completed
                </span>
              </div>

              <span className="text-zinc-500 font-bold">&rarr;</span>

              {/* In Consultation */}
              <div className="flex items-center gap-1.5 bg-blue-950/60 px-2.5 py-1 rounded border border-blue-500/50 text-blue-200">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                <span className="font-mono font-bold text-white">
                  {activePatient ? activePatient.token_number : 'Ready'}
                </span>
                <span className="text-[10px] text-blue-300 uppercase">
                  Consulting
                </span>
              </div>

              <span className="text-zinc-500 font-bold">&rarr;</span>

              {/* Next Patient */}
              <div className="flex items-center gap-1.5 bg-zinc-800 px-2.5 py-1 rounded border border-zinc-700 text-amber-200">
                <span className="font-mono font-bold text-amber-300">
                  {nextPatient ? nextPatient.token_number : 'Empty'}
                </span>
                <span className="text-[10px] text-amber-400 uppercase">
                  Next
                </span>
              </div>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="w-full lg:w-auto">
            <button
              onClick={handleCallNext}
              disabled={actionLoading || !nextPatient}
              className="w-full lg:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-2xs transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <FastForward className="w-4 h-4" />
              <span>
                CALL NEXT PATIENT {nextPatient ? `(${nextPatient.token_number})` : ''}
              </span>
            </button>
          </div>

        </div>
      </div>

      {/* Doctor Status Bar & Controls */}
      <div className="bg-white rounded-lg p-3.5 border border-zinc-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-zinc-100 text-zinc-700 flex items-center justify-center border border-zinc-200">
            <Stethoscope className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-zinc-900">{queueData?.doctor?.name || 'Dr. Sarah Mitchell, MD'}</h2>
            <p className="text-[11px] text-zinc-600">
              {queueData?.doctor?.department || 'General Medicine'} &bull; {queueData?.doctor?.room_number || 'Room 102'}
            </p>
          </div>
        </div>

        {/* Status Switcher Buttons */}
        <div className="flex items-center bg-zinc-100 p-0.5 rounded-md border border-zinc-200 text-xs">
          <button
            onClick={() => handleDoctorStatusChange('AVAILABLE')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              rawDoctorStatus === 'AVAILABLE'
                ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Available</span>
          </button>

          <button
            onClick={() => handleDoctorStatusChange('BUSY')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              rawDoctorStatus === 'BUSY'
                ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            <span>In Consultation</span>
          </button>

          <button
            onClick={() => handleDoctorStatusChange('PAUSED')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
              rawDoctorStatus === 'PAUSED'
                ? 'bg-white text-zinc-900 shadow-2xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <PauseCircle className="w-3 h-3 text-amber-600" />
            <span>Paused</span>
          </button>
        </div>
      </div>

      {/* Queue Load Chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-lg p-4 border border-zinc-200 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xs font-semibold text-zinc-900 uppercase tracking-wider">Queue Distribution</h2>
              <p className="text-[11px] text-zinc-600">Estimated wait minutes per patient</p>
            </div>
            <span className="text-[11px] font-medium text-zinc-600">Next {chartData.length} in Line</span>
          </div>

          <div className="h-36 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={10} tickLine={false} />
                <Tooltip 
                  formatter={(value) => [`${value} min`, 'Estimated Wait']}
                  labelFormatter={(label) => `Token ${label}`}
                  contentStyle={{ backgroundColor: '#18181b', borderRadius: '6px', border: 'none', color: '#fff', fontSize: '11px', padding: '6px 10px' }}
                  itemStyle={{ color: '#93c5fd' }}
                />
                <Bar dataKey="wait" radius={[4, 4, 0, 0]}>
                  {chartData.map((_entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === 0 ? '#10b981' : '#2563eb'} 
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Queue Table Section */}
      <div className="bg-white rounded-lg border border-zinc-200 shadow-2xs overflow-hidden">
        {/* Table Filter Tabs */}
        <div className="p-3.5 border-b border-zinc-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-50/50">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            {['ALL', 'WAITING', 'IN_CONSULTATION', 'COMPLETED', 'SKIPPED'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  filterStatus === st
                    ? 'bg-zinc-900 text-white shadow-2xs'
                    : 'bg-white text-zinc-600 hover:text-zinc-900 border border-zinc-200'
                }`}
              >
                {st === 'ALL' ? 'All' : st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="text-xs text-zinc-600">
            Showing <strong className="text-zinc-800">{filteredPatients.length}</strong> of {patients.length} records
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 text-zinc-600 font-medium uppercase tracking-wider border-b border-zinc-200 text-[11px]">
              <tr>
                <th className="py-2.5 px-4">Token</th>
                <th className="py-2.5 px-4">Patient Name</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-center">Ahead</th>
                <th className="py-2.5 px-4 text-center">Est. Wait</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-zinc-600">
                    No patients match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => {
                  const isCurrent = patient.status === 'IN_CONSULTATION';

                  return (
                    <tr
                      key={patient.id}
                      className={`hover:bg-zinc-50 transition-colors ${
                        isCurrent ? 'bg-blue-50/40 font-medium' : ''
                      }`}
                    >
                      {/* Token */}
                      <td className="py-2.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-bold ${
                          isCurrent
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-100 text-zinc-900 border border-zinc-200'
                        }`}>
                          {patient.token_number}
                        </span>
                      </td>

                      {/* Name & Dept */}
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-zinc-900">{patient.name}</div>
                        <div className="text-[11px] text-zinc-600">{patient.department}</div>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-4">
                        {getStatusBadge(patient.status)}
                      </td>

                      {/* Patients Ahead */}
                      <td className="py-2.5 px-4 text-center font-medium text-zinc-800">
                        {patient.status === 'WAITING' ? patient.patients_ahead : '--'}
                      </td>

                      {/* Estimated Wait */}
                      <td className="py-2.5 px-4 text-center font-semibold text-blue-600">
                        {patient.status === 'WAITING' ? `${patient.estimated_wait_minutes} min` : '--'}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {patient.status === 'WAITING' && (
                            <>
                              <button
                                onClick={() => handleComplete(patient.token_number)}
                                title="Mark completed"
                                className="px-2 py-0.5 text-[11px] font-medium bg-white hover:bg-emerald-50 text-emerald-700 border border-zinc-200 hover:border-emerald-300 rounded transition-colors cursor-pointer"
                              >
                                Complete
                              </button>
                              <button
                                onClick={() => handleSkip(patient.token_number)}
                                title="Mark skipped"
                                className="px-2 py-0.5 text-[11px] font-medium bg-white hover:bg-rose-50 text-zinc-600 hover:text-rose-700 border border-zinc-200 hover:border-rose-200 rounded transition-colors cursor-pointer"
                              >
                                Skip
                              </button>
                            </>
                          )}

                          {patient.status === 'IN_CONSULTATION' && (
                            <button
                              onClick={() => handleComplete(patient.token_number)}
                              className="px-2.5 py-0.5 text-[11px] font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              <span>Complete</span>
                            </button>
                          )}

                          {(patient.status === 'COMPLETED' || patient.status === 'SKIPPED') && (
                            <span className="text-[11px] text-zinc-600">Logged</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Walk-In Modal */}
      <AddPatientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onPatientAdded={(newP) => {
          showNotification(`Patient ${newP.token_number} (${newP.name}) added to queue!`, 'success');
          fetchQueueData();
        }}
      />
    </div>
  );
}
