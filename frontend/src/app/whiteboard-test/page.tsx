'use client'

import { useEffect, useRef, useCallback } from 'react'
import { DrawCanvas } from '@/components/draw-canvas'
import { useCanvasStore } from '@/stores/canvas-store'
import type { AIShape } from '@/stores/canvas-store'

// Mock AI responses — simulate what Gemini would return
const MOCK_AI_RESPONSES: Omit<AIShape, 'id' | 'timestamp' | 'animated'>[][] = [
  // Response 1: Initial greeting annotations
  [
    { type: 'text', x: 60, y: 40, content: 'Welcome! Draw anything.', color: '#7EE787', fontSize: 18 },
    { type: 'text', x: 60, y: 65, content: "I'll annotate as you go.", color: '#8B949E', fontSize: 13 },
  ],
  // Response 2: Career-related annotations
  [
    { type: 'circle', x: 300, y: 200, radius: 45, color: '#58A6FF', label: 'Core Skill' },
    { type: 'arrow', x: 300, y: 245, toX: 500, toY: 350, color: '#7EE787', label: 'leads to' },
    { type: 'rect', x: 450, y: 320, width: 160, height: 60, color: '#BC8CFF', label: 'Impact Area' },
    { type: 'text', x: 470, y: 345, content: '$12M saved', color: '#F0883E', fontSize: 16 },
    { type: 'text', x: 470, y: 368, content: 'fraud detection', color: '#BC8CFF', fontSize: 12 },
  ],
  // Response 3: Pattern detection
  [
    { type: 'highlight', x: 100, y: 150, width: 250, height: 180, color: '#58A6FF' },
    { type: 'text', x: 120, y: 140, content: 'PATTERN: Builder instinct', color: '#58A6FF', fontSize: 14 },
    { type: 'arrow', x: 200, y: 330, toX: 200, toY: 420, color: '#FF7B72', label: 'drives' },
    { type: 'circle', x: 200, y: 460, radius: 35, color: '#FF7B72', label: 'Anger at waste' },
    { type: 'arrow', x: 235, y: 460, toX: 400, toY: 460, color: '#7EE787' },
    { type: 'text', x: 420, y: 455, content: 'Superpower', color: '#7EE787', fontSize: 16 },
  ],
  // Response 4: Summary
  [
    { type: 'rect', x: 600, y: 80, width: 280, height: 120, color: '#F0883E', fill: '#F0883E', label: 'YOUR THROUGHLINE' },
    { type: 'text', x: 620, y: 110, content: 'You rescue orgs from', color: '#E6EDF3', fontSize: 14 },
    { type: 'text', x: 620, y: 130, content: 'their own inertia.', color: '#E6EDF3', fontSize: 14 },
    { type: 'text', x: 620, y: 158, content: 'Nobody asks you to build it.', color: '#8B949E', fontSize: 12 },
    { type: 'text', x: 620, y: 175, content: 'Everyone ends up needing it.', color: '#7EE787', fontSize: 12 },
  ],
]

export default function WhiteboardTestPage() {
  const {
    addAIShapes,
    setAIThinking,
    setAIDrawing,
    setAIStatus,
    clearCanvas,
    clearAIShapes,
  } = useCanvasStore()

  const responseIndexRef = useRef(0)

  // Simulate AI response with staggered shapes
  const simulateAIResponse = useCallback(async () => {
    const idx = responseIndexRef.current % MOCK_AI_RESPONSES.length
    const shapes = MOCK_AI_RESPONSES[idx]
    responseIndexRef.current++

    setAIThinking(true)
    setAIStatus('Analyzing your drawing...')

    // Simulate thinking delay
    await new Promise((r) => setTimeout(r, 1200))

    setAIThinking(false)
    setAIDrawing(true)
    setAIStatus('Drawing response...')

    // Stagger each shape
    for (const shape of shapes) {
      addAIShapes([shape])
      await new Promise((r) => setTimeout(r, 400))
    }

    setAIDrawing(false)
    setAIStatus('')
  }, [addAIShapes, setAIThinking, setAIDrawing, setAIStatus])

  // Override Enter key to use mock response
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        simulateAIResponse()
      }
      // Ctrl+Z undo
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault()
        useCanvasStore.getState().undoStroke()
      }
      // Tool shortcuts
      if (!e.ctrlKey && !e.metaKey) {
        if (e.key === 'p') useCanvasStore.getState().setTool('pen')
        if (e.key === 'e') useCanvasStore.getState().setTool('eraser')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [simulateAIResponse])

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
          <h1 className="text-sm font-semibold text-[#E6EDF3]">
            DrawTogether
          </h1>
          <span className="text-[10px] font-mono text-[#F0883E] ml-1">
            TEST MODE — No API calls
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={simulateAIResponse}
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
            AI Respond (Enter)
          </button>

          <button
            onClick={() => { clearCanvas(); clearAIShapes() }}
            className="px-3 py-1.5 rounded-lg text-xs font-mono text-[#8B949E] hover:text-[#FF7B72] transition-all"
            style={{
              border: '1px solid rgba(201,209,217,0.1)',
            }}
          >
            Reset All
          </button>

          <a
            href="/test"
            className="text-xs text-[#8B949E] hover:text-[#C9D1D9] transition-colors"
          >
            Back to Test
          </a>
        </div>
      </header>

      {/* Canvas */}
      <div className="flex-1">
        <DrawCanvas />
      </div>

      {/* Instructions */}
      <div
        className="px-4 py-2 border-t flex items-center gap-6 text-[10px] font-mono"
        style={{ borderColor: '#21262D', color: '#8B949E' }}
      >
        <span>Draw with mouse/pen</span>
        <span>P = Pen | E = Eraser</span>
        <span>Enter = Ask AI</span>
        <span>Ctrl+Z = Undo</span>
        <span className="ml-auto text-[#F0883E]">Mock AI — press Enter multiple times for different responses</span>
      </div>
    </div>
  )
}
