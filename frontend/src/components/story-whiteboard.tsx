'use client'

import { useState, useEffect, useRef, useMemo } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StarElement {
  id: string
  category: 'situation' | 'task' | 'action' | 'result'
  content: string
  coach_id: string
  coach_name: string
  confirmed: boolean
  timestamp: number
}

interface StoryWhiteboardProps {
  elements: StarElement[]
  onConfirmElement?: (id: string) => void
  className?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_META: Record<
  StarElement['category'],
  { label: string; color: string; icon: string }
> = {
  situation: { label: 'Situation', color: '#F0883E', icon: 'S' },
  task: { label: 'Task', color: '#58A6FF', icon: 'T' },
  action: { label: 'Action', color: '#7EE787', icon: 'A' },
  result: { label: 'Result', color: '#BC8CFF', icon: 'R' },
}

const COACH_COLORS: Record<string, string> = {
  chad: '#FF7B72',
  reeves: '#BC8CFF',
  viktor: '#79C0FF',
}

// Deterministic "random" from element id — keeps values stable across renders
function hashCode(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return h
}

function seededRandom(id: string, salt: number): number {
  const h = hashCode(id + String(salt))
  return ((h % 200) - 100) / 100 // -1 to 1
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Animated SVG hand-drawn rectangle border */
function SketchBorder({
  width,
  height,
  color,
  confirmed,
  animate,
}: {
  width: number
  height: number
  color: string
  confirmed: boolean
  animate: boolean
}) {
  // Build a wobbly rectangle path
  const wobble = 2
  const r = 6
  const path = [
    `M ${r + wobble * 0.3} ${wobble * 0.5}`,
    `Q ${width * 0.25} ${-wobble * 0.4}, ${width * 0.5} ${wobble * 0.3}`,
    `Q ${width * 0.75} ${-wobble * 0.2}, ${width - r} ${wobble * 0.5}`,
    `Q ${width + wobble * 0.3} ${wobble * 0.3}, ${width - wobble * 0.2} ${r}`,
    `Q ${width + wobble * 0.4} ${height * 0.3}, ${width - wobble * 0.3} ${height * 0.5}`,
    `Q ${width + wobble * 0.2} ${height * 0.7}, ${width - wobble * 0.4} ${height - r}`,
    `Q ${width - wobble * 0.3} ${height + wobble * 0.3}, ${width - r} ${height - wobble * 0.2}`,
    `Q ${width * 0.75} ${height + wobble * 0.4}, ${width * 0.5} ${height - wobble * 0.3}`,
    `Q ${width * 0.25} ${height + wobble * 0.2}, ${r} ${height - wobble * 0.5}`,
    `Q ${-wobble * 0.3} ${height - wobble * 0.3}, ${wobble * 0.2} ${height - r}`,
    `Q ${-wobble * 0.4} ${height * 0.7}, ${wobble * 0.3} ${height * 0.5}`,
    `Q ${-wobble * 0.2} ${height * 0.3}, ${wobble * 0.4} ${r}`,
    `Z`,
  ].join(' ')

  const pathLength = (width + height) * 2 + 40 // approximate

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width}
      height={height}
      style={{ overflow: 'visible' }}
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={confirmed ? 2 : 1.5}
        strokeOpacity={confirmed ? 0.8 : 0.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          animate
            ? {
                strokeDasharray: pathLength,
                strokeDashoffset: pathLength,
                animation: `sketch-draw 0.8s ease-out forwards`,
              }
            : undefined
        }
      />
      {confirmed && (
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth={1}
          strokeOpacity={0.15}
          filter="url(#glow)"
        />
      )}
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  )
}

/** Single STAR element card */
function StarCard({
  element,
  onConfirm,
  isNew,
}: {
  element: StarElement
  onConfirm?: (id: string) => void
  isNew: boolean
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 280, h: 100 })

  const meta = CATEGORY_META[element.category]
  const coachColor = COACH_COLORS[element.coach_id] || '#8B949E'
  const rotation = seededRandom(element.id, 1) * 1.2 // -1.2 to 1.2 deg
  const offsetX = seededRandom(element.id, 2) * 4 // subtle x shift
  const offsetY = seededRandom(element.id, 3) * 2 // subtle y shift

  useEffect(() => {
    if (cardRef.current) {
      const { offsetWidth, offsetHeight } = cardRef.current
      setDims({ w: offsetWidth, h: offsetHeight })
    }
  }, [element.content])

  return (
    <div
      ref={cardRef}
      className="relative p-2 mb-2"
      style={{
        transform: `rotate(${rotation}deg) translate(${offsetX}px, ${offsetY}px)`,
        animation: isNew ? 'card-appear 0.6s ease-out both' : undefined,
      }}
    >
      {/* Sketchy border */}
      <SketchBorder
        width={dims.w}
        height={dims.h}
        color={meta.color}
        confirmed={element.confirmed}
        animate={isNew}
      />

      {/* Card inner */}
      <div
        className="relative z-10 rounded-lg p-3 transition-all duration-500"
        style={{
          backgroundColor: element.confirmed
            ? `${meta.color}12`
            : `${meta.color}08`,
        }}
      >
        {/* Header row: coach dot + confirm button */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: coachColor }}
              title={element.coach_name}
            />
            <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
              {element.coach_name}
            </span>
          </div>

          {onConfirm && !element.confirmed && (
            <button
              onClick={() => onConfirm(element.id)}
              className="text-[10px] font-mono px-2 py-0.5 rounded-full transition-all hover:scale-105"
              style={{
                color: meta.color,
                border: `1px solid ${meta.color}40`,
                backgroundColor: `${meta.color}10`,
              }}
            >
              Lock in
            </button>
          )}

          {element.confirmed && (
            <div
              className="flex items-center gap-1 text-[10px] font-mono"
              style={{ color: meta.color }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="lock-in-check"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Locked
            </div>
          )}
        </div>

        {/* Content with typewriter effect */}
        <p
          className="text-sm text-text-primary leading-relaxed"
          style={{
            animation: isNew
              ? 'typewriter-fade 0.8s ease-out 0.3s both'
              : undefined,
          }}
        >
          {element.content}
        </p>
      </div>
    </div>
  )
}

/** Hand-drawn underline SVG for category headers */
function SketchyUnderline({ color, width }: { color: string; width: number }) {
  const y = 4
  const path = `M 0 ${y} Q ${width * 0.15} ${y - 3}, ${width * 0.3} ${y + 1} Q ${width * 0.5} ${y + 4}, ${width * 0.7} ${y - 1} Q ${width * 0.85} ${y - 3}, ${width} ${y + 2}`
  const pathLen = width * 1.2

  return (
    <svg
      width={width}
      height={12}
      className="mt-1"
      style={{ overflow: 'visible' }}
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeOpacity={0.6}
        style={{
          strokeDasharray: pathLen,
          strokeDashoffset: pathLen,
          animation: 'sketch-draw 1s ease-out 0.2s forwards',
        }}
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function StoryWhiteboard({
  elements,
  onConfirmElement,
  className = '',
}: StoryWhiteboardProps) {
  // Track which elements are "new" (appeared in last 2s) for animations
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set())
  const prevElementsRef = useRef<StarElement[]>([])

  useEffect(() => {
    const prevIds = new Set(prevElementsRef.current.map((e) => e.id))
    const newIds = elements.filter((e) => !prevIds.has(e.id)).map((e) => e.id)

    if (newIds.length > 0) {
      // Mark new IDs as "seen" after animation completes
      const timer = setTimeout(() => {
        setSeenIds((prev) => {
          const next = new Set(prev)
          newIds.forEach((id) => next.add(id))
          return next
        })
      }, 2000)
      return () => clearTimeout(timer)
    }

    prevElementsRef.current = elements
  }, [elements])

  // Update prev ref
  useEffect(() => {
    prevElementsRef.current = elements
  }, [elements])

  // Group elements by category
  const grouped = useMemo(() => {
    const groups: Record<StarElement['category'], StarElement[]> = {
      situation: [],
      task: [],
      action: [],
      result: [],
    }
    for (const el of elements) {
      groups[el.category]?.push(el)
    }
    return groups
  }, [elements])

  const categories: StarElement['category'][] = [
    'situation',
    'task',
    'action',
    'result',
  ]

  const totalElements = elements.length
  const confirmedCount = elements.filter((e) => e.confirmed).length

  return (
    <div
      className={`flex flex-col h-full bg-[#0D1117] ${className}`}
    >
      {/* Inline styles for animations — no external CSS file needed */}
      <style>{`
        @keyframes sketch-draw {
          to { stroke-dashoffset: 0; }
        }

        @keyframes card-appear {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(8px);
          }
          60% {
            opacity: 1;
            transform: scale(1.02) translateY(-2px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes typewriter-fade {
          0% {
            opacity: 0;
            clip-path: inset(0 100% 0 0);
          }
          100% {
            opacity: 1;
            clip-path: inset(0 0 0 0);
          }
        }

        @keyframes lock-in-glow {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        .lock-in-check {
          animation: lock-in-glow 0.4s ease-out both;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .board-header-dot {
          animation: pulse-dot 3s ease-in-out infinite;
        }

        @keyframes column-fade-in {
          0% { opacity: 0; transform: translateY(12px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .star-column {
          animation: column-fade-in 0.5s ease-out both;
        }
        .star-column:nth-child(2) { animation-delay: 0.1s; }
        .star-column:nth-child(3) { animation-delay: 0.2s; }
        .star-column:nth-child(4) { animation-delay: 0.3s; }
      `}</style>

      {/* Header */}
      <div className="px-4 py-3 border-b border-[#21262D] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full bg-[#7EE787] board-header-dot"
          />
          <span className="text-xs font-mono text-text-muted uppercase tracking-widest">
            STAR Whiteboard
          </span>
        </div>
        {totalElements > 0 && (
          <span className="text-[10px] font-mono text-text-muted">
            {confirmedCount}/{totalElements} locked
          </span>
        )}
      </div>

      {/* Board area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3">
        {totalElements === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="relative w-24 h-24 mb-4 opacity-20">
              <svg viewBox="0 0 96 96" fill="none" className="w-full h-full">
                {/* Sketchy board outline */}
                <path
                  d="M 8 12 Q 20 8, 48 10 Q 76 8, 88 12 Q 90 20, 88 48 Q 90 76, 88 84 Q 76 88, 48 86 Q 20 88, 8 84 Q 6 76, 8 48 Q 6 20, 8 12 Z"
                  stroke="#C9D1D9"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                {/* Cross lines */}
                <path
                  d="M 48 14 Q 49 48, 48 82"
                  stroke="#C9D1D9"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />
                <path
                  d="M 10 48 Q 48 47, 86 48"
                  stroke="#C9D1D9"
                  strokeWidth="1"
                  strokeDasharray="4 3"
                />
              </svg>
            </div>
            <p className="text-sm text-text-muted font-mono mb-1">
              No story elements yet
            </p>
            <p className="text-xs text-text-muted/60 max-w-[200px]">
              Elements will appear here as the coaches uncover your STAR stories
            </p>
          </div>
        ) : (
          /* 2x2 grid for STAR quadrants */
          <div className="grid grid-cols-1 gap-3 min-h-full">
            {categories.map((cat) => {
              const meta = CATEGORY_META[cat]
              const catElements = grouped[cat]

              return (
                <div
                  key={cat}
                  className="star-column flex flex-col min-h-[80px] rounded-lg p-2"
                  style={{
                    backgroundColor: `${meta.color}06`,
                    border: `1px dashed ${meta.color}20`,
                    borderRadius: '8px 12px 10px 14px', // asymmetric
                  }}
                >
                  {/* Category header */}
                  <div className="flex items-center gap-2 px-1 mb-2">
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
                      style={{
                        backgroundColor: `${meta.color}20`,
                        color: meta.color,
                        borderRadius: '4px 6px 5px 7px',
                      }}
                    >
                      {meta.icon}
                    </div>
                    <span
                      className="text-xs font-mono uppercase tracking-wider"
                      style={{ color: meta.color }}
                    >
                      {meta.label}
                    </span>
                    {catElements.length > 0 && (
                      <span
                        className="text-[10px] font-mono ml-auto"
                        style={{ color: `${meta.color}80` }}
                      >
                        {catElements.length}
                      </span>
                    )}
                  </div>

                  <SketchyUnderline color={meta.color} width={120} />

                  {/* Elements */}
                  <div className="flex-1 mt-2">
                    {catElements.length === 0 ? (
                      <div
                        className="flex items-center justify-center h-16 rounded border border-dashed text-[10px] font-mono"
                        style={{
                          borderColor: `${meta.color}15`,
                          color: `${meta.color}30`,
                          borderRadius: '6px 8px 5px 9px',
                        }}
                      >
                        waiting...
                      </div>
                    ) : (
                      catElements.map((el) => (
                        <StarCard
                          key={el.id}
                          element={el}
                          onConfirm={onConfirmElement}
                          isNew={!seenIds.has(el.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer legend */}
      {totalElements > 0 && (
        <div className="px-4 py-2 border-t border-[#21262D] flex items-center gap-4">
          {Object.entries(COACH_COLORS).map(([id, color]) => (
            <div key={id} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] font-mono text-text-muted capitalize">
                {id}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
