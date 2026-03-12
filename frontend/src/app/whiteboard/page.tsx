'use client'

import { useEffect, useCallback, useRef, useState } from 'react'
import { DrawCanvas } from '@/components/draw-canvas'
import { useCanvasStore } from '@/stores/canvas-store'
import { useGeminiLive } from '@/hooks/use-gemini-live'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export default function WhiteboardPage() {
  const {
    strokes,
    aiShapes,
    addAIShapes,
    setAIThinking,
    setAIDrawing,
    setAIStatus,
    clearCanvas,
    voice,
  } = useCanvasStore()

  const canvasRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'voice' | 'vision'>('vision')
  const [textInput, setTextInput] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [backendStatus, setBackendStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting')

  // Fetch API key from backend on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/live/config`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.api_key) {
          setApiKey(data.api_key)
          setBackendStatus('connected')
        } else {
          setBackendStatus('offline')
        }
      })
      .catch(() => {
        setBackendStatus('offline')
      })
  }, [])

  // Get SVG element reference for screenshot capture
  const getCanvasSvg = useCallback(() => {
    return document.querySelector('.draw-canvas svg') as SVGSVGElement | null
  }, [])

  // ── Gemini Live voice connection ──
  const geminiLive = useGeminiLive({
    apiKey,
    voiceName: 'Kore',
    canvasSvg: getCanvasSvg,
  })

  // ── Vision-only mode: canvas screenshot → Gemini Vision API ──
  const sendCanvasToAI = useCallback(async () => {
    const svg = document.querySelector('.draw-canvas svg') as SVGSVGElement | null
    if (!svg) return

    setAIThinking(true)
    setAIStatus('Analyzing your drawing...')

    try {
      const serializer = new XMLSerializer()
      const svgStr = serializer.serializeToString(svg)
      const blob = new Blob([svgStr], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)

      const img = new Image()
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = reject
        img.src = url
      })

      const canvas = document.createElement('canvas')
      canvas.width = svg.clientWidth
      canvas.height = svg.clientHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.fillStyle = '#0D1117'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0)
      URL.revokeObjectURL(url)

      const base64 = canvas.toDataURL('image/png').split(',')[1]

      const res = await fetch(`${API_BASE}/api/whiteboard/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: base64,
          canvas_width: canvas.width,
          canvas_height: canvas.height,
          context: 'career_coaching',
          existing_shapes: aiShapes.length,
        }),
      })

      if (!res.ok) throw new Error(`API error: ${res.status}`)

      const data = await res.json()

      if (data.shapes && data.shapes.length > 0) {
        setAIDrawing(true)
        setAIStatus('Drawing response...')

        for (let i = 0; i < data.shapes.length; i++) {
          await new Promise((r) => setTimeout(r, 300))
          addAIShapes([data.shapes[i]])
        }

        setAIDrawing(false)
      }
    } catch (err) {
      console.error('Canvas analysis error:', err)
    } finally {
      setAIThinking(false)
      setAIStatus('')
    }
  }, [aiShapes.length, addAIShapes, setAIThinking, setAIDrawing, setAIStatus])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ctrl+Z undo
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault()
        useCanvasStore.getState().undoStroke()
      }
      // Tool shortcuts (only when not typing in text input)
      if (!e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement)) {
        if (e.key === 'p') useCanvasStore.getState().setTool('pen')
        if (e.key === 'e') useCanvasStore.getState().setTool('eraser')
        if (e.key === 'a') useCanvasStore.getState().setTool('arrow')
        // Enter: send to AI (vision mode)
        if (e.key === 'Enter' && mode === 'vision') {
          e.preventDefault()
          sendCanvasToAI()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sendCanvasToAI, mode])

  // ── Handle text input submit ──
  const handleTextSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (!textInput.trim()) return

      if (mode === 'voice' && geminiLive.isConnected) {
        geminiLive.sendText(textInput.trim())
      }
      setTextInput('')
    },
    [textInput, mode, geminiLive],
  )

  const isVoiceAvailable = !!apiKey
  const isBackendReady = backendStatus === 'connected'

  return (
    <div className="h-screen flex flex-col bg-[#0D1117]">
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: '#21262D', backgroundColor: '#161B22' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-sm"
            style={{ backgroundColor: '#7EE787', color: '#0D1117' }}
          >
            DT
          </div>
          <h1 className="text-sm font-semibold text-[#E6EDF3]">DrawTogether</h1>
          <span className="text-[10px] font-mono text-[#8B949E] ml-1">
            AI Collaborative Whiteboard
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div
            className="flex items-center rounded-lg overflow-hidden text-[10px] font-mono"
            style={{ border: '1px solid rgba(201,209,217,0.1)' }}
          >
            <button
              onClick={() => {
                setMode('vision')
                if (geminiLive.isConnected) geminiLive.disconnect()
              }}
              className="px-3 py-1.5 transition-all"
              style={{
                backgroundColor: mode === 'vision' ? 'rgba(88,166,255,0.15)' : 'transparent',
                color: mode === 'vision' ? '#58A6FF' : '#8B949E',
              }}
            >
              Vision Only
            </button>
            <button
              onClick={() => setMode('voice')}
              className="px-3 py-1.5 transition-all"
              style={{
                backgroundColor: mode === 'voice' ? 'rgba(126,231,135,0.15)' : 'transparent',
                color: mode === 'voice' ? '#7EE787' : '#8B949E',
                opacity: isVoiceAvailable ? 1 : 0.4,
              }}
              disabled={!isVoiceAvailable}
              title={isVoiceAvailable ? 'Voice + Vision mode' : 'Set NEXT_PUBLIC_GEMINI_API_KEY to enable'}
            >
              Voice + Vision
            </button>
          </div>

          {/* Action buttons */}
          {mode === 'voice' ? (
            geminiLive.isConnected ? (
              <button
                onClick={geminiLive.disconnect}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
                style={{
                  backgroundColor: 'rgba(255,123,114,0.1)',
                  border: '1px solid rgba(255,123,114,0.3)',
                  color: '#FF7B72',
                }}
              >
                <div className="w-2 h-2 rounded-full bg-[#FF7B72] animate-pulse" />
                Disconnect
              </button>
            ) : (
              <button
                onClick={geminiLive.connect}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all hover:scale-105"
                style={{
                  backgroundColor: 'rgba(126,231,135,0.1)',
                  border: '1px solid rgba(126,231,135,0.3)',
                  color: '#7EE787',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2z" />
                </svg>
                Start Voice Session
              </button>
            )
          ) : (
            <button
              onClick={sendCanvasToAI}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all hover:scale-105"
              style={{
                backgroundColor: 'rgba(126,231,135,0.1)',
                border: '1px solid rgba(126,231,135,0.3)',
                color: '#7EE787',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
              Ask AI (Enter)
            </button>
          )}

          <button
            onClick={clearCanvas}
            className="px-3 py-1.5 rounded-lg text-xs font-mono text-[#8B949E] hover:text-[#FF7B72] transition-all"
            style={{ border: '1px solid rgba(201,209,217,0.1)' }}
          >
            Reset
          </button>

          {backendStatus === 'offline' && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono text-[#FF7B72]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#FF7B72]" />
              Backend Offline
            </div>
          )}
          <a
            href="/"
            className="text-xs text-[#8B949E] hover:text-[#C9D1D9] transition-colors"
          >
            Back
          </a>
        </div>
      </header>

      {/* Canvas */}
      <div ref={canvasRef} className="flex-1 relative">
        <DrawCanvas />

        {/* Voice status overlay */}
        {mode === 'voice' && geminiLive.isConnected && (
          <div className="absolute top-3 right-3 z-30 flex flex-col gap-2">
            {/* Connection status */}
            <div
              className="px-3 py-1.5 rounded-lg text-[10px] font-mono flex items-center gap-2"
              style={{
                backgroundColor: 'rgba(13,17,23,0.9)',
                border: '1px solid rgba(126,231,135,0.2)',
                color: '#7EE787',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#7EE787]" />
              Voice Connected
            </div>

            {/* Listening indicator */}
            {geminiLive.isListening && (
              <div
                className="px-3 py-1.5 rounded-lg text-[10px] font-mono flex items-center gap-2"
                style={{
                  backgroundColor: 'rgba(13,17,23,0.9)',
                  border: '1px solid rgba(255,123,114,0.2)',
                  color: '#FF7B72',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#FF7B72] animate-pulse" />
                Mic Active
              </div>
            )}

            {/* Speaking indicator */}
            {geminiLive.isSpeaking && (
              <div
                className="px-3 py-1.5 rounded-lg text-[10px] font-mono flex items-center gap-2"
                style={{
                  backgroundColor: 'rgba(13,17,23,0.9)',
                  border: '1px solid rgba(188,140,255,0.2)',
                  color: '#BC8CFF',
                  backdropFilter: 'blur(8px)',
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-[#BC8CFF] animate-pulse" />
                AI Speaking
              </div>
            )}
          </div>
        )}

        {/* Error display */}
        {geminiLive.error && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-lg text-xs font-mono"
            style={{
              backgroundColor: 'rgba(255,123,114,0.1)',
              border: '1px solid rgba(255,123,114,0.3)',
              color: '#FF7B72',
              backdropFilter: 'blur(8px)',
            }}
          >
            {geminiLive.error}
          </div>
        )}

        {/* AI transcript subtitle */}
        {geminiLive.aiTranscript && (
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 max-w-xl px-4 py-2 rounded-lg text-sm"
            style={{
              backgroundColor: 'rgba(13,17,23,0.9)',
              border: '1px solid rgba(188,140,255,0.2)',
              color: '#BC8CFF',
              backdropFilter: 'blur(8px)',
            }}
          >
            {geminiLive.aiTranscript}
          </div>
        )}
      </div>

      {/* Bottom bar — text input for voice mode fallback, instructions for vision mode */}
      <div
        className="px-4 py-2 border-t flex items-center gap-4"
        style={{ borderColor: '#21262D', backgroundColor: '#161B22' }}
      >
        {mode === 'voice' && geminiLive.isConnected ? (
          <form onSubmit={handleTextSubmit} className="flex-1 flex items-center gap-3">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type a message (or just talk)..."
              className="flex-1 bg-transparent border rounded-lg px-3 py-1.5 text-xs font-mono text-[#C9D1D9] placeholder-[#484F58] focus:outline-none focus:border-[#58A6FF]"
              style={{ borderColor: '#21262D' }}
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg text-xs font-mono text-[#58A6FF] hover:bg-[rgba(88,166,255,0.1)] transition-all"
              style={{ border: '1px solid rgba(88,166,255,0.2)' }}
            >
              Send
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-6 text-[10px] font-mono text-[#8B949E]">
            <span>Draw with mouse/pen</span>
            <span>P = Pen | E = Eraser | A = Arrow</span>
            {mode === 'vision' && <span>Enter = Ask AI</span>}
            <span>Ctrl+Z = Undo</span>
          </div>
        )}
      </div>
    </div>
  )
}
