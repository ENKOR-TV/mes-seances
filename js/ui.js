// Navigation entre écrans et actions des boutons.
import { esc } from './outils.js';

export const ui = { vue: 'accueil', p: {} };
export const vues = {};
export const actions = {};

let racine = null;
export const monter = (el) => { racine = el; };

export function aller(vue, p = {}) {
  ui.vue = vue;
  ui.p = p;
  rendre();
  window.scrollTo(0, 0);
}

export function rendre() {
  const v = vues[ui.vue] || vues.accueil;
  racine.innerHTML = v.html(ui.p);
  if (v.apres) v.apres(ui.p);
}

let minuterieToast = null;
export function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(minuterieToast);
  minuterieToast = setTimeout(() => el.classList.remove('visible'), 2600);
}

const ONGLETS = [
  ['accueil', 'Accueil', '<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'],
  ['historique', 'Historique', '<path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6"/>'],
  ['programme', 'Programme', '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'],
  ['reglages', 'Réglages', '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'],
];

export function nav(actif) {
  return `<nav class="onglets">${ONGLETS.map(([id, nom, icone]) => `
    <button data-action="onglet" data-vue="${id}" class="${actif === id ? 'actif' : ''}" ${actif === id ? 'aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" aria-hidden="true">${icone}</svg><span>${nom}</span>
    </button>`).join('')}</nav>`;
}

actions.onglet = (d) => aller(d.vue);

// Bouton plus / moins avec champ modifiable.
export function pasAPas({ champ, valeur, unite, etiquette, cible = '' }) {
  return `<div class="reglage">
    <span class="etiquette">${esc(etiquette)}</span>
    <div class="pas-a-pas">
      <button class="pas" data-action="moins" data-champ="${champ}" ${cible} aria-label="Moins">−</button>
      <label class="valeur"><input type="text" inputmode="decimal" data-saisie="${champ}" ${cible} value="${esc(valeur)}" aria-label="${esc(etiquette)}"><span class="unite">${esc(unite)}</span></label>
      <button class="pas" data-action="plus" data-champ="${champ}" ${cible} aria-label="Plus">+</button>
    </div>
  </div>`;
}

export function entete(titre, retour) {
  return `<header class="entete">
    ${retour ? `<button class="retour" data-action="${retour.action}" ${retour.attrs || ''}>‹ ${esc(retour.texte)}</button>` : ''}
    <h1>${esc(titre)}</h1>
  </header>`;
}
