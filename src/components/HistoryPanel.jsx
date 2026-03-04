import { useState, useMemo } from 'react';
import { Search, Clock, Star, Trash2 } from 'lucide-react';
import PromptCard from './PromptCard';

/**
 * History panel showing past prompts with search and filter.
 */
export default function HistoryPanel({ prompts, favorites, onCopy, onFavorite, onDelete }) {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all'); // all | favorites

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

    return (
        <div className="history-section">
            <div className="section-header">
                <h2 className="section-title">
                    <Clock size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                    Prompt History
                </h2>
                <span className="section-count">{prompts.length} prompts</span>
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

                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
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
