import coords from "@/data/coordinates.json";

/* ------------------------------------------------------------------ */
/*  Google Maps — URL ufficiali "Maps URLs" (api=1), nessuna chiave.   */
/*  https://developers.google.com/maps/documentation/urls/get-started  */
/* ------------------------------------------------------------------ */

export type TravelMode = "walking" | "driving";

export const gmaps = {
  search: (query: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
  directions: (destination: string, mode: TravelMode = "walking", origin?: string) =>
    `https://www.google.com/maps/dir/?api=1${
      origin ? `&origin=${encodeURIComponent(origin)}` : ""
    }&destination=${encodeURIComponent(destination)}&travelmode=${mode}`,
};

/* ------------------------------------------------------------------ */
/*  Luoghi (coordinate reali da OpenStreetMap, vedi data/coordinates)  */
/* ------------------------------------------------------------------ */

export type PlaceId = "valduce" | "duomo" | "sanfedele" | "silk" | "cavour" | "voltiano" | "locanda";

export interface Place {
  id: PlaceId;
  name: string;
  address: string;
  /** Query testuale usata per Google Maps (nome + indirizzo: più precisa delle coordinate). */
  query: string;
  lat: number;
  lng: number;
  /** "street" = il locale non è mappato su OSM: il punto è sulla via indicata. */
  precision: "exact" | "street";
}

const c = coords as unknown as Record<PlaceId, { lat: number; lng: number; precision: "exact" | "street" }>;

const place = (id: PlaceId, name: string, address: string, query?: string): Place => ({
  id,
  name,
  address,
  query: query ?? `${name}, ${address}`,
  lat: c[id].lat,
  lng: c[id].lng,
  precision: c[id].precision,
});

export const PLACES: Record<PlaceId, Place> = {
  valduce: place("valduce", "Autosilo Valduce", "Viale Lecco 9a, 22100 Como CO"),
  duomo: place("duomo", "Duomo di Como", "Piazza del Duomo, 22100 Como CO"),
  sanfedele: place("sanfedele", "Piazza San Fedele", "Piazza San Fedele, 22100 Como CO", "Piazza San Fedele, Como"),
  silk: place("silk", "Silk Cocktail Tailoring", "Via Armando Diaz 69, 22100 Como CO"),
  cavour: place("cavour", "Piazza Cavour", "Piazza Cavour, 22100 Como CO", "Piazza Cavour, Como"),
  voltiano: place("voltiano", "Tempio Voltiano", "Viale Guglielmo Marconi, 22100 Como CO"),
  locanda: place("locanda", "Locanda in Centro", "Piazza Alessandro Volta 33, 22100 Como CO"),
};

/* ------------------------------------------------------------------ */
/*  Tappe della timeline                                               */
/* ------------------------------------------------------------------ */

export type StageStatus = "booked" | "none";

export interface StageAction {
  label: string;
  href: string;
  kind: "primary" | "secondary";
}

export interface Stage {
  id: string;
  index: number;
  number: string;
  title: string;
  /** Orario mostrato in grande. */
  time: string;
  timeEnd?: string;
  /** Finestra (minuti dalla mezzanotte, ora di Roma) per l'indicatore "adesso". */
  window?: [number, number];
  location: string;
  address?: string;
  quote: string;
  body: string;
  status: StageStatus;
  places: PlaceId[];
  actions: StageAction[];
}

export const STAGES: Stage[] = [
  {
    id: "arrivo",
    index: 0,
    number: "01",
    title: "Arrivo a Como",
    time: "17:00",
    timeEnd: "17:30",
    window: [17 * 60, 17 * 60 + 30],
    location: PLACES.valduce.name,
    address: PLACES.valduce.address,
    quote: "Lasciamo l’auto. Comincia la nostra passeggiata.",
    body: "Da Varese verso il lago. Parcheggiamo all’Autosilo Valduce, a pochi passi dalle mura della città vecchia.",
    status: "none",
    places: ["valduce"],
    actions: [
      { label: "Naviga al parcheggio", href: gmaps.directions(PLACES.valduce.query, "driving"), kind: "primary" },
      { label: "Google Maps", href: gmaps.search(PLACES.valduce.query), kind: "secondary" },
    ],
  },
  {
    id: "centro",
    index: 1,
    number: "02",
    title: "Centro storico",
    time: "17:30",
    timeEnd: "18:20",
    window: [17 * 60 + 30, 18 * 60 + 20],
    location: "Duomo · Piazza San Fedele · vie del centro",
    address: "Città murata, Como",
    quote: "Perderci tra le strade, ritrovarci negli sguardi.",
    body: "La facciata del Duomo che si accende di sera, i portici di San Fedele, le vie strette della città murata. Senza fretta.",
    status: "none",
    places: ["duomo", "sanfedele"],
    actions: [
      { label: "Duomo di Como", href: gmaps.directions(PLACES.duomo.query), kind: "primary" },
      { label: "Piazza San Fedele", href: gmaps.directions(PLACES.sanfedele.query), kind: "secondary" },
    ],
  },
  {
    id: "aperitivo",
    index: 2,
    number: "03",
    title: "Aperitivo",
    time: "18:30",
    timeEnd: "19:15",
    window: [18 * 60 + 30, 19 * 60 + 15],
    location: PLACES.silk.name,
    address: PLACES.silk.address,
    quote: "Un brindisi a noi.",
    body: "Uno Spritz a testa, due calici che si sfiorano. Il tempo rallenta, la sera comincia davvero.",
    status: "none",
    places: ["silk"],
    actions: [
      { label: "Raggiungi il locale", href: gmaps.directions(PLACES.silk.query), kind: "primary" },
      { label: "Google Maps", href: gmaps.search(PLACES.silk.query), kind: "secondary" },
    ],
  },
  {
    id: "lago",
    index: 3,
    number: "04",
    title: "Il lago di notte",
    time: "19:15",
    timeEnd: "20:15",
    window: [19 * 60 + 15, 20 * 60 + 15],
    location: "Piazza Cavour → Lungolago Mafalda di Savoia → Tempio Voltiano",
    address: "Rientro verso Piazza Volta",
    quote: "Ci sono posti bellissimi. E poi ci sono posti che diventano speciali perché ci sei tu.",
    body: "Le luci sull’acqua, il lungolago, il Tempio Voltiano illuminato. Poi, piano, si torna verso Piazza Volta.",
    status: "none",
    places: ["cavour", "voltiano"],
    actions: [
      { label: "Piazza Cavour", href: gmaps.directions(PLACES.cavour.query), kind: "primary" },
      {
        label: "Fino al Tempio Voltiano",
        href: gmaps.directions(PLACES.voltiano.query, "walking", PLACES.cavour.query),
        kind: "secondary",
      },
    ],
  },
  {
    id: "cena",
    index: 4,
    number: "05",
    title: "La cena",
    time: "20:30",
    window: [20 * 60 + 30, 23 * 60 + 30],
    location: PLACES.locanda.name,
    address: PLACES.locanda.address,
    quote: "E il momento più bello deve ancora arrivare.",
    body: "20:30 — Il nostro tavolo ci aspetta.",
    status: "booked",
    places: ["locanda"],
    actions: [
      { label: "Naviga al ristorante", href: gmaps.directions(PLACES.locanda.query), kind: "primary" },
      { label: "Google Maps", href: gmaps.search(PLACES.locanda.query), kind: "secondary" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Tappe della mappa reale (ordine del percorso)                      */
/* ------------------------------------------------------------------ */

export interface MapStop {
  n: number;
  place: PlaceId;
  label: string;
  time?: string;
}

export const MAP_STOPS: MapStop[] = [
  { n: 1, place: "valduce", label: "Autosilo Valduce", time: "17:00" },
  { n: 2, place: "duomo", label: "Duomo di Como", time: "17:30" },
  { n: 3, place: "sanfedele", label: "Piazza San Fedele", time: "18:00" },
  { n: 4, place: "silk", label: "Silk Cocktail Tailoring", time: "18:30" },
  { n: 5, place: "cavour", label: "Piazza Cavour", time: "19:15" },
  { n: 6, place: "voltiano", label: "Tempio Voltiano", time: "19:45" },
  { n: 7, place: "locanda", label: "Locanda in Centro", time: "20:30" },
  { n: 8, place: "valduce", label: "Ritorno all’Autosilo Valduce" },
];

export const EVENT_DATE = { y: 2026, m: 11, d: 21 };

/** Minuti dalla mezzanotte a Roma, oppure null se oggi non è il 21/11/2026. */
export function romeMinutesToday(now = new Date()): number | null {
  try {
    const parts = new Intl.DateTimeFormat("it-IT", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(now);
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    if (g("year") !== EVENT_DATE.y || g("month") !== EVENT_DATE.m || g("day") !== EVENT_DATE.d) return null;
    return (g("hour") % 24) * 60 + g("minute");
  } catch {
    return null;
  }
}
