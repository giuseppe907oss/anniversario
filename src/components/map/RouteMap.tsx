"use client";

import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import route from "@/data/route.json";
import { MAP_STOPS, PLACES } from "@/lib/content";

type Status = "idle" | "loading" | "ready" | "error";

/**
 * Mappa reale (Leaflet + tile ufficiali OpenStreetMap).
 * Il tracciato è il percorso pedonale calcolato da OSRM tra le tappe.
 */
export function RouteMap({ selected, onSelect }: { selected: number; onSelect: (i: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const markers = useRef<Leaflet.Marker[]>([]);
  const legsRef = useRef<Leaflet.Polyline[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [tileErrors, setTileErrors] = useState(0);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // caricamento pigro: solo quando la sezione si avvicina allo schermo
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let cancelled = false;
    const io = new IntersectionObserver(
      async (entries) => {
        if (!entries.some((e) => e.isIntersecting) || map.current || cancelled) return;
        io.disconnect();
        setStatus("loading");
        try {
          const L = (await import("leaflet")).default;
          if (cancelled || !box.current) return;
          const m = L.map(box.current, {
            zoomControl: true,
            attributionControl: true,
            scrollWheelZoom: false,
            tap: true,
            zoomSnap: 0.25,
          } as Leaflet.MapOptions);
          map.current = m;
          // Tile ufficiali OpenStreetMap (nessuna chiave), rese "notturne" via CSS
          const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            className: "osm-night",
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · percorso <a href="https://project-osrm.org" target="_blank" rel="noopener">OSRM</a>',
          });
          tiles.on("tileerror", () => setTileErrors((n) => n + 1));
          tiles.addTo(m);

          // percorso: alone + linea
          const legs = route.legs as unknown as { coordinates: [number, number][] }[];
          legs.forEach((leg) => {
            L.polyline(leg.coordinates, { color: "#D8BC8A", weight: 10, opacity: 0.12, lineCap: "round", interactive: false }).addTo(m);
          });
          legsRef.current = legs.map((leg, i) =>
            L.polyline(leg.coordinates, {
              color: i === legs.length - 1 ? "#D6A7B3" : "#D8BC8A",
              weight: 3,
              opacity: 0.9,
              dashArray: i === legs.length - 1 ? "2 8" : undefined,
              lineCap: "round",
              interactive: false,
            }).addTo(m),
          );

          // marcatori numerati
          const seen = new Map<string, number>();
          markers.current = MAP_STOPS.map((s, i) => {
            const p = PLACES[s.place];
            // il ritorno coincide con il punto di partenza: lo spostiamo appena per renderlo selezionabile
            const dup = seen.get(s.place);
            seen.set(s.place, i);
            const lat = dup !== undefined ? p.lat - 0.00018 : p.lat;
            const lng = dup !== undefined ? p.lng + 0.00025 : p.lng;
            const icon = L.divIcon({
              className: "",
              html: `<div class="stop-marker" data-i="${i}">${s.n}</div>`,
              iconSize: [30, 30],
              iconAnchor: [15, 15],
            });
            const mk = L.marker([lat, lng], { icon, keyboard: true, title: s.label, alt: s.label, riseOnHover: true }).addTo(m);
            mk.bindTooltip(s.label, { className: "stop-tip", direction: "top", offset: [0, -16] });
            mk.on("click", () => onSelectRef.current(i));
            return mk;
          });

          const all = legs.flatMap((l) => l.coordinates);
          m.fitBounds(L.latLngBounds(all), { padding: [28, 28] });
          setStatus("ready");
        } catch {
          setStatus("error");
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // selezione → volo verso la tappa ed evidenziazione
  useEffect(() => {
    const m = map.current;
    if (!m || status !== "ready") return;
    markers.current.forEach((mk, i) => {
      const el = mk.getElement()?.querySelector(".stop-marker");
      el?.classList.toggle("is-active", i === selected);
      if (i === selected) mk.setZIndexOffset(1000);
      else mk.setZIndexOffset(0);
    });
    legsRef.current.forEach((pl, i) => pl.setStyle({ opacity: i === selected - 1 ? 1 : 0.55, weight: i === selected - 1 ? 4.5 : 3 }));
    const mk = markers.current[selected];
    if (selected < 0) {
      const all = (route.legs as unknown as { coordinates: [number, number][] }[]).flatMap((l) => l.coordinates);
      m.flyToBounds(all, { padding: [28, 28], duration: 0.9 });
      legsRef.current.forEach((pl) => pl.setStyle({ opacity: 0.9, weight: 3 }));
    } else if (mk) {
      m.flyTo(mk.getLatLng(), Math.max(m.getZoom(), 16.25), { duration: 0.9 });
      mk.openTooltip();
    }
  }, [selected, status]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.5rem] border border-ivory/10 bg-anthracite">
      <div ref={box} className="h-full w-full" role="region" aria-label="Mappa interattiva del percorso a piedi a Como" />
      {status !== "ready" && (
        <div className="absolute inset-0 grid place-items-center text-sm text-ivory/50">
          {status === "error" ? "Impossibile caricare la mappa. Usa i pulsanti qui sotto per aprire Google Maps." : "Carico la mappa…"}
        </div>
      )}
      {status === "ready" && tileErrors > 6 && (
        <div className="absolute inset-x-3 bottom-3 rounded-xl bg-night/85 px-3 py-2 text-xs text-ivory/70">
          Connessione lenta: alcune porzioni della mappa non si sono caricate. La navigazione con Google Maps resta disponibile.
        </div>
      )}
    </div>
  );
}
