// Réglages et sauvegarde.
import { donnees, sauver, exporter, importer } from './stockage.js';
import { vues, actions, rendre, toast, nav, entete, pasAPas } from './ui.js';
import { esc, lireNombre } from './outils.js';
import { objectifVelo } from './seance.js';
import { preparerSon, signalFin, ecranGerable } from './signal.js';

const JOURS = [[1, 'L', 'lundi'], [2, 'M', 'mardi'], [3, 'M', 'mercredi'], [4, 'J', 'jeudi'], [5, 'V', 'vendredi'], [6, 'S', 'samedi'], [0, 'D', 'dimanche']];

// champ : [objet, clé, pas, min, max]
const CHAMPS = {
  reposSec: () => [donnees.reglages, 'reposSec', 15, 15, 300],
  echauffementMin: () => [donnees.reglages, 'echauffementMin', 1, 1, 15],
  departMin: () => [donnees.reglages.velo, 'departMin', 5, 5, 60],
  pasMin: () => [donnees.reglages.velo, 'pasMin', 1, 0, 15],
  maxMin: () => [donnees.reglages.velo, 'maxMin', 5, 5, 90],
};

export function appliquerTheme() {
  document.documentElement.dataset.theme = donnees.reglages.theme === 'clair' ? 'clair' : 'sombre';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = donnees.reglages.theme === 'clair' ? '#f4f5f7' : '#0e1014';
}

vues.reglages = {
  html() {
    const r = donnees.reglages;
    return `<main class="ecran reglages">
      ${entete('Réglages')}
      <h2>Séance</h2>
      ${pasAPas({ champ: 'reposSec', valeur: r.reposSec, unite: 's', etiquette: 'Repos entre deux exercices' })}
      ${pasAPas({ champ: 'echauffementMin', valeur: r.echauffementMin, unite: 'min', etiquette: 'Échauffement à vélo' })}
      <button class="interrupteur ${r.son ? 'actif' : ''}" data-action="basculer-son" aria-pressed="${r.son}">
        <span>Son à la fin des minuteurs<small>Coupé si l’iPhone est en mode silencieux</small></span><span class="bascule" aria-hidden="true"></span></button>
      <button class="secondaire large" data-action="tester-son">Tester le son et le flash</button>
      <div class="reglage"><span class="etiquette">Affichage</span>
        <div class="puces">
          <button class="puce ${r.theme !== 'clair' ? 'active' : ''}" data-action="theme" data-t="sombre">Sombre</button>
          <button class="puce ${r.theme === 'clair' ? 'active' : ''}" data-action="theme" data-t="clair">Clair</button>
        </div></div>
      <p class="aide">${ecranGerable() ? 'L’écran reste allumé pendant la séance.' : 'Ce téléphone ne permet pas de garder l’écran allumé : règle « Verrouillage automatique » sur « Jamais » pendant la séance.'}</p>

      <h2>Vélo</h2>
      <div class="reglage"><span class="etiquette">Jours de vélo (après la séance)</span>
        <div class="puces jours">${JOURS.map(([n, l, nom]) => `<button class="puce ${r.joursVelo.includes(n) ? 'active' : ''}" data-action="jour-velo" data-j="${n}" aria-label="${nom}" aria-pressed="${r.joursVelo.includes(n)}">${l}</button>`).join('')}</div></div>
      <label class="champ"><span>Première semaine du programme</span><input type="date" data-reglage="debut" value="${esc(r.velo.debut)}"></label>
      ${pasAPas({ champ: 'departMin', valeur: r.velo.departMin, unite: 'min', etiquette: 'Durée de départ' })}
      ${pasAPas({ champ: 'pasMin', valeur: r.velo.pasMin, unite: 'min', etiquette: 'En plus chaque semaine' })}
      ${pasAPas({ champ: 'maxMin', valeur: r.velo.maxMin, unite: 'min', etiquette: 'Objectif' })}
      <p class="aide">Cette semaine : <strong>${objectifVelo()} min</strong>.</p>

      <h2>Mes données</h2>
      <p class="aide">Tout reste sur ce téléphone, rien n’est envoyé nulle part. Fais une sauvegarde de temps en temps, et avant de changer de téléphone. ${donnees.seances.length} séance${donnees.seances.length > 1 ? 's' : ''} enregistrée${donnees.seances.length > 1 ? 's' : ''}.</p>
      <button class="secondaire large" data-action="exporter">Enregistrer une sauvegarde</button>
      <label class="secondaire large bouton-fichier">Restaurer une sauvegarde<input type="file" accept="application/json,.json" data-import hidden></label>
    </main>${nav('reglages')}`;
  },

  ajuster(champ, signe) {
    const def = CHAMPS[champ];
    if (!def) return;
    const [obj, k, pas, min, max] = def();
    obj[k] = Math.max(min, Math.min(max, obj[k] + signe * pas));
    sauver();
    rendre();
  },

  saisir(champ, texte) {
    const def = CHAMPS[champ];
    const v = lireNombre(texte);
    if (def && v != null) {
      const [obj, k, , min, max] = def();
      obj[k] = Math.max(min, Math.min(max, Math.round(v)));
      sauver();
    }
    rendre();
  },

  changer(el) {
    if (el.dataset.reglage === 'debut' && el.value) {
      donnees.reglages.velo.debut = el.value;
      sauver();
      rendre();
    }
  },
};

actions['basculer-son'] = () => { donnees.reglages.son = !donnees.reglages.son; sauver(); rendre(); };
actions['tester-son'] = () => {
  preparerSon();
  setTimeout(signalFin, 50);
};
actions.theme = (d) => { donnees.reglages.theme = d.t; sauver(); appliquerTheme(); rendre(); };
actions['jour-velo'] = (d) => {
  const n = Number(d.j);
  const j = donnees.reglages.joursVelo;
  donnees.reglages.joursVelo = j.includes(n) ? j.filter((x) => x !== n) : [...j, n];
  sauver();
  rendre();
};

actions.exporter = async () => {
  try {
    if (await exporter()) toast('Sauvegarde prête.');
  } catch (e) {
    toast('Impossible de créer la sauvegarde.');
  }
};

export async function lireImport(el) {
  const f = el.files && el.files[0];
  if (!f) return;
  try {
    const texte = await f.text();
    if (!confirm('Remplacer toutes les données de ce téléphone par cette sauvegarde ?')) return;
    const n = importer(texte);
    appliquerTheme();
    rendre();
    toast(`Sauvegarde restaurée : ${n} séance${n > 1 ? 's' : ''}.`);
  } catch (e) {
    alert(e.message || 'Fichier illisible.');
  } finally {
    el.value = '';
  }
}

