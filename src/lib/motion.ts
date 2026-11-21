"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useLayoutEffect, useRef, type DependencyList } from "react";
import { isReducedMotion } from "./store";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
  gsap.config({ nullTargetWarn: false });
}

export { gsap, ScrollTrigger };

export const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Esegue animazioni GSAP dentro un contesto legato a un elemento:
 * tutto viene ripulito automaticamente allo smontaggio.
 */
export function useGsap<T extends HTMLElement>(
  build: (el: T, reduced: boolean) => void,
  deps: DependencyList = [],
) {
  const ref = useRef<T>(null);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => build(el, isReducedMotion()), el);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return ref;
}

/** Animazione d'ingresso delle lettere: salgono dalla maschera con una leggera rotazione. */
export function charsIn(target: gsap.TweenTarget, reduced: boolean, opts: gsap.TweenVars = {}) {
  if (reduced) return gsap.fromTo(target, { opacity: 0 }, { opacity: 1, duration: 0.8, ease: "power1.out", ...opts });
  return gsap.fromTo(
    target,
    { yPercent: 115, rotate: 7, opacity: 0 },
    { yPercent: 0, rotate: 0, opacity: 1, duration: 1.25, ease: "expo.out", stagger: 0.022, ...opts },
  );
}

export function fadeUp(target: gsap.TweenTarget, reduced: boolean, opts: gsap.TweenVars = {}) {
  if (reduced) return gsap.fromTo(target, { opacity: 0 }, { opacity: 1, duration: 0.6, ...opts });
  return gsap.fromTo(
    target,
    { y: 28, opacity: 0, filter: "blur(6px)" },
    { y: 0, opacity: 1, filter: "blur(0px)", duration: 1.1, ease: "power3.out", stagger: 0.08, ...opts },
  );
}

/** Rivelazione con maschera (clip-path) dal basso verso l'alto. */
export function maskIn(target: gsap.TweenTarget, reduced: boolean, opts: gsap.TweenVars = {}) {
  if (reduced) return gsap.fromTo(target, { opacity: 0 }, { opacity: 1, duration: 0.6, ...opts });
  return gsap.fromTo(
    target,
    { clipPath: "inset(100% 0% 0% 0%)", y: 20 },
    { clipPath: "inset(0% 0% 0% 0%)", y: 0, duration: 1.3, ease: "expo.out", ...opts },
  );
}
