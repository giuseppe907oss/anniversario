"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useUI } from "@/lib/store";

const WORDS = ["Un pomeriggio.", "Una città.", "Noi due."];

/** Apertura: la frase-concept mentre le scene 3D vengono preparate. */
export function Loader() {
  const ready = useUI((s) => s.sceneReady);
  const webgl = useUI((s) => s.webgl);
  const entered = useUI((s) => s.entered);
  const set = useUI((s) => s.set);
  const [progress, setProgress] = useState(0);
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), 2600);
    // in ogni caso non tratteniamo l'utente oltre 8 secondi
    const safety = setTimeout(() => useUI.getState().set({ entered: true }), 8000);
    return () => {
      clearTimeout(t);
      clearTimeout(safety);
    };
  }, []);

  const canGo = ready || webgl === "none";

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const loop = () => {
      const k = Math.min(1, (performance.now() - start) / 2400);
      setProgress((p) => Math.max(p, Math.min(canGo ? 1 : 0.86, k * (canGo ? 1 : 0.86))));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [canGo]);

  useEffect(() => {
    if (canGo && minElapsed && progress >= 1) {
      const t = setTimeout(() => set({ entered: true }), 350);
      return () => clearTimeout(t);
    }
  }, [canGo, minElapsed, progress, set]);

  useEffect(() => {
    document.documentElement.style.overflow = entered ? "" : "hidden";
  }, [entered]);

  return (
    <AnimatePresence>
      {!entered && (
        <motion.div
          key="loader"
          className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-night px-6"
          exit={{ opacity: 0, transition: { duration: 1.4, ease: [0.22, 1, 0.36, 1] } }}
          role="status"
          aria-live="polite"
          aria-label="Caricamento dell’esperienza"
        >
          <p className="flex flex-wrap justify-center gap-x-3 text-center font-serif text-[2rem] leading-tight font-light text-ivory italic sm:text-5xl">
            {WORDS.map((w, i) => (
              <motion.span
                key={w}
                initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.3 + i * 0.55, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
              >
                {w}
              </motion.span>
            ))}
          </p>
          <div className="mt-10 h-px w-40 overflow-hidden bg-ivory/10">
            <div className="h-full origin-left bg-champagne transition-transform duration-300" style={{ transform: `scaleX(${progress})` }} />
          </div>
          <p className="nums mt-4 text-[0.65rem] tracking-[0.4em] text-ivory/40 uppercase">
            Como · 21 · 11 · 2026
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
