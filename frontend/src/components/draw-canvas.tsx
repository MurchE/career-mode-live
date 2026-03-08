'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getStroke } from 'perfect-freehand'
import { useCanvasStore } from '@/stores/canvas-store'
import type { Point, Stroke } from '@/stores/canvas-store'
import { AIDrawingLayer } from './ai-drawing-layer'
import { DrawingToolbar } from './drawing-toolbar'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert perfect-freehand outline points to an SVG path string */
function getSvgPathFromStroke(strokePoints: number[][]): string {
  if (strokePoints.length === 0) return ''

  const d: string[] = []
  const [first, ...rest] = strokePoints

  d.push(`M ${first[0].toFixed(2)} ${first[1].toFixed(2)}`)

  if (rest.length === 0) return d.join(' ')

  for (let i = 0; i < rest.length; i++) {
    const [x, y] = rest[i]
    if (i === 0) {
      d.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`)
    } else {
      const [px, py] = rest[i - 1]
      const mx = (px + x) / 2
      const my = (py + y) / 2
      d.push(`Q ${px.toFixed(2)} ${py.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`)
    }
  }

  d.push('Z')
  return d.join(' ')
}

/** Convert our Point[] to the format perfect-freehand expects */
function pointsToInput(points: Point[]): number[][] {
  return points.map((p) => [p.x, p.y, p.pressure ?? 0.5])
}

/** Get SVG path for a completed stroke */
function getStrokePath(points: Point[], size: number): string {
  const outline = getStroke(pointsToInput(points), {
    size,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: true,
  })
  return getSvgPathFromStroke(outline)
}

/** Generate a wobbly hand-drawn line path between two points */
function wobbleLine(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const wobble = Math.min(len * 0.03, 4)
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const cpx = mx + (Math.random() - 0.5) * wobble * 2
  const cpy = my + (Math.random() - 0.5) * wobble * 2
  return `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`
}

// ─── Stroke Renderer ─────────────────────────────────────────────────────────

function StrokeRenderer({
  stroke,
}: {
  stroke: Stroke
}) {
  const path = getStrokePath(stroke.points, stroke.size)
  const pathLen = stroke.points.length * stroke.size * 2 // rough estimate

  return (
    <path
      d={path}
      fill={stroke.color}
      fillOpacity={stroke.author === 'ai' ? 0.7 : 1}
      stroke="none"
      style={
        stroke.animated
          ? {
              opacity: 0,
              animation: 'draw-fade-in 0.6s ease-out forwards',
            }
          : undefined
      }
    />
  )
}

/** Render the current in-progress stroke (live preview) */
function CurrentStrokeRenderer({
  points,
  color,
  size,
}: {
  points: Point[]
  color: string
  size: number
}) {
  if (points.length < 2) return null
  const path = getStrokePath(points, size)

  return <path d={path} fill={color} stroke="none" opacity={0.8} />
}

// ─── AI Cursor ───────────────────────────────────────────────────────────────

function AICursor({ x, y, visible }: { x: number; y: number; visible: boolean }) {
  if (!visible) return null

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ transition: 'transform 200ms ease-out' }}
    >
      {/* Pen tip */}
      <circle r="4" fill="#7EE787" opacity={0.8} />
      <circle r="8" fill="none" stroke="#7EE787" strokeWidth="1" opacity={0.4}>
        <animate
          attributeName="r"
          values="8;14;8"
          dur="2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="opacity"
          values="0.4;0.1;0.4"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      {/* Label */}
      <text
        x="12"
        y="-8"
        fill="#7EE787"
        fontSize="10"
        fontFamily="monospace"
        opacity={0.6}
      >
        AI
      </text>
    </g>
  )
}

// ─── Grid Background ─────────────────────────────────────────────────────────

function GridPattern() {
  return (
    <defs>
      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
        <path
          d="M 40 0 L 0 0 0 40"
          fill="none"
          stroke="#21262D"
          strokeWidth="0.5"
        />
      </pattern>
      <pattern id="grid-major" width="200" height="200" patternUnits="userSpaceOnUse">
        <path
          d="M 200 0 L 0 0 0 200"
          fill="none"
          stroke="#21262D"
          strokeWidth="1"
        />
      </pattern>
    </defs>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DrawCanvas() {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [aiCursorPos, setAICursorPos] = useState({ x: 0, y: 0 })

  const {
    strokes,
    currentStroke,
    tool,
    penColor,
    penSize,
    aiShapes,
    isAIDrawing,
    isAIThinking,
    aiStatus,
    voice,
    startStroke,
    addPoint,
    endStroke,
    setCanvasSize,
  } = useCanvasStore()

  // Track container size
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setCanvasSize(entry.contentRect.width, entry.contentRect.height)
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [setCanvasSize])

  // Get pointer position relative to SVG
  const getPointerPos = useCallback(
    (e: React.PointerEvent): Point => {
      const svg = svgRef.current
      if (!svg) return { x: 0, y: 0 }
      const rect = svg.getBoundingClientRect()
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        pressure: e.pressure,
      }
    },
    [],
  )

  // Pointer handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (tool === 'select' || tool === 'text') return
      e.currentTarget.setPointerCapture(e.pointerId)
      setIsDrawing(true)
      startStroke(getPointerPos(e))
    },
    [tool, startStroke, getPointerPos],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing) return
      addPoint(getPointerPos(e))
    },
    [isDrawing, addPoint, getPointerPos],
  )

  const handlePointerUp = useCallback(() => {
    if (!isDrawing) return
    setIsDrawing(false)
    endStroke()
  }, [isDrawing, endStroke])

  // Cursor style
  const cursorStyle =
    tool === 'pen'
      ? 'crosshair'
      : tool === 'eraser'
        ? 'cell'
        : tool === 'arrow'
          ? 'crosshair'
          : 'default'

  return (
    <div className="draw-canvas relative flex flex-col h-full bg-[#0D1117]">
      {/* Inline animations */}
      <style>{`
        @keyframes draw-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes ai-shape-draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes ai-thinking-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        @keyframes ai-cursor-draw {
          0% { r: 4; opacity: 0.8; }
          50% { r: 6; opacity: 1; }
          100% { r: 4; opacity: 0.8; }
        }
      `}</style>

      {/* Toolbar */}
      <DrawingToolbar />

      {/* Status bar */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3">
        {isAIThinking && (
          <div
            className="px-3 py-1 rounded-full text-xs font-mono flex items-center gap-2"
            style={{
              backgroundColor: 'rgba(126,231,135,0.1)',
              border: '1px solid rgba(126,231,135,0.2)',
              color: '#7EE787',
              animation: 'ai-thinking-pulse 1.5s ease-in-out infinite',
            }}
          >
            <div className="w-2 h-2 rounded-full bg-[#7EE787]" />
            {aiStatus || 'AI is thinking...'}
          </div>
        )}
        {isAIDrawing && (
          <div
            className="px-3 py-1 rounded-full text-xs font-mono flex items-center gap-2"
            style={{
              backgroundColor: 'rgba(88,166,255,0.1)',
              border: '1px solid rgba(88,166,255,0.2)',
              color: '#58A6FF',
            }}
          >
            <div className="w-2 h-2 rounded-full bg-[#58A6FF] animate-pulse" />
            AI is drawing...
          </div>
        )}
        {voice.isListening && (
          <div
            className="px-3 py-1 rounded-full text-xs font-mono flex items-center gap-2"
            style={{
              backgroundColor: 'rgba(255,123,114,0.1)',
              border: '1px solid rgba(255,123,114,0.2)',
              color: '#FF7B72',
            }}
          >
            <div className="w-2 h-2 rounded-full bg-[#FF7B72] animate-pulse" />
            Listening...
          </div>
        )}
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-hidden relative">
        <svg
          ref={svgRef}
          className="w-full h-full touch-none"
          style={{ cursor: cursorStyle }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Background grid */}
          <GridPattern />
          <rect width="100%" height="100%" fill="url(#grid)" />
          <rect width="100%" height="100%" fill="url(#grid-major)" />

          {/* Completed strokes */}
          {strokes.map((stroke) => (
            <StrokeRenderer key={stroke.id} stroke={stroke} />
          ))}

          {/* Current in-progress stroke */}
          {currentStroke && currentStroke.length > 1 && (
            <CurrentStrokeRenderer
              points={currentStroke}
              color={tool === 'eraser' ? '#0D1117' : penColor}
              size={tool === 'eraser' ? penSize * 4 : penSize}
            />
          )}

          {/* AI drawing layer */}
          <AIDrawingLayer shapes={aiShapes} />

          {/* AI cursor */}
          <AICursor
            x={aiCursorPos.x}
            y={aiCursorPos.y}
            visible={isAIDrawing}
          />
        </svg>
      </div>

      {/* Voice transcript overlay */}
      {voice.transcript && (
        <div
          className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 max-w-lg px-4 py-2 rounded-lg text-sm"
          style={{
            backgroundColor: 'rgba(13,17,23,0.9)',
            border: '1px solid rgba(201,209,217,0.15)',
            color: '#C9D1D9',
            backdropFilter: 'blur(8px)',
          }}
        >
          {voice.transcript}
        </div>
      )}
    </div>
  )
}
