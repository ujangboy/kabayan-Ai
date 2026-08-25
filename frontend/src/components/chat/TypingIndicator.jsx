import { motion, useReducedMotion } from 'framer-motion';

const SIZE = 3;

export default function TypingIndicator() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className="inline-grid grid-cols-3 gap-1 py-1"
      aria-live="polite"
      aria-label="AI sedang mengetik"
    >
      {Array.from({ length: SIZE * SIZE }).map((_, idx) => {
        const r = Math.floor(idx / SIZE);
        const c = idx % SIZE;
        const distBL = Math.abs(r - (SIZE - 1)) + Math.abs(c - 0);
        const distTR = Math.abs(r - 0) + Math.abs(c - (SIZE - 1));
        const delay = Math.min(distBL, distTR) * 0.08;

        return (
          <motion.span
            key={idx}
            className="w-1.5 h-1.5 rounded-full bg-primary/70"
            animate={
              shouldReduceMotion
                ? { opacity: [0.4, 1, 0.4] }
                : { y: [0, -3, 0], scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }
            }
            transition={{
              duration: shouldReduceMotion ? 1.2 : 0.65,
              repeat: Infinity,
              ease: 'easeInOut',
              delay,
            }}
          />
        );
      })}
    </div>
  );
}
