// ========================================
// STT Service — Supabase Edge Function Proxy
// ========================================

import { supabase, getAccessToken } from './supabaseClient';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/**
 * Helper: call the transcribe Edge Function with given token + formData
 */
async function callTranscribeFunction(token, formData) {
    return fetch(`${SUPABASE_URL}/functions/v1/transcribe`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
    });
}

/**
 * Transcribe audio using Sarvam AI via Supabase Edge Function.
 * API key is stored server-side — no key needed on the client.
 *
 * @param {Blob} audioBlob - The audio blob to transcribe
 * @param {object} options - Additional options
 * @param {string} options.languageCode - BCP-47 language code (default: 'unknown')
 * @param {string} options.mode - Mode: 'transcribe' | 'translate' | 'codemix'
 * @returns {Promise<{transcript: string, languageDetected: string|null, confidence: number}>}
 */
export async function transcribeWithSarvam(audioBlob, options = {}) {
    const { languageCode = 'unknown', mode = 'translate' } = options;

    // Build multipart form data
    const formData = new FormData();

    // Determine clean MIME type and extension
    let cleanMime = 'audio/webm';
    let ext = 'webm';
    if (audioBlob.type.includes('wav')) { cleanMime = 'audio/wav'; ext = 'wav'; }
    else if (audioBlob.type.includes('mp3') || audioBlob.type.includes('mpeg')) { cleanMime = 'audio/mpeg'; ext = 'mp3'; }
    else if (audioBlob.type.includes('webm')) { cleanMime = 'audio/webm'; ext = 'webm'; }

    const cleanBlob = new Blob([audioBlob], { type: cleanMime });

    formData.append('file', cleanBlob, `recording.${ext}`);
    if (languageCode && languageCode !== 'unknown') {
        formData.append('language_code', languageCode);
    }
    formData.append('mode', mode);

    console.log('[STT] Sending to Edge Function:', {
        fileSize: cleanBlob.size,
        fileType: cleanBlob.type,
        languageCode,
        mode,
    });

    try {
        let token = await getAccessToken();
        if (!token) {
            throw new Error('Not authenticated. Please sign in.');
        }

        let response = await callTranscribeFunction(token, formData);

        // If 401, try refreshing the session and retry once
        if (response.status === 401) {
            console.warn('[STT] Got 401 — refreshing session and retrying…');
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError || !refreshData.session) {
                throw new Error('Session expired. Please sign in again.');
            }
            token = refreshData.session.access_token;
            response = await callTranscribeFunction(token, formData);
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
            throw new Error(`Transcription failed: ${errorMsg}`);
        }

        const data = await response.json();

        return {
            transcript: data.transcript || '',
            languageDetected: data.language_code || null,
            confidence: estimateConfidence(data.transcript),
        };
    } catch (err) {
        console.error('STT error:', err);
        throw new Error(`Speech-to-text failed: ${err.message}`);
    }
}

/**
 * Fallback: Use Web Speech API (browser built-in, free)
 */
export function transcribeWithWebSpeech(languageHint = 'hi-IN') {
    return new Promise((resolve, reject) => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            reject(new Error('Web Speech API not supported in this browser.'));
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = languageHint;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.continuous = false;

        recognition.onresult = (event) => {
            const result = event.results[0][0];
            resolve({
                transcript: result.transcript,
                languageDetected: languageHint,
                confidence: result.confidence || 0.8,
            });
        };

        recognition.onerror = (event) => {
            reject(new Error(`Speech recognition error: ${event.error}`));
        };

        recognition.onend = () => {
            // If no result was received
        };

        recognition.start();
    });
}

/**
 * Estimate confidence based on transcript quality heuristics
 */
function estimateConfidence(transcript) {
    if (!transcript) return 0;

    const length = transcript.length;
    let score = 0.7;

    if (length > 20) score += 0.05;
    if (length > 50) score += 0.05;
    if (length > 100) score += 0.05;

    const techTerms = /\b(api|function|component|database|server|client|react|node|express|python|class|method|variable|array|object|string|integer|boolean|import|export|return|async|await)\b/gi;
    const matches = transcript.match(techTerms);
    if (matches && matches.length > 0) score += 0.05;

    return Math.min(score, 0.98);
}

// Language options for the settings UI
export const SUPPORTED_LANGUAGES = [
    { code: 'unknown', label: 'Auto-detect', labelHi: 'स्वतः पहचानें' },
    { code: 'hi-IN', label: 'Hindi', labelHi: 'हिंदी' },
    { code: 'en-IN', label: 'English (India)', labelHi: 'अंग्रेज़ी' },
    { code: 'bn-IN', label: 'Bengali', labelHi: 'বাংলা' },
    { code: 'ta-IN', label: 'Tamil', labelHi: 'தமிழ்' },
    { code: 'te-IN', label: 'Telugu', labelHi: 'తెలుగు' },
    { code: 'kn-IN', label: 'Kannada', labelHi: 'ಕನ್ನಡ' },
    { code: 'ml-IN', label: 'Malayalam', labelHi: 'മലയാളം' },
    { code: 'mr-IN', label: 'Marathi', labelHi: 'मराठी' },
    { code: 'gu-IN', label: 'Gujarati', labelHi: 'ગુજરાતી' },
    { code: 'pa-IN', label: 'Punjabi', labelHi: 'ਪੰਜਾਬੀ' },
    { code: 'od-IN', label: 'Odia', labelHi: 'ଓଡ଼ିଆ' },
    { code: 'ur-IN', label: 'Urdu', labelHi: 'اردو' },
];
