// Courbe simple en SVG, sans bibliothèque.
import { dateCourte, nombre, esc } from './outils.js';

// Pas de graduation lisible : 1, 2 ou 5 fois une puissance de 10.
function pasJoli(brut) {
  const p = 10 ** Math.floor(Math.log10(brut || 1));
  for (const m of [1, 2, 5, 10]) if (m * p >= brut) return m * p;
  return 10 * p;
}

export function courbe(points, { yMin = 0, yMax = null, unite = '' } = {}) {
  if (!points.length) return '<p class="vide">Pas encore de données.</p>';
  const L = 340, H = 190, g = 34, d = 12, h = 14, b = 28;
  const xs = points.map((p) => p.t);
  const ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const brutMax = Math.max(...ys);
  let lo = Math.min(yMin, ...ys);
  let hi = yMax ?? brutMax;
  if (hi <= lo) hi = lo + 1;
  const pas = pasJoli((hi - lo) / 5);
  lo = Math.floor(lo / pas) * pas;
  hi = yMax ?? Math.ceil((brutMax + pas * 0.2) / pas) * pas;
  const X = (t) => (x1 === x0 ? (g + L - d) / 2 : g + ((t - x0) / (x1 - x0)) * (L - g - d));
  const Y = (v) => h + (1 - (v - lo) / (hi - lo)) * (H - h - b);

  let grille = '';
  for (let v = lo; v <= hi + pas / 1000; v += pas) {
    const y = Y(v);
    grille += `<line x1="${g}" x2="${L - d}" y1="${y}" y2="${y}" class="grille"/>`;
    grille += `<text x="${g - 6}" y="${y + 4}" text-anchor="end" class="axe">${nombre(Math.round(v * 10) / 10)}</text>`;
  }
  const chemin = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const pts = points.map((p) => `<circle cx="${X(p.t).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="4" class="point"><title>${esc(dateCourte(p.t))} : ${nombre(p.y)} ${esc(unite)}</title></circle>`).join('');
  const dernier = points[points.length - 1];
  const etiquettes = `<text x="${g}" y="${H - 6}" class="axe">${esc(dateCourte(x0))}</text>`
    + (x1 !== x0 ? `<text x="${L - d}" y="${H - 6}" text-anchor="end" class="axe">${esc(dateCourte(x1))}</text>` : '');

  return `<figure class="courbe">
    <svg viewBox="0 0 ${L} ${H}" role="img" aria-label="Courbe, dernière valeur ${nombre(dernier.y)} ${esc(unite)}">
      ${grille}${etiquettes}
      <path d="${chemin}" class="ligne"/>
      ${pts}
    </svg>
    <figcaption>Dernière valeur : <strong>${nombre(dernier.y)} ${esc(unite)}</strong> · ${points.length} séance${points.length > 1 ? 's' : ''}</figcaption>
  </figure>`;
}
