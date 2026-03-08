import { useState } from 'react';
import { Mail, Lock, User, LogIn, UserPlus, Sparkles } from 'lucide-react';
import { signUp, signIn, signInWithGoogle } from '../services/authService';

/**
 * AuthPage — Beautiful login/signup with Indian-heritage aesthetic
 */
export default function AuthPage({ onAuthSuccess }) {
    const [mode, setMode] = useState('login'); // 'login' | 'signup'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (mode === 'signup') {
                const data = await signUp(email, password, name);
                if (data.user && !data.user.confirmed_at) {
                    setError('Check your email to confirm your account!');
                    setLoading(false);
                    return;
                }
            } else {
                await signIn(email, password);
            }
            onAuthSuccess?.();
        } catch (err) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');
        try {
            await signInWithGoogle();
        } catch (err) {
            setError(err.message || 'Google login failed');
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                {/* Logo & Header */}
                <div className="auth-header">
                    <img src="/Bolo-logo.png" alt="Bolo" className="auth-logo" />
                    <h1 className="auth-title">
                        {mode === 'login' ? 'Welcome back' : 'Join बोलो'}
                    </h1>
                    <p className="auth-subtitle">
                        {mode === 'login'
                            ? 'Sign in to continue dictating in your language'
                            : 'Start converting your voice into developer prompts'}
                    </p>
                </div>

                {/* Google OAuth */}
                <button className="auth-google-btn" onClick={handleGoogleLogin} type="button">
                    <svg width="18" height="18" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                </button>

                <div className="auth-divider">
                    <span>or</span>
                </div>

                {/* Email/Password Form */}
                <form onSubmit={handleSubmit} className="auth-form">
                    {mode === 'signup' && (
                        <div className="auth-field">
                            <User size={16} className="auth-field-icon" />
                            <input
                                type="text"
                                placeholder="Your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="auth-input"
                                autoComplete="name"
                            />
                        </div>
                    )}

                    <div className="auth-field">
                        <Mail size={16} className="auth-field-icon" />
                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="auth-input"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="auth-field">
                        <Lock size={16} className="auth-field-icon" />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="auth-input"
                            required
                            minLength={6}
                            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        />
                    </div>

                    {error && (
                        <div className="auth-error">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg auth-submit"
                        disabled={loading}
                    >
                        {loading ? (
                            <div className="spinner" style={{ width: 20, height: 20 }} />
                        ) : mode === 'login' ? (
                            <><LogIn size={18} /> Sign In</>
                        ) : (
                            <><Sparkles size={18} /> Create Account</>
                        )}
                    </button>
                </form>

                {/* Toggle */}
                <div className="auth-toggle">
                    {mode === 'login' ? (
                        <p>
                            Don't have an account?{' '}
                            <button className="auth-toggle-btn" onClick={() => { setMode('signup'); setError(''); }}>
                                Sign up
                            </button>
                        </p>
                    ) : (
                        <p>
                            Already have an account?{' '}
                            <button className="auth-toggle-btn" onClick={() => { setMode('login'); setError(''); }}>
                                Sign in
                            </button>
                        </p>
                    )}
                </div>

                {/* Free tier badge */}
                <div className="auth-badge">
                    <Sparkles size={12} />
                    50 free prompts — no credit card required
                </div>
            </div>
        </div>
    );
}
