// ========================================
// Storage Service — Supabase DB + Local Cache
// ========================================

import { supabase } from './supabaseClient';

// LocalStorage keys (used as offline cache)
const STORAGE_KEYS = {
    SETTINGS: 'bolo_settings',
    ONBOARDING: 'bolo_onboarding_complete',
    PROMPTS_CACHE: 'bolo_prompts_cache',
};

// ---- Prompt History (Supabase DB) ----

/**
 * Get prompt history from Supabase DB
 */
export async function getPromptHistory(userId) {
    if (!userId) return getCachedPrompts();

    try {
        const { data, error } = await supabase
            .from('prompts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        // Map DB columns to app format
        const prompts = (data || []).map(mapDbPromptToApp);

        // Update local cache
        localStorage.setItem(STORAGE_KEYS.PROMPTS_CACHE, JSON.stringify(prompts));

        return prompts;
    } catch (err) {
        console.error('[Storage] Failed to fetch prompts:', err);
        return getCachedPrompts();
    }
}

/**
 * Save a new prompt to Supabase DB
 */
export async function savePrompt(userId, prompt) {
    if (!userId) return [];

    try {
        const { data, error } = await supabase
            .from('prompts')
            .insert({
                user_id: userId,
                title: prompt.title,
                summary: prompt.summary,
                requirements: prompt.requirements || [],
                acceptance_criteria: prompt.acceptance_criteria || [],
                constraints: prompt.constraints || [],
                examples: prompt.examples || [],
                original_transcript: prompt.original_transcript,
                confidence: prompt.confidence,
                language_detected: prompt.languageDetected,
            })
            .select()
            .single();

        if (error) throw error;

        // Refresh the full history
        return getPromptHistory(userId);
    } catch (err) {
        console.error('[Storage] Failed to save prompt:', err);
        return [];
    }
}

/**
 * Update a prompt in Supabase DB
 */
export async function updatePrompt(userId, promptId, updates) {
    if (!userId) return [];

    try {
        const dbUpdates = {};
        if (updates.title !== undefined) dbUpdates.title = updates.title;
        if (updates.summary !== undefined) dbUpdates.summary = updates.summary;
        if (updates.requirements !== undefined) dbUpdates.requirements = updates.requirements;
        if (updates.acceptance_criteria !== undefined) dbUpdates.acceptance_criteria = updates.acceptance_criteria;
        if (updates.constraints !== undefined) dbUpdates.constraints = updates.constraints;
        if (updates.examples !== undefined) dbUpdates.examples = updates.examples;

        const { error } = await supabase
            .from('prompts')
            .update(dbUpdates)
            .eq('id', promptId)
            .eq('user_id', userId);

        if (error) throw error;

        return getPromptHistory(userId);
    } catch (err) {
        console.error('[Storage] Failed to update prompt:', err);
        return [];
    }
}

/**
 * Delete a prompt from Supabase DB
 */
export async function deletePrompt(userId, promptId) {
    if (!userId) return [];

    try {
        const { error } = await supabase
            .from('prompts')
            .delete()
            .eq('id', promptId)
            .eq('user_id', userId);

        if (error) throw error;

        return getPromptHistory(userId);
    } catch (err) {
        console.error('[Storage] Failed to delete prompt:', err);
        return [];
    }
}

/**
 * Toggle favorite on a prompt
 */
export async function toggleFavorite(userId, promptId) {
    if (!userId) return [];

    try {
        // Get current state
        const { data: prompt } = await supabase
            .from('prompts')
            .select('is_favorite')
            .eq('id', promptId)
            .eq('user_id', userId)
            .single();

        if (!prompt) return [];

        const { error } = await supabase
            .from('prompts')
            .update({ is_favorite: !prompt.is_favorite })
            .eq('id', promptId)
            .eq('user_id', userId);

        if (error) throw error;

        return getPromptHistory(userId);
    } catch (err) {
        console.error('[Storage] Failed to toggle favorite:', err);
        return [];
    }
}

/**
 * Get list of favorite prompt IDs
 */
export async function getFavorites(userId) {
    if (!userId) return [];

    try {
        const { data, error } = await supabase
            .from('prompts')
            .select('id')
            .eq('user_id', userId)
            .eq('is_favorite', true);

        if (error) throw error;

        return (data || []).map(p => p.id);
    } catch (err) {
        console.error('[Storage] Failed to fetch favorites:', err);
        return [];
    }
}

// ---- Local Cache Helpers ----

function getCachedPrompts() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.PROMPTS_CACHE);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

/**
 * Map DB prompt row to app format
 */
function mapDbPromptToApp(row) {
    return {
        promptId: row.id,
        title: row.title,
        summary: row.summary,
        requirements: row.requirements || [],
        acceptance_criteria: row.acceptance_criteria || [],
        constraints: row.constraints || [],
        examples: row.examples || [],
        original_transcript: row.original_transcript,
        confidence: row.confidence,
        languageDetected: row.language_detected,
        isFavorite: row.is_favorite,
        createdAt: row.created_at,
    };
}

// ---- Settings (Local + Profile) ----

const DEFAULT_SETTINGS = {
    sttProvider: 'sarvam',
    llmProvider: 'gemini',
    language: 'unknown',
    sttMode: 'translate',
    autoCopy: true,
    hotkey: 'ctrl+space',
};

export function getSettings() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        const stored = data ? JSON.parse(data) : {};

        return {
            ...DEFAULT_SETTINGS,
            ...stored,
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
    return { ...DEFAULT_SETTINGS };
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

// ---- Export / Import (Legacy support) ----

export async function exportHistory(userId) {
    const prompts = await getPromptHistory(userId);
    const data = {
        version: '2.0',
        exportedAt: new Date().toISOString(),
        prompts,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bolo-prompts-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

export function clearHistory() {
    localStorage.removeItem(STORAGE_KEYS.PROMPTS_CACHE);
}
