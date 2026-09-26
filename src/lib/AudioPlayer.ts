import { PlaybackStatus } from '../types';

export interface AudioPlayerEvents {
  onTimeUpdate: (currentTime: number) => void;
  onDurationChange: (duration: number) => void;
  onStatusChange: (status: PlaybackStatus) => void;
  onError: (error: string) => void;
  onEnded: () => void;
}

export interface AudioLevels {
  bass: number;
  mid: number;
  treble: number;
  overall: number;
}

export class AudioEngine {
  private audio: HTMLAudioElement;
  private events: Partial<AudioPlayerEvents> = {};
  private currentUrl: string = '';
  private isNudging: boolean = false;
  private synthCtx: AudioContext | null = null;
  private synthOscs: OscillatorNode[] = [];
  private isUsingSynthFallback: boolean = false;

  // Web Audio Visualizer pipeline
  private audioCtx: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private frequencyData: Uint8Array | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.crossOrigin = 'anonymous';
    this.setupListeners();
  }

  setEvents(events: Partial<AudioPlayerEvents>) {
    this.events = events;
  }

  private setupListeners() {
    this.audio.addEventListener('timeupdate', () => {
      this.events.onTimeUpdate?.(this.audio.currentTime);
    });

    this.audio.addEventListener('loadedmetadata', () => {
      if (this.audio.duration && !isNaN(this.audio.duration)) {
        this.events.onDurationChange?.(this.audio.duration);
      }
    });

    this.audio.addEventListener('durationchange', () => {
      if (this.audio.duration && !isNaN(this.audio.duration)) {
        this.events.onDurationChange?.(this.audio.duration);
      }
    });

    this.audio.addEventListener('play', () => {
      this.events.onStatusChange?.('playing');
    });

    this.audio.addEventListener('pause', () => {
      if (this.audio.currentTime < this.audio.duration) {
        this.events.onStatusChange?.('paused');
      }
    });

    this.audio.addEventListener('waiting', () => {
      this.events.onStatusChange?.('buffering');
    });

    this.audio.addEventListener('playing', () => {
      this.events.onStatusChange?.('playing');
    });

    this.audio.addEventListener('ended', () => {
      this.events.onStatusChange?.('ended');
      this.events.onEnded?.();
    });

    this.audio.addEventListener('error', () => {
      console.warn('[AudioEngine] HTMLAudioElement error, falling back to Web Audio Synth');
      this.startSynthFallback();
    });
  }

  loadTrack(url: string, autoPlay: boolean = false) {
    if (this.currentUrl === url && this.audio.src) {
      if (autoPlay) this.play();
      return;
    }

    this.currentUrl = url;
    this.stopSynthFallback();
    this.audio.src = url;
    this.audio.load();

    if (autoPlay) {
      this.play();
    }
  }

  private initAnalyser() {
    if (this.analyserNode) {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 128;
      this.analyserNode.smoothingTimeConstant = 0.82;
      this.frequencyData = new Uint8Array(this.analyserNode.frequencyBinCount);

      if (!this.sourceNode) {
        this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
        this.sourceNode.connect(this.analyserNode);
        this.analyserNode.connect(this.audioCtx.destination);
      }
    } catch (e) {
      console.warn('[AudioEngine] Could not initialize Web Audio analyser:', e);
    }
  }

  async play(): Promise<void> {
    try {
      this.initAnalyser();
      if (this.isUsingSynthFallback) {
        this.events.onStatusChange?.('playing');
        return;
      }
      await this.audio.play();
      this.events.onStatusChange?.('playing');
    } catch (err: any) {
      // Browser autoplay restriction or file error
      console.warn('[AudioEngine] Playback prevented or error:', err.message);
      this.startSynthFallback();
    }
  }

  pause() {
    if (this.isUsingSynthFallback) {
      this.events.onStatusChange?.('paused');
      return;
    }
    this.audio.pause();
    this.events.onStatusChange?.('paused');
  }

  getFrequencyData(): Uint8Array {
    if (this.analyserNode && this.frequencyData && !this.audio.paused) {
      this.analyserNode.getByteFrequencyData(this.frequencyData);
      return this.frequencyData;
    }
    return new Uint8Array(64);
  }

  getAudioLevels(): AudioLevels {
    const data = this.getFrequencyData();
    if (!data || data.length === 0 || this.audio.paused) {
      return { bass: 0, mid: 0, treble: 0, overall: 0 };
    }

    let bassSum = 0;
    let midSum = 0;
    let trebleSum = 0;

    const bassCount = Math.min(6, data.length);
    for (let i = 0; i < bassCount; i++) {
      bassSum += data[i];
    }

    const midEnd = Math.min(24, data.length);
    for (let i = bassCount; i < midEnd; i++) {
      midSum += data[i];
    }

    const trebleEnd = Math.min(64, data.length);
    for (let i = midEnd; i < trebleEnd; i++) {
      trebleSum += data[i];
    }

    const totalSum = bassSum + midSum + trebleSum;

    return {
      bass: bassSum / (bassCount * 255),
      mid: midSum / ((midEnd - bassCount) * 255),
      treble: trebleSum / ((trebleEnd - midEnd) * 255),
      overall: totalSum / (trebleEnd * 255),
    };
  }

  isPlaying(): boolean {
    return !this.audio.paused && !this.audio.ended && this.audio.currentTime > 0;
  }

  seek(seconds: number) {
    if (this.isUsingSynthFallback) {
      this.events.onTimeUpdate?.(seconds);
      return;
    }
    const safeTime = Math.max(0, Math.min(seconds, this.audio.duration || 9999));
    this.audio.currentTime = safeTime;
    this.events.onTimeUpdate?.(safeTime);
  }

  setVolume(volume: number) {
    const safeVol = Math.max(0, Math.min(1, volume));
    this.audio.volume = safeVol;
  }

  getCurrentTime(): number {
    return this.audio.currentTime || 0;
  }

  getDuration(): number {
    return this.audio.duration || 0;
  }

  /**
   * Drift Correction:
   * If moderate drift, nudges rate slightly (e.g., 1.04x or 0.96x) so client seamlessly catches up
   * without hearing a jump.
   */
  applyDriftCorrection(action: 'none' | 'nudge' | 'seek', targetSeconds?: number, driftMs?: number) {
    if (action === 'none') {
      if (this.isNudging) {
        this.audio.playbackRate = 1.0;
        this.isNudging = false;
      }
      return;
    }

    if (action === 'nudge' && driftMs !== undefined) {
      // If local is behind target (driftMs < 0), speed up slightly (1.04x)
      // If local is ahead of target (driftMs > 0), slow down slightly (0.96x)
      const newRate = driftMs < 0 ? 1.04 : 0.96;
      this.audio.playbackRate = newRate;
      this.isNudging = true;
    } else if (action === 'seek' && targetSeconds !== undefined) {
      this.seek(targetSeconds);
      this.audio.playbackRate = 1.0;
      this.isNudging = false;
    }
  }

  // Seamless procedural synthesizer fallback
  private startSynthFallback() {
    if (this.synthCtx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      this.synthCtx = new AudioCtx();
      this.isUsingSynthFallback = true;

      // Soft ambient chord (A minor 9)
      const freqs = [220, 261.63, 329.63, 392.0];
      this.synthOscs = freqs.map((f) => {
        const osc = this.synthCtx!.createOscillator();
        const gain = this.synthCtx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, this.synthCtx!.currentTime);
        gain.gain.setValueAtTime(0.04, this.synthCtx!.currentTime);
        osc.connect(gain);
        gain.connect(this.synthCtx!.destination);
        osc.start();
        return osc;
      });

      this.events.onDurationChange?.(32);
      this.events.onStatusChange?.('playing');
    } catch (e) {
      console.error('[AudioEngine] Synth fallback error', e);
    }
  }

  private stopSynthFallback() {
    if (this.synthOscs.length) {
      this.synthOscs.forEach((o) => {
        try {
          o.stop();
          o.disconnect();
        } catch (_) {}
      });
      this.synthOscs = [];
    }
    if (this.synthCtx) {
      this.synthCtx.close().catch(() => {});
      this.synthCtx = null;
    }
    this.isUsingSynthFallback = false;
  }

  destroy() {
    this.pause();
    this.stopSynthFallback();
    this.audio.src = '';
    this.events = {};
  }
}

export const globalAudioEngine = new AudioEngine();
