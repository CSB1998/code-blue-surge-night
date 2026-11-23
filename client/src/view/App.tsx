import { useEffect, useState } from 'react'
import { useCodeRun } from '../controller/useCodeRun'
import { unlockAudio } from '../controller/sound'
import { soundscape } from './audio/soundscape'
import { toggleFullscreen } from './fullscreen'
import { Stage } from './components/Stage'
import { StartScreen } from './screens/StartScreen'
import { IntroScreen } from './screens/IntroScreen'
import { CodeScreen } from './screens/CodeScreen'
import { DebriefScreen } from './screens/DebriefScreen'

export default function App() {
  const run = useCodeRun()
  const [intro, setIntro] = useState(false)

  // Sound may only start from a click (browser autoplay rules).
  const takeTheCode = () => { unlockAudio(); soundscape.start(); setIntro(true) }
  const afterIntro = () => { setIntro(false); run.start() }
  // From the debrief, skip the intro and go straight back in.
  const runAgain = () => { unlockAudio(); soundscape.start(); run.start() }

  // F = fullscreen for demos (ignored while typing an order)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'f' && e.key !== 'F') return
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      toggleFullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (run.phase === 'debrief' && run.debrief) {
    return <DebriefScreen debrief={run.debrief} ended={run.ended} onRestart={runAgain} />
  }
  return (
    <Stage>
      {intro ? <IntroScreen onDone={afterIntro} /> : run.phase === 'start' ? <StartScreen onStart={takeTheCode} /> : <CodeScreen run={run} />}
    </Stage>
  )
}
