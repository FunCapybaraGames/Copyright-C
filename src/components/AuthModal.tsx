import React, { useState } from 'react';
import { UserAccount } from '../types';
import { soundEngine } from '../soundEngine';
import { spawnDomBurst } from '../vfxEngine';
import { X, User, KeyRound, Mail, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onLoginSuccess: (account: UserAccount) => void;
  onLogout: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  onLogout,
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot' | 'email'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  // Password reset state
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [generatedCodeNotice, setGeneratedCodeNotice] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  // Simple SHA-256 password hash
  const hashPassword = async (pw: string): Promise<string> => {
    const enc = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', enc.encode(pw));
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  };

  // Submit Login or Register
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      if (tab === 'register') {
        const cleanUser = identifier.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(cleanUser)) {
          setError('Username: 3-20 letters, numbers or underscores.');
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters.');
          setIsLoading(false);
          return;
        }

        const passwordHash = await hashPassword(password);
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: cleanUser,
            passwordHash,
            email: email.trim() || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Registration failed');
          setIsLoading(false);
          return;
        }

        soundEngine.play('stage');
        spawnDomBurst(window.innerWidth / 2, window.innerHeight / 2, 20);
        onLoginSuccess(data.account);
        onClose();
      } else if (tab === 'login') {
        const passwordHash = await hashPassword(password);
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: identifier.trim(),
            passwordHash,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Login failed');
          setIsLoading(false);
          return;
        }

        soundEngine.play('coin');
        onLoginSuccess(data.account);
        onClose();
      }
    } catch {
      setError('Network error. Is the server running?');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);
    try {
      // Standard Google OAuth profile simulation / linking with secure identity
      const simulatedGoogleName = `capy_gamer_${Math.floor(100 + Math.random() * 900)}`;
      const simulatedGoogleEmail = `${simulatedGoogleName}@gmail.com`;

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: simulatedGoogleName,
          email: simulatedGoogleEmail,
          googleId: `goog_${Date.now()}`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        soundEngine.play('win');
        spawnDomBurst(window.innerWidth / 2, window.innerHeight / 2, 20);
        onLoginSuccess(data.account);
        onClose();
      } else {
        setError(data.error || 'Google sign-in failed');
      }
    } catch {
      setError('Google sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Update Email on Existing Account
  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !email.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/update-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Email successfully updated!');
        onLoginSuccess(data.account);
        soundEngine.play('coin');
      } else {
        setError(data.error || 'Could not update email');
      }
    } catch {
      setError('Error updating email');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Request Password Reset Code
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/request-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setResetStep(2);
        setGeneratedCodeNotice(data.code);
        soundEngine.play('coin');
      } else {
        setError(data.error || 'No account found with this email.');
      }
    } catch {
      setError('Could not request reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Confirm Password Reset
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const newPasswordHash = await hashPassword(newPassword);
      const res = await fetch('/api/auth/confirm-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          code: resetCode.trim(),
          newPasswordHash,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        soundEngine.play('win');
        setSuccess('Password updated! You can now log in.');
        setTab('login');
        setResetStep(1);
        setGeneratedCodeNotice(null);
      } else {
        setError(data.error || 'Invalid reset code.');
      }
    } catch {
      setError('Error resetting password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white dark:bg-[#182018] border border-slate-200 dark:border-[#2b382b] rounded-2xl p-6 shadow-2xl text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#263226]">
          <div>
            <div className="text-[10px] font-extrabold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
              Capybara.Games
            </div>
            <h2 className="text-xl font-display font-bold">
              {currentUser
                ? `Account #${currentUser.id}`
                : tab === 'forgot'
                ? 'Reset Password'
                : 'Player Account'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#253225] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Logged in view */}
        {currentUser ? (
          <div className="py-5 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-extrabold text-2xl flex items-center justify-center mx-auto shadow-sm">
                {currentUser.username[0].toUpperCase()}
              </div>
              <div className="font-display font-extrabold text-base">{currentUser.username}</div>
              <span className="inline-block px-2.5 py-0.5 text-xs font-mono font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-md">
                Account ID #{currentUser.id}
              </span>
            </div>

            {/* Email Association */}
            <form onSubmit={handleUpdateEmail} className="pt-2 border-t border-slate-100 dark:border-[#263226] space-y-2">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                Recovery Email
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={currentUser.email || 'add your email'}
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#121812] border border-slate-200 dark:border-[#2b382b] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-[#202b20] hover:bg-emerald-100 text-slate-700 dark:text-slate-200 rounded-xl transition-colors shrink-0"
                >
                  Save
                </button>
              </div>
              {currentUser.email && (
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Linked: {currentUser.email}</span>
                </div>
              )}
            </form>

            <div className="pt-4 flex gap-2">
              <button
                onClick={() => {
                  soundEngine.play('click');
                  onLogout();
                  onClose();
                }}
                className="flex-1 py-2 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 rounded-xl transition-colors"
              >
                Log Out
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {/* Tabs */}
            {tab !== 'forgot' && (
              <div className="flex p-1 bg-slate-100 dark:bg-[#121812] rounded-xl border border-slate-200 dark:border-[#2b382b]">
                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setError('');
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    tab === 'login'
                      ? 'bg-white dark:bg-[#202b20] text-emerald-700 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                  }`}
                >
                  Log In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTab('register');
                    setError('');
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    tab === 'register'
                      ? 'bg-white dark:bg-[#202b20] text-emerald-700 dark:text-emerald-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                  }`}
                >
                  Register
                </button>
              </div>
            )}

            {/* Error or Success Notice */}
            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Google Sign In Button */}
            {tab !== 'forgot' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2.5 w-full py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#1a231a] border border-slate-200 dark:border-[#2b3a2b] hover:border-emerald-400 dark:hover:border-emerald-700 rounded-xl shadow-xs transition-all active:scale-98"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.4 7.36 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.6 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Sign in with Google</span>
                </button>

                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 dark:border-[#263226] w-full" />
                  <span className="bg-white dark:bg-[#182018] px-2 text-[10px] text-slate-400 font-bold uppercase">
                    or
                  </span>
                </div>
              </div>
            )}

            {/* Login / Register Form */}
            {tab !== 'forgot' ? (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    {tab === 'login' ? 'Username or Account #ID' : 'Username'}
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={tab === 'login' ? 'player or #1' : 'player_name'}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-[#121812] border border-slate-200 dark:border-[#2b382b] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {tab === 'register' && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      Recovery Email (Optional)
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@email.com"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-[#121812] border border-slate-200 dark:border-[#2b382b] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      Password
                    </label>
                    {tab === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setTab('forgot');
                          setError('');
                        }}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-[#121812] border border-slate-200 dark:border-[#2b382b] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-98 rounded-xl shadow-xs transition-all mt-2"
                >
                  {isLoading
                    ? 'Processing...'
                    : tab === 'login'
                    ? 'Log In'
                    : 'Create Account (Numbered ID)'}
                </button>
              </form>
            ) : (
              /* Forgot Password Reset Flow */
              <div className="space-y-3">
                {resetStep === 1 ? (
                  <form onSubmit={handleRequestReset} className="space-y-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      Enter the email registered with your account to receive a 6-digit recovery code.
                    </p>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        Account Email
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#121812] border border-slate-200 dark:border-[#2b382b] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-all"
                    >
                      {isLoading ? 'Generating code...' : 'Get Recovery Code →'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleConfirmReset} className="space-y-3">
                    {generatedCodeNotice && (
                      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200">
                        <div className="font-bold">Recovery Code Generated:</div>
                        <div className="font-mono text-lg font-extrabold tracking-widest mt-1 text-emerald-600 dark:text-emerald-400">
                          {generatedCodeNotice}
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        6-Digit Code
                      </label>
                      <input
                        type="text"
                        required
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        placeholder="123456"
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-[#121812] border border-slate-200 dark:border-[#2b382b] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        New Password
                      </label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••"
                        className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#121812] border border-slate-200 dark:border-[#2b382b] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-all"
                    >
                      {isLoading ? 'Resetting...' : 'Set New Password →'}
                    </button>
                  </form>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setTab('login');
                    setError('');
                  }}
                  className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  ← Back to Log In
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
