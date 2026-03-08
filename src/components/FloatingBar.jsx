import { useState, useEffect, useCallback, useRef, forwardRef, useImperativeHandle } from 'react';
import { Mic, Square, X, Loader } from 'lucide-react';
import Waveform from './Waveform';
import audioService from '../services/audioService';
import { transcribeWithSarvam } from '../services/sttService';
import { structurePrompt } from '../services/promptService';
import { getSettings } from '../services/storageService';

/**
 * Floating Command Bar — the hero component.
 * Recording interface with waveform, timer, and live transcription.
 * Now uses Supabase Edge Functions for STT and LLM (no API keys needed).
 */
const FloatingBar = forwardRef(({ isOpen, onClose, onPromptReady, onToast }, ref) => {
    const [state, setState] = useState('idle'); // idle | recording | processing | structuring
    const [timer, setTimer] = useState(0);
    const [transcript, setTranscript] = useState('');
    const [interimText, setInterimText] = useState('');
    const timerRef = useRef(null);
    const webSpeechRef = useRef(null);
    const transcriptRef = useRef('');

    // Expose stopRecording to parent component
    useImperativeHandle(ref, () => ({
        stopRecording: () => {
            if (state === 'recording') {
                stopRecording();
            }
        }
    }), [state]);

    // Format timer as MM:SS
    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

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
            startWebSpeechRecognition(settings.language || 'hi-IN');
        }
        // Note: Sarvam streaming would need its own Edge Function for WebSocket proxying
        // For now, we use the sync API via Edge Function on stop
    }, [onToast]);

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
        };

        recognition.onend = () => {
            // Recognition ended naturally
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
        const streamingTranscript = transcriptRef.current;

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
            } else {
                // Use Sarvam AI via Edge Function (no API key needed)
                result = await transcribeWithSarvam(audioBlob, {
                    languageCode: settings.language || 'unknown',
                    mode: settings.sttMode || 'translate',
                });
            }

            if (!result.transcript || result.transcript.trim().length === 0) {
                onToast('Could not detect speech. Please try again.', 'error');
                setState('idle');
                return;
            }

            setTranscript(result.transcript);

            // Step 2: Structure with LLM via Edge Function
            setState('structuring');

            const structured = await structurePrompt(
                result.transcript,
                settings.llmProvider || 'gemini'
            );

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
    }, [onClose, onPromptReady, onToast]);

    // Cancel recording
    const cancelRecording = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        stopWebSpeechRecognition();
        audioService.cleanup();
        setState('idle');
        setTimer(0);
        setTranscript('');
        setInterimText('');
        transcriptRef.current = '';
        onClose();
    }, [onClose]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            stopWebSpeechRecognition();
            audioService.cleanup();
        };
    }, []);

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
                            {isWebSpeech ? '🌐 Web Speech' : '🌐 Sarvam AI'}
                        </span>
                    </div>

                    {/* Waveform */}
                    {!isProcessing && (
                        <Waveform audioService={audioService} isActive={isRecording} />
                    )}

                    {/* Live transcript (Web Speech only — Sarvam uses sync API) */}
                    {isRecording && isWebSpeech && (transcript || interimText) && (
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
                                    ? (isWebSpeech ? 'Processing transcript...' : 'Transcribing with Sarvam AI...')
                                    : 'Structuring your prompt with AI...'}
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
});

export default FloatingBar;
