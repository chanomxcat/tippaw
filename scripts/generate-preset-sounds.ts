/**
 * Synthesizes the three built-in alert sound presets (`preset:chime`,
 * `preset:coin`, `preset:pop`) as small PCM16 mono 44.1kHz WAV files, so the
 * repo doesn't need to ship or license external audio. Each file is ≤1.5s.
 *
 * Usage: npx tsx scripts/generate-preset-sounds.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44100;
const OUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "presets",
  "sounds",
);

/** Encodes mono float samples (range [-1, 1]) as a 16-bit PCM WAV file buffer. */
function encodeWav(samples: Float32Array): Buffer {
  const blockAlign = 2; // mono, 16-bit
  const byteRate = SAMPLE_RATE * blockAlign;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16); // fmt chunk size (PCM)
  buffer.writeUInt16LE(1, 20); // format = PCM
  buffer.writeUInt16LE(1, 22); // channels = mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]!));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  return buffer;
}

/** A decaying sine sweep from `freqStart` to `freqEnd` Hz over `durationSec`. */
function toneSweep(freqStart: number, freqEnd: number, durationSec: number): Float32Array {
  const n = Math.round(SAMPLE_RATE * durationSec);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / durationSec;
    const freq = freqStart + (freqEnd - freqStart) * progress;
    const decay = Math.exp(-3 * progress);
    out[i] = Math.sin(2 * Math.PI * freq * t) * decay * 0.6;
  }
  return out;
}

/** Two short decaying notes back to back, like a coin pickup jingle. */
function twoNoteJingle(freqA: number, freqB: number): Float32Array {
  const noteDurSec = 0.35;
  const gapSec = 0.05;
  const a = toneSweep(freqA, freqA, noteDurSec);
  const b = toneSweep(freqB, freqB, noteDurSec);
  const gapSamples = Math.round(SAMPLE_RATE * gapSec);
  const out = new Float32Array(a.length + gapSamples + b.length);
  out.set(a, 0);
  out.set(b, a.length + gapSamples);
  return out;
}

/** A short burst of decaying white noise. */
function noiseBurst(durationSec: number): Float32Array {
  const n = Math.round(SAMPLE_RATE * durationSec);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const progress = i / n;
    const decay = Math.exp(-8 * progress);
    out[i] = (Math.random() * 2 - 1) * decay * 0.7;
  }
  return out;
}

function main(): void {
  mkdirSync(OUT_DIR, { recursive: true });

  const presets: Record<string, Float32Array> = {
    chime: toneSweep(880, 1320, 1.2),
    coin: twoNoteJingle(988, 1319),
    pop: noiseBurst(0.08),
  };

  for (const [name, samples] of Object.entries(presets)) {
    const filePath = path.join(OUT_DIR, `${name}.wav`);
    writeFileSync(filePath, encodeWav(samples));
    console.log(`wrote ${filePath} (${(samples.length / SAMPLE_RATE).toFixed(2)}s)`);
  }
}

main();
