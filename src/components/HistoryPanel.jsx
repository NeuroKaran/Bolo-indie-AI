import { useState, useMemo, useRef } from 'react';
import { Search, Clock, Star, Download, Upload, Trash2 } from 'lucide-react';
import PromptCard from './PromptCard';
import { exportHistory, importHistory, clearHistory } from '../services/storageService';

/**
 * History panel showing past prompts with search, filter, export/import.
 */
export default function HistoryPanel({ prompts, favorites, onCopy, onFavorite, onDelete, onUpdate, onRefresh, onToast }) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all'); // all | favorites
    const [showClearConfirm, setShowClearConfirm] = useState(false);
    const fileInputRef = useRef(null);

    const filtered = useMemo(() => {
        let list = prompts;

        // Filter favorites
        if (filter === 'favorites') {
            list = list.filter(p => favorites.includes(p.promptId));
        }

        // Search
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(p =>
                p.title?.toLowerCase().includes(q) ||
                p.summary?.toLowerCase().includes(q) ||
                p.original_transcript?.toLowerCase().includes(q)
            );
        }

        return list;
    }, [prompts, favorites, search, filter]);

    const handleExport = () => {
        exportHistory();
        onToast?.('Prompts exported! 📦', 'success');
    };

    const handleImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const result = await importHistory(file);
            onToast?.(`Imported ${result.promptCount} new prompts!`, 'success');
            onRefresh?.();
        } catch (err) {
            onToast?.(err.message || 'Import failed', 'error');
        }

        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClearAll = () => {
        clearHistory();
        setShowClearConfirm(false);
        onRefresh?.();
        onToast?.('History cleared', 'success');
    };

    return (
        <div className="history-section">
            <div className="section-header">
                <h2 className="section-title">
                    <Clock size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                    Prompt History
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="section-count">{prompts.length} prompts</span>
                    {prompts.length > 0 && (
                        <>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={handleExport} title="Export prompts">
                                <Download size={16} />
                            </button>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => fileInputRef.current?.click()} title="Import prompts">
                                <Upload size={16} />
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json"
                                style={{ display: 'none' }}
                                onChange={handleImport}
                            />
                        </>
                    )}
                </div>
            </div>

            {/* Search & Filter */}
            {prompts.length > 0 && (
                <>
                    <div className="search-bar">
                        <Search size={16} className="search-bar-icon" />
                        <input
                            id="history-search"
                            name="history-search"
                            type="text"
                            placeholder="Search prompts..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
                        <button
                            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFilter('all')}
                        >
                            All
                        </button>
                        <button
                            className={`btn btn-sm ${filter === 'favorites' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setFilter('favorites')}
                        >
                            <Star size={14} /> Favorites
                        </button>
                        <div style={{ flex: 1 }} />
                        {prompts.length > 0 && !showClearConfirm && (
                            <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => setShowClearConfirm(true)}
                                style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}
                            >
                                <Trash2 size={12} /> Clear all
                            </button>
                        )}
                        {showClearConfirm && (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>Delete all?</span>
                                <button className="btn btn-sm" onClick={handleClearAll} style={{ background: 'var(--error)', color: 'white', fontSize: '0.7rem' }}>
                                    Yes
                                </button>
                                <button className="btn btn-sm btn-secondary" onClick={() => setShowClearConfirm(false)} style={{ fontSize: '0.7rem' }}>
                                    No
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Prompt List */}
            {filtered.length > 0 ? (
                <div className="history-list">
                    {filtered.map(prompt => (
                        <PromptCard
                            key={prompt.promptId}
                            prompt={prompt}
                            onCopy={onCopy}
                            onFavorite={onFavorite}
                            onDelete={onDelete}
                            onUpdate={onUpdate}
                            isFavorite={favorites.includes(prompt.promptId)}
                        />
                    ))}
                </div>
            ) : (
                <div className="history-empty">
                    <div className="history-empty-icon">🎙️</div>
                    <p>
                        {prompts.length === 0
                            ? 'No prompts yet. Press Ctrl+Space or click the mic to start recording!'
                            : 'No matching prompts found.'}
                    </p>
                </div>
            )}
        </div>
    );
}
