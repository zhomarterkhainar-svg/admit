/** Device pixels per CSS pixel for our canvases (capped: 3× screens gain nothing but cost a lot). */
export const canvasDpr = () => Math.min(window.devicePixelRatio || 1, 2);

/**
 * Keeps a canvas' bitmap the size of its CSS box (× dpr) without a layout feedback loop.
 * The canvas must be sized by CSS alone (absolutely positioned or with an explicit width and
 * height): its bitmap size must never feed back into its layout size, otherwise a fractional
 * devicePixelRatio (Windows at 125% / 150%) grows it a little on every frame — forever.
 * Calls `onResize` after each change. Returns the cleanup.
 */
export function fitCanvas(canvas: HTMLCanvasElement, onResize?: () => void): () => void {
  const apply = () => {
    const dpr = canvasDpr();
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      onResize?.();
    }
  };
  apply();
  const ro = new ResizeObserver(apply);
  ro.observe(canvas);
  return () => ro.disconnect();
}

/** true while the element is on screen (animations skip drawing when it is scrolled away / hidden). */
export function watchVisible(el: Element, onChange: (visible: boolean) => void): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    onChange(true);
    return () => {};
  }
  const io = new IntersectionObserver((entries) => onChange(entries.some((e) => e.isIntersecting)));
  io.observe(el);
  return () => io.disconnect();
}
