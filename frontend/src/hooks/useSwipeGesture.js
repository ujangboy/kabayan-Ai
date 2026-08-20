import { useEffect, useRef } from 'react';

/**
 * useSwipeGesture — swipe gesture untuk mobile (PRD-01 §5.4).
 *
 * Perilaku:
 *   - Swipe ke KANAN hanya valid bila sentuhan dimulai di tepi kiri
 *     (dalam `edgeWidth` px dari tepi kiri elemen) → `onSwipeRight`.
 *     Dipakai untuk membuka drawer dari tepi layar.
 *   - Swipe ke KIRI valid di mana saja dalam elemen → `onSwipeLeft`.
 *     Dipakai untuk menutup drawer.
 *   - Gerakan dominan vertikal diabaikan (scroll tetap berjalan normal);
 *     elemen otomatis diberi `touch-action: pan-y`.
 *   - Ambang jarak minimum `threshold` px DAN kecepatan minimum
 *     `minVelocity` px/s (keduanya harus terpenuhi).
 *
 * @param {Object} [options]
 * @param {() => void} [options.onSwipeRight] Dipanggil saat swipe kanan dari tepi kiri.
 * @param {() => void} [options.onSwipeLeft] Dipanggil saat swipe kiri.
 * @param {boolean} [options.enabled=true] Aktifkan/nonaktifkan listener.
 * @param {boolean} [options.window=false] Pasang listener ke `window` (bukan elemen).
 * @param {number} [options.threshold=50] Jarak horizontal minimum (px).
 * @param {number} [options.minVelocity=500] Kecepatan minimum (px/detik).
 * @param {number} [options.edgeWidth=24] Lebar zona "tepi kiri" (px).
 * @returns {{ ref: React.RefObject<HTMLElement|null> }} Tempelkan `ref` ke elemen
 *   yang mau dipantau (kecuali `window: true`).
 */
export function useSwipeGesture({
  onSwipeRight,
  onSwipeLeft,
  enabled = true,
  window: attachToWindow = false,
  threshold = 50,
  minVelocity = 500,
  edgeWidth = 24,
} = {}) {
  const ref = useRef(null);
  const startRef = useRef(null);
  const callbacksRef = useRef({ onSwipeRight, onSwipeLeft });
  callbacksRef.current = { onSwipeRight, onSwipeLeft };

  useEffect(() => {
    if (!enabled) return undefined;

    const target = attachToWindow ? window : ref.current;
    if (!target) return undefined;

    const prevTouchAction = target.style?.touchAction;
    if (target.style) target.style.touchAction = 'pan-y';

    const onTouchStart = (e) => {
      const t = e.touches?.[0];
      if (!t) return;
      const rect = attachToWindow ? null : target.getBoundingClientRect();
      const leftEdge = attachToWindow ? 0 : rect.left;
      startRef.current = {
        x: t.clientX,
        y: t.clientY,
        time: performance.now(),
        edge: t.clientX - leftEdge <= edgeWidth,
      };
    };

    // Gerakan dominan vertikal → bukan swipe horizontal; berhenti memantau.
    const onTouchMove = (e) => {
      const start = startRef.current;
      if (!start) return;
      const t = e.touches?.[0];
      if (!t) return;
      const dy = Math.abs(t.clientY - start.y);
      const dx = Math.abs(t.clientX - start.x);
      if (dy > dx) startRef.current = null;
    };

    const onTouchEnd = (e) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start) return;
      const t = e.changedTouches?.[0];
      if (!t) return;

      const dx = t.clientX - start.x;
      const dt = Math.max(1, e.timeStamp - start.time);
      const velocity = (Math.abs(dx) / dt) * 1000;

      const farEnough = Math.abs(dx) >= threshold;
      const fastEnough = velocity >= minVelocity;
      if (!farEnough || !fastEnough) return;

      if (dx > 0) {
        if (start.edge) callbacksRef.current.onSwipeRight?.();
      } else {
        callbacksRef.current.onSwipeLeft?.();
      }
    };

    target.addEventListener('touchstart', onTouchStart, { passive: true });
    target.addEventListener('touchmove', onTouchMove, { passive: true });
    target.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      target.removeEventListener('touchstart', onTouchStart);
      target.removeEventListener('touchmove', onTouchMove);
      target.removeEventListener('touchend', onTouchEnd);
      if (target.style && prevTouchAction !== undefined) target.style.touchAction = prevTouchAction;
    };
  }, [enabled, attachToWindow, threshold, minVelocity, edgeWidth]);

  return { ref };
}