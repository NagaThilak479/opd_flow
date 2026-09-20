import React, { useState } from 'react';
import { X, UserPlus, AlertCircle } from 'lucide-react';
import { addPatient } from '../services/api';

export default function AddPatientModal({ isOpen, onClose, onPatientAdded }) {
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('General Medicine');
  const [tokenNumber, setTokenNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter the patient name.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        name: name.trim(),
        department,
        token_number: tokenNumber.trim() ? tokenNumber.trim().toUpperCase() : null,
      };

      const result = await addPatient(payload);
      setName('');
      setTokenNumber('');
      onPatientAdded(result);
      onClose();
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to register patient.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4">
      <div className="bg-white rounded-lg shadow-md border border-zinc-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <UserPlus className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900">Add Walk-In Patient</h3>
              <p className="text-xs text-zinc-600">Register and issue OPD token</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-900 rounded-md p-1 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-md flex items-start gap-2 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Patient Full Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rachel Adams"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-white border border-zinc-300 rounded-md focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors text-zinc-900 placeholder:text-zinc-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-white border border-zinc-300 rounded-md focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors text-zinc-900"
            >
              <option value="General Medicine">General Medicine & Outpatient</option>
              <option value="Cardiology">Cardiology</option>
              <option value="Pediatrics">Pediatrics</option>
              <option value="Orthopedics">Orthopedics</option>
              <option value="ENT">ENT Clinic</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-zinc-700">
                Custom Token Number
              </label>
              <span className="text-[11px] text-zinc-600">Leave empty to auto-assign</span>
            </div>
            <input
              type="text"
              placeholder="Auto (e.g. A119)"
              value={tokenNumber}
              onChange={(e) => setTokenNumber(e.target.value)}
              className="w-full px-3 py-1.5 text-sm bg-white border border-zinc-300 rounded-md focus:outline-hidden focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors uppercase placeholder:normal-case text-zinc-900 placeholder:text-zinc-600"
            />
          </div>

          {/* Footer */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Adding...' : 'Add to Queue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
