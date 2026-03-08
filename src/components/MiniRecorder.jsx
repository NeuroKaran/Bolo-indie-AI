import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, Square, X, Loader } from 'lucide-react';
import Waveform from './Waveform';
import audioService from '../services/audioService';
import { transcribeWithSarvam } from '../services/sttService';
import { structurePrompt } from '../services/promptService';
import { getSettings, savePrompt } from '../services/storageService';
import { copyPromptToClipboard } from '../services/clipboardService';
import { v4 as uuidv4 } from 'uuid';

/**
 * MiniRecorder — Compact floating recorder popup.
 * Renders in a small, frameless Tauri window.
 * Auto-starts recording on mount, processes audio, saves prompt, and closes.
 */
export default function MiniRecorder() {
    const [state, setState] = useState('idle'); // idle | recording | processing | structuring | done
    const [timer, setTimer] = useState(0);
    const [transcript, setTranscript] = useState('');
    const [interimText, setInterimText] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const timerRef = useRef(null);
    const webSpeechRef = useRef(null);
    const transcriptRef = useRef('');
    const hasStartedRef = useRef(false);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // Close the popup window
    const closePopup = useCallback(async () => {
        try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            const win = getCurrentWindow();
            await win.close();
        } catch {
            // Fallback for non-Tauri env
            window.close();
        }
    }, []);

    // Web Speech recognition
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
        recognition.onend = () => { };
        recognition.start();
        webSpeechRef.current = recognition;
    };

    const stopWebSpeechRecognition = () => {
        if (webSpeechRef.current) {
            try { webSpeechRef.current.stop(); } catch { /* ignore */ }
            webSpeechRef.current = null;
        }
    };

    // Start recording
    const startRecording = useCallback(async () => {
        const micAccess = await audioService.requestMicAccess();
        if (!micAccess) {
            setStatusMessage('Microphone access denied');
            setTimeout(closePopup, 2000);
            return;
        }

        const started = audioService.startRecording();
        if (!started) {
            setStatusMessage('Failed to start recording');
            setTimeout(closePopup, 2000);
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
    }, [closePopup]);

    // Stop recording & process
    const stopRecording = useCallback(async () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        stopWebSpeechRecognition();
        const streamingTranscript = transcriptRef.current;

        setState('processing');
        setStatusMessage('Transcribing...');

        try {
            const audioBlob = await audioService.stopRecording();
            const settings = getSettings();

            if (!audioBlob || audioBlob.size === 0) {
                setStatusMessage('No audio recorded');
                setTimeout(closePopup, 1500);
                return;
            }

            let result;

            if (settings.sttProvider === 'webspeech') {
                const wsTranscript = streamingTranscript || '';
                if (!wsTranscript.trim()) {
                    setStatusMessage('No speech detected');
                    setTimeout(closePopup, 1500);
                    return;
                }
                result = {
                    transcript: wsTranscript,
                    languageDetected: settings.language || 'hi-IN',
                    confidence: 0.75,
                };
            } else {
                result = await transcribeWithSarvam(audioBlob, {
                    languageCode: settings.language || 'unknown',
                    mode: settings.sttMode || 'translate',
                });
            }

            if (!result.transcript || result.transcript.trim().length === 0) {
                setStatusMessage('No speech detected');
                setTimeout(closePopup, 1500);
                return;
            }

            setTranscript(result.transcript);

            // Structure with LLM via Edge Function
            setState('structuring');
            setStatusMessage('Structuring prompt...');

            const structured = await structurePrompt(
                result.transcript,
                settings.llmProvider || 'gemini'
            );

            const promptData = {
                ...structured,
                original_transcript: result.transcript,
                confidence: result.confidence,
                languageDetected: result.languageDetected,
            };

            // Save prompt to storage
            const prompt = {
                ...promptData,
                promptId: uuidv4(),
                createdAt: new Date().toISOString(),
            };
            savePrompt(prompt);

            // Auto-copy if enabled
            if (settings.autoCopy) {
                await copyPromptToClipboard(prompt);
            }

            // Emit event to main window so it can refresh
            try {
                const { emit } = await import('@tauri-apps/api/event');
                await emit('prompt-ready', prompt);
            } catch { /* ignore */ }

            setState('done');
            setStatusMessage('Prompt saved! ✨');

            // Close popup after a brief pause
            setTimeout(closePopup, 1200);

        } catch (err) {
            console.error('Processing error:', err);
            setStatusMessage(err.message || 'Something went wrong');
            setTimeout(closePopup, 2000);
        }
    }, [closePopup]);

    // Cancel recording
    const cancelRecording = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        stopWebSpeechRecognition();
        audioService.cleanup();
        closePopup();
    }, [closePopup]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            stopWebSpeechRecognition();
            audioService.cleanup();
        };
    }, []);

    // Auto-start recording on mount
    useEffect(() => {
        if (!hasStartedRef.current) {
            hasStartedRef.current = true;
            startRecording();
        }
    }, [startRecording]);

    // Listen for toggle-recording event (Ctrl+Space pressed again to stop)
    useEffect(() => {
        let unlisten;
        const isTauri = !!window.__TAURI__;
        if (isTauri) {
            import('@tauri-apps/api/event').then(({ listen }) => {
                listen('toggle-recording', () => {
                    if (state === 'recording') {
                        stopRecording();
                    }
                }).then(fn => { unlisten = fn; });
            });
        }
        return () => { if (unlisten) unlisten(); };
    }, [state, stopRecording]);

    // Escape key to cancel
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') cancelRecording();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cancelRecording]);

    const isRecording = state === 'recording';
    const isProcessing = state === 'processing' || state === 'structuring';
    const isDone = state === 'done';
    const settings = getSettings();
    const isWebSpeech = settings.sttProvider === 'webspeech';

    return (
        <div className="mini-recorder" data-tauri-drag-region>
            {/* Top accent bar */}
            <div className={`mini-recorder-accent ${isRecording ? 'recording' : isDone ? 'done' : ''}`} />

            {/* Header */}
            <div className="mini-recorder-header">
                <div className="mini-recorder-title">
                    {isRecording ? '🎙️ Recording...' :
                        state === 'processing' ? '🔄 Transcribing...' :
                            state === 'structuring' ? '✨ Structuring...' :
                                isDone ? '✅ Done!' :
                                    '🎤 Starting...'}
                </div>
                <button
                    className="mini-recorder-close"
                    onClick={cancelRecording}
                    title="Cancel (Esc)"
                >
                    <X size={14} />
                </button>
            </div>

            {/* Body */}
            <div className="mini-recorder-body">
                {/* Timer & Status */}
                <div className="mini-recorder-info">
                    <span className={`recording-timer ${isRecording ? 'active' : ''}`}>
                        {formatTime(timer)}
                    </span>
                    <span className="language-chip" style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                        {isWebSpeech ? '🌐 Web Speech' : '🌐 Sarvam AI'}
                    </span>
                </div>

                {/* Waveform */}
                {!isProcessing && !isDone && (
                    <Waveform audioService={audioService} isActive={isRecording} />
                )}

                {/* Live transcript */}
                {isRecording && isWebSpeech && (transcript || interimText) && (
                    <div className="mini-recorder-transcript">
                        <p>
                            {transcript}
                            {interimText && <span style={{ opacity: 0.5 }}> {interimText}</span>}
                        </p>
                    </div>
                )}

                {/* Processing / Done state */}
                {(isProcessing || isDone) && (
                    <div className="mini-recorder-status">
                        {isProcessing && (
                            <div className="processing-dots">
                                <div className="processing-dot" />
                                <div className="processing-dot" />
                                <div className="processing-dot" />
                            </div>
                        )}
                        <p className="mini-recorder-status-text">
                            {statusMessage}
                        </p>
                    </div>
                )}

                {/* Controls */}
                {isRecording && (
                    <div className="mini-recorder-controls">
                        <button className="btn btn-secondary btn-sm" onClick={cancelRecording}>
                            Cancel
                        </button>
                        <button
                            className="record-btn recording"
                            onClick={stopRecording}
                            title="Stop recording"
                            style={{ width: 48, height: 48 }}
                        >
                            <Square size={18} fill="white" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
