// ========================================
// Prompt Service — Supabase Edge Function Proxy
// ========================================

import { supabase, getAccessToken } from './supabaseClient';

const SUPABASE_URL = (typeof import.meta !== 'undefined' && import.meta.env)
    ? import.meta.env.VITE_SUPABASE_URL
    : 'https://placeholder.supabase.co';

export const SYSTEM_PROMPT = `You are Bolo, a prompt structuring assistant for Indian developers. 
Your job is to take a raw speech transcript (often from Hinglish or Indian language speech converted to English) and transform it into a clean, structured developer prompt that can be directly pasted into AI coding assistants like Cursor, GitHub Copilot, or ChatGPT.

IMPORTANT RULES:
1. Fix any speech-to-text artifacts (filler words, repetitions, grammar issues)
2. Preserve all technical terms exactly (API names, library names, programming concepts)
3. Infer the developer's intent even if the transcript is messy
4. Structure the output as a professional developer prompt
5. If the transcript mentions specific technologies, include them in constraints
6. Generate clear, actionable acceptance criteria

You MUST respond in valid JSON format with this exact structure:
{
  "title": "A concise title for the task (max 10 words)",
  "summary": "A clear 1-2 sentence description of what needs to be built",
  "requirements": ["requirement 1", "requirement 2", ...],
  "acceptance_criteria": ["criterion 1", "criterion 2", ...],
  "constraints": ["constraint 1", "constraint 2", ...],
  "examples": ["example 1 if applicable"]
}

ONLY return the JSON object, no other text.`;

/**
 * Helper: call the structure-prompt Edge Function with given token
 */
async function callStructureFunction(token, transcript, provider) {
    return fetch(`${SUPABASE_URL}/functions/v1/structure-prompt`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcript, provider }),
    });
}

/**
 * Structure a transcript into a developer prompt via Edge Function.
 * Supports both Gemini and Sarvam INDUS providers (server-side).
 *
 * @param {string} transcript - Raw transcript text
 * @param {string} provider - LLM provider: 'gemini' | 'sarvam-indus'
 * @returns {Promise<object>} Structured prompt object
 */
export async function structurePrompt(transcript, provider = 'gemini') {
    if (!transcript || transcript.trim().length === 0) {
        throw new Error('No transcript to structure.');
    }

    try {
        let token = await getAccessToken();
        if (!token) {
            throw new Error('Not authenticated. Please sign in.');
        }

        let response = await callStructureFunction(token, transcript, provider);

        // If 401, try refreshing the session and retry once
        if (response.status === 401) {
            console.warn('[Prompt] Got 401 — refreshing session and retrying…');
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError || !refreshData.session) {
                throw new Error('Session expired. Please sign in again.');
            }
            token = refreshData.session.access_token;
            response = await callStructureFunction(token, transcript, provider);
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error || `${response.status} ${response.statusText}`;
            if (response.status === 401) {
                throw new Error('Session expired. Please sign in again.');
            }
            if (response.status === 402) {
                throw new Error('No credits remaining. Please upgrade your plan.');
            }
            throw new Error(`Prompt structuring failed: ${errorMsg}`);
        }

        const data = await response.json();

        return {
            title: data.title || 'Untitled Prompt',
            summary: data.summary || transcript.slice(0, 200),
            requirements: Array.isArray(data.requirements) ? data.requirements : [],
            acceptance_criteria: Array.isArray(data.acceptance_criteria) ? data.acceptance_criteria : [],
            constraints: Array.isArray(data.constraints) ? data.constraints : [],
            examples: Array.isArray(data.examples) ? data.examples : [],
        };
    } catch (err) {
        if (err.message.includes('credits') || err.message.includes('authenticated')) throw err;

        console.error('Prompt structuring error:', err);

        // Fallback: basic local structuring
        return fallbackStructure(transcript);
    }
}

/**
 * Fallback: simple local structuring when LLM is unavailable
 */
export function fallbackStructure(transcript) {
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim());

    return {
        title: sentences[0]?.trim().slice(0, 60) || 'Voice Prompt',
        summary: transcript.slice(0, 200),
        requirements: sentences.slice(1).map(s => s.trim()).filter(s => s.length > 0),
        acceptance_criteria: [],
        constraints: [],
        examples: [],
    };
}

/**
 * Format a structured prompt as markdown for clipboard
 */
export function formatPromptAsMarkdown(prompt) {
    let md = `## ${prompt.title}\n\n`;
    md += `${prompt.summary}\n\n`;

    if (prompt.requirements.length > 0) {
        md += `### Requirements\n`;
        prompt.requirements.forEach(r => { md += `- ${r}\n`; });
        md += '\n';
    }

    if (prompt.acceptance_criteria.length > 0) {
        md += `### Acceptance Criteria\n`;
        prompt.acceptance_criteria.forEach(c => { md += `- ${c}\n`; });
        md += '\n';
    }

    if (prompt.constraints.length > 0) {
        md += `### Constraints\n`;
        prompt.constraints.forEach(c => { md += `- ${c}\n`; });
        md += '\n';
    }

    if (prompt.examples.length > 0) {
        md += `### Examples\n`;
        prompt.examples.forEach(e => { md += `- ${e}\n`; });
        md += '\n';
    }

    return md.trim();
}

/**
 * Route request to the configured LLM provider
 * (Simplified — both providers go through the same Edge Function)
 */
export async function structurePromptWithProvider(transcript, settings) {
    const provider = settings.llmProvider || 'gemini';
    return structurePrompt(transcript, provider);
}
