// ========================================
// STT Service — Sarvam AI Integration
// ========================================

const SARVAM_API_URL = 'https://api.sarvam.ai/speech-to-text-translate';

/**
 * Transcribe audio using Sarvam AI's Saaras v3 model.
 * Uses 'translate' mode to convert speech from any Indian language to English.
 *
 * @param {Blob} audioBlob - The audio blob to transcribe
 * @param {string} apiKey - Sarvam AI API key
 * @param {object} options - Additional options
 * @param {string} options.languageCode - BCP-47 language code (default: 'unknown' for auto-detect)
 * @param {string} options.mode - Mode: 'transcribe' | 'translate' | 'verbatim' | 'translit' | 'codemix'
 * @returns {Promise<{transcript: string, languageDetected: string|null, confidence: number}>}
 */
export async function transcribeWithSarvam(audioBlob, apiKey, options = {}) {
    const { languageCode = 'unknown', mode = 'translate' } = options;

    if (!apiKey) {
        throw new Error('Sarvam AI API key is required. Add it in Settings.');
    }

    // Build multipart form data
    const formData = new FormData();

    // Determine file extension from blob type
    const ext = audioBlob.type.includes('webm') ? 'webm' :
        audioBlob.type.includes('wav') ? 'wav' :
            audioBlob.type.includes('mp3') ? 'mp3' : 'webm';

    formData.append('file', audioBlob, `recording.${ext}`);
    formData.append('model', 'saaras:v3');
    formData.append('language_code', languageCode);
    formData.append('mode', mode);

    try {
        const response = await fetch(SARVAM_API_URL, {
            method: 'POST',
            headers: {
                'api-subscription-key': apiKey,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.message || `Sarvam AI API error: ${response.status} ${response.statusText}`
            );
        }

        const data = await response.json();

        return {
            transcript: data.transcript || '',
            languageDetected: data.language_code || null,
            confidence: estimateConfidence(data.transcript),
        };
    } catch (err) {
        if (err.message.includes('API key')) throw err;
        console.error('Sarvam AI STT error:', err);
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
    let score = 0.7; // base score

    // Longer transcripts generally more reliable
    if (length > 20) score += 0.05;
    if (length > 50) score += 0.05;
    if (length > 100) score += 0.05;

    // Contains technical terms
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
