import { useState } from 'react'
import { useTuner, type TunerMode } from './hooks/useTuner'
import { GUITAR_STRINGS } from './lib/fftPitch'
import './App.css'

function formatHz(hz: number | null): string {
  if (hz == null || !Number.isFinite(hz)) return '—'
  return hz < 100 ? hz.toFixed(1) : hz.toFixed(0)
}

export default function App() {
  const [mode, setMode] = useState<TunerMode>('auto')
  const [manualString, setManualString] = useState(0)
  const { state, start, stop } = useTuner(mode, manualString)

  const inTune =
    state.cents != null && Math.abs(state.cents) <= 5

  const meterRotation = Math.max(
    -48,
    Math.min(48, ((state.cents ?? 0) / 50) * 48),
  )

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <span className="brand-mark-inner" />
          </span>
          <div>
            <h1 className="title">Resonance</h1>
            <p className="tagline">FFT guitar tuner · real-time</p>
          </div>
        </div>
        <div className="header-right">
          {state.active && (
            <div className="live-pill" aria-live="polite">
              <span className="live-dot" />
              <span className="live-text">Listening</span>
            </div>
          )}
          <div className="header-actions">
            {!state.active ? (
              <button type="button" className="btn btn-primary" onClick={start}>
                <span className="btn-icon" aria-hidden>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M19 11a7 7 0 0 1-14 0M12 18v3"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                Enable mic
              </button>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={stop}>
                Stop
              </button>
            )}
          </div>
        </div>
      </header>

      {state.error && (
        <div className="banner banner-error" role="alert">
          {state.error}
        </div>
      )}

      <main className="main">
        <section
          className={`card display-card${inTune ? ' display-card--tuned' : ''}`}
          aria-live="polite"
        >
          <div className="note-block">
            <span
              key={state.note ? `${state.note.name}-${state.note.octave}` : 'idle'}
              className={`note-name${inTune ? ' note-name--tuned' : ''}${state.note ? ' note-name--live' : ''}`}
            >
              {state.note ? state.note.name : '—'}
            </span>
            {state.note && (
              <span className="note-octave">{state.note.octave}</span>
            )}
          </div>
          <div className="hz-block">
            <span className="hz-label">Detected pitch</span>
            <p className="hz-readout">
              <span className="hz-value">{formatHz(state.frequency)}</span>
              <span className="hz-unit">Hz</span>
            </p>
          </div>

          <div className="meter-wrap">
            <svg
              className="meter-svg"
              viewBox="0 0 220 120"
              aria-hidden
            >
              <defs>
                <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--meter-low)" />
                  <stop offset="50%" stopColor="var(--meter-mid)" />
                  <stop offset="100%" stopColor="var(--meter-high)" />
                </linearGradient>
              </defs>
              <path
                className="meter-track"
                d="M 28 100 A 82 82 0 0 1 192 100"
                fill="none"
                strokeWidth="10"
              />
              <path
                className="meter-ticks"
                d="M 36 99 L 40 92 M 110 34 L 110 42 M 184 99 L 180 92"
                fill="none"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                className="meter-arc"
                d="M 38 100 A 72 72 0 0 1 182 100"
                fill="none"
                stroke="url(#arcGrad)"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
            <div
              className={`needle ${inTune ? 'needle-tuned' : ''}`}
              style={{ transform: `rotate(${meterRotation}deg)` }}
            />
            <div className="meter-labels">
              <span>♭</span>
              <span>♮</span>
              <span>♯</span>
            </div>
          </div>

          <p
            className={`cents-readout ${
              state.cents == null
                ? ''
                : inTune
                  ? 'cents-in'
                  : state.cents > 0
                    ? 'cents-sharp'
                    : 'cents-flat'
            }`}
          >
            {state.cents == null
              ? 'Play a string'
              : inTune
                ? 'In tune — hold steady'
                : `${state.cents > 0 ? '+' : ''}${state.cents} cents`}
          </p>
        </section>

        <section className="card controls-card">
          <div className="mode-row">
            <span className="label">Target</span>
            <div className="segmented" role="group" aria-label="Tuning mode">
              <button
                type="button"
                className={mode === 'auto' ? 'seg active' : 'seg'}
                aria-pressed={mode === 'auto'}
                onClick={() => setMode('auto')}
              >
                Auto
              </button>
              <button
                type="button"
                className={mode === 'manual' ? 'seg active' : 'seg'}
                aria-pressed={mode === 'manual'}
                onClick={() => setMode('manual')}
              >
                By string
              </button>
            </div>
          </div>

          <div className="strings-grid">
            {GUITAR_STRINGS.map((s, i) => {
              const active =
                state.active &&
                state.stringIndex === i &&
                state.frequency != null
              const selected = mode === 'manual' && manualString === i
              const tunedHere = active && inTune
              const label =
                s.sub === 'low'
                  ? `Low ${s.label}, ${Math.round(s.hz)} hertz`
                  : s.sub === 'high'
                    ? `High ${s.label}, ${Math.round(s.hz)} hertz`
                    : `${s.label} string, ${Math.round(s.hz)} hertz`
              return (
                <button
                  key={`${s.label}-${s.sub}-${i}`}
                  type="button"
                  className={`string-btn ${selected ? 'string-selected' : ''} ${active ? 'string-active' : ''} ${tunedHere ? 'string-tuned' : ''}`}
                  aria-label={label}
                  onClick={() => {
                    setManualString(i)
                    setMode('manual')
                  }}
                >
                  <span className="string-note">{s.label}</span>
                  {s.sub && <span className="string-sub">{s.sub}</span>}
                  <span className="string-hz">{Math.round(s.hz)} Hz</span>
                </button>
              )
            })}
          </div>

          <footer className="hint-footer">
            <p className="hint">
              <span className="hint-title">Tip</span>
              Uses the browser FFT (AnalyserNode, {8192}-point). Turn off noise
              suppression in system audio settings when possible for a steadier
              reading.
            </p>
          </footer>
        </section>
      </main>

      <div className="level-bar" aria-hidden>
        <div
          className="level-fill"
          style={{
            transform: `scaleX(${Math.min(1, state.rms * 40)})`,
            opacity: state.active ? 1 : 0.35,
          }}
        />
      </div>
    </div>
  )
}
