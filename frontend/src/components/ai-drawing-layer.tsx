'use client'

import { useMemo } from 'react'
import type { AIShape } from '@/stores/canvas-store'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Wobble factor for hand-drawn feel */
function wobble(seed: number, amplitude: number = 2): number {
  return Math.sin(seed * 7.31 + 2.17) * amplitude
}

/** Generate a hand-drawn circle path */
function sketchCircle(cx: number, cy: number, r: number, seed: number): string {
  const segments = 24
  const points: string[] = []

  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    const w = wobble(seed + i, r * 0.04)
    const px = cx + (r + w) * Math.cos(angle)
    const py = cy + (r + w) * Math.sin(angle)

    if (i === 0) {
      points.push(`M ${px.toFixed(1)} ${py.toFixed(1)}`)
    } else {
      const prevAngle = ((i - 1) / segments) * Math.PI * 2
      const prevW = wobble(seed + i - 1, r * 0.04)
      const prevPx = cx + (r + prevW) * Math.cos(prevAngle)
      const prevPy = cy + (r + prevW) * Math.sin(prevAngle)
      const cpx = (prevPx + px) / 2 + wobble(seed + i + 100, 2)
      const cpy = (prevPy + py) / 2 + wobble(seed + i + 200, 2)
      points.push(`Q ${cpx.toFixed(1)} ${cpy.toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)}`)
    }
  }

  return points.join(' ') + ' Z'
}

/** Generate a hand-drawn rectangle path */
function sketchRect(x: number, y: number, w: number, h: number, seed: number): string {
  const wb = 2
  return [
    `M ${x + wobble(seed, wb)} ${y + wobble(seed + 1, wb)}`,
    `Q ${x + w * 0.5} ${y + wobble(seed + 2, wb * 0.5)}, ${x + w + wobble(seed + 3, wb)} ${y + wobble(seed + 4, wb)}`,
    `Q ${x + w + wobble(seed + 5, wb * 0.5)} ${y + h * 0.5}, ${x + w + wobble(seed + 6, wb)} ${y + h + wobble(seed + 7, wb)}`,
    `Q ${x + w * 0.5} ${y + h + wobble(seed + 8, wb * 0.5)}, ${x + wobble(seed + 9, wb)} ${y + h + wobble(seed + 10, wb)}`,
    `Q ${x + wobble(seed + 11, wb * 0.5)} ${y + h * 0.5}, ${x + wobble(seed + 12, wb)} ${y + wobble(seed + 13, wb)}`,
    'Z',
  ].join(' ')
}

/** Generate a hand-drawn arrow path */
function sketchArrow(
  x1: number, y1: number, x2: number, y2: number, seed: number,
): { shaft: string; head: string } {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  const wb = Math.min(len * 0.02, 3)

  // Shaft: slightly wobbly line
  const mx = (x1 + x2) / 2 + wobble(seed, wb * 2)
  const my = (y1 + y2) / 2 + wobble(seed + 1, wb * 2)
  const shaft = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`

  // Arrowhead
  const angle = Math.atan2(dy, dx)
  const headLen = Math.min(len * 0.15, 16)
  const headAngle = 0.4
  const hx1 = x2 - headLen * Math.cos(angle - headAngle)
  const hy1 = y2 - headLen * Math.sin(angle - headAngle)
  const hx2 = x2 - headLen * Math.cos(angle + headAngle)
  const hy2 = y2 - headLen * Math.sin(angle + headAngle)
  const head = `M ${hx1} ${hy1} L ${x2} ${y2} L ${hx2} ${hy2}`

  return { shaft, head }
}

/** Generate a hand-drawn highlight (translucent rectangle) */
function sketchHighlight(x: number, y: number, w: number, h: number, seed: number): string {
  const wb = 3
  return [
    `M ${x - wb + wobble(seed, wb)} ${y + wobble(seed + 1, wb)}`,
    `L ${x + w + wobble(seed + 2, wb)} ${y + wobble(seed + 3, wb)}`,
    `L ${x + w + wobble(seed + 4, wb)} ${y + h + wobble(seed + 5, wb)}`,
    `L ${x + wobble(seed + 6, wb)} ${y + h + wobble(seed + 7, wb)}`,
    'Z',
  ].join(' ')
}

// ─── Shape Renderers ─────────────────────────────────────────────────────────

function AICircle({ shape }: { shape: AIShape }) {
  const r = shape.radius ?? 30
  const seed = shape.x + shape.y
  const path = useMemo(() => sketchCircle(shape.x, shape.y, r, seed), [shape.x, shape.y, r, seed])
  const pathLen = Math.PI * 2 * r + 50

  return (
    <g>
      <path
        d={path}
        fill={shape.fill || 'none'}
        fillOpacity={shape.fill ? 0.1 : 0}
        stroke={shape.color}
        strokeWidth={shape.strokeWidth ?? 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          shape.animated
            ? {
                strokeDasharray: pathLen,
                strokeDashoffset: pathLen,
                animation: `ai-shape-draw 0.8s ease-out forwards`,
              }
            : undefined
        }
      />
      {shape.label && (
        <text
          x={shape.x}
          y={shape.y - r - 8}
          textAnchor="middle"
          fill={shape.color}
          fontSize={11}
          fontFamily="monospace"
          opacity={shape.animated ? 0 : 1}
          style={
            shape.animated
              ? { animation: 'draw-fade-in 0.4s ease-out 0.6s forwards' }
              : undefined
          }
        >
          {shape.label}
        </text>
      )}
    </g>
  )
}

function AIRect({ shape }: { shape: AIShape }) {
  const w = shape.width ?? 100
  const h = shape.height ?? 60
  const seed = shape.x + shape.y
  const path = useMemo(() => sketchRect(shape.x, shape.y, w, h, seed), [shape.x, shape.y, w, h, seed])
  const pathLen = (w + h) * 2 + 40

  return (
    <g>
      <path
        d={path}
        fill={shape.fill || 'none'}
        fillOpacity={shape.fill ? 0.08 : 0}
        stroke={shape.color}
        strokeWidth={shape.strokeWidth ?? 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          shape.animated
            ? {
                strokeDasharray: pathLen,
                strokeDashoffset: pathLen,
                animation: `ai-shape-draw 0.8s ease-out forwards`,
              }
            : undefined
        }
      />
      {shape.label && (
        <text
          x={shape.x + w / 2}
          y={shape.y - 8}
          textAnchor="middle"
          fill={shape.color}
          fontSize={11}
          fontFamily="monospace"
          opacity={shape.animated ? 0 : 1}
          style={
            shape.animated
              ? { animation: 'draw-fade-in 0.4s ease-out 0.6s forwards' }
              : undefined
          }
        >
          {shape.label}
        </text>
      )}
    </g>
  )
}

function AIArrow({ shape }: { shape: AIShape }) {
  const toX = shape.toX ?? shape.x + 100
  const toY = shape.toY ?? shape.y
  const seed = shape.x + shape.y + toX + toY
  const { shaft, head } = useMemo(
    () => sketchArrow(shape.x, shape.y, toX, toY, seed),
    [shape.x, shape.y, toX, toY, seed],
  )
  const len = Math.sqrt((toX - shape.x) ** 2 + (toY - shape.y) ** 2) + 20

  return (
    <g>
      <path
        d={shaft}
        fill="none"
        stroke={shape.color}
        strokeWidth={shape.strokeWidth ?? 2}
        strokeLinecap="round"
        style={
          shape.animated
            ? {
                strokeDasharray: len,
                strokeDashoffset: len,
                animation: `ai-shape-draw 0.6s ease-out forwards`,
              }
            : undefined
        }
      />
      <path
        d={head}
        fill="none"
        stroke={shape.color}
        strokeWidth={shape.strokeWidth ?? 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={shape.animated ? 0 : 1}
        style={
          shape.animated
            ? { animation: 'draw-fade-in 0.3s ease-out 0.5s forwards' }
            : undefined
        }
      />
      {shape.label && (
        <text
          x={(shape.x + toX) / 2}
          y={(shape.y + toY) / 2 - 10}
          textAnchor="middle"
          fill={shape.color}
          fontSize={11}
          fontFamily="monospace"
          opacity={shape.animated ? 0 : 1}
          style={
            shape.animated
              ? { animation: 'draw-fade-in 0.4s ease-out 0.6s forwards' }
              : undefined
          }
        >
          {shape.label}
        </text>
      )}
    </g>
  )
}

function AIText({ shape }: { shape: AIShape }) {
  const size = shape.fontSize ?? 16
  const content = shape.content ?? ''
  const lines = content.split('\n')

  return (
    <g
      opacity={shape.animated ? 0 : 1}
      style={
        shape.animated
          ? { animation: 'draw-fade-in 0.6s ease-out 0.2s forwards' }
          : undefined
      }
    >
      {lines.map((line, i) => (
        <text
          key={i}
          x={shape.x}
          y={shape.y + i * (size * 1.4)}
          fill={shape.color}
          fontSize={size}
          fontFamily="'Segoe UI', system-ui, -apple-system, sans-serif"
          style={{
            filter: 'url(#hand-drawn-text)',
          }}
        >
          {line}
        </text>
      ))}
    </g>
  )
}

function AIHighlight({ shape }: { shape: AIShape }) {
  const w = shape.width ?? 100
  const h = shape.height ?? 30
  const seed = shape.x + shape.y
  const path = useMemo(
    () => sketchHighlight(shape.x, shape.y, w, h, seed),
    [shape.x, shape.y, w, h, seed],
  )

  return (
    <path
      d={path}
      fill={shape.color}
      fillOpacity={0.15}
      stroke="none"
      opacity={shape.animated ? 0 : 1}
      style={
        shape.animated
          ? { animation: 'draw-fade-in 0.5s ease-out forwards' }
          : undefined
      }
    />
  )
}

// ─── Main Layer ──────────────────────────────────────────────────────────────

export function AIDrawingLayer({ shapes }: { shapes: AIShape[] }) {
  return (
    <g className="ai-drawing-layer">
      {/* SVG filter for slight text wobble */}
      <defs>
        <filter id="hand-drawn-text">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.02"
            numOctaves="1"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="1"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>

      {shapes.map((shape) => {
        switch (shape.type) {
          case 'circle':
            return <AICircle key={shape.id} shape={shape} />
          case 'rect':
            return <AIRect key={shape.id} shape={shape} />
          case 'arrow':
            return <AIArrow key={shape.id} shape={shape} />
          case 'text':
            return <AIText key={shape.id} shape={shape} />
          case 'highlight':
            return <AIHighlight key={shape.id} shape={shape} />
          default:
            return null
        }
      })}
    </g>
  )
}
