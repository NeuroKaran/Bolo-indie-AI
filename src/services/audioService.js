// ========================================
// Audio Service — Microphone & Recording
// ========================================

class AudioService {
    constructor() {
        this.mediaStream = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioContext = null;
        this.analyserNode = null;
        this.sourceNode = null;
        this.isRecording = false;
        this.onDataCallback = null;

        // PCM streaming capture
        this.pcmProcessorNode = null;
        this.pcmCallback = null;
    }

    async requestMicAccess() {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });
            return true;
        } catch (err) {
            console.error('Microphone access denied:', err);
            return false;
        }
    }

    initAudioContext() {
        if (!this.audioContext || this.audioContext.state === 'closed') {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000,
            });
        }

        if (this.mediaStream && !this.sourceNode) {
            this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.analyserNode = this.audioContext.createAnalyser();
            this.analyserNode.fftSize = 256;
            this.analyserNode.smoothingTimeConstant = 0.7;
            this.sourceNode.connect(this.analyserNode);
        }
    }

    getWaveformData() {
        if (!this.analyserNode) return new Uint8Array(0);
        const data = new Uint8Array(this.analyserNode.frequencyBinCount);
        this.analyserNode.getByteFrequencyData(data);
        return data;
    }

    getVolumeLevel() {
        if (!this.analyserNode) return 0;
        const data = new Uint8Array(this.analyserNode.frequencyBinCount);
        this.analyserNode.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            const val = (data[i] - 128) / 128;
            sum += val * val;
        }
        return Math.sqrt(sum / data.length);
    }

    startRecording() {
        if (!this.mediaStream) return false;

        this.audioChunks = [];
        this.isRecording = true;

        // Use webm/opus for broad compatibility, or wav if available
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm';

        this.mediaRecorder = new MediaRecorder(this.mediaStream, { mimeType });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        this.mediaRecorder.start(100); // Collect data every 100ms
        this.initAudioContext();
        return true;
    }

    stopRecording() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
                resolve(null);
                return;
            }

            this.mediaRecorder.onstop = () => {
                const mimeType = this.mediaRecorder.mimeType;
                const audioBlob = new Blob(this.audioChunks, { type: mimeType });
                this.audioChunks = [];
                this.isRecording = false;
                resolve(audioBlob);
            };

            this.mediaRecorder.stop();
        });
    }

    // ---- PCM Streaming Capture (for WebSocket STT) ----

    /**
     * Start capturing raw PCM Int16 audio and push chunks via callback.
     * Uses ScriptProcessorNode to tap into the AudioContext pipeline.
     * @param {function(Int16Array)} onPCMChunk - Called with each PCM Int16 chunk
     * @returns {boolean} success
     */
    startStreamingCapture(onPCMChunk) {
        if (!this.mediaStream) return false;

        this.initAudioContext();
        this.pcmCallback = onPCMChunk;

        // Create a ScriptProcessorNode with buffer size 2048 (good balance of latency vs overhead)
        // At 16kHz, 2048 samples ≈ 128ms per chunk
        const bufferSize = 2048;
        this.pcmProcessorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

        this.pcmProcessorNode.onaudioprocess = (event) => {
            if (!this.pcmCallback) return;

            const floatData = event.inputBuffer.getChannelData(0);

            // Convert Float32 [-1, 1] to Int16 [-32768, 32767]
            const int16Data = new Int16Array(floatData.length);
            for (let i = 0; i < floatData.length; i++) {
                const s = Math.max(-1, Math.min(1, floatData[i]));
                int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            this.pcmCallback(int16Data);
        };

        // Connect: source -> pcmProcessor -> destination (required for processing to work)
        this.sourceNode.connect(this.pcmProcessorNode);
        this.pcmProcessorNode.connect(this.audioContext.destination);

        console.log('[AudioService] PCM streaming capture started (16kHz, Int16, mono)');
        return true;
    }

    /**
     * Stop PCM streaming capture.
     */
    stopStreamingCapture() {
        if (this.pcmProcessorNode) {
            try {
                this.pcmProcessorNode.disconnect();
                if (this.sourceNode) {
                    this.sourceNode.disconnect(this.pcmProcessorNode);
                }
            } catch { /* ignore disconnect errors */ }
            this.pcmProcessorNode = null;
        }
        this.pcmCallback = null;
        console.log('[AudioService] PCM streaming capture stopped');
    }

    cleanup() {
        // Stop PCM streaming
        this.stopStreamingCapture();

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach((track) => track.stop());
            this.mediaStream = null;
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.sourceNode = null;
        this.analyserNode = null;
        this.isRecording = false;
    }
}

export default new AudioService();
