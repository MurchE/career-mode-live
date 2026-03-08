'use client'

import { useCanvasStore, type DrawingTool } from '@/stores/canvas-store'

const COLORS = [
  { value: '#C9D1D9', label: 'White' },
  { value: '#FF7B72', label: 'Red' },
  { value: '#58A6FF', label: 'Blue' },
  { value: '#7EE787', label: 'Green' },
  { value: '#F0883E', label: 'Orange' },
  { value: '#BC8CFF', label: 'Purple' },
  { value: '#FFA657', label: 'Amber' },
]

const TOOLS: { id: DrawingTool; label: string; icon: string; shortcut: string }[] = [
  { id: 'pen', label: 'Pen', icon: 'M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z', shortcut: 'P' },
  { id: 'eraser', label: 'Eraser', icon: 'M16.24 3.56l4.95 4.94a1.5 1.5 0 010 2.12l-8.48 8.49a1.5 1.5 0 01-2.12 0L3.56 12.1a1.5 1.5 0 010-2.12L12.04 1.5a1.5 1.5 0 012.12 0l2.08 2.06zM4.98 11.4l5.66 5.66 7.78-7.78-5.66-5.66-7.78 7.78z', shortcut: 'E' },
  { id: 'arrow', label: 'Arrow', icon: 'M12 2l7 7h-4v6h-6v-6H5l7-7zM5 18h14v2H5v-2z', shortcut: 'A' },
]

const SIZES = [2, 3, 5, 8]

export function DrawingToolbar() {
  const { tool, penColor, penSize, setTool, setPenColor, setPenSize, clearCanvas, undoStroke, voice } = useCanvasStore()

  return (
    <div
      className="flex items-center gap-1 px-3 py-2 border-b z-30 relative"
      style={{
        borderColor: '#21262D',
        backgroundColor: '#161B22',
      }}
    >
      {/* Tools */}
      <div className="flex items-center gap-1 mr-3">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTool(t.id)}
            className="relative p-2 rounded-lg transition-all"
            style={{
              backgroundColor: tool === t.id ? 'rgba(88,166,255,0.15)' : 'transparent',
              border: tool === t.id ? '1px solid rgba(88,166,255,0.3)' : '1px solid transparent',
              color: tool === t.id ? '#58A6FF' : '#8B949E',
            }}
            title={`${t.label} (${t.shortcut})`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d={t.icon} />
            </svg>
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="w-px h-6 mx-2" style={{ backgroundColor: '#21262D' }} />

      {/* Colors */}
      <div className="flex items-center gap-1.5 mr-3">
        {COLORS.map((c) => (
          <button
            key={c.value}
            onClick={() => setPenColor(c.value)}
            className="w-5 h-5 rounded-full transition-transform hover:scale-110"
            style={{
              backgroundColor: c.value,
              border: penColor === c.value ? '2px solid #E6EDF3' : '2px solid transparent',
              boxShadow: penColor === c.value ? `0 0 8px ${c.value}40` : 'none',
            }}
            title={c.label}
          />
        ))}
      </div>

      {/* Separator */}
      <div className="w-px h-6 mx-2" style={{ backgroundColor: '#21262D' }} />

      {/* Stroke sizes */}
      <div className="flex items-center gap-2 mr-3">
        {SIZES.map((s) => (
          <button
            key={s}
            onClick={() => setPenSize(s)}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-all"
            style={{
              backgroundColor: penSize === s ? 'rgba(201,209,217,0.1)' : 'transparent',
              border: penSize === s ? '1px solid rgba(201,209,217,0.2)' : '1px solid transparent',
            }}
            title={`Size ${s}`}
          >
            <div
              className="rounded-full"
              style={{
                width: s * 2,
                height: s * 2,
                backgroundColor: penColor,
              }}
            />
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="w-px h-6 mx-2" style={{ backgroundColor: '#21262D' }} />

      {/* Actions */}
      <button
        onClick={undoStroke}
        className="p-2 rounded-lg text-[#8B949E] hover:text-[#C9D1D9] hover:bg-[#21262D] transition-all"
        title="Undo (Ctrl+Z)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 10h10a5 5 0 015 5v0a5 5 0 01-5 5H8" />
          <path d="M7 6l-4 4 4 4" />
        </svg>
      </button>

      <button
        onClick={clearCanvas}
        className="p-2 rounded-lg text-[#8B949E] hover:text-[#FF7B72] hover:bg-[rgba(255,123,114,0.1)] transition-all"
        title="Clear canvas"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        </svg>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Voice controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            const { voice, setVoice } = useCanvasStore.getState()
            setVoice({ isListening: !voice.isListening })
          }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-xs font-mono"
          style={{
            backgroundColor: voice.isListening ? 'rgba(255,123,114,0.15)' : 'rgba(201,209,217,0.05)',
            border: voice.isListening ? '1px solid rgba(255,123,114,0.3)' : '1px solid rgba(201,209,217,0.1)',
            color: voice.isListening ? '#FF7B72' : '#8B949E',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2zM11 19.93V22h2v-2.07A8 8 0 0020 12h-2a6 6 0 01-12 0H4a8 8 0 007 7.93z" />
          </svg>
          {voice.isListening ? 'Listening' : 'Voice'}
        </button>

        {/* AI status indicator */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono"
          style={{ color: '#7EE787' }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: '#7EE787', opacity: 0.6 }}
          />
          AI Ready
        </div>
      </div>
    </div>
  )
}
