// ========================================
// Storage Service — Local Persistence
// ========================================

const STORAGE_KEYS = {
    PROMPTS: 'bolo_prompts',
    FAVORITES: 'bolo_favorites',
    SETTINGS: 'bolo_settings',
    ONBOARDING: 'bolo_onboarding_complete',
};

const MAX_HISTORY = 50;

// ---- Prompt History ----

export function getPromptHistory() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.PROMPTS);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function savePrompt(prompt) {
    const history = getPromptHistory();
    history.unshift(prompt);

    // Keep only last 50
    if (history.length > MAX_HISTORY) {
        history.length = MAX_HISTORY;
    }

    localStorage.setItem(STORAGE_KEYS.PROMPTS, JSON.stringify(history));
    return history;
}

export function updatePrompt(promptId, updates) {
    const history = getPromptHistory();
    const index = history.findIndex(p => p.promptId === promptId);
    if (index !== -1) {
        history[index] = { ...history[index], ...updates };
        localStorage.setItem(STORAGE_KEYS.PROMPTS, JSON.stringify(history));
    }
    return history;
}

export function deletePrompt(promptId) {
    const history = getPromptHistory().filter(p => p.promptId !== promptId);
    localStorage.setItem(STORAGE_KEYS.PROMPTS, JSON.stringify(history));
    return history;
}

export function clearHistory() {
    localStorage.removeItem(STORAGE_KEYS.PROMPTS);
}

// ---- Export / Import ----

export function exportHistory() {
    const prompts = getPromptHistory();
    const favorites = getFavorites();
    const data = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        prompts,
        favorites,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bolo-prompts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export function importHistory(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!data.prompts || !Array.isArray(data.prompts)) {
                    reject(new Error('Invalid file format'));
                    return;
                }

                // Merge with existing — avoid duplicates by promptId
                const existing = getPromptHistory();
                const existingIds = new Set(existing.map(p => p.promptId));
                const newPrompts = data.prompts.filter(p => !existingIds.has(p.promptId));
                const merged = [...newPrompts, ...existing].slice(0, MAX_HISTORY);

                localStorage.setItem(STORAGE_KEYS.PROMPTS, JSON.stringify(merged));

                // Merge favorites
                if (data.favorites) {
                    const existingFavs = getFavorites();
                    const mergedFavs = [...new Set([...existingFavs, ...data.favorites])];
                    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(mergedFavs));
                }

                resolve({ promptCount: newPrompts.length, total: merged.length });
            } catch (err) {
                reject(new Error('Failed to parse import file'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// ---- Favorites ----

export function getFavorites() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.FAVORITES);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export function toggleFavorite(promptId) {
    const favorites = getFavorites();
    const index = favorites.indexOf(promptId);

    if (index === -1) {
        favorites.push(promptId);
    } else {
        favorites.splice(index, 1);
    }

    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    return favorites;
}

export function isFavorite(promptId) {
    return getFavorites().includes(promptId);
}

// ---- Settings ----

const DEFAULT_SETTINGS = {
    sttProvider: 'sarvam', // 'sarvam' | 'webspeech'
    sarvamApiKey: '',
    geminiApiKey: '',
    language: 'unknown',
    sttMode: 'translate', // 'transcribe' | 'translate' | 'codemix'
    autoCopy: true,
    localOnly: false,
    hotkey: 'ctrl+space',
};

export function getSettings() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        const stored = data ? JSON.parse(data) : {};

        // Env vars as fallback defaults (Vite exposes VITE_ prefixed vars)
        const envSarvamKey = import.meta.env.VITE_SARVAM_API_KEY || '';
        const envGeminiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

        return {
            ...DEFAULT_SETTINGS,
            sarvamApiKey: envSarvamKey,  // env var as base default
            geminiApiKey: envGeminiKey,
            ...stored,                   // user's localStorage overrides
        };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

export function saveSettings(settings) {
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
    return merged;
}

export function resetSettings() {
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    return getSettings(); // Will fall back to env vars + defaults
}

// ---- Onboarding ----

export function isOnboardingComplete() {
    return localStorage.getItem(STORAGE_KEYS.ONBOARDING) === 'true';
}

export function completeOnboarding() {
    localStorage.setItem(STORAGE_KEYS.ONBOARDING, 'true');
}

export function resetOnboarding() {
    localStorage.removeItem(STORAGE_KEYS.ONBOARDING);
}
