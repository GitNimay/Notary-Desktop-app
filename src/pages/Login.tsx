import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { auth } from '../firebaseAuth';
import { APP_NAME, BrandMark } from '../components/BrandLockup';
import { publicAssetPath } from '../lib/assets';

const SHELBY_LOGO_SRC = publicAssetPath('shelby-logo.png');

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else {
        setError(err.message || 'Failed to log in. Check your credentials.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-container px-4 py-6 sm:px-6">
      <div className="w-full max-w-[528px] rounded-lg border border-outline-variant/70 bg-surface-container-lowest px-8 py-12 shadow-[0_16px_48px_-32px_rgb(10_10_10_/_0.7)] sm:px-10 sm:py-16">
        <div className="mb-10 flex items-center justify-center gap-3 text-center">
          <BrandMark className="h-12 w-12 rounded-none bg-transparent ring-0 shadow-none" />
          <h1 className="font-body text-2xl font-bold text-on-surface sm:text-3xl">
            {APP_NAME}
          </h1>
        </div>

        <form className="space-y-5" onSubmit={handleLogin}>
          <div>
            <label className="sr-only" htmlFor="login-email">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 w-full rounded-lg border border-outline-variant bg-surface px-4 font-body text-base text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Enter your secure email"
            />
          </div>

          <div>
            <label className="sr-only" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 w-full rounded-lg border border-outline-variant bg-surface px-4 font-body text-base text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              placeholder="Enter your password"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-error/20 bg-error/10 px-4 py-3 font-body text-sm text-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-8 flex h-14 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-label text-base font-bold text-primary-foreground transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading && <Loader2 size={18} className="animate-spin" />}
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>

        {/* Footer branding */}
        <div className="mt-8 flex flex-col items-center gap-0.5 opacity-80">
          <span className="font-body text-xs text-on-surface-variant tracking-wide">Created &amp; managed by</span>
          <img src={SHELBY_LOGO_SRC} alt="Shelby" className="h-12 -mt-2 object-contain" />
        </div>
    </div>
  );
}
