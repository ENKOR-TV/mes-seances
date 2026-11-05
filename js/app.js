// Point d'entrée : branche les écrans, les boutons et le minuteur.
import { donnees } from './stockage.js';
import { ui, vues, actions, monter, rendre } from './ui.js';
import { tic } from './vues-seance.js';
import { changerFiche, changerNomBloc } from './vues-programme.js';
import './vues-historique.js';
import { appliquerTheme, lireImport } from './vues-reglages.js';

const vue = () => vues[ui.vue];

actions.plus = (d) => vue().ajuster && vue().ajuster(d.champ, 1, d);
actions.moins = (d) => vue().ajuster && vue().ajuster(d.champ, -1, d);

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.action];
  if (fn) {
    ev.preventDefault();
    fn(el.dataset, el, ev);
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.dataset.saisie && vue().saisir) vue().saisir(el.dataset.saisie, el.value, el.dataset);
  else if (el.dataset.fiche) changerFiche(el);
  else if (el.dataset.blocNom) changerNomBloc(el);
  else if (el.hasAttribute('data-import')) lireImport(el);
  else if (vue().changer) vue().changer(el);
});

document.addEventListener('input', (ev) => {
  if (ev.target.hasAttribute('data-note')) ui.p.note = ev.target.value;
});

// Touche « OK » du clavier : valide le champ.
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter' && ev.target.matches('input')) ev.target.blur();
});

// Sélectionne le contenu d'un champ numérique au toucher, pour le remplacer d'un coup.
document.addEventListener('focusin', (ev) => {
  if (ev.target.dataset && ev.target.dataset.saisie) setTimeout(() => ev.target.select(), 0);
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ui.vue === 'seance') rendre();
});

setInterval(tic, 250);

appliquerTheme();
monter(document.getElementById('app'));
rendre();

// Hors connexion (désactivé sur l'ordinateur de développement).
if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('Service worker', e));
}

window.__donnees = () => donnees; // aide au dépannage
