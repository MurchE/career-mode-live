import { create } from 'zustand'
import type { CharacterSheet, ConversationEntry, CoachResponse, NarrativeResponse } from '@/lib/api'

interface PanelMessage {
  id: string
  type: 'user' | 'coach' | 'system' | 'narrative'
  content: string
  coachId?: string
  coachName?: string
  color?: string
  timestamp: number
  narrative?: NarrativeResponse
}

interface CharacterState {
  // Onboarding
  isOnboarded: boolean
  characterSheet: CharacterSheet | null
  flatMirror: string | null

  // Coaching
  coachingPhase: string
  messages: PanelMessage[]
  conversationHistory: ConversationEntry[]
  isLoading: boolean
  roundCount: number
  narrativeSynthesis: NarrativeResponse | null

  // Actions
  setOnboarded: (sheet: CharacterSheet, flatMirror: string) => void
  resetOnboarding: () => void
  setCoachingPhase: (phase: string) => void
  addUserMessage: (content: string) => void
  addCoachResponses: (responses: CoachResponse[]) => void
  setLoading: (loading: boolean) => void
  updateCharacterSheet: (sheet: CharacterSheet) => void
  setNarrativeSynthesis: (narrative: NarrativeResponse) => void
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  isOnboarded: false,
  characterSheet: null,
  flatMirror: null,
  coachingPhase: 'flat_mirror',
  messages: [],
  conversationHistory: [],
  isLoading: false,
  roundCount: 0,
  narrativeSynthesis: null,

  setOnboarded: (sheet, flatMirror) =>
    set({
      isOnboarded: true,
      characterSheet: sheet,
      flatMirror,
      coachingPhase: 'flat_mirror',
      // Add flat mirror as first message
      messages: [
        {
          id: 'flat-mirror',
          type: 'coach',
          content: flatMirror,
          coachName: 'Panel',
          color: '#58A6FF',
          timestamp: Date.now(),
        },
      ],
    }),

  resetOnboarding: () =>
    set({
      isOnboarded: false,
      characterSheet: null,
      flatMirror: null,
      coachingPhase: 'flat_mirror',
      messages: [],
      conversationHistory: [],
      isLoading: false,
      roundCount: 0,
      narrativeSynthesis: null,
    }),

  setCoachingPhase: (phase) => set({ coachingPhase: phase }),

  addUserMessage: (content) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `user-${Date.now()}`,
          type: 'user' as const,
          content,
          timestamp: Date.now(),
        },
      ],
      conversationHistory: [
        ...state.conversationHistory,
        { role: 'user', content },
      ],
    })),

  addCoachResponses: (responses) =>
    set((state) => ({
      messages: [
        ...state.messages,
        ...responses.map((r) => ({
          id: `${r.coach_id}-${Date.now()}`,
          type: 'coach' as const,
          content: r.response,
          coachId: r.coach_id,
          coachName: r.coach_name,
          color: r.color,
          timestamp: Date.now(),
        })),
      ],
      conversationHistory: [
        ...state.conversationHistory,
        ...responses.map((r) => ({
          role: 'assistant',
          content: r.response,
          coach_name: r.coach_name,
        })),
      ],
      roundCount: state.roundCount + 1,
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  updateCharacterSheet: (sheet) => set({ characterSheet: sheet }),

  setNarrativeSynthesis: (narrative) =>
    set((state) => ({
      narrativeSynthesis: narrative,
      messages: [
        ...state.messages,
        {
          id: `narrative-${Date.now()}`,
          type: 'narrative' as const,
          content: narrative.throughline,
          coachName: 'Panel Synthesis',
          color: '#F0883E',
          timestamp: Date.now(),
          narrative,
        },
      ],
    })),
}))
