/**
 * Pitch estimation from Web Audio AnalyserNode frequency data.
 * The analyser applies a real FFT internally; we read the magnitude spectrum
 * and estimate the fundamental with parabolic peak refinement.
 *
 * Guitar strings often have a weaker fundamental than the 2nd harmonic (e.g. low E
 * reads ~164 Hz). We pick among subharmonics of the strongest peak by scoring how well
 * each candidate explains the spectrum as a harmonic series (weighted sum at k·f0).
 */

const NOTE_NAMES = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const

const A4_HZ = 440

export type NoteInfo = {
  name: string
  octave: number
  cents: number
  frequency: number
  midi: number
}

function dbToMag(db: number): number {
  if (!Number.isFinite(db) || db <= -100) return 0
  return Math.pow(10, db / 20)
}

/** Parabolic interpolation: y1,y2,y3 at bins i-1,i,i+1; y2 is peak. Returns fractional offset from i. */
function parabolicOffset(y1: number, y2: number, y3: number): number {
  const denom = y1 - 2 * y2 + y3
  if (Math.abs(denom) < 1e-12) return 0
  return 0.5 * (y1 - y3) / denom
}

function binToHz(bin: number, sampleRate: number, fftSize: number): number {
  return (bin * sampleRate) / fftSize
}

function hzToBin(hz: number, sampleRate: number, fftSize: number): number {
  return (hz * fftSize) / sampleRate
}

/** Reduce 50/60 Hz mains leakage stealing the fundamental (esp. near low E ~82 Hz). */
function attenuateMainsHum(
  mags: Float32Array,
  sampleRate: number,
  fftSize: number,
): void {
  for (let i = 0; i < mags.length; i++) {
    const f = binToHz(i, sampleRate, fftSize)
    if ((f >= 47 && f <= 53) || (f >= 57 && f <= 63)) {
      mags[i]! *= 0.1
    }
  }
}

function magnitudeAtHz(
  mags: Float32Array,
  hz: number,
  sampleRate: number,
  fftSize: number,
): number {
  const b = hzToBin(hz, sampleRate, fftSize)
  const i = Math.floor(b)
  if (i <= 0 || i >= mags.length - 1) return 0
  const t = b - i
  return mags[i]! * (1 - t) + mags[i + 1]! * t
}

/** Strongest local maximum in [minBin, maxBin] with parabolic refinement. */
function strongestPeakHz(
  mags: Float32Array,
  sampleRate: number,
  fftSize: number,
  minBin: number,
  maxBin: number,
): { hz: number; mag: number } | null {
  let bestI = -1
  let bestMag = 0
  const hi = Math.min(maxBin, mags.length - 2)
  const lo = Math.max(1, minBin)
  for (let i = lo; i <= hi; i++) {
    const a = mags[i - 1]!
    const b = mags[i]!
    const c = mags[i + 1]!
    if (b > a && b >= c && b > bestMag) {
      bestMag = b
      bestI = i
    }
  }
  if (bestI < 0) return null
  const off = parabolicOffset(
    mags[bestI - 1]!,
    mags[bestI]!,
    mags[bestI + 1]!,
  )
  const bin = bestI + off
  return { hz: binToHz(bin, sampleRate, fftSize), mag: bestMag }
}

/** Sum of weighted magnitudes at integer harmonics of f0 (captures “string-like” spectra). */
function harmonicSeriesScore(
  mags: Float32Array,
  sampleRate: number,
  fftSize: number,
  f0: number,
): number {
  const maxHz = sampleRate * 0.48
  let sum = 0
  for (let k = 1; k <= 32; k++) {
    const fk = k * f0
    if (fk >= maxHz) break
    const w = k <= 8 ? 1 : 1 / Math.sqrt(k)
    sum += w * magnitudeAtHz(mags, fk, sampleRate, fftSize)
  }
  return sum
}

/** Integer subharmonics of the spectral peak that lie in the search band. */
function subharmonicCandidates(
  peakHz: number,
  minHz: number,
  maxHz: number,
  maxDivisor = 14,
): number[] {
  const out: number[] = []
  for (let d = 1; d <= maxDivisor; d++) {
    const f0 = peakHz / d
    if (f0 >= minHz && f0 <= maxHz) out.push(f0)
  }
  return out
}

/**
 * Narrow refinement around the harmonic estimate only. A wide search (many bins) pulls the
 * readout onto 50/60 Hz hum, which sits one “lump” below ~82 Hz on typical FFT grids.
 */
function refineToLocalPeakHz(
  mags: Float32Array,
  approxHz: number,
  sampleRate: number,
  fftSize: number,
): number {
  const center = Math.round(hzToBin(approxHz, sampleRate, fftSize))
  const halfBins = 3
  const lo = Math.max(1, center - halfBins)
  const hi = Math.min(mags.length - 2, center + halfBins)

  let bestI = -1
  let bestM = -1
  for (let i = lo; i <= hi; i++) {
    const a = mags[i - 1]!
    const b = mags[i]!
    const c = mags[i + 1]!
    if (b > a && b >= c && b > bestM) {
      bestM = b
      bestI = i
    }
  }

  if (bestI < 0) {
    const c = Math.min(Math.max(center, 1), mags.length - 2)
    bestI = c
  }

  if (bestI <= 0 || bestI >= mags.length - 1) return approxHz
  const off = parabolicOffset(
    mags[bestI - 1]!,
    mags[bestI]!,
    mags[bestI + 1]!,
  )
  const refined = binToHz(bestI + off, sampleRate, fftSize)
  const binW = sampleRate / fftSize
  if (Math.abs(refined - approxHz) > binW * 4) return approxHz
  return refined
}

function pickFundamentalFromPeakHz(
  peakHz: number,
  mags: Float32Array,
  sampleRate: number,
  fftSize: number,
  minHz: number,
  maxHz: number,
): number {
  const candidates = subharmonicCandidates(peakHz, minHz, maxHz)
  if (candidates.length === 0) return peakHz
  if (candidates.length === 1) return candidates[0]!

  let bestF0 = candidates[0]!
  let bestScore = harmonicSeriesScore(
    mags,
    sampleRate,
    fftSize,
    bestF0,
  )
  for (let i = 1; i < candidates.length; i++) {
    const f0 = candidates[i]!
    const sc = harmonicSeriesScore(mags, sampleRate, fftSize, f0)
    if (sc > bestScore) {
      bestScore = sc
      bestF0 = f0
    } else if (Math.abs(sc - bestScore) < 1e-8 && f0 < bestF0) {
      bestF0 = f0
    }
  }
  return refineToLocalPeakHz(mags, bestF0, sampleRate, fftSize)
}

export function frequencyFromFFT(
  frequencyDb: Float32Array,
  sampleRate: number,
  fftSize: number,
  minHz = 70,
  maxHz = 500,
): number | null {
  const n = frequencyDb.length
  const mags = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    mags[i] = dbToMag(frequencyDb[i]!)
  }

  attenuateMainsHum(mags, sampleRate, fftSize)

  const minBin = Math.max(1, Math.floor(hzToBin(minHz, sampleRate, fftSize)))
  const maxBin = Math.min(
    n - 2,
    Math.ceil(hzToBin(maxHz, sampleRate, fftSize)),
  )
  if (minBin >= maxBin) return null

  const peak = strongestPeakHz(mags, sampleRate, fftSize, minBin, maxBin)
  if (!peak || peak.mag < 1e-6) return null

  return pickFundamentalFromPeakHz(
    peak.hz,
    mags,
    sampleRate,
    fftSize,
    minHz,
    maxHz,
  )
}

export function noteFromFrequency(freq: number): NoteInfo {
  const midiFloat = 12 * Math.log2(freq / A4_HZ) + 69
  const midi = Math.round(midiFloat)
  const nearestFreq = A4_HZ * Math.pow(2, (midi - 69) / 12)
  const cents = Math.round(1200 * Math.log2(freq / nearestFreq))
  const noteIndex = ((midi % 12) + 12) % 12
  const octave = Math.floor(midi / 12) - 1
  return {
    name: NOTE_NAMES[noteIndex]!,
    octave,
    cents,
    frequency: freq,
    midi,
  }
}

/** Equal-tempered Hz from MIDI note number (A4 = 440). */
function mtof(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - 69) / 12)
}

/** Standard tuning: E2 A2 D3 G3 B3 E4 */
export const GUITAR_STRINGS = [
  { label: 'E', sub: 'low', hz: mtof(40) },
  { label: 'A', sub: '', hz: mtof(45) },
  { label: 'D', sub: '', hz: mtof(50) },
  { label: 'G', sub: '', hz: mtof(55) },
  { label: 'B', sub: '', hz: mtof(59) },
  { label: 'E', sub: 'high', hz: mtof(64) },
] as const

export function nearestStringIndex(freq: number): number {
  let best = 0
  let bestDiff = Infinity
  for (let i = 0; i < GUITAR_STRINGS.length; i++) {
    const d = Math.abs(
      Math.log2(freq / GUITAR_STRINGS[i]!.hz) * 1200,
    )
    if (d < bestDiff) {
      bestDiff = d
      best = i
    }
  }
  return best
}

export function centsFromTarget(freq: number, targetHz: number): number {
  return Math.round(1200 * Math.log2(freq / targetHz))
}

export function computeRmsTimeDomain(timeData: Float32Array): number {
  let s = 0
  for (let i = 0; i < timeData.length; i++) {
    const x = timeData[i]!
    s += x * x
  }
  return Math.sqrt(s / timeData.length)
}
