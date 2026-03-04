// ========================================
// Storage Service — Local Persistence
// ========================================

const STORAGE_KEYS = {
    PROMPTS: 'bolo_prompts',
    FAVORITES: 'bolo_favorites',
    SETTINGS: 'bolo_settings',
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

export function deletePrompt(promptId) {
    const history = getPromptHistory().filter(p => p.promptId !== promptId);
    localStorage.setItem(STORAGE_KEYS.PROMPTS, JSON.stringify(history));
    return history;
}

export function clearHistory() {
    localStorage.removeItem(STORAGE_KEYS.PROMPTS);
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
        return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : { ...DEFAULT_SETTINGS };
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
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    return { ...DEFAULT_SETTINGS };
}
