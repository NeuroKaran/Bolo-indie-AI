import { useState } from 'react';
import { Mic, Brain, Globe, ChevronRight, ChevronLeft, Sparkles, ExternalLink } from 'lucide-react';
import { saveSettings, getSettings, completeOnboarding } from '../services/storageService';
import { SUPPORTED_LANGUAGES } from '../services/sttService';

const STEPS = [
    { id: 'welcome', title: 'Welcome' },
    { id: 'sarvam', title: 'Speech-to-Text' },
    { id: 'gemini', title: 'Prompt AI' },
    { id: 'language', title: 'Language' },
    { id: 'ready', title: 'Ready!' },
];

export default function Onboarding({ onComplete }) {
    const [step, setStep] = useState(0);
    const [settings, setSettings] = useState(getSettings);

    const update = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const next = () => {
        if (step < STEPS.length - 1) setStep(s => s + 1);
    };

    const prev = () => {
        if (step > 0) setStep(s => s - 1);
    };

    const finish = () => {
        saveSettings(settings);
        completeOnboarding();
        onComplete();
    };

    const canProceed = () => {
        if (step === 1) return settings.sarvamApiKey?.length > 0;
        return true;
    };

    return (
        <div className="onboarding-overlay">
            <div className="onboarding-card">
                {/* Progress */}
                <div className="onboarding-progress">
                    {STEPS.map((s, i) => (
                        <div
                            key={s.id}
                            className={`onboarding-step-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
                        />
                    ))}
                </div>

                {/* Step Content */}
                <div className="onboarding-content">
                    {step === 0 && (
                        <div className="onboarding-step">
                            <div className="onboarding-icon">
                                <img src="/Bolo-logo.png" alt="Bolo" style={{ height: 80, objectFit: 'contain' }} />
                            </div>
                            <h2 className="onboarding-title">Welcome to बोलो</h2>
                            <p className="onboarding-desc">
                                Speak your ideas in <strong>Hinglish</strong> or any Indian language.
                                Get structured, developer-grade prompts <strong>instantly</strong>.
                            </p>
                            <p className="onboarding-desc" style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                                Let's set up your API keys in 2 quick steps.
                            </p>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="onboarding-step">
                            <div className="onboarding-icon-circle">
                                <Mic size={28} />
                            </div>
                            <h2 className="onboarding-title">Speech-to-Text</h2>
                            <p className="onboarding-desc">
                                Bolo uses <strong>Sarvam AI</strong> — India's best speech recognition, supporting
                                22 Indian languages with code-mixing.
                            </p>
                            <div className="onboarding-input-group">
                                <label className="onboarding-label">Sarvam AI API Key</label>
                                <input
                                    type="password"
                                    className="onboarding-input"
                                    placeholder="Paste your API key here..."
                                    value={settings.sarvamApiKey}
                                    onChange={e => update('sarvamApiKey', e.target.value)}
                                    autoFocus
                                />
                                <a
                                    href="https://dashboard.sarvam.ai"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="onboarding-link"
                                >
                                    Get your free API key <ExternalLink size={12} />
                                </a>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="onboarding-step">
                            <div className="onboarding-icon-circle">
                                <Brain size={28} />
                            </div>
                            <h2 className="onboarding-title">Prompt Structuring</h2>
                            <p className="onboarding-desc">
                                <strong>Gemini 2.5 Flash</strong> transforms your messy speech transcripts
                                into clean, structured developer prompts.
                            </p>
                            <div className="onboarding-input-group">
                                <label className="onboarding-label">Google AI Studio API Key</label>
                                <input
                                    type="password"
                                    className="onboarding-input"
                                    placeholder="Paste your API key here..."
                                    value={settings.geminiApiKey}
                                    onChange={e => update('geminiApiKey', e.target.value)}
                                    autoFocus
                                />
                                <a
                                    href="https://aistudio.google.com/apikey"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="onboarding-link"
                                >
                                    Get your free API key <ExternalLink size={12} />
                                </a>
                            </div>
                            <p className="onboarding-optional">(Optional — prompts will still work without it)</p>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="onboarding-step">
                            <div className="onboarding-icon-circle">
                                <Globe size={28} />
                            </div>
                            <h2 className="onboarding-title">Preferred Language</h2>
                            <p className="onboarding-desc">
                                Which language do you mostly speak? Bolo can also auto-detect.
                            </p>
                            <div className="onboarding-lang-grid">
                                {SUPPORTED_LANGUAGES.map(lang => (
                                    <button
                                        key={lang.code}
                                        className={`onboarding-lang-btn ${settings.language === lang.code ? 'active' : ''}`}
                                        onClick={() => update('language', lang.code)}
                                    >
                                        <span className="onboarding-lang-label">{lang.label}</span>
                                        {lang.labelHi && <span className="onboarding-lang-native">{lang.labelHi}</span>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="onboarding-step">
                            <div className="onboarding-icon-circle ready">
                                <Sparkles size={28} />
                            </div>
                            <h2 className="onboarding-title">You're all set! 🎉</h2>
                            <p className="onboarding-desc">
                                Press <span className="kbd">Ctrl</span> + <span className="kbd">Space</span> anytime
                                to start recording.
                            </p>
                            <div className="onboarding-ready-flow">
                                <div className="onboarding-flow-step">🎙️ Speak</div>
                                <ChevronRight size={16} className="onboarding-flow-arrow" />
                                <div className="onboarding-flow-step">🗣️ Transcribe</div>
                                <ChevronRight size={16} className="onboarding-flow-arrow" />
                                <div className="onboarding-flow-step">✨ Structure</div>
                                <ChevronRight size={16} className="onboarding-flow-arrow" />
                                <div className="onboarding-flow-step">📋 Copy</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div className="onboarding-nav">
                    {step > 0 ? (
                        <button className="btn btn-secondary" onClick={prev}>
                            <ChevronLeft size={16} /> Back
                        </button>
                    ) : (
                        <div />
                    )}

                    {step < STEPS.length - 1 ? (
                        <button
                            className="btn btn-primary"
                            onClick={next}
                            disabled={!canProceed()}
                        >
                            Continue <ChevronRight size={16} />
                        </button>
                    ) : (
                        <button className="btn btn-primary btn-lg" onClick={finish}>
                            <Sparkles size={18} /> Start Using Bolo
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
