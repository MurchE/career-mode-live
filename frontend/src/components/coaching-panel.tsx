'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { streamPanel, synthesizeNarrative, generateStoryboard, extractStarElements, getCoaches } from '@/lib/api'
import type { CoachMeta } from '@/lib/api'
import { useCharacterStore } from '@/stores/character-store'
import { useVoice } from '@/hooks/use-voice'
import { useAutoTTS } from '@/hooks/use-auto-tts'
import { LiveSessionOverlay } from '@/components/live-session-overlay'

const COACHES = [
  { id: 'chad', name: 'Chad', title: 'The Roast Bro', color: '#FF7B72', icon: 'C' },
  { id: 'reeves', name: 'Dr. Reeves', title: 'Depth Therapist', color: '#BC8CFF', icon: 'R' },
  { id: 'viktor', name: 'Viktor', title: 'Tech Savant', color: '#79C0FF', icon: 'V' },
]

const PHASE_LABELS: Record<string, string> = {
  flat_mirror: 'Career Mirror',
  provocation: 'Provocation',
  free_discussion: 'Deep Dive',
  synthesis: 'Synthesis',
}

export function CoachingPanel() {
  const {
    messages,
    conversationHistory,
    characterSheet,
    flatMirror,
    coachingPhase,
    isLoading,
    roundCount,
    narrativeSynthesis,
    thinkingCoachId,
    coachStates,
    addUserMessage,
    addCoachResponses,
    addSingleCoachResponse,
    setThinkingCoach,
    setCoachState,
    incrementRound,
    setLoading,
    setCoachingPhase,
    setNarrativeSynthesis,
    setStoryboard,
    starElements,
    addStarElements,
    setLiveSession,
  } = useCharacterStore()

  const [input, setInput] = useState('')
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false)
  const [activeSessionCoach, setActiveSessionCoach] = useState<string | null>(null)
  const [coachMeta, setCoachMeta] = useState<Record<string, CoachMeta>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Fetch coach metadata (voices, system prompts) on mount
  useEffect(() => {
    getCoaches()
      .then((coaches) => {
        const meta: Record<string, CoachMeta> = {}
        for (const c of coaches) {
          meta[c.id] = c
        }
        setCoachMeta(meta)
      })
      .catch((err) => console.error('Failed to fetch coaches:', err))
  }, [])

  // Auto-TTS
  const { enqueue: enqueueTTS, currentlyPlaying, isMuted, toggleMute, stop: stopTTS } = useAutoTTS()

  // Update coach states based on TTS playback
  useEffect(() => {
    for (const coach of COACHES) {
      if (currentlyPlaying === coach.id) {
        setCoachState(coach.id, 'speaking')
      } else if (thinkingCoachId === coach.id) {
        setCoachState(coach.id, 'thinking')
      } else {
        setCoachState(coach.id, 'idle')
      }
    }
  }, [currentlyPlaying, thinkingCoachId, setCoachState])

  // Voice hook
  const { isListening, isSupported, interimTranscript, toggleListening } = useVoice({
    onResult: (transcript) => {
      setInput(transcript)
    },
  })

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')
    addUserMessage(text)
    setLoading(true)

    // Determine phase
    let phase = coachingPhase
    if (coachingPhase === 'flat_mirror') {
      phase = 'provocation'
      setCoachingPhase('provocation')
    } else if (conversationHistory.length > 8) {
      phase = 'free_discussion'
      setCoachingPhase('free_discussion')
    }

    // Stream responses via SSE
    await streamPanel(
      {
        user_input: text,
        conversation_history: conversationHistory,
        character_sheet: characterSheet,
        coaching_phase: phase,
      },
      {
        onThinking: (coachId) => {
          setThinkingCoach(coachId)
        },
        onCoachResponse: (response) => {
          setThinkingCoach(null)
          addSingleCoachResponse(response)
          // Auto-play TTS for this coach
          enqueueTTS(response.response, response.coach_id)
        },
        onDone: (suggestedPhase) => {
          setThinkingCoach(null)
          incrementRound()
          setLoading(false)
          if (suggestedPhase) {
            setCoachingPhase(suggestedPhase)
          }
        },
        onError: (error) => {
          console.error('Stream error:', error)
          setThinkingCoach(null)
          setLoading(false)
          addSingleCoachResponse({
            coach_id: 'system',
            coach_name: 'System',
            response: 'Connection error. Make sure the backend is running on port 8000.',
            color: '#FF7B72',
          })
        },
      },
    )

    // Extract STAR elements in background
    extractStarElements({
      user_input: text,
      conversation_history: conversationHistory,
      existing_elements: starElements.map((e) => ({
        category: e.category,
        content: e.content,
        coach_id: e.coach_id,
        coach_name: e.coach_name,
      })),
    })
      .then((starResult) => {
        if (starResult.elements.length > 0) {
          addStarElements(
            starResult.elements.map((e) => ({
              ...e,
              id: `star-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              confirmed: false,
              timestamp: Date.now(),
            })),
          )
        }
      })
      .catch((err) => console.error('STAR extraction error:', err))
  }

  const handleSynthesize = async () => {
    if (isSynthesizing || conversationHistory.length < 4) return
    setIsSynthesizing(true)
    setLoading(true)

    try {
      const result = await synthesizeNarrative({
        conversation_history: conversationHistory,
        character_sheet: characterSheet,
      })
      setNarrativeSynthesis(result)
      setCoachingPhase('synthesis')
    } catch (err) {
      console.error('Synthesis error:', err)
    } finally {
      setIsSynthesizing(false)
      setLoading(false)
    }
  }

  const handleGenerateStoryboard = async () => {
    if (isGeneratingStoryboard || !narrativeSynthesis) return
    setIsGeneratingStoryboard(true)
    setLoading(true)

    try {
      const result = await generateStoryboard({
        narrative: narrativeSynthesis,
        conversation_history: conversationHistory,
        character_sheet: characterSheet,
      })
      setStoryboard(result.parts)
    } catch (err) {
      console.error('Storyboard error:', err)
    } finally {
      setIsGeneratingStoryboard(false)
      setLoading(false)
    }
  }

  const handleCoachClick = (coachId: string) => {
    setActiveSessionCoach(coachId)
    setLiveSession(coachId)
  }

  const handleSessionClose = useCallback((sessionTranscript: string[]) => {
    const coachId = activeSessionCoach
    if (coachId && sessionTranscript.length > 0) {
      const coach = COACHES.find(c => c.id === coachId)
      // Add session summary to panel messages
      const summary = sessionTranscript.join('\n\n')
      addSingleCoachResponse({
        coach_id: coachId,
        coach_name: coach?.name || 'Coach',
        response: `[1:1 Session Notes]\n${summary}`,
        color: coach?.color || '#58A6FF',
      })
    }
    setActiveSessionCoach(null)
    setLiveSession(null)
  }, [activeSessionCoach, addSingleCoachResponse, setLiveSession])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSynthesize = roundCount >= 2 && !narrativeSynthesis && !isLoading

  return (
    <div className="flex flex-col h-full">
      {/* Phase indicator — sticky at top */}
      <div className="px-6 py-2 border-b border-border bg-bg-secondary/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {['flat_mirror', 'provocation', 'free_discussion', 'synthesis'].map((phase) => (
              <div
                key={phase}
                className={`flex items-center gap-2 text-xs font-mono transition-colors ${
                  coachingPhase === phase ? 'text-accent-blue' : 'text-text-muted'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full transition-colors ${
                    coachingPhase === phase ? 'bg-accent-blue' : 'bg-bg-tertiary'
                  }`}
                />
                {PHASE_LABELS[phase] || phase}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {/* Mute toggle */}
            <button
              onClick={toggleMute}
              className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
                isMuted ? 'text-text-muted' : 'text-text-secondary'
              }`}
              title={isMuted ? 'Unmute auto-play' : 'Mute auto-play'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isMuted ? (
                  <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </>
                ) : (
                  <>
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
                  </>
                )}
              </svg>
            </button>

            {/* Synthesis button */}
            {canSynthesize && (
              <button
                onClick={handleSynthesize}
                className="px-3 py-1 text-xs font-mono rounded-full bg-[#F0883E]/15 text-[#F0883E] border border-[#F0883E]/30 hover:bg-[#F0883E]/25 transition-colors synthesize-pulse"
              >
                Synthesize Throughline
              </button>
            )}

            {/* Storyboard button */}
            {narrativeSynthesis && !isGeneratingStoryboard && (
              <button
                onClick={handleGenerateStoryboard}
                disabled={isLoading}
                className="px-3 py-1 text-xs font-mono rounded-full bg-[#7EE787]/15 text-[#7EE787] border border-[#7EE787]/30 hover:bg-[#7EE787]/25 transition-colors disabled:opacity-30"
              >
                Generate Career Story
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Coach Avatar Panel ═══ */}
      <div className="px-6 py-4 border-b border-border bg-bg-primary/50">
        <div className="flex justify-center gap-8">
          {COACHES.map((coach) => {
            const state = coachStates[coach.id] || 'idle'
            return (
              <button
                key={coach.id}
                onClick={() => handleCoachClick(coach.id)}
                className="flex flex-col items-center gap-2 group transition-all"
                title={`${coach.name} — click for 1:1 voice session`}
              >
                {/* Avatar circle with state animations */}
                <div className="relative">
                  {/* Glow ring for speaking */}
                  {state === 'speaking' && (
                    <div
                      className="absolute -inset-2 rounded-full animate-pulse"
                      style={{
                        background: `radial-gradient(circle, ${coach.color}40 0%, transparent 70%)`,
                      }}
                    />
                  )}
                  {/* Thinking ring */}
                  {state === 'thinking' && (
                    <div
                      className="absolute -inset-1 rounded-full"
                      style={{
                        border: `2px dashed ${coach.color}60`,
                        animation: 'spin 3s linear infinite',
                      }}
                    />
                  )}
                  <div
                    className={`relative w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg border-2 transition-all ${
                      state === 'speaking'
                        ? 'scale-110'
                        : state === 'thinking'
                        ? 'scale-105'
                        : 'group-hover:scale-105'
                    }`}
                    style={{
                      color: coach.color,
                      borderColor: state !== 'idle' ? coach.color : `${coach.color}60`,
                      backgroundColor: `${coach.color}${state === 'speaking' ? '25' : '10'}`,
                    }}
                  >
                    {coach.icon}

                    {/* Speaking indicator — sound waves */}
                    {state === 'speaking' && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        <div className="w-0.5 h-2 rounded-full animate-bounce" style={{ backgroundColor: coach.color, animationDelay: '0ms' }} />
                        <div className="w-0.5 h-3 rounded-full animate-bounce" style={{ backgroundColor: coach.color, animationDelay: '150ms' }} />
                        <div className="w-0.5 h-2 rounded-full animate-bounce" style={{ backgroundColor: coach.color, animationDelay: '300ms' }} />
                      </div>
                    )}

                    {/* Thinking indicator — dots */}
                    {state === 'thinking' && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                        <div className="w-1 h-1 rounded-full typing-dot" style={{ backgroundColor: coach.color }} />
                        <div className="w-1 h-1 rounded-full typing-dot" style={{ backgroundColor: coach.color }} />
                        <div className="w-1 h-1 rounded-full typing-dot" style={{ backgroundColor: coach.color }} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Name and title */}
                <div className="text-center">
                  <div
                    className={`text-xs font-semibold transition-colors ${
                      state !== 'idle' ? '' : 'group-hover:opacity-100 opacity-80'
                    }`}
                    style={{ color: coach.color }}
                  >
                    {coach.name}
                  </div>
                  <div className="text-[10px] text-text-muted">{coach.title}</div>
                  <div className="text-[9px] text-text-muted opacity-0 group-hover:opacity-70 transition-opacity mt-0.5">
                    click for 1:1 voice
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ═══ Messages area ═══ */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Flat Mirror Card */}
        {flatMirror && (
          <div className="max-w-2xl mx-auto mb-6">
            <div className="rounded-xl border-2 border-[#58A6FF]/30 bg-[#58A6FF]/05 p-6 relative overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded bg-[#58A6FF]/20 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#58A6FF" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <span className="text-xs font-mono text-[#58A6FF] uppercase tracking-wider">
                  Career Summary Report
                </span>
                <span className="text-xs text-text-muted ml-auto font-mono">auto-generated</span>
              </div>
              <p className="text-text-primary text-sm leading-relaxed italic">
                &ldquo;{flatMirror}&rdquo;
              </p>
              <div className="mt-4 pt-3 border-t border-[#58A6FF]/20">
                <p className="text-xs text-text-muted">
                  This summary was <span className="text-[#F0883E]">deliberately generic</span>.
                  The panel wants to know: <span className="text-text-primary font-medium">what did they get wrong?</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.filter(m => m.id !== 'flat-mirror').map((msg) => (
          <div
            key={msg.id}
            className={`speech-bubble-enter ${msg.type === 'user' ? 'flex justify-end' : ''}`}
          >
            {msg.type === 'user' ? (
              <div className="max-w-xl">
                <div className="px-4 py-3 rounded-2xl rounded-br-sm bg-accent-blue/10 border border-accent-blue/20">
                  <p className="text-text-primary text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
                <div className="text-right mt-1">
                  <span className="text-xs text-text-muted">You</span>
                </div>
              </div>
            ) : msg.type === 'narrative' ? (
              <NarrativeCard msg={msg} />
            ) : msg.type === 'storyboard' ? (
              <StoryboardCard msg={msg} />
            ) : (
              /* Coach message */
              <div className="max-w-2xl">
                <div className="flex items-start gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 border-2"
                    style={{
                      color: msg.color || '#58A6FF',
                      borderColor: msg.color || '#58A6FF',
                      backgroundColor: `${msg.color || '#58A6FF'}15`,
                    }}
                  >
                    {COACHES.find(c => c.id === msg.coachId)?.icon || 'P'}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold" style={{ color: msg.color || '#58A6FF' }}>
                        {msg.coachName || 'Panel'}
                      </span>
                      {msg.coachId && COACHES.find(c => c.id === msg.coachId) && (
                        <span className="text-xs text-text-muted">
                          {COACHES.find(c => c.id === msg.coachId)!.title}
                        </span>
                      )}
                      {currentlyPlaying === msg.coachId && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent-green/20 text-accent-green">
                          speaking
                        </span>
                      )}
                    </div>

                    <div
                      className="px-4 py-3 rounded-2xl rounded-tl-sm border"
                      style={{
                        borderColor: `${msg.color || '#58A6FF'}30`,
                        backgroundColor: `${msg.color || '#58A6FF'}08`,
                      }}
                    >
                      <p className="text-text-primary text-sm whitespace-pre-wrap leading-relaxed">
                        {msg.content.replace(/^[""]|[""]$/g, '')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Thinking indicator */}
        {thinkingCoachId && (
          <div className="flex items-start gap-3 speech-bubble-enter">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border-2"
              style={{
                color: COACHES.find(c => c.id === thinkingCoachId)?.color || '#58A6FF',
                borderColor: COACHES.find(c => c.id === thinkingCoachId)?.color || '#58A6FF',
                backgroundColor: `${COACHES.find(c => c.id === thinkingCoachId)?.color || '#58A6FF'}15`,
              }}
            >
              {COACHES.find(c => c.id === thinkingCoachId)?.icon || '?'}
            </div>
            <div className="text-sm text-text-muted pt-2 font-mono flex items-center gap-2">
              <span style={{ color: COACHES.find(c => c.id === thinkingCoachId)?.color }}>
                {COACHES.find(c => c.id === thinkingCoachId)?.name}
              </span>
              <span>is thinking</span>
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-text-muted typing-dot" />
                <span className="w-1.5 h-1.5 rounded-full bg-text-muted typing-dot" />
                <span className="w-1.5 h-1.5 rounded-full bg-text-muted typing-dot" />
              </span>
            </div>
          </div>
        )}

        {/* General loading */}
        {isLoading && !thinkingCoachId && (
          <div className="flex items-start gap-3 speech-bubble-enter">
            <div className="w-9 h-9 rounded-full bg-bg-tertiary border-2 border-border flex items-center justify-center">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-text-muted typing-dot" />
                <div className="w-1.5 h-1.5 rounded-full bg-text-muted typing-dot" />
                <div className="w-1.5 h-1.5 rounded-full bg-text-muted typing-dot" />
              </div>
            </div>
            <div className="text-sm text-text-muted pt-2 font-mono">
              {isGeneratingStoryboard ? 'Creating your career storyboard...' : isSynthesizing ? 'Synthesizing career throughline...' : 'Panel is conferring...'}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ═══ Input area ═══ */}
      <div className="border-t border-border p-4 bg-bg-secondary/30">
        <div className="max-w-3xl mx-auto">
          {interimTranscript && (
            <div className="mb-2 px-3 py-1 rounded bg-bg-tertiary text-sm text-text-secondary italic">
              {interimTranscript}...
            </div>
          )}

          <div className="flex items-end gap-3">
            {isSupported && (
              <button
                onClick={toggleListening}
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all relative ${
                  isListening
                    ? 'bg-accent-red text-bg-primary'
                    : 'bg-bg-tertiary text-text-secondary hover:text-text-primary hover:bg-border'
                }`}
              >
                {isListening && (
                  <div className="absolute inset-0 rounded-full bg-accent-red/30 pulse-ring" />
                )}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
                  <path d="M19 10v2a7 7 0 01-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
            )}

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening
                  ? 'Listening...'
                  : coachingPhase === 'flat_mirror'
                    ? 'Tell the panel what they got wrong about your career...'
                    : 'Share a story, push back, or answer their question...'
              }
              rows={1}
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-xl bg-bg-tertiary border border-border text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent-blue transition-colors text-sm disabled:opacity-50"
              style={{ maxHeight: '120px' }}
            />

            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-accent-blue text-bg-primary flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-between mt-2 px-1">
            <span className="text-xs text-text-muted">
              Press Enter to send, Shift+Enter for new line
            </span>
            <div className="flex items-center gap-3">
              {roundCount > 0 && (
                <span className="text-xs text-text-muted font-mono">
                  Round {roundCount}
                </span>
              )}
              <span className="text-xs text-text-muted font-mono">
                {PHASE_LABELS[coachingPhase] || coachingPhase}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Live 1:1 Session Overlay ═══ */}
      {activeSessionCoach && (() => {
        const coach = COACHES.find(c => c.id === activeSessionCoach)
        const meta = coachMeta[activeSessionCoach]
        if (!coach) return null
        return (
          <LiveSessionOverlay
            coachId={coach.id}
            coachName={coach.name}
            coachTitle={coach.title}
            coachColor={coach.color}
            coachIcon={coach.icon}
            voiceName={meta?.voice || 'Kore'}
            systemPrompt={meta?.system_prompt || ''}
            onClose={handleSessionClose}
          />
        )
      })()}
    </div>
  )
}


// ─── Sub-components ──────────────────────────────────────────────────────────

function NarrativeCard({ msg }: { msg: { narrative?: { throughline: string; evidence: string[]; reframe: string; positioning_statement: string; power_bullets?: string[]; target_roles?: { role: string; why: string }[] } } }) {
  if (!msg.narrative) return null
  const n = msg.narrative
  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-xl border-2 border-[#F0883E]/40 bg-[#F0883E]/05 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-full bg-[#F0883E]/20 flex items-center justify-center text-[#F0883E] font-bold text-sm">T</div>
          <span className="text-sm font-semibold text-[#F0883E]">Career Throughline</span>
          <span className="text-xs text-text-muted ml-auto font-mono">panel synthesis</span>
        </div>
        <p className="text-text-primary text-base font-medium leading-relaxed mb-4">&ldquo;{n.throughline}&rdquo;</p>
        {n.evidence.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-mono text-text-muted uppercase tracking-wider mb-2">Evidence</p>
            <ul className="space-y-1.5">
              {n.evidence.map((e, i) => (
                <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                  <span className="text-[#F0883E] mt-0.5">&#x2022;</span><span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="bg-[#F0883E]/10 rounded-lg p-4 mb-4">
          <p className="text-sm text-text-primary leading-relaxed">{n.reframe}</p>
        </div>
        {n.power_bullets && n.power_bullets.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-mono text-text-muted uppercase tracking-wider mb-2">Resume-Ready Bullets</p>
            <ul className="space-y-2">
              {n.power_bullets.map((bullet, i) => (
                <li key={i} className="text-sm text-text-primary flex items-start gap-2 bg-bg-secondary/50 rounded-lg p-2.5 border border-border">
                  <span className="text-[#7EE787] mt-0.5 flex-shrink-0">&#x2713;</span><span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {n.target_roles && n.target_roles.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-mono text-text-muted uppercase tracking-wider mb-2">Where This Is a Superpower</p>
            <div className="space-y-2">
              {n.target_roles.map((tr, i) => (
                <div key={i} className="text-sm flex items-start gap-2">
                  <span className="text-[#58A6FF] font-medium flex-shrink-0">{tr.role}</span>
                  <span className="text-text-muted">—</span>
                  <span className="text-text-secondary">{tr.why}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {n.positioning_statement && (
          <div className="border-t border-[#F0883E]/20 pt-3">
            <p className="text-xs font-mono text-text-muted uppercase tracking-wider mb-1">Your Story, In Your Voice</p>
            <p className="text-sm text-text-primary italic leading-relaxed">{n.positioning_statement}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StoryboardCard({ msg }: { msg: { storyboardParts?: { type: string; content?: string; data?: string; mime_type?: string }[] } }) {
  if (!msg.storyboardParts) return null
  return (
    <div className="max-w-3xl mx-auto">
      <div className="rounded-xl border-2 border-[#7EE787]/40 bg-[#7EE787]/05 p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-7 h-7 rounded-full bg-[#7EE787]/20 flex items-center justify-center text-[#7EE787] font-bold text-sm">S</div>
          <span className="text-sm font-semibold text-[#7EE787]">Career Storyboard</span>
          <span className="text-xs text-text-muted ml-auto font-mono">powered by Gemini</span>
        </div>
        <div className="space-y-6">
          {msg.storyboardParts.map((part, i) => (
            <div key={i}>
              {part.type === 'text' && part.content && (
                <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">{part.content}</p>
              )}
              {part.type === 'image' && part.data && (
                <div className="rounded-lg overflow-hidden border border-border">
                  <img src={`data:${part.mime_type || 'image/png'};base64,${part.data}`} alt={`Career story ${i}`} className="w-full h-auto" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
