'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

interface UseVoiceOptions {
  onResult?: (transcript: string) => void
  onInterimResult?: (transcript: string) => void
  continuous?: boolean
  language?: string
}

interface UseVoiceReturn {
  isListening: boolean
  isSupported: boolean
  transcript: string
  interimTranscript: string
  startListening: () => void
  stopListening: () => void
  toggleListening: () => void
  speak: (text: string, voice?: string) => void
  isSpeaking: boolean
  cancelSpeech: () => void
}

/**
 * Hook for Web Speech API — voice input (recognition) and output (synthesis).
 */
export function useVoice(options: UseVoiceOptions = {}): UseVoiceReturn {
  const { onResult, onInterimResult, continuous = false, language = 'en-US' } = options

  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)

  // Check browser support
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const supported = !!SpeechRecognition && !!window.speechSynthesis
    setIsSupported(supported)

    if (supported) {
      synthRef.current = window.speechSynthesis
    }
  }, [])

  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) return

    const recognition = new SpeechRecognition()
    recognition.continuous = continuous
    recognition.interimResults = true
    recognition.lang = language

    recognition.onstart = () => setIsListening(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let finalText = ''
      let interimText = ''

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }

      if (interimText) {
        setInterimTranscript(interimText)
        onInterimResult?.(interimText)
      }

      if (finalText) {
        setTranscript(finalText)
        setInterimTranscript('')
        onResult?.(finalText)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [continuous, language, onResult, onInterimResult])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  const speak = useCallback((text: string) => {
    if (!synthRef.current) return

    // Cancel any current speech
    synthRef.current.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    synthRef.current.speak(utterance)
  }, [])

  const cancelSpeech = useCallback(() => {
    synthRef.current?.cancel()
    setIsSpeaking(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      synthRef.current?.cancel()
    }
  }, [])

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
    speak,
    isSpeaking,
    cancelSpeech,
  }
}
