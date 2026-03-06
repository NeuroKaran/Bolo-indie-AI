import { useState } from 'react';
import { Copy, Star, Trash2, ChevronDown, ChevronUp, Check, Pencil, X, Save } from 'lucide-react';
import { copyPromptToClipboard } from '../services/clipboardService';

/**
 * Displays a structured prompt result with inline editing support.
 */
export default function PromptCard({ prompt, onCopy, onFavorite, onDelete, onUpdate, isFavorite }) {
    const [showTranscript, setShowTranscript] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState(null);

    const handleCopy = async () => {
        const target = isEditing ? { ...prompt, ...editData } : prompt;
        const success = await copyPromptToClipboard(target);
        if (success) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            onCopy?.();
        }
    };

    const startEditing = () => {
        setEditData({
            title: prompt.title,
            summary: prompt.summary,
            requirements: [...(prompt.requirements || [])],
            acceptance_criteria: [...(prompt.acceptance_criteria || [])],
            constraints: [...(prompt.constraints || [])],
        });
        setIsEditing(true);
    };

    const cancelEditing = () => {
        setEditData(null);
        setIsEditing(false);
    };

    const saveEditing = () => {
        if (editData) {
            onUpdate?.(prompt.promptId, editData);
        }
        setIsEditing(false);
        setEditData(null);
    };

    const updateEditField = (field, value) => {
        setEditData(prev => ({ ...prev, [field]: value }));
    };

    const updateEditListItem = (field, index, value) => {
        setEditData(prev => {
            const list = [...prev[field]];
            list[index] = value;
            return { ...prev, [field]: list };
        });
    };

    const removeEditListItem = (field, index) => {
        setEditData(prev => {
            const list = [...prev[field]];
            list.splice(index, 1);
            return { ...prev, [field]: list };
        });
    };

    const addEditListItem = (field) => {
        setEditData(prev => ({
            ...prev,
            [field]: [...prev[field], ''],
        }));
    };

    const timeAgo = formatTimeAgo(prompt.createdAt);
    const showLowConfidence = (prompt.confidence || 0) < 0.7 && !isEditing;

    return (
        <div className={`prompt-card ${isEditing ? 'editing' : ''}`}>
            {/* Low confidence banner */}
            {showLowConfidence && (
                <div className="prompt-low-confidence-banner" onClick={startEditing}>
                    ⚠️ Low confidence — Click to edit before copying
                </div>
            )}

            {/* Header */}
            <div className="prompt-card-header">
                <div style={{ flex: 1 }}>
                    {isEditing ? (
                        <input
                            className="prompt-edit-title"
                            value={editData.title}
                            onChange={e => updateEditField('title', e.target.value)}
                            placeholder="Prompt title..."
                        />
                    ) : (
                        <h3 className="prompt-card-title">{prompt.title}</h3>
                    )}
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
                    {isEditing ? (
                        <>
                            <button className="btn btn-ghost btn-icon" onClick={cancelEditing} title="Cancel editing">
                                <X size={16} />
                            </button>
                            <button className="btn btn-ghost btn-icon" onClick={saveEditing} title="Save changes" style={{ color: 'var(--success)' }}>
                                <Save size={16} />
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="btn btn-ghost btn-icon" onClick={startEditing} title="Edit prompt">
                                <Pencil size={16} />
                            </button>
                            <button
                                className={`btn btn-ghost btn-icon ${isFavorite ? 'text-saffron' : ''}`}
                                onClick={() => onFavorite?.(prompt.promptId)}
                                title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                                <Star size={16} fill={isFavorite ? '#FF9933' : 'none'} />
                            </button>
                            <button className="btn btn-ghost btn-icon" onClick={handleCopy} title="Copy to clipboard">
                                {copied ? <Check size={16} color="#2E7D32" /> : <Copy size={16} />}
                            </button>
                            <button className="btn btn-ghost btn-icon" onClick={() => onDelete?.(prompt.promptId)} title="Delete">
                                <Trash2 size={16} />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="prompt-card-body">
                {/* Summary */}
                <div className="prompt-section">
                    <div className="prompt-section-label">Description</div>
                    {isEditing ? (
                        <textarea
                            className="prompt-edit-textarea"
                            value={editData.summary}
                            onChange={e => updateEditField('summary', e.target.value)}
                            rows={3}
                            placeholder="Describe what needs to be built..."
                        />
                    ) : (
                        <p className="prompt-section-content">{prompt.summary}</p>
                    )}
                </div>

                {/* Editable List Sections */}
                {renderListSection('Requirements', 'requirements', prompt, isEditing, editData, updateEditListItem, removeEditListItem, addEditListItem)}
                {renderListSection('Acceptance Criteria', 'acceptance_criteria', prompt, isEditing, editData, updateEditListItem, removeEditListItem, addEditListItem)}
                {renderListSection('Constraints', 'constraints', prompt, isEditing, editData, updateEditListItem, removeEditListItem, addEditListItem)}

                {/* Examples (read-only) */}
                {!isEditing && prompt.examples?.length > 0 && (
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

function renderListSection(label, field, prompt, isEditing, editData, onUpdate, onRemove, onAdd) {
    const items = isEditing ? editData[field] : prompt[field];
    if (!isEditing && (!items || items.length === 0)) return null;

    return (
        <div className="prompt-section">
            <div className="prompt-section-label">{label}</div>
            {isEditing ? (
                <div className="prompt-edit-list">
                    {editData[field]?.map((item, i) => (
                        <div key={i} className="prompt-edit-list-item">
                            <input
                                className="prompt-edit-list-input"
                                value={item}
                                onChange={e => onUpdate(field, i, e.target.value)}
                                placeholder={`${label} item...`}
                            />
                            <button
                                className="btn btn-ghost btn-icon btn-sm"
                                onClick={() => onRemove(field, i)}
                                title="Remove"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    ))}
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => onAdd(field)}
                        style={{ color: 'var(--saffron-deep)', marginTop: 4 }}
                    >
                        + Add {label.toLowerCase().replace(/s$/, '')}
                    </button>
                </div>
            ) : (
                <ul className="prompt-list">
                    {items.map((item, i) => (
                        <li key={i}>{item}</li>
                    ))}
                </ul>
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
