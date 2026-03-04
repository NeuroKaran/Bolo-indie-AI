import { useEffect, useRef } from 'react';

/**
 * Real-time audio waveform visualizer using Canvas API.
 * Renders saffron-colored bars driven by microphone frequency data.
 */
export default function Waveform({ audioService, isActive }) {
    const canvasRef = useRef(null);
    const animFrameRef = useRef(null);

    useEffect(() => {
        if (!isActive || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Set canvas resolution
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const draw = () => {
            const width = rect.width;
            const height = rect.height;

            ctx.clearRect(0, 0, width, height);

            const data = audioService.getWaveformData();

            if (data.length === 0) {
                animFrameRef.current = requestAnimationFrame(draw);
                return;
            }

            const barCount = 40;
            const barWidth = width / barCount - 2;
            const step = Math.floor(data.length / barCount);

            for (let i = 0; i < barCount; i++) {
                const value = data[i * step] || 0;
                const barHeight = (value / 255) * height * 0.85;
                const x = i * (barWidth + 2);
                const y = (height - barHeight) / 2;

                // Gradient from saffron to deep saffron
                const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
                gradient.addColorStop(0, '#FF9933');
                gradient.addColorStop(1, '#FF6F00');

                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.roundRect(x, y, barWidth, Math.max(barHeight, 2), 2);
                ctx.fill();
            }

            animFrameRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [isActive, audioService]);

    // Idle state: gentle animation
    useEffect(() => {
        if (isActive || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        let phase = 0;

        const drawIdle = () => {
            const width = rect.width;
            const height = rect.height;
            ctx.clearRect(0, 0, width, height);

            const barCount = 40;
            const barWidth = width / barCount - 2;

            for (let i = 0; i < barCount; i++) {
                const offset = Math.sin((phase + i * 0.15) * 2) * 0.3 + 0.15;
                const barHeight = offset * height * 0.4;
                const x = i * (barWidth + 2);
                const y = (height - barHeight) / 2;

                ctx.fillStyle = 'rgba(255, 153, 51, 0.2)';
                ctx.beginPath();
                ctx.roundRect(x, y, barWidth, Math.max(barHeight, 2), 2);
                ctx.fill();
            }

            phase += 0.02;
            animFrameRef.current = requestAnimationFrame(drawIdle);
        };

        drawIdle();

        return () => {
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [isActive]);

    return (
        <div className="waveform-container">
            <canvas ref={canvasRef} className="waveform-canvas" />
        </div>
    );
}
