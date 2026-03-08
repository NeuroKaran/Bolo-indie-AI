// @ts-nocheck
// Supabase Edge Function — Structure Prompt via Gemini 2.5 Flash
// Proxies transcript to Gemini LLM with server-side API key

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // Verify auth
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Must extract just the token part
        const token = authHeader.replace(/^Bearer\s+/i, '');

        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

        const supabase = createClient(
            supabaseUrl,
            supabaseAnonKey,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            console.error('Auth error:', authError);
            return new Response(JSON.stringify({ error: 'Invalid or expired token', details: authError }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Check credits
        const { data: profile } = await supabase
            .from('profiles')
            .select('daily_credits, topup_credits')
            .eq('id', user.id)
            .single();

        if (!profile) {
            return new Response(JSON.stringify({ error: 'Profile not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const hasCredits = (profile.daily_credits > 0) || (profile.topup_credits > 0);
        if (!hasCredits) {
            return new Response(JSON.stringify({ error: 'No credits remaining. Please upgrade your plan.' }), {
                status: 402,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Parse request body
        const { transcript, provider = 'gemini' } = await req.json();

        if (!transcript || transcript.trim().length === 0) {
            return new Response(JSON.stringify({ error: 'No transcript provided' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        let result;
        const startTime = Date.now();

        if (provider === 'sarvam-indus') {
            // Use Sarvam INDUS
            const sarvamApiKey = Deno.env.get('SARVAM_API_KEY');
            if (!sarvamApiKey) {
                return new Response(JSON.stringify({ error: 'LLM service not configured' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            const response = await fetch('https://api.sarvam.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-subscription-key': sarvamApiKey,
                },
                body: JSON.stringify({
                    model: 'sarvam-m',
                    messages: [
                        { role: 'system', content: SYSTEM_PROMPT },
                        { role: 'user', content: `Transcript to structure:\n"${transcript}"\n\nRespond with ONLY the JSON object.` },
                    ],
                    temperature: 0.3,
                    top_p: 0.8,
                    max_tokens: 1024,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Sarvam INDUS error: ${response.status} — ${errorText}`);
            }

            const data = await response.json();
            const text = data?.choices?.[0]?.message?.content || '';

            // Clean markdown blocks if present, but avoid stripping internal backticks
            let cleanText = text.trim();
            if (cleanText.startsWith('```json')) {
                cleanText = cleanText.substring(7);
            } else if (cleanText.startsWith('```')) {
                cleanText = cleanText.substring(3);
            }
            if (cleanText.endsWith('```')) {
                cleanText = cleanText.substring(0, cleanText.length - 3);
            }
            cleanText = cleanText.trim();
            try {
                result = JSON.parse(cleanText);
            } catch (parseError) {
                console.error('Sarvam INDUS JSON parse error:', parseError, 'Raw text:', cleanText);
                throw new Error(`Failed to parse structured prompt from Sarvam: ${parseError.message}`);
            }

        } else {
            // Use Gemini 2.5 Flash (default)
            const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
            if (!geminiApiKey) {
                return new Response(JSON.stringify({ error: 'LLM service not configured' }), {
                    status: 500,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: {
                        parts: [{ text: SYSTEM_PROMPT }]
                    },
                    contents: [{
                        role: 'user',
                        parts: [{
                            text: `Transcript to structure:\n"${transcript}"`
                        }],
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        topP: 0.8,
                        topK: 40,
                        maxOutputTokens: 1024,
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: "OBJECT",
                            properties: {
                                title: { type: "STRING" },
                                summary: { type: "STRING" },
                                requirements: { type: "ARRAY", items: { type: "STRING" } },
                                acceptance_criteria: { type: "ARRAY", items: { type: "STRING" } },
                                constraints: { type: "ARRAY", items: { type: "STRING" } },
                                examples: { type: "ARRAY", items: { type: "STRING" } }
                            },
                            required: ["title", "summary", "requirements", "acceptance_criteria", "constraints", "examples"]
                        }
                    },
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini error: ${response.status} — ${errorText}`);
            }

            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // Clean markdown blocks if present, but avoid stripping internal backticks
            let cleanText = text.trim();
            if (cleanText.startsWith('```json')) {
                cleanText = cleanText.substring(7);
            } else if (cleanText.startsWith('```')) {
                cleanText = cleanText.substring(3);
            }
            if (cleanText.endsWith('```')) {
                cleanText = cleanText.substring(0, cleanText.length - 3);
            }
            cleanText = cleanText.trim();

            try {
                result = JSON.parse(cleanText);
            } catch (parseError) {
                console.error('Gemini JSON parse error:', parseError, 'Raw text:', cleanText);
                throw new Error(`Failed to parse structured prompt from Gemini: ${parseError.message}`);
            }
        }

        const latencyMs = Date.now() - startTime;

        // Validate & normalize result
        const structured = {
            title: result.title || 'Untitled Prompt',
            summary: result.summary || transcript.slice(0, 200),
            requirements: Array.isArray(result.requirements) ? result.requirements : [],
            acceptance_criteria: Array.isArray(result.acceptance_criteria) ? result.acceptance_criteria : [],
            constraints: Array.isArray(result.constraints) ? result.constraints : [],
            examples: Array.isArray(result.examples) ? result.examples : [],
        };

        // Log usage + decrement credits
        await Promise.all([
            supabase.from('usage_logs').insert({
                user_id: user.id,
                event_type: 'llm_call',
                llm_latency_ms: latencyMs,
                metadata: { provider, transcript_length: transcript.length },
            }),
            supabase.rpc('decrement_credits', { user_id_input: user.id }),
        ]);

        return new Response(JSON.stringify(structured), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('Structure-prompt function error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
