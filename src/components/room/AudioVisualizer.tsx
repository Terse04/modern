import React, { useEffect, useRef, useState } from 'react';
import { globalAudioEngine } from '../../lib/AudioPlayer';
import { Sparkles, Activity, Waves } from 'lucide-react';

export type VisualizerMode = 'spectrum' | 'aura' | 'particles';

export interface AudioVisualizerProps {
  isPlaying: boolean;
  artworkUrl?: string;
  mode?: VisualizerMode;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  hue: number;
  life: number;
  maxLife: number;
}

export const AuraModeSelector: React.FC<{
  mode: VisualizerMode;
  onChange: (mode: VisualizerMode) => void;
}> = ({ mode, onChange }) => {
  return (
    <div className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-surface-elevated/80 border border-border/60 shadow-sm backdrop-blur-md text-[10px] text-text-muted transition-all">
      <span className="font-semibold uppercase tracking-wider text-[9px] mr-1 text-text-muted hidden sm:inline">Aura:</span>
      <button
        onClick={() => onChange('spectrum')}
        className={`px-2 py-0.5 rounded-full transition-all flex items-center gap-1 ${
          mode === 'spectrum' ? 'bg-accent-cream text-bg font-semibold shadow-xs' : 'hover:text-text-primary'
        }`}
        title="Spectrum Bars"
      >
        <Activity className="w-2.5 h-2.5" />
        <span>Ring</span>
      </button>
      <button
        onClick={() => onChange('aura')}
        className={`px-2 py-0.5 rounded-full transition-all flex items-center gap-1 ${
          mode === 'aura' ? 'bg-accent-cream text-bg font-semibold shadow-xs' : 'hover:text-text-primary'
        }`}
        title="Flowing Aura Wave"
      >
        <Waves className="w-2.5 h-2.5" />
        <span>Wave</span>
      </button>
      <button
        onClick={() => onChange('particles')}
        className={`px-2 py-0.5 rounded-full transition-all flex items-center gap-1 ${
          mode === 'particles' ? 'bg-accent-cream text-bg font-semibold shadow-xs' : 'hover:text-text-primary'
        }`}
        title="Audio Sparks"
      >
        <Sparkles className="w-2.5 h-2.5" />
        <span>Sparks</span>
      </button>
    </div>
  );
};

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
  artworkUrl,
  mode = 'spectrum',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bassLevel, setBassLevel] = useState<number>(0);

  const particlesRef = useRef<Particle[]>([]);
  const prevDataRef = useRef<number[]>(new Array(64).fill(0));
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateCanvasDimensions = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    updateCanvasDimensions();
    window.addEventListener('resize', updateCanvasDimensions);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const baseRadius = Math.min(width, height) * 0.42;

      ctx.clearRect(0, 0, width, height);

      const freqData = globalAudioEngine.getFrequencyData();
      const levels = globalAudioEngine.getAudioLevels();

      // Smooth bass for ambient backdrop glow
      const targetBass = isPlaying ? levels.bass : 0;
      setBassLevel((prev) => prev + (targetBass - prev) * 0.15);

      phaseRef.current += isPlaying ? 0.04 + levels.overall * 0.05 : 0.015;
      const phase = phaseRef.current;

      // Update smooth frequency data
      const smoothData = prevDataRef.current;
      for (let i = 0; i < 64; i++) {
        const raw = isPlaying ? (freqData[i] || 0) / 255 : 0;
        smoothData[i] += (raw - smoothData[i]) * 0.2;
      }

      // MODE 1: RADIAL SPECTRUM BARS
      if (mode === 'spectrum') {
        const barCount = 48;
        const angleStep = (Math.PI * 2) / barCount;

        for (let i = 0; i < barCount; i++) {
          const angle = i * angleStep - Math.PI / 2;
          const dataIndex = Math.floor((i < barCount / 2 ? i : barCount - i) * (32 / (barCount / 2)));
          const intensity = smoothData[dataIndex] || 0;

          // Idle breathing height + audio reactive boost
          const idleWave = Math.sin(phase + i * 0.2) * 4;
          const barHeight = isPlaying ? idleWave + intensity * 45 + levels.bass * 15 : idleWave + 6;
          const currentRadius = baseRadius + (isPlaying ? levels.bass * 8 : 0);

          const x1 = centerX + Math.cos(angle) * currentRadius;
          const y1 = centerY + Math.sin(angle) * currentRadius;
          const x2 = centerX + Math.cos(angle) * (currentRadius + Math.max(3, barHeight));
          const y2 = centerY + Math.sin(angle) * (currentRadius + Math.max(3, barHeight));

          // Palette: Cream (#F5E6D3) -> Amber Glow -> Violet
          const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
          if (isPlaying) {
            gradient.addColorStop(0, 'rgba(245, 230, 211, 0.4)');
            gradient.addColorStop(0.6, 'rgba(230, 180, 110, 0.7)');
            gradient.addColorStop(1, 'rgba(200, 140, 255, 0.9)');
          } else {
            gradient.addColorStop(0, 'rgba(245, 230, 211, 0.15)');
            gradient.addColorStop(1, 'rgba(245, 230, 211, 0.3)');
          }

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
      }

      // MODE 2: CONTINUOUS AURA WAVE
      if (mode === 'aura') {
        const rings = 3;
        for (let r = 0; r < rings; r++) {
          ctx.beginPath();
          const points = 72;
          const ringOffset = r * 8;
          const ringRadius = baseRadius + ringOffset + (isPlaying ? levels.bass * 12 : 0);

          for (let i = 0; i <= points; i++) {
            const angle = (i / points) * Math.PI * 2;
            const dataIndex = Math.floor((i % (points / 2)) * (32 / (points / 2)));
            const amp = isPlaying ? (smoothData[dataIndex] || 0) * 28 : Math.sin(phase * 2 + i * 0.4) * 5;
            const wave = Math.sin(angle * 6 + phase + r) * (4 + amp * 0.3);
            const radius = ringRadius + wave + amp;

            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.closePath();
          ctx.strokeStyle = r === 0
            ? 'rgba(245, 230, 211, 0.6)'
            : r === 1
            ? 'rgba(220, 180, 120, 0.35)'
            : 'rgba(180, 120, 255, 0.2)';
          ctx.lineWidth = 2 - r * 0.4;
          ctx.stroke();
        }
      }

      // MODE 3: AMBIENT PARTICLES
      if (mode === 'particles') {
        if (isPlaying && (levels.treble > 0.25 || levels.bass > 0.3)) {
          const spawnCount = Math.floor((levels.bass + levels.treble) * 4);
          for (let p = 0; p < spawnCount; p++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.5 + Math.random() * 2 + levels.bass * 2;
            particlesRef.current.push({
              x: centerX + Math.cos(angle) * (baseRadius + 5),
              y: centerY + Math.sin(angle) * (baseRadius + 5),
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              size: 1.5 + Math.random() * 3,
              alpha: 0.8 + Math.random() * 0.2,
              hue: Math.random() > 0.5 ? 40 : 270,
              life: 0,
              maxLife: 40 + Math.random() * 50,
            });
          }
        }

        const particles = particlesRef.current;
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.life++;
          p.alpha = Math.max(0, 1 - p.life / p.maxLife);

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${p.hue}, 80%, 75%, ${p.alpha * 0.8})`;
          ctx.shadowBlur = 8;
          ctx.shadowColor = `hsla(${p.hue}, 80%, 70%, ${p.alpha})`;
          ctx.fill();

          if (p.life >= p.maxLife) {
            particles.splice(i, 1);
          }
        }
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', updateCanvasDimensions);
    };
  }, [isPlaying, mode]);

  return (
    <div className="absolute -inset-10 sm:-inset-16 pointer-events-none z-0 flex items-center justify-center">
      {/* Dynamic Audio Reactive Background Bloom */}
      <div
        className="absolute w-[110%] h-[110%] rounded-full transition-all duration-150 ease-out filter blur-[60px] pointer-events-none"
        style={{
          background: artworkUrl
            ? `radial-gradient(circle, rgba(245, 230, 211, ${0.12 + bassLevel * 0.28}) 0%, rgba(180, 130, 255, ${0.08 + bassLevel * 0.2}) 50%, transparent 80%)`
            : `radial-gradient(circle, rgba(245, 230, 211, 0.15) 0%, transparent 70%)`,
          transform: `scale(${1 + bassLevel * 0.18})`,
        }}
      />

      {/* Visualizer Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full relative z-0 pointer-events-none"
      />
    </div>
  );
};
