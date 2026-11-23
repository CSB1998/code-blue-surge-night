// Generates placeholder PNGs (no dependencies). Run: npm run placeholders
// Replace any file later with real art using the SAME file name.
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/characters')

// ---------- tiny raster canvas ----------
function canvas(w, h) {
  const px = new Uint8Array(w * h * 4)
  const set = (x, y, [r, g, b, a = 255]) => {
    x = Math.round(x); y = Math.round(y)
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const i = (y * w + x) * 4
    const t = a / 255
    px[i] = px[i] * (1 - t) + r * t
    px[i + 1] = px[i + 1] * (1 - t) + g * t
    px[i + 2] = px[i + 2] * (1 - t) + b * t
    px[i + 3] = 255
  }
  const rect = (x, y, rw, rh, c) => { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) set(i, j, c) }
  const circle = (cx, cy, r, c, ry = r) => {
    for (let j = -ry; j <= ry; j++) for (let i = -r; i <= r; i++)
      if ((i * i) / (r * r) + (j * j) / (ry * ry) <= 1) set(cx + i, cy + j, c)
  }
  const line = (x1, y1, x2, y2, t, c) => {
    const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1))
    for (let k = 0; k <= n; k++) circle(x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n, t, c)
  }
  // quadratic curve from (x1,y1) to (x2,y2) with control (cx,cy)
  const curve = (x1, y1, cx, cy, x2, y2, t, c) => {
    for (let k = 0; k <= 60; k++) {
      const s = k / 60
      const x = (1 - s) ** 2 * x1 + 2 * (1 - s) * s * cx + s * s * x2
      const y = (1 - s) ** 2 * y1 + 2 * (1 - s) * s * cy + s * s * y2
      circle(x, y, t, c)
    }
  }
  const gradient = (top, bottom) => {
    for (let y = 0; y < h; y++) {
      const t = y / (h - 1)
      rect(0, y, w, 1, top.map((v, k) => v + (bottom[k] - v) * t))
    }
  }
  return { w, h, px, set, rect, circle, line, curve, gradient }
}

// ---------- 5x7 bitmap font ----------
const F = {
  A: [' ### ', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  B: ['#### ', '#   #', '#   #', '#### ', '#   #', '#   #', '#### '],
  C: [' ####', '#    ', '#    ', '#    ', '#    ', '#    ', ' ####'],
  D: ['#### ', '#   #', '#   #', '#   #', '#   #', '#   #', '#### '],
  E: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#####'],
  F: ['#####', '#    ', '#    ', '#### ', '#    ', '#    ', '#    '],
  H: ['#   #', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'],
  I: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '#####'],
  J: ['  ###', '   # ', '   # ', '   # ', '   # ', '#  # ', ' ##  '],
  K: ['#   #', '#  # ', '# #  ', '##   ', '# #  ', '#  # ', '#   #'],
  L: ['#    ', '#    ', '#    ', '#    ', '#    ', '#    ', '#####'],
  M: ['#   #', '## ##', '# # #', '# # #', '#   #', '#   #', '#   #'],
  N: ['#   #', '##  #', '# # #', '#  ##', '#   #', '#   #', '#   #'],
  O: [' ### ', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  P: ['#### ', '#   #', '#   #', '#### ', '#    ', '#    ', '#    '],
  R: ['#### ', '#   #', '#   #', '#### ', '# #  ', '#  # ', '#   #'],
  S: [' ####', '#    ', '#    ', ' ### ', '    #', '    #', '#### '],
  T: ['#####', '  #  ', '  #  ', '  #  ', '  #  ', '  #  ', '  #  '],
  U: ['#   #', '#   #', '#   #', '#   #', '#   #', '#   #', ' ### '],
  V: ['#   #', '#   #', '#   #', '#   #', '#   #', ' # # ', '  #  '],
  Y: ['#   #', '#   #', ' # # ', '  #  ', '  #  ', '  #  ', '  #  '],
  Z: ['#####', '    #', '   # ', '  #  ', ' #   ', '#    ', '#####'],
  '.': ['     ', '     ', '     ', '     ', '     ', '     ', '  #  '],
  ',': ['     ', '     ', '     ', '     ', '     ', '  #  ', ' #   '],
  '5': ['#####', '#    ', '#### ', '    #', '    #', '#   #', ' ### '],
  '8': [' ### ', '#   #', '#   #', ' ### ', '#   #', '#   #', ' ### '],
  ' ': ['     ', '     ', '     ', '     ', '     ', '     ', '     '],
}
function text(c, str, x, y, s, color, align = 'left') {
  const width = str.length * 6 * s - s
  let cx = align === 'center' ? x - width / 2 : x
  for (const ch of str.toUpperCase()) {
    const g = F[ch] || F[' ']
    g.forEach((row, j) => [...row].forEach((p, i) => { if (p === '#') c.rect(Math.round(cx + i * s), y + j * s, s, s, color) }))
    cx += 6 * s
  }
}

// ---------- PNG encoder ----------
const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function save(c, file) {
  const raw = Buffer.alloc((c.w * 4 + 1) * c.h)
  for (let y = 0; y < c.h; y++) {
    raw[y * (c.w * 4 + 1)] = 0
    Buffer.from(c.px.buffer, y * c.w * 4, c.w * 4).copy(raw, y * (c.w * 4 + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(c.w, 0); ihdr.writeUInt32BE(c.h, 4); ihdr[8] = 8; ihdr[9] = 6
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, png)
  console.log('wrote', file.replace(OUT, 'assets/characters'))
}

// ---------- characters ----------
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
const BLACK = [11, 15, 23]
const WHITE = [240, 244, 250]

const PEOPLE = {
  kim: { name: 'KIM', initials: 'K', accent: '#FF8A65', scrubs: '#2E6F73' },
  raj: { name: 'RAJ', initials: 'R', accent: '#7C9CFF', scrubs: '#E8ECF4' },
  okafor: { name: 'OKAFOR', initials: 'O', accent: '#C084FC', scrubs: '#3B4A7A' },
  reyes: { name: 'REYES', initials: 'R', accent: '#9CA3AF', scrubs: '#F2F2F2' },
}
const EMOTIONS = ['focused', 'stressed', 'annoyed', 'relieved', 'defiant']

function face(c, cx, cy, emotion, ink) {
  const ex = 34, ey = cy - 10
  // brows
  const brow = {
    focused: [[-8, -2], [8, -2]],
    stressed: [[-10, 6], [8, -6]], // inner raised (worried)
    annoyed: [[-8, -6], [8, 4]], // inner lowered
    relieved: [[-8, -6], [8, -6]],
    defiant: [[-12, -10], [10, 8]],
  }[emotion]
  for (const side of [-1, 1]) {
    const [o, i] = brow
    c.line(cx + side * (ex + 14), ey - 28 + o[1], cx + side * (ex - 14), ey - 28 + i[1] * (side === 1 ? 1 : 1), 3, ink)
  }
  // eyes
  for (const side of [-1, 1]) {
    const x = cx + side * ex
    if (emotion === 'relieved') c.curve(x - 12, ey + 2, x, ey - 10, x + 12, ey + 2, 3, ink)
    else if (emotion === 'annoyed') { c.line(x - 12, ey, x + 12, ey, 4, ink); c.circle(x, ey + 5, 5, ink) }
    else if (emotion === 'stressed') { c.circle(x, ey, 12, WHITE); c.circle(x, ey, 6, ink) }
    else c.circle(x, ey, 7, ink)
  }
  // mouth
  const my = cy + 38
  if (emotion === 'focused') c.line(cx - 22, my, cx + 22, my, 3, ink)
  if (emotion === 'stressed') c.circle(cx, my + 2, 12, ink, 9)
  if (emotion === 'annoyed') c.curve(cx - 24, my + 4, cx, my - 4, cx + 24, my + 6, 3, ink)
  if (emotion === 'relieved') c.curve(cx - 28, my - 6, cx, my + 22, cx + 28, my - 6, 4, ink)
  if (emotion === 'defiant') c.curve(cx - 26, my + 10, cx, my - 14, cx + 26, my + 10, 4, ink)
}

for (const [key, p] of Object.entries(PEOPLE)) {
  const accent = hex(p.accent)
  for (const emo of EMOTIONS) {
    const c = canvas(400, 500)
    c.gradient(mix(accent, BLACK, 0.55), mix(accent, BLACK, 0.85))
    // shoulders in scrubs
    c.circle(200, 520, 170, hex(p.scrubs), 150)
    c.rect(170, 330, 60, 50, mix(accent, WHITE, 0.55)) // neck
    // head
    c.circle(200, 230, 105, mix(accent, WHITE, 0.55), 120)
    face(c, 200, 230, emo, BLACK)
    // initials badge
    c.circle(52, 52, 34, accent)
    text(c, p.initials, 52, 38, 4, BLACK, 'center')
    // label strip
    c.rect(0, 430, 400, 70, [11, 15, 23, 220])
    text(c, p.name, 200, 440, 4, accent, 'center')
    text(c, emo, 200, 476, 2, WHITE, 'center')
    save(c, join(OUT, key, `${emo}.png`))
  }
}

// ---------- room ----------
{
  const c = canvas(1600, 900)
  c.gradient([16, 24, 40], [10, 14, 22])
  c.rect(0, 640, 1600, 260, [14, 19, 30])
  for (let x = 0; x < 1600; x += 120) c.line(x, 640, x - 200, 900, 1, [26, 34, 50])
  c.rect(0, 638, 1600, 3, [40, 52, 74])
  // window with blinds (night)
  c.rect(120, 120, 360, 300, [8, 12, 26])
  for (let y = 130; y < 420; y += 22) c.rect(120, y, 360, 6, [30, 40, 60])
  c.circle(400, 190, 26, [190, 200, 220, 120])
  // wall gas panel
  c.rect(640, 150, 380, 70, [28, 38, 56])
  for (let i = 0; i < 5; i++) c.circle(690 + i * 70, 185, 14, [[60, 200, 120], [60, 160, 255], [255, 210, 63], [200, 200, 210], [255, 90, 100]][i])
  // door frame on the right
  c.rect(1360, 120, 220, 520, [6, 9, 15])
  c.rect(1350, 110, 240, 12, [50, 62, 86])
  c.rect(1350, 110, 12, 530, [50, 62, 86])
  c.rect(1578, 110, 12, 530, [50, 62, 86])
  text(c, 'ICU ROOM PLACEHOLDER', 800, 840, 3, [70, 86, 112], 'center')
  save(c, join(OUT, '..', 'room.png'))
}

// ---------- Maria in bed ----------
{
  const c = canvas(640, 360)
  const frame = [72, 84, 104]
  c.rect(40, 210, 560, 22, frame) // bed frame
  c.rect(60, 232, 14, 110, frame); c.rect(566, 232, 14, 110, frame)
  c.rect(30, 120, 18, 120, frame) // headboard
  c.rect(60, 170, 520, 44, [210, 218, 230]) // mattress
  c.circle(120, 160, 56, [236, 240, 246], 26) // pillow
  c.circle(130, 128, 40, [196, 160, 136], 44) // head
  c.line(110, 120, 150, 120, 3, [60, 40, 30]) // closed eyes
  c.curve(100, 96, 130, 70, 170, 100, 10, [50, 34, 28]) // hair
  c.circle(360, 168, 240, [92, 140, 190], 34) // blanket
  c.rect(160, 150, 420, 30, [92, 140, 190])
  text(c, 'MARIA LOPEZ, 58', 320, 300, 3, [180, 192, 210], 'center')
  save(c, join(OUT, '..', 'maria.png'))
}
