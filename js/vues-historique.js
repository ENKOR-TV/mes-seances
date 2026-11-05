// Historique des séances, détail et courbes.
import { donnees, sauver } from './stockage.js';
import { vues, actions, aller, nav, entete } from './ui.js';
import { esc, dateLongue, dateCourte, heure, dureeTexte } from './outils.js';
import { MODES, seancesTriees, cle, valeurSerie } from './seance.js';
import { raisonsAlerte, courbesExercices, MESSAGE_ARRET } from './regles.js';
import { courbe } from './graphique.js';

const badge = (mode) => (mode && mode !== 'complete' ? `<span class="badge ${mode}">${esc(MODES[mode])}</span>` : '');

vues.historique = {
  html(p) {
    const onglet = p.onglet || 'seances';
    const contenu = onglet === 'courbes' ? courbes(p) : liste();
    return `<main class="ecran historique">
      ${entete('Historique')}
      <div class="segments" role="tablist">
        <button role="tab" class="${onglet === 'seances' ? 'actif' : ''}" aria-selected="${onglet === 'seances'}" data-action="histo-onglet" data-o="seances">Séances</button>
        <button role="tab" class="${onglet === 'courbes' ? 'actif' : ''}" aria-selected="${onglet === 'courbes'}" data-action="histo-onglet" data-o="courbes">Courbes</button>
      </div>
      ${contenu}
    </main>${nav('historique')}`;
  },
  changer(el) {
    if (el.dataset.ui === 'cle') aller('historique', { onglet: 'courbes', cle: el.value });
  },
};

function liste() {
  const ss = seancesTriees().reverse();
  if (!ss.length) return '<p class="vide">Aucune séance pour l’instant. La première arrive bientôt.</p>';
  return `<ul class="liste-seances">${ss.map((s) => {
    const faites = s.series.filter((x) => x.etat === 'faite').length;
    const alerte = raisonsAlerte(s).length;
    return `<li><button class="ligne-seance" data-action="detail" data-id="${esc(s.id)}">
      <span class="l1">${esc(dateLongue(s.debut))} ${badge(s.mode)}</span>
      <span class="l2">Douleur ${s.douleur ?? '?'}/10 · ${faites}/${s.series.length} séries${s.velo && s.velo.etat === 'faite' ? ` · vélo ${s.velo.minutes} min` : ''}${alerte ? ' <span class="badge alerte-badge">Alerte</span>' : ''}</span>
      <span class="chevron" aria-hidden="true">›</span>
    </button></li>`;
  }).join('')}</ul>`;
}

function courbes(p) {
  const ss = seancesTriees().filter((s) => s.douleur != null);
  const douleur = courbe(ss.map((s) => ({ t: s.debut, y: s.douleur })), { yMin: 0, yMax: 10, unite: 'sur 10' });
  const exos = courbesExercices();
  const choisie = exos.find((x) => x.cle === p.cle) || exos.find((x) => x.unite === 'kg') || exos[0];
  return `<h2>Douleur au dos</h2>${douleur}
    <h2>Progression par exercice</h2>
    ${exos.length ? `<label class="champ"><span>Exercice</span><select data-ui="cle">
      ${exos.map((x) => `<option value="${esc(x.cle)}" ${x === choisie ? 'selected' : ''}>${esc(x.nom)}${x.cle.endsWith('|1') ? ' (sans matériel)' : ''}</option>`).join('')}
    </select></label>
    ${courbe(choisie.points, { unite: choisie.unite })}` : '<p class="vide">Pas encore de données.</p>'}`;
}

actions['histo-onglet'] = (d) => aller('historique', { onglet: d.o });
actions.detail = (d) => aller('detail', { id: d.id });

vues.detail = {
  html(p) {
    const s = donnees.seances.find((x) => x.id === p.id);
    if (!s) return vues.historique.html({});
    const raisons = raisonsAlerte(s);
    const groupes = new Map();
    for (const x of s.series) {
      const k = cle(x.exo, x.variante, x.sansCharge);
      if (!groupes.has(k)) groupes.set(k, []);
      groupes.get(k).push(x);
    }
    const lignes = [...groupes.values()].map((series) => {
      const x0 = series[0];
      const vals = series.map((x) => (x.etat === 'faite' ? valeurSerie(x) : 'passée') + (x.cote ? ` (${x.cote})` : '')).join(' · ');
      return `<li><strong>${esc(x0.nom)}${x0.variante ? ` <small>${esc(x0.variante)}</small>` : ''}</strong><span>${esc(vals)}</span></li>`;
    }).join('');
    return `<main class="ecran detail">
      ${entete(dateLongue(s.debut), { action: 'onglet', attrs: 'data-vue="historique"', texte: 'Historique' })}
      <p class="sous">${esc(MODES[s.mode])} · ${esc(heure(s.debut))} · ${esc(dureeTexte(s.fin - s.debut))}</p>
      ${raisons.length ? `<div class="alerte"><p class="fort">${esc(MESSAGE_ARRET)}</p>${raisons.map((r) => `<p>${esc(r)}</p>`).join('')}</div>` : ''}
      <section class="tuiles">
        <div class="tuile"><span class="grand">${s.douleur ?? '?'}<small>/10</small></span><span>douleur au dos</span></div>
        <div class="tuile"><span class="grand">${s.jambe ? 'Oui' : 'Non'}</span><span>jambe, fourmillements</span></div>
      </section>
      ${s.note ? `<p class="note">« ${esc(s.note)} »</p>` : ''}
      <ul class="detail-series">
        ${s.echauffement ? '<li><strong>Échauffement</strong><span>vélo</span></li>' : ''}
        ${lignes}
        ${s.velo ? `<li><strong>Vélo</strong><span>${s.velo.etat === 'faite' ? `${s.velo.minutes} min (objectif ${s.velo.objectif} min)` : 'passé'}</span></li>` : ''}
      </ul>
      <button class="lien danger" data-action="supprimer-seance" data-id="${esc(s.id)}">Supprimer cette séance</button>
    </main>${nav('historique')}`;
  },
};

actions['supprimer-seance'] = (d) => {
  const s = donnees.seances.find((x) => x.id === d.id);
  if (!s || !confirm(`Supprimer la séance du ${dateCourte(s.debut)} ? C’est définitif.`)) return;
  donnees.seances = donnees.seances.filter((x) => x.id !== d.id);
  sauver();
  aller('historique');
};
