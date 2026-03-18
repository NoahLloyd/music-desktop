/**
 * Audio analysis utilities: BPM detection, loudness measurement, key detection.
 * All use the Web Audio API (OfflineAudioContext).
 */

export interface AudioAnalysis {
  bpm: number | null
  loudnessDb: number // RMS loudness in dB
  key: string | null
}

/** Fetch and decode audio from a URL or file path into an AudioBuffer */
async function getAudioBuffer(src: string): Promise<AudioBuffer> {
  const response = await fetch(src)
  const arrayBuffer = await response.arrayBuffer()
  const ctx = new OfflineAudioContext(1, 1, 44100)
  return ctx.decodeAudioData(arrayBuffer)
}

/** Compute RMS loudness in dB */
function computeLoudness(buffer: AudioBuffer): number {
  const data = buffer.getChannelData(0)
  let sum = 0
  for (let i = 0; i < data.length; i++) {
    sum += data[i] * data[i]
  }
  const rms = Math.sqrt(sum / data.length)
  return 20 * Math.log10(Math.max(rms, 1e-10))
}

/**
 * Simple BPM detection using onset energy peaks.
 * Works by computing energy in short windows, finding peaks, and
 * measuring the most common interval between them.
 */
function detectBPM(buffer: AudioBuffer): number | null {
  const data = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate
  const windowSize = Math.floor(sampleRate * 0.02) // 20ms windows
  const hopSize = Math.floor(windowSize / 2)

  // Compute energy per window
  const energies: number[] = []
  for (let i = 0; i + windowSize < data.length; i += hopSize) {
    let energy = 0
    for (let j = 0; j < windowSize; j++) {
      energy += data[i + j] * data[i + j]
    }
    energies.push(energy / windowSize)
  }

  // Find peaks (onset detection)
  const threshold = energies.reduce((a, b) => a + b, 0) / energies.length * 1.5
  const peaks: number[] = []
  for (let i = 1; i < energies.length - 1; i++) {
    if (energies[i] > threshold && energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
      peaks.push(i)
    }
  }

  if (peaks.length < 4) return null

  // Compute intervals between consecutive peaks
  const intervals: number[] = []
  for (let i = 1; i < peaks.length; i++) {
    intervals.push(peaks[i] - peaks[i - 1])
  }

  // Histogram of intervals (quantized)
  const histogram = new Map<number, number>()
  for (const interval of intervals) {
    // Quantize to nearest 0.5 hop units
    const q = Math.round(interval * 2) / 2
    histogram.set(q, (histogram.get(q) || 0) + 1)
  }

  // Find most common interval
  let bestInterval = 0
  let bestCount = 0
  for (const [interval, count] of histogram) {
    if (count > bestCount) {
      bestCount = count
      bestInterval = interval
    }
  }

  if (bestInterval === 0) return null

  // Convert to BPM
  const secondsPerBeat = (bestInterval * hopSize) / sampleRate
  let bpm = 60 / secondsPerBeat

  // Normalize to typical range (70-180)
  while (bpm > 180) bpm /= 2
  while (bpm < 70) bpm *= 2

  return Math.round(bpm * 10) / 10
}

/**
 * Simple key detection using chroma features.
 * Computes the pitch class distribution and matches against major/minor profiles.
 */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Krumhansl-Kessler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]

function detectKey(buffer: AudioBuffer): string | null {
  const data = buffer.getChannelData(0)
  const sampleRate = buffer.sampleRate
  const fftSize = 4096

  // Use a subset of the audio (middle section, up to 30s)
  const startSample = Math.floor(Math.max(0, data.length / 2 - sampleRate * 15))
  const endSample = Math.floor(Math.min(data.length, data.length / 2 + sampleRate * 15))
  const segment = data.slice(startSample, endSample)

  // Simple DFT-based chroma extraction
  const chroma = new Float64Array(12)
  const numFrames = Math.floor(segment.length / fftSize)

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * fftSize
    // For each pitch class, sum energy at its frequencies
    for (let note = 0; note < 12; note++) {
      // Check octaves 2-6
      for (let octave = 2; octave <= 6; octave++) {
        const freq = 440 * Math.pow(2, (note - 9 + (octave - 4) * 12) / 12)
        const bin = Math.round(freq * fftSize / sampleRate)
        if (bin >= 0 && bin < fftSize / 2) {
          // Goertzel-like: correlate with sine/cosine at this frequency
          let real = 0, imag = 0
          const w = 2 * Math.PI * freq / sampleRate
          for (let i = 0; i < fftSize && offset + i < segment.length; i++) {
            real += segment[offset + i] * Math.cos(w * i)
            imag += segment[offset + i] * Math.sin(w * i)
          }
          chroma[note] += Math.sqrt(real * real + imag * imag)
        }
      }
    }
  }

  // Normalize chroma
  const maxChroma = Math.max(...chroma)
  if (maxChroma === 0) return null
  for (let i = 0; i < 12; i++) chroma[i] /= maxChroma

  // Correlate with key profiles
  let bestKey = ''
  let bestCorr = -Infinity

  for (let root = 0; root < 12; root++) {
    // Rotate chroma to align with root
    let majorCorr = 0, minorCorr = 0
    for (let i = 0; i < 12; i++) {
      const ci = (i + root) % 12
      majorCorr += chroma[ci] * MAJOR_PROFILE[i]
      minorCorr += chroma[ci] * MINOR_PROFILE[i]
    }

    if (majorCorr > bestCorr) {
      bestCorr = majorCorr
      bestKey = `${NOTE_NAMES[root]} Major`
    }
    if (minorCorr > bestCorr) {
      bestCorr = minorCorr
      bestKey = `${NOTE_NAMES[root]} Minor`
    }
  }

  return bestKey
}

/**
 * Run full analysis on an audio source.
 * Pass a URL (http or file://) to the audio file.
 */
export async function analyzeAudio(src: string): Promise<AudioAnalysis> {
  try {
    const buffer = await getAudioBuffer(src)
    const loudnessDb = computeLoudness(buffer)
    const bpm = detectBPM(buffer)
    const key = detectKey(buffer)
    return { bpm, loudnessDb, key }
  } catch (e) {
    console.error('Audio analysis failed:', e)
    return { bpm: null, loudnessDb: -60, key: null }
  }
}
