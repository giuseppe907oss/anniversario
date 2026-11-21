"use client";

import { create } from "zustand";

export type SectionId = "hero" | "intro" | "timeline" | "map" | "finale";
export type Tier = "high" | "medium" | "low";

interface UIState {
  /** La prima scena 3D è stata compilata e disegnata. */
  sceneReady: boolean;
  /** Il loader è stato chiuso. */
  entered: boolean;
  webgl: "unknown" | "ok" | "none";
  tier: Tier;
  systemReducedMotion: boolean;
  /** Override manuale dell'utente (null = segue il sistema). */
  userReducedMotion: boolean | null;
  audioOn: boolean;
  audioSupported: boolean;
  activeSection: SectionId;
  activeStage: number;
  journey: boolean;
  heroDive: boolean;
  set: (p: Partial<UIState>) => void;
}

export const useUI = create<UIState>((set) => ({
  sceneReady: false,
  entered: false,
  webgl: "unknown",
  tier: "medium",
  systemReducedMotion: false,
  userReducedMotion: null,
  audioOn: false,
  audioSupported: true,
  activeSection: "hero",
  activeStage: 0,
  journey: false,
  heroDive: false,
  set: (p) => set(p),
}));

export const selectReducedMotion = (s: UIState) => s.userReducedMotion ?? s.systemReducedMotion;
export const isReducedMotion = () => selectReducedMotion(useUI.getState());
