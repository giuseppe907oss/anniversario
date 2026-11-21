"use client";

import { useUI, type SectionId } from "@/lib/store";

/**
 * Versione 2D (senza WebGL): fondali illustrati in SVG/CSS per ogni capitolo.
 * Stessa palette e stessa regia, senza scene tridimensionali.
 */
const BACKGROUNDS: Record<SectionId, string> = {
  hero: "linear-gradient(180deg,#141127 0%,#3b2338 38%,#c77a5c 58%,#2a1a24 62%,#07070c 100%)",
  intro: "radial-gradient(70% 50% at 50% 38%,#5a2236 0%,#1c0f18 55%,#060508 100%)",
  timeline: "radial-gradient(80% 60% at 50% 30%,#2a1d36 0%,#12101c 55%,#060508 100%)",
  map: "#09090D",
  finale: "radial-gradient(70% 55% at 50% 60%,#3a1424 0%,#0c0709 60%,#030304 100%)",
};

export function Fallback2D() {
  const active = useUI((s) => s.activeSection);
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      {(Object.keys(BACKGROUNDS) as SectionId[]).map((k) => (
        <div
          key={k}
          className="absolute inset-0 transition-opacity duration-[1400ms]"
          style={{ background: BACKGROUNDS[k], opacity: active === k ? 1 : 0 }}
        />
      ))}
      {/* lago al crepuscolo: montagne, riflessi, luci */}
      <svg
        className="absolute inset-x-0 bottom-0 h-[62%] w-full transition-opacity duration-[1400ms]"
        style={{ opacity: active === "hero" ? 1 : 0 }}
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMax slice"
      >
        <defs>
          <linearGradient id="fw" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#d48a64" stopOpacity="0.55" />
            <stop offset="1" stopColor="#07070c" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path d="M0 120 L40 70 L80 95 L120 50 L160 92 L200 74 L240 104 L270 62 L320 98 L360 66 L400 96 L400 128 L0 128Z" fill="#2b1d2c" />
        <path d="M0 128 L50 96 L100 116 L150 90 L210 118 L260 96 L310 120 L360 100 L400 118 L400 132 L0 132Z" fill="#1a1220" />
        <rect y="130" width="400" height="170" fill="url(#fw)" />
        {Array.from({ length: 28 }).map((_, i) => (
          <g key={i}>
            <circle cx={10 + i * 14.2} cy={128 + (i % 3)} r="1" fill="#ffd29a" />
            <rect x={9.6 + i * 14.2} y={133} width="0.8" height={18 + (i % 5) * 7} fill="#ffd29a" opacity="0.25" />
          </g>
        ))}
      </svg>
    </div>
  );
}
