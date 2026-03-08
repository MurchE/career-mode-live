import { create } from 'zustand'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Point {
  x: number
  y: number
  pressure?: number
}

export interface Stroke {
  id: string
  points: Point[]
  color: string
  size: number
  author: 'user' | 'ai'
  timestamp: number
  /** For AI strokes: animate the drawing effect */
  animated?: boolean
}

export type AIShapeType = 'circle' | 'rect' | 'arrow' | 'text' | 'highlight' | 'connector' | 'freeform'

export interface AIShape {
  id: string
  type: AIShapeType
  // Geometry
  x: number
  y: number
  width?: number
  height?: number
  radius?: number
  // Arrow/connector
  toX?: number
  toY?: number
  // Text
  content?: string
  fontSize?: number
  // Style
  color: string
  strokeWidth?: number
  fill?: string
  // Freeform path data
  pathData?: string
  points?: Point[]
  // Meta
  label?: string
  timestamp: number
  animated: boolean
}

export type DrawingTool = 'pen' | 'eraser' | 'arrow' | 'text' | 'select'

export interface VoiceState {
  isListening: boolean
  isSpeaking: boolean
  isConnected: boolean
  transcript: string
}

interface CanvasState {
  // Drawing
  strokes: Stroke[]
  currentStroke: Point[] | null
  tool: DrawingTool
  penColor: string
  penSize: number

  // AI shapes (drawn by AI)
  aiShapes: AIShape[]

  // Voice
  voice: VoiceState

  // Canvas dimensions
  canvasWidth: number
  canvasHeight: number

  // AI state
  isAIThinking: boolean
  isAIDrawing: boolean
  aiStatus: string

  // Actions — Drawing
  startStroke: (point: Point) => void
  addPoint: (point: Point) => void
  endStroke: () => void
  setTool: (tool: DrawingTool) => void
  setPenColor: (color: string) => void
  setPenSize: (size: number) => void
  clearCanvas: () => void
  undoStroke: () => void

  // Actions — AI
  addAIShape: (shape: Omit<AIShape, 'id' | 'timestamp' | 'animated'>) => void
  addAIShapes: (shapes: Omit<AIShape, 'id' | 'timestamp' | 'animated'>[]) => void
  addAIStroke: (stroke: Omit<Stroke, 'id' | 'timestamp' | 'author' | 'animated'>) => void
  clearAIShapes: () => void
  setAIThinking: (v: boolean) => void
  setAIDrawing: (v: boolean) => void
  setAIStatus: (s: string) => void

  // Actions — Voice
  setVoice: (v: Partial<VoiceState>) => void

  // Canvas size
  setCanvasSize: (w: number, h: number) => void
}

// ─── Store ───────────────────────────────────────────────────────────────────

let shapeCounter = 0
function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${++shapeCounter}`
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  // Initial state
  strokes: [],
  currentStroke: null,
  tool: 'pen',
  penColor: '#C9D1D9',
  penSize: 3,
  aiShapes: [],
  voice: {
    isListening: false,
    isSpeaking: false,
    isConnected: false,
    transcript: '',
  },
  canvasWidth: 1200,
  canvasHeight: 800,
  isAIThinking: false,
  isAIDrawing: false,
  aiStatus: '',

  // Drawing
  startStroke: (point) =>
    set({ currentStroke: [point] }),

  addPoint: (point) =>
    set((s) => ({
      currentStroke: s.currentStroke ? [...s.currentStroke, point] : [point],
    })),

  endStroke: () =>
    set((s) => {
      if (!s.currentStroke || s.currentStroke.length < 2) {
        return { currentStroke: null }
      }
      const stroke: Stroke = {
        id: nextId('stroke'),
        points: s.currentStroke,
        color: s.tool === 'eraser' ? '#0D1117' : s.penColor,
        size: s.tool === 'eraser' ? s.penSize * 4 : s.penSize,
        author: 'user',
        timestamp: Date.now(),
      }
      return {
        strokes: [...s.strokes, stroke],
        currentStroke: null,
      }
    }),

  setTool: (tool) => set({ tool }),
  setPenColor: (penColor) => set({ penColor }),
  setPenSize: (penSize) => set({ penSize }),

  clearCanvas: () => set({ strokes: [], aiShapes: [], currentStroke: null }),

  undoStroke: () =>
    set((s) => {
      const userStrokes = s.strokes.filter((st) => st.author === 'user')
      if (userStrokes.length === 0) return s
      const lastUserStroke = userStrokes[userStrokes.length - 1]
      return { strokes: s.strokes.filter((st) => st.id !== lastUserStroke.id) }
    }),

  // AI shapes
  addAIShape: (shape) =>
    set((s) => ({
      aiShapes: [
        ...s.aiShapes,
        { ...shape, id: nextId('ai-shape'), timestamp: Date.now(), animated: true },
      ],
    })),

  addAIShapes: (shapes) =>
    set((s) => ({
      aiShapes: [
        ...s.aiShapes,
        ...shapes.map((sh) => ({
          ...sh,
          id: nextId('ai-shape'),
          timestamp: Date.now(),
          animated: true,
        })),
      ],
    })),

  addAIStroke: (stroke) =>
    set((s) => ({
      strokes: [
        ...s.strokes,
        {
          ...stroke,
          id: nextId('ai-stroke'),
          author: 'ai' as const,
          timestamp: Date.now(),
          animated: true,
        },
      ],
    })),

  clearAIShapes: () => set({ aiShapes: [] }),

  setAIThinking: (isAIThinking) => set({ isAIThinking }),
  setAIDrawing: (isAIDrawing) => set({ isAIDrawing }),
  setAIStatus: (aiStatus) => set({ aiStatus }),

  // Voice
  setVoice: (v) =>
    set((s) => ({ voice: { ...s.voice, ...v } })),

  // Canvas size
  setCanvasSize: (canvasWidth, canvasHeight) =>
    set({ canvasWidth, canvasHeight }),
}))
