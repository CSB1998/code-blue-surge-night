import { useCodeRun } from './state/useCodeRun'
import { unlockAudio } from './lib/sound'
import { Stage } from './components/Stage'
import { StartScreen } from './screens/StartScreen'
import { CodeScreen } from './screens/CodeScreen'
import { DebriefScreen } from './screens/DebriefScreen'

export default function App() {
  const run = useCodeRun()
  const start = () => { unlockAudio(); run.start() }

  if (run.phase === 'debrief' && run.debrief) {
    return <DebriefScreen debrief={run.debrief} ended={run.ended} onRestart={start} />
  }
  return (
    <Stage>
      {run.phase === 'start' ? <StartScreen onStart={start} /> : <CodeScreen run={run} />}
    </Stage>
  )
}
