import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, Square, X, Loader } from 'lucide-react';
import Waveform from './Waveform';
import audioService from '../services/audioService';
import { transcribeWithSarvam } from '../services/sttService';
import { structurePrompt } from '../services/promptService';
import { getSettings } from '../services/storageService';

/**
 * Floating Command Bar — the hero component.
 * Recording interface with waveform, timer, and language detection.
 */
export default function FloatingBar({ isOpen, onClose, onPromptReady, onToast }) {
    const [state, setState] = useState('idle'); // idle | recording | processing | structuring
    const [timer, setTimer] = useState(0);
    const [transcript, setTranscript] = useState('');
    const timerRef = useRef(null);

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

        timerRef.current = setInterval(() => {
            setTimer(t => t + 1);
        }, 1000);
    }, [onToast]);

    // Stop recording & process
    const stopRecording = useCallback(async () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        setState('processing');

        try {
            const audioBlob = await audioService.stopRecording();

            if (!audioBlob || audioBlob.size === 0) {
                onToast('No audio recorded. Try again.', 'error');
                setState('idle');
                return;
            }

            // Step 1: Speech to Text
            const settings = getSettings();
            let result;

            if (settings.sttProvider === 'sarvam' && settings.sarvamApiKey) {
                result = await transcribeWithSarvam(audioBlob, settings.sarvamApiKey, {
                    languageCode: settings.language || 'unknown',
                    mode: settings.sttMode || 'translate',
                });
            } else {
                // Fallback: if no Sarvam key, show error
                onToast('Sarvam AI API key required. Add it in Settings.', 'error');
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
                onToast('Gemini API key required for prompt structuring. Add it in Settings.', 'error');
                // Still return the raw transcript
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
    }, [onClose, onPromptReady, onToast]);

    // Cancel recording
    const cancelRecording = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        audioService.cleanup();
        setState('idle');
        setTimer(0);
        setTranscript('');
        onClose();
    }, [onClose]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
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
                            🌐 Auto-detect
                        </span>
                    </div>

                    {/* Waveform */}
                    {!isProcessing && (
                        <Waveform audioService={audioService} isActive={isRecording} />
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
                                    ? 'Sending to Sarvam AI for transcription...'
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
