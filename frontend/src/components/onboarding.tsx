'use client'

import { useState } from 'react'
import { onboardUser } from '@/lib/api'
import { useCharacterStore } from '@/stores/character-store'

export function Onboarding() {
  const { setOnboarded } = useCharacterStore()
  const [mode, setMode] = useState<'choice' | 'resume' | 'manual'>('choice')
  const [resumeText, setResumeText] = useState('')
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [yearsExp, setYearsExp] = useState('')
  const [background, setBackground] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setIsLoading(true)
    setError('')

    try {
      const result = await onboardUser({
        resume_text: resumeText || undefined,
        name: name || undefined,
        title: title || undefined,
        years_experience: yearsExp ? parseInt(yearsExp) : undefined,
        background: background || undefined,
      })

      setOnboarded(result.character_sheet, result.flat_mirror)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to backend')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full space-y-8">
        {/* Logo / Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-bg-secondary border border-border">
            <div className="w-3 h-3 rounded-full bg-accent-green animate-pulse" />
            <span className="text-sm text-text-secondary font-mono">Panel Ready</span>
          </div>

          <h1 className="text-4xl font-bold">
            Career Mode <span className="text-accent-blue">Live</span>
          </h1>
          <p className="text-text-secondary text-lg max-w-lg mx-auto">
            Three AI coaches. One hot seat. They&apos;ll listen, debate each other,
            and provoke you into discovering what makes your career story actually interesting.
          </p>
        </div>

        {/* Coach Preview */}
        <div className="flex justify-center gap-6">
          {[
            { name: 'Chad', title: 'The Roast Bro', color: 'text-chad', icon: 'C', angle: 'Cuts through the BS' },
            { name: 'Dr. Reeves', title: 'Depth Therapist', color: 'text-reeves', icon: 'R', angle: 'Finds hidden patterns' },
            { name: 'Viktor', title: 'Tech Savant', color: 'text-viktor', icon: 'V', angle: 'Builds the framework' },
          ].map((coach) => (
            <div key={coach.name} className="text-center space-y-2">
              <div className={`w-12 h-12 rounded-full bg-bg-tertiary border-2 border-border flex items-center justify-center ${coach.color} font-bold text-lg mx-auto`}>
                {coach.icon}
              </div>
              <div>
                <div className={`text-sm font-semibold ${coach.color}`}>{coach.name}</div>
                <div className="text-xs text-text-muted">{coach.title}</div>
                <div className="text-[10px] text-text-muted mt-0.5 italic">{coach.angle}</div>
              </div>
            </div>
          ))}
        </div>

        {/* What you'll get */}
        {mode === 'choice' && (
          <div className="flex justify-center gap-8 text-center">
            {[
              { label: 'Career Throughline', desc: 'Your authentic story' },
              { label: 'Character Sheet', desc: 'RPG skill profile' },
              { label: 'STAR Stories', desc: 'Interview-ready bullets' },
            ].map((item) => (
              <div key={item.label} className="text-xs font-mono">
                <div className="text-text-secondary">{item.label}</div>
                <div className="text-text-muted">{item.desc}</div>
              </div>
            ))}
          </div>
        )}

        {/* Mode Selection */}
        {mode === 'choice' && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('resume')}
              className="w-full p-4 rounded-lg bg-bg-secondary border-2 border-accent-blue/30 hover:border-accent-blue transition-colors text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center text-accent-blue group-hover:bg-accent-blue group-hover:text-bg-primary transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Paste Resume / LinkedIn</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent-blue/20 text-accent-blue">recommended</span>
                  </div>
                  <div className="text-sm text-text-secondary">Fastest way in. Copy-paste your resume text.</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('manual')}
              className="w-full p-4 rounded-lg bg-bg-secondary border border-border hover:border-accent-purple transition-colors text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center text-accent-purple group-hover:bg-accent-purple group-hover:text-bg-primary transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <div>
                  <div className="font-semibold">Quick Intro</div>
                  <div className="text-sm text-text-secondary">Name, title, a few words about yourself.</div>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Resume Paste */}
        {mode === 'resume' && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('choice')}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              &larr; Back
            </button>
            <div>
              <label className="block text-sm font-medium mb-2">Paste your resume or LinkedIn summary</label>
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                placeholder="Copy and paste your resume text here..."
                className="w-full h-48 p-4 rounded-lg bg-bg-secondary border border-border text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent-blue transition-colors"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={!resumeText.trim() || isLoading}
              className="w-full py-3 rounded-lg bg-accent-blue text-bg-primary font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating your character sheet...
                </span>
              ) : (
                'Enter the Hot Seat'
              )}
            </button>
          </div>
        )}

        {/* Manual Entry */}
        {mode === 'manual' && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('choice')}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              &larr; Back
            </button>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full p-3 rounded-lg bg-bg-secondary border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Current Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior Engineer"
                  className="w-full p-3 rounded-lg bg-bg-secondary border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue transition-colors"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Years of Experience</label>
              <input
                type="number"
                value={yearsExp}
                onChange={(e) => setYearsExp(e.target.value)}
                placeholder="e.g. 8"
                className="w-full p-3 rounded-lg bg-bg-secondary border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Tell us about yourself</label>
              <textarea
                value={background}
                onChange={(e) => setBackground(e.target.value)}
                placeholder="What do you do? What's your career story so far? Just talk naturally..."
                className="w-full h-32 p-4 rounded-lg bg-bg-secondary border border-border text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent-blue transition-colors"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={(!name.trim() && !background.trim()) || isLoading}
              className="w-full py-3 rounded-lg bg-accent-purple text-bg-primary font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Assembling your panel...
                </span>
              ) : (
                'Enter the Hot Seat'
              )}
            </button>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="p-4 rounded-lg bg-red-900/20 border border-red-800/50 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
