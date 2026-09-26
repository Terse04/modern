// Node script to generate authentic, royalty-free ambient & lo-fi audio tracks as WAV files
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../public/audio');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function writeWavFile(filepath, sampleRate, numChannels, samples) {
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF chunk descriptor
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);

  // 'fmt ' sub-chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // BitsPerSample

  // 'data' sub-chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intSample = s < 0 ? s * 32768 : s * 32767;
    buffer.writeInt16LE(Math.floor(intSample), offset);
    offset += 2;
  }

  fs.writeFileSync(filepath, buffer);
  console.log(`Generated: ${filepath} (${(samples.length / (sampleRate * numChannels)).toFixed(1)}s)`);
}

function generateTrack(filename, durationSec, bpm, chordProg, style) {
  const sampleRate = 22050;
  const numChannels = 1;
  const totalSamplesPerChannel = Math.floor(sampleRate * durationSec);
  const interleavedSamples = new Float32Array(totalSamplesPerChannel);

  const beatSec = 60 / bpm;
  const chordSec = beatSec * 4;

  for (let i = 0; i < totalSamplesPerChannel; i++) {
    const t = i / sampleRate;
    const chordIdx = Math.floor(t / chordSec) % chordProg.length;
    const chord = chordProg[chordIdx];

    // Synth tone (mellow polyphonic synth chords)
    let synthL = 0;
    let synthR = 0;

    for (let c = 0; c < chord.length; c++) {
      const freq = chord[c];
      // Soft gentle triangle/sine blend
      const tone1 = Math.sin(2 * Math.PI * freq * t);
      const tone2 = Math.sin(4 * Math.PI * freq * t) * 0.25;
      const sub = Math.sin(Math.PI * freq * t) * 0.2;
      const tone = (tone1 + tone2 + sub) * 0.15;

      // Slight panning per chord note
      const pan = (c / (chord.length - 1) - 0.5) * 0.4;
      synthL += tone * (0.5 - pan);
      synthR += tone * (0.5 + pan);
    }

    // Gentle kick on beat 1 & 3
    const beatPos = (t % beatSec) / beatSec;
    const isKick = (Math.floor(t / beatSec) % 2 === 0);
    let drum = 0;
    if (isKick && beatPos < 0.2) {
      const kickFreq = 110 * Math.exp(-beatPos * 30);
      drum += Math.sin(2 * Math.PI * kickFreq * t) * (1 - beatPos / 0.2) * 0.35;
    }

    // Gentle soft snare/shaker on beat 2 & 4
    if (!isKick && beatPos < 0.15) {
      const noise = (Math.random() * 2 - 1) * 0.12 * (1 - beatPos / 0.15);
      drum += noise;
    }

    // Ambient subtle vinyl texture / noise floor
    const vinyl = (Math.random() * 2 - 1) * 0.008;

    // Subtle fade in and out at loop edges
    let envelope = 1;
    if (t < 1.0) envelope = t;
    if (t > durationSec - 1.0) envelope = durationSec - t;

    interleavedSamples[i] = ((synthL + synthR) * 0.5 + drum * 0.6 + vinyl) * envelope * 0.7;
  }

  writeWavFile(path.join(OUTPUT_DIR, filename), sampleRate, numChannels, interleavedSamples);
}

// 4 Distinct beautiful tracks:
// Track 1: Late Night Frequency (Am9 -> Fmaj7 -> Cmaj7 -> Gsus4)
generateTrack('track-1.wav', 32, 75, [
  [220, 261.63, 329.63, 392.00, 493.88], // Am9
  [174.61, 220.00, 261.63, 329.63],      // Fmaj7
  [130.81, 164.81, 196.00, 246.94],      // Cmaj7
  [196.00, 261.63, 293.66, 392.00]       // Gsus4
]);

// Track 2: Midnight Nostalgia (Dm7 -> G7 -> Cmaj7 -> A7)
generateTrack('track-2.wav', 28, 80, [
  [146.83, 174.61, 220.00, 261.63], // Dm7
  [196.00, 246.94, 293.66, 349.23], // G7
  [130.81, 164.81, 196.00, 246.94], // Cmaj7
  [220.00, 277.18, 329.63, 392.00]  // A7
]);

// Track 3: Analog Dreams (Emaj7 -> C#m7 -> F#m7 -> B9)
generateTrack('track-3.wav', 30, 70, [
  [164.81, 207.65, 246.94, 311.13], // Emaj7
  [138.59, 164.81, 207.65, 246.94], // C#m7
  [185.00, 220.00, 277.18, 329.63], // F#m7
  [246.94, 311.13, 370.00, 440.00]  // B9
]);

// Track 4: Deep Focus Loop (Fm9 -> Dbmaj7 -> Bbm9 -> Eb)
generateTrack('track-4.wav', 34, 65, [
  [174.61, 207.65, 261.63, 311.13, 392.00], // Fm9
  [138.59, 174.61, 207.65, 261.63],          // Dbmaj7
  [116.54, 138.59, 174.61, 207.65],          // Bbm9
  [155.56, 196.00, 233.08, 311.13]           // Eb
]);

console.log('All demo audio assets successfully generated!');
