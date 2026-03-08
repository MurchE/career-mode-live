/**
 * API client for Career Mode Live backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface CoachResponse {
  coach_id: string
  coach_name: string
  response: string
  color: string
}

interface PanelResponse {
  responses: CoachResponse[]
  phase: string
  suggested_phase: string | null
}

interface OnboardingRequest {
  resume_text?: string
  name?: string
  title?: string
  years_experience?: number
  background?: string
}

interface OnboardingResponse {
  character_sheet: CharacterSheet
  flat_mirror: string
  parsed_data: Record<string, unknown>
}

interface CharacterSheet {
  suggested_allocation: Record<string, number>
  total_budget: number
  character_class: string
  primary_stat: string
  secondary_stat: string
  confidence: number
  name: string
  title: string
  years_experience: number
}

interface PanelRequest {
  user_input: string
  conversation_history: ConversationEntry[]
  character_sheet: CharacterSheet | null
  coaching_phase: string
}

interface ConversationEntry {
  role: string
  content: string
  coach_name?: string
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`API error ${res.status}: ${error}`)
  }

  return res.json()
}

export async function healthCheck(): Promise<{ status: string; version: string }> {
  const res = await fetch(`${API_BASE}/health`)
  return res.json()
}

export async function onboardUser(req: OnboardingRequest): Promise<OnboardingResponse> {
  return apiPost<OnboardingResponse>('/api/onboard', req)
}

export async function runPanel(req: PanelRequest): Promise<PanelResponse> {
  return apiPost<PanelResponse>('/api/coaching/panel', req)
}

// Narrative Synthesis — the payoff moment
interface NarrativeRequest {
  conversation_history: ConversationEntry[]
  character_sheet: CharacterSheet | null
}

interface NarrativeResponse {
  throughline: string
  evidence: string[]
  reframe: string
  positioning_statement: string
}

export async function synthesizeNarrative(req: NarrativeRequest): Promise<NarrativeResponse> {
  return apiPost<NarrativeResponse>('/api/coaching/synthesize', req)
}

// Text-to-Speech — returns audio blob
export async function getCoachTTS(text: string, coachId: string): Promise<Blob | null> {
  try {
    const res = await fetch(`${API_BASE}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, coach_id: coachId }),
    })
    if (!res.ok) return null
    return res.blob()
  } catch {
    return null
  }
}

export type {
  CoachResponse,
  PanelResponse,
  OnboardingRequest,
  OnboardingResponse,
  CharacterSheet,
  PanelRequest,
  ConversationEntry,
  NarrativeResponse,
}
