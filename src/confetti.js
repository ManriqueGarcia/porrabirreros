const COLORS = ["#f59e0b", "#e10600", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#facc15"];
const PARTICLE_COUNT = 80;
const DURATION = 2500;

export function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;z-index:9999;pointer-events:none";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
    x: canvas.width * (0.3 + Math.random() * 0.4),
    y: canvas.height * 0.5,
    vx: (Math.random() - 0.5) * 14,
    vy: -8 - Math.random() * 10,
    w: 4 + Math.random() * 4,
    h: 6 + Math.random() * 8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rot: Math.random() * Math.PI * 2,
    rv: (Math.random() - 0.5) * 0.3,
    gravity: 0.18 + Math.random() * 0.06,
  }));

  const start = performance.now();
  function frame(now) {
    const elapsed = now - start;
    if (elapsed > DURATION) { canvas.remove(); return; }
    const alpha = Math.min(1, 1 - (elapsed - DURATION * 0.7) / (DURATION * 0.3));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of particles) {
      p.x += p.vx;
      p.vy += p.gravity;
      p.y += p.vy;
      p.vx *= 0.99;
      p.rot += p.rv;
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
