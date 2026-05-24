import React, { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "../components/layout/Layout";
import { Camera, Fingerprint, Printer, X, RefreshCw, Plus, Gavel, Search, Loader2, UploadCloud, FileText, Eye, Edit3, Mail, Save } from "lucide-react";
import { PersonEditorModal } from "../components/PersonEditorModal"; // Import the new modal component
import { FingerprintStatusPanel } from "../components/FingerprintStatusPanel";
import { collection, addDoc, getDoc, doc, setDoc, query, orderBy, limit, getDocs, where } from "firebase/firestore"; // Keep db for Firestore operations
import { db } from "../firebaseDb"; // Keep db for Firestore operations
import {
  captureFingerprintFromScanner,
  type FingerprintCaptureStatus,
} from "../lib/fingerprint/capture";
import { loadFingerprintConfig } from "../lib/fingerprint/config";
import type { FingerprintDeviceInfo } from "../lib/fingerprint/types";
import {
  persistPersonMedia,
  type PersonMediaUploadRequest,
} from "../lib/personMedia";
// New interface for a person
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

interface PreviewPerson extends Person {
  safePhoto?: string;
  safeThumb?: string;
}

interface FingerprintSessionState {
  status: FingerprintCaptureStatus;
  deviceInfo?: FingerprintDeviceInfo;
  backendAccepted?: boolean;
  backendMessage?: string;
  pidXml?: string;
  serviceUrl?: string;
}

function getSafeImageUrl(url?: string) {
  if (!url) return "";
  if (url.startsWith("data:image")) return url;
  return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
}

// Define Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "dvzxfbcsd"; // Replace with your actual Cloudinary cloud name
const CLOUDINARY_UPLOAD_PRESET = "notery"; // Replace with your actual Cloudinary upload preset

function buildPreviewChunks<T extends { email?: string; phone?: string }>(persons: T[]) {
  const chunks: T[][] = [];
  const intermediateLimit = persons.filter((person) => person.email && person.phone).length > 3 ? 3 : 4;

  if (persons.length === 3) {
    chunks.push(persons.slice(0, 2));
    chunks.push(persons.slice(2, 3));
  } else if (persons.length > 0) {
    chunks.push(persons.slice(0, 3));
    let index = 3;

    while (index < persons.length) {
      const remaining = persons.length - index;
      if (remaining <= 3) {
        chunks.push(persons.slice(index, index + remaining));
        index += remaining;
      } else if (remaining === 4 && intermediateLimit === 4) {
        chunks.push(persons.slice(index, index + 3));
        index += 3;
      } else {
        chunks.push(persons.slice(index, index + intermediateLimit));
        index += intermediateLimit;
      }
    }
  } else {
    chunks.push([]);
  }

  return chunks;
}

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const AADHAR_REGEX = /^\d{4}\s\d{4}\s\d{4}$/;
const DOC_NAME_OPTIONS = [
  "Gift Deed",
  "Agreement",
  "Token Agreement",
  "Affidavit",
  "Indemnity Bond",
  "Undertaking",
  "Declaration",
  "Memorandum of Understanding",
  "Affidavit in Support",
  "Promissory Note",
  "Leave and License Agreement",
  "Lease Agreement",
  "Friendly Loan Agreement",
  "Mortgage Deed",
  "Power of Attorney",
  "Will",
] as const;
const ROLE_OPTIONS = [
  "Donor", "Donee", "Purchaser", "Seller", "Mortgagor", "Mortgagee", 
  "Deponent", "Affiant", "Executor/Principal", "Constituted Attorney Holder", 
  "Leasor", "Leasee", "Executor", "Indemnifier", "Declarant", 
  "Confirming Party", "Licensor", "Licensee"
];
const OTHER_DOC_NAME_OPTION = "__other__";

function normalizePanInput(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

function normalizeAadharInput(value: string) {
  const digitsOnly = value.replace(/\D/g, "").slice(0, 12);
  return digitsOnly.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

interface PreviewPageProps {
  chunk: PreviewPerson[];
  pageIndex: number;
  totalPages: number;
  isLastPage: boolean;
  totalDocumentPages: number;
  srNo: string;
  docDate: string;
  kNo: string;
  pageNo: string;
  docName: string;
  docPurpose: string;
  agreementAmount?: string;
}

const PreviewPage = memo(function PreviewPage({
  chunk,
  pageIndex,
  totalPages,
  isLastPage,
  totalDocumentPages,
  srNo,
  docDate,
  kNo,
  pageNo,
  docName,
  docPurpose,
  agreementAmount,
}: PreviewPageProps) {
  return (
    <div className="mobile-preview-wrapper no-print md:print:block">
      <article
        className="mobile-preview-content relative flex flex-col p-[15mm] box-border print:shadow-none print:w-[210mm] print:max-w-none print:p-[15mm] print:m-0 html2pdf__page-break"
        style={{
          color: "#000000",
          backgroundColor: "#ffffff",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          fontFamily: '"Times New Roman", serif',
          pageBreakAfter: isLastPage ? "auto" : "always",
        }}
      >
        <img src="/2.png" alt="watermark" className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[60%] opacity-5 pointer-events-none z-0" />

        {pageIndex === 0 && (
          <>
            <div className="flex justify-between items-center text-center gap-2 sm:gap-4">
              <img src="/1.png" alt="Logo 1" className="h-14 w-14 sm:h-20 sm:w-20 md:h-24 md:w-24 shrink-0" />
              <div className="flex-1 px-1 min-w-0">
                <div className="inline-block">
                  <h2 className="font-bold text-base sm:text-xl md:text-2xl m-0">Mr. Sameer Shrikant Vispute</h2>
                  <small className="block text-right">BLS., LLB., DIPL</small>
                  <h4 className="font-bold text-base sm:text-lg md:text-xl m-0">Advocate High Court</h4>
                </div>
                <div className="font-black text-sm sm:text-base md:text-[1.1rem] leading-tight my-1.5 uppercase tracking-wide" style={{ color: "#b30000" }}>
                  Notary  (Govt. of India) <br />Reg. No. 57704
                </div>
                <small className="break-words">Mob. 8286000888 / 9933806888 | Email - advsameervispute@gmail.com</small>
                <br />
                <small className="block text-[11px] sm:text-[12px] tracking-tight break-words">Shree Bhagwati Krupa, Pendse Nagar, Lane No 2, Dombivli (E), Dist. Thane - 421201.</small>
                <small className="block text-[11px] sm:text-[12px] tracking-tight break-words">A002 Om Residency, Khambalpada, Off 90 Feet Road, Thakurli, Dombivli (E), Dist. Thane - 421201</small>
              </div>
              <img src="/3.png" alt="Logo 2" className="h-14 w-14 sm:h-20 sm:w-20 md:h-24 md:w-24 shrink-0" />
            </div>

            <div className="flex justify-between mt-4">
              <div>Sr No: <span className="font-bold print:font-normal">{srNo}</span></div>
              <div>Date: <span className="font-bold print:font-normal">{docDate}</span></div>
            </div>
            <div>Register No - <span className="font-bold print:font-normal">{kNo}</span></div>
            <div>Reg.Page No - <span className="font-bold print:font-normal">{pageNo}</span></div>

            <hr style={{ margin: "10px 0", borderTop: "1px solid black", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />
          </>
        )}

        <div className="flex-grow">
          {chunk.map((person) => (
            <div key={person.id}>
              <div className="mt-[10px] flex justify-between">
                <div className="flex-1 pr-4">
                  <p style={{ lineHeight: 1.3, margin: 0, marginBottom: "16px", wordBreak: "normal", overflowWrap: "normal", whiteSpace: "pre-wrap" }} className="break-normal">
                    I Mr <span className="font-bold print:font-normal">{person.name}</span> aged <span className="font-bold print:font-normal ml-1">{person.age}</span> yrs.<br />
                    Residing at <span className="font-bold print:font-normal">{person.addr}</span>
                    {person.role && <span> being <span className="font-bold print:font-normal">{person.role}</span></span>}<br />
                    {person.aadhar && <>Aadhar Card No: <span className="font-bold print:font-normal">{person.aadhar}</span></>}
                    {person.aadhar && person.pan && <span className="mx-2">|</span>}
                    {person.pan && <>PAN Card No: <span className="font-bold print:font-normal">{person.pan.toUpperCase()}</span></>}
                    {person.phone && <><br />Phone: <span className="font-bold print:font-normal">{person.phone}</span></>}
                    {person.email && <><br />Email: <span className="font-bold print:font-normal">{person.email}</span></>}
                  </p>

                  <div className="mt-4 flex flex-col items-start">
                    <div className="w-[120px] h-[120px] border relative flex items-center justify-center overflow-hidden" style={{ borderColor: "#000000", backgroundColor: "#f9fafb" }}>
                      {person.safeThumb && <img src={person.safeThumb} crossOrigin="anonymous" className="w-full h-full object-contain p-1" alt="Thumbprint" />}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-center pl-4 shrink-0">
                  <div className="w-[120px] h-[120px] border relative flex items-center justify-center overflow-hidden" style={{ borderColor: "#000000", backgroundColor: "#f9fafb" }}>
                    {person.safePhoto && <img src={person.safePhoto} crossOrigin="anonymous" className="w-full h-full object-cover" alt="Captured" />}
                  </div>

                  <div className="w-[150px] border-t text-center mt-[50px] font-bold" style={{ borderColor: "#000000" }}>Signature</div>
                </div>
              </div>
              <hr style={{ margin: "8px 0", borderTop: "1px solid black", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />
            </div>
          ))}

          {isLastPage && (
            <>
              <p style={{ marginTop: "16px", lineHeight: "1.5" }}>
                That I/we have executed the annexed <span className="font-bold print:font-normal">{docName || "Gift Deed"}</span> dated <span className="font-bold print:font-normal">{docDate || "26th April 2026"}</span>, pertaining to the {docPurpose || "___"} purposes.
                {agreementAmount && <span> Agreement Value: ₹<span className="font-bold print:font-normal">{agreementAmount}</span>.</span>}<br />
                I/we state that I/we have signed and given left hand digital thumb in the said document beside our respective photographs appearing here in above, and that the said <span className="font-bold print:font-normal">{docName || "Gift Deed"}</span> consists of {totalDocumentPages} pages.
              </p>
              <hr style={{ margin: "8px 0", borderTop: "1px solid black", borderBottom: "none", borderLeft: "none", borderRight: "none" }} />
            </>
          )}
        </div>

        <div className="absolute bottom-[30px] left-0 right-0 text-center text-xs" style={{ color: "rgba(0,0,0,0.7)" }}>
          Page {pageIndex + 1} of {totalPages}
        </div>
      </article>
    </div>
  );
});

// Utility Component for Webcam Capture (from original file, slightly adapted)
function WebcamCapture({ onCapture, onClose }: { onCapture: (img: string) => void, onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let active = true;
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } } });
        if (!active) {
          // If the component already unmounted before camera initialization finished!
          s.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (err) {
        if (active) {
          console.error("Camera access error:", err);
          alert("Could not access camera. Please check permissions.");
          onClose();
        }
      }
    }
    startCamera();
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, []); // Run exactly once on mount!

  const capture = () => {
    if (videoRef.current && videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) { // Ensure video is active
      const videoWidth = videoRef.current.videoWidth;
      const videoHeight = videoRef.current.videoHeight;

      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const MAX_DIMENSION = 300; // Max width or height for the captured image (reduced for smaller PDF)
        let width = videoWidth;
        let height = videoHeight;

        // Calculate new dimensions to fit within MAX_DIMENSION while maintaining aspect ratio
        if (width > height) {
          if (width > MAX_DIMENSION) {
            height *= MAX_DIMENSION / width;
            width = MAX_DIMENSION;
          }
        } else {
          if (height > MAX_DIMENSION) {
            width *= MAX_DIMENSION / height;
            height = MAX_DIMENSION;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Flip the context horizontally to un-mirror the captured image,
        // which is more appropriate for an official document photo.
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, width, height); // Draw with new dimensions
        const capturedDataUrl = canvas.toDataURL('image/jpeg', 0.1);
        onCapture(capturedDataUrl); // Aggressively reduced quality for smaller PDF
        onClose();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center overflow-y-auto p-3 sm:p-4 backdrop-blur-sm no-print">
      <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-2xl w-full max-w-[26rem] max-h-[calc(100dvh-1.5rem)] border border-outline-variant flex flex-col">
        <div className="shrink-0 p-3 sm:p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
          <h3 className="font-label font-bold text-sm uppercase tracking-widest text-on-surface">Capture Photo</h3>
          <button onClick={onClose} className="p-2 hover:bg-surface-container-high rounded-full transition-colors"><X size={20} /></button>
        </div>
        <div className="relative min-h-0 bg-black" style={{ height: "min(58dvh, 28rem)", maxHeight: "calc(100dvh - 9.5rem)" }}>
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
        </div>
        <div className="shrink-0 p-3 sm:p-4 flex justify-center gap-4 bg-surface-container-low">
          <button
            onClick={capture}
            className="flex items-center justify-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-full font-label font-bold uppercase tracking-wider shadow-lg hover:opacity-90 active:scale-95 transition-all"
          >
            <Camera size={20} />
            Capture
          </button>
        </div>
      </div>
    </div>
  );
}

export function GiftDeedEditor() {
  const [srNo, setSrNo] = useState("");
  const [kNo, setKNo] = useState("");
  const [pageNo, setPageNo] = useState("");
  const [docName, setDocName] = useState("Gift Deed");
  const [docNameSelection, setDocNameSelection] = useState<string>("Gift Deed");
  const [docPurpose, setDocPurpose] = useState("Flat Purpose");
  const [agreementAmount, setAgreementAmount] = useState<string>("");
  const [manualTotalDocumentPages, setManualTotalDocumentPages] = useState<string>("");
  const [docDate, setDocDate] = useState(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  });
  const [clientName, setClientName] = useState("");
  const [persons, setPersons] = useState<Person[]>([
    { id: `person-${Date.now()}`, name: '', age: '', addr: '', aadhar: '', pan: '', phone: '', email: '', photo: undefined, thumb: undefined, role: '' }
  ]);
  const [basePdfFile, setBasePdfFile] = useState<File | null>(null);
  const [basePdfPageCount, setBasePdfPageCount] = useState(0);
  const [showPreviewMobile, setShowPreviewMobile] = useState(false);
  const [showPersonEditorModal, setShowPersonEditorModal] = useState(false); // State for person editor modal
  const [currentPersonIndexInModal, setCurrentPersonIndexInModal] = useState(0); // Index of person being edited in modal
  const [fingerprintSessions, setFingerprintSessions] = useState<Record<string, FingerprintSessionState>>({});

  const isFingerprintBusy = useCallback((personId: string) => {
    const stage = fingerprintSessions[personId]?.status.stage;
    return stage === "checking-device" || stage === "waiting-for-finger" || stage === "submitting";
  }, [fingerprintSessions]);

  useEffect(() => {
    if (basePdfFile) {
      const getPageCount = async () => {
        try {
          const PDFLib = (window as any).PDFLib;
          if (!PDFLib) return;
          const arrayBuffer = await basePdfFile.arrayBuffer();
          const doc = await PDFLib.PDFDocument.load(arrayBuffer);
          setBasePdfPageCount(doc.getPageCount());
        } catch (e) {
          console.error("Failed to parse PDF pages", e);
        }
      };
      getPageCount();
    } else {
      setBasePdfPageCount(0);
    }
  }, [basePdfFile]);

  const [activeCapture, setActiveCapture] = useState<{ personId: string, type: 'photo' | 'thumb' } | null>(null);

  // --- State Update Handlers ---
  const addPerson = useCallback(() => {
    setPersons(prevPersons => {
      const newPerson: Person = { id: `person-${Date.now()}`, name: '', age: '', addr: '', aadhar: '', pan: '', phone: '', email: '', photo: undefined, thumb: undefined, role: '' };
      setCurrentPersonIndexInModal(prevPersons.length); // Atomically set the index to the new person
      return [...prevPersons, newPerson];
    });
  }, [setPersons]);

  const deletePerson = useCallback((id: string) => {
    setFingerprintSessions(prev => {
      if (!(id in prev)) {
        return prev;
      }

      const next = { ...prev };
      delete next[id];
      return next;
    });

    setPersons(prev => {
      const updatedPersons = prev.filter(p => p.id !== id);
      // Adjust currentPersonIndexInModal if the deleted person was before the current index
      if (currentPersonIndexInModal >= updatedPersons.length && updatedPersons.length > 0) {
        setCurrentPersonIndexInModal(updatedPersons.length - 1);
      } else if (updatedPersons.length === 0) {
        setCurrentPersonIndexInModal(0); // Or close modal if no persons left
      }
      return updatedPersons;
    });
  }, [currentPersonIndexInModal]);

  const updatePerson = useCallback((id: string, field: keyof Person, value: any) => {
    setPersons(prevPersons => prevPersons.map(p => (p.id === id ? { ...p, [field]: value } : p)));
  }, [setPersons]); // setPersons is stable from useState

  const handleCapture = useCallback((img: string) => {
    if (!activeCapture) return;
    updatePerson(activeCapture.personId, activeCapture.type, img);
    setActiveCapture(null);
  }, [activeCapture, updatePerson]);

  const startFingerprintScan = async (personId: string) => {
    const fingerprintConfig = loadFingerprintConfig();

    setFingerprintSessions((prev) => ({
      ...prev,
      [personId]: {
        ...prev[personId],
        status: {
          stage: "checking-device",
          message: "Checking fingerprint device connection...",
        },
      },
    }));

    try {
      const result = await captureFingerprintFromScanner({
        config: fingerprintConfig,
        personId,
        documentId: fetchQuery.trim() || undefined,
        onStatus: (status) => {
          setFingerprintSessions((prev) => ({
            ...prev,
            [personId]: {
              ...prev[personId],
              status,
            },
          }));
        },
      });

      if (result.thumbImageDataUrl) {
        updatePerson(personId, 'thumb', result.thumbImageDataUrl);
      }

      setFingerprintSessions((prev) => ({
        ...prev,
        [personId]: {
          ...prev[personId],
          status: {
            stage: result.thumbImageDataUrl ? "success" : "warning",
            message: result.thumbImageDataUrl
              ? "Fingerprint captured and added to the document."
              : "Fingerprint PID captured. Printable thumb image unavailable.",
            details: result.thumbImageWarning ?? result.backendMessage,
          },
          deviceInfo: result.deviceInfo,
          backendAccepted: result.backendAccepted,
          backendMessage: result.backendMessage,
          pidXml: result.pidXml ?? undefined,
          serviceUrl: result.serviceUrl,
        },
      }));
    } catch (error) {
      console.error('Mantra scanner capture failed:', error);
      setFingerprintSessions((prev) => ({
        ...prev,
        [personId]: {
          ...prev[personId],
          status: {
            stage: "error",
            message: "Fingerprint capture failed.",
            details:
              error instanceof Error
                ? error.message
                : "The scanner did not return a valid fingerprint response.",
          },
        },
      }));
    }
  };

  const handleFileUpload = useCallback((personId: string, type: 'photo' | 'thumb', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          const MAX_DIMENSION = 300; // Max width or height for the image (reduced for smaller PDF)
          let width = img.width;
          let height = img.height;

          // Calculate new dimensions to fit within MAX_DIMENSION while maintaining aspect ratio
          if (width > height) {
            if (width > MAX_DIMENSION) {
              height *= MAX_DIMENSION / width;
              width = MAX_DIMENSION;
            }
          } else {
            if (height > MAX_DIMENSION) {
              width *= MAX_DIMENSION / height;
              height = MAX_DIMENSION;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height); // Draw the loaded image with new dimensions

          // Get the compressed data URL
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.1); // Aggressively reduced quality for smaller PDF
          updatePerson(personId, type, compressedDataUrl);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  }, []); // `updatePerson` is a stable useCallback, so it doesn't need to be a dependency here.

  const uploadPersonMediaAsset = useCallback(
    async ({ dataUrl, folder, publicId }: PersonMediaUploadRequest) => {
      const formData = new FormData();
      formData.append("file", dataUrl);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("folder", folder);
      formData.append("public_id", publicId);

      const cloudinaryResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`,
        {
          method: "POST",
          body: formData,
        },
      );

      if (!cloudinaryResponse.ok) {
        const errorText = await cloudinaryResponse.text().catch(() => "");
        throw new Error(
          errorText
            ? `Cloudinary image upload failed: ${errorText}`
            : "Cloudinary image upload failed.",
        );
      }

      const cloudinaryData = await cloudinaryResponse.json();
      if (typeof cloudinaryData?.secure_url !== "string" || !cloudinaryData.secure_url) {
        throw new Error("Cloudinary image upload did not return a secure URL.");
      }

      return cloudinaryData.secure_url as string;
    },
    [],
  );

  const [fetchQuery, setFetchQuery] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isSendingMail, setIsSendingMail] = useState(false);
  const [showUploadProgress, setShowUploadProgress] = useState(false);
  const [uploadStatusMessage, setUploadStatusMessage] = useState("Initializing...");
  const [uploadProgress, setUploadProgress] = useState(0);

  // Resizable panel states
  const [dataEntryPanelWidthPx, setDataEntryPanelWidthPx] = useState(0);
  const minPanelWidth = 300; // Minimum width for data entry panel in pixels
  const maxPanelWidth = 800; // Maximum width for data entry panel in pixels
  const resizerRef = useRef<HTMLDivElement>(null);
  const parentContainerRef = useRef<HTMLDivElement>(null); // Ref for the flex container
  const isResizing = useRef(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const syncDocNameState = (value: string) => {
    setDocName(value);
    setDocNameSelection(DOC_NAME_OPTIONS.includes(value as typeof DOC_NAME_OPTIONS[number]) ? value : OTHER_DOC_NAME_OPTION);
  };

  // Auto-fetch the next logical Sequence strictly when the editor loads
  useEffect(() => {
    const fetchNextSequence = async () => {
      try {
        let srNoAssigned = false;
        let kNoAssigned = false;
        let pageNoAssigned = false;

        // 1. Try to fetch from global settings first
        const configSnap = await getDoc(doc(db, "settings", "config"));
        if (configSnap.exists()) {
          const config = configSnap.data();
          if (config.currentSrNo) {
            setSrNo(config.currentSrNo);
            srNoAssigned = true;
          }
          if (config.registerNumber) {
            setKNo(config.registerNumber);
            kNoAssigned = true;
          }
          if (config.currentPageNo) {
            setPageNo(config.currentPageNo);
            pageNoAssigned = true;
          }
        }

        // 2. Fallback to querying the latest document for any missing values
        if (!srNoAssigned || !kNoAssigned || !pageNoAssigned) {
          const q = query(collection(db, "documents"), orderBy("createdAt", "desc"), limit(1));
          const qs = await getDocs(q);
          if (!qs.empty) {
            const lastDoc = qs.docs[0].data();

            if (!srNoAssigned) {
              const lastSrNo = parseInt(lastDoc.srNo);
              setSrNo(!isNaN(lastSrNo) ? (lastSrNo + 1).toString() : "1");
            }

            if (!kNoAssigned && lastDoc.kNo) {
              setKNo(lastDoc.kNo);
            }

            if (!pageNoAssigned) {
              setPageNo(""); // Do not auto-increment, force manual entry
            }
          } else {
            if (!srNoAssigned) setSrNo("1");
            if (!pageNoAssigned) setPageNo("");
          }
        }
      } catch (err) {
        console.error("Error calculating next sequence:", err);
      }
    };
    fetchNextSequence();
  }, []);

  // Resizing logic for the data entry panel
  const startResizing = useCallback((e: MouseEvent | TouchEvent) => {
    if (window.innerWidth < 1280) return; // Only allow resizing on XL screens and above
    isResizing.current = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    document.body.style.pointerEvents = 'none'; // Prevent text selection during drag
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
    document.body.style.pointerEvents = 'auto';
  }, []);

  const resize = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isResizing.current || !parentContainerRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const parentRect = parentContainerRef.current.getBoundingClientRect();

    let newWidth = clientX - parentRect.left;
    newWidth = Math.max(minPanelWidth, Math.min(newWidth, maxPanelWidth));
    setDataEntryPanelWidthPx(newWidth);
  }, [minPanelWidth, maxPanelWidth]);

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => resize(e);
    const handleGlobalMouseUp = () => stopResizing();
    const handleGlobalTouchMove = (e: TouchEvent) => resize(e);
    const handleGlobalTouchEnd = () => stopResizing();

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchmove', handleGlobalTouchMove);
    window.addEventListener('touchend', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [resize, stopResizing]);

  // Set initial width for data entry panel based on breakpoints
  useEffect(() => {
    const setInitialWidth = () => {
      if (window.innerWidth >= 1536) { // 2xl breakpoint
        setDataEntryPanelWidthPx(500); // approx 31rem
      } else if (window.innerWidth >= 1280) { // xl breakpoint
        setDataEntryPanelWidthPx(368); // approx 23rem
      } else {
        // For smaller screens, resizing is disabled, and CSS handles width.
        setDataEntryPanelWidthPx(368); // Default to XL size for when it becomes XL
      }
    };

    setInitialWidth();
    window.addEventListener('resize', setInitialWidth);
    return () => window.removeEventListener('resize', setInitialWidth);
  }, []);

  const [knownClients, setKnownClients] = useState<Person[]>([]);
  const [focusedPersonId, setFocusedPersonId] = useState<string | null>(null);
  const previewPersons = useDeferredValue(persons);
  const previewSrNo = useDeferredValue(srNo);
  const previewKNo = useDeferredValue(kNo);
  const previewPageNo = useDeferredValue(pageNo);
  const previewDocName = useDeferredValue(docName);
  const previewDocPurpose = useDeferredValue(docPurpose);
  const previewDocDate = useDeferredValue(docDate);
  const previewBasePdfPageCount = useDeferredValue(basePdfPageCount);

  // Auto-fetch known clients for autocomplete
  useEffect(() => {
    const fetchKnownClients = async () => {
      try {
        const q = query(collection(db, "documents"), orderBy("createdAt", "desc"));
        const qs = await getDocs(q);

        const clientMap = new Map<string, Person>();

        qs.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.persons && Array.isArray(data.persons)) {
            data.persons.forEach((person: any) => {
              if (!person.name || person.name.trim() === '') return;

              const validAadhar = person.aadhar && person.aadhar.trim().length > 5 && !person.aadhar.includes('XXXX-XXXX');
              const validPan = person.pan && person.pan.trim().length > 5;
              let uniqueKey = validAadhar ? person.aadhar.trim() : (validPan ? person.pan.trim() : person.name.trim().toLowerCase());

              if (!clientMap.has(uniqueKey)) {
                clientMap.set(uniqueKey, {
                  id: uniqueKey,
                  name: person.name,
                  aadhar: person.aadhar || '',
                  pan: person.pan || '',
                  addr: person.addr || '',
                  age: person.age || '',
                  phone: person.phone || '',
                  email: person.email || '',
                  photo: person.photo?.startsWith('http') ? person.photo : undefined,
                  thumb: person.thumb?.startsWith('http') ? person.thumb : undefined
                });
              } else {
                const existing = clientMap.get(uniqueKey)!;
                if (!existing.photo && person.photo && person.photo.startsWith('http')) existing.photo = person.photo;
                if (!existing.thumb && person.thumb && person.thumb.startsWith('http')) existing.thumb = person.thumb;
                if (!existing.phone && person.phone) existing.phone = person.phone;
                if (!existing.email && person.email) existing.email = person.email;
              }
            });
          }
        });

        setKnownClients(Array.from(clientMap.values()));
      } catch (error) {
        console.error("Error scraping clients for autofill:", error);
      }
    };

    fetchKnownClients();
  }, []);

  const autofillPerson = (personId: string, clientData: Person) => {
    setPersons(prev => prev.map(p =>
      p.id === personId ? { ...p, ...clientData, id: p.id } : p
    ));
    setFocusedPersonId(null);
  };

  const focusedPerson = useMemo( // This is for the inline autofill, not the modal
    () => persons.find((person) => person.id === focusedPersonId) ?? null,
    [focusedPersonId, persons],
  );
  const deferredFocusedName = useDeferredValue(focusedPerson?.name ?? "");
  const matchingKnownClients = useMemo(() => {
    const normalizedQuery = deferredFocusedName.trim().toLowerCase();
    if (!focusedPersonId || normalizedQuery.length < 2) {
      return [];
    }

    return knownClients
      .filter((client) => client.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 8);
  }, [deferredFocusedName, focusedPersonId, knownClients]);

  const preparedPreviewPersons = useMemo<PreviewPerson[]>(
    () =>
      previewPersons.map((person) => ({
        ...person,
        safePhoto: getSafeImageUrl(person.photo),
        safeThumb: getSafeImageUrl(person.thumb),
      })),
    [previewPersons],
  );
  const previewChunks = useMemo(() => buildPreviewChunks(preparedPreviewPersons), [preparedPreviewPersons]);
  const notaryGeneratedPageCount = previewChunks.length;
  const previewManualTotalDocumentPages = useDeferredValue(manualTotalDocumentPages);

  const finalDocumentPageCount = useMemo(() => {
    if (previewManualTotalDocumentPages && !isNaN(parseInt(previewManualTotalDocumentPages))) {
      return parseInt(previewManualTotalDocumentPages);
    }
    return previewBasePdfPageCount + notaryGeneratedPageCount;
  }, [previewManualTotalDocumentPages, previewBasePdfPageCount, notaryGeneratedPageCount]);

  const handleAutoFetch = async (queryParam: string) => {
    setFetchQuery(queryParam);
    if (queryParam.trim().length > 0) {
      setIsFetching(true);
      try {
        const docRef = doc(db, "documents", queryParam.trim());
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.srNo) setSrNo(data.srNo);
          if (data.kNo) setKNo(data.kNo);
          if (data.pageNo) setPageNo(data.pageNo);
          if (data.docDate) setDocDate(data.docDate);
          if (data.docName) syncDocNameState(data.docName);
          if (data.persons) setPersons(data.persons);
          if (data.manualTotalDocumentPages) setManualTotalDocumentPages(data.manualTotalDocumentPages);
          if (data.pdfUrl) setPdfUrl(data.pdfUrl);
        } else {
          console.warn("No document found with that ID.");
        }
      } catch (error) {
        console.error("Error fetching doc:", error);
      } finally {
        setIsFetching(false);
      }
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const docIdFromUrl = params.get("docId");
    if (docIdFromUrl && docIdFromUrl.trim().length > 0) {
      handleAutoFetch(docIdFromUrl.trim());
    }
  }, []);

  const handleKNoChange = (newKNo: string) => {
    setKNo(newKNo);
    setPageNo("1");
  };

  // Calculate preview page scale based on available space
  useEffect(() => {
    const calculatePreviewScale = () => {
      if (previewContainerRef.current && window.innerWidth >= 1280) { // Only scale on XL and above
        const containerWidth = previewContainerRef.current.offsetWidth;
        const A4_WIDTH_PX = 210 * 3.7795275591; // 210mm in pixels (1mm = 3.7795275591px at 96dpi)
        // The article itself will be 210mm wide, padding is internal.

        // If the container is smaller than the A4 width, scale down.
        // Otherwise, keep scale at 1 (don't upscale).
        if (containerWidth < A4_WIDTH_PX) {
          setPreviewScale(containerWidth / A4_WIDTH_PX);
        } else {
          setPreviewScale(1);
        }
      } else {
        setPreviewScale(1); // No scaling on smaller screens or if ref not ready
      }
    };

    calculatePreviewScale(); // Initial calculation
    const observer = new ResizeObserver(calculatePreviewScale);
    if (previewContainerRef.current) observer.observe(previewContainerRef.current);
    return () => {
      if (previewContainerRef.current) observer.unobserve(previewContainerRef.current);
    };
  }, [dataEntryPanelWidthPx]); // Recalculate when dataEntryPanelWidthPx changes (indirectly affects previewContainerRef.current.offsetWidth)

  const handleSaveToFirebase = async (overridePdfUrl?: string, silent: boolean = false) => {
    if (!silent) setIsSaving(true);
    try {
      const mediaDocumentId =
        fetchQuery.trim() || `${kNo || "register"}-${pageNo || "page"}-${srNo || "serial"}`;
      const persistedPersons = await persistPersonMedia(
        persons,
        uploadPersonMediaAsset,
        { documentId: mediaDocumentId },
      );

      setPersons(persistedPersons);

      // Deep clone persons and strip out any 'undefined' values (Firestore rejects undefined).
      const personsToSave = persistedPersons.map((p) => {
        const newP: any = { ...p };
        if (newP.photo && String(newP.photo).startsWith('data:image')) {
          throw new Error(`Photo for ${newP.name || newP.id} was not uploaded to Cloudinary.`);
        }
        if (newP.thumb && String(newP.thumb).startsWith('data:image')) {
          throw new Error(`Thumb impression for ${newP.name || newP.id} was not uploaded to Cloudinary.`);
        }
        if (newP.photo === undefined) delete newP.photo; // Ensure undefined fields are removed for Firestore
        if (newP.thumb === undefined) delete newP.thumb; // Ensure undefined fields are removed for Firestore
        return newP;
      });

      // Ensure unique combination of kNo and pageNo
      if (kNo && pageNo) {
        const q = query(collection(db, "documents"), where("kNo", "==", kNo));
        const qs = await getDocs(q);
        const isDuplicate = qs.docs.some(docSnap => docSnap.id !== fetchQuery.trim() && docSnap.data().pageNo === pageNo);
        if (isDuplicate) {
          throw new Error("This Register No and Reg.Page No combination already exists. Please use a unique combination.");
        }
      }

      const docData = {
        srNo: srNo || "",
        kNo: kNo || "",
        pageNo: pageNo || "",
        docDate: docDate || "",
        clientName: clientName || "",
        persons: personsToSave,
        agreementAmount: agreementAmount || "",
        pdfUrl: overridePdfUrl || pdfUrl || null,
        updatedAt: new Date(),
        manualTotalDocumentPages: manualTotalDocumentPages || null,
      };

      console.log('Sending final data package to Firestore DB...', docData);
      if (fetchQuery.trim().length >= 20) {
        // Update existing document
        const docRef = doc(db, "documents", fetchQuery.trim());
        await Promise.race([
          setDoc(docRef, docData, { merge: true }),
          new Promise((_, r) => setTimeout(() => r(new Error('Firestore update timed out! Check Firestore Rules.')), 10000))
        ]);
        if (!silent) alert(`Document updated successfully in Firebase!\n\nDocument ID: ${docRef.id}`);
        console.log('Firebase Save transaction completed securely!');
        return docRef.id;
      } else {
        // Create new document
        (docData as any).createdAt = new Date();
        const docRef = await Promise.race([
          addDoc(collection(db, "documents"), docData),
          new Promise<any>((_, r) => setTimeout(() => r(new Error('Firestore addDoc timed out! Check Firestore Rules.')), 10000))
        ]);
        if (!silent) alert(`Document saved successfully to Firebase!\n\nDocument ID: ${docRef.id}`);
        setFetchQuery(docRef.id);

        // Update global sequential counters EXCEPT pageNo, which is manual
        const nextSrNo = (!isNaN(parseInt(srNo)) ? (parseInt(srNo) + 1).toString() : srNo);
        // We do not auto-increment pageNo here anymore
        const nextPageNo = pageNo; 
        
        // Also update settings to reflect latest serial
        await setDoc(doc(db, "settings", "config"), { 
          currentSrNo: nextSrNo, 
          currentPageNo: nextPageNo, 
          registerNumber: kNo 
        }, { merge: true }).catch(e => console.error("Failed to update global counters", e));
        console.log('Firebase Save transaction completed securely!');
        return docRef.id;
      }
    } catch (error) {
      console.error("Error saving to Firebase:", error);
      const message = error instanceof Error && error.message ? error.message : "Failed to save document to Firebase. Check console for details.";
      if (!silent) alert(message);
      throw error; // bubble up so the generator knows it failed
    } finally {
      if (!silent) setIsSaving(false);
    }
  };

  const handleSkipNotary = async () => {
    if (!pageNo || pageNo.trim() === '') {
      alert("Please enter the Reg.Page No manually before skipping.");
      return;
    }
    if (!window.confirm(`Are you sure you want to mark Serial No ${srNo} as an Offline Notary? This will skip to the next number.`)) return;
    
    setIsSaving(true);
    try {
      const docData = {
        srNo: srNo || "",
        kNo: kNo || "",
        pageNo: pageNo || "",
        docDate: docDate || new Date().toISOString().split("T")[0],
        clientName: "Offline Notary",
        docName: "Offline Notary",
        persons: [],
        agreementAmount: "",
        pdfUrl: "offline",
        updatedAt: new Date(),
        createdAt: new Date(),
        isOffline: true,
      };

      await addDoc(collection(db, "documents"), docData);
      
      const nextSrNo = (!isNaN(parseInt(srNo)) ? (parseInt(srNo) + 1).toString() : srNo);
      const nextPageNo = pageNo; // Manual

      await setDoc(doc(db, "settings", "config"), {
        currentSrNo: nextSrNo,
        registerNumber: kNo, // kNo remains unchanged
        currentPageNo: nextPageNo
      }, { merge: true });

      alert(`Offline Notary recorded for Serial No ${srNo}!\nNext Serial No will be ${nextSrNo}.`);
      
      // Reset form variables to prep for the next entry
      setFetchQuery("");
      setSrNo(nextSrNo);
      setPageNo("");
      setClientName("");
      setDocDate(() => {
        const d = new Date();
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      });
      setDocName("");
      setAgreementAmount("");
      setPersons([{
        id: Date.now().toString(),
        name: "",
        age: "",
        addr: "",
        aadhar: "",
        pan: "",
        phone: "",
        email: "",
        role: "",
      }]);
      setPdfUrl("");
      setBasePdfFile(null);
      setManualTotalDocumentPages("");
      // The next sequence numbers will be automatically fetched by the useEffect on next render
    } catch (error) {
      console.error("Error creating offline notary:", error);
      alert("Failed to create offline notary record.");
    } finally {
      setIsSaving(false);
    }
  };

  const generateMergedPdfBlob = async (): Promise<Blob> => {
    let basePdfPageCount = 0;
    let basePdfBytes: ArrayBuffer | null = null;
    let docA: any = null;
    const [{ pdf }, { default: NotaryPdfTemplate }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("../components/NotaryPdfTemplate"),
    ]);

    const PDFLib = (window as any).PDFLib;
    if (!PDFLib) throw new Error("PDF Library missing.");

    if (basePdfFile) {
      basePdfBytes = await basePdfFile.arrayBuffer();
      docA = await PDFLib.PDFDocument.load(basePdfBytes);
      basePdfPageCount = docA.getPageCount();
    }

    const compressDataUrl = async (dataUrl: string): Promise<string> => {
      if (!dataUrl.startsWith('data:image')) return dataUrl;
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          const MAX = 200;
          if (width > MAX || height > MAX) {
            if (width > height) { height *= MAX / width; width = MAX; }
            else { width *= MAX / height; height = MAX; }
          } else if (dataUrl.includes('image/jpeg')) {
            // Already small enough and jpeg
            return resolve(dataUrl);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.1));
          } else {
            resolve(dataUrl);
          }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      });
    };

    const compressedPersons = await Promise.all(persons.map(async (p: any) => {
      const newP = { ...p };
      if (newP.photo) newP.photo = await compressDataUrl(newP.photo);
      if (newP.thumb) newP.thumb = await compressDataUrl(newP.thumb);
      return newP;
    }));

    // Generate the vector Notary Page
    const blob = await pdf(
      <NotaryPdfTemplate
        persons={compressedPersons as any}
        srNo={srNo}
        kNo={kNo}
        pageNo={pageNo}
        docDate={docDate}
        docName={docName}
        docPurpose={docPurpose}
        agreementAmount={agreementAmount}
        finalDocumentPageCount={finalDocumentPageCount} // Pass the new prop
      />
    ).toBlob();

    const notaryPdfArrayBuffer = await blob.arrayBuffer();

    if (basePdfFile && docA) {
      try {
        const docB = await PDFLib.PDFDocument.load(notaryPdfArrayBuffer);
        const mergedDoc = await PDFLib.PDFDocument.create();
        const copiedPagesA = await mergedDoc.copyPages(docA, docA.getPageIndices());
        copiedPagesA.forEach((page: any) => mergedDoc.addPage(page));
        const copiedPagesB = await mergedDoc.copyPages(docB, docB.getPageIndices());
        copiedPagesB.forEach((page: any) => mergedDoc.addPage(page));
        const mergedPdfBytes = await mergedDoc.save();
        return new Blob([mergedPdfBytes], { type: 'application/pdf' });
      } catch (e) {
        console.error("PDF Merge Failed:", e);
        alert("Failed to merge the Original PDF. Processing the standalone Notary Page instead.");
      }
    }

    return new Blob([notaryPdfArrayBuffer], { type: 'application/pdf' });
  };

  const validatePersons = () => {
    if (!pageNo || pageNo.trim() === '') {
      alert("Please enter the Reg.Page No manually.");
      return false;
    }

    for (let i = 0; i < persons.length; i++) {
      const p = persons[i];
      if (!p.aadhar?.trim() && !p.pan?.trim()) {
        alert(`Please enter either Aadhar Card or PAN Card for Person ${i + 1}`);
        return false;
      }
      if (p.aadhar?.trim() && !AADHAR_REGEX.test(p.aadhar.trim())) {
        alert(`Please enter a valid Aadhar Card for Person ${i + 1}.`);
        return false;
      }
      if (p.pan?.trim() && !PAN_REGEX.test(p.pan.trim())) {
        alert(`Please enter a valid PAN Card for Person ${i + 1} in format ABCDE1234F.`);
        return false;
      }
      if (p.phone?.trim()) {
        const digits = p.phone.trim().replace(/\D/g, '');
        if (digits.length !== 10) {
          alert(`Please enter exactly 10 digits for Phone Number for Person ${i + 1}.`);
          return false;
        }
      }
    }
    return true;
  };

  const getAadharValidationMessage = (aadhar?: string) => {
    const trimmedAadhar = aadhar?.trim() ?? "";
    if (!trimmedAadhar) return "";
    if (!AADHAR_REGEX.test(trimmedAadhar)) {
      return "Invalid Aadhar format.";
    }
    return "";
  };

  const getPanValidationMessage = (pan?: string) => {
    const trimmedPan = pan?.trim() ?? "";
    if (!trimmedPan) return "";
    if (!PAN_REGEX.test(trimmedPan)) {
      return "Invalid PAN format. Use ABCDE1234F.";
    }
    return "";
  };

  const handlePrintAndSave = async () => {
    if (!validatePersons()) return;

    setIsUploadingPdf(true); // Show spinner on button

    let mergedBlob: Blob;
    try {
      mergedBlob = await generateMergedPdfBlob();
    } catch (e) {
      console.error("PDF Gen Error:", e);
      alert("Failed to generate PDF. Dropping back to standalone print.");
      window.print();
      setIsUploadingPdf(false);
      return;
    }

    // Run the upload in background (non-blocking)
    const backgroundUploadTask = (async () => {
      try {
        const safeClientName = persons.length > 0 && persons[0].name ? persons[0].name.trim().replace(/\s+/g, '_') : 'Client';
        const reader = new FileReader();
        const finalFile = new File([mergedBlob], `${safeClientName}_${srNo || '01'}.pdf`, { type: 'application/pdf' });

        reader.readAsDataURL(finalFile);
        const newPdfUrl = await new Promise<string>((resolve, reject) => {
          reader.onloadend = async () => {
            try {
              const base64Pdf = reader.result as string;
              const formData = new FormData();
              formData.append('file', base64Pdf);
              formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
              formData.append('folder', 'notery_pdfs');

              const cloudinaryResponse = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`, {
                  method: 'POST',
                  body: formData,
              });

              if (!cloudinaryResponse.ok) {
                  throw new Error("Cloudinary upload failed");
              }
              const cloudinaryData = await cloudinaryResponse.json();
              resolve(cloudinaryData.secure_url);
            } catch(e) {
              reject(e);
            }
          };
          reader.onerror = () => reject(new Error("Failed to read PDF blob"));
        });

        await handleSaveToFirebase(newPdfUrl, true);
        setPdfUrl(newPdfUrl);
      } catch (error) {
        console.error("Background save failed:", error);
      } finally {
        setIsUploadingPdf(false);
      }
    })();

    // Trigger Print after a slight delay to allow background fetch to begin
    setTimeout(() => {
      const blobUrl = URL.createObjectURL(mergedBlob);
      if (basePdfFile) {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = blobUrl;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          setTimeout(() => {
            try {
              iframe.contentWindow?.focus();
              iframe.contentWindow?.print();
            } catch(e) {
              window.open(blobUrl, '_blank');
            }
          }, 100);
        };
      } else {
        window.print();
      }
    }, 100);
  };

  const handleSendMail = async () => {
    if (!pdfUrl) {
      alert("Please generate and upload the PDF first!");
      return;
    }

    setIsSendingMail(true);
    try {
      await handleSaveToFirebase(pdfUrl, true);

      const recipient = persons[0]?.email || "";
      const subject = encodeURIComponent(`Notarized Document - ${docName || 'Gift Deed'}`);
      const bodyText = `Please find attached the scanned copy of Document for your future reference presented for Notary duly executed before me 

Document Link:
${pdfUrl}

Thank you.

Sincerely,

Sameer Shrikant Vispute
BLS., LLB., DIPL
Advocate High Court
Notary (Govt. of India)

Contact Details : Mob. 8286000888 / 9933806888 | Email - advsameervispute@gmail.com`;

      const body = encodeURIComponent(bodyText);
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${recipient}&su=${subject}&body=${body}`;
      window.open(gmailUrl, '_blank');
    } catch (error) {
      console.error("Email compose blocked because Firebase save failed:", error);
      const message = error instanceof Error && error.message ? error.message : "Unknown Firebase error.";
      alert(`Email was not opened because the document could not be saved to Firebase.\n\n${message}`);
    } finally {
      setIsSendingMail(false);
    }
  };

  return (
    <Layout>




      {/* WebCam Modal for both Face and Thumb captures */}
      {activeCapture && (
        <WebcamCapture
          onCapture={handleCapture}
          onClose={() => setActiveCapture(null)}
        />
      )}

      {/* Loading Bar Overlay */}
      {showUploadProgress && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-2xl w-full max-w-md flex flex-col items-center gap-4">
            <Loader2 size={32} className="animate-spin text-primary" />
            <h3 className="font-headline text-xl font-bold text-on-surface text-center">
              {uploadStatusMessage}
            </h3>
            <div className="w-full bg-outline-variant/30 rounded-full h-2.5">
              <div
                className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
            <p className="text-sm text-on-surface-variant">{uploadProgress}% Complete</p>
          </div>
        </div>
      )}

      {/* Person Editor Modal */}
      {showPersonEditorModal && persons.length > 0 && (
        <PersonEditorModal
          isOpen={showPersonEditorModal}
          onClose={() => setShowPersonEditorModal(false)}
          person={persons[currentPersonIndexInModal]}
          onUpdatePerson={updatePerson}
          onDeletePerson={deletePerson}
          onAddPerson={addPerson}
          currentIndex={currentPersonIndexInModal}
          totalPersons={persons.length}
          onNavigate={(direction) => {
            if (direction === 'prev' && currentPersonIndexInModal > 0) setCurrentPersonIndexInModal(prev => prev - 1);
            if (direction === 'next' && currentPersonIndexInModal < persons.length - 1) setCurrentPersonIndexInModal(prev => prev + 1);
          }}
          onStartCapture={(personId, type) => setActiveCapture({ personId, type })}
          onStartFingerprintScan={startFingerprintScan}
          fingerprintBusy={isFingerprintBusy(persons[currentPersonIndexInModal].id)}
          fingerprintStatus={fingerprintSessions[persons[currentPersonIndexInModal].id]?.status}
          fingerprintDeviceInfo={fingerprintSessions[persons[currentPersonIndexInModal].id]?.deviceInfo}
          fingerprintBackendAccepted={fingerprintSessions[persons[currentPersonIndexInModal].id]?.backendAccepted}
          fingerprintBackendMessage={fingerprintSessions[persons[currentPersonIndexInModal].id]?.backendMessage}
          onHandleFileUpload={handleFileUpload}
          knownClients={knownClients}
          onAutofillPerson={autofillPerson}
        />
      )}


      <main className="flex-1 overflow-y-auto w-full p-0 bg-surface print:bg-white print:p-0">
        {/* Mobile Toggle Button */}
        <div className="xl:hidden flex justify-end p-4 no-print sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-outline-variant/10">
          <button 
            onClick={() => setShowPreviewMobile(!showPreviewMobile)}
            className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-xl font-body font-bold shadow-lg hover:opacity-90 active:scale-95 transition-all text-sm uppercase tracking-wider"
          >
            {showPreviewMobile ? (
              <><Edit3 size={18} /> Edit Data</>
            ) : (
              <><Eye size={18} /> Preview Document</>
            )}
          </button>
        </div>
        <div ref={parentContainerRef} className="flex flex-col xl:flex-row gap-4 p-3 md:p-4 2xl:gap-6 2xl:p-6 justify-center items-start print:block print:p-0">
          <div
            className={`w-full bg-surface-container-lowest p-4 rounded-xl editorial-shadow no-print border border-outline-variant/15 font-body shrink-0 relative ${showPreviewMobile ? 'hidden xl:block' : 'block'}`}
            style={window.innerWidth >= 1280 ? { width: dataEntryPanelWidthPx + 'px' } : {}} // Apply dynamic width only on XL and above
          >
            {window.innerWidth >= 1280 && ( // Only show resizer on XL and above
              <div
                ref={resizerRef}
                onMouseDown={startResizing}
                onTouchStart={startResizing}
                className="absolute top-0 right-[-8px] w-4 h-full cursor-ew-resize z-10 hover:bg-primary/20 transition-colors rounded-full"
                title="Drag to resize data entry panel"
              ></div>
            )}
            <div className="mb-4">
              <div className="flex flex-col">
                <h2 className="font-headline text-2xl font-bold text-on-surface">Data Entry</h2>
                <p className="text-on-surface-variant font-body text-xs mt-1">Configure document variables. Changes auto-sync to the print preview.</p>
              </div>
            </div>

            <div className="relative w-full">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant focus-within:text-primary transition-colors" />
              <input
                className="w-full bg-surface-container-highest focus:bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/70 rounded-lg py-2.5 pl-12 pr-12 border border-outline-variant/15 focus:ring-2 focus:ring-primary/30 transition-all font-body text-sm"
                placeholder="Enter Document ID to auto-fetch from cloud..."
                value={fetchQuery}
                onChange={(e) => handleAutoFetch(e.target.value)}
                type="text"
              />
              {isFetching && <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary animate-spin" />}
            </div>
            <div className="mt-3 p-3 border border-dashed border-outline-variant/40 rounded-xl bg-surface-container-lowest/50 flex flex-col md:flex-row items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-on-surface">Original Document (Optional)</span>
                <span className="text-xs text-on-surface-variant font-body">Upload the original Gift Deed PDF. The Notary page will be appended to the END.</span>
              </div>
              <label className="flex items-center gap-2 bg-secondary-container text-on-secondary-container px-3 py-2 rounded-lg font-body font-medium hover:opacity-90 active:scale-95 transition-all text-sm shadow-sm cursor-pointer whitespace-nowrap">
                <FileText size={16} />
                {basePdfFile ? 'Change Original PDF' : 'Attach Main PDF'}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setBasePdfFile(e.target.files[0]);
                    }
                  }}
                />
              </label>
              {basePdfFile && (
                <div className="flex items-center gap-2 bg-secondary-container/40 text-on-surface px-3 py-1.5 rounded-lg text-xs font-bold">
                  Attached: {basePdfFile.name}
                  <button onClick={() => setBasePdfFile(null)} className="ml-2 hover:text-destructive transition-colors"><X size={14} /></button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Sr No</label>
                <input type="text" value={srNo} onChange={(e) => setSrNo(e.target.value)} className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all font-medium text-sm" placeholder="e.g. 2024/01" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Register No</label>
                <input type="text" value={kNo} onChange={(e) => handleKNoChange(e.target.value)} className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all font-medium text-sm" placeholder="e.g. 123" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Reg.Page No</label>
                <input type="text" value={pageNo} onChange={(e) => setPageNo(e.target.value)} className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all font-medium text-sm" placeholder="e.g. 12" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Document Name</label>
                <select
                  value={docNameSelection}
                  onChange={(e) => {
                    const selectedValue = e.target.value;
                    setDocNameSelection(selectedValue);
                    if (selectedValue === OTHER_DOC_NAME_OPTION) {
                      setDocName("");
                      return;
                    }
                    setDocName(selectedValue);
                  }}
                  className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all font-medium text-sm"
                >
                  {DOC_NAME_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  <option value={OTHER_DOC_NAME_OPTION}>Other (Editable)</option>
                </select>
                {docNameSelection === OTHER_DOC_NAME_OPTION && (
                  <input
                    type="text"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    className="mt-2 w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all font-medium text-sm"
                    placeholder="Enter custom document name"
                  />
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Document Purpose</label>
                <input type="text" value={docPurpose} onChange={(e) => setDocPurpose(e.target.value)} className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all font-medium text-sm" placeholder="e.g. Flat Purpose" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Document Date</label>
                <input type="text" value={docDate} onChange={(e) => setDocDate(e.target.value)} className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all font-medium text-sm" placeholder="DD MMMM YYYY" />
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Total Document Pages (Override)</label>
                <input type="number" value={manualTotalDocumentPages} onChange={(e) => setManualTotalDocumentPages(e.target.value)} className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all font-medium text-sm" placeholder="e.g. 5" />
                <p className="text-xs text-on-surface-variant mt-1">Leave blank to auto-calculate ({previewBasePdfPageCount} + {notaryGeneratedPageCount} = {finalDocumentPageCount} pages)</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Agreement Value (₹)</label>
                <input type="number" value={agreementAmount} onChange={(e) => setAgreementAmount(e.target.value)} className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all font-medium text-sm" placeholder="e.g. 50000" />
              </div>
            </div>

            <div className="pt-5 border-t border-outline-variant/15">
              <div>
                <h3 className="font-headline text-xl font-bold text-on-surface">Parties Involved</h3>
                <p className="text-xs text-on-surface-variant mt-1">Either Aadhar Card or PAN Card is required for each party.</p>
              </div>
            </div>

            <div className="mt-5 max-h-[min(46vh,34rem)] space-y-3 overflow-y-auto pr-2 pb-1 app-scroll">
              {persons.map((person, index) => (
                <div key={person.id} className="p-4 border border-outline-variant/30 rounded-xl bg-surface-container-lowest/50 relative shadow-sm">
                  <div className="absolute -left-2 -top-2 w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs shadow-md">{index + 1}</div>
                  {persons.length > 1 && (
                    <button
                      onClick={() => {
                        if (window.confirm("Are you sure you want to remove this person?")) {
                          deletePerson(person.id);
                        }
                      }}
                      className="absolute -right-2 -top-2 w-6 h-6 rounded-full bg-error text-on-error flex items-center justify-center hover:bg-error/80 shadow-md transition-colors"
                      title="Remove person"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-12 gap-x-4 gap-y-3">
                    <div
                      className="2xl:col-span-4 relative"
                      onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setFocusedPersonId(null);
                        }
                      }}
                    >
                      <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Full Name</label>
                      <input
                        type="text"
                        value={person.name}
                        onChange={(e) => updatePerson(person.id, 'name', e.target.value)}
                        onFocus={() => setFocusedPersonId(person.id)}
                        className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm"
                        placeholder="Start typing to autofill..."
                      />

                      {focusedPersonId === person.id && person.name.trim().length >= 2 && (
                        <ul className="absolute top-full mt-2 w-full bg-surface-container-lowest text-on-surface border border-outline-variant/30 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] max-h-64 overflow-y-auto z-50">
                          {matchingKnownClients.map((match) => (
                            <li key={match.id}>
                              <button
                                type="button"
                                // Use onMouseDown to pre-emptively fire before the input's strictly bound onBlur completely kills the dropdown DOM node!
                                onMouseDown={(e) => { e.preventDefault(); autofillPerson(person.id, match); }}
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
                          {matchingKnownClients.length === 0 && (
                            <li className="px-4 py-3 text-xs text-on-surface-variant text-center font-body">No historical clients found.</li>
                          )}
                        </ul>
                      )}
                    </div>
                    <div className="2xl:col-span-2">
                      <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Age</label>
                      <input type="text" value={person.age} onChange={(e) => updatePerson(person.id, 'age', e.target.value)} className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm" placeholder="Age" />
                    </div>
                    <div className="2xl:col-span-6">
                      <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Role</label>
                      <select
                        value={ROLE_OPTIONS.includes(person.role || '') ? person.role : (person.role ? "__other__" : "")}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "__other__") {
                            updatePerson(person.id, 'role', ""); // Clear to let them type
                          } else {
                            updatePerson(person.id, 'role', val);
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
                          onChange={(e) => updatePerson(person.id, 'role', e.target.value)}
                          className="mt-2 w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm"
                          placeholder="Enter custom role..."
                        />
                      )}
                    </div>
                    <div className="2xl:col-span-6">
                      <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Aadhar Card *</label>
                      <input
                        type="text"
                        value={person.aadhar}
                        onChange={(e) => updatePerson(person.id, 'aadhar', normalizeAadharInput(e.target.value))}
                        className={`w-full p-2.5 border rounded-lg bg-surface outline-none transition-all font-medium text-sm ${
                          getAadharValidationMessage(person.aadhar)
                            ? 'border-error text-error focus:ring-2 focus:ring-error/20 focus:border-error'
                            : 'border-outline-variant/40 focus:ring-2 focus:ring-primary/20 focus:border-primary/50'
                        }`}
                        placeholder="1234 5678 9012"
                        maxLength={14}
                      />
                      {getAadharValidationMessage(person.aadhar) && (
                        <p className="mt-1 text-[11px] font-medium text-error">
                          {getAadharValidationMessage(person.aadhar)}
                        </p>
                      )}
                    </div>
                    <div className="2xl:col-span-6">
                      <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">PAN Card *</label>
                      <input
                        type="text"
                        value={person.pan || ''}
                        onChange={(e) => updatePerson(person.id, 'pan', normalizePanInput(e.target.value))}
                        className={`w-full p-2.5 border rounded-lg bg-surface outline-none transition-all font-medium text-sm uppercase ${
                          getPanValidationMessage(person.pan)
                            ? 'border-error text-error focus:ring-2 focus:ring-error/20 focus:border-error'
                            : 'border-outline-variant/40 focus:ring-2 focus:ring-primary/20 focus:border-primary/50'
                        }`}
                        placeholder="ABCDE1234F"
                        maxLength={10}
                      />
                      {getPanValidationMessage(person.pan) && (
                        <p className="mt-1 text-[11px] font-medium text-error">
                          {getPanValidationMessage(person.pan)}
                        </p>
                      )}
                    </div>
                    <div className="md:col-span-2 2xl:col-span-12">
                      <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Residential Address</label>
                      <input 
                        type="text" 
                        value={person.addr} 
                        onChange={(e) => {
                          const formattedAddr = e.target.value.replace(/,(?=[^\s])/g, ', ');
                          updatePerson(person.id, 'addr', formattedAddr);
                        }} 
                        className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm" 
                        placeholder="Complete address..." 
                      />
                    </div>
                    <div className="2xl:col-span-6">
                      <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Phone (Optional)</label>
                      <input 
                        type="text" 
                        value={person.phone || ''} 
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
                          updatePerson(person.id, 'phone', digitsOnly);
                        }} 
                        className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm" 
                        placeholder="XXXXXXXXXX" 
                      />
                    </div>
                    <div className="2xl:col-span-6">
                      <label className="block text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">Email (Optional)</label>
                      <input type="email" value={person.email || ''} onChange={(e) => updatePerson(person.id, 'email', e.target.value)} className="w-full p-2.5 border border-outline-variant/40 rounded-lg bg-surface outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all font-medium text-sm" placeholder="client@example.com" />
                    </div>

                    <div className="md:col-span-2 2xl:col-span-12 mt-1 pt-3 border-t border-outline-variant/20 flex flex-wrap gap-2 items-center">
                      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mr-2">Biometrics:</span>
                      <div className="flex gap-2 items-center">
                        <button onClick={() => setActiveCapture({ personId: person.id, type: 'photo' })} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors font-medium text-xs">
                          <Camera size={14} /> {person.photo ? 'Retake Photo' : 'Capture Photo'}
                        </button>
                        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high text-on-surface-variant rounded hover:bg-surface-container-highest transition-colors cursor-pointer font-medium text-xs shadow-sm">
                          Upload Image <input type="file" hidden accept="image/*" onChange={(e) => handleFileUpload(person.id, 'photo', e)} />
                        </label>
                      </div>
                      <div className="w-[1px] h-6 bg-outline-variant/30 hidden md:block"></div>
                      <div className="flex gap-2 items-center">
                        <button disabled={isFingerprintBusy(person.id)} onClick={() => startFingerprintScan(person.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors font-medium text-xs disabled:cursor-not-allowed disabled:opacity-60">
                          {isFingerprintBusy(person.id) ? <Loader2 size={14} className="animate-spin" /> : <Fingerprint size={14} />} {person.thumb ? 'Rescan Thumbprint' : 'Scan Thumbprint'}
                        </button>
                        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-high text-on-surface-variant rounded hover:bg-surface-container-highest transition-colors cursor-pointer font-medium text-xs shadow-sm">
                          Upload Thumb <input type="file" hidden accept="image/*" onChange={(e) => handleFileUpload(person.id, 'thumb', e)} />
                        </label>
                      </div>
                      <div className="basis-full">
                        <FingerprintStatusPanel
                          status={fingerprintSessions[person.id]?.status}
                          deviceInfo={fingerprintSessions[person.id]?.deviceInfo}
                          backendAccepted={fingerprintSessions[person.id]?.backendAccepted}
                          backendMessage={fingerprintSessions[person.id]?.backendMessage}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Button to open the Person Editor Modal */}
            <button
              onClick={() => {
                setCurrentPersonIndexInModal(0); // Start with the first person
                setShowPersonEditorModal(true);
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 bg-secondary-container text-on-secondary-container px-4 py-2.5 rounded-xl font-body font-medium hover:opacity-90 active:scale-95 transition-all text-sm shadow-sm"
            >
              <Edit3 size={16} /> Edit Persons in Full Screen
            </button>
            <button onClick={() => { addPerson(); setCurrentPersonIndexInModal(persons.length); setShowPersonEditorModal(true); }} className="mt-3 flex w-full items-center justify-center gap-2 bg-secondary-container text-on-secondary-container px-4 py-2.5 rounded-xl font-body font-medium hover:opacity-90 active:scale-95 transition-all text-sm shadow-sm">
              <Plus size={16} /> Add Person
            </button>

            <div className="mt-8 border-t border-outline-variant/15 pt-6">
              <div className="mb-4">
                <h3 className="font-headline text-lg font-bold text-on-surface">Document Actions</h3>
                <p className="mt-1 text-xs font-body text-on-surface-variant">Finish the form, then generate, print, or share the final document.</p>
              </div>

              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                <button
                  onClick={handlePrintAndSave}
                  disabled={isUploadingPdf}
                  className={`w-full sm:w-auto justify-center flex items-center gap-2 rounded-xl border px-4 py-2.5 font-body text-xs font-bold uppercase tracking-[0.16em] shadow-[0_12px_28px_-20px_rgba(10,10,10,0.55)] transition-all whitespace-nowrap ${
                    isUploadingPdf
                      ? 'border-outline-variant/20 bg-surface-variant text-on-surface-variant opacity-70 cursor-not-allowed'
                      : 'border-transparent bg-primary text-on-primary hover:opacity-90 active:scale-[0.98]'
                  }`}
                >
                  {isUploadingPdf ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                  {isUploadingPdf ? "Processing..." : "Print & Save"}
                </button>

                <button
                  onClick={handleSkipNotary}
                  disabled={isSaving}
                  className={`w-full sm:w-auto justify-center flex items-center gap-2 rounded-xl border px-4 py-2.5 font-body text-xs font-bold uppercase tracking-[0.16em] shadow-sm transition-all whitespace-nowrap ${
                    isSaving
                      ? 'border-outline-variant/20 bg-surface-variant text-on-surface-variant opacity-70 cursor-not-allowed'
                      : 'border-outline-variant/30 bg-surface text-on-surface hover:bg-surface-container active:scale-[0.98]'
                  }`}
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isSaving ? "Skipping..." : "Skip (Offline Notary)"}
                </button>

                {pdfUrl && (
                  <>
                    <button
                      onClick={() => window.open(pdfUrl, '_blank')}
                      className="w-full sm:w-auto justify-center flex items-center gap-2 rounded-xl border border-outline-variant/25 bg-surface-container-high text-on-surface px-4 py-2.5 font-body text-xs font-bold uppercase tracking-[0.16em] shadow-sm transition-all whitespace-nowrap hover:bg-surface-container"
                    >
                      <FileText size={16} />
                      View PDF
                    </button>
                    <button
                      onClick={handleSendMail}
                      disabled={isSendingMail}
                      className={`w-full sm:w-auto justify-center flex items-center gap-2 rounded-xl border border-secondary-container/50 px-4 py-2.5 font-body text-xs font-bold uppercase tracking-[0.16em] shadow-sm transition-all whitespace-nowrap ${
                        isSendingMail
                          ? 'bg-surface-variant text-on-surface-variant opacity-70 cursor-not-allowed'
                          : 'bg-secondary-container text-on-secondary-container hover:opacity-90 active:scale-[0.98]'
                      }`}
                    >
                      {isSendingMail ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                      {isSendingMail ? "Saving..." : "Send via Gmail"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div id="document-to-print" className={`w-full xl:sticky xl:top-4 flex flex-col items-center print:static print:block print:w-[210mm] print:m-0 print:p-0 ${showPreviewMobile ? 'flex' : 'hidden xl:flex'}`} style={{ color: '#000000', flex: 1, minWidth: 0 }}>
            {previewChunks.map((chunk, pageIndex) => (
              <PreviewPage
                key={pageIndex}
                chunk={chunk}
                pageIndex={pageIndex}
                totalPages={notaryGeneratedPageCount}
                isLastPage={pageIndex === notaryGeneratedPageCount - 1}
                totalDocumentPages={finalDocumentPageCount}
                srNo={previewSrNo}
                docDate={previewDocDate}
                kNo={previewKNo}
                pageNo={previewPageNo}
                docName={previewDocName}
                docPurpose={previewDocPurpose}
                agreementAmount={agreementAmount}
              />
            ))}
          </div>
        </div>
      </main>
    </Layout>
  );
}
