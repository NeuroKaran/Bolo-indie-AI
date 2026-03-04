import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Mic, Clock, Settings, Zap } from 'lucide-react';
import FloatingBar from './components/FloatingBar';
import HistoryPanel from './components/HistoryPanel';
import SettingsPanel from './components/SettingsPanel';
import PromptCard from './components/PromptCard';
import Toast, { createToast } from './components/Toast';
import { copyPromptToClipboard } from './services/clipboardService';
import {
  getPromptHistory,
  savePrompt,
  deletePrompt,
  getFavorites,
  toggleFavorite,
  getSettings,
} from './services/storageService';

export default function App() {
  const [view, setView] = useState('home'); // home | history | settings
  const [isBarOpen, setIsBarOpen] = useState(false);
  const [prompts, setPrompts] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [latestPrompt, setLatestPrompt] = useState(null);

  // Load data on mount
  useEffect(() => {
    setPrompts(getPromptHistory());
    setFavorites(getFavorites());
  }, []);

  // Global hotkey: Ctrl+Space
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        setIsBarOpen(true);
      }
      if (e.key === 'Escape' && isBarOpen) {
        setIsBarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBarOpen]);

  // Toast helper
  const showToast = useCallback((message, type = 'success') => {
    setToasts(prev => [...prev, createToast(message, type)]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Handle new prompt from FloatingBar
  const handlePromptReady = useCallback((promptData) => {
    const prompt = {
      ...promptData,
      promptId: uuidv4(),
      createdAt: new Date().toISOString(),
    };

    const history = savePrompt(prompt);
    setPrompts(history);
    setLatestPrompt(prompt);
    setView('home');

    // Auto-copy if enabled
    const settings = getSettings();
    if (settings.autoCopy) {
      copyPromptToClipboard(prompt).then(success => {
        if (success) showToast('Prompt copied to clipboard! 📋');
      });
    }
  }, [showToast]);

  // Handle favorite toggle
  const handleFavorite = useCallback((promptId) => {
    const updated = toggleFavorite(promptId);
    setFavorites(updated);
  }, []);

  // Handle delete
  const handleDelete = useCallback((promptId) => {
    const updated = deletePrompt(promptId);
    setPrompts(updated);
    if (latestPrompt?.promptId === promptId) {
      setLatestPrompt(null);
    }
    showToast('Prompt deleted');
  }, [latestPrompt, showToast]);

  // Handle copy
  const handleCopy = useCallback(() => {
    showToast('Copied to clipboard! 📋');
  }, [showToast]);

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
                    isFavorite={favorites.includes(latestPrompt.promptId)}
                  />
                </div>
              </div>
            )}

            {/* Danda Divider — Devanagari-inspired */}
            {(latestPrompt || prompts.length > 0) && (
              <div className="danda-divider" aria-hidden="true">॥</div>
            )}

            {/* Recent History (compact) */}
            {prompts.length > 0 && (
              <HistoryPanel
                prompts={prompts}
                favorites={favorites}
                onCopy={handleCopy}
                onFavorite={handleFavorite}
                onDelete={handleDelete}
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
          />
        )}

        {view === 'settings' && (
          <SettingsPanel
            onToast={showToast}
            onSettingsChange={() => { }}
          />
        )}
      </main>

      {/* Floating Record Bar */}
      <FloatingBar
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

