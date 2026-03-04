import { useState } from 'react';
import { Copy, Star, Trash2, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { copyPromptToClipboard } from '../services/clipboardService';

/**
 * Displays a structured prompt result.
 */
export default function PromptCard({ prompt, onCopy, onFavorite, onDelete, isFavorite }) {
    const [showTranscript, setShowTranscript] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const success = await copyPromptToClipboard(prompt);
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            onCopy?.();
        }
    };

    const timeAgo = formatTimeAgo(prompt.createdAt);

    return (
        <div className="prompt-card">
            {/* Header */}
            <div className="prompt-card-header">
                <div>
                    <h3 className="prompt-card-title">{prompt.title}</h3>
                    <div className="prompt-card-meta">
                        <span className="prompt-card-time">{timeAgo}</span>
                        {prompt.languageDetected && prompt.languageDetected !== 'unknown' && (
                            <span className="language-chip" style={{ fontSize: '0.65rem', padding: '1px 8px' }}>
                                {getLanguageLabel(prompt.languageDetected)}
                            </span>
                        )}
                    </div>
                </div>
                <div className="prompt-card-actions">
                    <button
                        className={`btn btn-ghost btn-icon ${isFavorite ? 'text-saffron' : ''}`}
                        onClick={() => onFavorite?.(prompt.promptId)}
                        title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                        <Star size={16} fill={isFavorite ? '#FF9933' : 'none'} />
                    </button>
                    <button
                        className="btn btn-ghost btn-icon"
                        onClick={handleCopy}
                        title="Copy to clipboard"
                    >
                        {copied ? <Check size={16} color="#2E7D32" /> : <Copy size={16} />}
                    </button>
                    <button
                        className="btn btn-ghost btn-icon"
                        onClick={() => onDelete?.(prompt.promptId)}
                        title="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="prompt-card-body">
                {/* Summary */}
                <div className="prompt-section">
                    <div className="prompt-section-label">Description</div>
                    <p className="prompt-section-content">{prompt.summary}</p>
                </div>

                {/* Requirements */}
                {prompt.requirements?.length > 0 && (
                    <div className="prompt-section">
                        <div className="prompt-section-label">Requirements</div>
                        <ul className="prompt-list">
                            {prompt.requirements.map((req, i) => (
                                <li key={i}>{req}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Acceptance Criteria */}
                {prompt.acceptance_criteria?.length > 0 && (
                    <div className="prompt-section">
                        <div className="prompt-section-label">Acceptance Criteria</div>
                        <ul className="prompt-list">
                            {prompt.acceptance_criteria.map((ac, i) => (
                                <li key={i}>{ac}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Constraints */}
                {prompt.constraints?.length > 0 && (
                    <div className="prompt-section">
                        <div className="prompt-section-label">Constraints</div>
                        <ul className="prompt-list">
                            {prompt.constraints.map((c, i) => (
                                <li key={i}>{c}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Examples */}
                {prompt.examples?.length > 0 && (
                    <div className="prompt-section">
                        <div className="prompt-section-label">Examples</div>
                        <ul className="prompt-list">
                            {prompt.examples.map((e, i) => (
                                <li key={i}>{e}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="prompt-card-footer">
                <div className="confidence-bar">
                    <span className="confidence-bar-label">Confidence</span>
                    <div className="confidence-bar-track">
                        <div
                            className="confidence-bar-fill"
                            style={{ width: `${(prompt.confidence || 0) * 100}%` }}
                        />
                    </div>
                    <span className="confidence-bar-value">
                        {Math.round((prompt.confidence || 0) * 100)}%
                    </span>
                </div>

                <button
                    className="transcript-toggle"
                    onClick={() => setShowTranscript(!showTranscript)}
                >
                    Original transcript
                    {showTranscript ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
            </div>

            {/* Transcript */}
            {showTranscript && prompt.original_transcript && (
                <div style={{ padding: '0 24px 24px' }}>
                    <div className="transcript-box">
                        <p>"{prompt.original_transcript}"</p>
                    </div>
                </div>
            )}
        </div>
    );
}

function getLanguageLabel(code) {
    const labels = {
        'hi-IN': 'Hindi',
        'en-IN': 'English',
        'bn-IN': 'Bengali',
        'ta-IN': 'Tamil',
        'te-IN': 'Telugu',
        'kn-IN': 'Kannada',
        'ml-IN': 'Malayalam',
        'mr-IN': 'Marathi',
        'gu-IN': 'Gujarati',
        'pa-IN': 'Punjabi',
        'od-IN': 'Odia',
        'ur-IN': 'Urdu',
    };
    return labels[code] || code;
}

function formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
}
