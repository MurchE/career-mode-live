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

// Career Storyboard — interleaved text + images (Creative Storyteller deliverable)
interface StoryboardRequest {
  narrative: NarrativeResponse
  conversation_history: ConversationEntry[]
  character_sheet: CharacterSheet | null
}

interface StoryboardPart {
  type: 'text' | 'image'
  content?: string
  data?: string
  mime_type?: string
}

interface StoryboardResponse {
  parts: StoryboardPart[]
}

export async function generateStoryboard(req: StoryboardRequest): Promise<StoryboardResponse> {
  return apiPost<StoryboardResponse>('/api/coaching/storyboard', req)
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

// STAR Element Extraction — live whiteboard
interface StarExtractionRequest {
  user_input: string
  conversation_history: ConversationEntry[]
  existing_elements: StarElementRaw[]
}

interface StarElementRaw {
  category: 'situation' | 'task' | 'action' | 'result'
  content: string
  coach_id: string
  coach_name: string
}

interface StarExtractionResponse {
  elements: StarElementRaw[]
}

export async function extractStarElements(
  req: StarExtractionRequest,
): Promise<StarExtractionResponse> {
  return apiPost<StarExtractionResponse>('/api/coaching/extract-star', req)
}

// Whiteboard — AI canvas analysis
interface WhiteboardAnalyzeRequest {
  image_base64: string
  canvas_width: number
  canvas_height: number
  context?: string
  existing_shapes?: number
}

interface WhiteboardAnalyzeResponse {
  shapes: Array<{
    type: string
    x: number
    y: number
    width?: number
    height?: number
    radius?: number
    toX?: number
    toY?: number
    content?: string
    fontSize?: number
    color: string
    strokeWidth?: number
    fill?: string
    label?: string
  }>
  voice_response: string
}

export async function analyzeWhiteboard(
  req: WhiteboardAnalyzeRequest,
): Promise<WhiteboardAnalyzeResponse> {
  return apiPost<WhiteboardAnalyzeResponse>('/api/whiteboard/analyze', req)
}

// Live API config — get Gemini API key for client-side WebSocket
interface LiveConfig {
  api_key: string
  model: string
  voices: string[]
}

export async function getLiveConfig(): Promise<LiveConfig | null> {
  try {
    const res = await fetch(`${API_BASE}/api/live/config`)
    if (!res.ok) return null
    return res.json()
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
  StoryboardPart,
  StoryboardResponse,
  StarExtractionRequest,
  StarElementRaw,
  StarExtractionResponse,
}
