/**
 * Utility to extract metadata, calculate duration, and generate waveform peaks
 * from an uploaded audio file (MP3, WAV, FLAC, OGG, AAC) in the browser.
 */

export interface ExtractedAudioMetadata {
  title: string;
  artist: string;
  duration: number; // in seconds
  waveform: number[]; // normalized 0..1 array of peaks
  formattedDuration: string;
  fileSizeBytes: number;
  formattedSize: string;
  mimeType: string;
}

/**
 * Clean filename and guess artist/title
 * e.g., "01 - Tycho - Awake (2014).mp3" -> { artist: "Tycho", title: "Awake" }
 */
export function parseAudioFilename(filename: string): { title: string; artist: string } {
  // Strip file extension
  const base = filename.replace(/\.[^/.]+$/, '').trim();

  // Pattern: "Artist - Title" or "Artist - Track - Extra"
  if (base.includes(' - ')) {
    const parts = base.split(' - ').map((p) => p.trim());
    if (parts.length >= 2) {
      // Clean leading track numbers like "01", "1."
      const cleanPart0 = parts[0].replace(/^[\d\s.\-_]+/, '').trim();
      const cleanPart1 = parts[1].replace(/\s*\([^)]*\)$/, '').replace(/\s*\[[^\]]*\]$/, '').trim();
      return {
        artist: cleanPart0 || 'Unknown Artist',
        title: cleanPart1 || parts[1],
      };
    }
  }

  // Fallback: clean track numbers and special characters
  const cleanTitle = base
    .replace(/^[\d\s.\-_]+/, '')
    .replace(/[_\-]+/g, ' ')
    .trim();

  return {
    title: cleanTitle || 'Untitled Track',
    artist: 'Community Artist',
  };
}

/**
 * Format bytes to human readable string (e.g. 4.2 MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format seconds to mm:ss
 */
export function formatSeconds(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Analyze an audio file, extracting duration, peaks, and metadata
 */
export async function extractAudioMetadata(file: File): Promise<ExtractedAudioMetadata> {
  const { title, artist } = parseAudioFilename(file.name);
  const fileSizeBytes = file.size;
  const formattedSize = formatBytes(fileSizeBytes);
  const mimeType = file.type || 'audio/mpeg';

  let duration = 0;
  let waveform: number[] = [];

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const audioCtx = new AudioContextClass();
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      duration = Math.round(audioBuffer.duration);

      // Extract waveform peaks (60 bars)
      const channelData = audioBuffer.getChannelData(0);
      const numBars = 60;
      const blockSize = Math.floor(channelData.length / numBars);

      for (let i = 0; i < numBars; i++) {
        let blockSum = 0;
        const start = i * blockSize;
        const end = Math.min(start + blockSize, channelData.length);
        for (let j = start; j < end; j += 4) {
          // sample every 4th frame for speed
          blockSum += Math.abs(channelData[j]);
        }
        const avg = blockSum / (blockSize / 4);
        waveform.push(Math.min(1, Math.max(0.08, avg * 3.5)));
      }

      await audioCtx.close().catch(() => {});
    }
  } catch (err) {
    console.warn('[AudioMetadata] AudioContext decoding failed, falling back to HTMLAudioElement:', err);
  }

  // Fallback to HTMLAudioElement if Web Audio decoding was blocked or failed
  if (!duration) {
    duration = await getDurationFromAudioElement(file);
  }

  // Fallback synthetic waveform if none generated
  if (waveform.length === 0) {
    waveform = generatePlaceholderWaveform(60);
  }

  return {
    title,
    artist,
    duration: duration || 180,
    waveform,
    formattedDuration: formatSeconds(duration || 180),
    fileSizeBytes,
    formattedSize,
    mimeType,
  };
}

function getDurationFromAudioElement(file: File): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      audio.remove();
    };

    audio.addEventListener('loadedmetadata', () => {
      const dur = Math.round(audio.duration);
      cleanup();
      resolve(dur > 0 && !isNaN(dur) ? dur : 180);
    });

    audio.addEventListener('error', () => {
      cleanup();
      resolve(180);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      cleanup();
      resolve(180);
    }, 5000);
  });
}

function generatePlaceholderWaveform(bars: number): number[] {
  const peaks: number[] = [];
  for (let i = 0; i < bars; i++) {
    const val = 0.2 + 0.6 * Math.sin((i / bars) * Math.PI) * (0.6 + 0.4 * Math.random());
    peaks.push(Math.round(val * 100) / 100);
  }
  return peaks;
}

/**
 * Generate a curated stylish cover gradient based on genre or title
 */
export function getTrackCoverGradient(genre?: string, title?: string): string {
  const gradients: Record<string, string> = {
    'lo-fi': 'from-indigo-900 via-purple-900 to-amber-900',
    ambient: 'from-cyan-950 via-slate-900 to-teal-900',
    synthwave: 'from-fuchsia-900 via-purple-900 to-pink-900',
    electronic: 'from-blue-900 via-violet-900 to-indigo-950',
    chillhop: 'from-orange-950 via-rose-900 to-stone-900',
    cyberpunk: 'from-yellow-950 via-red-950 to-neutral-900',
    acoustic: 'from-emerald-950 via-teal-900 to-stone-900',
  };

  const key = genre?.toLowerCase() || '';
  if (gradients[key]) return gradients[key];

  // Hash title for stable colors
  const hash = (title || 'track').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const options = Object.values(gradients);
  return options[hash % options.length];
}
