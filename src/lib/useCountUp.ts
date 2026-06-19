import { useEffect, useRef, useState } from 'react';

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Animate a number from 0 → target on mount / when target changes. */
export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = Date.now();
    const from = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      setValue(Math.round(from + (target - from) * easeOut(t)));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);

  return value;
}
