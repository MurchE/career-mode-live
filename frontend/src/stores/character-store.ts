import { create } from 'zustand'
import type { CharacterSheet, ConversationEntry, CoachResponse, NarrativeResponse, StoryboardPart } from '@/lib/api'
import type { StarElement } from '@/components/story-whiteboard'

interface PanelMessage {
  id: string
  type: 'user' | 'coach' | 'system' | 'narrative' | 'storyboard'
  content: string
  coachId?: string
  coachName?: string
  color?: string
  timestamp: number
  narrative?: NarrativeResponse
  storyboardParts?: StoryboardPart[]
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

  // Coach states (for avatar animations)
  thinkingCoachId: string | null
  coachStates: Record<string, 'idle' | 'thinking' | 'speaking'>

  // Gemini Live 1:1 session
  liveSessionCoachId: string | null

  // STAR Whiteboard
  starElements: StarElement[]

  // Actions
  setOnboarded: (sheet: CharacterSheet, flatMirror: string) => void
  resetOnboarding: () => void
  setCoachingPhase: (phase: string) => void
  addUserMessage: (content: string) => void
  addCoachResponses: (responses: CoachResponse[]) => void
  addSingleCoachResponse: (response: CoachResponse) => void
  setThinkingCoach: (coachId: string | null) => void
  setCoachState: (coachId: string, state: 'idle' | 'thinking' | 'speaking') => void
  incrementRound: () => void
  setLoading: (loading: boolean) => void
  updateCharacterSheet: (sheet: CharacterSheet) => void
  setNarrativeSynthesis: (narrative: NarrativeResponse) => void
  setStoryboard: (parts: StoryboardPart[]) => void
  addStarElements: (elements: StarElement[]) => void
  confirmStarElement: (id: string) => void
  setLiveSession: (coachId: string | null) => void
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
  thinkingCoachId: null,
  coachStates: { chad: 'idle', reeves: 'idle', viktor: 'idle' },
  liveSessionCoachId: null,
  starElements: [],

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
      starElements: [],
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

  addSingleCoachResponse: (response) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `${response.coach_id}-${Date.now()}`,
          type: 'coach' as const,
          content: response.response,
          coachId: response.coach_id,
          coachName: response.coach_name,
          color: response.color,
          timestamp: Date.now(),
        },
      ],
      conversationHistory: [
        ...state.conversationHistory,
        {
          role: 'assistant',
          content: response.response,
          coach_name: response.coach_name,
        },
      ],
    })),

  setThinkingCoach: (coachId) =>
    set((state) => ({
      thinkingCoachId: coachId,
      coachStates: {
        ...Object.fromEntries(Object.keys(state.coachStates).map(k => [k, 'idle' as const])),
        ...(coachId ? { [coachId]: 'thinking' as const } : {}),
      },
    })),

  setCoachState: (coachId, coachState) =>
    set((state) => ({
      coachStates: { ...state.coachStates, [coachId]: coachState },
    })),

  incrementRound: () =>
    set((state) => ({ roundCount: state.roundCount + 1 })),

  setLiveSession: (coachId) =>
    set({ liveSessionCoachId: coachId }),

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

  setStoryboard: (parts) =>
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: `storyboard-${Date.now()}`,
          type: 'storyboard' as const,
          content: 'Career Storyboard',
          coachName: 'Creative Director',
          color: '#7EE787',
          timestamp: Date.now(),
          storyboardParts: parts,
        },
      ],
    })),

  addStarElements: (elements) =>
    set((state) => {
      const existingIds = new Set(state.starElements.map((e) => e.id))
      const newElements = elements.filter((e) => !existingIds.has(e.id))
      if (newElements.length === 0) return state
      return { starElements: [...state.starElements, ...newElements] }
    }),

  confirmStarElement: (id) =>
    set((state) => ({
      starElements: state.starElements.map((e) =>
        e.id === id ? { ...e, confirmed: true } : e,
      ),
    })),
}))
