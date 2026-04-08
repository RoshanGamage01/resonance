import { useCallback, useEffect, useRef, useState, useLayoutEffect } from 'react'
import {
  type NoteInfo,
  computeRmsTimeDomain,
  frequencyFromFFT,
  nearestStringIndex,
  noteFromFrequency,
  centsFromTarget,
  GUITAR_STRINGS,
} from '../lib/fftPitch'

const FFT_SIZE = 8192
const RMS_THRESHOLD = 0.004
const MIN_HZ = 70
const MAX_HZ = 520
/** EMA blend for displayed Hz (higher = smoother needle, more latency). */
const FREQ_SMOOTH = 0.88
/** Snap EMA when pitch jumps (new string / big error). */
const FREQ_JUMP_RATIO = 0.22

export type TunerMode = 'auto' | 'manual'

export type TunerState = {
  active: boolean
  error: string | null
  rms: number
  frequency: number | null
  note: NoteInfo | null
  stringIndex: number | null
  cents: number | null
  targetHz: number | null
}

const initialState: TunerState = {
  active: false,
  error: null,
  rms: 0,
  frequency: null,
  note: null,
  stringIndex: null,
  cents: null,
  targetHz: null,
}

export function useTuner(mode: TunerMode, manualStringIndex: number) {
  const [state, setState] = useState<TunerState>(initialState)
  const ctxRef = useRef<AudioContext | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const modeRef = useRef(mode)
  const manualStringRef = useRef(manualStringIndex)
  const smoothHzRef = useRef<number | null>(null)
  useLayoutEffect(() => {
    modeRef.current = mode
    manualStringRef.current = manualStringIndex
  }, [mode, manualStringIndex])

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void ctxRef.current?.close()
    ctxRef.current = null
    smoothHzRef.current = null
    setState(initialState)
  }, [])

  const start = useCallback(async () => {
    stop()
    setState({ ...initialState, error: null })

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      streamRef.current = stream

      const ctx = new AudioContext()
      ctxRef.current = ctx
      await ctx.resume()

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = 0.82
      source.connect(analyser)

      const freqBuf = new Float32Array(analyser.frequencyBinCount)
      const timeBuf = new Float32Array(analyser.fftSize)

      const tick = () => {
        const c = ctxRef.current
        if (!c || c.state === 'closed') return

        analyser.getFloatTimeDomainData(timeBuf)
        const rms = computeRmsTimeDomain(timeBuf)

        analyser.getFloatFrequencyData(freqBuf)
        const sr = c.sampleRate
        let rawHz = frequencyFromFFT(freqBuf, sr, analyser.fftSize, MIN_HZ, MAX_HZ)

        if (rms < RMS_THRESHOLD) rawHz = null

        let frequency: number | null = null
        if (rawHz == null) {
          smoothHzRef.current = null
        } else {
          const prev = smoothHzRef.current
          if (
            prev == null ||
            Math.abs(rawHz - prev) / prev > FREQ_JUMP_RATIO
          ) {
            smoothHzRef.current = rawHz
          } else {
            smoothHzRef.current =
              prev * FREQ_SMOOTH + rawHz * (1 - FREQ_SMOOTH)
          }
          frequency = smoothHzRef.current
        }

        let note: NoteInfo | null = null
        let stringIndex: number | null = null
        let cents: number | null = null
        let targetHz: number | null = null

        if (frequency != null && frequency > 0) {
          note = noteFromFrequency(frequency)
          const m = modeRef.current
          const ms = manualStringRef.current
          if (m === 'auto') {
            stringIndex = nearestStringIndex(frequency)
            targetHz = GUITAR_STRINGS[stringIndex]!.hz
            cents = centsFromTarget(frequency, targetHz)
          } else {
            stringIndex = ms
            targetHz = GUITAR_STRINGS[ms]!.hz
            cents = centsFromTarget(frequency, targetHz)
          }
        }

        setState({
          active: true,
          error: null,
          rms,
          frequency,
          note,
          stringIndex,
          cents,
          targetHz,
        })

        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Microphone access was denied.'
      setState({ ...initialState, error: message })
    }
  }, [stop])

  useEffect(() => () => stop(), [stop])

  return { state, start, stop }
}
