// Calcola il percorso pedonale reale tra le tappe usando OSRM (profilo "foot")
// sul server pubblico di FOSSGIS: https://routing.openstreetmap.de
// Uso: npm run route:fetch  → scrive src/data/route.json
import { readFile, writeFile } from "node:fs/promises";

const coords = JSON.parse(await readFile(new URL("../src/data/coordinates.json", import.meta.url)));
const order = ["valduce", "duomo", "sanfedele", "silk", "cavour", "voltiano", "locanda", "valduce"];
const legs = [];
for (let i = 0; i < order.length - 1; i++) {
  const a = coords[order[i]], b = coords[order[i + 1]];
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson&steps=false`;
  const res = await fetch(url, { headers: { "User-Agent": "como-anniversary-static-site/1.0" } });
  if (!res.ok) throw new Error(`OSRM ${res.status} per ${order[i]} → ${order[i + 1]}`);
  const json = await res.json();
  const r = json.routes[0];
  legs.push({
    from: order[i],
    to: order[i + 1],
    distance: Math.round(r.distance),
    duration: Math.round(r.duration),
    coordinates: r.geometry.coordinates.map(([lng, lat]) => [+lat.toFixed(6), +lng.toFixed(6)]),
  });
  console.log(`${order[i]} → ${order[i + 1]}: ${Math.round(r.distance)} m`);
  await new Promise((r) => setTimeout(r, 800));
}
await writeFile(
  new URL("../src/data/route.json", import.meta.url),
  JSON.stringify({ _source: "OSRM foot profile, routing.openstreetmap.de — dati © OpenStreetMap contributors", generated: new Date().toISOString(), legs }, null, 0)
);
