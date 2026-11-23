import { useEffect, useRef, useState } from 'react'
import { useCodeRun } from '../controller/useCodeRun'
import { unlockAudio } from '../controller/sound'
import { soundscape } from './audio/soundscape'
import { toggleFullscreen } from './fullscreen'
import { Stage } from './components/Stage'
import { StartScreen } from './screens/StartScreen'
import { IntroScreen } from './screens/IntroScreen'
import { CodeScreen } from './screens/CodeScreen'
import { DebriefScreen } from './screens/DebriefScreen'
import { useGameScore } from './game/useGameScore'
import { GameDebrief } from './game/GameDebrief'
import { endBonuses, loadBoard, loadInitials, saveInitials, saveScore, total } from './game/scores'

export default function App() {
  const run = useCodeRun()
  const [intro, setIntro] = useState(false)
  const game = useGameScore(run)

  // leaderboard: initials typed on the start screen, run saved once when the debrief arrives
  const [initials, setInitials] = useState(loadInitials)
  const [board, setBoard] = useState(loadBoard)
  const [newestId, setNewestId] = useState<string>()
  const savedFor = useRef<object | null>(null)
  useEffect(() => {
    if (!run.debrief || savedFor.current === run.debrief) return
    savedFor.current = run.debrief
    const { board: b, id } = saveScore(initials, total(game.score, endBonuses(run.debrief.score, game.stats.roscAt)))
    setBoard(b)
    setNewestId(id)
  }, [run.debrief])
  const changeInitials = (v: string) => { setInitials(v); saveInitials(v) }

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
    return (
      <DebriefScreen debrief={run.debrief} ended={run.ended} onRestart={runAgain}>
        <GameDebrief score={game.score} bonuses={endBonuses(run.debrief.score, game.stats.roscAt)} stats={game.stats} ended={run.ended} vent={run.patient?.vent_assigned} board={board} highlightId={newestId} />
      </DebriefScreen>
    )
  }
  return (
    <Stage>
      {intro ? <IntroScreen onDone={afterIntro} /> : run.phase === 'start' ? <StartScreen onStart={takeTheCode} initials={initials} onInitials={changeInitials} board={board} /> : <CodeScreen run={run} game={game} />}
    </Stage>
  )
}
