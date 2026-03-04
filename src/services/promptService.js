// ========================================
// Prompt Service — Gemini 2.5 Flash Integration
// ========================================

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SYSTEM_PROMPT = `You are Bolo, a prompt structuring assistant for Indian developers. 
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
 * Structure a transcript into a developer prompt using Gemini 2.5 Flash
 * 
 * @param {string} transcript - Raw transcript text
 * @param {string} apiKey - Google AI Studio API key
 * @returns {Promise<object>} Structured prompt object
 */
export async function structurePrompt(transcript, apiKey) {
    if (!apiKey) {
        throw new Error('Gemini API key is required. Add it in Settings.');
    }

    if (!transcript || transcript.trim().length === 0) {
        throw new Error('No transcript to structure.');
    }

    const url = `${GEMINI_API_URL}?key=${apiKey}`;

    const requestBody = {
        contents: [
            {
                role: 'user',
                parts: [
                    {
                        text: `${SYSTEM_PROMPT}\n\n---\n\nTranscript to structure:\n"${transcript}"\n\nRespond with ONLY the JSON object.`,
                    },
                ],
            },
        ],
        generationConfig: {
            temperature: 0.3,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
        },
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData?.error?.message || `${response.status} ${response.statusText}`;
            throw new Error(`Gemini API error: ${errorMsg}`);
        }

        const data = await response.json();

        // Extract text from Gemini response  
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!text) {
            throw new Error('Empty response from Gemini');
        }

        // Parse JSON from response
        const parsed = JSON.parse(text);

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

        console.error('Prompt structuring error:', err);

        // Fallback: basic local structuring
        return fallbackStructure(transcript);
    }
}

/**
 * Fallback: simple local structuring when LLM is unavailable
 */
function fallbackStructure(transcript) {
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
