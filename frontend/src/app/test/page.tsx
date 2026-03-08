'use client'

import { useEffect, useState } from 'react'
import { CoachingPanel } from '@/components/coaching-panel'
import { CharacterSheetMini } from '@/components/character-sheet-mini'
import { StoryWhiteboard } from '@/components/story-whiteboard'
import CareerTrailer from '@/components/career-trailer'
import { useCharacterStore } from '@/stores/character-store'
import type { StoryboardPart } from '@/lib/api'

// Mock data — no API calls needed
const MOCK_CHARACTER_SHEET = {
  suggested_allocation: { Technical: 42, Leadership: 24, Analytical: 20, Creative: 18, Communication: 12, Operational: 8 },
  total_budget: 124,
  character_class: 'hacker',
  primary_stat: 'Technical',
  secondary_stat: 'Leadership',
  confidence: 0.86,
  name: 'Murch',
  title: 'Staff Engineer',
  years_experience: 8,
}

const MOCK_FLAT_MIRROR =
  'Murch is a seasoned engineering professional with a demonstrated history of contributing to technological advancements within the financial sector. Leveraging a robust skill set in modern programming languages and machine learning, Murch has played a key role in various initiatives aimed at enhancing operational efficiency.'

const MOCK_STAR_ELEMENTS = [
  { id: 'star-1', category: 'situation' as const, content: 'Visa fraud detection team drowning in false positives — analysts spending 60% of time on manual review', coach_id: 'chad', coach_name: 'Chad', confirmed: true, timestamp: Date.now() - 5000 },
  { id: 'star-2', category: 'task' as const, content: 'Build ML pipeline to automate fraud classification and reduce false positive rate', coach_id: 'viktor', coach_name: 'Viktor', confirmed: true, timestamp: Date.now() - 4000 },
  { id: 'star-3', category: 'action' as const, content: 'Designed and built end-to-end ML pipeline from scratch — feature engineering, model training, deployment. Worked nights/weekends at Deloitte doing similar automation.', coach_id: 'reeves', coach_name: 'Dr. Reeves', confirmed: false, timestamp: Date.now() - 3000 },
  { id: 'star-4', category: 'result' as const, content: '$12M saved in false positive costs, 40% reduction in false positive rate', coach_id: 'chad', coach_name: 'Chad', confirmed: true, timestamp: Date.now() - 2000 },
  { id: 'star-5', category: 'situation' as const, content: 'Deloitte audit team manually reconciling data between spreadsheets', coach_id: 'reeves', coach_name: 'Dr. Reeves', confirmed: false, timestamp: Date.now() - 1000 },
  { id: 'star-6', category: 'action' as const, content: 'Wrote Python automation tooling on nights and weekends — nobody asked, driven by anger at watching smart people waste time', coach_id: 'viktor', coach_name: 'Viktor', confirmed: false, timestamp: Date.now() },
]

const MOCK_NARRATIVE = {
  throughline: 'You are someone who sees broken systems as personal insults — and responds by building the thing nobody asked for but everyone needed.',
  evidence: [
    'Built fraud detection ML pipeline from scratch at Visa, saving $12M',
    'Automated Deloitte audit workflows on nights and weekends out of anger at waste',
    'Transitioned from music production to fintech, teaching yourself to code along the way',
  ],
  reframe: "You don't just build software — you rescue organizations from their own inertia. The pattern across Visa, Deloitte, and even your music company is the same: you see talented people trapped by bad tooling, and you can't not fix it. That's not a career path, it's a compulsion — and it's your superpower.",
  positioning_statement: "I'm the engineer who builds the systems nobody asked for but everyone ends up depending on. At Visa I turned a manual fraud review nightmare into an ML pipeline that saved $12M. At Deloitte I automated an entire audit workflow because watching smart people waste time on spreadsheets made me angry enough to code through weekends.",
}

const MOCK_STORYBOARD_PARTS: StoryboardPart[] = [
  { type: 'text', content: 'Chapter 1: THE ORIGIN\n\nIt started with music — a production company where creativity met code for the first time. But the real pattern was already forming: seeing how things could be better, and refusing to accept they weren\'t.' },
  { type: 'text', content: 'Chapter 2: THE PATTERN\n\nAt Deloitte, watching analysts copy data between spreadsheets felt like watching artists paint with broken brushes. The automation tools weren\'t in the job description — they were an act of rebellion against waste.' },
  { type: 'text', content: 'Chapter 3: THE FUTURE\n\nThe fraud detection system at Visa was the biggest canvas yet — $12M in impact from a pipeline built from scratch. But the story isn\'t about fraud. It\'s about what happens when someone who can\'t tolerate broken systems gets access to real data and real infrastructure.' },
]

export default function TestPage() {
  const store = useCharacterStore()
  const [showTrailer, setShowTrailer] = useState(false)
  const [showWhiteboard, setShowWhiteboard] = useState(true)
  const [loaded, setLoaded] = useState(false)

  // Load mock data on mount
  useEffect(() => {
    if (!loaded) {
      store.setOnboarded(MOCK_CHARACTER_SHEET, MOCK_FLAT_MIRROR)

      // Simulate a coaching round
      store.addUserMessage("That's garbage. I built a fraud detection ML pipeline from zero that caught $12M in false positives. At Deloitte I automated their audit workflow on nights and weekends because watching smart people waste time made me angry.")

      store.addCoachResponses([
        { coach_id: 'chad', coach_name: 'Chad', response: "Hold up — you casually dropped $12M savings and building on nights and weekends out of anger? That's not 'various initiatives,' that's a one-person wrecking crew. What's the real story behind that anger?", color: '#FF7B72' },
        { coach_id: 'reeves', coach_name: 'Dr. Reeves', response: "Chad's right about the energy. 'Angry about the waste' is a powerful motivator. But I'm curious about the personal cost — what happened when your managers found out you'd essentially done their job for them?", color: '#BC8CFF' },
        { coach_id: 'viktor', coach_name: 'Viktor', response: 'I see a recurring pattern: detecting systemic inefficiency, then autonomously architecting a solution. Your hacker class optimizes for high-leverage fixes. What was the internal reward — the intellectual challenge, the impact, or the validation?', color: '#79C0FF' },
      ])

      // Add STAR elements
      store.addStarElements(MOCK_STAR_ELEMENTS)

      // Add narrative
      store.setNarrativeSynthesis(MOCK_NARRATIVE)

      // Add storyboard
      store.setStoryboard(MOCK_STORYBOARD_PARTS)

      setLoaded(true)
    }
  }, [loaded, store])

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
          <span className="text-xs text-text-muted font-mono ml-2">TEST MODE</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowWhiteboard(!showWhiteboard)}
            className="text-sm text-text-secondary hover:text-text-primary transition-colors"
          >
            {showWhiteboard ? 'Hide' : 'Show'} Whiteboard
          </button>
          <button
            onClick={() => setShowTrailer(true)}
            className="px-3 py-1 text-xs font-mono rounded-full bg-[#7EE787]/15 text-[#7EE787] border border-[#7EE787]/30 hover:bg-[#7EE787]/25 transition-colors"
          >
            Play Career Trailer
          </button>
          <span className="text-xs text-[#F0883E] font-mono">No API calls</span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* STAR Whiteboard */}
        {showWhiteboard && (
          <div className="w-[480px] border-r border-border overflow-y-auto flex-shrink-0">
            <StoryWhiteboard
              elements={store.starElements}
              onConfirmElement={store.confirmStarElement}
            />
          </div>
        )}

        {/* Coaching Panel */}
        <div className="flex-1 flex flex-col">
          <CoachingPanel />
        </div>

        {/* Character Sheet */}
        <div className="w-80 border-l border-border overflow-y-auto">
          <CharacterSheetMini />
        </div>
      </div>

      {/* Trailer overlay */}
      {showTrailer && (
        <CareerTrailer
          parts={MOCK_STORYBOARD_PARTS}
          throughline={MOCK_NARRATIVE.throughline}
          onClose={() => setShowTrailer(false)}
        />
      )}
    </main>
  )
}
