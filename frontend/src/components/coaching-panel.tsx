'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { runPanel, synthesizeNarrative, getCoachTTS, generateStoryboard, extractStarElements } from '@/lib/api'
import { useCharacterStore } from '@/stores/character-store'
import { useVoice } from '@/hooks/use-voice'

const COACH_META: Record<string, { icon: string; title: string }> = {
  chad: { icon: 'C', title: 'The Roast Bro' },
  reeves: { icon: 'R', title: 'Depth Therapist' },
  viktor: { icon: 'V', title: 'Tech Savant' },
}

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
    addUserMessage,
    addCoachResponses,
    setLoading,
    setCoachingPhase,
    setNarrativeSynthesis,
    setStoryboard,
    starElements,
    addStarElements,
    confirmStarElement,
  } = useCharacterStore()

  const [input, setInput] = useState('')
  const [displayedMessages, setDisplayedMessages] = useState(messages)
  const [isStaggering, setIsStaggering] = useState(false)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Voice hook
  const { isListening, isSupported, interimTranscript, toggleListening, speak, isSpeaking, cancelSpeech } = useVoice({
    onResult: (transcript) => {
      setInput(transcript)
    },
  })

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayedMessages])

  // Stagger coach responses for panel discussion feel
  const lastProcessedRef = useRef(0)
  const staggerTimersRef = useRef<NodeJS.Timeout[]>([])
  useEffect(() => {
    if (messages.length > lastProcessedRef.current) {
      const newMessages = messages.slice(lastProcessedRef.current)
      lastProcessedRef.current = messages.length

      const coachMessages = newMessages.filter((m) => m.type === 'coach')
      const otherMessages = newMessages.filter((m) => m.type !== 'coach')

      // Show non-coach messages immediately
      if (otherMessages.length > 0) {
        setDisplayedMessages((prev) => [...prev, ...otherMessages])
      }

      // Stagger coach messages — use functional updates to avoid stale closures
      if (coachMessages.length > 0) {
        setIsStaggering(true)
        // Clear any existing timers
        staggerTimersRef.current.forEach(clearTimeout)
        staggerTimersRef.current = []

        coachMessages.forEach((msg, i) => {
          const timer = setTimeout(
            () => {
              setDisplayedMessages((prev) => {
                // Deduplicate: only add if not already present
                if (prev.some((m) => m.id === msg.id)) return prev
                return [...prev, msg]
              })
              if (i === coachMessages.length - 1) {
                setIsStaggering(false)
              }
            },
            (i + 1) * 800,
          )
          staggerTimersRef.current.push(timer)
        })
      }
    }
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading || isStaggering) return

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

    try {
      const result = await runPanel({
        user_input: text,
        conversation_history: conversationHistory,
        character_sheet: characterSheet,
        coaching_phase: phase,
      })

      addCoachResponses(result.responses)

      // Extract STAR elements in background (non-blocking)
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
        .catch((err) => console.error('STAR extraction error (non-blocking):', err))

      if (result.suggested_phase) {
        setCoachingPhase(result.suggested_phase)
      }
    } catch (err) {
      console.error('Panel error:', err)
      addCoachResponses([
        {
          coach_id: 'system',
          coach_name: 'System',
          response: 'Connection error. Make sure the backend is running on port 8000.',
          color: '#FF7B72',
        },
      ])
    } finally {
      setLoading(false)
    }
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

  const handlePlayTTS = useCallback(async (text: string, coachId: string) => {
    if (playingAudio === coachId) {
      audioRef.current?.pause()
      setPlayingAudio(null)
      return
    }

    setPlayingAudio(coachId)
    const blob = await getCoachTTS(text, coachId)
    if (blob) {
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        setPlayingAudio(null)
        URL.revokeObjectURL(url)
      }
      audio.onerror = () => {
        setPlayingAudio(null)
        // Fallback to browser TTS
        speak(text)
      }
      audio.play()
    } else {
      // Fallback to browser TTS
      speak(text)
      setPlayingAudio(null)
    }
  }, [playingAudio, speak])

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
            {/* Synthesis button */}
            {canSynthesize && (
              <button
                onClick={handleSynthesize}
                className="px-3 py-1 text-xs font-mono rounded-full bg-[#F0883E]/15 text-[#F0883E] border border-[#F0883E]/30 hover:bg-[#F0883E]/25 transition-colors synthesize-pulse"
              >
                Synthesize Throughline
              </button>
            )}

            {/* Storyboard button — appears after synthesis */}
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

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Flat Mirror Card — visually distinct from chat */}
        {flatMirror && displayedMessages.length > 0 && (
          <div className="max-w-2xl mx-auto mb-6">
            <div className="rounded-xl border-2 border-[#58A6FF]/30 bg-[#58A6FF]/05 p-6 relative overflow-hidden">
              {/* Header */}
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
                <span className="text-xs text-text-muted ml-auto font-mono">
                  auto-generated
                </span>
              </div>

              {/* The deliberately generic summary */}
              <p className="text-text-primary text-sm leading-relaxed italic">
                &ldquo;{flatMirror}&rdquo;
              </p>

              {/* Provocation prompt */}
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
        {displayedMessages.filter(m => m.id !== 'flat-mirror').map((msg) => (
          <div
            key={msg.id}
            className={`speech-bubble-enter ${
              msg.type === 'user' ? 'flex justify-end' : ''
            }`}
          >
            {msg.type === 'user' ? (
              /* User message */
              <div className="max-w-xl">
                <div className="px-4 py-3 rounded-2xl rounded-br-sm bg-accent-blue/10 border border-accent-blue/20">
                  <p className="text-text-primary text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
                <div className="text-right mt-1">
                  <span className="text-xs text-text-muted">You</span>
                </div>
              </div>
            ) : msg.type === 'narrative' ? (
              /* Narrative synthesis card */
              <div className="max-w-2xl mx-auto">
                <div className="rounded-xl border-2 border-[#F0883E]/40 bg-[#F0883E]/05 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-full bg-[#F0883E]/20 flex items-center justify-center text-[#F0883E] font-bold text-sm">
                      T
                    </div>
                    <span className="text-sm font-semibold text-[#F0883E]">
                      Career Throughline
                    </span>
                    <span className="text-xs text-text-muted ml-auto font-mono">
                      panel synthesis
                    </span>
                  </div>

                  {msg.narrative && (
                    <>
                      {/* Throughline */}
                      <p className="text-text-primary text-base font-medium leading-relaxed mb-4">
                        &ldquo;{msg.narrative.throughline}&rdquo;
                      </p>

                      {/* Evidence */}
                      {msg.narrative.evidence.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-mono text-text-muted uppercase tracking-wider mb-2">Evidence</p>
                          <ul className="space-y-1.5">
                            {msg.narrative.evidence.map((e, i) => (
                              <li key={i} className="text-sm text-text-secondary flex items-start gap-2">
                                <span className="text-[#F0883E] mt-0.5">&#x2022;</span>
                                <span>{e}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Reframe */}
                      <div className="bg-[#F0883E]/10 rounded-lg p-4 mb-4">
                        <p className="text-sm text-text-primary leading-relaxed">
                          {msg.narrative.reframe}
                        </p>
                      </div>

                      {/* Power bullets */}
                      {msg.narrative.power_bullets && msg.narrative.power_bullets.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-mono text-text-muted uppercase tracking-wider mb-2">Resume-Ready Bullets</p>
                          <ul className="space-y-2">
                            {msg.narrative.power_bullets.map((bullet: string, i: number) => (
                              <li key={i} className="text-sm text-text-primary flex items-start gap-2 bg-bg-secondary/50 rounded-lg p-2.5 border border-border">
                                <span className="text-[#7EE787] mt-0.5 flex-shrink-0">&#x2713;</span>
                                <span>{bullet}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Target roles */}
                      {msg.narrative.target_roles && msg.narrative.target_roles.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-mono text-text-muted uppercase tracking-wider mb-2">Where This Is a Superpower</p>
                          <div className="space-y-2">
                            {msg.narrative.target_roles.map((tr: { role: string; why: string }, i: number) => (
                              <div key={i} className="text-sm flex items-start gap-2">
                                <span className="text-[#58A6FF] font-medium flex-shrink-0">{tr.role}</span>
                                <span className="text-text-muted">—</span>
                                <span className="text-text-secondary">{tr.why}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Positioning statement */}
                      {msg.narrative.positioning_statement && (
                        <div className="border-t border-[#F0883E]/20 pt-3">
                          <p className="text-xs font-mono text-text-muted uppercase tracking-wider mb-1">
                            Your Story, In Your Voice
                          </p>
                          <p className="text-sm text-text-primary italic leading-relaxed">
                            {msg.narrative.positioning_statement}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : msg.type === 'storyboard' ? (
              /* Career Storyboard — interleaved text + images */
              <div className="max-w-3xl mx-auto">
                <div className="rounded-xl border-2 border-[#7EE787]/40 bg-[#7EE787]/05 p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-7 h-7 rounded-full bg-[#7EE787]/20 flex items-center justify-center text-[#7EE787] font-bold text-sm">
                      S
                    </div>
                    <span className="text-sm font-semibold text-[#7EE787]">
                      Career Storyboard
                    </span>
                    <span className="text-xs text-text-muted ml-auto font-mono">
                      powered by Gemini interleaved output
                    </span>
                  </div>

                  <div className="space-y-6">
                    {msg.storyboardParts?.map((part, i) => (
                      <div key={i}>
                        {part.type === 'text' && part.content && (
                          <p className="text-text-primary text-sm leading-relaxed whitespace-pre-wrap">
                            {part.content}
                          </p>
                        )}
                        {part.type === 'image' && part.data && (
                          <div className="rounded-lg overflow-hidden border border-border">
                            <img
                              src={`data:${part.mime_type || 'image/png'};base64,${part.data}`}
                              alt={`Career story illustration ${i + 1}`}
                              className="w-full h-auto"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* Coach message */
              <div className="max-w-2xl">
                <div className="flex items-start gap-3">
                  {/* Coach avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 border-2"
                    style={{
                      color: msg.color || '#58A6FF',
                      borderColor: msg.color || '#58A6FF',
                      backgroundColor: `${msg.color || '#58A6FF'}15`,
                    }}
                  >
                    {msg.coachId && COACH_META[msg.coachId]
                      ? COACH_META[msg.coachId].icon
                      : 'P'}
                  </div>

                  <div className="flex-1">
                    {/* Coach name */}
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: msg.color || '#58A6FF' }}
                      >
                        {msg.coachName || 'Panel'}
                      </span>
                      {msg.coachId && COACH_META[msg.coachId] && (
                        <span className="text-xs text-text-muted">
                          {COACH_META[msg.coachId].title}
                        </span>
                      )}
                    </div>

                    {/* Speech bubble */}
                    <div
                      className="px-4 py-3 rounded-2xl rounded-tl-sm border"
                      style={{
                        borderColor: `${msg.color || '#58A6FF'}30`,
                        backgroundColor: `${msg.color || '#58A6FF'}08`,
                      }}
                    >
                      <p className="text-text-primary text-sm whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                      </p>
                    </div>

                    {/* TTS button */}
                    {msg.coachId && msg.coachId !== 'system' && (
                      <button
                        onClick={() => handlePlayTTS(msg.content, msg.coachId!)}
                        className="mt-1 text-xs text-text-muted hover:text-text-secondary transition-colors flex items-center gap-1"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          {playingAudio === msg.coachId ? (
                            <>
                              <rect x="6" y="4" width="4" height="16" />
                              <rect x="14" y="4" width="4" height="16" />
                            </>
                          ) : (
                            <polygon points="5 3 19 12 5 21 5 3" />
                          )}
                        </svg>
                        {playingAudio === msg.coachId ? 'Stop' : 'Listen'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
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

      {/* Input area */}
      <div className="border-t border-border p-4 bg-bg-secondary/30">
        <div className="max-w-3xl mx-auto">
          {/* Voice interim transcript */}
          {interimTranscript && (
            <div className="mb-2 px-3 py-1 rounded bg-bg-tertiary text-sm text-text-secondary italic">
              {interimTranscript}...
            </div>
          )}

          <div className="flex items-end gap-3">
            {/* Voice button */}
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

            {/* Text input */}
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
              disabled={isLoading || isStaggering}
              className="flex-1 px-4 py-3 rounded-xl bg-bg-tertiary border border-border text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent-blue transition-colors text-sm disabled:opacity-50"
              style={{ maxHeight: '120px' }}
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading || isStaggering}
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
    </div>
  )
}
