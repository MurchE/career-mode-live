'use client'

/**
 * useCoachingLive — 1:1 real-time bidirectional voice with a single coach via Gemini Live API.
 *
 * Adapted from use-gemini-live.ts but stripped of canvas/whiteboard logic.
 * Each coach has a distinct voice and system instruction.
 * Supports barge-in (user interrupts AI mid-speech).
 */

import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CoachingLiveConfig {
  apiKey: string
  coachId: string
  coachName: string
  voiceName: string
  systemInstruction: string
  characterSheet?: Record<string, unknown> | null
  conversationContext?: string
}

interface CoachingLiveState {
  isConnected: boolean
  isListening: boolean
  isSpeaking: boolean
  transcript: string       // Rolling AI transcript (current turn)
  fullTranscript: string[] // All AI turns accumulated
  userTurns: string[]      // User text turns (if sent via text)
  error: string | null
  turnCount: number
}

type ServerMessage = {
  setupComplete?: boolean
  serverContent?: {
    modelTurn?: {
      parts?: Array<{
        text?: string
        inlineData?: { mimeType: string; data: string }
      }>
    }
    turnComplete?: boolean
    interrupted?: boolean
  }
}

// ─── Audio Helpers ────────────────────────────────────────────────────────────

function float32ToInt16(float32: Float32Array): ArrayBuffer {
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return int16.buffer
}

function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return buffer
  const ratio = fromRate / toRate
  const newLength = Math.round(buffer.length / ratio)
  const result = new Float32Array(newLength)
  for (let i = 0; i < newLength; i++) {
    const idx = Math.round(i * ratio)
    result[i] = buffer[Math.min(idx, buffer.length - 1)]
  }
  return result
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function int16ToFloat32(int16Buffer: ArrayBuffer): Float32Array {
  const int16 = new Int16Array(int16Buffer)
  const float32 = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000
  }
  return float32
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

export function useCoachingLive(config: CoachingLiveConfig) {
  const configRef = useRef(config)
  configRef.current = config

  const wsRef = useRef<WebSocket | null>(null)
  const connectingRef = useRef(false)
  const unmountedRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const playbackQueueRef = useRef<Float32Array[]>([])
  const nextPlayTimeRef = useRef(0)
  const isPlayingRef = useRef(false)
  const currentTurnTextRef = useRef('')

  const [state, setState] = useState<CoachingLiveState>({
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    transcript: '',
    fullTranscript: [],
    userTurns: [],
    error: null,
    turnCount: 0,
  })

  // ── Gapless playback queue processor ──
  const processPlaybackQueue = useCallback(() => {
    if (playbackQueueRef.current.length === 0) return

    const ctx = audioContextRef.current
    if (!ctx) return

    const now = ctx.currentTime
    if (nextPlayTimeRef.current < now) {
      nextPlayTimeRef.current = now
    }

    if (!isPlayingRef.current) {
      isPlayingRef.current = true
      setState((s) => ({ ...s, isSpeaking: true }))
    }

    while (playbackQueueRef.current.length > 0) {
      const samples = playbackQueueRef.current.shift()!
      const buffer = ctx.createBuffer(1, samples.length, 24000)
      buffer.getChannelData(0).set(samples)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start(nextPlayTimeRef.current)

      const duration = samples.length / 24000
      nextPlayTimeRef.current += duration

      source.onended = () => {
        const ctx2 = audioContextRef.current
        if (ctx2 && ctx2.currentTime >= nextPlayTimeRef.current - 0.05) {
          isPlayingRef.current = false
          setState((s) => ({ ...s, isSpeaking: false }))
        }
      }
    }
  }, [])

  // ── Flush playback (barge-in) ──
  const flushPlayback = useCallback(() => {
    playbackQueueRef.current = []
    nextPlayTimeRef.current = 0
    isPlayingRef.current = false
    const oldCtx = audioContextRef.current
    if (oldCtx && oldCtx.state !== 'closed') {
      oldCtx.close().catch(() => {})
      audioContextRef.current = new AudioContext({ sampleRate: 48000 })
    }
    setState((s) => ({ ...s, isSpeaking: false }))
  }, [])

  // ── Handle incoming WebSocket messages ──
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data)

        if (msg.setupComplete) {
          setState((s) => ({ ...s, isConnected: true, error: null }))
          return
        }

        // Barge-in: user interrupted
        if (msg.serverContent?.interrupted) {
          flushPlayback()
          return
        }

        if (msg.serverContent?.modelTurn?.parts) {
          for (const part of msg.serverContent.modelTurn.parts) {
            // Audio
            if (part.inlineData?.data) {
              const pcmBuffer = base64ToArrayBuffer(part.inlineData.data)
              const float32 = int16ToFloat32(pcmBuffer)
              playbackQueueRef.current.push(float32)
              processPlaybackQueue()
            }

            // Text transcript from model
            if (part.text) {
              currentTurnTextRef.current += part.text
              setState((s) => ({
                ...s,
                transcript: currentTurnTextRef.current,
              }))
            }
          }
        }

        // Turn complete — save transcript and reset for next turn
        if (msg.serverContent?.turnComplete) {
          const turnText = currentTurnTextRef.current
          if (turnText.trim()) {
            setState((s) => ({
              ...s,
              fullTranscript: [...s.fullTranscript, turnText],
              turnCount: s.turnCount + 1,
            }))
          }
          currentTurnTextRef.current = ''
          // Clear current transcript display after a delay
          setTimeout(() => {
            setState((s) => ({ ...s, transcript: '' }))
          }, 2000)
        }
      } catch (err) {
        console.error('Coaching Live message parse error:', err)
      }
    },
    [processPlaybackQueue, flushPlayback],
  )

  // ── Start mic capture ──
  const startMicCapture = useCallback(
    async (ws: WebSocket) => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        micStreamRef.current = stream

        const ctx = new AudioContext({ sampleRate: 48000 })
        audioContextRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)

        const processor = ctx.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor
        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return

          const inputData = e.inputBuffer.getChannelData(0)
          const downsampled = downsample(inputData, ctx.sampleRate, 16000)
          const pcm = float32ToInt16(downsampled)
          const b64 = arrayBufferToBase64(pcm)

          ws.send(
            JSON.stringify({
              realtime_input: {
                media_chunks: [
                  {
                    mime_type: 'audio/pcm;rate=16000',
                    data: b64,
                  },
                ],
              },
            }),
          )
        }

        sourceNodeRef.current = source
        source.connect(processor)
        processor.connect(ctx.destination)

        setState((s) => ({ ...s, isListening: true }))
      } catch (err) {
        console.error('Mic capture error:', err)
        setState((s) => ({
          ...s,
          error: `Microphone error: ${err instanceof Error ? err.message : 'unknown'}`,
        }))
      }
    },
    [],
  )

  // ── Build system instruction for coaching ──
  const buildSystemInstruction = useCallback(() => {
    const cfg = configRef.current
    let instruction = cfg.systemInstruction

    // Add coaching conversation context
    instruction += `\n\nYou are now in a 1:1 voice conversation with the user. This is a live, real-time voice session — not text chat.

VOICE SESSION RULES:
- Keep responses conversational and concise (1-3 sentences typically, up to 5 for important insights)
- You're speaking out loud, so avoid lists, bullet points, or anything that reads like text
- React naturally — "hmm", "interesting", "wait, say that again" are all great
- If the user interrupts you, STOP and listen. Their interrupt is a signal — address what prompted it.
- Build on what you hear. Don't repeat yourself. This is a conversation, not a presentation.
- Ask follow-up questions. Go deeper on things that seem emotionally loaded.
- You ARE ${cfg.coachName}. Stay in character. Your personality comes through in HOW you speak.`

    if (cfg.conversationContext) {
      instruction += `\n\nPRIOR CONVERSATION CONTEXT (from the panel discussion):\n${cfg.conversationContext}`
    }

    if (cfg.characterSheet) {
      instruction += `\n\nUSER'S CHARACTER SHEET (career analysis):\n${JSON.stringify(cfg.characterSheet, null, 2)}`
    }

    return instruction
  }, [])

  // ── Connect ──
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    if (wsRef.current?.readyState === WebSocket.CONNECTING) return
    if (connectingRef.current) return
    connectingRef.current = true

    const cfg = configRef.current
    if (!cfg.apiKey) {
      connectingRef.current = false
      return
    }

    setState((s) => ({ ...s, error: null, fullTranscript: [], userTurns: [], turnCount: 0 }))
    currentTurnTextRef.current = ''

    const url = `${WS_URL}?key=${cfg.apiKey}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      const setup = {
        setup: {
          model: 'models/gemini-2.0-flash-live-001',
          generation_config: {
            response_modalities: ['AUDIO'],
            speech_config: {
              voice_config: {
                prebuilt_voice_config: {
                  voice_name: cfg.voiceName || 'Kore',
                },
              },
            },
          },
          system_instruction: {
            parts: [{ text: buildSystemInstruction() }],
          },
        },
      }
      ws.send(JSON.stringify(setup))
    }

    ws.onmessage = (event) => {
      handleMessage(event)

      // Start mic on setup complete
      try {
        const msg = JSON.parse(event.data)
        if (msg.setupComplete) {
          startMicCapture(ws)
        }
      } catch {
        // handled in handleMessage
      }
    }

    ws.onerror = () => {
      connectingRef.current = false
      if (!unmountedRef.current) {
        setState((s) => ({ ...s, error: 'WebSocket connection error', isConnected: false }))
      }
    }

    ws.onclose = (e) => {
      connectingRef.current = false
      wsRef.current = null
      if (!unmountedRef.current) {
        setState((s) => ({
          ...s,
          isConnected: false,
          isListening: false,
          error: e.code !== 1000 ? `Connection closed: ${e.reason || e.code}` : null,
        }))
      }
    }
  }, [handleMessage, startMicCapture, buildSystemInstruction])

  // ── Disconnect ──
  const disconnect = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect()
      sourceNodeRef.current = null
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
    }
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close()
      audioContextRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close(1000)
      wsRef.current = null
    }
    playbackQueueRef.current = []
    nextPlayTimeRef.current = 0
    isPlayingRef.current = false
    currentTurnTextRef.current = ''

    setState((s) => ({
      ...s,
      isConnected: false,
      isListening: false,
      isSpeaking: false,
      transcript: '',
      // Keep fullTranscript and userTurns — they're the session output
    }))
  }, [])

  // ── Send text (fallback / typed input during voice session) ──
  const sendText = useCallback((text: string) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    setState((s) => ({
      ...s,
      userTurns: [...s.userTurns, text],
    }))

    ws.send(
      JSON.stringify({
        client_content: {
          turns: [{ role: 'user', parts: [{ text }] }],
          turn_complete: true,
        },
      }),
    )
  }, [])

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      unmountedRef.current = true
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    ...state,
    connect,
    disconnect,
    sendText,
  }
}
