import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./firebaseAuth";
import { Loader2, RefreshCw } from "lucide-react";
import { BrandLockup } from "./components/BrandLockup";
import { AdminPanel } from './pages/AdminPanel'; // Adjust path if necessary


const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const Documents = lazy(() => import("./pages/Documents").then((module) => ({ default: module.Documents })));
const Settings = lazy(() => import("./pages/Settings").then((module) => ({ default: module.Settings })));
const GiftDeedEditor = lazy(() =>
  import("./pages/GiftDeedEditor").then((module) => ({ default: module.GiftDeedEditor })),
);
const Clients = lazy(() => import("./pages/Clients").then((module) => ({ default: module.Clients })));
const Login = lazy(() => import("./pages/Login").then((module) => ({ default: module.Login })));

function AppLoader({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center text-primary">
      <BrandLockup
        className="flex-col gap-4 text-center"
        markClassName="h-20 w-20 shadow-[0_18px_50px_-28px_rgba(249,115,22,0.9)]"
        textClassName="text-3xl"
        subtitle={label}
        subtitleClassName="mt-2 tracking-[0.24em]"
      />
      <Loader2 size={24} className="mt-6 animate-spin text-on-surface-variant" />
    </div>
  );
}

type DownloadedUpdate = {
  version?: string;
  releaseDate?: string;
};

function UpdateReadyPrompt() {
  const [update, setUpdate] = useState<DownloadedUpdate | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    window.notaryDesktop?.getDownloadedUpdate?.().then((downloadedUpdate) => {
      if (isMounted && downloadedUpdate) {
        setUpdate(downloadedUpdate);
      }
    });

    const unsubscribe = window.notaryDesktop?.onUpdateDownloaded?.((downloadedUpdate) => {
      setUpdate(downloadedUpdate);
    });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  const restartApp = async () => {
    setIsRestarting(true);

    try {
      const result = await window.notaryDesktop?.restartAndInstallUpdate?.();
      if (!result?.ok) {
        setIsRestarting(false);
        alert(result?.message || "The update is not ready yet. Please try again in a moment.");
      }
    } catch (error) {
      console.error("Failed to restart and install update:", error);
      setIsRestarting(false);
      alert("Could not restart the app for the update. Please close and open NotaryXpert again.");
    }
  };

  if (!update) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[12000] w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-4 text-on-surface shadow-2xl no-print">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <RefreshCw size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-headline text-base font-bold">App updated</h2>
          <p className="mt-1 text-sm leading-5 text-on-surface-variant">
            NotaryXpert has been updated{update.version ? ` to v${update.version}` : ""}. Restart the app to continue.
          </p>
          <button
            type="button"
            onClick={restartApp}
            disabled={isRestarting}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-body text-xs font-bold uppercase tracking-[0.14em] text-on-primary transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isRestarting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {isRestarting ? "Restarting..." : "Restart app"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <AppLoader label="Loading Secure Portal" />;
  }

  return (
    <Router>
      <UpdateReadyPrompt />
      <Suspense fallback={<AppLoader label="Preparing Workspace" />}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

          {/* Protected Routes */}
          <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" replace />} />
          <Route path="/documents" element={user ? <Documents /> : <Navigate to="/login" replace />} />
          <Route path="/documents/new" element={user ? <GiftDeedEditor /> : <Navigate to="/login" replace />} />
          <Route path="/clients" element={user ? <Clients /> : <Navigate to="/login" replace />} />
          <Route path="/settings" element={user ? <Settings /> : <Navigate to="/login" replace />} />

          <Route path="/admin/secure/admin" element={user ? <AdminPanel /> : <Navigate to="/login" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
