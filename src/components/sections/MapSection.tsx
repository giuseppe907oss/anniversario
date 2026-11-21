"use client";

import { Car, ExternalLink, Footprints, Maximize2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import route from "@/data/route.json";
import { MAP_STOPS, PLACES, gmaps } from "@/lib/content";
import { fadeUp, gsap, useGsap } from "@/lib/motion";
import { MagneticButton } from "../ui/MagneticButton";

const RouteMap = dynamic(() => import("../map/RouteMap").then((m) => m.RouteMap), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-[1.5rem] border border-ivory/10 bg-anthracite" />,
});

const legs = route.legs as { distance: number; duration: number }[];
const totalM = legs.reduce((a, l) => a + l.distance, 0);
const fmtKm = (m: number) => (m >= 1000 ? `${(m / 1000).toLocaleString("it-IT", { maximumFractionDigits: 1 })} km` : `${m} m`);

export function MapSection() {
  const [sel, setSel] = useState(-1);
  const ref = useGsap<HTMLElement>((el, reduced) => {
    gsap.timeline({ scrollTrigger: { trigger: el, start: "top 65%" } }).add(fadeUp(el.querySelectorAll("[data-fade]"), reduced));
  });

  const stop = sel >= 0 ? MAP_STOPS[sel] : null;
  const place = stop ? PLACES[stop.place] : null;
  const prev = sel > 0 ? PLACES[MAP_STOPS[sel - 1].place] : null;
  const leg = sel > 0 ? legs[sel - 1] : null;

  return (
    <section
      id="section-map"
      ref={ref}
      aria-labelledby="map-title"
      className="relative z-10 bg-night px-4 pt-24 pb-24 sm:px-8"
      style={{ boxShadow: "0 -80px 80px -20px #09090D" }}
    >
      <div className="mx-auto max-w-6xl">
        <p data-fade className="text-[0.68rem] tracking-[0.42em] text-champagne uppercase">
          Navigazione reale
        </p>
        <h2 id="map-title" data-fade className="mt-4 font-serif text-[clamp(2.4rem,9vw,4.5rem)] leading-none font-light text-ivory">
          La mappa della serata
        </h2>
        <p data-fade className="mt-4 max-w-xl text-[0.95rem] leading-relaxed text-ivory/60">
          Otto punti, un percorso a piedi calcolato su dati OpenStreetMap: circa <span className="nums text-ivory">{fmtKm(totalM)}</span>{" "}
          in tutto, con calma. Tocca una tappa per vederla e aprire la navigazione.
        </p>

        <div data-fade className="mt-8 grid gap-5 lg:grid-cols-[1fr_22rem]">
          <div className="h-[58svh] min-h-[22rem] lg:h-[34rem]">
            <RouteMap selected={sel} onSelect={setSel} />
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <ol className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0" aria-label="Tappe del percorso">
              {MAP_STOPS.map((s, i) => (
                <li key={`${s.place}-${i}`} className="shrink-0 snap-start">
                  <button
                    type="button"
                    onClick={() => setSel(i)}
                    aria-pressed={sel === i}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-full border px-3 py-2 text-left text-sm transition-colors lg:rounded-2xl ${
                      sel === i ? "border-champagne bg-champagne text-night" : "border-ivory/12 text-ivory/80 hover:border-ivory/30"
                    }`}
                  >
                    <span className={`nums grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.7rem] ${sel === i ? "bg-night text-champagne" : "border border-champagne/50 text-champagne"}`}>
                      {s.n}
                    </span>
                    <span className="whitespace-nowrap lg:whitespace-normal">{s.label}</span>
                    {s.time && <span className={`nums ml-auto pl-2 text-xs ${sel === i ? "text-night/70" : "text-ivory/40"}`}>{s.time}</span>}
                  </button>
                </li>
              ))}
            </ol>

            <div className="glass rounded-[1.5rem] p-5" aria-live="polite">
              {stop && place ? (
                <>
                  <p className="text-[0.68rem] tracking-[0.3em] text-ivory/50 uppercase">
                    Tappa <span className="nums text-champagne">{stop.n}</span>
                    {stop.time && <span className="nums"> · {stop.time}</span>}
                  </p>
                  <h3 className="mt-2 font-serif text-3xl leading-tight text-ivory">{stop.label}</h3>
                  <p className="mt-1 text-sm text-ivory/60">{place.address}</p>
                  {place.precision === "street" && (
                    <p className="mt-2 text-[0.72rem] text-ivory/45">
                      Il locale non è ancora mappato su OpenStreetMap: il segnaposto indica la via. Google Maps usa l’indirizzo completo.
                    </p>
                  )}
                  {leg && prev && (
                    <p className="mt-3 flex items-center gap-2 text-sm text-ivory/70">
                      <Footprints size={15} className="text-champagne" />
                      <span className="nums">
                        {fmtKm(leg.distance)} a piedi da {prev.name} (circa {Math.max(1, Math.round(leg.duration / 60))} min)
                      </span>
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {sel === 0 ? (
                      <MagneticButton href={gmaps.directions(place.query, "driving", "Varese")} external size="sm" strength={0.15}>
                        <Car size={15} /> Da Varese in auto
                      </MagneticButton>
                    ) : (
                      <MagneticButton
                        href={gmaps.directions(place.query, "walking", prev?.query)}
                        external
                        size="sm"
                        strength={0.15}
                      >
                        <Footprints size={15} /> Indicazioni a piedi
                      </MagneticButton>
                    )}
                    <MagneticButton href={gmaps.search(place.query)} external variant="ghost" size="sm" strength={0.15}>
                      <ExternalLink size={14} /> Google Maps
                    </MagneticButton>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="font-serif text-2xl text-ivory">Tutto il percorso</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ivory/60">
                    Dal parcheggio al centro storico, l’aperitivo, il lungolago fino al Tempio Voltiano, la cena in Piazza Volta e il ritorno
                    all’auto.
                  </p>
                </>
              )}
              {sel >= 0 && (
                <button type="button" onClick={() => setSel(-1)} className="mt-4 inline-flex min-h-11 items-center gap-2 text-xs tracking-[0.14em] text-ivory/55 uppercase hover:text-ivory">
                  <Maximize2 size={13} /> Vedi tutto il percorso
                </button>
              )}
            </div>
            <p className="text-[0.7rem] leading-relaxed text-ivory/35">
              Le scene 3D sono interpretazioni artistiche. Questa mappa usa dati geografici reali per la navigazione.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
