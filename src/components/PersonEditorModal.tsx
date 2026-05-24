import React, { useState, useMemo } from "react";
import { X, Camera, Fingerprint, Plus, ChevronLeft, ChevronRight, Trash2, Save } from "lucide-react";
import { FingerprintStatusPanel } from "./FingerprintStatusPanel";
import type { FingerprintCaptureStatus } from "../lib/fingerprint/capture";
import type { FingerprintDeviceInfo } from "../lib/fingerprint/types";

// Re-use interfaces and utility functions from GiftDeedEditor.tsx
interface Person {
  id: string;
  name: string;
  age: string;
  addr: string;
  aadhar: string;
  pan?: string;
  phone?: string;
  email?: string;
  photo?: string;
  thumb?: string;
  role?: string;
}

const ROLE_OPTIONS = [
  "Donor", "Donee", "Purchaser", "Seller", "Mortgagor", "Mortgagee", 
  "Deponent", "Affiant", "Executor/Principal", "Constituted Attorney Holder", 
  "Leasor", "Leasee", "Executor", "Indemnifier", "Declarant", 
  "Confirming Party", "Licensor", "Licensee"
];

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAR_REGEX = /^\d{4}\s\d{4}\s\d{4}$/;

function normalizePanInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

function normalizeAadharInput(value: string) {
  const digitsOnly = value.replace(/\D/g, "").slice(0, 12);
  return digitsOnly.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function getAadharValidationMessage(aadhar?: string) {
  const trimmedAadhar = aadhar?.trim() ?? "";
  if (!trimmedAadhar) return "";
  if (!AADHAR_REGEX.test(trimmedAadhar)) {
    return "Invalid Aadhar format.";
  }
  return "";
}

function getPanValidationMessage(pan?: string) {
  const trimmedPan = pan?.trim() ?? "";
  if (!trimmedPan) return "";
  if (!PAN_REGEX.test(trimmedPan)) {
    return "Invalid PAN format. Use ABCDE1234F.";
  }
  return "";
}

interface PersonEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  person: Person;
  onUpdatePerson: (id: string, field: keyof Person, value: any) => void;
  onDeletePerson: (id: string) => void;
  onAddPerson: () => void;
  currentIndex: number;
  totalPersons: number;
  onNavigate: (direction: 'prev' | 'next') => void;
  onStartCapture: (personId: string, type: 'photo' | 'thumb') => void; // To trigger parent's webcam
  onStartFingerprintScan: (personId: string) => void;
  fingerprintBusy?: boolean;
  fingerprintStatus?: FingerprintCaptureStatus | null;
  fingerprintDeviceInfo?: FingerprintDeviceInfo;
  fingerprintBackendAccepted?: boolean;
  fingerprintBackendMessage?: string;
  onHandleFileUpload: (personId: string, type: 'photo' | 'thumb', e: React.ChangeEvent<HTMLInputElement>) => void;
  knownClients: Person[]; // For autofill
  onAutofillPerson: (personId: string, clientData: Person) => void; // For autofill
}

export function PersonEditorModal({
  isOpen,
  onClose,
  person,
  onUpdatePerson,
  onDeletePerson,
  onAddPerson,
  currentIndex,
  totalPersons,
  onNavigate,
  onStartCapture,
  onStartFingerprintScan,
  fingerprintBusy,
  fingerprintStatus,
  fingerprintDeviceInfo,
  fingerprintBackendAccepted,
  fingerprintBackendMessage,
  onHandleFileUpload,
  knownClients,
  onAutofillPerson,
}: PersonEditorModalProps) {
  const [focusedPersonId, setFocusedPersonId] = useState<string | null>(null); // For autofill within modal

  // Autofill logic (similar to GiftDeedEditor)
  const deferredFocusedName = useMemo(() => person.name ?? "", [person.name]);
  const matchingKnownClients = useMemo(() => {
    const normalizedQuery = deferredFocusedName.trim().toLowerCase();
    if (!normalizedQuery || normalizedQuery.length < 2) {
      return [];
    }
    return knownClients
      .filter((client) => client.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 8);
  }, [deferredFocusedName, knownClients]);

  if (!isOpen) return null;

  const aadharError = getAadharValidationMessage(person.aadhar);
  const panError = getPanValidationMessage(person.pan);

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
        <div className="flex justify-between items-center border-b border-outline-variant/15 pb-4 mb-4">
          <h3 className="font-headline text-2xl font-bold text-on-surface">
            Edit Person {currentIndex + 1} of {totalPersons}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 app-scroll">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div className="relative">
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Full Name</label>
              <input
                type="text"
                value={person.name}
                onChange={(e) => onUpdatePerson(person.id, 'name', e.target.value)}
                onFocus={() => setFocusedPersonId(person.id)} // Set focus for autofill
                onBlur={(e) => {
                  // Delay clearing focusedPersonId to allow click on autofill suggestions
                  const input = e.currentTarget;
                  setTimeout(() => {
                    if (!document.activeElement || !input.contains(document.activeElement)) {
                      setFocusedPersonId(null);
                    }
                  }, 100);
                }}
                className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm"
                placeholder="Start typing to autofill..."
              />
              {focusedPersonId === person.id && person.name.trim().length >= 2 && matchingKnownClients.length > 0 && (
                <ul className="absolute top-full mt-2 w-full bg-surface-container-lowest text-on-surface border border-outline-variant/30 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] max-h-64 overflow-y-auto z-50">
                  {matchingKnownClients.map((match) => (
                    <li key={match.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); onAutofillPerson(person.id, match); setFocusedPersonId(null); }}
                        className="w-full text-left px-4 py-3 hover:bg-surface-container transition-colors flex justify-between items-center border-b border-outline-variant/10 last:border-0 cursor-pointer"
                      >
                        <div className="flex flex-col">
                          <span className="font-bold font-body text-sm">{match.name}</span>
                          <span className="text-xs text-on-surface-variant font-body truncate max-w-[200px]">{match.addr || match.phone || 'No auxiliary data'}</span>
                        </div>
                        <div className="text-primary text-[10px] font-bold uppercase tracking-wider bg-primary/10 px-2 py-1 rounded ml-2 shrink-0">Autofill</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Age</label>
              <input type="text" value={person.age} onChange={(e) => onUpdatePerson(person.id, 'age', e.target.value)} className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm" placeholder="Age" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Role</label>
              <select
                value={ROLE_OPTIONS.includes(person.role || '') ? person.role : (person.role ? "__other__" : "")}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "__other__") {
                    onUpdatePerson(person.id, 'role', ""); // Clear to let them type
                  } else {
                    onUpdatePerson(person.id, 'role', val);
                  }
                }}
                className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm"
              >
                <option value="">Select Role</option>
                {ROLE_OPTIONS.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
                <option value="__other__">Other (Editable)</option>
              </select>
              {(person.role === "" || !ROLE_OPTIONS.includes(person.role || '')) && person.role !== undefined && (
                <input
                  type="text"
                  value={person.role || ''}
                  onChange={(e) => onUpdatePerson(person.id, 'role', e.target.value)}
                  className="mt-2 w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm"
                  placeholder="Enter custom role..."
                />
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Aadhar Card *</label>
              <input
                type="text"
                value={person.aadhar}
                onChange={(e) => onUpdatePerson(person.id, 'aadhar', normalizeAadharInput(e.target.value))}
                className={`w-full p-2.5 border rounded-lg bg-surface outline-none transition-all font-medium text-sm ${
                  aadharError
                    ? 'border-error text-error focus:ring-2 focus:ring-error/20 focus:border-error'
                    : 'border-outline-variant/40 focus:ring-2 focus:ring-primary/20 focus:border-primary/50'
                }`}
                placeholder="1234 5678 9012"
                maxLength={14}
              />
              {aadharError && (
                <p className="mt-1 text-[11px] font-medium text-error">{aadharError}</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">PAN Card *</label>
              <input
                type="text"
                value={person.pan || ''}
                onChange={(e) => onUpdatePerson(person.id, 'pan', normalizePanInput(e.target.value))}
                className={`w-full p-2.5 border rounded-lg bg-surface outline-none transition-all font-medium text-sm uppercase ${
                  panError
                    ? 'border-error text-error focus:ring-2 focus:ring-error/20 focus:border-error'
                    : 'border-outline-variant/40 focus:ring-2 focus:ring-primary/20 focus:border-primary/50'
                }`}
                placeholder="ABCDE1234F"
                maxLength={10}
              />
              {panError && (
                <p className="mt-1 text-[11px] font-medium text-error">{panError}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Residential Address</label>
              <input 
                type="text" 
                value={person.addr} 
                onChange={(e) => {
                  // Ensure space after comma for proper word wrapping
                  const formattedAddr = e.target.value.replace(/,(?=[^\s])/g, ', ');
                  onUpdatePerson(person.id, 'addr', formattedAddr);
                }} 
                className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm" 
                placeholder="Complete address..." 
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Phone (Optional)</label>
              <input 
                type="text" 
                value={person.phone || ''} 
                onChange={(e) => {
                  const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                  onUpdatePerson(person.id, 'phone', digitsOnly);
                }} 
                className={`w-full p-2.5 border rounded-lg bg-surface outline-none transition-all font-medium text-sm ${
                  person.phone?.trim() && person.phone.replace(/\D/g, '').length !== 10
                    ? 'border-error text-error focus:ring-2 focus:ring-error/20 focus:border-error'
                    : 'border-outline-variant/40 focus:ring-2 focus:ring-primary/20 focus:border-primary/50'
                }`} 
                placeholder="XXXXXXXXXX" 
              />
              {person.phone?.trim() && person.phone.replace(/\D/g, '').length !== 10 && (
                <p className="mt-1 text-[11px] font-medium text-error">Must be exactly 10 digits.</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Email (Optional)</label>
              <input type="email" value={person.email || ''} onChange={(e) => onUpdatePerson(person.id, 'email', e.target.value)} className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm" placeholder="client@example.com" />
            </div>

            <div className="md:col-span-2 mt-4 pt-4 border-t border-outline-variant/20">
              <span className="text-sm font-bold text-on-surface-variant uppercase tracking-wider mr-4">Biometrics:</span>
              <div className="flex flex-wrap gap-4 mt-2">
                {/* Photo Preview */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-24 h-24 border border-outline-variant/40 rounded-lg flex items-center justify-center overflow-hidden bg-surface-container-high">
                    {person.photo && <img src={person.photo} alt="Photo" className="w-full h-full object-cover" />}
                    {!person.photo && <span className="text-on-surface-variant text-xs text-center p-2">No Photo Captured</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => onStartCapture(person.id, 'photo')} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors font-medium text-xs">
                      <Camera size={14} /> {person.photo ? 'Retake Photo' : 'Capture Photo'}
                    </button>
                    <label className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high text-on-surface-variant rounded hover:bg-surface-container-highest transition-colors cursor-pointer font-medium text-xs shadow-sm">
                      Upload
                      <input type="file" hidden accept="image/*" onChange={(e) => onHandleFileUpload(person.id, 'photo', e)} />
                    </label>
                  </div>
                </div>

                {/* Thumbprint Preview */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-24 h-24 border border-outline-variant/40 rounded-lg flex items-center justify-center overflow-hidden bg-surface-container-high">
                    {person.thumb && <img src={person.thumb} alt="Thumbprint" className="w-full h-full object-contain p-1" />}
                    {!person.thumb && <span className="text-on-surface-variant text-xs text-center p-2">No Thumb Scanned</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button disabled={fingerprintBusy} onClick={() => onStartFingerprintScan(person.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors font-medium text-xs disabled:cursor-not-allowed disabled:opacity-60">
                      <Fingerprint size={14} /> {person.thumb ? 'Rescan Thumb' : 'Scan Thumb'}
                    </button>
                    <label className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high text-on-surface-variant rounded hover:bg-surface-container-highest transition-colors cursor-pointer font-medium text-xs shadow-sm">
                      Upload
                      <input type="file" hidden accept="image/*" onChange={(e) => onHandleFileUpload(person.id, 'thumb', e)} />
                    </label>
                  </div>
                </div>
              </div>
              <FingerprintStatusPanel
                status={fingerprintStatus}
                deviceInfo={fingerprintDeviceInfo}
                backendAccepted={fingerprintBackendAccepted}
                backendMessage={fingerprintBackendMessage}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center border-t border-outline-variant/15 pt-4 mt-4">
          <div className="flex gap-2">
            <button
              onClick={() => onNavigate('prev')}
              disabled={currentIndex === 0}
              className="p-2 hover:bg-surface-container-high rounded-full transition-colors disabled:opacity-50"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={() => onNavigate('next')}
              disabled={currentIndex === totalPersons - 1}
              className="p-2 hover:bg-surface-container-high rounded-full transition-colors disabled:opacity-50"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="flex gap-3">
            {totalPersons > 1 && (
              <button
                onClick={() => {
                  if (window.confirm("Are you sure you want to delete this person?")) {
                    onDeletePerson(person.id);
                    onClose(); // Close modal after deleting
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-error/10 text-error rounded-lg hover:bg-error/20 transition-colors font-medium text-sm"
              >
                <Trash2 size={18} /> Delete Person
              </button>
            )}
            <button
              onClick={onAddPerson} // This now correctly handles both adding and navigating
              className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium text-sm"
            >
              <Plus size={18} /> Add New Person
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg hover:opacity-90 transition-opacity font-medium text-sm"
            >
              <Save size={18} /> Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
