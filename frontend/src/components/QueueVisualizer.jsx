import React from 'react';
import { CheckCircle2, Clock, Users, Stethoscope, AlertTriangle } from 'lucide-react';

export default function QueueVisualizer({ status, patientsAhead, doctorRoom = "Room 102" }) {
  if (status === 'SKIPPED') {
    return (
      <div className="bg-rose-50/60 border border-rose-200 rounded-lg p-3.5 flex items-start gap-2.5 text-rose-800">
        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-semibold">Token Call Was Skipped</h4>
          <p className="text-xs text-rose-700 mt-0.5">
            Your token was called earlier but marked absent. Please check with the OPD reception desk to reactivate your queue position.
          </p>
        </div>
      </div>
    );
  }

  // Determine stage
  // 1: In Queue (patientsAhead > 1)
  // 2: Up Next (patientsAhead <= 1 && status === 'WAITING')
  // 3: In Consultation (status === 'IN_CONSULTATION')
  // 4: Completed (status === 'COMPLETED')
  let currentStep = 1;
  if (status === 'COMPLETED') {
    currentStep = 4;
  } else if (status === 'IN_CONSULTATION') {
    currentStep = 3;
  } else if (patientsAhead <= 1) {
    currentStep = 2;
  }

  const steps = [
    {
      id: 1,
      title: 'In Queue',
      desc: patientsAhead > 1 ? `${patientsAhead} ahead` : 'Waiting line',
      icon: Users,
    },
    {
      id: 2,
      title: 'Up Next',
      desc: 'Stand by',
      icon: Clock,
    },
    {
      id: 3,
      title: 'Consulting',
      desc: doctorRoom,
      icon: Stethoscope,
    },
    {
      id: 4,
      title: 'Completed',
      desc: 'Done',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="w-full py-1">
      <div className="flex items-center justify-between relative">
        {/* Connecting line */}
        <div className="absolute top-4 left-5 right-5 h-0.5 bg-zinc-200 -z-0">
          <div
            className="h-full bg-blue-600 transition-all duration-300 rounded-full"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />
        </div>

        {steps.map((step) => {
          const isCurrent = currentStep === step.id;
          const isDone = currentStep > step.id;
          const Icon = step.icon;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center text-center px-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  isCurrent
                    ? 'bg-blue-600 text-white ring-2 ring-blue-100 shadow-2xs'
                    : isDone
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-zinc-300 text-zinc-400'
                }`}
              >
                {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
              </div>

              <div className="mt-2 max-w-[80px] sm:max-w-[110px]">
                <p className={`text-xs font-medium leading-tight ${isCurrent ? 'text-blue-700 font-semibold' : isDone ? 'text-zinc-800' : 'text-zinc-600'}`}>
                  {step.title}
                </p>
                <p className="text-[11px] text-zinc-600 mt-0.5 truncate">
                  {step.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
