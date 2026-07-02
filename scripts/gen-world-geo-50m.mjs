// Régénère src/app/(admin)/comparaisons/quadrants/world-geo-50m.ts depuis
// Natural Earth 50m admin_0 countries (DOMAINE PUBLIC), servi par jsDelivr.
//
//   node scripts/gen-world-geo-50m.mjs
//
// - Projection équirectangulaire : x = longitude, y = -latitude.
// - Précision 0,1° ; Antarctique exclu (hors viewBox).
// - id = ISO_A2_EH (repli ISO_A2 ; vide si « -99 »), name = NAME.
// - Les entités d'un même ISO2 sont fusionnées : NE 50m sépare certains
//   territoires (ex. Australie + Ashmore/Coral Sea) → sans fusion, clés React
//   dupliquées et centroïdes erronés.
//
// Le fichier produit est « NE PAS ÉDITER À LA MAIN » : relancer ce script pour
// changer la résolution (échanger « 50m » par « 110m »/« 10m » dans l'URL) ou
// les réglages.

import { writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC =
  "https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson";
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "app",
  "(admin)",
  "comparaisons",
  "quadrants",
  "world-geo-50m.ts",
);

// Arrondi 0,1° + format compact (retire « .0 » final, évite « -0 »).
const r1 = (v) => {
  const n = Math.round(v * 10) / 10 + 0;
  const s = n.toFixed(1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
};

// ISO 3166-1 alpha-2, en préférant la variante « EH » (remplit FR, NO… là où
// ISO_A2 vaut « -99 »). Vide si non identifiable.
function iso2(p) {
  const eh = p.ISO_A2_EH;
  const a2 = p.ISO_A2;
  if (eh && eh !== "-99") return eh;
  if (a2 && a2 !== "-99") return a2;
  return "";
}

function ringPath(ring) {
  let pts = ring;
  if (pts.length > 1) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (a[0] === b[0] && a[1] === b[1]) pts = pts.slice(0, -1); // retire le point de fermeture
  }
  let d = "";
  let px = null;
  let py = null;
  let n = 0;
  for (const [lon, lat] of pts) {
    const x = r1(lon);
    const y = r1(-lat);
    if (x === px && y === py) continue; // dédup consécutive
    d += (n === 0 ? "M" : "L") + x + " " + y;
    px = x;
    py = y;
    n++;
  }
  return n < 3 ? "" : d + "Z";
}

function geomPath(g) {
  let d = "";
  if (g.type === "Polygon") for (const ring of g.coordinates) d += ringPath(ring);
  else if (g.type === "MultiPolygon")
    for (const poly of g.coordinates) for (const ring of poly) d += ringPath(ring);
  return d;
}

const HEADER = `// Tracés SVG du monde — générés depuis Natural Earth 50m (DOMAINE PUBLIC).
// NE PAS ÉDITER À LA MAIN — régénérer via scripts/gen-world-geo-50m.mjs.
// Projection équirectangulaire (x = longitude, y = -latitude).
// Antarctique exclu (hors viewBox). Précision 0,1°.

export const WORLD_VIEWBOX = "-180 -84 360 145";

export interface WorldCountry {
  /** ISO 3166-1 alpha-2 (vide si non identifiable). */
  id: string;
  name: string;
  /** Tracé SVG (\`d\`). */
  d: string;
}

export const WORLD_COUNTRIES: WorldCountry[] = `;

async function main() {
  console.log("Téléchargement Natural Earth 50m…");
  const res = await fetch(SRC);
  if (!res.ok) throw new Error(`fetch ${res.status}`);
  const gj = JSON.parse(await res.text());

  const out = [];
  const byId = new Map(); // ISO2 -> entrée (pour fusionner les entités d'un même pays)
  let dropped = 0;
  let merged = 0;
  for (const f of gj.features) {
    const p = f.properties;
    if (p.NAME === "Antarctica") {
      dropped++;
      continue;
    }
    const d = geomPath(f.geometry);
    if (!d) {
      dropped++;
      continue;
    }
    const id = iso2(p);
    if (id) {
      const ex = byId.get(id);
      if (ex) {
        ex.d += d; // fusionne les tracés du même pays
        merged++;
      } else {
        const e = { id, name: p.NAME ?? "", d };
        byId.set(id, e);
        out.push(e);
      }
    } else {
      out.push({ id: "", name: p.NAME ?? "", d }); // non identifiable : gardé séparé
    }
  }

  writeFileSync(OUT, HEADER + JSON.stringify(out) + ";\n");

  const withId = out.map((c) => c.id).filter(Boolean);
  const uniq = new Set(withId).size === withId.length;
  console.log(`→ ${OUT}`);
  console.log(
    `pays: ${out.length} (dont ${withId.length} avec ISO2, uniques: ${uniq ? "oui" : "NON"}), ` +
      `fusionnés: ${merged}, droppés: ${dropped}, taille: ${(statSync(OUT).size / 1024).toFixed(0)} Ko`,
  );
}

main().catch((e) => {
  console.error("ERREUR:", e.message);
  process.exit(1);
});
