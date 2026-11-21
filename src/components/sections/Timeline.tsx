"use client";

import { CalendarCheck, MapPin, Navigation } from "lucide-react";
import { STAGES, type Stage } from "@/lib/content";
import { charsIn, fadeUp, gsap, maskIn, useGsap } from "@/lib/motion";
import { MagneticButton } from "../ui/MagneticButton";
import { SplitText } from "../ui/SplitText";
import { useNowStage } from "../ui/StageNav";

function StatusBadge({ stage }: { stage: Stage }) {
  if (stage.status === "booked")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-champagne/40 bg-champagne/10 px-3 py-1 text-[0.68rem] tracking-[0.14em] text-champagne uppercase">
        <CalendarCheck size={12} strokeWidth={2} /> Prenotazione confermata
      </span>
    );
  return null;
}

function StageCard({ stage, now }: { stage: Stage; now: boolean }) {
  const right = stage.index % 2 === 1;
  const ref = useGsap<HTMLDivElement>((el, reduced) => {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: el.parentElement, start: "top 35%", toggleActions: "play none none reverse" },
    });
    tl.add(maskIn(el.querySelector("[data-card]")!, reduced, { duration: 1.4 }));
    tl.add(charsIn(el.querySelectorAll("[data-time] .split-char"), reduced, { stagger: 0.05 }), 0.15);
    tl.add(charsIn(el.querySelectorAll("[data-title] .split-char"), reduced, { stagger: 0.02 }), 0.3);
    tl.add(fadeUp(el.querySelectorAll("[data-fade]"), reduced, { stagger: 0.07 }), 0.45);
  });

  const Icon = Navigation;

  return (
    <div
      ref={ref}
      className={`sticky top-0 flex h-svh items-end px-4 pb-[calc(1rem+var(--safe-bottom))] sm:px-8 md:items-center md:pb-0 ${
        right ? "md:justify-end" : "md:justify-start"
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-night/90 via-night/45 to-transparent md:hidden" />
      <article
        data-card
        aria-labelledby={`stage-title-${stage.index}`}
        className="glass relative w-full max-w-[27rem] rounded-[1.6rem] p-4 sm:p-7 md:mx-[4vw]"
      >
        <div data-fade className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[0.68rem] tracking-[0.36em] text-ivory/55 uppercase">
            Tappa <span className="nums text-champagne">{stage.number}</span>
          </span>
          <div className="flex items-center gap-2">
            {now && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blush/15 px-2.5 py-1 text-[0.65rem] tracking-[0.14em] text-blush uppercase">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blush" /> Adesso
              </span>
            )}
            <StatusBadge stage={stage} />
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between gap-3 sm:block">
          <div data-time className="flex items-baseline gap-2 sm:gap-3">
            <SplitText as="span" text={stage.time} className="nums font-serif text-[3rem] leading-none font-light text-ivory sm:text-7xl" />
            {stage.timeEnd && (
              <span className="nums font-serif text-xl text-ivory/50 sm:text-2xl">
                <SplitText text={`– ${stage.timeEnd}`} />
              </span>
            )}
          </div>
          <h3
            id={`stage-title-${stage.index}`}
            data-title
            className={`shrink-0 text-[0.68rem] tracking-[0.26em] text-champagne uppercase sm:mt-3 sm:pb-0 sm:text-left sm:text-[0.78rem] sm:tracking-[0.3em] pb-1 text-right`}
          >
            <SplitText text={stage.title} />
          </h3>
        </div>

        <p data-fade className="mt-2.5 font-serif text-[1.32rem] leading-[1.15] text-ivory italic sm:mt-3 sm:text-[1.8rem]">
          “{stage.quote}”
        </p>

        <p data-fade className="mt-2 text-[0.84rem] leading-snug text-ivory/65 max-sm:[@media(max-height:760px)]:line-clamp-2 sm:mt-3 sm:text-[0.92rem] sm:leading-relaxed">
          {stage.body}
        </p>

        <div data-fade className="mt-3 flex items-start gap-2 text-[0.8rem] text-ivory/60 sm:mt-4">
          <MapPin size={14} strokeWidth={1.8} className="mt-0.5 shrink-0 text-champagne" />
          <span className="min-w-0">
            <span className="text-ivory/85">{stage.location}</span>
            {stage.address && <span className="block truncate">{stage.address}</span>}
          </span>
        </div>

        {stage.id === "centro" && (
          <p data-fade className="mt-1.5 text-[0.64rem] leading-snug text-ivory/40">
            Duomo in 3D: interpretazione stilizzata, non una riproduzione architettonica.
          </p>
        )}
        {stage.id === "arrivo" && (
          <p data-fade className="mt-1.5 text-[0.64rem] leading-snug text-ivory/40">
            Mappa 3D decorativa; posizioni e percorso derivano da dati OpenStreetMap.
          </p>
        )}

        <div data-fade className="mt-3.5 flex flex-wrap gap-2 sm:mt-5">
          {stage.actions.map((a, i) => (
            <MagneticButton
              key={a.label}
              href={a.href}
              external
              variant={a.kind === "primary" ? "primary" : "ghost"}
              size="sm"
              strength={0.18}
            >
              {i === 0 && <Icon size={14} strokeWidth={1.9} />}
              {a.label}
            </MagneticButton>
          ))}
        </div>
      </article>
    </div>
  );
}

export function Timeline() {
  const now = useNowStage();
  const head = useGsap<HTMLDivElement>((el, reduced) => {
    gsap
      .timeline({ scrollTrigger: { trigger: el, start: "top 70%" } })
      .add(charsIn(el.querySelectorAll(".split-char"), reduced))
      .add(fadeUp(el.querySelectorAll("[data-fade]"), reduced), 0.4);
  });

  return (
    <section id="section-timeline" aria-labelledby="timeline-title" className="relative">
      <div ref={head} className="flex h-[90svh] flex-col items-center justify-center px-6 text-center">
        <p data-fade className="mb-5 text-[0.68rem] tracking-[0.42em] text-champagne uppercase">
          Sabato 21 novembre 2026
        </p>
        <h2 id="timeline-title" className="font-serif text-[clamp(2.6rem,10vw,5.5rem)] leading-none font-light text-ivory">
          <SplitText text="Il nostro pomeriggio" />
        </h2>
        <p data-fade className="mt-5 max-w-[30ch] text-[0.95rem] text-ivory/60">
          Da Varese al lago, cinque tappe unite da un solo filo di luce.
        </p>
      </div>
      {STAGES.map((s) => (
        <div key={s.id} id={`stage-${s.index}`} className="relative h-[180svh]">
          <StageCard stage={s} now={now === s.index} />
        </div>
      ))}
    </section>
  );
}
