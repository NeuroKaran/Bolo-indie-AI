// ========================================
// INDUS Service — Sarvam LLM Integration
// ========================================

import { SYSTEM_PROMPT, fallbackStructure } from './promptService';

const SARVAM_CHAT_API_URL = 'https://api.sarvam.ai/v1/chat/completions';

/**
 * Structure a transcript into a developer prompt using Sarvam INDUS (sarvam-m)
 *
 * @param {string} transcript - Raw transcript text
 * @param {string} apiKey - Sarvam API key
 * @returns {Promise<object>} Structured prompt object
 */
export async function structurePromptWithIndus(transcript, apiKey) {
    if (!apiKey) {
        throw new Error('Sarvam API key is required for INDUS LLM. Add it in Settings.');
    }

    if (!transcript || transcript.trim().length === 0) {
        throw new Error('No transcript to structure.');
    }

    const requestBody = {
        model: 'sarvam-m',
        messages: [
            {
                role: 'system',
                content: SYSTEM_PROMPT
            },
            {
                role: 'user',
                content: `Transcript to structure:\n"${transcript}"\n\nRespond with ONLY the JSON object.`
            }
        ],
        temperature: 0.3,
        top_p: 0.8,
        max_tokens: 1024,
    };

    try {
        const response = await fetch(SARVAM_CHAT_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-subscription-key': apiKey,
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage;
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.error?.message || errorData.message || errorData.detail || JSON.stringify(errorData);
            } catch {
                errorMessage = errorText;
            }
            throw new Error(`Sarvam INDUS API error: ${response.status} — ${errorMessage}`);
        }

        const data = await response.json();

        // Extract text from INDUS response
        const text = data?.choices?.[0]?.message?.content;

        if (!text) {
            throw new Error('Empty response from Sarvam INDUS');
        }

        // Parse JSON from response
        // Sometimes LLMs wrap JSON in markdown blocks, so we strip them
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanText);

        // Validate structure
        return {
            title: parsed.title || 'Untitled Prompt',
            summary: parsed.summary || transcript.slice(0, 200),
            requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
            acceptance_criteria: Array.isArray(parsed.acceptance_criteria) ? parsed.acceptance_criteria : [],
            constraints: Array.isArray(parsed.constraints) ? parsed.constraints : [],
            examples: Array.isArray(parsed.examples) ? parsed.examples : [],
        };
    } catch (err) {
        if (err.message.includes('API key')) throw err;

        console.error('INDUS Prompt structuring error:', err);

        // Fallback: basic local structuring
        return fallbackStructure(transcript);
    }
}
