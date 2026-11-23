// One interface, two implementations: the real socket.io server or the built-in mock.
// Switch with VITE_MOCK in client/.env (true = fake data, false = real server).
import { io } from 'socket.io-client'
import type { ClientEvents, ServerEvents } from '../model/contract'
import { MockServer } from './mockServer'

export const MOCK = (import.meta.env.VITE_MOCK ?? 'true') !== 'false'
export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001'

export interface Transport {
  on<K extends keyof ServerEvents>(event: K, cb: (payload: ServerEvents[K]) => void): () => void
  emit<K extends keyof ClientEvents>(event: K, payload: ClientEvents[K]): void
  close(): void
}

function socketTransport(): Transport {
  const socket = io(SERVER_URL, { transports: ['websocket'] })
  return {
    on(event, cb) {
      const handler = cb as (p: unknown) => void
      socket.on(event as string, handler)
      return () => socket.off(event as string, handler)
    },
    emit(event, payload) {
      socket.emit(event, payload)
    },
    close() {
      socket.disconnect()
    },
  }
}

export function createTransport(): Transport {
  return MOCK ? new MockServer() : socketTransport()
}
