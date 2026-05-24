import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./firebaseAuth";
import { Loader2 } from "lucide-react";
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
