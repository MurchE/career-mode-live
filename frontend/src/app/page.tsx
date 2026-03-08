'use client'

import { useState } from 'react'
import { CoachingPanel } from '@/components/coaching-panel'
import { CharacterSheetMini } from '@/components/character-sheet-mini'
import { Onboarding } from '@/components/onboarding'
import { StoryWhiteboard } from '@/components/story-whiteboard'
import CareerTrailer from '@/components/career-trailer'
import { useCharacterStore } from '@/stores/character-store'

export default function Home() {
  const { characterSheet, isOnboarded, starElements, confirmStarElement, messages, narrativeSynthesis } = useCharacterStore()
  const [showCharacterSheet, setShowCharacterSheet] = useState(true)
  const [showWhiteboard, setShowWhiteboard] = useState(true)
  const [showTrailer, setShowTrailer] = useState(false)

  // Find the latest storyboard parts from messages
  const storyboardMsg = [...messages].reverse().find((m) => m.type === 'storyboard')
  const storyboardParts = storyboardMsg?.storyboardParts || []

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-blue flex items-center justify-center font-mono font-bold text-bg-primary text-sm">
            CM
          </div>
          <h1 className="text-lg font-semibold">
            Career Mode <span className="text-accent-blue">Live</span>
          </h1>
          <span className="text-xs text-text-muted font-mono ml-2">v0.1.0</span>
        </div>
        <div className="flex items-center gap-4">
          {isOnboarded && (
            <>
              <button
                onClick={() => setShowWhiteboard(!showWhiteboard)}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {showWhiteboard ? 'Hide' : 'Show'} Whiteboard
              </button>
              <button
                onClick={() => setShowCharacterSheet(!showCharacterSheet)}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {showCharacterSheet ? 'Hide' : 'Show'} Character Sheet
              </button>
              {storyboardParts.length > 0 && (
                <button
                  onClick={() => setShowTrailer(true)}
                  className="px-3 py-1 text-xs font-mono rounded-full bg-[#7EE787]/15 text-[#7EE787] border border-[#7EE787]/30 hover:bg-[#7EE787]/25 transition-colors"
                >
                  Play Career Trailer
                </button>
              )}
            </>
          )}
          <a
            href="/whiteboard"
            className="px-3 py-1 text-xs font-mono rounded-full bg-[#58A6FF]/15 text-[#58A6FF] border border-[#58A6FF]/30 hover:bg-[#58A6FF]/25 transition-colors"
          >
            DrawTogether
          </a>
          <span className="text-xs text-text-muted">
            Powered by Gemini 2.5 Flash
          </span>
        </div>
      </header>

      {/* Main content */}
      {!isOnboarded ? (
        <Onboarding />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* STAR Whiteboard — left sidebar */}
          {showWhiteboard && starElements.length > 0 && (
            <div className="w-[480px] border-r border-border overflow-y-auto flex-shrink-0">
              <StoryWhiteboard
                elements={starElements}
                onConfirmElement={confirmStarElement}
              />
            </div>
          )}

          {/* Coaching Panel — main area */}
          <div className="flex-1 flex flex-col">
            <CoachingPanel />
          </div>

          {/* Character Sheet sidebar */}
          {showCharacterSheet && characterSheet && (
            <div className="w-80 border-l border-border overflow-y-auto">
              <CharacterSheetMini />
            </div>
          )}
        </div>
      )}

      {/* Career Trailer overlay */}
      {showTrailer && storyboardParts.length > 0 && (
        <CareerTrailer
          parts={storyboardParts}
          throughline={narrativeSynthesis?.throughline}
          onClose={() => setShowTrailer(false)}
        />
      )}
    </main>
  )
}
