import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, Square, X, Loader } from 'lucide-react';
import Waveform from './Waveform';
import audioService from '../services/audioService';
import { transcribeWithSarvam } from '../services/sttService';
import { transcribeWithWebSpeech } from '../services/sttService';
import { SarvamStreamingSTT } from '../services/sttStreamingService';
import { structurePrompt } from '../services/promptService';
import { getSettings } from '../services/storageService';

/**
 * Floating Command Bar — the hero component.
 * Recording interface with waveform, timer, language detection, and multi-provider STT.
 * Supports real-time streaming transcription via Sarvam AI WebSocket API.
 */
export default function FloatingBar({ isOpen, onClose, onPromptReady, onToast }) {
    const [state, setState] = useState('idle'); // idle | recording | processing | structuring
    const [timer, setTimer] = useState(0);
    const [transcript, setTranscript] = useState('');
    const [interimText, setInterimText] = useState('');
    const timerRef = useRef(null);
    const webSpeechRef = useRef(null);
    const streamingSTTRef = useRef(null);
    const transcriptRef = useRef(''); // Ref to track transcript without stale closures

    // Format timer as MM:SS
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // Start Sarvam streaming STT
    const startSarvamStreaming = useCallback(async (settings) => {
        const apiKey = settings.sarvamApiKey;
        if (!apiKey) {
            console.warn('[FloatingBar] No Sarvam API key — skipping streaming');
            return false;
        }

        try {
            const stt = new SarvamStreamingSTT({
                apiKey,
                languageCode: settings.language || 'unknown',
                mode: settings.sttMode || 'translate',
                onTranscript: (data) => {
                    if (data.isFinal) {
                        transcriptRef.current = data.fullText;
                        setTranscript(data.fullText);
                        setInterimText('');
                    } else {
                        setInterimText(data.text);
                    }
                },
                onError: (err) => {
                    console.error('[FloatingBar] Streaming STT error:', err);
                    // Don't show toast for every error — the connection might recover
                },
                onClose: ({ code, reason }) => {
                    console.log('[FloatingBar] Streaming STT closed:', code, reason);
                },
                onOpen: () => {
                    console.log('[FloatingBar] Streaming STT connected — starting PCM capture');
                    // Start feeding PCM audio to the WebSocket
                    audioService.startStreamingCapture((pcmChunk) => {
                        if (streamingSTTRef.current) {
                            streamingSTTRef.current.sendAudio(pcmChunk);
                        }
                    });
                },
            });

            streamingSTTRef.current = stt;
            await stt.connect();
            return true;
        } catch (err) {
            console.error('[FloatingBar] Failed to start streaming STT:', err);
            streamingSTTRef.current = null;
            return false;
        }
    }, []);

    // Stop Sarvam streaming STT
    const stopSarvamStreaming = useCallback(() => {
        audioService.stopStreamingCapture();
        if (streamingSTTRef.current) {
            streamingSTTRef.current.close();
            streamingSTTRef.current = null;
        }
    }, []);

    // Start recording
    const startRecording = useCallback(async () => {
        const micAccess = await audioService.requestMicAccess();
        if (!micAccess) {
            onToast('Microphone access denied. Please allow mic access.', 'error');
            return;
        }

        const started = audioService.startRecording();
        if (!started) {
            onToast('Failed to start recording.', 'error');
            return;
        }

        setState('recording');
        setTimer(0);
        setTranscript('');
        setInterimText('');
        transcriptRef.current = '';

        timerRef.current = setInterval(() => {
            setTimer(t => t + 1);
        }, 1000);

        const settings = getSettings();

        if (settings.sttProvider === 'webspeech') {
            // Use browser Web Speech API for live recognition
            startWebSpeechRecognition(settings.language || 'hi-IN');
        } else if (settings.sttProvider === 'sarvam' && settings.sarvamApiKey) {
            // Use Sarvam AI WebSocket streaming for live recognition
            const streamingStarted = await startSarvamStreaming(settings);
            if (!streamingStarted) {
                console.warn('[FloatingBar] Streaming failed to start — will fall back to sync API on stop');
            }
        }
    }, [onToast, startSarvamStreaming]);

    // Start Web Speech recognition for live transcript
    const startWebSpeechRecognition = (lang) => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.lang = lang === 'unknown' ? 'hi-IN' : lang;
        recognition.interimResults = true;
        recognition.continuous = true;
        recognition.maxAlternatives = 1;

        let fullTranscript = '';

        recognition.onresult = (event) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    fullTranscript += result[0].transcript + ' ';
                    setTranscript(fullTranscript.trim());
                    transcriptRef.current = fullTranscript.trim();
                } else {
                    interim += result[0].transcript;
                }
            }
            setInterimText(interim);
        };

        recognition.onerror = (event) => {
            console.warn('Web Speech error:', event.error);
            if (event.error !== 'no-speech') {
                // Silently handle — user can still use Sarvam as fallback
            }
        };

        recognition.onend = () => {
            // Only restart if still recording 
            if (webSpeechRef.current === recognition) {
                // Recognition ended naturally — don't restart
            }
        };

        recognition.start();
        webSpeechRef.current = recognition;
    };

    // Stop Web Speech recognition
    const stopWebSpeechRecognition = () => {
        if (webSpeechRef.current) {
            try {
                webSpeechRef.current.stop();
            } catch { /* ignore */ }
            webSpeechRef.current = null;
        }
    };

    // Stop recording & process
    const stopRecording = useCallback(async () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        stopWebSpeechRecognition();
        const hadStreaming = !!streamingSTTRef.current;
        const streamingTranscript = transcriptRef.current;
        stopSarvamStreaming();

        setState('processing');

        try {
            const audioBlob = await audioService.stopRecording();
            const settings = getSettings();

            if (!audioBlob || audioBlob.size === 0) {
                onToast('No audio recorded. Try again.', 'error');
                setState('idle');
                return;
            }

            let result;

            if (settings.sttProvider === 'webspeech') {
                // Use the transcript we've already gathered via live recognition
                const wsTranscript = streamingTranscript || '';
                if (!wsTranscript.trim()) {
                    onToast('Could not detect speech. Try again or switch to Sarvam AI.', 'error');
                    setState('idle');
                    return;
                }
                result = {
                    transcript: wsTranscript,
                    languageDetected: settings.language || 'hi-IN',
                    confidence: 0.75,
                };
            } else if (settings.sttProvider === 'sarvam' && settings.sarvamApiKey) {
                if (hadStreaming && streamingTranscript.trim()) {
                    // ✅ We already have a real-time transcript from WebSocket — use it directly
                    console.log('[FloatingBar] Using streaming transcript:', streamingTranscript);
                    result = {
                        transcript: streamingTranscript,
                        languageDetected: settings.language || 'unknown',
                        confidence: 0.85,
                    };
                } else {
                    // Fallback: streaming didn't work — use sync REST API
                    console.log('[FloatingBar] Falling back to sync Sarvam API');
                    result = await transcribeWithSarvam(audioBlob, settings.sarvamApiKey, {
                        languageCode: settings.language || 'unknown',
                        mode: settings.sttMode || 'translate',
                    });
                }
            } else {
                onToast('Configure an STT provider in Settings (Sarvam AI API key or Web Speech).', 'error');
                setState('idle');
                return;
            }

            if (!result.transcript || result.transcript.trim().length === 0) {
                onToast('Could not detect speech. Please try again.', 'error');
                setState('idle');
                return;
            }

            setTranscript(result.transcript);

            // Step 2: Structure with Gemini
            setState('structuring');

            if (!settings.geminiApiKey) {
                // No Gemini key — return raw transcript as prompt
                onPromptReady({
                    title: 'Voice Prompt',
                    summary: result.transcript,
                    requirements: [],
                    acceptance_criteria: [],
                    constraints: [],
                    examples: [],
                    original_transcript: result.transcript,
                    confidence: result.confidence,
                    languageDetected: result.languageDetected,
                });
                setState('idle');
                onClose();
                onToast('Prompt saved (without AI structuring — add Gemini key for better results)', 'info');
                return;
            }

            const structured = await structurePrompt(result.transcript, settings.geminiApiKey);

            // Deliver the structured prompt
            onPromptReady({
                ...structured,
                original_transcript: result.transcript,
                confidence: result.confidence,
                languageDetected: result.languageDetected,
            });

            setState('idle');
            onClose();
            onToast('Prompt ready! ✨', 'success');

        } catch (err) {
            console.error('Processing error:', err);
            onToast(err.message || 'Something went wrong.', 'error');
            setState('idle');
        }
    }, [onClose, onPromptReady, onToast, stopSarvamStreaming]);

    // Cancel recording
    const cancelRecording = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        stopWebSpeechRecognition();
        stopSarvamStreaming();
        audioService.cleanup();
        setState('idle');
        setTimer(0);
        setTranscript('');
        setInterimText('');
        transcriptRef.current = '';
        onClose();
    }, [onClose, stopSarvamStreaming]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            stopWebSpeechRecognition();
            stopSarvamStreaming();
            audioService.cleanup();
        };
    }, [stopSarvamStreaming]);

    // Start recording when bar opens
    useEffect(() => {
        if (isOpen && state === 'idle') {
            startRecording();
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const isRecording = state === 'recording';
    const isProcessing = state === 'processing' || state === 'structuring';
    const settings = getSettings();
    const isWebSpeech = settings.sttProvider === 'webspeech';
    const isSarvamStreaming = settings.sttProvider === 'sarvam' && !!streamingSTTRef.current;

    return (
        <div className="floating-bar-overlay" onClick={cancelRecording}>
            <div
                className={`floating-bar ${isRecording ? 'recording' : ''}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="floating-bar-header">
                    <div>
                        <div className="floating-bar-title">
                            {isRecording ? '🎙️ Recording...' :
                                state === 'processing' ? '🔄 Transcribing...' :
                                    state === 'structuring' ? '✨ Structuring prompt...' :
                                        '🎤 Ready'}
                        </div>
                    </div>
                    <button
                        className="floating-bar-close"
                        onClick={cancelRecording}
                        title="Cancel (Esc)"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="floating-bar-body">
                    {/* Timer & Language */}
                    <div className="recording-info">
                        <span className={`recording-timer ${isRecording ? 'active' : ''}`}>
                            {formatTime(timer)}
                        </span>
                        <span className="language-chip">
                            {isWebSpeech ? '🌐 Web Speech' : isSarvamStreaming ? '🔴 Live Streaming' : '🌐 Auto-detect'}
                        </span>
                    </div>

                    {/* Waveform */}
                    {!isProcessing && (
                        <Waveform audioService={audioService} isActive={isRecording} />
                    )}

                    {/* Live transcript (Web Speech or Sarvam Streaming) */}
                    {isRecording && (isWebSpeech || isSarvamStreaming) && (transcript || interimText) && (
                        <div className="transcript-box" style={{ width: '100%' }}>
                            <p>
                                {transcript}
                                {interimText && <span style={{ opacity: 0.5 }}> {interimText}</span>}
                            </p>
                        </div>
                    )}

                    {/* Processing State */}
                    {isProcessing && (
                        <div className="processing-state">
                            <div className="processing-dots">
                                <div className="processing-dot" />
                                <div className="processing-dot" />
                                <div className="processing-dot" />
                            </div>
                            <p className="processing-text">
                                {state === 'processing'
                                    ? (isWebSpeech ? 'Processing transcript...' : 'Sending to Sarvam AI for transcription...')
                                    : 'Gemini is structuring your prompt...'}
                            </p>
                            {transcript && (
                                <div className="transcript-box" style={{ width: '100%' }}>
                                    <p>"{transcript}"</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Controls */}
                    <div className="floating-bar-controls">
                        {isRecording ? (
                            <>
                                <button className="btn btn-secondary" onClick={cancelRecording}>
                                    Cancel
                                </button>
                                <button
                                    className="record-btn recording"
                                    onClick={stopRecording}
                                    title="Stop recording"
                                >
                                    <Square size={24} fill="white" />
                                </button>
                                <div style={{ width: 80 }} /> {/* spacer */}
                            </>
                        ) : isProcessing ? (
                            <div className="spinner" />
                        ) : (
                            <button
                                className="record-btn"
                                onClick={startRecording}
                                title="Start recording"
                            >
                                <Mic size={28} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
