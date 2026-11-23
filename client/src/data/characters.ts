import type { Emotion } from '../types/contract'
import type { Speaker } from '../lib/voices'

// All portrait images are picked up automatically from
// src/assets/characters/<id>/<emotion>.png. Replace files, keep names.
const images = import.meta.glob('../assets/characters/*/*.png', { eager: true, import: 'default' }) as Record<string, string>

export interface Character {
  id: 'kim' | 'raj' | 'okafor' | 'reyes'
  name: Speaker
  fullName: string
  role: string
  color: string
}

export const CHARACTERS: Record<Speaker, Character> = {
  Kim: { id: 'kim', name: 'Kim', fullName: 'Nurse Kim', role: 'ICU nurse', color: '#FF8A65' },
  Raj: { id: 'raj', name: 'Raj', fullName: 'Raj', role: 'Pharmacist', color: '#7C9CFF' },
  Okafor: { id: 'okafor', name: 'Okafor', fullName: 'Dr. Okafor', role: 'Anesthesiologist', color: '#C084FC' },
  Reyes: { id: 'reyes', name: 'Reyes', fullName: 'Dr. Reyes', role: 'Attending', color: '#9CA3AF' },
}

export function portrait(name: Speaker, emotion: Emotion = 'focused'): string {
  const id = CHARACTERS[name].id
  return images[`../assets/characters/${id}/${emotion}.png`] ?? images[`../assets/characters/${id}/focused.png`]
}

export const colorOf = (name: string) => (CHARACTERS as Record<string, Character>)[name]?.color ?? '#9AA8BD'
