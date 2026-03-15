'use client'

/**
 * LiveSessionOverlay — Full-screen 1:1 voice coaching session with a single coach.
 *
 * Split into two components to avoid React render-cycle issues:
 * - LiveSessionOverlay (wrapper): fetches API key, shows loading state
 * - LiveSessionInner: mounts only when API key is ready, owns the WebSocket hook
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useCoachingLive } from '@/hooks/use-coaching-live'
import { useCharacterStore } from '@/stores/character-store'
import { getLiveConfig } from '@/lib/api'

interface LiveSessionOverlayProps {
  coachId: string
  coachName: string
  coachTitle: string
  coachColor: string
  coachIcon: string
  voiceName: string
  systemPrompt: string
  onClose: (sessionTranscript: string[]) => void
}

// ─── Wrapper: fetches API key, then mounts inner ─────────────────────────────

export function LiveSessionOverlay(props: LiveSessionOverlayProps) {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    getLiveConfig()
      .then((cfg) => {
        if (cfg?.api_key) {
          setApiKey(cfg.api_key)
        } else {
          setFetchError('No API key returned from server')
        }
      })
      .catch((err) => {
        setFetchError(`Failed to fetch live config: ${err instanceof Error ? err.message : 'unknown'}`)
      })
  }, [])

  // Show loading overlay while fetching key
  if (!apiKey) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center"
        style={{ backgroundColor: '#0D1117F0' }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl border-4 animate-pulse"
            style={{
              color: props.coachColor,
              borderColor: `${props.coachColor}30`,
              backgroundColor: `${props.coachColor}10`,
            }}
          >
            {props.coachIcon}
          </div>
          <p className="text-sm text-text-muted font-mono">
            {fetchError || 'Setting up voice session...'}
          </p>
          {fetchError && (
            <button
              onClick={() => props.onClose([])}
              className="text-xs text-accent-blue hover:underline mt-2"
            >
              Go back
            </button>
          )}
        </div>
      </div>
    )
  }

  return <LiveSessionInner {...props} apiKey={apiKey} />
}

// ─── Inner: owns the WebSocket hook, auto-connects on mount ──────────────────

interface LiveSessionInnerProps extends LiveSessionOverlayProps {
  apiKey: string
}

function LiveSessionInner({
  coachId,
  coachName,
  coachTitle,
  coachColor,
  coachIcon,
  voiceName,
  systemPrompt,
  apiKey,
  onClose,
}: LiveSessionInnerProps) {
  const { characterSheet, conversationHistory } = useCharacterStore()
  const [textInput, setTextInput] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const transcriptRef = useRef<HTMLDivElement>(null)

  // Build conversation context from panel history (stable across renders)
  const conversationContext = conversationHistory
    .slice(-10)
    .map((entry) => `${entry.coach_name || entry.role}: ${entry.content}`)
    .join('\n')

  const live = useCoachingLive({
    apiKey,
    coachId,
    coachName,
    voiceName,
    systemInstruction: systemPrompt,
    characterSheet,
    conversationContext,
  })

  // Auto-connect exactly once on mount
  const connectCalledRef = useRef(false)
  useEffect(() => {
    if (connectCalledRef.current) return
    connectCalledRef.current = true
    live.connect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll transcript to bottom
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [live.fullTranscript, live.transcript])

  const handleEndSession = useCallback(() => {
    setIsEnding(true)
    live.disconnect()
    setTimeout(() => {
      onClose(live.fullTranscript)
    }, 300)
  }, [live, onClose])

  const handleSendText = useCallback(() => {
    const text = textInput.trim()
    if (!text) return
    live.sendText(text)
    setTextInput('')
  }, [textInput, live])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendText()
    }
  }

  const pulseScale = live.isSpeaking ? 'scale-110' : live.isListening ? 'scale-100' : 'scale-95'

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-300 ${
        isEnding ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: '#0D1117F0' }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: live.isConnected ? '#7EE787' : live.error ? '#FF7B72' : '#F0883E',
              boxShadow: live.isConnected ? '0 0 8px #7EE78780' : undefined,
            }}
          />
          <span className="text-xs font-mono text-text-muted">
            {live.isConnected
              ? `Live session with ${coachName}`
              : live.error
              ? 'Connection error'
              : 'Connecting...'}
          </span>
          {live.turnCount > 0 && (
            <span className="text-xs font-mono text-text-muted">
              | {live.turnCount} turn{live.turnCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <button
          onClick={handleEndSession}
          className="px-4 py-2 rounded-full text-xs font-mono bg-accent-red/15 text-accent-red border border-accent-red/30 hover:bg-accent-red/25 transition-colors"
        >
          End Session
        </button>
      </div>

      {/* Center — Coach avatar with visualization */}
      <div className="flex flex-col items-center gap-8 -mt-12">
        {/* Pulsing rings behind avatar */}
        <div className="relative">
          {/* Outer pulse ring — speaking */}
          {live.isSpeaking && (
            <>
              <div
                className="absolute -inset-12 rounded-full animate-ping"
                style={{
                  backgroundColor: `${coachColor}08`,
                  animationDuration: '2s',
                }}
              />
              <div
                className="absolute -inset-8 rounded-full animate-pulse"
                style={{
                  backgroundColor: `${coachColor}12`,
                }}
              />
            </>
          )}

          {/* Listening indicator — subtle breathing */}
          {live.isListening && !live.isSpeaking && (
            <div
              className="absolute -inset-6 rounded-full"
              style={{
                border: `2px solid ${coachColor}30`,
                animation: 'pulse 3s ease-in-out infinite',
              }}
            />
          )}

          {/* Avatar */}
          <div
            className={`relative w-32 h-32 rounded-full flex items-center justify-center text-5xl font-bold border-4 transition-all duration-500 ${pulseScale}`}
            style={{
              color: coachColor,
              borderColor: live.isSpeaking
                ? coachColor
                : live.isConnected
                ? `${coachColor}80`
                : `${coachColor}30`,
              backgroundColor: `${coachColor}${live.isSpeaking ? '20' : '10'}`,
              boxShadow: live.isSpeaking
                ? `0 0 60px ${coachColor}30, 0 0 120px ${coachColor}10`
                : undefined,
            }}
          >
            {coachIcon}

            {/* Sound wave indicators when speaking */}
            {live.isSpeaking && (
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full animate-bounce"
                    style={{
                      backgroundColor: coachColor,
                      height: `${12 + Math.random() * 8}px`,
                      animationDelay: `${i * 100}ms`,
                      animationDuration: '0.6s',
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coach name */}
        <div className="text-center">
          <h2 className="text-2xl font-bold" style={{ color: coachColor }}>
            {coachName}
          </h2>
          <p className="text-sm text-text-muted mt-1">{coachTitle}</p>
          <p className="text-xs text-text-muted mt-2 font-mono">
            {live.isSpeaking
              ? 'Speaking...'
              : live.isListening
              ? 'Listening — talk naturally, interrupt anytime'
              : live.isConnected
              ? 'Connected'
              : 'Setting up voice session...'}
          </p>
        </div>

        {/* Live transcript */}
        {(live.transcript || live.fullTranscript.length > 0) && (
          <div
            ref={transcriptRef}
            className="w-full max-w-lg max-h-40 overflow-y-auto px-4 py-3 rounded-xl bg-bg-secondary/50 border border-border"
          >
            {/* Previous turns (dimmed) */}
            {live.fullTranscript.map((turn, i) => (
              <p key={i} className="text-xs text-text-muted mb-2 leading-relaxed">
                <span className="font-mono" style={{ color: `${coachColor}80` }}>
                  {coachName}:
                </span>{' '}
                {turn}
              </p>
            ))}
            {/* Current turn (active) */}
            {live.transcript && (
              <p className="text-sm text-text-primary leading-relaxed">
                <span className="font-mono" style={{ color: coachColor }}>
                  {coachName}:
                </span>{' '}
                {live.transcript}
                <span className="inline-block w-1.5 h-4 ml-0.5 animate-pulse" style={{ backgroundColor: coachColor }} />
              </p>
            )}
          </div>
        )}
      </div>

      {/* Bottom — text input fallback + controls */}
      <div className="absolute bottom-0 left-0 right-0 px-6 py-4">
        <div className="max-w-lg mx-auto">
          {/* Toggle text input */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <button
              onClick={() => setShowTextInput(!showTextInput)}
              className="text-xs font-mono text-text-muted hover:text-text-secondary transition-colors"
            >
              {showTextInput ? 'Hide text input' : 'Type instead'}
            </button>
          </div>

          {/* Text input */}
          {showTextInput && (
            <div className="flex items-end gap-2">
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Type a message to ${coachName}...`}
                rows={1}
                className="flex-1 px-4 py-3 rounded-xl bg-bg-tertiary border border-border text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent-blue transition-colors text-sm"
                style={{ maxHeight: '80px' }}
              />
              <button
                onClick={handleSendText}
                disabled={!textInput.trim()}
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-opacity disabled:opacity-30"
                style={{ backgroundColor: coachColor }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D1117" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          )}

          {/* Mic status */}
          {!showTextInput && live.isListening && (
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent-red animate-pulse" />
              <span className="text-xs font-mono text-text-muted">Microphone active</span>
            </div>
          )}

          {/* Error display */}
          {live.error && (
            <div className="text-center mt-2">
              <p className="text-xs text-accent-red">{live.error}</p>
              <button
                onClick={() => live.connect()}
                className="text-xs text-accent-blue hover:underline mt-1"
              >
                Retry connection
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
