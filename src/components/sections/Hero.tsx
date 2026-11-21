"use client";

import { ArrowDown } from "lucide-react";
import { useEffect, useRef } from "react";
import { charsIn, fadeUp, gsap, useGsap } from "@/lib/motion";
import { diveIntoStory } from "@/lib/journey";
import { scrollState } from "@/lib/scroll";
import { useUI } from "@/lib/store";
import { MagneticButton } from "../ui/MagneticButton";
import { SplitText } from "../ui/SplitText";

export function Hero() {
  const entered = useUI((s) => s.entered);
  const dive = useUI((s) => s.heroDive);
  const inner = useRef<HTMLDivElement>(null);

  const ref = useGsap<HTMLElement>(
    (el, reduced) => {
      if (!entered) {
        gsap.set(el.querySelectorAll(".split-char, [data-fade]"), { opacity: 0 });
        return;
      }
      const tl = gsap.timeline({ delay: 0.2 });
      tl.add(fadeUp(el.querySelectorAll("[data-fade='eyebrow']"), reduced));
      tl.add(charsIn(el.querySelectorAll("h1 .split-char"), reduced, { stagger: 0.035, duration: 1.6 }), 0.25);
      tl.add(fadeUp(el.querySelectorAll("[data-fade='sub']"), reduced, { stagger: 0.18 }), 1.1);
      tl.add(fadeUp(el.querySelectorAll("[data-fade='cta']"), reduced), 1.7);
    },
    [entered],
  );

  // parallasse del testo durante lo scroll dell'hero
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const p = scrollState.progress.hero;
      if (inner.current) {
        inner.current.style.transform = `translate3d(0, ${-p * 18}vh, 0)`;
        inner.current.style.opacity = String(Math.max(0, 1 - p * 1.6 - scrollState.dive * 1.5));
        inner.current.style.filter = `blur(${(p * 6 + scrollState.dive * 8).toFixed(2)}px)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section id="section-hero" ref={ref} aria-labelledby="hero-title" className="relative h-[150svh]">
      <div className="sticky top-0 flex h-svh flex-col items-center justify-center overflow-hidden px-6 text-center">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_42%_at_50%_48%,rgba(9,9,13,0.55),transparent_75%)]" />
        <div ref={inner} className="relative flex flex-col items-center will-change-transform">
          <p data-fade="eyebrow" className="mb-7 text-[0.68rem] tracking-[0.42em] text-champagne uppercase">
            Giuseppe <span className="text-blush">&</span> Milena
          </p>
          <h1 id="hero-title" className="max-w-[13ch] font-serif text-[clamp(3.1rem,13vw,8.5rem)] leading-[0.92] font-light tracking-[-0.01em] text-ivory">
            <SplitText text="Una sera, soltanto noi." />
          </h1>
          <p data-fade="sub" className="nums mt-7 text-sm tracking-[0.36em] text-ivory/80 uppercase">
            Como <span className="mx-1.5 text-champagne">·</span> 21 novembre 2026
          </p>
          <p data-fade="sub" className="mt-5 max-w-[26ch] font-serif text-xl leading-snug text-ivory/70 italic sm:text-2xl">
            Ogni momento è più bello quando lo condivido con te.
          </p>
          <div data-fade="cta" className="mt-10">
            <MagneticButton onClick={diveIntoStory} ariaLabel="Scopri la nostra serata" className={dive ? "pointer-events-none" : ""}>
              Scopri la nostra serata
              <ArrowDown size={16} strokeWidth={1.8} className="transition-transform duration-500 group-hover:translate-y-0.5" />
            </MagneticButton>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 text-[0.6rem] tracking-[0.4em] text-ivory/45 uppercase transition-opacity duration-700"
          style={{ bottom: "calc(1.5rem + var(--safe-bottom))", opacity: entered ? 1 : 0 }}
        >
          Scorri
          <span className="relative block h-10 w-px overflow-hidden bg-ivory/10">
            <span className="scroll-cue absolute inset-0 bg-champagne" />
          </span>
        </div>
      </div>
    </section>
  );
}
