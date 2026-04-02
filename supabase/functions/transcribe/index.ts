// @ts-nocheck
// Supabase Edge Function — Transcribe Audio via Sarvam AI
// Proxies audio to Sarvam AI STT with server-side API key

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
    const corsHeaders = getCorsHeaders(req);

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

        // Create Supabase client with user's JWT
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

        const supabase = createClient(
            supabaseUrl,
            supabaseAnonKey,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        // Get authenticated user
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
            .select('daily_credits, topup_credits, plan, last_reset_date')
            .eq('id', user.id)
            .single();

        // Let user pass if no profile exists yet or if credits are > 0
        if (profile) {
            const today = new Date().toISOString().split('T')[0];
            const lastReset = profile.last_reset_date || today;
            let simulatedDaily = profile.daily_credits;

            if (lastReset < today) {
                if (profile.plan === 'power') simulatedDaily = 30;
                else if (profile.plan === 'pro') simulatedDaily = 10;
                else simulatedDaily = 0;
            }

            const hasCredits = (simulatedDaily > 0) || (profile.topup_credits > 0);
            if (!hasCredits) {
                return new Response(JSON.stringify({ error: 'No credits remaining. Please upgrade your plan.' }), {
                    status: 402,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }
        }

        // Get the incoming form data (audio file + params)
        const formData = await req.formData();
        const audioFile = formData.get('file');
        const languageCode = formData.get('language_code') || 'unknown';
        const mode = formData.get('mode') || 'translate';

        if (!audioFile) {
            return new Response(JSON.stringify({ error: 'No audio file provided' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Build request to Sarvam AI
        const sarvamApiKey = Deno.env.get('SARVAM_API_KEY');
        if (!sarvamApiKey) {
            return new Response(JSON.stringify({ error: 'STT service not configured' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const sarvamFormData = new FormData();
        sarvamFormData.append('file', audioFile);
        sarvamFormData.append('model', 'saaras:v3');
        if (languageCode && languageCode !== 'unknown') {
            sarvamFormData.append('language_code', languageCode);
        }
        sarvamFormData.append('mode', mode);

        const startTime = Date.now();

        const sarvamResponse = await fetch('https://api.sarvam.ai/speech-to-text-translate', {
            method: 'POST',
            headers: {
                'api-subscription-key': sarvamApiKey,
            },
            body: sarvamFormData,
        });

        const latencyMs = Date.now() - startTime;

        if (!sarvamResponse.ok) {
            const errorText = await sarvamResponse.text();
            // Log the error
            await supabase.from('usage_logs').insert({
                user_id: user.id,
                event_type: 'stt_error',
                language_code: languageCode,
                stt_latency_ms: latencyMs,
                metadata: { error: errorText, status: sarvamResponse.status },
            });

            return new Response(JSON.stringify({ error: `STT failed: ${errorText}` }), {
                status: sarvamResponse.status,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const sarvamData = await sarvamResponse.json();

        // Log successful usage and decrement credits
        await Promise.all([
            supabase.from('usage_logs').insert({
                user_id: user.id,
                event_type: 'stt_call',
                language_code: sarvamData.language_code || languageCode,
                stt_latency_ms: latencyMs,
                metadata: {
                    transcript_length: sarvamData.transcript?.length || 0,
                    mode,
                },
            }),
            supabase.rpc('decrement_credits', { user_id_input: user.id }),
        ]);

        return new Response(JSON.stringify({
            transcript: sarvamData.transcript || '',
            language_code: sarvamData.language_code || null,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err) {
        console.error('Transcribe function error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
