"use client";

import { AnimatePresence, motion } from "motion/react";
import { Menu, Pause, Play, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { STAGES } from "@/lib/content";
import { getAudio } from "@/lib/audio";
import { startJourney, stopJourney } from "@/lib/journey";
import { scrollState, scrollToY, sectionScrollY, stageScrollY } from "@/lib/scroll";
import { selectReducedMotion, useUI, type SectionId } from "@/lib/store";

const CHAPTERS: Record<SectionId, string> = {
  hero: "L’inizio del viaggio",
  intro: "La sorpresa",
  timeline: "Il nostro pomeriggio",
  map: "La mappa",
  finale: "Per te",
};

function AudioToggle() {
  const on = useUI((s) => s.audioOn);
  const supported = useUI((s) => s.audioSupported);
  const set = useUI((s) => s.set);
  if (!supported) return null;
  const toggle = async () => {
    const a = getAudio();
    if (on) {
      a.stop();
      set({ audioOn: false });
    } else {
      const ok = await a.start();
      set({ audioOn: ok });
    }
  };
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? "Disattiva la colonna sonora" : "Attiva la colonna sonora"}
      className="glass relative flex h-11 items-center gap-2 rounded-full px-3.5 text-ivory/85 transition-colors hover:text-ivory"
    >
      {on ? <Volume2 size={17} strokeWidth={1.6} /> : <VolumeX size={17} strokeWidth={1.6} />}
      <span className="flex h-3.5 items-end gap-[2px]" aria-hidden="true">
        {[0.5, 1, 0.7, 0.9].map((h, i) => (
          <motion.span
            key={i}
            className="w-[2px] rounded-full bg-champagne"
            animate={on ? { height: [`${h * 40}%`, "100%", `${h * 60}%`, `${h * 90}%`] } : { height: "20%" }}
            transition={on ? { duration: 1.4 + i * 0.2, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" } : { duration: 0.4 }}
          />
        ))}
      </span>
      <span className="sr-only sm:not-sr-only sm:text-xs sm:tracking-[0.14em] sm:uppercase">{on ? "Musica" : "Musica"}</span>
    </motion.button>
  );
}

function MotionToggle() {
  const reduced = useUI(selectReducedMotion);
  const set = useUI((s) => s.set);
  return (
    <button
      type="button"
      onClick={() => set({ userReducedMotion: !reduced })}
      aria-pressed={reduced}
      className="w-full rounded-2xl border border-ivory/10 px-4 py-3.5 text-left transition-colors hover:border-ivory/25"
    >
      <span className="block text-sm text-ivory">Riduci movimento</span>
      <span className="mt-0.5 block text-xs text-ivory/55">
        {reduced ? "Attivo: animazioni essenziali, camera stabile." : "Disattivo: esperienza cinematografica completa."}
      </span>
      <span
        aria-hidden="true"
        className={`mt-3 flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${reduced ? "bg-champagne" : "bg-ivory/15"}`}
      >
        <span className={`h-5 w-5 rounded-full bg-night transition-transform ${reduced ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

export function TopBar() {
  const active = useUI((s) => s.activeSection);
  const stage = useUI((s) => s.activeStage);
  const journey = useUI((s) => s.journey);
  const entered = useUI((s) => s.entered);
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // barra di avanzamento globale
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const max = document.documentElement.scrollHeight - scrollState.vh;
      const p = max > 0 ? scrollState.y / max : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const label = active === "timeline" ? `${STAGES[stage].number} — ${STAGES[stage].title}` : CHAPTERS[active];

  const go = (fn: () => number) => {
    setOpen(false);
    stopJourney();
    setTimeout(() => scrollToY(fn(), { duration: 2 }), 50);
  };

  return (
    <>
      <header
        className="pointer-events-none fixed inset-x-0 top-0 z-50 transition-opacity duration-1000"
        style={{ opacity: entered ? 1 : 0, paddingTop: "var(--safe-top)" }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-ivory/10">
          <div ref={bar} className="h-full origin-left bg-gradient-to-r from-champagne/60 via-champagne to-blush" style={{ transform: "scaleX(0)" }} />
        </div>
        <div className="pointer-events-auto mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 pt-3 sm:px-8 sm:pt-5">
          <button
            type="button"
            onClick={() => go(() => 0)}
            className="flex h-11 items-center gap-3 rounded-full pr-2 font-serif text-xl italic text-ivory"
            aria-label="Torna all’inizio"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full border border-champagne/35 text-[0.95rem] whitespace-nowrap">
              <span>
                G<span className="text-champagne">&</span>M
              </span>
            </span>
          </button>

          <div className="hidden min-w-0 flex-1 justify-center md:flex" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.span
                key={label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.5 }}
                className="truncate text-[0.7rem] tracking-[0.32em] text-ivory/60 uppercase"
              >
                {label}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-2">
            <AudioToggle />
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              onClick={() => setOpen(true)}
              className="glass grid h-11 w-11 place-items-center rounded-full text-ivory/85"
              aria-label="Apri il menu delle tappe"
              aria-expanded={open}
              aria-controls="menu-tappe"
            >
              <Menu size={18} strokeWidth={1.6} />
            </motion.button>
          </div>
        </div>
      </header>

      {/* pill della modalità viaggio */}
      <AnimatePresence>
        {journey && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={stopJourney}
            className="glass fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-5 py-3 text-sm text-ivory"
            style={{ bottom: "calc(1rem + var(--safe-bottom))" }}
          >
            <Pause size={15} strokeWidth={1.8} /> Interrompi il viaggio
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            id="menu-tappe"
            role="dialog"
            aria-modal="true"
            aria-label="Tappe della serata"
            className="fixed inset-0 z-[70] flex justify-end bg-night/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.nav
              className="glass flex h-full w-full max-w-md flex-col overflow-y-auto rounded-l-[2rem] bg-anthracite/70 px-6 pb-8"
              style={{ paddingTop: "calc(1.25rem + var(--safe-top))" }}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <span className="text-[0.7rem] tracking-[0.32em] text-champagne uppercase">Il viaggio</span>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid h-11 w-11 place-items-center rounded-full border border-ivory/15"
                  aria-label="Chiudi il menu"
                >
                  <X size={18} strokeWidth={1.6} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setTimeout(() => (journey ? stopJourney() : startJourney()), 80);
                }}
                className="mt-6 flex min-h-14 items-center justify-between rounded-2xl bg-champagne px-5 text-night"
              >
                <span className="font-medium">{journey ? "Interrompi il viaggio" : "Inizia il nostro viaggio"}</span>
                {journey ? <Pause size={18} /> : <Play size={18} />}
              </button>

              <ol className="mt-6 space-y-1">
                <li>
                  <MenuLink n="·" title="L’inizio" sub="Como · 21 novembre 2026" onClick={() => go(() => 0)} />
                </li>
                <li>
                  <MenuLink n="·" title="La sorpresa" sub="Un piccolo gesto" onClick={() => go(() => sectionScrollY("intro") + scrollState.vh * 0.3)} />
                </li>
                {STAGES.map((s) => (
                  <li key={s.id}>
                    <MenuLink
                      n={s.number}
                      title={s.title}
                      sub={s.time ? `${s.time}${s.timeEnd ? `–${s.timeEnd}` : ""} · ${s.location}` : `${s.timeLabel} · ${s.location}`}
                      onClick={() => go(() => stageScrollY(s.index))}
                    />
                  </li>
                ))}
                <li>
                  <MenuLink n="·" title="La mappa" sub="Percorso a piedi reale" onClick={() => go(() => sectionScrollY("map"))} />
                </li>
                <li>
                  <MenuLink n="·" title="Il finale" sub="Per Milena" onClick={() => go(() => sectionScrollY("finale") + scrollState.vh * 0.5)} />
                </li>
              </ol>

              <div className="mt-6">
                <MotionToggle />
              </div>
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MenuLink({ n, title, sub, onClick }: { n: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-baseline gap-4 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-ivory/5"
    >
      <span className="nums w-6 shrink-0 font-serif text-lg text-champagne/80">{n}</span>
      <span className="min-w-0">
        <span className="block font-serif text-2xl leading-tight text-ivory transition-transform duration-500 group-hover:translate-x-1">
          {title}
        </span>
        <span className="block truncate text-xs text-ivory/50">{sub}</span>
      </span>
    </button>
  );
}
