'use client'

import { useState, useRef, useEffect } from 'react'
import { runPanel } from '@/lib/api'
import { useCharacterStore } from '@/stores/character-store'
import { useVoice } from '@/hooks/use-voice'

const COACH_META: Record<string, { icon: string; title: string }> = {
  chad: { icon: 'C', title: 'The Roast Bro' },
  reeves: { icon: 'R', title: 'Depth Therapist' },
  viktor: { icon: 'V', title: 'Tech Savant' },
}

export function CoachingPanel() {
  const {
    messages,
    conversationHistory,
    characterSheet,
    coachingPhase,
    isLoading,
    addUserMessage,
    addCoachResponses,
    setLoading,
    setCoachingPhase,
  } = useCharacterStore()

  const [input, setInput] = useState('')
  const [displayedMessages, setDisplayedMessages] = useState(messages)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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
  useEffect(() => {
    if (messages.length > displayedMessages.length) {
      const newMessages = messages.slice(displayedMessages.length)

      // If they're coach messages, stagger them
      const coachMessages = newMessages.filter((m) => m.type === 'coach')
      const userMessages = newMessages.filter((m) => m.type === 'user')

      // Show user messages immediately
      if (userMessages.length > 0) {
        setDisplayedMessages((prev) => [...prev, ...userMessages])
      }

      // Stagger coach messages
      coachMessages.forEach((msg, i) => {
        setTimeout(
          () => {
            setDisplayedMessages((prev) => [...prev, msg])
          },
          (i + 1) * 800,
        )
      })
    }
  }, [messages, displayedMessages.length])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isLoading) return

    setInput('')
    addUserMessage(text)
    setLoading(true)

    // Determine phase — after first user message, switch to provocation
    let phase = coachingPhase
    if (coachingPhase === 'flat_mirror') {
      phase = 'provocation'
      setCoachingPhase('provocation')
    } else if (conversationHistory.length > 6) {
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

      if (result.suggested_phase) {
        setCoachingPhase(result.suggested_phase)
      }
    } catch (err) {
      console.error('Panel error:', err)
      addCoachResponses([
        {
          coach_id: 'system',
          coach_name: 'System',
          response: `Connection error. Make sure the backend is running on port 8000.`,
          color: '#FF7B72',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSpeak = (text: string) => {
    if (isSpeaking) {
      cancelSpeech()
    } else {
      speak(text)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Phase indicator */}
      <div className="px-6 py-2 border-b border-border bg-bg-secondary/50">
        <div className="flex items-center gap-4">
          {['flat_mirror', 'provocation', 'free_discussion'].map((phase) => (
            <div
              key={phase}
              className={`flex items-center gap-2 text-xs font-mono ${
                coachingPhase === phase ? 'text-accent-blue' : 'text-text-muted'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  coachingPhase === phase ? 'bg-accent-blue' : 'bg-bg-tertiary'
                }`}
              />
              {phase.replace('_', ' ')}
            </div>
          ))}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {/* Intro prompt if no messages yet beyond flat mirror */}
        {displayedMessages.length <= 1 && (
          <div className="text-center py-8 space-y-3">
            <p className="text-text-secondary text-sm">
              The panel generated a generic summary of your career above.
            </p>
            <p className="text-text-primary font-medium">
              What did they get wrong? Push back.
            </p>
            <p className="text-text-muted text-xs font-mono">
              (This is intentional -- the &quot;flat mirror&quot; is designed to provoke you.)
            </p>
          </div>
        )}

        {displayedMessages.map((msg) => (
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

                    {/* Read aloud button */}
                    {msg.coachId && msg.coachId !== 'system' && (
                      <button
                        onClick={() => handleSpeak(msg.content)}
                        className="mt-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
                      >
                        {isSpeaking ? 'Stop' : 'Read aloud'}
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
              Panel is conferring...
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
                  : 'Push back on the panel, share a story, or ask a question...'
              }
              rows={1}
              className="flex-1 px-4 py-3 rounded-xl bg-bg-tertiary border border-border text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent-blue transition-colors text-sm"
              style={{ maxHeight: '120px' }}
            />

            {/* Send button */}
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
            <span className="text-xs text-text-muted font-mono">
              {coachingPhase.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
