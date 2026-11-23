import type { Emotion } from './contract'

export type Speaker = 'Kim' | 'Raj' | 'Okafor' | 'Reyes'

// All portrait images are picked up automatically from
// src/assets/characters/<id>/<emotion>.jpg (or .png). Replace files, keep names.
// Real art is .jpg; .png is the generated placeholder. .jpg wins if both exist.
const images = import.meta.glob('../assets/characters/*/*.{jpg,png}', { eager: true, import: 'default' }) as Record<string, string>
const find = (id: string, emotion: string) =>
  images[`../assets/characters/${id}/${emotion}.jpg`] ?? images[`../assets/characters/${id}/${emotion}.png`]

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
  // Dr. Reyes is always shown as her doorway silhouette, whatever the emotion.
  if (id === 'reyes') return find('reyes', 'silhouette') ?? find('reyes', emotion)
  return find(id, emotion) ?? find(id, 'focused')
}

export const colorOf = (name: string) => (CHARACTERS as Record<string, Character>)[name]?.color ?? '#9AA8BD'
