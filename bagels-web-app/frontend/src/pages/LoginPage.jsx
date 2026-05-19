import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Terminal, Mail, Lock, User, ArrowRight, Eye, EyeOff, Phone, DollarSign, Tag, X, ChevronDown } from 'lucide-react';
import API from '../config/api';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
];

const DEFAULT_CATEGORIES = [
  'Groceries', 'Entertainment', 'Utilities', 'Transport',
  'Food & Dining', 'Shopping', 'Subscriptions', 'Travel',
  'Healthcare', 'Education', 'Rent', 'General',
];

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [step, setStep] = useState(1); // 1 = credentials, 2 = profile setup (register only)
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [categories, setCategories] = useState([...DEFAULT_CATEGORIES]);
  const [newCategory, setNewCategory] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResetMessage('');

    if (resetMode) {
      setIsLoading(true);
      try {
        if (resetToken.trim()) {
          await API.post('/auth/reset-password', { token: resetToken.trim(), password });
          setResetMessage('Password updated. You can sign in now.');
          setResetMode(false);
          setResetToken('');
          setPassword('');
        } else {
          const { data } = await API.post('/auth/forgot-password', { email });
          setResetMessage(data.resetToken ? `Reset token: ${data.resetToken}` : data.message);
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Password reset failed');
      }
      setIsLoading(false);
      return;
    }

    if (isRegister && step === 1) {
      if (!name.trim()) { setError('Name is required'); return; }
      setStep(2);
      return;
    }

    setIsLoading(true);
    try {
      if (isRegister) {
        await register({
          name, email, password, phone,
          preferredCurrency: currency,
          spendingCategories: categories,
        });
      } else {
        await login(email, password);
      }
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Something went wrong';
      setError(msg);
    }
    setIsLoading(false);
  };

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (trimmed && !categories.includes(trimmed)) {
      setCategories([...categories, trimmed]);
    }
    setNewCategory('');
  };

  const removeCategory = (cat) => {
    setCategories(categories.filter((c) => c !== cat));
  };

  const resetToLogin = () => {
    setIsRegister(false);
    setResetMode(false);
    setStep(1);
    setError('');
    setResetMessage('');
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-fuchsia-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-3xl" />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl mb-4 backdrop-blur-sm">
            <Terminal size={32} className="text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">CASH CLAIR</h1>
          <p className="text-zinc-500 mt-2 text-sm">
            {!isRegister
              ? 'Welcome back — sign in to continue'
              : step === 1
                ? 'Create your account'
                : 'Set up your preferences'}
          </p>
        </div>

        {/* Progress indicator for registration */}
        {isRegister && (
          <div className="flex items-center gap-3 mb-6 px-4">
            <div className={`flex-1 h-1 rounded-full transition-all duration-500 ${step >= 1 ? 'bg-indigo-500' : 'bg-zinc-800'}`} />
            <div className={`flex-1 h-1 rounded-full transition-all duration-500 ${step >= 2 ? 'bg-indigo-500' : 'bg-zinc-800'}`} />
          </div>
        )}

        {/* Glass Card */}
        <div className="bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-3xl p-8 shadow-2xl shadow-black/40">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-medium animate-[fadeIn_0.3s_ease-out]">
              {error}
            </div>
          )}
          {resetMessage && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-sm font-medium break-words animate-[fadeIn_0.3s_ease-out]">
              {resetMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* ===== STEP 1: Credentials ===== */}
            {(resetMode || !isRegister || step === 1) && (
              <>
                {isRegister && !resetMode && (
                  <div className="space-y-2 animate-[fadeIn_0.3s_ease-out]">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Full Name</label>
                    <div className="relative">
                      <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-12 pr-4 py-3.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition"
                        required={isRegister}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Email</label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-12 pr-4 py-3.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition"
                      required
                    />
                  </div>
                </div>

                {resetMode && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Reset Token</label>
                    <input
                      type="text"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Paste token after requesting it"
                      className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-3.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Password</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-12 pr-12 py-3.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition"
                      required={!resetMode || Boolean(resetToken.trim())}
                      minLength={!resetMode || resetToken.trim() ? 6 : undefined}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition">
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {(isRegister || resetMode) && <p className="text-xs text-zinc-600 pl-1">{resetMode && !resetToken.trim() ? 'Request a token first, then enter a new password.' : 'Minimum 6 characters'}</p>}
                </div>
              </>
            )}

            {/* ===== STEP 2: Preferences (Register Only) ===== */}
            {isRegister && step === 2 && (
              <div className="space-y-5 animate-[fadeIn_0.3s_ease-out]">
                {/* Phone */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Phone Number <span className="text-zinc-600">(optional)</span></label>
                  <div className="relative">
                    <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 234 567 8900"
                      className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-12 pr-4 py-3.5 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition"
                    />
                  </div>
                </div>

                {/* Currency */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Preferred Currency</label>
                  <div className="relative">
                    <DollarSign size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl pl-12 pr-10 py-3.5 text-zinc-100 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>{c.symbol} {c.name} ({c.code})</option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                  </div>
                </div>

                {/* Spending Categories */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-500 uppercase tracking-widest pl-1">Spending Categories</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {categories.map((cat) => (
                      <span key={cat} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 group hover:border-red-500/30 transition">
                        <Tag size={12} className="text-indigo-400" />
                        {cat}
                        <button type="button" onClick={() => removeCategory(cat)} className="text-zinc-600 hover:text-red-400 transition">
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }}
                      placeholder="Add custom category..."
                      className="flex-1 bg-zinc-950/80 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition"
                    />
                    <button type="button" onClick={addCategory} className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm transition">
                      Add
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Submit / Next */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {resetMode ? (resetToken.trim() ? 'Reset Password' : 'Send Reset Token') : !isRegister ? 'Sign In' : step === 1 ? 'Next - Set Preferences' : 'Create Account'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>

            {/* Back button for step 2 */}
            {isRegister && step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full py-3 text-sm text-zinc-500 hover:text-zinc-300 transition"
              >
                ← Back to credentials
              </button>
            )}
          </form>

          {!isRegister && (
            <button
              type="button"
              onClick={() => { setResetMode(!resetMode); setError(''); setResetMessage(''); setResetToken(''); }}
              className="w-full mt-4 text-sm text-zinc-500 hover:text-indigo-300 transition"
            >
              {resetMode ? 'Back to sign in' : 'Forgot password?'}
            </button>
          )}

          {/* Toggle Login/Register */}
          <div className="mt-6 pt-6 border-t border-zinc-800 text-center">
            <p className="text-sm text-zinc-500">
              {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                onClick={() => { setIsRegister(!isRegister); setResetMode(false); setStep(1); setError(''); setResetMessage(''); }}
                className="text-indigo-400 hover:text-indigo-300 font-medium transition"
              >
                {isRegister ? 'Sign In' : 'Create one'}
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          CASH CLAIR Financial Suite · Secure & Encrypted
        </p>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
