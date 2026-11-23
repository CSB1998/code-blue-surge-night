/** Toggle browser fullscreen for projector demos. */
export function toggleFullscreen() {
  try {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen()
  } catch { /* fullscreen not allowed here */ }
}
