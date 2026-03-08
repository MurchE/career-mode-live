'use client'

/**
 * useGeminiLive — Real-time bidirectional voice + canvas vision via Gemini Live API.
 *
 * Opens a persistent WebSocket to Gemini's BidiGenerateContent endpoint.
 * Streams mic audio upstream, receives AI audio downstream, and periodically
 * sends canvas screenshots for visual understanding.
 *
 * Audio: mic 16kHz PCM → Gemini → 24kHz PCM playback
 * Vision: canvas JPEG snapshots at ~1fps
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useCanvasStore } from '@/stores/canvas-store'

// ─── Types ────────────────────────────────────────────────────────────────────

interface GeminiLiveConfig {
  apiKey: string
  voiceName?: string
  systemInstruction?: string
  canvasSvg?: () => SVGSVGElement | null
}

interface GeminiLiveState {
  isConnected: boolean
  isListening: boolean
  isSpeaking: boolean
  transcript: string
  aiTranscript: string
  error: string | null
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
  toolCall?: unknown
}

// ─── Audio Helpers ────────────────────────────────────────────────────────────

/** Convert Float32Array (Web Audio) to Int16 PCM ArrayBuffer */
function float32ToInt16(float32: Float32Array): ArrayBuffer {
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return int16.buffer
}

/** Downsample from source sample rate to 16kHz */
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

/** ArrayBuffer → base64 string */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/** Base64 string → ArrayBuffer */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

/** Convert Int16 PCM at 24kHz to Float32 for AudioContext playback */
function int16ToFloat32(int16Buffer: ArrayBuffer): Float32Array {
  const int16 = new Int16Array(int16Buffer)
  const float32 = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000
  }
  return float32
}

// ─── Canvas Screenshot Helper ─────────────────────────────────────────────────

async function captureCanvasAsJpeg(svgEl: SVGSVGElement): Promise<string | null> {
  try {
    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svgEl)
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = url
    })

    const canvas = document.createElement('canvas')
    // Downscale for bandwidth — 640px wide is plenty for Gemini vision
    const scale = Math.min(1, 640 / svgEl.clientWidth)
    canvas.width = Math.round(svgEl.clientWidth * scale)
    canvas.height = Math.round(svgEl.clientHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    ctx.fillStyle = '#0D1117'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)

    // Return base64 JPEG (no data: prefix)
    return canvas.toDataURL('image/jpeg', 0.7).split(',')[1]
  } catch {
    return null
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const WS_URL = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent'

const WHITEBOARD_SYSTEM_INSTRUCTION = `You are an AI drawing collaborator on a shared whiteboard. You and the user are drawing together and talking via voice.

Your role:
1. CONVERSE naturally — respond to what the user says, ask questions, offer insights.
2. When you notice something interesting in their drawing, mention it vocally.
3. Be warm, curious, and encouraging. Think of yourself as a creative partner, not an assistant.
4. Keep responses concise — 1-3 sentences. This is a live conversation, not a lecture.
5. If the context is career coaching, help them see patterns in their experience, hidden skills, and their authentic story.
6. Reference specific things you see in their drawing when relevant.

You can see the whiteboard via periodic screenshots. The user is drawing in real-time.`

export function useGeminiLive(config: GeminiLiveConfig) {
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const playbackQueueRef = useRef<Float32Array[]>([])
  const isPlayingRef = useRef(false)
  const screenshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { addAIShapes, setAIThinking, setAIDrawing, setAIStatus, setVoice } = useCanvasStore()

  const [state, setState] = useState<GeminiLiveState>({
    isConnected: false,
    isListening: false,
    isSpeaking: false,
    transcript: '',
    aiTranscript: '',
    error: null,
  })

  // ── Playback queue processor ──
  const processPlaybackQueue = useCallback(async () => {
    if (isPlayingRef.current || playbackQueueRef.current.length === 0) return
    isPlayingRef.current = true

    const ctx = audioContextRef.current
    if (!ctx) {
      isPlayingRef.current = false
      return
    }

    while (playbackQueueRef.current.length > 0) {
      const samples = playbackQueueRef.current.shift()!
      const buffer = ctx.createBuffer(1, samples.length, 24000)
      buffer.getChannelData(0).set(samples)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start()

      setState((s) => ({ ...s, isSpeaking: true }))
      setVoice({ isSpeaking: true })

      await new Promise<void>((resolve) => {
        source.onended = () => resolve()
      })
    }

    setState((s) => ({ ...s, isSpeaking: false }))
    setVoice({ isSpeaking: false })
    isPlayingRef.current = false
  }, [setVoice])

  // ── Handle incoming WebSocket messages ──
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data)

        // Setup complete
        if (msg.setupComplete) {
          setState((s) => ({ ...s, isConnected: true, error: null }))
          setVoice({ isConnected: true })
          return
        }

        // Model response
        if (msg.serverContent?.modelTurn?.parts) {
          for (const part of msg.serverContent.modelTurn.parts) {
            // Audio response
            if (part.inlineData?.data) {
              const pcmBuffer = base64ToArrayBuffer(part.inlineData.data)
              const float32 = int16ToFloat32(pcmBuffer)
              playbackQueueRef.current.push(float32)
              processPlaybackQueue()
            }

            // Text response (transcript)
            if (part.text) {
              setState((s) => ({
                ...s,
                aiTranscript: s.aiTranscript + part.text,
              }))
              setVoice({ transcript: part.text })

              // Check for drawing commands in text (JSON blocks)
              try {
                const jsonMatch = part.text.match(/```json\n?([\s\S]*?)\n?```/)
                if (jsonMatch) {
                  const commands = JSON.parse(jsonMatch[1])
                  if (commands.shapes && Array.isArray(commands.shapes)) {
                    setAIThinking(false)
                    setAIDrawing(true)
                    setAIStatus('Drawing...')
                    addAIShapes(commands.shapes)
                    setTimeout(() => {
                      setAIDrawing(false)
                      setAIStatus('')
                    }, 1000)
                  }
                }
              } catch {
                // Not a JSON drawing command — that's fine
              }
            }
          }
        }

        // Turn complete — clear transcript for next turn
        if (msg.serverContent?.turnComplete) {
          setTimeout(() => {
            setState((s) => ({ ...s, aiTranscript: '' }))
            setVoice({ transcript: '' })
          }, 3000)
        }
      } catch (err) {
        console.error('Gemini Live message parse error:', err)
      }
    },
    [addAIShapes, setAIThinking, setAIDrawing, setAIStatus, setVoice, processPlaybackQueue],
  )

  // ── Start mic capture using ScriptProcessorNode (broader browser support) ──
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

        // Use ScriptProcessorNode for broader compatibility
        const processor = ctx.createScriptProcessor(4096, 1, 1)
        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return

          const inputData = e.inputBuffer.getChannelData(0)
          // Downsample to 16kHz
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

        source.connect(processor)
        processor.connect(ctx.destination) // Required for ScriptProcessor to work

        setState((s) => ({ ...s, isListening: true }))
        setVoice({ isListening: true })
      } catch (err) {
        console.error('Mic capture error:', err)
        setState((s) => ({
          ...s,
          error: `Microphone error: ${err instanceof Error ? err.message : 'unknown'}`,
        }))
      }
    },
    [setVoice],
  )

  // ── Send canvas screenshot ──
  const sendCanvasScreenshot = useCallback(() => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    const svgEl = config.canvasSvg?.()
    if (!svgEl) return

    captureCanvasAsJpeg(svgEl).then((b64) => {
      if (!b64 || !ws || ws.readyState !== WebSocket.OPEN) return
      ws.send(
        JSON.stringify({
          realtime_input: {
            media_chunks: [
              {
                mime_type: 'image/jpeg',
                data: b64,
              },
            ],
          },
        }),
      )
    })
  }, [config])

  // ── Connect ──
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setState((s) => ({ ...s, error: null }))

    const url = `${WS_URL}?key=${config.apiKey}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      // Send setup message
      const setup: Record<string, unknown> = {
        setup: {
          model: 'models/gemini-2.0-flash-live-001',
          generation_config: {
            response_modalities: ['AUDIO'],
            speech_config: {
              voice_config: {
                prebuilt_voice_config: {
                  voice_name: config.voiceName || 'Kore',
                },
              },
            },
          },
          system_instruction: {
            parts: [
              {
                text: config.systemInstruction || WHITEBOARD_SYSTEM_INSTRUCTION,
              },
            ],
          },
        },
      }
      ws.send(JSON.stringify(setup))
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.setupComplete) {
        // Setup done — start mic and screenshot loop
        handleMessage(event)
        startMicCapture(ws)

        // Send canvas screenshots every 2 seconds
        screenshotIntervalRef.current = setInterval(() => {
          sendCanvasScreenshot()
        }, 2000)
      } else {
        handleMessage(event)
      }
    }

    ws.onerror = () => {
      setState((s) => ({ ...s, error: 'WebSocket connection error', isConnected: false }))
      setVoice({ isConnected: false })
    }

    ws.onclose = (e) => {
      setState((s) => ({
        ...s,
        isConnected: false,
        isListening: false,
        error: e.code !== 1000 ? `Connection closed: ${e.reason || e.code}` : null,
      }))
      setVoice({ isConnected: false, isListening: false })

      // Clean up screenshot interval
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current)
        screenshotIntervalRef.current = null
      }
    }
  }, [config, handleMessage, startMicCapture, sendCanvasScreenshot, setVoice])

  // ── Disconnect ──
  const disconnect = useCallback(() => {
    // Stop mic
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop())
      micStreamRef.current = null
    }

    // Stop screenshot interval
    if (screenshotIntervalRef.current) {
      clearInterval(screenshotIntervalRef.current)
      screenshotIntervalRef.current = null
    }

    // Close audio context
    if (audioContextRef.current?.state !== 'closed') {
      audioContextRef.current?.close()
      audioContextRef.current = null
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close(1000)
      wsRef.current = null
    }

    // Clear playback queue
    playbackQueueRef.current = []
    isPlayingRef.current = false

    setState({
      isConnected: false,
      isListening: false,
      isSpeaking: false,
      transcript: '',
      aiTranscript: '',
      error: null,
    })
    setVoice({ isConnected: false, isListening: false, isSpeaking: false, transcript: '' })
  }, [setVoice])

  // ── Send text message (fallback when no mic) ──
  const sendText = useCallback((text: string) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return

    ws.send(
      JSON.stringify({
        client_content: {
          turns: [
            {
              role: 'user',
              parts: [{ text }],
            },
          ],
          turn_complete: true,
        },
      }),
    )
  }, [])

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    ...state,
    connect,
    disconnect,
    sendText,
    sendCanvasScreenshot,
  }
}
