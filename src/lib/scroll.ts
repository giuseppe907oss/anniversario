"use client";

import type Lenis from "lenis";
import { STAGES } from "./content";
import { useUI, type SectionId } from "./store";

/**
 * Stato di scroll condiviso tra DOM e scene 3D.
 * È un oggetto mutabile (non React state): viene letto a ogni frame da useFrame
 * senza provocare re-render.
 */
export const SECTION_ORDER: SectionId[] = ["hero", "intro", "timeline", "map", "finale"];

export const scrollState = {
  y: 0,
  vh: 1,
  velocity: 0,
  progress: { hero: 0, intro: 0, timeline: 0, map: 0, finale: 0 } as Record<SectionId, number>,
  /** Sezione al centro del viewport. */
  active: "hero" as SectionId,
  /** 0..1 — dissolvenza al nero tra una scena e l'altra. */
  veil: 0,
  /** Posizione continua nella timeline: i = tappa i al centro dello schermo. */
  stageFloat: -1,
  /** 0..1 — animazione del "tuffo" della camera dopo il CTA dell'hero. */
  dive: 0,
};

type Rect = { top: number; height: number };
const rects: Partial<Record<SectionId, Rect>> = {};
let stageHeight = 1;
let stageTop = 0;

let lenis: Lenis | null = null;
export const setLenis = (l: Lenis | null) => (lenis = l);
export const getLenis = () => lenis;

export function measure() {
  if (typeof window === "undefined") return;
  const sy = window.scrollY;
  scrollState.vh = window.innerHeight || 1;
  for (const id of SECTION_ORDER) {
    const el = document.getElementById(`section-${id}`);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    rects[id] = { top: r.top + sy, height: r.height };
  }
  const first = document.getElementById("stage-0");
  if (first) {
    const r = first.getBoundingClientRect();
    stageTop = r.top + sy;
    stageHeight = r.height || 1;
  }
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

let lastY = 0;
export function updateScroll() {
  if (typeof window === "undefined") return;
  const y = lenis ? lenis.scroll : window.scrollY;
  const vh = scrollState.vh;
  scrollState.velocity = y - lastY;
  lastY = y;
  scrollState.y = y;

  const mid = y + vh * 0.5;
  let active: SectionId = scrollState.active;
  let veil = 0;

  for (let i = 0; i < SECTION_ORDER.length; i++) {
    const id = SECTION_ORDER[i];
    const r = rects[id];
    if (!r) continue;
    const span = r.height > vh ? r.height - vh : r.height;
    scrollState.progress[id] = clamp01((y - r.top) / span);
    if (mid >= r.top && mid < r.top + r.height) active = id;
    if (i > 0) {
      // il "taglio" avviene quando il bordo superiore della sezione passa a metà schermo
      const d = Math.abs(mid - r.top) / (vh * 0.32);
      if (d < 1) {
        const v = 1 - d;
        veil = Math.max(veil, v * v * (3 - 2 * v));
      }
    }
  }

  scrollState.veil = veil;
  scrollState.stageFloat = (mid - stageTop) / stageHeight - 0.5;

  if (active !== scrollState.active) {
    scrollState.active = active;
    useUI.getState().set({ activeSection: active });
  }
  const stage = Math.max(0, Math.min(STAGES.length - 1, Math.round(scrollState.stageFloat)));
  if (stage !== useUI.getState().activeStage) useUI.getState().set({ activeStage: stage });
}

/** Posizione di scroll che porta il centro della tappa i al centro dello schermo. */
export function stageScrollY(i: number) {
  measure();
  return stageTop + (i + 0.5) * stageHeight - scrollState.vh * 0.5;
}

export function sectionScrollY(id: SectionId, offset = 0) {
  measure();
  const r = rects[id];
  return r ? r.top + offset : 0;
}

export function scrollToY(y: number, opts: { duration?: number; immediate?: boolean } = {}) {
  return new Promise<void>((resolve) => {
    if (lenis && !opts.immediate) {
      lenis.scrollTo(y, {
        duration: opts.duration ?? 1.6,
        easing: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
        onComplete: () => resolve(),
        force: true,
      });
    } else {
      window.scrollTo({ top: y, behavior: opts.immediate ? "auto" : "smooth" });
      setTimeout(resolve, opts.immediate ? 30 : (opts.duration ?? 1.2) * 1000);
    }
  });
}
