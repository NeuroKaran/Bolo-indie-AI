import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Mic, Clock, Settings, Zap } from 'lucide-react';
import FloatingBar from './components/FloatingBar';
import HistoryPanel from './components/HistoryPanel';
import SettingsPanel from './components/SettingsPanel';
import PromptCard from './components/PromptCard';
import Onboarding from './components/Onboarding';
import AuthPage from './components/AuthPage';
import AdminDashboard from './components/AdminDashboard';
import Toast, { createToast } from './components/Toast';
import { copyPromptToClipboard } from './services/clipboardService';
import {
  getPromptHistory,
  savePrompt,
  deletePrompt,
  updatePrompt,
  toggleFavorite,
  getSettings,
  isOnboardingComplete,
} from './services/storageService';
import { onAuthStateChange, signOut, getCurrentUser, getUserProfile, ensureProfile } from './services/authService';

export default function App() {
  const [view, setView] = useState('home'); // home | history | settings | admin
  const [isBarOpen, setIsBarOpen] = useState(false);
  const [prompts, setPrompts] = useState([]);
  const favorites = useMemo(() => prompts.filter(p => p.isFavorite).map(p => p.promptId), [prompts]);
  const [toasts, setToasts] = useState([]);
  const [latestPrompt, setLatestPrompt] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(!isOnboardingComplete());
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAdmin, setShowAdmin] = useState(false);
  const floatingBarRef = useRef(null);

  // Auth state listener
  useEffect(() => {
    const subscription = onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        // Ensure profile exists (creates on first login/signup)
        await ensureProfile(session.user);
        // Load data
        const history = await getPromptHistory(session.user.id);
        setPrompts(history);

        if (!isOnboardingComplete()) {
          setShowOnboarding(true);
        }
      } else {
        setUser(null);
        setPrompts([]);
      }
      setAuthLoading(false);
    });

    // Also check current session on mount
    getCurrentUser().then(u => {
      if (u) setUser(u);
      setAuthLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  // Secret admin dashboard: Ctrl+Shift+A
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyA') {
        e.preventDefault();
        setShowAdmin(prev => !prev);
        if (!showAdmin) setView('admin');
        else setView('home');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAdmin]);

  // Hotkey: Ctrl+Space to record / Escape to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        if (!showOnboarding && user) {
          if (isBarOpen) {
            if (floatingBarRef.current) {
              floatingBarRef.current.stopRecording();
            }
          } else {
            setIsBarOpen(true);
          }
        }
      }
      if (e.key === 'Escape' && isBarOpen) {
        setIsBarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBarOpen, showOnboarding, user]);

  // Toast helper
  const showToast = useCallback((message, type = 'success') => {
    setToasts(prev => [...prev, createToast(message, type)]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Handle new prompt from FloatingBar
  const handlePromptReady = useCallback(async (promptData) => {
    if (!user) return;

    const history = await savePrompt(user.id, promptData);
    setPrompts(history);
    // Set latest to the first item (newest)
    if (history.length > 0) {
      setLatestPrompt(history[0]);
    }
    setView('home');

    // Auto-copy if enabled
    const settings = getSettings();
    if (settings.autoCopy) {
      const promptToCopy = history[0] || promptData;
      const success = await copyPromptToClipboard(promptToCopy);
      if (success) showToast('Prompt copied to clipboard! 📋');
    }
  }, [user, showToast]);

  // Handle favorite toggle
  const handleFavorite = useCallback(async (promptId) => {
    if (!user) return;
    const history = await toggleFavorite(user.id, promptId);
    setPrompts(history);
  }, [user]);

  // Handle delete
  const handleDelete = useCallback(async (promptId) => {
    if (!user) return;
    const history = await deletePrompt(user.id, promptId);
    setPrompts(history);
    if (latestPrompt?.promptId === promptId) {
      setLatestPrompt(null);
    }
    showToast('Prompt deleted');
  }, [user, latestPrompt, showToast]);

  // Handle prompt update (editing)
  const handleUpdate = useCallback(async (promptId, updates) => {
    if (!user) return;
    const history = await updatePrompt(user.id, promptId, updates);
    setPrompts(history);
    if (latestPrompt?.promptId === promptId) {
      setLatestPrompt(prev => ({ ...prev, ...updates }));
    }
    showToast('Prompt updated ✓');
  }, [user, latestPrompt, showToast]);

  // Handle copy
  const handleCopy = useCallback(() => {
    showToast('Copied to clipboard! 📋');
  }, [showToast]);

  // Refresh data
  const handleRefresh = useCallback(async () => {
    if (!user) return;
    const history = await getPromptHistory(user.id);
    setPrompts(history);
  }, [user]);

  // Onboarding complete
  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    showToast('Welcome to Bolo! 🎉 Press Ctrl+Space to start.', 'success');
  }, [showToast]);

  // Sign out
  const handleSignOut = useCallback(async () => {
    await signOut();
    setUser(null);
    setPrompts([]);
    setLatestPrompt(null);
    setView('home');
    showToast('Signed out successfully');
  }, [showToast]);

  // Auth success callback
  const handleAuthSuccess = useCallback(() => {
    // Auth state change listener will handle the rest
  }, []);

  // Loading state
  if (authLoading) {
    return (
      <div className="app-loading">
        <img src="/Bolo-logo.png" alt="Bolo" style={{ height: 60 }} />
        <div className="spinner" />
      </div>
    );
  }

  // Show onboarding if needed (before login)
  if (showOnboarding) {
    return (
      <>
        <Onboarding
          onComplete={handleOnboardingComplete}
          userName={user?.user_metadata?.display_name || user?.email?.split('@')[0]}
        />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // Not authenticated — show auth page
  if (!user) {
    return (
      <>
        <AuthPage onAuthSuccess={handleAuthSuccess} />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  // Admin dashboard (hidden)
  if (view === 'admin' && showAdmin) {
    return (
      <>
        <AdminDashboard onBack={() => { setView('home'); setShowAdmin(false); }} />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="app-logo" onClick={() => setView('home')} style={{ cursor: 'pointer' }}>
          <img src="/Bolo-logo.png" alt="Bolo" className="app-logo-img" />
        </div>

        <nav className="header-nav">
          <button
            className={`nav-btn ${view === 'home' ? 'active' : ''}`}
            onClick={() => setView('home')}
          >
            <Mic size={16} /> Record
          </button>
          <button
            className={`nav-btn ${view === 'history' ? 'active' : ''}`}
            onClick={() => setView('history')}
          >
            <Clock size={16} /> History
          </button>
          <button
            className={`nav-btn ${view === 'settings' ? 'active' : ''}`}
            onClick={() => setView('settings')}
          >
            <Settings size={16} /> Settings
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {view === 'home' && (
          <>
            {/* Hero Section */}
            {!latestPrompt && (
              <section className="hero-section">
                <span className="hero-badge">
                  <Zap size={12} /> Voice-Native AI Bridge
                </span>
                <h1 className="hero-title">
                  Dictate in <span className="highlight">Hinglish</span>,<br />
                  get developer prompts <span className="highlight">instantly</span>
                </h1>
                <p className="hero-subtitle">
                  Speak your ideas in any Indian language. Bolo transforms your voice
                  into structured, agent-ready prompts for AI coding assistants.
                </p>
                <div className="hero-cta">
                  <button
                    className="btn btn-primary btn-lg"
                    onClick={() => setIsBarOpen(true)}
                  >
                    <Mic size={20} /> Start Recording
                  </button>
                </div>
                <div className="hero-shortcut">
                  or press <span className="kbd">Ctrl</span> + <span className="kbd">Space</span>
                </div>
              </section>
            )}

            {/* Latest Prompt */}
            {latestPrompt && (
              <div style={{ marginBottom: 32 }}>
                <div className="section-header">
                  <h2 className="section-title">✨ Latest Prompt</h2>
                  <button
                    className="btn btn-primary"
                    onClick={() => setIsBarOpen(true)}
                  >
                    <Mic size={16} /> New Recording
                  </button>
                </div>
                <div style={{ marginTop: 16 }}>
                  <PromptCard
                    prompt={latestPrompt}
                    onCopy={handleCopy}
                    onFavorite={handleFavorite}
                    onDelete={handleDelete}
                    onUpdate={handleUpdate}
                    isFavorite={favorites.includes(latestPrompt.promptId)}
                  />
                </div>
              </div>
            )}

            {/* Danda Divider */}
            {(latestPrompt || prompts.length > 0) && (
              <div className="danda-divider" aria-hidden="true">॥</div>
            )}

            {/* Recent History */}
            {prompts.length > 0 && (
              <HistoryPanel
                prompts={prompts}
                favorites={favorites}
                onCopy={handleCopy}
                onFavorite={handleFavorite}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
                onRefresh={handleRefresh}
                onToast={showToast}
                userId={user?.id}
              />
            )}
          </>
        )}

        {view === 'history' && (
          <HistoryPanel
            prompts={prompts}
            favorites={favorites}
            onCopy={handleCopy}
            onFavorite={handleFavorite}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            onRefresh={handleRefresh}
            onToast={showToast}
            userId={user?.id}
          />
        )}

        {view === 'settings' && (
          <SettingsPanel
            onToast={showToast}
            onSettingsChange={() => { }}
            user={user}
            onSignOut={handleSignOut}
          />
        )}
      </main>

      {/* Floating Record Bar */}
      <FloatingBar
        ref={floatingBarRef}
        isOpen={isBarOpen}
        onClose={() => setIsBarOpen(false)}
        onPromptReady={handlePromptReady}
        onToast={showToast}
      />

      {/* Toasts */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
