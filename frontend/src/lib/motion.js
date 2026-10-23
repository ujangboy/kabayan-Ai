/**
 * Preset transisi Framer Motion — satu bahasa gerak untuk seluruh UI.
 *
 * Prinsip: cepat (180–320 ms), meluncur dari bawah 6–12 px, tanpa bounce
 * berlebihan. Animasi harus terasa seperti kertas yang diangkat, bukan
 * elemen yang memantul. Semua preset aman untuk `prefers-reduced-motion`
 * karena MotionConfig di AppLayout mematikan transform saat perlu.
 */
export const easeOut = [0.16, 1, 0.3, 1];
export const easeStandard = [0.32, 0.72, 0, 1];

export const springWave = { type: 'spring', stiffness: 380, damping: 34, mass: 0.75 };
export const springLift = { type: 'spring', stiffness: 360, damping: 30, mass: 0.8 };
export const springSoft = { type: 'spring', stiffness: 300, damping: 32, mass: 0.9 };

export const pageTransition = { duration: 0.28, ease: easeOut };
export const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: easeOut } },
};
export const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
};
export const scaleIn = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: 0.2, ease: easeOut },
};
