// ========================================
// STT Streaming Service — Sarvam AI WebSocket
// Real-time speech-to-text via WebSocket
// ========================================

const WS_BASE_URL = 'wss://api.sarvam.ai/speech-to-text/ws';

/**
 * SarvamStreamingSTT manages a WebSocket connection to Sarvam AI's
 * streaming speech-to-text endpoint for real-time transcription.
 *
 * Usage:
 *   const stt = new SarvamStreamingSTT({ apiKey, onTranscript, onError, onClose });
 *   await stt.connect();
 *   // ... feed PCM audio chunks via stt.sendAudio(int16Array)
 *   stt.close();
 */
export class SarvamStreamingSTT {
    constructor({
        apiKey,
        languageCode = 'unknown',
        mode = 'translate',
        model = 'saaras:v3',
        sampleRate = 16000,
        onTranscript = () => { },
        onFinalTranscript = () => { },
        onError = () => { },
        onClose = () => { },
        onOpen = () => { },
    }) {
        this.apiKey = apiKey;
        this.languageCode = languageCode;
        this.mode = mode;
        this.model = model;
        this.sampleRate = sampleRate;

        // Callbacks
        this.onTranscript = onTranscript;
        this.onFinalTranscript = onFinalTranscript;
        this.onError = onError;
        this.onClose = onClose;
        this.onOpen = onOpen;

        // Internal state
        this.ws = null;
        this.isConnected = false;
        this.fullTranscript = '';
    }

    /**
     * Connect to Sarvam AI WebSocket streaming endpoint.
     * Returns a promise that resolves when the connection is open.
     */
    connect() {
        return new Promise((resolve, reject) => {
            if (this.ws) {
                this.close();
            }

            // Build WebSocket URL with auth & config as query params
            // (browser WebSocket API doesn't support custom headers)
            const params = new URLSearchParams({
                api_subscription_key: this.apiKey,
                model: this.model,
                language_code: this.languageCode,
                mode: this.mode,
                input_audio_codec: 'pcm_s16le',
                sample_rate: String(this.sampleRate),
            });

            const wsUrl = `${WS_BASE_URL}?${params.toString()}`;

            console.log('[Streaming STT] Connecting to:', WS_BASE_URL, { model: this.model, mode: this.mode, language: this.languageCode });

            this.ws = new WebSocket(wsUrl);
            this.ws.binaryType = 'arraybuffer';

            const connectionTimeout = setTimeout(() => {
                if (!this.isConnected) {
                    this.ws?.close();
                    reject(new Error('WebSocket connection timed out (10s)'));
                }
            }, 10000);

            this.ws.onopen = () => {
                clearTimeout(connectionTimeout);
                this.isConnected = true;
                this.fullTranscript = '';
                console.log('[Streaming STT] Connected ✓');
                this.onOpen();
                resolve();
            };

            this.ws.onmessage = (event) => {
                this._handleMessage(event);
            };

            this.ws.onerror = (event) => {
                clearTimeout(connectionTimeout);
                console.error('[Streaming STT] WebSocket error:', event);
                this.onError(new Error('WebSocket connection error'));
                if (!this.isConnected) {
                    reject(new Error('WebSocket connection failed'));
                }
            };

            this.ws.onclose = (event) => {
                clearTimeout(connectionTimeout);
                console.log('[Streaming STT] Connection closed:', event.code, event.reason);
                this.isConnected = false;
                this.onClose({ code: event.code, reason: event.reason });
                if (!this.isConnected && !event.wasClean) {
                    reject(new Error(`WebSocket closed unexpectedly: ${event.code}`));
                }
            };
        });
    }

    /**
     * Send raw PCM Int16 audio data to the WebSocket.
     * @param {Int16Array} pcmData - Raw PCM Int16 samples at 16kHz mono
     */
    sendAudio(pcmData) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return false;
        }

        try {
            // Send the raw bytes of the Int16Array
            this.ws.send(pcmData.buffer);
            return true;
        } catch (err) {
            console.error('[Streaming STT] Error sending audio:', err);
            return false;
        }
    }

    /**
     * Close the WebSocket connection gracefully.
     * Returns the accumulated full transcript.
     */
    close() {
        if (this.ws) {
            try {
                if (this.ws.readyState === WebSocket.OPEN) {
                    // Send empty binary frame to signal end of audio
                    this.ws.send(new ArrayBuffer(0));
                }
                // Small delay to let the server send final transcript
                setTimeout(() => {
                    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
                        this.ws.close(1000, 'Recording stopped');
                    }
                    this.ws = null;
                    this.isConnected = false;
                }, 500);
            } catch (err) {
                console.warn('[Streaming STT] Error during close:', err);
                this.ws = null;
                this.isConnected = false;
            }
        }
        return this.fullTranscript;
    }

    /**
     * Force-close immediately without waiting.
     */
    destroy() {
        if (this.ws) {
            try {
                this.ws.close(1000);
            } catch { /* ignore */ }
            this.ws = null;
        }
        this.isConnected = false;
    }

    /**
     * Get the full accumulated transcript so far.
     */
    getTranscript() {
        return this.fullTranscript;
    }

    /**
     * Handle incoming WebSocket messages.
     */
    _handleMessage(event) {
        try {
            if (typeof event.data === 'string') {
                const data = JSON.parse(event.data);

                // Sarvam sends objects with "transcript" for final segments
                // and potentially "partial_transcript" for interim results
                if (data.transcript) {
                    this.fullTranscript += (this.fullTranscript ? ' ' : '') + data.transcript;
                    this.onFinalTranscript(data.transcript, this.fullTranscript);
                    this.onTranscript({
                        text: data.transcript,
                        fullText: this.fullTranscript,
                        isFinal: true,
                        languageCode: data.language_code || null,
                    });
                } else if (data.partial_transcript) {
                    this.onTranscript({
                        text: data.partial_transcript,
                        fullText: this.fullTranscript,
                        isFinal: false,
                        languageCode: data.language_code || null,
                    });
                }

                // Handle error messages from the server
                if (data.error) {
                    console.error('[Streaming STT] Server error:', data.error);
                    this.onError(new Error(`Sarvam streaming error: ${data.error.message || data.error}`));
                }
            }
        } catch (err) {
            console.warn('[Streaming STT] Failed to parse message:', err);
        }
    }
}

export default SarvamStreamingSTT;
