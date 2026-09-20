import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, Stethoscope, RefreshCw, AlertCircle,
  Bell, Sparkles, Shield, LogOut, Lock
} from 'lucide-react';
import { getPatient, getPrediction, getPublicQueue } from '../services/api';
import { useAuth } from '../context/AuthContext';
import QueueVisualizer from '../components/QueueVisualizer';

export default function PatientPage() {
  const navigate = useNavigate();
  const { isPatient, patientToken, logout } = useAuth();

  // Redirect if not in a verified patient session
  useEffect(() => {
    if (!isPatient || !patientToken) {
      navigate('/', { replace: true });
    }
  }, [isPatient, patientToken, navigate]);

  // Locked patient session token
  const lockedToken = patientToken ? patientToken.trim().toUpperCase() : null;

  const [patientData, setPatientData] = useState(null);
  const [predictionData, setPredictionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(new Date());
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [isCardHighlighted, setIsCardHighlighted] = useState(false);
  const [publicQueueItems, setPublicQueueItems] = useState([]);

  const prevDataRef = useRef(null);

  // Fetch locked patient's prediction and public queue order
  const fetchData = useCallback(async (isBackground = false) => {
    if (!lockedToken) return;

    if (!isBackground) setLoading(true);
    else setIsRefreshing(true);

    try {
      const [patientRes, predRes, publicQueueRes] = await Promise.all([
        getPatient(lockedToken),
        getPrediction(lockedToken),
        getPublicQueue(),
      ]);

      // Trigger visual highlight when wait time or ahead count updates
      if (prevDataRef.current) {
        const prev = prevDataRef.current;
        if (
          prev.wait !== predRes.estimated_wait_minutes ||
          prev.ahead !== patientRes.patients_ahead ||
          prev.status !== patientRes.status
        ) {
          setIsCardHighlighted(true);
          setTimeout(() => setIsCardHighlighted(false), 1200);
        }
      }

      prevDataRef.current = {
        wait: predRes.estimated_wait_minutes,
        ahead: patientRes.patients_ahead,
        status: patientRes.status,
      };

      setPatientData(patientRes);
      setPredictionData(predRes);

      // Extract privacy-compliant queue tokens (tokens and statuses ONLY)
      if (publicQueueRes?.tokens) {
        const activeTokens = publicQueueRes.tokens
          .filter((p) => p.status !== 'COMPLETED' && p.status !== 'SKIPPED')
          .map((p) => ({
            token: p.token_number,
            status: p.status,
            arrivalTime: p.arrival_time,
          }));
        setPublicQueueItems(activeTokens);
      }

      setError(null);
      setLastUpdatedTime(new Date());
      setSecondsAgo(0);
    } catch (err) {
      console.error("Failed to load patient data", err);
      const msg =
        err.response?.data?.detail ||
        `OPD Token "${lockedToken}" not found in current queue records.`;
      setError(msg);
      setPatientData(null);
      setPredictionData(null);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [lockedToken]);

  // Initial load
  useEffect(() => {
    if (lockedToken) {
      fetchData(false);
    }
  }, [lockedToken, fetchData]);

  // Live auto-sync every 3 seconds
  useEffect(() => {
    if (!lockedToken) return;

    const interval = setInterval(() => {
      fetchData(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [lockedToken, fetchData]);

  // "Last updated: X seconds ago" ticker
  useEffect(() => {
    if (!lockedToken) return;

    const timer = setInterval(() => {
      const sec = Math.max(
        0,
        Math.floor((Date.now() - lastUpdatedTime.getTime()) / 1000)
      );
      setSecondsAgo(sec);
    }, 1000);

    return () => clearInterval(timer);
  }, [lockedToken, lastUpdatedTime]);

  const handleExitSession = () => {
    logout();
    navigate('/', { replace: true });
  };

  const getDoctorStatusBadge = (status) => {
    switch (status) {
      case 'AVAILABLE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Available
          </span>
        );
      case 'PAUSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Paused
          </span>
        );
      case 'BUSY':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            In Consultation
          </span>
        );
    }
  };

  // Queue order window around active token
  const queueDisplay = useMemo(() => {
    if (!publicQueueItems.length || !lockedToken) return [];

    const sorted = [...publicQueueItems].sort((a, b) => {
      if (a.status === 'IN_CONSULTATION' && b.status !== 'IN_CONSULTATION') return -1;
      if (b.status === 'IN_CONSULTATION' && a.status !== 'IN_CONSULTATION') return 1;
      return new Date(a.arrivalTime || 0) - new Date(b.arrivalTime || 0);
    });

    const currentIndex = sorted.findIndex((p) => p.token === lockedToken);

    if (currentIndex === -1) {
      return sorted.slice(0, 7);
    }

    const start = Math.max(0, currentIndex - 4);
    const end = Math.min(sorted.length, currentIndex + 4);

    return sorted.slice(start, end);
  }, [publicQueueItems, lockedToken]);

  const isCurrentCalling = patientData?.status === 'IN_CONSULTATION';
  const isUpNext = patientData?.status === 'WAITING' && patientData?.patients_ahead === 0;

  if (!lockedToken) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4">

      {/* TOP LIVE STATUS BAR */}
      <div className="bg-white border border-zinc-200 rounded-lg p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>

          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Live
          </span>

          <span className="text-zinc-300">|</span>

          <div className="flex items-center gap-1.5 text-xs text-zinc-700 font-medium">
            <Lock className="w-3.5 h-3.5 text-blue-600" />
            <span>Locked: <strong className="text-zinc-950 font-semibold">{lockedToken}</strong></span>
          </div>

          <span className="text-xs text-zinc-600 hidden sm:inline">
            &bull; Auto-sync 3s
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="text-xs text-zinc-600 hidden md:inline">
            Updated: <strong className="text-zinc-800 font-medium">{secondsAgo === 0 ? 'now' : `${secondsAgo}s ago`}</strong>
          </span>

          <button
            onClick={() => fetchData(false)}
            disabled={isRefreshing}
            title="Manual sync"
            className="p-1 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          {/* EXIT PATIENT VIEW */}
          <button
            onClick={handleExitSession}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:text-red-700 hover:bg-red-50 border border-zinc-200 rounded-md transition-colors cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            <span>EXIT PATIENT VIEW</span>
          </button>
        </div>
      </div>

      {/* ERROR NOTICE */}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">{error}</p>
            <button
              onClick={handleExitSession}
              className="mt-2 text-rose-700 hover:text-rose-900 font-medium underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Return to Role Selection</span>
            </button>
          </div>
        </div>
      )}

      {/* LOADING STATE */}
      {loading && !patientData && (
        <div className="bg-white rounded-lg p-10 border border-zinc-200 text-center shadow-2xs">
          <div className="w-6 h-6 border-2 border-zinc-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-2.5"></div>
          <p className="text-xs text-zinc-600">Loading personalized status for OPD {lockedToken}...</p>
        </div>
      )}

      {patientData && predictionData && (
        <>
          {/* NOW CALLING ALERT */}
          {isCurrentCalling && (
            <div className="p-4 bg-blue-600 text-white rounded-lg shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-white shrink-0 animate-bounce" />
                <div>
                  <h3 className="text-sm font-bold">
                    Token {patientData.token_number}: It is your turn!
                  </h3>
                  <p className="text-xs text-blue-100 mt-0.5">
                    Please proceed immediately to {predictionData.doctor_room} ({predictionData.doctor_name}).
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 bg-white text-blue-700 rounded text-xs font-bold uppercase tracking-wider">
                Now Calling
              </span>
            </div>
          )}

          {/* UP NEXT ALERT */}
          {isUpNext && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2.5 text-amber-900">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold uppercase tracking-wide">You are Next in Line &bull; </span>
                <span className="text-amber-800">Please stand by near {predictionData.doctor_room}.</span>
              </div>
            </div>
          )}

          {/* =====================================================
              PRIMARY FOCAL CARD: YOUR ESTIMATED WAIT
              ===================================================== */}
          <div
            className={`bg-white rounded-lg p-6 border transition-all ${
              isCardHighlighted
                ? 'border-blue-400 ring-2 ring-blue-100 shadow-xs'
                : 'border-zinc-200 shadow-2xs'
            }`}
          >
            {/* Header: OPD Token + Patient info */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 bg-zinc-900 text-white rounded-md text-sm font-bold tracking-wide">
                  OPD {patientData.token_number}
                </span>
                <div>
                  <span className="text-sm font-bold text-zinc-950">
                    {patientData.name}
                  </span>
                  <span className="text-xs text-zinc-600 ml-2">
                    &bull; {patientData.department}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-600">Doctor:</span>
                {getDoctorStatusBadge(predictionData.doctor_status)}
              </div>
            </div>

            {/* Metrics Section: Focal Wait Time + Patients Ahead */}
            <div className="py-6 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
              
              {/* Wait Time Display */}
              <div className="sm:col-span-7">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-600">
                  Your estimated wait
                </p>

                <div className="flex items-baseline mt-1">
                  <span className="text-5xl sm:text-6xl font-bold tracking-tight text-zinc-950">
                    {predictionData.estimated_wait_minutes}
                  </span>
                  <span className="text-2xl sm:text-3xl font-semibold text-blue-600 ml-1.5">
                    min
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
                  <span>Expected range:</span>
                  <span className="font-semibold text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                    {predictionData.estimated_wait_range_min} &ndash; {predictionData.estimated_wait_range_max} min
                  </span>
                </div>
              </div>

              {/* Patients Ahead Box */}
              <div className="sm:col-span-5">
                <div className="bg-zinc-50 border border-zinc-200/80 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-zinc-600">
                      Patients Ahead
                    </p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      waiting in line
                    </p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight text-zinc-950">
                      {patientData.patients_ahead}
                    </span>
                    <span className="text-xs font-medium text-zinc-600">
                      ahead
                    </span>
                  </div>
                </div>
              </div>

            </div>

            {/* Queue Timeline Progress */}
            <div className="pt-4 border-t border-zinc-100">
              <QueueVisualizer
                status={patientData.status}
                patientsAhead={patientData.patients_ahead}
                doctorRoom={predictionData.doctor_room}
              />
            </div>
          </div>

          {/* =====================================================
              PUBLIC QUEUE POSITION & ORDER
              ===================================================== */}
          <div className="bg-white rounded-lg p-5 border border-zinc-200 shadow-2xs">
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">
                  Queue Position
                </h2>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Public queue order around your OPD ({lockedToken})
                </p>
              </div>

              <span className="text-[11px] font-medium text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                Live Order
              </span>
            </div>

            <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-md overflow-hidden">
              {queueDisplay.map((patient) => {
                const isYou = patient.token === lockedToken;

                return (
                  <div
                    key={patient.token}
                    className={`flex items-center justify-between px-3.5 py-2.5 text-xs transition-colors ${
                      isYou
                        ? 'bg-blue-50/80 font-medium'
                        : 'bg-white hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-mono font-bold ${isYou ? 'text-blue-700' : 'text-zinc-900'}`}>
                        {patient.token}
                      </span>
                      {isYou && (
                        <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded text-[10px] font-semibold uppercase tracking-wide">
                          YOU
                        </span>
                      )}
                    </div>

                    <div>
                      {isYou ? (
                        <span className="text-blue-700 font-semibold">Your Token</span>
                      ) : patient.status === 'IN_CONSULTATION' ? (
                        <span className="text-blue-700 font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                          In Consultation
                        </span>
                      ) : (
                        <span className="text-zinc-600">Waiting</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-600">
              <Shield className="w-3 h-3 text-zinc-600 shrink-0" />
              <span>Queue order is public. Individual waiting predictions and clinical metrics are strictly private.</span>
            </div>
          </div>

          {/* =====================================================
              PREDICTION EXPLANATION & DOCTOR INFO
              ===================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* PREDICTION EXPLANATION */}
            <div className="bg-white rounded-lg p-4 border border-zinc-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">
                    Prediction Explanation
                  </h3>
                </div>

                <p className="text-xs text-zinc-600 mb-3 leading-relaxed">
                  Calculated dynamically using live queue movement, historical consultation patterns, and active doctor status.
                </p>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-zinc-100">
                    <span className="text-zinc-600">Patients ahead:</span>
                    <span className="font-semibold text-zinc-900">{patientData.patients_ahead} waiting</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-100">
                    <span className="text-zinc-600">Historical duration:</span>
                    <span className="font-semibold text-zinc-900">
                      {predictionData.historical_avg_duration || predictionData.average_consultation_duration} min / patient
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-100">
                    <span className="text-zinc-600">Active consultation:</span>
                    <span className="font-semibold text-zinc-900">
                      {predictionData.active_remaining_minutes !== undefined
                        ? `${predictionData.active_remaining_minutes} min remaining`
                        : `${predictionData.current_consultation_elapsed_minutes} min elapsed`}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-600">Doctor status:</span>
                    <span className="font-semibold text-zinc-900">
                      {predictionData.doctor_status === 'BUSY' ? 'In Consultation' : predictionData.doctor_status}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-zinc-100 text-[11px] text-zinc-600">
                Estimates assist patient planning; actual duration may vary with clinical needs.
              </div>
            </div>

            {/* DOCTOR INFORMATION */}
            <div className="bg-white rounded-lg p-4 border border-zinc-200 shadow-2xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Stethoscope className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-900">
                    Attending Physician
                  </h3>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-zinc-100">
                    <span className="text-zinc-600">Doctor:</span>
                    <span className="font-semibold text-zinc-900">{predictionData.doctor_name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-100">
                    <span className="text-zinc-600">Room:</span>
                    <span className="font-semibold text-blue-600">{predictionData.doctor_room}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-100">
                    <span className="text-zinc-600">Department:</span>
                    <span className="font-semibold text-zinc-900">General Medicine</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-600">Unit:</span>
                    <span className="font-semibold text-zinc-900">OPD Block B, 1st Floor</span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-600">
                <span>Verified Patient Session</span>
                <span className="font-semibold text-zinc-800">{lockedToken}</span>
              </div>
            </div>

          </div>
        </>
      )}

    </div>
  );
}