"use client";

import { Play } from "lucide-react";
import { gsap, useGsap } from "@/lib/motion";
import { startJourney } from "@/lib/journey";
import { MagneticButton } from "../ui/MagneticButton";
import { SplitText } from "../ui/SplitText";

/** 5 — La sorpresa: il bouquet sospeso e le prime parole. */
export function Intro() {
  const ref = useGsap<HTMLElement>((el, reduced) => {
    const words = el.querySelectorAll("[data-line='1'] .split-char");
    const st = { trigger: el, start: "top 60%", end: "45% 50%", scrub: reduced ? false : 0.8 };
    if (reduced) {
      gsap.fromTo(words, { opacity: 0 }, { opacity: 1, duration: 0.8, scrollTrigger: { trigger: el, start: "top 50%" } });
    } else {
      gsap.fromTo(
        words,
        { opacity: 0.08, y: 24, filter: "blur(8px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", stagger: 0.1, ease: "none", scrollTrigger: st },
      );
    }
    gsap.fromTo(
      el.querySelectorAll("[data-line='2']"),
      { opacity: 0, y: reduced ? 0 : 18 },
      {
        opacity: 1,
        y: 0,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "38% 50%", end: "55% 50%", scrub: reduced ? false : 0.8, toggleActions: "play none none reverse" },
      },
    );
    gsap.fromTo(
      el.querySelectorAll("[data-line='3']"),
      { opacity: 0, y: reduced ? 0 : 18 },
      {
        opacity: 1,
        y: 0,
        ease: "power2.out",
        scrollTrigger: { trigger: el, start: "58% 50%", end: "70% 50%", scrub: reduced ? false : 0.8, toggleActions: "play none none reverse" },
      },
    );
  });

  return (
    <section id="section-intro" ref={ref} aria-labelledby="intro-title" className="relative h-[280svh]">
      <div className="sticky top-0 flex h-svh flex-col items-center justify-end px-6 pb-[calc(3.5rem+var(--safe-bottom))] text-center md:items-start md:justify-center md:pb-0 md:pl-[8vw] md:text-left">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-night via-night/70 to-transparent md:hidden" />
        <div className="relative md:max-w-[34rem]">
          <p className="mb-5 text-[0.68rem] tracking-[0.42em] text-champagne uppercase">La sorpresa</p>
          <h2 id="intro-title" data-line="1" className="mx-auto max-w-[17ch] md:mx-0 font-serif text-[clamp(2.2rem,8.4vw,4.6rem)] leading-[1.02] font-light text-ivory">
            <SplitText text="Le cose più belle iniziano con un piccolo gesto." mode="words" />
          </h2>
          <p data-line="2" className="mx-auto mt-6 max-w-[30ch] md:mx-0 font-serif text-xl text-blush italic sm:text-2xl">
            Un fiore per ricordarti quanto sei speciale.
          </p>
          <div data-line="3" className="mt-9 flex flex-col items-center gap-3 md:items-start">
            <MagneticButton onClick={startJourney} variant="secondary">
              <Play size={15} strokeWidth={1.8} /> Inizia il nostro viaggio
            </MagneticButton>
            <span className="text-xs text-ivory/45">oppure continua a scorrere</span>
          </div>
        </div>
      </div>
    </section>
  );
}
