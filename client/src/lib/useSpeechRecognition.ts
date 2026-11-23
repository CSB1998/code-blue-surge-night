// Hold-to-talk with Chrome's webkitSpeechRecognition. No API keys.
import { useCallback, useEffect, useRef, useState } from 'react'

interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

const Ctor: RecognitionCtor | undefined =
  typeof window !== 'undefined'
    ? ((window as unknown as Record<string, RecognitionCtor | undefined>).SpeechRecognition ??
      (window as unknown as Record<string, RecognitionCtor | undefined>).webkitSpeechRecognition)
    : undefined

export const speechSupported = !!Ctor

/** Returns live transcript and start/stop. `onFinal` fires once with the full text on release. */
export function useSpeechRecognition(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Recognition | null>(null)
  const finalText = useRef('')
  const liveText = useRef('')
  const wantStop = useRef(false)
  const onFinalRef = useRef(onFinal)
  onFinalRef.current = onFinal

  useEffect(() => () => rec.current?.abort(), [])

  const start = useCallback(() => {
    if (!Ctor || rec.current) return
    const r = new Ctor()
    r.lang = 'en-US'
    r.continuous = true
    r.interimResults = true
    finalText.current = ''
    liveText.current = ''
    wantStop.current = false
    r.onresult = (e) => {
      let interimNow = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finalText.current += res[0].transcript + ' '
        else interimNow += res[0].transcript
      }
      liveText.current = (finalText.current + interimNow).trim()
      setInterim(liveText.current)
    }
    r.onerror = (e) => {
      if (e.error === 'not-allowed') setError('Microphone blocked. Allow it in the address bar, or type your order.')
      else if (e.error !== 'no-speech' && e.error !== 'aborted') setError(`Mic error: ${e.error}`)
    }
    r.onend = () => {
      rec.current = null
      setListening(false)
      const text = liveText.current.trim()
      if (text) onFinalRef.current(text)
      setTimeout(() => setInterim(''), 1200)
    }
    rec.current = r
    setError(null)
    setInterim('')
    setListening(true)
    try { r.start() } catch { /* already started */ }
  }, [])

  const stop = useCallback(() => {
    wantStop.current = true
    rec.current?.stop()
  }, [])

  return { listening, interim, error, start, stop, supported: speechSupported }
}
