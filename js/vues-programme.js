// Programme, fiches d'exercice et modification du programme.
import { donnees, sauver, reinitialiserProgramme } from './stockage.js';
import { ui, vues, actions, aller, rendre, toast, nav, entete, pasAPas } from './ui.js';
import { esc, uid } from './outils.js';
import { nouvelExercice } from './programme-defaut.js';

const lienSur = (url) => /^https?:\/\//i.test(String(url || '').trim());

export function ficheHtml(id, dansSeance = false) {
  const exo = donnees.programme.exercices[id];
  if (!exo) return '<p class="vide">Exercice introuvable.</p>';
  const retour = dansSeance
    ? { action: 'feuille-fermer', texte: 'Retour à la séance' }
    : { action: 'onglet', attrs: 'data-vue="programme"', texte: 'Programme' };
  return `${entete(exo.nom, retour)}
    <dl class="fiche">
      <div><dt>Muscle travaillé</dt><dd>${esc(exo.muscle)}</dd></div>
      <div><dt>Matériel conseillé</dt><dd>${esc(exo.materiel)}</dd></div>
      ${exo.sansMateriel ? `<div><dt>Sans matériel</dt><dd>${esc(exo.sansMateriel.nom || exo.nom)}</dd></div>` : ''}
    </dl>
    <label class="champ"><span>Où la trouver dans ma salle</span>
      <input type="text" data-fiche="ouTrouver" data-exo="${esc(id)}" value="${esc(exo.ouTrouver)}" placeholder="Par exemple : au fond, près des miroirs"></label>
    <h2>Placement</h2>
    <ol class="consignes">${exo.consignes.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>
    ${lienSur(exo.video) ? `<a class="secondaire large lien-video" href="${esc(exo.video.trim())}" target="_blank" rel="noopener noreferrer">Voir des vidéos explicatives ↗</a>` : ''}
    <label class="champ"><span>Lien de la vidéo</span>
      <input type="url" data-fiche="video" data-exo="${esc(id)}" value="${esc(exo.video)}" placeholder="https://…"></label>
    ${dansSeance ? '' : `<button class="secondaire large" data-action="editer-exo" data-exo="${esc(id)}">Modifier l’exercice</button>`}`;
}

/* ---------- Liste du programme ---------- */

vues.programme = {
  html(p) {
    const pr = donnees.programme;
    const ed = !!p.edition;
    const blocs = pr.blocs.map((b, ib) => `<section class="bloc">
      <div class="bloc-tete">
        ${ed ? `<input class="nom-bloc" type="text" data-bloc-nom="${b.id}" value="${esc(b.nom)}" aria-label="Nom du bloc">` : `<h2>${esc(b.nom)}</h2>`}
        ${ed ? '' : `<span class="etiq">${b.tours} série${b.tours > 1 ? 's' : ''}${b.express ? ' · express' : ''}</span>`}
      </div>
      <ul class="liste-exos">${b.exercices.map((id, i) => {
        const exo = pr.exercices[id];
        if (!exo) return '';
        return ed
          ? `<li class="ligne-edition"><span class="nom">${esc(exo.nom)}</span>
              <button class="icone" data-action="exo-deplacer" data-b="${ib}" data-i="${i}" data-sens="-1" aria-label="Monter" ${i === 0 ? 'disabled' : ''}>↑</button>
              <button class="icone" data-action="exo-deplacer" data-b="${ib}" data-i="${i}" data-sens="1" aria-label="Descendre" ${i === b.exercices.length - 1 ? 'disabled' : ''}>↓</button>
              <button class="icone" data-action="editer-exo" data-exo="${esc(id)}">Modifier</button></li>`
          : `<li><button class="ligne-exo" data-action="fiche" data-exo="${esc(id)}"><span>${esc(exo.nom)}<small>${esc(exo.muscle)}${exo.ouTrouver ? ` · ${esc(exo.ouTrouver)}` : ''}</small></span><span class="chevron" aria-hidden="true">›</span></button></li>`;
      }).join('')}</ul>
      ${ed ? `<div class="outils-bloc">
        ${pasAPas({ champ: 'tours', valeur: b.tours, unite: 'séries', etiquette: 'Séries par exercice', cible: `data-b="${ib}"` })}
        <button class="case neutre ${b.express ? 'cochee' : ''}" data-action="bloc-express" data-b="${ib}" aria-pressed="${!!b.express}"><span class="carre" aria-hidden="true">${b.express ? '✓' : ''}</span><span>Inclus dans la séance express</span></button>
        <div class="deux">
          <button class="secondaire" data-action="ajouter-exo" data-b="${ib}">Ajouter un exercice</button>
          <button class="secondaire danger" data-action="supprimer-bloc" data-b="${ib}">Supprimer le bloc</button>
        </div>
      </div>` : ''}
    </section>`).join('');

    return `<main class="ecran programme">
      ${entete('Programme')}
      ${ed ? '' : `<div class="rappel">
        <p><strong>2 à 3 séances par semaine.</strong> 2 séries par exercice, 8 à 12 répétitions, en alternant les deux exercices d’un bloc.</p>
        <p>Augmenter la charge seulement quand c’est facile (au moins 2 répétitions en réserve) et sans douleur, pendant et après la séance.</p>
        <p>Échauffement : ${donnees.reglages.echauffementMin} min de vélo. Vélo 2 fois par semaine, objectif 30 min.</p>
      </div>`}
      ${blocs}
      ${ed
        ? `<button class="secondaire large" data-action="ajouter-bloc">Ajouter un bloc</button>
           <button class="lien danger" data-action="programme-defaut">Rétablir le programme du kiné</button>
           <div class="pied"><button class="principal" data-action="edition" data-on="0">Terminé</button></div>`
        : '<button class="secondaire large" data-action="edition" data-on="1">Modifier le programme</button>'}
    </main>${ed ? '' : nav('programme')}`;
  },

  ajuster(champ, signe, d) {
    if (champ !== 'tours') return;
    const b = donnees.programme.blocs[Number(d.b)];
    b.tours = Math.max(1, Math.min(6, b.tours + signe));
    sauver();
    rendre();
  },

  saisir(champ, texte, d) {
    if (champ !== 'tours') return;
    const n = parseInt(texte, 10);
    const b = donnees.programme.blocs[Number(d.b)];
    if (n >= 1 && n <= 6) b.tours = n;
    sauver();
    rendre();
  },
};

actions.fiche = (d) => aller('fiche', { exo: d.exo });
actions.edition = (d) => aller('programme', { edition: d.on === '1' });

actions['exo-deplacer'] = (d) => {
  const b = donnees.programme.blocs[Number(d.b)];
  const i = Number(d.i);
  const j = i + Number(d.sens);
  if (j < 0 || j >= b.exercices.length) return;
  [b.exercices[i], b.exercices[j]] = [b.exercices[j], b.exercices[i]];
  sauver();
  rendre();
};

actions['bloc-express'] = (d) => {
  const b = donnees.programme.blocs[Number(d.b)];
  b.express = !b.express;
  sauver();
  rendre();
};

actions['ajouter-exo'] = (d) => {
  const id = 'exo-' + uid();
  donnees.programme.exercices[id] = nouvelExercice();
  donnees.programme.blocs[Number(d.b)].exercices.push(id);
  sauver();
  aller('edition', { exo: id, nouveau: true });
};

actions['supprimer-bloc'] = (d) => {
  const b = donnees.programme.blocs[Number(d.b)];
  if (!confirm(`Supprimer « ${b.nom} » et ses exercices ? L’historique est conservé.`)) return;
  for (const id of b.exercices) delete donnees.programme.exercices[id];
  donnees.programme.blocs.splice(Number(d.b), 1);
  sauver();
  rendre();
};

actions['ajouter-bloc'] = () => {
  const pr = donnees.programme;
  pr.blocs.push({ id: 'b-' + uid(), nom: `Bloc ${pr.blocs.length + 1}`, tours: 2, express: false, exercices: [] });
  sauver();
  rendre();
};

actions['programme-defaut'] = () => {
  if (!confirm('Remettre le programme d’origine du kiné ? Tes modifications du programme seront perdues (pas ton historique).')) return;
  reinitialiserProgramme();
  aller('programme');
  toast('Programme du kiné rétabli.');
};

/* ---------- Fiche ---------- */

vues.fiche = {
  html: (p) => `<main class="ecran">${ficheHtml(p.exo)}</main>${nav('programme')}`,
};

actions['editer-exo'] = (d) => aller('edition', { exo: d.exo, retourFiche: ui.vue === 'fiche' });

/* ---------- Modification d'un exercice ---------- */

vues.edition = {
  html(p) {
    const exo = donnees.programme.exercices[p.exo];
    if (!exo) return vues.programme.html({});
    const sm = exo.sansMateriel;
    return `<main class="ecran edition">
      ${entete(p.nouveau ? 'Nouvel exercice' : 'Modifier', { action: 'edition-annuler', texte: 'Annuler' })}
      <label class="champ"><span>Nom</span><input type="text" id="f-nom" value="${esc(exo.nom)}"></label>
      <label class="champ"><span>Muscle travaillé</span><input type="text" id="f-muscle" value="${esc(exo.muscle)}"></label>
      <label class="champ"><span>Matériel ou machine</span><input type="text" id="f-materiel" value="${esc(exo.materiel)}"></label>
      <label class="champ"><span>Consignes (une par ligne)</span><textarea id="f-consignes" rows="5">${esc(exo.consignes.join('\n'))}</textarea></label>
      <label class="champ"><span>Lien de la vidéo</span><input type="url" id="f-video" value="${esc(exo.video)}" placeholder="https://…"></label>
      <label class="champ"><span>Ce que je note</span>
        <select id="f-mesure">
          <option value="charge" ${exo.mesure === 'charge' ? 'selected' : ''}>Charge (kg) et répétitions</option>
          <option value="reps" ${exo.mesure === 'reps' ? 'selected' : ''}>Répétitions seulement</option>
          <option value="duree" ${exo.mesure === 'duree' ? 'selected' : ''}>Durée (gainage)</option>
        </select></label>
      <label class="champ"><span>Variantes au choix (une par ligne, facultatif)</span><textarea id="f-variantes" rows="3">${esc(exo.variantes.join('\n'))}</textarea></label>
      <label class="champ case-champ"><input type="checkbox" id="f-cotes" ${exo.cotes ? 'checked' : ''}><span>Se fait côté gauche puis côté droit</span></label>
      <label class="champ case-champ"><input type="checkbox" id="f-sm" ${sm ? 'checked' : ''}><span>Fait partie de la séance sans matériel</span></label>
      <label class="champ"><span>Nom dans la séance sans matériel</span><input type="text" id="f-sm-nom" value="${esc(sm ? sm.nom : '')}" placeholder="${esc(exo.nom)}"></label>
      <label class="champ"><span>Message « passage à la barre » à partir de (kg), vide si aucun</span><input type="text" inputmode="decimal" id="f-barre" value="${exo.seuilBarreKg ?? ''}"></label>
      ${p.nouveau ? '' : '<button class="lien danger" data-action="supprimer-exo">Retirer cet exercice du programme</button>'}
      <div class="pied"><button class="principal" data-action="edition-enregistrer">Enregistrer</button></div>
    </main>`;
  },
};

const lignes = (id) => document.getElementById(id).value.split('\n').map((x) => x.trim()).filter(Boolean);

actions['edition-enregistrer'] = () => {
  const p = ui.p;
  const exo = donnees.programme.exercices[p.exo];
  const val = (id) => document.getElementById(id).value.trim();
  exo.nom = val('f-nom') || exo.nom;
  exo.muscle = val('f-muscle');
  exo.materiel = val('f-materiel');
  exo.consignes = lignes('f-consignes');
  exo.video = val('f-video');
  exo.mesure = val('f-mesure');
  exo.variantes = lignes('f-variantes');
  exo.cotes = document.getElementById('f-cotes').checked;
  exo.sansMateriel = document.getElementById('f-sm').checked ? { nom: val('f-sm-nom') || exo.nom } : null;
  const barre = parseFloat(val('f-barre').replace(',', '.'));
  exo.seuilBarreKg = Number.isFinite(barre) && barre > 0 ? barre : null;
  sauver();
  toast('Exercice enregistré.');
  aller('fiche', { exo: p.exo });
};

actions['edition-annuler'] = () => {
  const p = ui.p;
  if (p.nouveau) {
    retirer(p.exo);
    aller('programme', { edition: true });
  } else if (p.retourFiche) {
    aller('fiche', { exo: p.exo });
  } else {
    aller('programme', { edition: true });
  }
};

function retirer(id) {
  for (const b of donnees.programme.blocs) b.exercices = b.exercices.filter((x) => x !== id);
  delete donnees.programme.exercices[id];
  sauver();
}

actions['supprimer-exo'] = () => {
  const exo = donnees.programme.exercices[ui.p.exo];
  if (!confirm(`Retirer « ${exo.nom} » du programme ? L’historique est conservé.`)) return;
  retirer(ui.p.exo);
  aller('programme', { edition: true });
  toast('Exercice retiré.');
};

// Champs modifiés directement sur la fiche (lieu dans la salle, lien vidéo).
export function changerFiche(el) {
  const exo = donnees.programme.exercices[el.dataset.exo];
  if (!exo) return;
  exo[el.dataset.fiche] = el.value.trim();
  sauver();
  toast('Enregistré.');
  if (el.dataset.fiche === 'video') rendre();
}

export function changerNomBloc(el) {
  const b = donnees.programme.blocs.find((x) => x.id === el.dataset.blocNom);
  if (b && el.value.trim()) { b.nom = el.value.trim(); sauver(); }
}
