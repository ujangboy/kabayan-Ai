// @vitest-environment jsdom
/**
 * Unit tests untuk useSwipeGesture (PRD-01 §5.4).
 * Run: npm test
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useSwipeGesture } from './useSwipeGesture.js';

afterEach(cleanup);

function SwipeProbe({ onSwipeRight, onSwipeLeft, ...opts }) {
  const { ref } = useSwipeGesture({ onSwipeRight, onSwipeLeft, ...opts });
  return <div ref={ref} data-testid="swipe" />;
}

function fireTouch(el, type, { touches = [], changedTouches = [] } = {}) {
  const evt = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(evt, 'touches', { value: touches });
  Object.defineProperty(evt, 'changedTouches', { value: changedTouches });
  Object.defineProperty(evt, 'timeStamp', { value: performance.now() });
  el.dispatchEvent(evt);
  return evt;
}

const t = (x, y) => ({ clientX: x, clientY: y });

const swipe = (el, from, to, { durationMs = 1 } = {}) => {
  fireTouch(el, 'touchstart', { touches: [t(from.x, from.y)] });
  fireTouch(el, 'touchmove', { touches: [t(to.x, to.y)] });
  // timeStamp end = start + duration → kendalikan kecepatan.
  const evt = new Event('touchend', { bubbles: true, cancelable: true });
  Object.defineProperty(evt, 'touches', { value: [] });
  Object.defineProperty(evt, 'changedTouches', { value: [t(to.x, to.y)] });
  Object.defineProperty(evt, 'timeStamp', { value: performance.now() + durationMs });
  el.dispatchEvent(evt);
  return evt;
};

describe('useSwipeGesture', () => {
  let onSwipeRight;
  let onSwipeLeft;

  beforeEach(() => {
    onSwipeRight = vi.fn();
    onSwipeLeft = vi.fn();
  });

  it('swipe kanan dari tepi kiri memanggil onSwipeRight', () => {
    const { getByTestId } = render(<SwipeProbe onSwipeRight={onSwipeRight} onSwipeLeft={onSwipeLeft} />);
    swipe(getByTestId('swipe'), { x: 10, y: 100 }, { x: 130, y: 105 });
    expect(onSwipeRight).toHaveBeenCalledTimes(1);
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('swipe kanan TIDAK dari tepi kiri diabaikan (hanya tepi yang membuka drawer)', () => {
    const { getByTestId } = render(<SwipeProbe onSwipeRight={onSwipeRight} onSwipeLeft={onSwipeLeft} />);
    swipe(getByTestId('swipe'), { x: 300, y: 100 }, { x: 420, y: 105 });
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('swipe kiri dari mana saja memanggil onSwipeLeft', () => {
    const { getByTestId } = render(<SwipeProbe onSwipeRight={onSwipeRight} onSwipeLeft={onSwipeLeft} />);
    swipe(getByTestId('swipe'), { x: 200, y: 100 }, { x: 60, y: 105 });
    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('swipe lambat (kecepatan < minVelocity) diabaikan', () => {
    const { getByTestId } = render(<SwipeProbe onSwipeRight={onSwipeRight} onSwipeLeft={onSwipeLeft} />);
    swipe(getByTestId('swipe'), { x: 10, y: 100 }, { x: 130, y: 105 }, { durationMs: 300 });
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('swipe pendek (jarak < threshold) diabaikan', () => {
    const { getByTestId } = render(<SwipeProbe onSwipeRight={onSwipeRight} onSwipeLeft={onSwipeLeft} />);
    swipe(getByTestId('swipe'), { x: 10, y: 100 }, { x: 30, y: 105 });
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('gerakan dominan vertikal diabaikan (scroll)', () => {
    const { getByTestId } = render(<SwipeProbe onSwipeRight={onSwipeRight} onSwipeLeft={onSwipeLeft} />);
    swipe(getByTestId('swipe'), { x: 10, y: 100 }, { x: 120, y: 400 });
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });

  it('menempelkan touch-action: pan-y ke elemen', () => {
    const { getByTestId } = render(<SwipeProbe onSwipeRight={onSwipeRight} onSwipeLeft={onSwipeLeft} />);
    expect(getByTestId('swipe').style.touchAction).toBe('pan-y');
  });

  it('enabled=false → tidak ada listener, tidak ada respons', () => {
    const { getByTestId } = render(
      <SwipeProbe enabled={false} onSwipeRight={onSwipeRight} onSwipeLeft={onSwipeLeft} />
    );
    swipe(getByTestId('swipe'), { x: 10, y: 100 }, { x: 130, y: 105 });
    expect(onSwipeRight).not.toHaveBeenCalled();
    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});