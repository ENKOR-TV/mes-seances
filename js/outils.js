// Petits outils partagés : échappement HTML, dates, formats.

const ENTITES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ENTITES[c]);

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function debutJour(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// La semaine commence le lundi.
export function debutSemaine(d = new Date()) {
  const x = debutJour(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function finSemaine(d = new Date()) {
  const x = debutSemaine(d);
  x.setDate(x.getDate() + 7);
  return x;
}

const fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtJourMois = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });
const fmtCourt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const fmtHeure = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

export const dateLongue = (t) => fmtLong.format(new Date(t));
export const jourMois = (t) => fmtJourMois.format(new Date(t));
export const dateCourte = (t) => fmtCourt.format(new Date(t));
export const heure = (t) => fmtHeure.format(new Date(t));

export function ilYa(t) {
  const j = Math.round((debutJour() - debutJour(t)) / 864e5);
  if (j <= 0) return 'aujourd’hui';
  if (j === 1) return 'hier';
  return `il y a ${j} jours`;
}

// « du 9 au 15 novembre 2026 » ou « du 30 novembre au 6 décembre 2026 »
export function periodeSemaine(d = new Date()) {
  const a = debutSemaine(d);
  const b = new Date(a);
  b.setDate(b.getDate() + 6);
  const annee = b.getFullYear();
  if (a.getMonth() === b.getMonth()) return `du ${a.getDate()} au ${jourMois(b)} ${annee}`;
  return `du ${jourMois(a)} au ${jourMois(b)} ${annee}`;
}

export function mmss(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const nombre = (n) => (n == null || n === '' ? '' : String(Math.round(n * 100) / 100).replace('.', ','));

export function lireNombre(texte) {
  const n = parseFloat(String(texte).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function isoJour(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export function lireIsoJour(s) {
  const [y, m, j] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, j || 1);
}

export function dureeTexte(ms) {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}
