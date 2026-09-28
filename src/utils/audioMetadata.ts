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
  // Strip the file extension. Anchored to the last dot that actually has an
  // extension after it, so "1.2 Master" is no longer truncated to "1".
  const base = filename.replace(/\.[A-Za-z0-9]{1,5}$/, '').trim();

  // Pattern: "Artist - Title" or "Artist - Title - Extra"
  if (base.includes(' - ')) {
    const parts = base.split(' - ').map((p) => p.trim());
    if (parts.length >= 2) {
      // Clean leading track numbers like "01", "1."
      const cleanPart0 = parts[0].replace(/^[\d\s._-]+/, '').trim();
      const cleanPart1 = parts[1].replace(/\s*\([^)]*\)$/, '').replace(/\s*\[[^\]]*\]$/, '').trim();
      // Fold any trailing segments ("Artist - Title - Remix") back into the
      // title instead of silently discarding them.
      const extra = parts
        .slice(2)
        .filter(Boolean)
        .join(' - ');
      const title = extra ? `${cleanPart1} - ${extra}` : cleanPart1;

      return {
        artist: cleanPart0 || 'Unknown Artist',
        title: title || parts[1],
      };
    }
  }

  // Fallback: clean track numbers and special characters
  const cleanTitle = base
    .replace(/^[\d\s._-]+/, '')
    .replace(/[_-]+/g, ' ')
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
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

/**
 * Format seconds to mm:ss
 */
export function formatSeconds(seconds: number): string {
  // Infinity is a real AudioBuffer.duration for streamed/unsupported media, and
  // negatives slip through from seek maths. Both produced garbage like
  // "Infinity:NaN" and "-1:-5" before.
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Matches the 50 MB limit the upload modal advertises and the storage bucket enforces. */
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

export class AudioMetadataError extends Error {
  constructor(
    message: string,
    readonly code: 'too_large' | 'not_audio' | 'unreadable'
  ) {
    super(message);
    this.name = 'AudioMetadataError';
  }
}

const AUDIO_MIME_PREFIXES = ['audio/'];
const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.wav', '.ogg', '.oga', '.opus', '.flac', '.webm', '.mp4'];

/**
 * Cheap pre-flight check. `file.type` is attacker-controlled, so this only
 * rejects obviously wrong files early - the authoritative signal is whether
 * decodeAudioData() actually succeeds.
 */
function assertLooksLikeAudio(file: File): void {
  if (file.size === 0) {
    throw new AudioMetadataError('That file is empty.', 'not_audio');
  }
  if (file.size > MAX_AUDIO_BYTES) {
    throw new AudioMetadataError(
      `File is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_AUDIO_BYTES)}.`,
      'too_large'
    );
  }
  const type = (file.type || '').toLowerCase();
  const dot = file.name.lastIndexOf('.');
  const ext = dot > 0 ? file.name.slice(dot).toLowerCase() : '';
  const typeOk = AUDIO_MIME_PREFIXES.some((p) => type.startsWith(p));
  const extOk = AUDIO_EXTENSIONS.includes(ext);
  if (!typeOk && !extOk) {
    throw new AudioMetadataError(
      `"${file.name}" does not look like an audio file.`,
      'not_audio'
    );
  }
}

/**
 * Analyze an audio file, extracting duration and waveform peaks.
 *
 * THROWS AudioMetadataError if the file cannot be decoded. The previous
 * version resolved with `duration: 180` in every failure path, so a JPEG
 * renamed to .mp3 was reported as a 3:00 track and that value was written to
 * the tracks table by storageService. Fabricating a duration is worse than
 * failing: the bad number became durable data.
 */
export async function extractAudioMetadata(file: File): Promise<ExtractedAudioMetadata> {
  assertLooksLikeAudio(file);

  const { title, artist } = parseAudioFilename(file.name);
  const formattedSize = formatBytes(file.size);
  const mimeType = file.type || 'audio/mpeg';

  // Prefer a single AudioContext for both the buffer and nothing else; the
  // old code left it open whenever decodeAudioData threw, and Chrome caps a
  // page at ~6 live contexts before suspending all of them.
  let audioCtx: AudioContext | null = null;
  let audioBuffer: AudioBuffer;

  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      throw new AudioMetadataError(
        'This browser cannot decode audio (Web Audio API unavailable).',
        'unreadable'
      );
    }

    audioCtx = new AudioContextClass();
    // decodeAudioData detaches the ArrayBuffer, so this is the only read.
    const arrayBuffer = await file.arrayBuffer();
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (err) {
    if (err instanceof AudioMetadataError) throw err;
    throw new AudioMetadataError(
      `"${file.name}" could not be decoded. It may be corrupt, or not actually audio.`,
      'unreadable'
    );
  } finally {
    void audioCtx?.close().catch(() => {});
  }

  if (!Number.isFinite(audioBuffer.duration) || audioBuffer.duration <= 0) {
    throw new AudioMetadataError(
      `"${file.name}" has no usable duration.`,
      'unreadable'
    );
  }

  const duration = Math.round(audioBuffer.duration);

  return {
    title,
    artist,
    duration,
    waveform: computeWaveformPeaks(audioBuffer, 60),
    formattedDuration: formatSeconds(duration),
    fileSizeBytes: file.size,
    formattedSize,
    mimeType,
  };
}

/**
 * True peak amplitude per bar, normalised against the loudest bar in the file.
 *
 * The old implementation averaged absolute amplitude and applied a fixed x3.5
 * gain, so quiet files rendered flat and loud files pinned to 1.0. It also
 * divided by `blockSize / 4` while stepping by 4, which is wrong whenever
 * blockSize is not a multiple of 4 - and when blockSize was 0 (any file
 * shorter than 60 samples) it produced 0/0 = NaN, so the whole waveform became
 * NaN and the UI emitted `height: NaN%`.
 */
function computeWaveformPeaks(buffer: AudioBuffer, numBars: number): number[] {
  const bars = Math.max(1, numBars);
  const channelCount = buffer.numberOfChannels;
  const length = buffer.length;

  if (length === 0 || channelCount === 0) {
    return new Array<number>(bars).fill(0.08);
  }

  // Mix all channels so a silent or phase-inverted left channel does not
  // flatten the display.
  const raw: number[] = new Array<number>(bars).fill(0);
  const blockSize = length / bars;

  for (let i = 0; i < bars; i++) {
    const start = Math.floor(i * blockSize);
    const end = Math.min(Math.floor((i + 1) * blockSize), length);
    let peak = 0;

    for (let ch = 0; ch < channelCount; ch++) {
      const data = buffer.getChannelData(ch);
      for (let j = start; j < end; j++) {
        const v = data[j] < 0 ? -data[j] : data[j];
        if (v > peak) peak = v;
      }
    }
    raw[i] = peak;
  }

  const max = raw.reduce((a, b) => (b > a ? b : a), 0);
  if (max <= 0) {
    // Digital silence: a flat line, not NaN and not fake noise.
    return new Array<number>(bars).fill(0.08);
  }

  return raw.map((v) => {
    const normalised = v / max;
    if (!Number.isFinite(normalised)) return 0.08;
    return Math.min(1, Math.max(0.08, normalised));
  });
}

/**
 * Generate a curated stylish cover gradient based on genre or title
 *
 * The keys below never matched the genres the app actually stores
 * ('Lo-Fi / Ambient', 'Retro Synth', ...), so every lookup missed and this
 * always fell through to the title hash. Kept for now, but it is dead weight -
 * see the audit note.
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
