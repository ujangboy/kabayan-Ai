/**
 * Confetti ringan berbasis canvas — tanpa dependency tambahan.
 * Dihormati prefers-reduced-motion (tidak menampilkan animasi).
 *
 * Usage:
 *   import { fireConfetti } from '@/utils/confetti';
 *   fireConfetti();                            // default dari tengah layar
 *   fireConfetti({ count: 150, origin: { x: 0.5, y: 0.3 } });
 */

const COLORS = ['#14B8A6', '#2DD4BF', '#5EEAD4', '#29A8DF', '#10B981', '#F6B93B', '#F97316', '#FFFFFF'];

export function fireConfetti({ count = 110, origin = { x: 0.5, y: 0.4 }, spread = 100, angle = 90 } = {}) {
  if (typeof window === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;

  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;top:0;left:0;';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) { canvas.remove(); return; }

  const cx = origin.x * canvas.width;
  const cy = origin.y * canvas.height;
  const angleRad = (angle * Math.PI) / 180;

  const particles = Array.from({ length: count }, () => {
    const speed = 8 + Math.random() * 7;
    const dir = angleRad + ((Math.random() - 0.5) * spread * Math.PI) / 180;
    return {
      x: cx,
      y: cy,
      vx: Math.cos(dir) * speed,
      vy: Math.sin(dir) * speed,
      size: 5 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.3,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      alpha: 1,
      life: 1,
      decay: 0.006 + Math.random() * 0.008,
    };
  });

  const DURATION = 2600;
  const start = performance.now();

  const tick = (now) => {
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / DURATION);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18; // gravitasi
      p.vx *= 0.99;
      p.rot += p.vrot;
      p.life -= p.decay;
      if (p.life <= 0) continue;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      canvas.remove();
    }
  };

  requestAnimationFrame(tick);
}