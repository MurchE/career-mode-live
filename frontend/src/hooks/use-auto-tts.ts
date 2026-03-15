'use client'

/**
 * useAutoTTS — Sequential auto-play TTS for coaching panel.
 *
 * When a coach response arrives, enqueue TTS generation + playback.
 * Plays coaches in order: Chad → Dr. Reeves → Viktor.
 * Exposes which coach is currently speaking for avatar animation.
 */

import { useCallback, useRef, useState } from 'react'
import { getCoachTTS } from '@/lib/api'

interface TTSQueueItem {
  coachId: string
  blob: Blob
}

export function useAutoTTS() {
  const queueRef = useRef<TTSQueueItem[]>([])
  const isPlayingRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const isMutedRef = useRef(false)

  const playNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      isPlayingRef.current = false
      setCurrentlyPlaying(null)
      return
    }

    const item = queueRef.current.shift()!
    if (isMutedRef.current) {
      // Skip playback but continue processing queue
      playNext()
      return
    }

    setCurrentlyPlaying(item.coachId)
    const url = URL.createObjectURL(item.blob)
    const audio = new Audio(url)
    audioRef.current = audio

    audio.onended = () => {
      URL.revokeObjectURL(url)
      setCurrentlyPlaying(null)
      playNext()
    }

    audio.onerror = () => {
      URL.revokeObjectURL(url)
      setCurrentlyPlaying(null)
      playNext()
    }

    audio.play().catch(() => {
      // Browser may block autoplay — skip and continue
      URL.revokeObjectURL(url)
      setCurrentlyPlaying(null)
      playNext()
    })
  }, [])

  const enqueue = useCallback(async (text: string, coachId: string) => {
    // Fire TTS request immediately (parallel with next coach generation)
    const blob = await getCoachTTS(text, coachId)
    if (!blob) return

    queueRef.current.push({ coachId, blob })

    if (!isPlayingRef.current) {
      isPlayingRef.current = true
      playNext()
    }
  }, [playNext])

  const stop = useCallback(() => {
    queueRef.current = []
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    isPlayingRef.current = false
    setCurrentlyPlaying(null)
  }, [])

  const toggleMute = useCallback(() => {
    const newMuted = !isMutedRef.current
    isMutedRef.current = newMuted
    setIsMuted(newMuted)
    if (newMuted) {
      // Stop current playback
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setCurrentlyPlaying(null)
    }
  }, [])

  return {
    enqueue,
    stop,
    currentlyPlaying,
    isMuted,
    toggleMute,
  }
}
