'use client'

import { useState } from 'react'
import { CoachingPanel } from '@/components/coaching-panel'
import { CharacterSheetMini } from '@/components/character-sheet-mini'
import { Onboarding } from '@/components/onboarding'
import { useCharacterStore } from '@/stores/character-store'

export default function Home() {
  const { characterSheet, isOnboarded } = useCharacterStore()
  const [showCharacterSheet, setShowCharacterSheet] = useState(true)

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
            <button
              onClick={() => setShowCharacterSheet(!showCharacterSheet)}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              {showCharacterSheet ? 'Hide' : 'Show'} Character Sheet
            </button>
          )}
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
          {/* Coaching Panel — main area */}
          <div className={`flex-1 flex flex-col ${showCharacterSheet ? 'mr-0' : ''}`}>
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
    </main>
  )
}
