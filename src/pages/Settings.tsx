import { Layout } from "../components/layout/Layout";
import { User, Info, Fingerprint, Loader2, RotateCcw, Camera } from "lucide-react";

import { useState, useEffect, useRef } from "react";
import { db } from "../firebaseDb";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { FingerprintStatusPanel } from "../components/FingerprintStatusPanel";
import {
  buildFingerprintConfig,
  loadFingerprintConfig,
  saveFingerprintConfig,
} from "../lib/fingerprint/config";
import {
  testFingerprintConnection,
  type FingerprintCaptureStatus,
} from "../lib/fingerprint/capture";
import type { FingerprintConfig } from "../lib/fingerprint/types";
import {
  buildWebcamAutoStopStatus,
  buildWebcamErrorStatus,
  buildWebcamSuccessStatus,
  buildWebcamUnsupportedStatus,
  WEBCAM_PREVIEW_TIMEOUT_MS,
  type WebcamPreviewStatus,
} from "../lib/webcam/status";

export function Settings() {
  const [licenseNumber, setLicenseNumber] = useState("NX-2023-8941");
  const [registerNumber, setRegisterNumber] = useState("");
  const [currentSrNo, setCurrentSrNo] = useState("");
  const [currentPageNo, setCurrentPageNo] = useState("");
  const [fingerprintConfig, setFingerprintConfig] = useState<FingerprintConfig>(() => loadFingerprintConfig());
  const [fingerprintStatus, setFingerprintStatus] = useState<FingerprintCaptureStatus | null>(null);
  const [isTestingFingerprint, setIsTestingFingerprint] = useState(false);
  const [webcamStatus, setWebcamStatus] = useState<WebcamPreviewStatus>({
    stage: "idle",
    message: "Start the preview to confirm the video camera is working on this computer.",
    details: "The preview runs only in this browser tab and does not save any photo.",
  });
  const [isTestingWebcam, setIsTestingWebcam] = useState(false);
  const [isWebcamPreviewActive, setIsWebcamPreviewActive] = useState(false);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const webcamRequestIdRef = useRef(0);
  const webcamAutoStopTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const savedLicense = localStorage.getItem("notaryLicenseNumber");
    if (savedLicense) setLicenseNumber(savedLicense);

    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, "settings", "config"));
        if (docSnap.exists()) {
           const data = docSnap.data();
           if (data.registerNumber) setRegisterNumber(data.registerNumber);
           if (data.currentSrNo) setCurrentSrNo(data.currentSrNo);
           if (data.currentPageNo) setCurrentPageNo(data.currentPageNo);
        } else {
           const savedRegister = localStorage.getItem("registerNumber");
           if (savedRegister) setRegisterNumber(savedRegister);
        }
      } catch (err) {
        console.error("Failed to fetch settings from Firebase", err);
      }
    };
    fetchSettings();
  }, []);

  const stopWebcamStream = () => {
    webcamStreamRef.current?.getTracks().forEach((track) => track.stop());
    webcamStreamRef.current = null;

    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
    }
  };

  const clearWebcamAutoStopTimeout = () => {
    if (webcamAutoStopTimeoutRef.current !== null) {
      window.clearTimeout(webcamAutoStopTimeoutRef.current);
      webcamAutoStopTimeoutRef.current = null;
    }
  };

  useEffect(() => () => {
    webcamRequestIdRef.current += 1;
    clearWebcamAutoStopTimeout();
    stopWebcamStream();
  }, []);

  const updateFingerprintConfig = <K extends keyof FingerprintConfig>(
    key: K,
    value: FingerprintConfig[K],
  ) => {
    setFingerprintConfig((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    localStorage.setItem("notaryLicenseNumber", licenseNumber);
    try {
      await setDoc(doc(db, "settings", "config"), { 
         registerNumber,
         currentSrNo,
         currentPageNo
      }, { merge: true });
      localStorage.setItem("registerNumber", registerNumber);
      alert("Settings saved successfully to Firebase Cloud!");
    } catch (e) {
      console.error("Failed to save to Firebase:", e);
      alert("Failed to save settings to Cloud.");
    }
  };

  const handleSaveFingerprintConfig = () => {
    saveFingerprintConfig(fingerprintConfig);
    setFingerprintStatus({
      stage: "success",
      message: "Fingerprint scanner settings saved on this computer.",
      details: "These values stay local to the client PC because the scanner runs through localhost.",
    });
  };

  const handleResetFingerprintConfig = () => {
    const defaults = buildFingerprintConfig();
    setFingerprintConfig(defaults);
    saveFingerprintConfig(defaults);
    setFingerprintStatus({
      stage: "success",
      message: "Fingerprint scanner settings reset to defaults.",
      details: "The default profile is configured for Mantra MFS110 with localhost RD service.",
    });
  };

  const handleTestFingerprint = async () => {
    setIsTestingFingerprint(true);
    setFingerprintStatus(null);

    try {
      saveFingerprintConfig(fingerprintConfig);
      await testFingerprintConnection(fingerprintConfig, setFingerprintStatus);
    } catch (error) {
      setFingerprintStatus({
        stage: "error",
        message: "Unable to verify the fingerprint device connection.",
        details:
          error instanceof Error
            ? error.message
            : "The RD service did not respond from the configured localhost address.",
      });
    } finally {
      setIsTestingFingerprint(false);
    }
  };

  const handleTestWebcam = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      clearWebcamAutoStopTimeout();
      stopWebcamStream();
      setWebcamStatus(buildWebcamUnsupportedStatus());
      setIsTestingWebcam(false);
      setIsWebcamPreviewActive(false);
      return;
    }

    setIsTestingWebcam(true);
    setWebcamStatus({
      stage: "loading",
      message: "Starting live webcam preview...",
      details: "Allow camera permission if the browser asks for it.",
    });

    clearWebcamAutoStopTimeout();
    stopWebcamStream();
    setIsWebcamPreviewActive(false);
    const requestId = webcamRequestIdRef.current + 1;
    webcamRequestIdRef.current = requestId;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 360 },
        },
      });

      if (requestId !== webcamRequestIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      webcamStreamRef.current = stream;

      if (webcamVideoRef.current) {
        webcamVideoRef.current.srcObject = stream;
        await webcamVideoRef.current.play().catch(() => undefined);
      }

      setIsWebcamPreviewActive(true);
      setWebcamStatus(buildWebcamSuccessStatus(stream.getVideoTracks()[0]?.label));
      clearWebcamAutoStopTimeout();
      webcamAutoStopTimeoutRef.current = window.setTimeout(() => {
        handleStopWebcam("auto");
      }, WEBCAM_PREVIEW_TIMEOUT_MS);
    } catch (error) {
      if (requestId !== webcamRequestIdRef.current) {
        return;
      }

      clearWebcamAutoStopTimeout();
      stopWebcamStream();
      setWebcamStatus(buildWebcamErrorStatus(error));
    } finally {
      if (requestId === webcamRequestIdRef.current) {
        setIsTestingWebcam(false);
      }
    }
  };

  const handleStopWebcam = (reason: "manual" | "auto" = "manual") => {
    webcamRequestIdRef.current += 1;
    clearWebcamAutoStopTimeout();
    stopWebcamStream();
    setIsTestingWebcam(false);
    setIsWebcamPreviewActive(false);
    setWebcamStatus(
      reason === "auto"
        ? buildWebcamAutoStopStatus(WEBCAM_PREVIEW_TIMEOUT_MS / 1000)
        : {
            stage: "idle",
            message: "Preview stopped.",
            details: "Start the preview again whenever you want to confirm the camera is working.",
          },
    );
  };

  const webcamStatusClasses =
    webcamStatus.stage === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : webcamStatus.stage === "error"
        ? "border-rose-200 bg-rose-50 text-rose-900"
        : webcamStatus.stage === "loading"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-outline-variant/15 bg-surface-container-low text-on-surface";

  return (
    <Layout>
      <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12">

        <div className="max-w-6xl mx-auto w-full">
          <div className="mb-10">
            <h2 className="text-4xl font-headline font-bold text-on-surface mb-2">Account Settings</h2>
            <p className="text-on-surface-variant font-body text-base">Manage your professional profile, preferences, and security configurations.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <aside className="lg:col-span-3">
              <nav className="flex flex-col gap-1 lg:sticky lg:top-8">
                <a href="#profile" className="px-4 py-3 rounded-lg bg-surface-container-low text-primary font-body font-medium flex items-center gap-3">
                  <User size={20} />
                  Profile Settings
                </a>
                <a href="#configure" className="px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface font-body font-medium flex items-center gap-3 transition-colors">
                  <Fingerprint size={20} />
                  Fingerprint Scanner
                </a>
                <a href="#webcam" className="px-4 py-3 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface font-body font-medium flex items-center gap-3 transition-colors">
                  <Camera size={20} />
                  Test Webcam
                </a>
              </nav>
            </aside>

            <div className="lg:col-span-9 flex flex-col gap-12">
              <section id="profile" className="scroll-mt-8">
                <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 transition-colors hover:bg-surface-bright editorial-shadow">
                  <h3 className="text-2xl font-headline font-bold text-on-surface mb-6">Profile Details</h3>
                  
                  <div className="mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex flex-col gap-2">
                        <label className="font-label text-sm font-medium text-on-surface-variant">Full Name</label>
                        <input className="w-full bg-surface-container-high border-transparent rounded-md font-body text-on-surface px-4 py-3 opacity-80 cursor-not-allowed" type="text" value="Sameer Shrikant Vispute" readOnly />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="font-label text-sm font-medium text-on-surface-variant">Professional Title</label>
                        <input className="w-full bg-surface-container-high border-transparent rounded-md font-body text-on-surface px-4 py-3 opacity-80 cursor-not-allowed" type="text" value="Advocate High Court, BLS., LLB., DIPL" readOnly />
                      </div>
                      <div className="flex flex-col gap-2 md:col-span-2">
                        <label className="font-label text-sm font-medium text-on-surface-variant">Email Address</label>
                        <input className="w-full bg-surface-container-high border-transparent rounded-md font-body text-on-surface px-4 py-3 opacity-80 cursor-not-allowed" type="email" value="advsameervispute@gmail.com" readOnly />
                      </div>
                    </div>
                  </div>


                  <div className="border-t border-outline-variant/15 pt-8 mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="font-label text-sm font-medium text-on-surface-variant flex items-center gap-2">
                        Notary License Number
                        <Info size={16} className="text-tertiary cursor-help" />
                      </label>
                      <input 
                        className="w-full bg-surface-container-highest border-transparent focus:border-primary/30 focus:bg-surface-container-lowest focus:ring-0 rounded-md font-body text-on-surface font-mono px-4 py-3 transition-all" 
                        type="text" 
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="font-label text-sm font-medium text-on-surface-variant flex items-center gap-2">
                        Default Register Number
                        <Info size={16} className="text-tertiary cursor-help" />
                      </label>
                      <input 
                        className="w-full bg-surface-container-highest border-transparent focus:border-primary/30 focus:bg-surface-container-lowest focus:ring-0 rounded-md font-body text-on-surface font-mono px-4 py-3 transition-all" 
                        type="text" 
                        value={registerNumber}
                        onChange={(e) => setRegisterNumber(e.target.value)}
                        placeholder="e.g. 123"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="font-label text-sm font-medium text-on-surface-variant flex items-center gap-2">
                        Current Doc Number (Sr No)
                      </label>
                      <input 
                        className="w-full bg-surface-container-highest border-transparent focus:border-primary/30 focus:bg-surface-container-lowest focus:ring-0 rounded-md font-body text-on-surface font-mono px-4 py-3 transition-all" 
                        type="text" 
                        value={currentSrNo}
                        onChange={(e) => setCurrentSrNo(e.target.value)}
                        placeholder="e.g. 1"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="font-label text-sm font-medium text-on-surface-variant flex items-center gap-2">
                        Current Reg.Page No
                      </label>
                      <input 
                        className="w-full bg-surface-container-highest border-transparent focus:border-primary/30 focus:bg-surface-container-lowest focus:ring-0 rounded-md font-body text-on-surface font-mono px-4 py-3 transition-all" 
                        type="text" 
                        value={currentPageNo}
                        onChange={(e) => setCurrentPageNo(e.target.value)}
                        placeholder="e.g. 1"
                      />
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end">
                    <button onClick={handleSave} className="px-6 py-3 gradient-primary text-white rounded-xl font-body font-medium hover:opacity-90 transition-opacity shadow-sm">
                      Save Changes
                    </button>
                  </div>
                </div>
              </section>

              <section id="configure" className="scroll-mt-8">
                <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 transition-colors hover:bg-surface-bright editorial-shadow">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-2xl font-headline font-bold text-on-surface">Configure Fingerprint Scanner</h3>
                    <p className="text-on-surface-variant font-body text-sm">
                      Saved on this computer only. Use this tab on each client PC to point the app at the locally installed Mantra RD service.
                    </p>
                  </div>

                  <div className="mt-6 rounded-xl border border-outline-variant/20 bg-surface-container-low p-4 text-sm text-on-surface-variant">
                    <p className="font-medium text-on-surface">Recommended setup</p>
                    <p className="mt-1">
                      Mantra `MFS110` + running `MantraRDService` on localhost. If the app is opened over HTTPS, keep the official Mantra browser bridge/extension enabled or allow secure localhost access on that client machine.
                    </p>
                  </div>

                  <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="font-label text-sm font-medium text-on-surface-variant">Device Model</label>
                      <input
                        className="w-full bg-surface-container-high border-transparent rounded-md font-body text-on-surface px-4 py-3 opacity-80 cursor-not-allowed"
                        type="text"
                        value="Mantra MFS110"
                        readOnly
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="font-label text-sm font-medium text-on-surface-variant">Transport Mode</label>
                      <select
                        value={fingerprintConfig.transport}
                        onChange={(e) => updateFingerprintConfig("transport", e.target.value as FingerprintConfig["transport"])}
                        className="w-full bg-surface-container-highest border-transparent focus:border-primary/30 focus:bg-surface-container-lowest rounded-md font-body text-on-surface px-4 py-3 transition-all"
                      >
                        <option value="auto">Auto (Try HTTPS then HTTP)</option>
                        <option value="https">Secure Localhost Only</option>
                        <option value="http">Plain HTTP Localhost Only</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="font-label text-sm font-medium text-on-surface-variant">RD Secure URL</label>
                      <input
                        className="w-full bg-surface-container-highest border-transparent focus:border-primary/30 focus:bg-surface-container-lowest rounded-md font-body text-on-surface font-mono px-4 py-3 transition-all"
                        type="text"
                        value={fingerprintConfig.rdSecureBaseUrl}
                        onChange={(e) => updateFingerprintConfig("rdSecureBaseUrl", e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="font-label text-sm font-medium text-on-surface-variant">RD HTTP URL</label>
                      <input
                        className="w-full bg-surface-container-highest border-transparent focus:border-primary/30 focus:bg-surface-container-lowest rounded-md font-body text-on-surface font-mono px-4 py-3 transition-all"
                        type="text"
                        value={fingerprintConfig.rdBaseUrl}
                        onChange={(e) => updateFingerprintConfig("rdBaseUrl", e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="font-label text-sm font-medium text-on-surface-variant">Capture Timeout (ms)</label>
                      <input
                        className="w-full bg-surface-container-highest border-transparent focus:border-primary/30 focus:bg-surface-container-lowest rounded-md font-body text-on-surface font-mono px-4 py-3 transition-all"
                        type="number"
                        min={5000}
                        step={1000}
                        value={fingerprintConfig.captureTimeoutMs}
                        onChange={(e) => updateFingerprintConfig("captureTimeoutMs", Math.max(5000, Number(e.target.value) || 15000))}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="font-label text-sm font-medium text-on-surface-variant">Backend Endpoint</label>
                      <input
                        className="w-full bg-surface-container-highest border-transparent focus:border-primary/30 focus:bg-surface-container-lowest rounded-md font-body text-on-surface font-mono px-4 py-3 transition-all"
                        type="text"
                        value={fingerprintConfig.backendEndpoint}
                        onChange={(e) => updateFingerprintConfig("backendEndpoint", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col gap-4 rounded-xl border border-outline-variant/15 bg-surface-container-low p-5">
                    <div className="flex items-start gap-3">
                      <input
                        id="preview-image"
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-outline-variant/40"
                        checked={fingerprintConfig.enablePreviewImage}
                        onChange={(e) => updateFingerprintConfig("enablePreviewImage", e.target.checked)}
                      />
                      <label htmlFor="preview-image" className="text-sm text-on-surface">
                        Try to capture a printable thumb image from a licensed MFS110 SDK service.
                        <span className="block mt-1 text-on-surface-variant">
                          Keep this off for normal MFS110 L1 RD use. RD capture returns encrypted PID data, not a raw printable thumb image. Enable it only if Mantra provides an MFS110 Windows Public SDK, Enrollment SDK, or Web SDK client service for your non-RD printing workflow.
                        </span>
                      </label>
                    </div>

                    <div className="flex items-start gap-3">
                      <input
                        id="browser-bridge"
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-outline-variant/40"
                        checked={fingerprintConfig.requireBrowserBridge}
                        onChange={(e) => updateFingerprintConfig("requireBrowserBridge", e.target.checked)}
                      />
                      <label htmlFor="browser-bridge" className="text-sm text-on-surface">
                        Show HTTPS browser-bridge guidance if direct localhost access fails.
                      </label>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <div className="text-xs text-on-surface-variant">
                      Test checks whether the configured RD service is reachable from this browser session.
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleTestFingerprint}
                        disabled={isTestingFingerprint}
                        className="px-5 py-3 bg-secondary-container text-on-secondary-container rounded-xl font-body font-medium hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isTestingFingerprint ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={16} />}
                        {isTestingFingerprint ? "Testing..." : "Test Connection"}
                      </button>
                      <button
                        onClick={handleResetFingerprintConfig}
                        className="px-5 py-3 bg-surface-container-high text-on-surface rounded-xl font-body font-medium hover:bg-surface-container transition-colors flex items-center gap-2"
                      >
                        <RotateCcw size={16} />
                        Reset Defaults
                      </button>
                      <button
                        onClick={handleSaveFingerprintConfig}
                        className="px-5 py-3 gradient-primary text-white rounded-xl font-body font-medium hover:opacity-90 transition-opacity"
                      >
                        Save Configure
                      </button>
                    </div>
                  </div>

                  <FingerprintStatusPanel status={fingerprintStatus} />
                </div>
              </section>

              <section id="webcam" className="scroll-mt-8">
                <div className="bg-surface-container-lowest rounded-xl p-6 md:p-8 transition-colors hover:bg-surface-bright editorial-shadow">
                  <div className="flex flex-col gap-2">
                    <h3 className="text-2xl font-headline font-bold text-on-surface">Configure Test Webcam</h3>
                    <p className="text-on-surface-variant font-body text-sm">
                      Use the small live preview below to confirm the video camera is working on this computer before capturing client photos.
                    </p>
                  </div>

                  <div className="mt-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)] gap-6">
                    <div className="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-on-surface">Live camera preview</p>
                          <p className="mt-1 text-xs text-on-surface-variant">Nothing is stored here. This is only for a quick device check.</p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                          isWebcamPreviewActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-surface-container-high text-on-surface-variant"
                        }`}>
                          {isWebcamPreviewActive ? "Camera Live" : "Preview Off"}
                        </span>
                      </div>

                      <div className="mt-4 overflow-hidden rounded-2xl border border-outline-variant/15 bg-black">
                        <div className="relative aspect-video">
                          <video
                            ref={webcamVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className={`h-full w-full object-cover scale-x-[-1] transition-opacity ${isWebcamPreviewActive ? "opacity-100" : "opacity-0"}`}
                          />

                          {!isWebcamPreviewActive && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-slate-200">
                              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                                {isTestingWebcam ? <Loader2 size={24} className="animate-spin" /> : <Camera size={24} />}
                              </div>
                              <div className="max-w-xs px-4">
                                <p className="text-sm font-medium">
                                  {isTestingWebcam ? "Opening camera preview..." : "Preview will appear here"}
                                </p>
                                <p className="mt-1 text-xs text-slate-300">
                                  {isTestingWebcam
                                    ? "Please allow browser camera permission if prompted."
                                    : "Start the webcam test to verify the camera feed directly on this page."}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-4">
                      <div className={`rounded-2xl border p-4 ${webcamStatusClasses}`}>
                        <p className="text-sm font-semibold">{webcamStatus.message}</p>
                        {webcamStatus.details && (
                          <p className="mt-1 text-xs opacity-80">{webcamStatus.details}</p>
                        )}
                      </div>

                      <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
                        <p className="text-sm font-medium text-on-surface">How to verify</p>
                        <p className="mt-2 text-xs leading-6 text-on-surface-variant">
                          Start Preview. If the small live video appears and the status says the camera is working, the webcam is ready for use in this browser. The preview stops automatically after 15 seconds.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={handleTestWebcam}
                          disabled={isTestingWebcam}
                          className="px-5 py-3 bg-secondary-container text-on-secondary-container rounded-xl font-body font-medium hover:opacity-90 transition-opacity disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isTestingWebcam ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                          {isTestingWebcam ? "Starting..." : isWebcamPreviewActive ? "Restart Preview" : "Start Preview"}
                        </button>

                        <button
                          onClick={handleStopWebcam}
                          disabled={!isWebcamPreviewActive && !isTestingWebcam}
                          className="px-5 py-3 bg-surface-container-high text-on-surface rounded-xl font-body font-medium hover:bg-surface-container transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          Stop Preview
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

      </main>
    </Layout>
  );
}
