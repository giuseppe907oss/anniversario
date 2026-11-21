"use client";

import { STAGES } from "./content";
import { gsap } from "./motion";
import { getLenis, measure, scrollState, scrollToY, sectionScrollY, stageScrollY } from "./scroll";
import { isReducedMotion, useUI } from "./store";

const wait = (ms: number, isCancelled: () => boolean) =>
  new Promise<void>((resolve) => {
    const start = performance.now();
    const tick = () => {
      if (isCancelled() || performance.now() - start >= ms) return resolve();
      requestAnimationFrame(tick);
    };
    tick();
  });

let token = 0;

/** Effetti di regia condivisi con il DOM (dissolvenza dopo il "tuffo"). */
export const fx = { flash: 0 };

/** Interrompe la modalità viaggio (es. quando l'utente tocca o scorre). */
export function stopJourney() {
  token++;
  const lenis = getLenis();
  if (lenis) lenis.scrollTo(lenis.scroll, { immediate: true, force: true });
  useUI.getState().set({ journey: false });
}

/**
 * Modalità viaggio: la storia scorre da sola, con pause su ogni tappa.
 * Qualsiasi interazione dell'utente la interrompe.
 */
export async function startJourney() {
  const my = ++token;
  const cancelled = () => my !== token;
  useUI.getState().set({ journey: true });

  const interrupt = () => {
    if (!cancelled()) stopJourney();
  };
  const opts: AddEventListenerOptions = { passive: true, once: true };
  // l'ascolto parte dopo il tocco che ha avviato il viaggio
  setTimeout(() => {
    if (cancelled()) return;
    window.addEventListener("wheel", interrupt, opts);
    window.addEventListener("touchstart", interrupt, opts);
    window.addEventListener("keydown", interrupt, opts);
  }, 400);

  const reduced = isReducedMotion();
  const dur = (d: number) => (reduced ? 0.01 : d);
  try {
    measure();
    const vh = scrollState.vh;
    if (scrollState.y < sectionScrollY("timeline") - vh) {
      await scrollToY(sectionScrollY("timeline") + vh * 0.2, { duration: dur(3.2), immediate: reduced });
    }
    for (let i = 0; i < STAGES.length && !cancelled(); i++) {
      await scrollToY(stageScrollY(i), { duration: dur(i === 0 ? 2.6 : 4.2), immediate: reduced });
      await wait(reduced ? 6000 : 5600, cancelled);
    }
    if (!cancelled()) {
      await scrollToY(sectionScrollY("map"), { duration: dur(3), immediate: reduced });
      await wait(4500, cancelled);
    }
    if (!cancelled()) {
      const finaleEnd = sectionScrollY("finale") + (document.getElementById("section-finale")?.offsetHeight ?? vh) - vh;
      await scrollToY(finaleEnd, { duration: dur(6), immediate: reduced });
    }
  } finally {
    window.removeEventListener("wheel", interrupt);
    window.removeEventListener("touchstart", interrupt);
    window.removeEventListener("keydown", interrupt);
    if (!cancelled()) useUI.getState().set({ journey: false });
  }
}

/**
 * CTA dell'hero: la camera "si tuffa" verso la città, dissolvenza,
 * e il racconto riprende dal bouquet.
 */
export function diveIntoStory() {
  const ui = useUI.getState();
  if (ui.heroDive) return;
  const reduced = isReducedMotion();
  const target = () => sectionScrollY("intro") + scrollState.vh * 0.15;
  if (reduced) {
    scrollToY(target(), { duration: 1.2 });
    return;
  }
  ui.set({ heroDive: true });
  gsap.to(scrollState, {
    dive: 1,
    duration: 2.4,
    ease: "power2.inOut",
    onComplete: () => {
      fx.flash = 1;
      scrollToY(target(), { immediate: true }).then(() => {
        scrollState.dive = 0;
        gsap.to(fx, {
          flash: 0,
          duration: 1.6,
          delay: 0.15,
          ease: "power2.out",
          onComplete: () => useUI.getState().set({ heroDive: false }),
        });
      });
    },
  });
}
