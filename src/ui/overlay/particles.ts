interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Tiny canvas particle system for rep bursts. Coordinates are canvas pixels. */
export class Particles {
  private list: Particle[] = [];
  private last = 0;

  burst(x: number, y: number, colors: string[], n = 36, speed = 520): void {
    if (reducedMotion()) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      this.list.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - speed * 0.35,
        life: 0,
        max: 0.6 + Math.random() * 0.5,
        color: colors[i % colors.length]!,
        size: 4 + Math.random() * 6,
      });
    }
  }

  draw(ctx: CanvasRenderingContext2D, now = performance.now()): void {
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    this.last = now;
    if (!this.list.length) return;
    const scale = Math.min(ctx.canvas.width, ctx.canvas.height) / 720;
    ctx.save();
    for (const p of this.list) {
      p.life += dt;
      p.vy += 900 * dt;
      p.x += p.vx * dt * scale;
      p.y += p.vy * dt * scale;
      ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * scale, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    this.list = this.list.filter((p) => p.life < p.max);
  }
}
