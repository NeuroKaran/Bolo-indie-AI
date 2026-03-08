import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Mic, Brain, Globe, Shield, Keyboard, Save, RotateCcw, User, LogOut, CreditCard } from 'lucide-react';
import { getSettings, saveSettings, resetSettings } from '../services/storageService';
import { getUserProfile } from '../services/authService';
import { SUPPORTED_LANGUAGES } from '../services/sttService';
import { initiatePayment } from '../services/paymentService';

/**
 * Settings panel — Account info, STT/LLM config, language preferences
 * API keys removed — managed server-side now
 */
export default function SettingsPanel({ onToast, onSettingsChange, user, onSignOut }) {
    const [settings, setSettingsState] = useState(getSettings);
    const [profile, setProfile] = useState(null);

    // Fetch user profile on mount
    useEffect(() => {
        if (user?.id) {
            getUserProfile(user.id).then(p => setProfile(p));
        }
    }, [user]);

    const handleUpgrade = async (packageId, amount) => {
        try {
            onToast('Initiating payment...', 'info');
            await initiatePayment(packageId, amount);
            onToast('Payment successful! 🎉', 'success');
            const updated = await getUserProfile(user.id);
            setProfile(updated);
        } catch (err) {
            if (err.message !== 'Payment cancelled') {
                onToast(`Payment failed: ${err.message}`, 'error');
            }
        }
    };

    const update = (key, value) => {
        setSettingsState(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        const saved = saveSettings(settings);
        setSettingsState(saved);
        onSettingsChange?.(saved);
        onToast('Settings saved ✓', 'success');
    };

    const handleReset = () => {
        const defaults = resetSettings();
        setSettingsState(defaults);
        onSettingsChange?.(defaults);
        onToast('Settings reset to defaults', 'success');
    };

    return (
        <div className="settings-section">
            <div className="section-header" style={{ marginBottom: 24 }}>
                <h2 className="section-title">
                    <SettingsIcon size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                    Settings
                </h2>
            </div>

            {/* Account Section */}
            <div className="settings-group">
                <h3 className="settings-group-title">
                    <User size={18} /> Account
                </h3>

                <div className="settings-item">
                    <div className="settings-item-info">
                        <div className="settings-item-label">Email</div>
                        <div className="settings-item-desc">{user?.email || 'Not signed in'}</div>
                    </div>
                </div>

                <div className="settings-item">
                    <div className="settings-item-info">
                        <div className="settings-item-label">Plan</div>
                        <div className="settings-item-desc" style={{ textTransform: 'capitalize' }}>
                            {profile?.plan || 'Free'} Plan
                        </div>
                    </div>
                    <span className="plan-badge">{profile?.plan === 'pro' ? '⭐ Pro' : '🆓 Free'}</span>
                </div>

                <div className="settings-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div className="settings-item-info" style={{ marginBottom: 12 }}>
                        <div className="settings-item-label">
                            <CreditCard size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                            Credits Overview
                        </div>
                        <div className="settings-item-desc">
                            Daily: {profile?.daily_credits ?? 0} | Top-up: {profile?.topup_credits ?? 0}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="credits-bar" style={{ flex: 1, height: 6, margin: 0 }}>
                                <div
                                    className="credits-bar-fill"
                                    style={{
                                        width: `${Math.min(100, ((profile?.daily_credits ?? 0) / 10) * 100)}%`,
                                        backgroundColor: 'var(--saffron-light)'
                                    }}
                                />
                            </div>
                            <span style={{ fontSize: '0.75rem', width: 40, textAlign: 'right' }}>Daily</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="credits-bar" style={{ flex: 1, height: 6, margin: 0 }}>
                                <div
                                    className="credits-bar-fill"
                                    style={{
                                        width: `${Math.min(100, ((profile?.topup_credits ?? 0) / 50) * 100)}%`,
                                        backgroundColor: 'var(--saffron-deep)'
                                    }}
                                />
                            </div>
                            <span style={{ fontSize: '0.75rem', width: 40, textAlign: 'right' }}>Top-up</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                        <button className="btn btn-primary" onClick={() => handleUpgrade('topup_mini', 99)} style={{ flex: 1, fontSize: '0.8rem', padding: '6px' }}>
                            +50 Credits (₹99)
                        </button>
                        {profile?.plan !== 'pro' && (
                            <button className="btn btn-secondary" onClick={() => handleUpgrade('pro_monthly', 299)} style={{ flex: 1, fontSize: '0.8rem', padding: '6px' }}>
                                ⭐ Pro (₹299/mo)
                            </button>
                        )}
                    </div>
                </div>

                <div className="settings-item">
                    <div className="settings-item-info">
                        <div className="settings-item-label" style={{ color: 'var(--saffron-deep)' }}>Sign Out</div>
                    </div>
                    <button className="btn btn-secondary" onClick={onSignOut} style={{ gap: 6, fontSize: '0.8rem' }}>
                        <LogOut size={14} /> Sign Out
                    </button>
                </div>
            </div>

            {/* STT Provider */}
            <div className="settings-group">
                <h3 className="settings-group-title">
                    <Mic size={18} /> Speech-to-Text
                </h3>

                <div className="settings-item">
                    <div className="settings-item-info">
                        <div className="settings-item-label">STT Provider</div>
                        <div className="settings-item-desc">Choose your speech recognition engine</div>
                    </div>
                    <select
                        className="settings-select"
                        value={settings.sttProvider}
                        onChange={e => update('sttProvider', e.target.value)}
                    >
                        <option value="sarvam">Sarvam AI (Saaras v3)</option>
                        <option value="webspeech">Web Speech API (Free)</option>
                    </select>
                </div>

                <div className="settings-item">
                    <div className="settings-item-info">
                        <div className="settings-item-label">STT Mode</div>
                        <div className="settings-item-desc">How to process the speech output</div>
                    </div>
                    <select
                        className="settings-select"
                        value={settings.sttMode}
                        onChange={e => update('sttMode', e.target.value)}
                    >
                        <option value="translate">Translate to English</option>
                        <option value="transcribe">Transcribe (original lang)</option>
                        <option value="codemix">Code-mix</option>
                        <option value="translit">Transliterate (Roman)</option>
                    </select>
                </div>
            </div>

            {/* LLM Config */}
            <div className="settings-group">
                <h3 className="settings-group-title">
                    <Brain size={18} /> Prompt Structuring (LLM)
                </h3>

                <div className="settings-item">
                    <div className="settings-item-info">
                        <div className="settings-item-label">LLM Provider</div>
                        <div className="settings-item-desc">Choose your prompt structuring engine</div>
                    </div>
                    <select
                        className="settings-select"
                        value={settings.llmProvider || 'gemini'}
                        onChange={e => update('llmProvider', e.target.value)}
                    >
                        <option value="gemini">Gemini 2.5 Flash</option>
                        <option value="sarvam-indus">Sarvam INDUS (sarvam-m)</option>
                    </select>
                </div>
            </div>

            {/* Language */}
            <div className="settings-group">
                <h3 className="settings-group-title">
                    <Globe size={18} /> Language
                </h3>

                <div className="settings-item">
                    <div className="settings-item-info">
                        <div className="settings-item-label">Default Language</div>
                        <div className="settings-item-desc">Preferred input language for STT</div>
                    </div>
                    <select
                        className="settings-select"
                        value={settings.language}
                        onChange={e => update('language', e.target.value)}
                    >
                        {SUPPORTED_LANGUAGES.map(lang => (
                            <option key={lang.code} value={lang.code}>
                                {lang.label} {lang.labelHi ? `(${lang.labelHi})` : ''}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Preferences */}
            <div className="settings-group">
                <h3 className="settings-group-title">
                    <Shield size={18} /> Preferences
                </h3>

                <div className="settings-item">
                    <div className="settings-item-info">
                        <div className="settings-item-label">Auto-copy to clipboard</div>
                        <div className="settings-item-desc">Automatically copy structured prompt after generation</div>
                    </div>
                    <label className="toggle">
                        <input
                            type="checkbox"
                            checked={settings.autoCopy}
                            onChange={e => update('autoCopy', e.target.checked)}
                        />
                        <span className="toggle-slider" />
                    </label>
                </div>
            </div>

            {/* Hotkey */}
            <div className="settings-group">
                <h3 className="settings-group-title">
                    <Keyboard size={18} /> Keyboard Shortcuts
                </h3>

                <div className="settings-item">
                    <div className="settings-item-info">
                        <div className="settings-item-label">Activate Recording</div>
                        <div className="settings-item-desc">Hotkey to start voice recording</div>
                    </div>
                    <div className="kbd" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                        Ctrl + Space
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button className="btn btn-secondary" onClick={handleReset}>
                    <RotateCcw size={16} /> Reset
                </button>
                <button className="btn btn-primary" onClick={handleSave}>
                    <Save size={16} /> Save Settings
                </button>
            </div>
        </div>
    );
}
