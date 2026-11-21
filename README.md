# Como — Our Little Escape

Un sito per l’anniversario di Giuseppe e Milena: il programma di sabato **21 novembre 2026** a Como, raccontato come un
cortometraggio da scorrere. Ci sono scene 3D in tempo reale, una camera che segue lo scroll, una mappa vera e una colonna
sonora generata dal browser.

> _Un pomeriggio. Una città. Noi due._

Il sito è pensato prima di tutto per **iPhone** (Safari, in verticale). Funziona anche su desktop e su Android.

---

## Avvio rapido

Serve **Node.js 20 o successivo** (testato con Node 22).

```bash
npm install
npm run dev        # sviluppo → http://localhost:3000
```

Versione di produzione:

```bash
npm run build
npm run start      # → http://localhost:3000
```

Per provarlo sull’iPhone mentre sviluppi: telefono e computer sulla stessa Wi‑Fi, poi
`npx next dev -H 0.0.0.0` e apri `http://<IP-del-computer>:3000`.

### Pubblicazione

Il progetto è una normale app Next.js (App Router) e la pagina è statica: si può pubblicare su Vercel così com’è
(importa il repository e lascia le impostazioni predefinite). Non servono variabili d’ambiente né chiavi API.

---

## Struttura dell’esperienza

| Capitolo | Cosa succede |
| --- | --- |
| **Apertura** | Loader con la frase-concept mentre gli shader vengono compilati. |
| **Hero** | Lago prealpino al crepuscolo. L’acqua riflette davvero (riflessione planare), il cielo passa dal tramonto alla notte e le luci della costa si accendono una alla volta. «Scopri la nostra serata» porta la camera verso la città. |
| **La sorpresa** | Bouquet procedurale (rose cipria e bianche, eucalipto, nebbiolina, carta e nastro bordeaux) sospeso in un fascio di luce, con petali che fluttuano. |
| **Timeline 3D** | Sei tappe lungo un percorso curvo collegato da un filo di luce. La camera rallenta su ogni tappa e la luce segue l’orario: 01 bouquet · 02 mappa stilizzata di Como con il parcheggio · 03 Duomo stilizzato in orbita · 04 due calici di Spritz che si sfiorano · 05 lago notturno con il Tempio Voltiano · 06 tavolo per due con candela (**prenotazione confermata**). |
| **Mappa reale** | Leaflet con tile OpenStreetMap e il percorso pedonale vero tra le 8 tappe. Ogni tappa si può selezionare e ha i suoi link per Google Maps. |
| **Finale** | «Non importa dove andiamo…» e «Buon anniversario, Milena.» tra particelle d’oro. |

### Interazioni

- **Modalità viaggio**: il pulsante «Inizia il nostro viaggio» (nella sorpresa e nel menu) fa scorrere la storia da sola,
  con una pausa su ogni tappa. Basta toccare o scorrere per interromperla.
- **Timeline navigabile**: la barra 01–06 (in alto su iPhone, a destra su desktop) e il menu portano direttamente a una tappa.
- **Schede delle tappe**: per ognuna ci sono orario, luogo, indirizzo, una descrizione e i pulsanti di navigazione.
- **Colonna sonora**: si accende solo toccando «Musica» e non parte mai da sola. È generata in tempo reale con la Web Audio API:
  pad in Re maggiore, note di celesta e un fruscio d’acqua. Quando i calici si toccano si sente un piccolo «tin».
  Su iPhone l’audio non si sente se l’interruttore silenzioso è attivo.
- **Riduci movimento**: segue `prefers-reduced-motion` e si può anche attivare a mano dal menu. In questa modalità la camera
  è stabile, non c’è lo smooth scrolling e i testi compaiono senza animazioni.
- **«Adesso»**: il 21/11/2026, secondo l’ora di Roma, la tappa in corso è segnata con un punto rosa.

---

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **React Three Fiber 9**, **Three.js r187**, **Drei** (Environment con Lightformer procedurali, PerformanceMonitor)
- **GLSL** scritto a mano: acqua (onde, fresnel, riflessione distorta, scia del sole), cielo (gradiente, nuvole, stelle),
  terreno con prospettiva aerea ed enrosadira, foschia fbm, bokeh con finta profondità di campo, fasci volumetrici, liquido
  dello Spritz con bollicine, fiamma della candela, linea luminosa
- **GSAP + ScrollTrigger** (split text, mask reveal, scrub), **Lenis** (smooth scroll), **Motion** (microinterazioni,
  pulsanti magnetici, menu)
- **Tailwind CSS 4**, **Lucide**, **Leaflet**, **Zustand**
- Font: Cormorant Garamond (titoli e orari) e Manrope (testi), ospitati in locale tramite Fontsource

### Cartelle

```
src/
  app/                    layout, pagina, stili globali (palette e tipografia)
  components/
    Experience.tsx        orchestrazione: Lenis + ticker unico, layer fissi, sezioni
    canvas/
      StageCanvas.tsx     Canvas unico, regia delle scene, compilazione progressiva, prestazioni
      rig.tsx             impianto luci condiviso (numero di luci costante → nessuna ricompilazione)
      scenes/             HeroLake, BouquetScene, TimelineWorld, FinaleScene
      objects/            acqua, cielo/atmosfera, terreno, fiori, vetri, architetture, tavolo, mappa 3D…
      shaders/            funzioni GLSL condivise
    sections/             Hero, Intro, Timeline, MapSection, Finale
    map/RouteMap.tsx      mappa reale (Leaflet)
    ui/                   TopBar, StageNav, Loader, MagneticButton, SplitText, Fallback2D
  lib/                    contenuti, scroll, store, audio, modalità viaggio, dispositivo, rumore
  data/                   coordinate e percorso reali (OpenStreetMap / OSRM)
scripts/fetch-route.mjs   rigenera il percorso pedonale
```

---

## Dati geografici: da dove vengono

- **Coordinate** (`src/data/coordinates.json`): geocodificate con Nominatim di OpenStreetMap il 21/11/2026.
  **Silk Cocktail Tailoring non è presente su OpenStreetMap**, quindi il suo segnaposto sta su Via Armando Diaz ed è indicato
  come «posizione sulla via». I link a Google Maps usano sempre nome e indirizzo completo (Via Armando Diaz 69), così la
  navigazione porta al numero giusto.
- **Percorso pedonale** (`src/data/route.json`): calcolato con OSRM (profilo a piedi) sul server pubblico FOSSGIS. È lungo
  circa 3,7 km in tutto. Per rigenerarlo: `npm run route:fetch`.
- **Tile della mappa**: server ufficiale OpenStreetMap, rese «notturne» con un filtro CSS. Rispetta la
  [tile usage policy](https://operations.osmfoundation.org/policies/tiles/), che va bene per un uso personale. Se il sito
  dovesse avere molto traffico, conviene passare a un provider dedicato (in `RouteMap.tsx` basta cambiare l’URL).
- **Google Maps**: link [Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) ufficiali
  (`api=1`), che non richiedono chiavi.

Tutte le scene 3D (Duomo, Tempio Voltiano, mappa di Como, lago) sono **interpretazioni stilizzate** e non riproduzioni
fedeli; il sito lo dice dove serve. La mappa per orientarsi davvero è quella della sezione «La mappa della serata».

Stato delle prenotazioni, come richiesto:
- **Cena — Locanda in Centro, 20:30: prenotata.** È l’unica con il badge «Prenotazione confermata».
- Aperitivo da Silk: **nessuna prenotazione indicata**.
- Fiorista a Varese: **ancora da scegliere**. Il pulsante cerca i fioristi di Varese su Google Maps.

---

## Prestazioni e compatibilità

- **Un solo contesto WebGL** per tutta la pagina. Si disegna solo la scena attiva; le tappe della timeline vengono nascoste
  quando sono lontane dalla camera.
- **Caricamento progressivo**: all’inizio si carica solo il lago. Le altre scene si montano poco dopo e i loro shader vengono
  precompilati con `compileAsync` mentre si guarda l’hero. Leaflet si scarica solo quando la mappa si avvicina.
- **Nessuna texture da scaricare**: geometrie e texture sono procedurali (canvas e shader). Il bundle 3D non contiene immagini.
- **DPR adattivo**: su iPhone si parte da un massimo di 1.6. `PerformanceMonitor` lo abbassa se gli FPS calano e, se serve,
  passa al profilo «low»: meno particelle, riflessi a 256 px, vetro senza trasmissione fisica, bouquet semplificato.
- Mentre la sezione mappa copre lo schermo il rendering 3D viene **sospeso**.
- L’altezza `100lvh` del canvas evita i ridimensionamenti quando su iOS compare o sparisce la barra degli indirizzi.
- **Fallback 2D**: senza WebGL, se il contesto viene perso o se c’è un errore nella scena, la pagina usa fondali CSS/SVG con
  gli stessi testi, la stessa mappa e gli stessi pulsanti.

## Accessibilità

- Struttura semantica (`section`, `h1`–`h3`, `nav`, `article`), link «Vai al programma» per saltare all’orario,
  canvas `aria-hidden`.
- I testi spezzati per le animazioni restano leggibili dagli screen reader grazie a `aria-label`.
- Pulsanti di almeno 44 px, focus visibile, menu chiudibile con Esc, marcatori della mappa raggiungibili da tastiera.
- Contrasto alto sui testi; le schede hanno un fondo sfumato per restare leggibili sopra le scene.

## Licenze degli asset

Modelli, shader, texture e musica sono originali e generati dal codice. I font (Cormorant Garamond e Manrope) sono sotto
SIL Open Font License. I dati cartografici sono © OpenStreetMap contributors (ODbL).
