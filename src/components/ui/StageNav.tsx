"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { STAGES, romeMinutesToday } from "@/lib/content";
import { stopJourney } from "@/lib/journey";
import { scrollToY, stageScrollY } from "@/lib/scroll";
import { useUI } from "@/lib/store";

/** Indice della tappa in corso adesso (solo il 21/11/2026, ora di Roma). */
export function useNowStage() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const calc = () => {
      const m = romeMinutesToday();
      if (m === null) return setNow(null);
      const i = STAGES.findIndex((s) => s.window && m >= s.window[0] && m < s.window[1]);
      setNow(i >= 0 ? i : null);
    };
    calc();
    const t = setInterval(calc, 30_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Navigazione diretta tra le tappe: orizzontale su iPhone, verticale su desktop. */
export function StageNav() {
  const active = useUI((s) => s.activeSection);
  const stage = useUI((s) => s.activeStage);
  const now = useNowStage();
  const visible = active === "timeline";

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          aria-label="Vai a una tappa"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="fixed z-40 max-md:inset-x-0 max-md:top-[calc(4.4rem+var(--safe-top))] max-md:flex max-md:justify-center md:top-1/2 md:right-6 md:-translate-y-1/2"
        >
          <ol className="glass flex gap-1 rounded-full p-1 md:flex-col">
            {STAGES.map((s) => {
              const on = s.index === stage;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      stopJourney();
                      scrollToY(stageScrollY(s.index), { duration: 1.8 });
                    }}
                    aria-current={on ? "step" : undefined}
                    aria-label={`Tappa ${s.number}: ${s.title}`}
                    className="relative grid h-9 w-9 place-items-center rounded-full text-[0.7rem] font-medium tracking-wider transition-colors"
                  >
                    {on && (
                      <motion.span
                        layoutId="stage-pill"
                        className="absolute inset-0 rounded-full bg-champagne"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    <span className={`nums relative ${on ? "text-night" : "text-ivory/65"}`}>{s.number}</span>
                    {now === s.index && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blush ring-2 ring-night" aria-label="in corso adesso" />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
