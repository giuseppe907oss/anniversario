"use client";

import { RotateCcw } from "lucide-react";
import { charsIn, fadeUp, gsap, useGsap } from "@/lib/motion";
import { scrollToY } from "@/lib/scroll";
import { MagneticButton } from "../ui/MagneticButton";
import { SplitText } from "../ui/SplitText";

export function Finale() {
  const ref = useGsap<HTMLElement>((el, reduced) => {
    const words = el.querySelectorAll("[data-line='1'] .split-char");
    if (reduced) {
      gsap.fromTo(words, { opacity: 0 }, { opacity: 1, scrollTrigger: { trigger: el, start: "20% 50%" } });
    } else {
      gsap.fromTo(
        words,
        { opacity: 0.06, y: 20, filter: "blur(10px)" },
        { opacity: 1, y: 0, filter: "blur(0px)", stagger: 0.12, ease: "none", scrollTrigger: { trigger: el, start: "10% 60%", end: "45% 50%", scrub: 0.8 } },
      );
    }
    gsap
      .timeline({ scrollTrigger: { trigger: el, start: "48% 50%", toggleActions: "play none none reverse" } })
      .add(charsIn(el.querySelectorAll("[data-line='2'] .split-char"), reduced, { stagger: 0.045, duration: 1.8 }))
      .add(fadeUp(el.querySelectorAll("[data-fade]"), reduced), 1.2);
  });

  return (
    <section id="section-finale" ref={ref} aria-labelledby="finale-title" className="relative h-[240svh]">
      <div className="sticky top-0 flex h-svh flex-col items-center justify-center px-6 text-center">
        <h2 id="finale-title" data-line="1" className="mx-auto max-w-[18ch] font-serif text-[clamp(2rem,7.6vw,4.4rem)] leading-[1.06] font-light text-ivory">
          <SplitText text="Non importa dove andiamo. Il mio posto preferito resta accanto a te." mode="words" />
        </h2>
        <p data-line="2" className="mt-10 font-serif text-[clamp(2.4rem,10vw,5.6rem)] leading-none italic">
          <SplitText text="Buon anniversario, Milena." className="text-champagne [text-shadow:0_0_42px_rgba(216,188,138,0.35)]" />
        </p>
        <div data-fade className="mt-10 flex flex-col items-center gap-6">
          <p className="nums text-[0.68rem] tracking-[0.42em] text-ivory/45 uppercase">Giuseppe · Como · 21.11.2026</p>
          <MagneticButton variant="ghost" onClick={() => scrollToY(0, { duration: 3.2 })}>
            <RotateCcw size={14} strokeWidth={1.8} /> Rivivi il viaggio
          </MagneticButton>
        </div>
        <footer
          data-fade
          className="absolute inset-x-0 px-6 text-[0.62rem] leading-relaxed text-ivory/30"
          style={{ bottom: "calc(1rem + var(--safe-bottom))" }}
        >
          Scene 3D e colonna sonora originali, generate in tempo reale. Dati cartografici © OpenStreetMap contributors.
        </footer>
      </div>
    </section>
  );
}
