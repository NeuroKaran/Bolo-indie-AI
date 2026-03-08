import { useState } from 'react';
import { Globe, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { saveSettings, getSettings, completeOnboarding } from '../services/storageService';
import { SUPPORTED_LANGUAGES } from '../services/sttService';

const STEPS = [
    { id: 'welcome', title: 'Welcome' },
    { id: 'language', title: 'Language' },
    { id: 'ready', title: 'Ready!' },
];

/**
 * Onboarding — Simplified flow (no API key setup!)
 * Just: Welcome → Pick Language → Ready
 */
export default function Onboarding({ onComplete, userName }) {
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
                            <h2 className="onboarding-title">
                                {userName ? `Welcome, ${userName}!` : 'Welcome to बोलो'}
                            </h2>
                            <p className="onboarding-desc">
                                Speak your ideas in <strong>Hinglish</strong> or any Indian language.
                                Get structured, developer-grade prompts <strong>instantly</strong>.
                            </p>
                            <p className="onboarding-desc" style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                                No API keys needed — everything is set up for you. ✨
                            </p>
                        </div>
                    )}

                    {step === 1 && (
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

                    {step === 2 && (
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
                            <p className="onboarding-desc" style={{ fontSize: '0.85rem', opacity: 0.7, marginTop: 16 }}>
                                You have <strong>50 free prompts</strong> to get started!
                            </p>
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
