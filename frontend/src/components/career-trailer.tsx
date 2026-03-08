'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { StoryboardPart } from '@/lib/api'
import { getCoachTTS } from '@/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

interface CareerTrailerProps {
  parts: StoryboardPart[]
  throughline?: string
  onClose: () => void
}

interface Chapter {
  text: string
  imageDataUrl: string | null
}

type PlaybackState = 'loading' | 'playing' | 'paused' | 'ended'

// ─── Constants ───────────────────────────────────────────────────────────────

const NARRATOR_COACH_ID = 'viktor'
const CROSSFADE_MS = 800
const FALLBACK_SLIDE_DURATION_MS = 8000
const END_CARD_DURATION_MS = 6000
const KENBURNS_DURATION_S = 15

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Pair up interleaved text+image parts into chapters. */
function buildChapters(parts: StoryboardPart[]): Chapter[] {
  const chapters: Chapter[] = []
  let pendingText: string | null = null

  for (const part of parts) {
    if (part.type === 'text') {
      // If we already had pending text without an image, flush it as text-only
      if (pendingText !== null) {
        chapters.push({ text: pendingText, imageDataUrl: null })
      }
      pendingText = part.content ?? ''
    } else if (part.type === 'image') {
      const dataUrl =
        part.data && part.mime_type
          ? `data:${part.mime_type};base64,${part.data}`
          : null
      chapters.push({
        text: pendingText ?? '',
        imageDataUrl: dataUrl,
      })
      pendingText = null
    }
  }
  // Flush trailing text
  if (pendingText !== null) {
    chapters.push({ text: pendingText, imageDataUrl: null })
  }

  return chapters
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CareerTrailer({
  parts,
  throughline,
  onClose,
}: CareerTrailerProps) {
  // ── Derived data ──
  const chapters = useMemo(() => buildChapters(parts), [parts])
  const totalSlides = chapters.length + 1 // +1 for end card

  // ── State ──
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playbackState, setPlaybackState] = useState<PlaybackState>('loading')
  const [visible, setVisible] = useState(false) // entrance animation trigger
  const [activeOpacity, setActiveOpacity] = useState(1)
  const [loadingProgress, setLoadingProgress] = useState(0)

  // ── Refs ──
  const audioCache = useRef<Map<number, HTMLAudioElement>>(new Map())
  const currentAudio = useRef<HTMLAudioElement | null>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  // ── Cleanup ──
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
      // Stop any playing audio
      currentAudio.current?.pause()
      // Revoke all object URLs
      audioCache.current.forEach((el) => {
        if (el.src.startsWith('blob:')) URL.revokeObjectURL(el.src)
      })
    }
  }, [])

  // ── Entrance animation ──
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  // ── Pre-fetch TTS audio with bulletproof timeout ──
  const startedRef = useRef(false)
  useEffect(() => {
    // Guard against React strict mode double-mount
    if (startedRef.current) return
    startedRef.current = true

    let cancelled = false

    // Absolute safety net: start playing no matter what after 4 seconds
    const safetyTimer = setTimeout(() => {
      if (!cancelled) setPlaybackState((s) => s === 'loading' ? 'playing' : s)
    }, 4000)

    async function prefetch() {
      const total = chapters.length
      let loaded = 0
      try {
        await Promise.allSettled(
          chapters.map(async (ch, i) => {
            if (!ch.text || cancelled) return
            try {
              const blob = await getCoachTTS(ch.text, NARRATOR_COACH_ID)
              if (cancelled || !blob) return
              const url = URL.createObjectURL(blob)
              const audio = new Audio(url)
              audio.preload = 'auto'
              audioCache.current.set(i, audio)
            } catch {
              // TTS failed — timer fallback
            } finally {
              loaded++
              if (!cancelled) setLoadingProgress(Math.round((loaded / total) * 100))
            }
          }),
        )
      } catch {
        // ignore
      }
      if (!cancelled) {
        clearTimeout(safetyTimer)
        setPlaybackState('playing')
      }
    }

    prefetch()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // only run once on mount — chapters is stable via useMemo

  // ── Advance to next slide ──
  const advanceTo = useCallback(
    (nextIndex: number) => {
      if (!mountedRef.current) return

      // Crossfade out
      setActiveOpacity(0)

      setTimeout(() => {
        if (!mountedRef.current) return
        // Stop current audio
        currentAudio.current?.pause()
        currentAudio.current = null

        if (nextIndex >= totalSlides) {
          setPlaybackState('ended')
          return
        }

        setCurrentIndex(nextIndex)
        // Crossfade in
        requestAnimationFrame(() => setActiveOpacity(1))
      }, CROSSFADE_MS)
    },
    [totalSlides],
  )

  // ── Play current slide (audio + timer) ──
  useEffect(() => {
    if (playbackState !== 'playing') return
    if (advanceTimer.current) clearTimeout(advanceTimer.current)

    const isEndCard = currentIndex >= chapters.length

    if (isEndCard) {
      // End card auto-close
      advanceTimer.current = setTimeout(() => {
        setPlaybackState('ended')
      }, END_CARD_DURATION_MS)
      return
    }

    const audio = audioCache.current.get(currentIndex)
    if (audio) {
      currentAudio.current = audio
      audio.currentTime = 0

      const onEnded = () => {
        audio.removeEventListener('ended', onEnded)
        // Small breath between slides
        advanceTimer.current = setTimeout(
          () => advanceTo(currentIndex + 1),
          400,
        )
      }
      audio.addEventListener('ended', onEnded)

      audio.play().catch(() => {
        // Autoplay blocked or audio error — fall back to timer
        audio.removeEventListener('ended', onEnded)
        advanceTimer.current = setTimeout(
          () => advanceTo(currentIndex + 1),
          FALLBACK_SLIDE_DURATION_MS,
        )
      })
    } else {
      // No audio for this slide — use timer
      advanceTimer.current = setTimeout(
        () => advanceTo(currentIndex + 1),
        FALLBACK_SLIDE_DURATION_MS,
      )
    }

    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
    }
  }, [currentIndex, playbackState, chapters.length, advanceTo])

  // ── Play / Pause ──
  const togglePlayPause = useCallback(() => {
    if (playbackState === 'playing') {
      setPlaybackState('paused')
      currentAudio.current?.pause()
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
    } else if (playbackState === 'paused') {
      setPlaybackState('playing')
      currentAudio.current?.play().catch(() => {})
      // Re-trigger the slide effect
    } else if (playbackState === 'ended') {
      // Restart
      setCurrentIndex(0)
      setActiveOpacity(1)
      setPlaybackState('playing')
    }
  }, [playbackState])

  // ── Close with fade-out ──
  const handleClose = useCallback(() => {
    currentAudio.current?.pause()
    if (advanceTimer.current) clearTimeout(advanceTimer.current)
    setVisible(false)
    setTimeout(onClose, 500)
  }, [onClose])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
      if (e.key === ' ') {
        e.preventDefault()
        togglePlayPause()
      }
      if (e.key === 'ArrowRight' && playbackState === 'playing') {
        advanceTo(currentIndex + 1)
      }
      if (e.key === 'ArrowLeft' && playbackState === 'playing' && currentIndex > 0) {
        advanceTo(currentIndex - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleClose, togglePlayPause, advanceTo, currentIndex, playbackState])

  // ── Progress ──
  const progress =
    playbackState === 'ended'
      ? 100
      : Math.round((currentIndex / totalSlides) * 100)

  // ── Seek via progress bar click ──
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const pct = (e.clientX - rect.left) / rect.width
      const targetIndex = Math.min(
        Math.floor(pct * totalSlides),
        totalSlides - 1,
      )
      currentAudio.current?.pause()
      if (advanceTimer.current) clearTimeout(advanceTimer.current)
      setCurrentIndex(targetIndex)
      setActiveOpacity(1)
      if (playbackState !== 'playing') setPlaybackState('playing')
    },
    [totalSlides, playbackState],
  )

  // ── Current chapter data ──
  const isEndCard = currentIndex >= chapters.length
  const chapter = isEndCard ? null : chapters[currentIndex]

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Inline keyframes — no external CSS needed */}
      <style jsx global>{`
        @keyframes ct-kenburns {
          0% {
            transform: scale(1) translate(0, 0);
          }
          50% {
            transform: scale(1.08) translate(-1.5%, -1%);
          }
          100% {
            transform: scale(1.12) translate(1%, -2%);
          }
        }
        @keyframes ct-pulse-glow {
          0%,
          100% {
            text-shadow: 0 0 20px rgba(126, 231, 135, 0.3),
              0 0 40px rgba(126, 231, 135, 0.1);
          }
          50% {
            text-shadow: 0 0 30px rgba(126, 231, 135, 0.5),
              0 0 60px rgba(126, 231, 135, 0.2);
          }
        }
        @keyframes ct-fade-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes ct-scan-line {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(100vh);
          }
        }
      `}</style>

      {/* Backdrop — dims and blurs the page behind */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 500ms ease-in-out',
        }}
        onClick={handleClose}
        aria-hidden
      />

      {/* Main trailer container */}
      <div
        className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
        style={{
          opacity: visible ? 1 : 0,
          transition: 'opacity 500ms ease-in-out',
        }}
        role="dialog"
        aria-modal
        aria-label="Career Trailer"
      >
        {/* Letterbox — 16:9 centered viewport */}
        <div
          className="relative w-full"
          style={{
            maxWidth: 'min(95vw, 1600px)',
            aspectRatio: '16 / 9',
            maxHeight: '85vh',
            backgroundColor: '#0D1117',
            borderRadius: '4px',
            overflow: 'hidden',
            boxShadow: '0 0 80px rgba(0,0,0,0.8), 0 0 200px rgba(88,166,255,0.08)',
          }}
        >
          {/* ── Loading state ── */}
          {playbackState === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
              {/* Scan line effect */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(transparent 50%, rgba(126,231,135,0.03) 50%)',
                  backgroundSize: '100% 4px',
                }}
              />

              <div
                className="text-sm tracking-[0.3em] uppercase"
                style={{ color: '#7EE787', fontFamily: 'monospace' }}
              >
                Rendering career trailer
              </div>

              {/* Progress bar */}
              <div
                className="w-64 h-1 rounded-full overflow-hidden"
                style={{ backgroundColor: 'rgba(126,231,135,0.15)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${loadingProgress}%`,
                    backgroundColor: '#7EE787',
                    transition: 'width 300ms ease-out',
                    boxShadow: '0 0 12px rgba(126,231,135,0.5)',
                  }}
                />
              </div>

              <div
                className="text-xs"
                style={{ color: '#8B949E', fontFamily: 'monospace' }}
              >
                Pre-fetching voiceover... {loadingProgress}%
              </div>
            </div>
          )}

          {/* ── Chapter slide ── */}
          {playbackState !== 'loading' && !isEndCard && chapter && (
            <div
              className="absolute inset-0"
              style={{
                opacity: activeOpacity,
                transition: `opacity ${CROSSFADE_MS}ms ease-in-out`,
              }}
            >
              {/* Background image with Ken Burns */}
              {chapter.imageDataUrl ? (
                <div className="absolute inset-0 overflow-hidden">
                  <img
                    key={`img-${currentIndex}`}
                    src={chapter.imageDataUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                      animation: `ct-kenburns ${KENBURNS_DURATION_S}s ease-in-out forwards`,
                    }}
                  />
                  {/* Gradient vignette over image */}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `
                        linear-gradient(to top, rgba(13,17,23,0.95) 0%, rgba(13,17,23,0.4) 30%, transparent 60%),
                        linear-gradient(to bottom, rgba(13,17,23,0.6) 0%, transparent 20%),
                        radial-gradient(ellipse at center, transparent 40%, rgba(13,17,23,0.5) 100%)
                      `,
                    }}
                  />
                </div>
              ) : (
                /* Text-only slide — subtle ambient background */
                <div
                  className="absolute inset-0"
                  style={{
                    background: `
                      radial-gradient(ellipse at 30% 50%, rgba(88,166,255,0.06) 0%, transparent 60%),
                      radial-gradient(ellipse at 70% 50%, rgba(126,231,135,0.04) 0%, transparent 60%),
                      #0D1117
                    `,
                  }}
                />
              )}

              {/* Chapter number */}
              <div
                className="absolute top-6 left-8"
                style={{
                  color: 'rgba(126,231,135,0.5)',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  animation: 'ct-fade-up 600ms ease-out',
                }}
              >
                Chapter {currentIndex + 1} / {chapters.length}
              </div>

              {/* Subtitle text */}
              <div
                className="absolute bottom-0 left-0 right-0 px-12 pb-12"
                style={{ animation: 'ct-fade-up 800ms ease-out' }}
              >
                <p
                  className="text-lg md:text-xl lg:text-2xl leading-relaxed max-w-4xl"
                  style={{
                    color: '#E6EDF3',
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
                    textShadow: '0 2px 12px rgba(0,0,0,0.8)',
                    lineHeight: 1.6,
                  }}
                >
                  {chapter.text}
                </p>
              </div>
            </div>
          )}

          {/* ── End card ── */}
          {playbackState !== 'loading' && isEndCard && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{
                opacity: activeOpacity,
                transition: `opacity ${CROSSFADE_MS}ms ease-in-out`,
                background: `
                  radial-gradient(ellipse at center, rgba(126,231,135,0.08) 0%, transparent 50%),
                  radial-gradient(ellipse at center, rgba(88,166,255,0.05) 0%, transparent 70%),
                  #0D1117
                `,
              }}
            >
              <div
                className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-8"
                style={{
                  color: '#7EE787',
                  animation: 'ct-pulse-glow 3s ease-in-out infinite',
                  fontFamily:
                    '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
                }}
              >
                Career Mode Live
              </div>

              {throughline && (
                <p
                  className="text-base md:text-lg max-w-2xl text-center px-8 leading-relaxed"
                  style={{
                    color: '#C9D1D9',
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
                    animation: 'ct-fade-up 1200ms ease-out 400ms both',
                  }}
                >
                  &ldquo;{throughline}&rdquo;
                </p>
              )}

              <div
                className="mt-12 text-xs tracking-[0.25em] uppercase"
                style={{
                  color: '#8B949E',
                  fontFamily: 'monospace',
                  animation: 'ct-fade-up 1000ms ease-out 800ms both',
                }}
              >
                Your story. Your narrative. Your career.
              </div>
            </div>
          )}

          {/* ── Controls overlay ── */}
          {playbackState !== 'loading' && (
            <>
              {/* Close button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-full"
                style={{
                  backgroundColor: 'rgba(13,17,23,0.6)',
                  border: '1px solid rgba(201,209,217,0.15)',
                  color: '#C9D1D9',
                  transition: 'all 200ms',
                  backdropFilter: 'blur(8px)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'rgba(201,209,217,0.15)'
                  e.currentTarget.style.color = '#E6EDF3'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    'rgba(13,17,23,0.6)'
                  e.currentTarget.style.color = '#C9D1D9'
                }}
                aria-label="Close trailer"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M4 4L12 12M12 4L4 12" />
                </svg>
              </button>

              {/* Play/Pause button — center */}
              <button
                onClick={togglePlayPause}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-16 h-16 rounded-full group"
                style={{
                  backgroundColor: 'rgba(13,17,23,0.5)',
                  border: '1px solid rgba(201,209,217,0.1)',
                  color: '#C9D1D9',
                  opacity: playbackState === 'paused' || playbackState === 'ended' ? 1 : 0,
                  transition: 'opacity 300ms',
                  pointerEvents:
                    playbackState === 'paused' || playbackState === 'ended'
                      ? 'auto'
                      : 'none',
                  backdropFilter: 'blur(8px)',
                }}
                aria-label={
                  playbackState === 'ended'
                    ? 'Replay'
                    : playbackState === 'paused'
                      ? 'Play'
                      : 'Pause'
                }
              >
                {playbackState === 'ended' ? (
                  /* Replay icon */
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
                  </svg>
                ) : (
                  /* Play icon */
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Hover-to-pause zone — shows pause icon on hover during playback */}
              {playbackState === 'playing' && (
                <button
                  onClick={togglePlayPause}
                  className="absolute inset-0 z-[5] cursor-pointer group"
                  style={{ backgroundColor: 'transparent' }}
                  aria-label="Pause"
                >
                  <div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-16 h-16 rounded-full opacity-0 group-hover:opacity-100"
                    style={{
                      backgroundColor: 'rgba(13,17,23,0.5)',
                      border: '1px solid rgba(201,209,217,0.1)',
                      color: '#C9D1D9',
                      transition: 'opacity 200ms',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  </div>
                </button>
              )}

              {/* Progress bar */}
              <div
                className="absolute bottom-0 left-0 right-0 z-10"
                style={{ padding: '0 0 0 0' }}
              >
                <div
                  className="w-full h-1 cursor-pointer group"
                  style={{
                    backgroundColor: 'rgba(201,209,217,0.1)',
                  }}
                  onClick={handleProgressClick}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Trailer progress"
                >
                  <div
                    className="h-full relative"
                    style={{
                      width: `${progress}%`,
                      backgroundColor: '#7EE787',
                      transition: 'width 400ms ease-out',
                      boxShadow: '0 0 8px rgba(126,231,135,0.4)',
                    }}
                  >
                    {/* Playhead dot */}
                    <div
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100"
                      style={{
                        backgroundColor: '#7EE787',
                        boxShadow: '0 0 6px rgba(126,231,135,0.6)',
                        transition: 'opacity 200ms',
                        transform: 'translate(50%, -50%)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Scan lines overlay — subtle CRT film effect */}
          <div
            className="absolute inset-0 pointer-events-none z-20"
            style={{
              background:
                'repeating-linear-gradient(transparent 0px, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
              mixBlendMode: 'multiply',
            }}
          />

          {/* Top and bottom letterbox bars (subtle border) */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ backgroundColor: 'rgba(126,231,135,0.1)' }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-px"
            style={{ backgroundColor: 'rgba(126,231,135,0.1)' }}
          />
        </div>

        {/* Keyboard hints — below letterbox */}
        <div
          className="mt-4 flex items-center gap-6 text-xs"
          style={{
            color: 'rgba(139,148,158,0.6)',
            fontFamily: 'monospace',
            opacity: visible ? 1 : 0,
            transition: 'opacity 800ms ease-in-out 600ms',
          }}
        >
          <span>
            <kbd className="px-1.5 py-0.5 rounded border border-gray-700 bg-gray-800/50 text-gray-400">
              Space
            </kbd>{' '}
            Play / Pause
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded border border-gray-700 bg-gray-800/50 text-gray-400">
              &larr; &rarr;
            </kbd>{' '}
            Navigate
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded border border-gray-700 bg-gray-800/50 text-gray-400">
              Esc
            </kbd>{' '}
            Close
          </span>
        </div>
      </div>
    </>
  )
}
