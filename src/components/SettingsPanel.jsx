import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Mic, Brain, Globe, Shield, Keyboard, Save, RotateCcw } from 'lucide-react';
import { getSettings, saveSettings, resetSettings } from '../services/storageService';
import { SUPPORTED_LANGUAGES } from '../services/sttService';

/**
 * Settings panel — API keys, STT/LLM config, language preferences
 */
export default function SettingsPanel({ onToast, onSettingsChange }) {
    const [settings, setSettingsState] = useState(getSettings);

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

                {settings.sttProvider === 'sarvam' && (
                    <div className="settings-item">
                        <div className="settings-item-info">
                            <div className="settings-item-label">Sarvam AI API Key</div>
                            <div className="settings-item-desc">
                                Get your key from{' '}
                                <a href="https://dashboard.sarvam.ai" target="_blank" rel="noopener noreferrer"
                                    style={{ color: 'var(--saffron-deep)' }}>
                                    dashboard.sarvam.ai
                                </a>
                            </div>
                        </div>
                        <input
                            type="password"
                            className="settings-input"
                            placeholder="Enter API key..."
                            value={settings.sarvamApiKey}
                            onChange={e => update('sarvamApiKey', e.target.value)}
                        />
                    </div>
                )}

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
                        <div className="settings-item-label">Gemini API Key</div>
                        <div className="settings-item-desc">
                            Get your key from{' '}
                            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
                                style={{ color: 'var(--saffron-deep)' }}>
                                AI Studio
                            </a>
                        </div>
                    </div>
                    <input
                        type="password"
                        className="settings-input"
                        placeholder="Enter API key..."
                        value={settings.geminiApiKey}
                        onChange={e => update('geminiApiKey', e.target.value)}
                    />
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
                        <div className="settings-item-desc">Global hotkey to start voice recording</div>
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
