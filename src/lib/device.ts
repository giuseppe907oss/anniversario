import type { Tier } from "./store";

export function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ||
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    if (!gl) return false;
    const lose = gl.getExtension("WEBGL_lose_context");
    lose?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function isTouchDevice() {
  return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
}

/**
 * Stima iniziale della potenza del dispositivo. Viene poi corretta a runtime
 * da <PerformanceMonitor> in base agli FPS reali.
 */
export function detectTier(): Tier {
  if (typeof window === "undefined") return "medium";
  const touch = isTouchDevice();
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const small = Math.min(window.screen.width, window.screen.height) < 500;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (saveData || mem <= 2 || cores <= 2) return "low";
  if (touch || small) return "medium";
  return "high";
}

/** Limite di device-pixel-ratio per livello: su iPhone (DPR 3) si rende a 1.5–1.75. */
export function dprRange(tier: Tier): [number, number] {
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const cap = tier === "high" ? 2 : tier === "medium" ? 1.6 : 1;
  return [Math.min(1, dpr), Math.min(cap, dpr)];
}

export const PARTICLE_SCALE: Record<Tier, number> = { high: 1, medium: 0.6, low: 0.3 };
