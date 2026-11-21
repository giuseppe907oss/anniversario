"use client";

import Lenis from "lenis";
import dynamic from "next/dynamic";
import { Component, useEffect, useRef, type ReactNode } from "react";
import { getAudio } from "@/lib/audio";
import { detectTier, detectWebGL } from "@/lib/device";
import { fx } from "@/lib/journey";
import { gsap, ScrollTrigger } from "@/lib/motion";
import { measure, scrollState, setLenis, updateScroll } from "@/lib/scroll";
import { selectReducedMotion, useUI } from "@/lib/store";
import { Hero } from "./sections/Hero";
import { Intro } from "./sections/Intro";
import { Timeline } from "./sections/Timeline";
import { MapSection } from "./sections/MapSection";
import { Finale } from "./sections/Finale";
import { TopBar } from "./ui/TopBar";
import { StageNav } from "./ui/StageNav";
import { Loader } from "./ui/Loader";
import { Fallback2D } from "./ui/Fallback2D";

const StageCanvas = dynamic(() => import("./canvas/StageCanvas"), { ssr: false });

/** Se qualcosa va storto nel WebGL, si passa alla versione 2D senza interrompere il racconto. */
class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn("[Como] scena 3D non disponibile, attivo la versione 2D:", err);
    useUI.getState().set({ webgl: "none", sceneReady: true });
  }
  render() {
    return this.state.failed ? <Fallback2D /> : this.props.children;
  }
}

export default function Experience() {
  const webgl = useUI((s) => s.webgl);
  const entered = useUI((s) => s.entered);
  const reduced = useUI(selectReducedMotion);
  const set = useUI((s) => s.set);
  const veil = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // rilevamento capacità del dispositivo e preferenze di sistema
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ok = detectWebGL();
    set({
      webgl: ok ? "ok" : "none",
      tier: detectTier(),
      systemReducedMotion: mq.matches,
      audioSupported: getAudio().supported,
    });
    if (!ok) set({ sceneReady: true });
    const onChange = () => set({ systemReducedMotion: mq.matches });
    mq.addEventListener("change", onChange);
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    return () => mq.removeEventListener("change", onChange);
  }, [set]);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduced);
  }, [reduced]);

  // scrolling fluido (Lenis) + un unico ticker per DOM e 3D
  useEffect(() => {
    let lenis: Lenis | null = null;
    if (!reduced) {
      lenis = new Lenis({ duration: 1.3, smoothWheel: true, syncTouch: false, autoRaf: false, wheelMultiplier: 0.9 });
      lenis.on("scroll", ScrollTrigger.update);
      if (!useUI.getState().entered) lenis.stop();
    }
    lenisRef.current = lenis;
    setLenis(lenis);
    measure();

    const tick = (time: number) => {
      lenis?.raf(time * 1000);
      updateScroll();
      if (veil.current) {
        const d = Math.min(1, Math.max(0, (scrollState.dive - 0.62) / 0.38));
        const v = Math.max(scrollState.veil * 0.94, d * d * (3 - 2 * d), fx.flash);
        veil.current.style.opacity = v.toFixed(3);
      }
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    if (!lenis) {
      const onScroll = () => ScrollTrigger.update();
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        window.removeEventListener("scroll", onScroll);
        gsap.ticker.remove(tick);
        setLenis(null);
      };
    }
    return () => {
      gsap.ticker.remove(tick);
      lenis?.destroy();
      setLenis(null);
    };
  }, [reduced]);

  useEffect(() => {
    if (entered) {
      lenisRef.current?.start();
      measure();
      ScrollTrigger.refresh();
    }
  }, [entered]);

  // misure delle sezioni
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const remeasure = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        measure();
        updateScroll();
      }, 120);
    };
    window.addEventListener("resize", remeasure);
    window.addEventListener("orientationchange", remeasure);
    ScrollTrigger.addEventListener("refresh", measure);
    document.fonts?.ready.then(() => {
      measure();
      ScrollTrigger.refresh();
    });
    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("orientationchange", remeasure);
      ScrollTrigger.removeEventListener("refresh", measure);
    };
  }, []);

  return (
    <>
      <a
        href="#section-timeline"
        className="sr-only z-[90] rounded-full bg-champagne px-4 py-2 text-night focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Vai al programma
      </a>

      <div className="fixed inset-x-0 top-0 z-0 h-lvh" aria-hidden="true">
        {webgl === "ok" && (
          <CanvasBoundary>
            <StageCanvas />
          </CanvasBoundary>
        )}
        {webgl === "none" && <Fallback2D />}
      </div>
      <div ref={veil} className="pointer-events-none fixed inset-0 z-[1] bg-night" style={{ opacity: 0 }} aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="film-grain" aria-hidden="true" />

      <TopBar />
      <StageNav />

      <main className="relative z-10">
        <Hero />
        <Intro />
        <Timeline />
        <MapSection />
        <Finale />
      </main>

      <Loader />
    </>
  );
}
