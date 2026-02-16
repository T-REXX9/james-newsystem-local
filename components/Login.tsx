import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Lock, User, Eye, EyeOff, AlertCircle, CheckCircle, Loader2, Sun, Moon } from 'lucide-react';
import { parseSupabaseError } from '../utils/errorHandler';
import { useToast } from './ToastProvider';
import { logAuth } from '../services/activityLogService';
import { dispatchWorkflowNotification } from '../services/supabaseService';

export default function Login() {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'signin' | 'signup'>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success' | 'warning' | '', text: string }>({ type: '', text: '' });
  const [isDark, setIsDark] = useState(true);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: ''
  });

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const html = document.documentElement;

    if (savedTheme === 'light') {
        setIsDark(false);
        html.classList.remove('dark');
    } else {
        setIsDark(true);
        html.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    if (isDark) {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        setIsDark(false);
    } else {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        setIsDark(true);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage({ type: '', text: '' });
  };

  const getEmail = (input: string) => {
    // Map 'main' to the admin email for convenience
    if (input.trim().toLowerCase() === 'main') {
      return 'main@tnd-opc.com';
    }
    return input;
  };

  const getAuthDeviceMetadata = () => ({
    ip_address: null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    platform: typeof navigator !== 'undefined' ? navigator.platform : null,
    language: typeof navigator !== 'undefined' ? navigator.language : null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    origin: typeof window !== 'undefined' ? window.location.origin : null,
  });

  const isSuspiciousLoginError = (message: string) => {
    const normalized = message.toLowerCase();
    return (
      normalized.includes('invalid login credentials') ||
      normalized.includes('too many requests') ||
      normalized.includes('rate limit') ||
      normalized.includes('email not confirmed')
    );
  };

  const notifySuspiciousLoginSignal = async (
    attemptedEmail: string,
    status: 'failed' | 'error',
    reason: string
  ) => {
    await dispatchWorkflowNotification({
      title: 'Suspicious Login Signal',
      message: `A suspicious login signal was detected for ${attemptedEmail || 'unknown account'}.`,
      type: 'warning',
      action: 'suspicious_login_signal',
      status,
      entityType: 'auth_event',
      entityId: attemptedEmail || 'unknown',
      actionUrl: '/security/audit',
      targetRoles: ['Owner', 'Manager', 'Security'],
      includeActor: false,
      metadata: {
        actor_id: null,
        actor_email: attemptedEmail || null,
        auth_provider: 'password',
        reason,
        ...getAuthDeviceMetadata(),
      },
    });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.signUp({
      email: getEmail(formData.email),
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName,
          avatar_url: `https://i.pravatar.cc/150?u=${Math.random()}`
        }
      }
    });

    if (error) {
      setMessage({ type: 'error', text: error.message });
      addToast({
        type: 'error',
        title: 'Unable to create account',
        description: parseSupabaseError(error, 'account'),
        durationMs: 6000,
      });
    } else {
      setMessage({ 
        type: 'success', 
        text: 'Account created! You can now sign in.' 
      });
      try {
        await logAuth('SIGNUP', { email: getEmail(formData.email) });
      } catch (logError) {
        console.error('Failed to log activity:', logError);
      }
      addToast({
        type: 'success',
        title: 'Account created',
        description: 'Account created successfully. You can now sign in.',
        durationMs: 4000,
      });
      setView('signin');
    }
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    
    const attemptedEmail = getEmail(formData.email).trim().toLowerCase();

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: attemptedEmail,
        password: formData.password
      });

      if (error) {
        if (isSuspiciousLoginError(error.message)) {
          await notifySuspiciousLoginSignal(attemptedEmail, 'failed', error.message);
        }
        setMessage({ type: 'error', text: error.message });
        addToast({
          type: 'error',
          title: 'Unable to sign in',
          description: parseSupabaseError(error, 'authentication'),
          durationMs: 6000,
        });
        setLoading(false);
      } else {
        // Success: The supabase client 'onAuthStateChange' event will fire,
        // causing App.tsx to update the session state and remove this component.
        // We keep loading=true to prevent the user from interacting while the swap happens.
        try {
          await logAuth('LOGIN', { email: getEmail(formData.email) });
        } catch (logError) {
          console.error('Failed to log activity:', logError);
        }
        addToast({
          type: 'success',
          title: 'Welcome back!',
          description: 'You have signed in successfully.',
          durationMs: 4000,
        });
      }
    } catch (err: any) {
       console.error("Unexpected Login Error:", err);
       await notifySuspiciousLoginSignal(
         attemptedEmail,
         'error',
         err instanceof Error ? err.message : 'unexpected_login_error'
       );
       setMessage({ type: 'error', text: "An unexpected error occurred." });
       addToast({
         type: 'error',
         title: 'Unable to sign in',
         description: parseSupabaseError(err, 'authentication'),
         durationMs: 6000,
       });
       setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans transition-colors duration-200">
       <div className="mb-8 text-center">
           <div className="w-16 h-16 bg-brand-blue rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-900/20">
               <span className="text-2xl font-bold text-white">T</span>
           </div>
           <h1 className="text-3xl font-bold text-slate-800 dark:text-white">TND-OPC</h1>
           <p className="text-slate-500 dark:text-slate-400 mt-2">CRM & Inventory Management System</p>
       </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-card p-8 w-full max-w-md border border-slate-200 dark:border-slate-800 relative transition-colors duration-200">
        
        <button
           onClick={toggleTheme}
           className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
           title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">
            {view === 'signin' ? 'Sign In' : 'Create Account'}
          </h2>
          <p className="text-sm text-slate-400 dark:text-slate-500">
            {view === 'signin' ? 'Enter your credentials to access the dashboard' : 'Register a new sales agent account'}
          </p>
        </div>

        {message.text && (
          <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
            message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30' : 
            'bg-emerald-50 text-emerald-800 border border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/30'
          }`}>
            {message.type === 'error' ? (
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
               <p className="text-sm font-bold">{message.type === 'error' ? 'Authentication Failed' : 'Success'}</p>
               <p className="text-sm opacity-90">{message.text}</p>
            </div>
          </div>
        )}

        <form onSubmit={view === 'signin' ? handleSignIn : handleSignUp} className="space-y-4">
          {view === 'signup' && (
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all outline-none"
                  placeholder="John Doe"
                  required={view === 'signup'}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
              Email or Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all outline-none"
                placeholder={view === 'signin' ? "e.g. main" : "john@tnd-opc.com"}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full pl-10 pr-12 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all outline-none"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-blue hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-blue-900/10 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-6"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (view === 'signin' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="mt-8 text-center">
           <p className="text-sm text-slate-500 dark:text-slate-400">
             {view === 'signin' ? "Don't have an account yet?" : "Already have an account?"}
             <button 
                onClick={() => {
                    setView(view === 'signin' ? 'signup' : 'signin');
                    setMessage({ type: '', text: '' });
                    setFormData({ email: '', password: '', fullName: '' });
                }}
                className="ml-2 font-bold text-brand-blue hover:underline"
             >
                 {view === 'signin' ? 'Sign Up' : 'Sign In'}
             </button>
           </p>
        </div>
        
        {view === 'signin' && (
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-2">Admin Demo Credentials</p>
              <code className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-600 dark:text-slate-300">User: main | Pass: 123456</code>
          </div>
        )}
      </div>
    </div>
  );
}
