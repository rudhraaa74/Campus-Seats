// ─────────────────────────────────────────────────────────────
// frontend/src/pages/VerifyEmail.jsx
// 6-digit OTP verification screen with countdown and resend cooldown
// ─────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Mail, ShieldCheck, KeyRound, RotateCw, ArrowRight, AlertCircle, CheckCircle2, Clock, Sparkles } from 'lucide-react';

export function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, verifyOtp, resendOtp } = useAuth();

  const initialEmail = location.state?.email || user?.email || '';
  const initialDemoOtp = location.state?.demo_otp || '';

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(initialDemoOtp);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [demoCode, setDemoCode] = useState(initialDemoOtp);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('Please enter a valid 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOtp(email, cleanOtp);
      setSuccessMsg(res.message || 'Email verified successfully!');
      setTimeout(() => {
        navigate('/events', { replace: true });
      }, 1200);
    } catch (err) {
      setError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setError(null);
    setSuccessMsg(null);
    setResending(true);

    try {
      const res = await resendOtp(email);
      setSuccessMsg(res.message || 'A new code has been sent to your email.');
      setCooldown(60); // 60s cooldown
      if (res.demo_otp) {
        setDemoCode(res.demo_otp);
      }
    } catch (err) {
      setError(err.message || 'Failed to resend code.');
      if (err.waitSeconds) {
        setCooldown(err.waitSeconds);
      }
    } finally {
      setResending(false);
    }
  };

  const handleAutoFillDemo = () => {
    if (demoCode) {
      setOtp(demoCode);
      setError(null);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <div className="text-center">
          <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-4 shadow-sm">
            <Mail className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Verify your email
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            We sent a 6-digit verification code to
          </p>
          <div className="mt-1 font-semibold text-sm text-slate-900 bg-slate-50 py-1 px-3 rounded-lg inline-block border border-slate-200">
            {email || 'your email address'}
          </div>
        </div>

        {/* Demo Helper Banner if demo code available */}
        {demoCode && (
          <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>
                <strong>Demo Mode:</strong> Code is <span className="font-mono font-bold tracking-widest text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">{demoCode}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={handleAutoFillDemo}
              className="text-xs font-semibold text-amber-700 hover:text-amber-900 underline ml-2"
            >
              Fill code
            </button>
          </div>
        )}

        {/* Status Messages */}
        {error && (
          <div className="rounded-lg bg-rose-50 p-3.5 border border-rose-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-rose-700 font-medium">{error}</div>
          </div>
        )}

        {successMsg && (
          <div className="rounded-lg bg-emerald-50 p-3.5 border border-emerald-200 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-700 font-medium">{successMsg}</div>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          {!initialEmail && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@campus.ac.in"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 text-center">
              Enter 6-Digit Code
            </label>
            <input
              type="text"
              required
              maxLength={6}
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="••••••"
              className="w-full tracking-[0.5em] text-center font-mono font-bold text-2xl py-3 border border-slate-300 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-slate-50/50"
            />
            <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              <span>Valid for 10 minutes</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            {loading ? 'Verifying...' : 'Verify & Continue'}
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span>Didn't receive the email?</span>
          <button
            type="button"
            onClick={handleResend}
            disabled={cooldown > 0 || resending}
            className="font-semibold text-emerald-600 hover:text-emerald-700 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <RotateCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
          </button>
        </div>

        <div className="text-center">
          <Link
            to="/events"
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            Skip for now (browse events)
          </Link>
        </div>
      </div>
    </div>
  );
}
