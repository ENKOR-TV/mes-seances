// Accueil, déroulé de séance, fin de séance et résultat.
import { donnees, sauver, demanderPersistance } from './stockage.js';
import { ui, vues, actions, aller, rendre, toast, nav, pasAPas, entete } from './ui.js';
import { esc, mmss, nombre, dateLongue, dateCourte, ilYa, periodeSemaine, lireNombre, dureeTexte } from './outils.js';
import {
  MODES, creerSeance, objectifVelo, veloParDefaut, seancesTriees, seriesPrecedentes, changerVariante,
  propager, indexSuivante, progression, plusTard, finaliser, enregistrer, valeurSerie, resumeEtape,
} from './seance.js';
import {
  statsSemaine, raisonsAlerte, suggestionsApres, suggestionPour, besoinMessageBarre, bilanTexte, MESSAGE_ARRET, MESSAGE_BARRE,
} from './regles.js';
import { preparerSon, signalFin, garderEcranAllume, libererEcran } from './signal.js';
import { ficheHtml } from './vues-programme.js';

const seance = () => donnees.seanceEnCours;
const courante = () => seance() && seance().etapes[seance().courante];

/* ---------- Accueil ---------- */

let choixVelo = null; // null : selon le jour

const estInstallee = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
const estIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent);

vues.accueil = {
  html() {
    const st = statsSemaine();
    const toutes = seancesTriees();
    const derniere = toutes[toutes.length - 1];
    const enCours = seance();
    const avecVelo = choixVelo ?? veloParDefaut();
    const alerte = derniere ? raisonsAlerte(derniere) : [];
    const dont = [];
    if (st.express) dont.push(`${st.express} express`);
    if (st.sansMateriel) dont.push(`${st.sansMateriel} sans matériel`);
    const conseilInstall = estIphone() && !estInstallee() && !donnees.reglages.installMasque;

    return `<main class="ecran accueil">
      <header class="entete"><h1>Les séances de Raphaël</h1><p class="sous">Semaine ${esc(periodeSemaine())}</p></header>

      ${conseilInstall ? `<div class="info">
        <p>Pour l’utiliser hors connexion, installe l’appli : touche <strong>Partager</strong> dans Safari, puis <strong>Sur l’écran d’accueil</strong>. Ouvre-la ensuite toujours depuis son icône.</p>
        <button class="lien" data-action="masquer-install">Compris</button></div>` : ''}

      ${alerte.length ? `<div class="alerte" role="alert"><p class="fort">${esc(MESSAGE_ARRET)}</p>${alerte.map((r) => `<p>${esc(r)}</p>`).join('')}<p class="petit-texte">Signalé lors de ta dernière séance.</p></div>` : ''}

      <section class="compteurs">
        <div class="compteur ${st.seances >= 3 ? 'atteint' : ''}"><span class="grand">${st.seances}<small>/3</small></span><span>séances</span></div>
        <div class="compteur ${st.velos >= 2 ? 'atteint' : ''}"><span class="grand">${st.velos}<small>/2</small></span><span>vélo</span></div>
      </section>
      ${dont.length ? `<p class="detail">dont ${esc(dont.join(', '))}</p>` : ''}
      <p class="derniere">${derniere ? `Dernière séance : ${esc(dateLongue(derniere.debut))} (${esc(ilYa(derniere.debut))})` : 'Aucune séance pour l’instant.'}</p>

      <div class="actions-accueil">
      ${enCours ? `
        <button class="principal" data-action="reprendre">Reprendre la séance</button>
        <p class="aide centre">${esc(MODES[enCours.mode])} commencée ${esc(ilYa(enCours.debut))}, ${progression(enCours).faites} étapes sur ${progression(enCours).total}.</p>
        <button class="lien danger" data-action="abandonner">Abandonner la séance en cours</button>`
      : `
        <button class="interrupteur ${avecVelo ? 'actif' : ''}" data-action="basculer-velo" aria-pressed="${avecVelo}">
          <span>Vélo après la séance<small>${objectifVelo()} min, allure confortable</small></span><span class="bascule" aria-hidden="true"></span>
        </button>
        <button class="principal" data-action="demarrer" data-mode="complete">Démarrer la séance</button>
        <div class="deux">
          <button class="secondaire" data-action="demarrer" data-mode="express">Séance express<small>20 min, mauvais jour</small></button>
          <button class="secondaire" data-action="demarrer" data-mode="sans-materiel">Sans matériel<small>semaine de tournage</small></button>
        </div>`}
        <button class="tertiaire" data-action="copier-bilan">Copier mon bilan de la semaine</button>
      </div>
    </main>${nav('accueil')}`;
  },
};

actions['basculer-velo'] = () => { choixVelo = !(choixVelo ?? veloParDefaut()); rendre(); };
actions['masquer-install'] = () => { donnees.reglages.installMasque = true; sauver(); rendre(); };

actions.demarrer = (d) => {
  preparerSon();
  const avecVelo = d.mode !== 'sans-materiel' && (choixVelo ?? veloParDefaut());
  donnees.seanceEnCours = creerSeance(d.mode, avecVelo);
  choixVelo = null;
  sauver();
  garderEcranAllume();
  demanderPersistance();
  aller('seance');
};

actions.reprendre = () => { preparerSon(); garderEcranAllume(); aller('seance'); };

actions.abandonner = () => {
  if (!confirm('Abandonner la séance en cours sans l’enregistrer ?')) return;
  donnees.seanceEnCours = null;
  sauver();
  libererEcran();
  aller('accueil');
};

actions['copier-bilan'] = async () => {
  const texte = bilanTexte();
  try {
    await navigator.clipboard.writeText(texte);
    toast('Bilan copié. Tu peux le coller où tu veux.');
  } catch (e) {
    aller('bilan-texte', { texte });
  }
};

// Si la copie automatique échoue : texte affiché, à sélectionner à la main.
vues['bilan-texte'] = {
  html: (p) => `<main class="ecran">${entete('Mon bilan', { action: 'onglet', attrs: 'data-vue="accueil"', texte: 'Accueil' })}
    <p class="aide">Appuie longuement sur le texte, puis « Tout sélectionner » et « Copier ».</p>
    <textarea class="bilan" rows="14" readonly>${esc(p.texte)}</textarea></main>${nav('accueil')}`,
};

/* ---------- Déroulé de séance ---------- */

vues.seance = {
  html(p) {
    const s = seance();
    if (!s) return vues.accueil.html();
    const e = courante();
    const pr = progression(s);
    return `<main class="ecran seance">
      <div class="barre-haut">
        <button class="petit" data-action="feuille" data-f="etapes">Étapes</button>
        <div class="progression" role="progressbar" aria-label="Progression de la séance" aria-valuenow="${pr.pct}" aria-valuemin="0" aria-valuemax="100"><div style="width:${pr.pct}%"></div></div>
        <span class="compte">${pr.faites}/${pr.total}</span>
      </div>
      ${e ? carte(s, e) : ''}
    </main>
    ${s.repos ? ecranRepos(s) : ''}
    ${p.feuille === 'etapes' ? feuilleEtapes(s) : ''}
    ${p.feuille === 'fiche' ? `<div class="feuille"><div class="ecran">${ficheHtml(p.exo, true)}</div></div>` : ''}`;
  },

  ajuster(champ, signe) {
    const e = courante();
    if (!e) return;
    const exo = donnees.programme.exercices[e.exo] || {};
    const pas = { charge: exo.pas || 1, reps: 1, duree: 5, minutes: 1 }[champ] || 1;
    const v = Math.max(champ === 'minutes' || champ === 'duree' ? 1 : 0, Math.round(((e[champ] || 0) + signe * pas) * 100) / 100);
    e[champ] = v;
    if (champ === 'charge' || champ === 'duree') propager(seance(), e, champ);
    sauver();
    rendre();
  },

  saisir(champ, texte) {
    const e = courante();
    const v = lireNombre(texte);
    if (!e || v == null || v < 0) { rendre(); return; }
    e[champ] = champ === 'reps' || champ === 'duree' || champ === 'minutes' ? Math.round(v) : v;
    if (champ === 'charge' || champ === 'duree') propager(seance(), e, champ);
    sauver();
    rendre();
  },
};

function carte(s, e) {
  if (e.type === 'echauffement') {
    return carteChrono(e, 'Échauffement', 'Vélo, allure facile', 'Pour chauffer le corps en douceur.');
  }
  if (e.type === 'velo') {
    return carteChrono(e, 'Vélo', 'Vélo, allure confortable', 'Tu dois pouvoir parler sans être essoufflé.');
  }
  return carteSerie(s, e);
}

function carteChrono(e, surtitre, titre, texte) {
  const enCours = !!e.chrono;
  return `<section class="etape">
      <p class="surtitre">${esc(surtitre)}</p>
      <h2>${esc(titre)}</h2>
      <p class="consigne">${esc(texte)}</p>
      ${enCours
        ? `<div class="chrono-geant" data-fin="${e.chrono.fin}">${mmss(e.chrono.fin - Date.now())}</div>`
        : pasAPas({ champ: 'minutes', valeur: e.minutes, unite: 'min', etiquette: 'Durée' })}
    </section>
    <div class="pied">
      ${enCours
        ? '<button class="principal arret" data-action="chrono-stop">Terminer maintenant</button>'
        : `<div class="deux"><button class="secondaire" data-action="passer">Passer</button><button class="secondaire" data-action="fait">Déjà fait</button></div>
           <button class="principal" data-action="chrono-go">Démarrer ${e.minutes} min</button>`}
    </div>`;
}

function carteSerie(s, e) {
  const exo = donnees.programme.exercices[e.exo] || { variantes: [], libelleCharge: 'Charge' };
  const prec = seriesPrecedentes(e.exo, e.variante, e.sansCharge);
  const precSerie = prec && (prec.series.find((x) => x.n === e.n && x.cote === e.cote) || prec.series[prec.series.length - 1]);
  const mot = e.mesure === 'duree' ? 'Tour' : 'Série';
  const enCours = !!e.chrono;

  const avis = [];
  if (e.mesure === 'charge' && besoinMessageBarre(e.exo, e.charge, e.sansCharge)) avis.push(`<div class="avis">${esc(MESSAGE_BARRE)}</div>`);
  const premiere = !s.etapes.some((x) => x !== e && x.exo === e.exo && x.etat === 'faite');
  const sug = premiere ? suggestionPour(e.exo, e.variante, e.sansCharge) : null;
  if (sug && !(sug === MESSAGE_BARRE && avis.length)) avis.push(`<div class="suggestion"><strong>Suggestion</strong> d’après ta dernière séance : ${esc(sug)}</div>`);

  let champs = '';
  if (e.mesure === 'charge') champs += pasAPas({ champ: 'charge', valeur: nombre(e.charge), unite: 'kg', etiquette: exo.libelleCharge || 'Charge' });
  if (e.mesure !== 'duree') champs += pasAPas({ champ: 'reps', valeur: e.reps, unite: '', etiquette: 'Répétitions (8 à 12)' });
  if (e.mesure === 'duree') {
    champs += enCours
      ? `<div class="chrono-geant" data-fin="${e.chrono.fin}">${mmss(e.chrono.fin - Date.now())}</div>`
      : pasAPas({ champ: 'duree', valeur: e.duree, unite: 's', etiquette: 'Durée (30 s vers 1 min)' });
  }

  const boutonPrincipal = e.mesure === 'duree'
    ? (enCours
      ? '<button class="principal arret" data-action="chrono-stop">Arrêter</button>'
      : `<button class="principal" data-action="chrono-go">Démarrer ${e.duree} s</button>`)
    : '<button class="principal" data-action="fait">Fait ✓</button>';

  return `<section class="etape">
      <p class="surtitre">${esc(e.blocNom)} · ${mot} ${e.n}/${e.total}</p>
      <h2>${esc(e.nom)}${e.cote ? ` <span class="cote">côté ${esc(e.cote)}</span>` : ''}</h2>
      <p class="meta">${esc(exo.muscle || '')}${exo.ouTrouver ? ` · ${esc(exo.ouTrouver)}` : ''} <button class="lien" data-action="feuille" data-f="fiche">Voir la fiche</button></p>
      ${exo.variantes && exo.variantes.length ? `<div class="puces">${exo.variantes.map((v) => `<button class="puce ${v === e.variante ? 'active' : ''}" data-action="variante" data-v="${esc(v)}" aria-pressed="${v === e.variante}">${esc(v)}</button>`).join('')}</div>` : ''}
      <p class="precedent">${precSerie ? `La dernière fois (${esc(dateCourte(prec.seance.debut))}) : <strong>${esc(valeurSerie(precSerie))}</strong>` : e.mesure === 'charge' ? 'Première fois : commence léger.' : e.mesure === 'duree' ? 'Première fois : commence par 30 secondes.' : 'Première fois.'}</p>
      ${champs}
      ${avis.join('')}
    </section>
    <div class="pied">
      ${enCours ? '' : `<div class="deux"><button class="secondaire" data-action="plus-tard">Plus tard</button><button class="secondaire" data-action="passer">Passer</button></div>`}
      ${boutonPrincipal}
      ${e.mesure === 'duree' && !enCours ? '<button class="lien" data-action="fait">Fait sans minuteur</button>' : ''}
    </div>`;
}

function ecranRepos(s) {
  const suiv = courante();
  const reste = s.repos.fin - Date.now();
  const pct = Math.max(0, Math.min(100, (reste / s.repos.total) * 100));
  return `<div class="repos" role="dialog" aria-label="Repos">
    <p class="surtitre">Repos</p>
    <div class="chrono-geant" data-fin="${s.repos.fin}" aria-live="off">${mmss(reste)}</div>
    <div class="jauge"><div data-jauge-fin="${s.repos.fin}" data-jauge-total="${s.repos.total}" style="width:${pct}%"></div></div>
    <p class="ensuite">Ensuite : <strong>${esc(resumeEtape(suiv))}</strong></p>
    <div class="deux">
      <button class="secondaire" data-action="repos-ajuster" data-sec="-15">−15 s</button>
      <button class="secondaire" data-action="repos-ajuster" data-sec="15">+15 s</button>
    </div>
    <button class="principal" data-action="repos-fin">Passer le repos</button>
  </div>`;
}

function feuilleEtapes(s) {
  let blocPrecedent = null;
  const items = s.etapes.map((e, i) => {
    const titreBloc = e.type === 'serie' ? e.blocNom : e.type === 'velo' ? 'Vélo' : 'Échauffement';
    const sep = titreBloc !== blocPrecedent ? `<li class="sep">${esc(titreBloc)}</li>` : '';
    blocPrecedent = titreBloc;
    const etat = i === s.courante ? 'courante' : e.etat;
    const icone = { faite: '✓', sautee: '↷', courante: '●', 'a-faire': '' }[etat];
    return `${sep}<li><button class="ligne-etape ${etat}" data-action="aller-etape" data-i="${i}" ${e.etat === 'faite' ? 'disabled' : ''}>
      <span class="etat" aria-hidden="true">${icone}</span><span>${esc(resumeEtape(e))}</span>${e.etat === 'sautee' ? '<small>passée</small>' : ''}</button></li>`;
  }).join('');
  return `<div class="feuille"><div class="ecran">
    ${entete('Étapes', { action: 'feuille-fermer', texte: 'Retour' })}
    <p class="aide">Touche une étape pour y aller directement (machine occupée, ordre différent).</p>
    <ol class="liste-etapes">${items}</ol>
    <button class="secondaire large" data-action="terminer">Terminer la séance maintenant</button>
    <button class="lien danger" data-action="abandonner">Abandonner sans enregistrer</button>
  </div></div>`;
}

function valider(e) {
  const s = seance();
  e.etat = 'faite';
  e.chrono = null;
  if (e.type !== 'serie' && e.minutesFaites == null) e.minutesFaites = e.minutes;
  if (e.type === 'serie' && e.objectif == null) e.objectif = e.duree;
  const i = indexSuivante(s, s.etapes.indexOf(e));
  if (i === -1) {
    s.repos = null;
    sauver();
    aller('fin', { douleur: null, jambe: false, note: '' });
    return;
  }
  s.courante = i;
  if (e.type === 'serie') {
    const total = donnees.reglages.reposSec * 1000;
    s.repos = { fin: Date.now() + total, total };
  }
  sauver();
  ui.p.feuille = null;
  rendre();
  window.scrollTo(0, 0);
}

actions.fait = () => { preparerSon(); const e = courante(); if (e) valider(e); };

actions.passer = () => {
  const s = seance();
  const e = courante();
  if (!e) return;
  e.etat = 'sautee';
  e.chrono = null;
  const i = indexSuivante(s);
  if (i === -1) { sauver(); aller('fin', { douleur: null, jambe: false, note: '' }); return; }
  s.courante = i;
  sauver();
  rendre();
  window.scrollTo(0, 0);
};

actions['plus-tard'] = () => {
  const s = seance();
  const avant = courante();
  plusTard(s);
  sauver();
  rendre();
  window.scrollTo(0, 0);
  if (courante() !== avant) toast(`${avant.nom} : plus tard`);
};

actions.variante = (d) => {
  const e = courante();
  changerVariante(seance(), e.exo, d.v);
  sauver();
  rendre();
};

actions['chrono-go'] = () => {
  preparerSon();
  const e = courante();
  const ms = e.type === 'serie' ? e.duree * 1000 : e.minutes * 60000;
  if (e.type === 'serie') e.objectif = e.duree;
  e.chrono = { debut: Date.now(), fin: Date.now() + ms };
  sauver();
  rendre();
};

actions['chrono-stop'] = () => {
  const e = courante();
  if (!e || !e.chrono) return;
  const ecoule = Date.now() - e.chrono.debut;
  if (e.type === 'serie') e.duree = Math.max(1, Math.round(ecoule / 1000));
  else e.minutesFaites = Math.max(1, Math.round(ecoule / 60000));
  valider(e);
};

actions['repos-ajuster'] = (d) => {
  const s = seance();
  if (!s.repos) return;
  const delta = Number(d.sec) * 1000;
  s.repos.fin += delta;
  s.repos.total = Math.max(1000, s.repos.total + delta);
  if (s.repos.fin <= Date.now()) s.repos = null;
  sauver();
  rendre();
};

actions['repos-fin'] = () => { seance().repos = null; sauver(); rendre(); };

actions.feuille = (d) => { ui.p.feuille = d.f; ui.p.exo = courante() && courante().exo; rendre(); window.scrollTo(0, 0); };
actions['feuille-fermer'] = () => { ui.p.feuille = null; rendre(); };

actions['aller-etape'] = (d) => {
  const s = seance();
  const i = Number(d.i);
  const e = s.etapes[i];
  if (!e || e.etat === 'faite') return;
  if (e.etat === 'sautee') e.etat = 'a-faire';
  s.courante = i;
  s.repos = null;
  sauver();
  ui.p.feuille = null;
  rendre();
};

actions.terminer = () => {
  seance().repos = null;
  sauver();
  aller('fin', { douleur: null, jambe: false, note: '' });
};

// Appelé quatre fois par seconde par app.js pendant une séance.
export function tic() {
  const s = seance();
  if (!s || ui.vue !== 'seance') return;
  const t = Date.now();
  document.querySelectorAll('[data-fin]').forEach((el) => { el.textContent = mmss(Number(el.dataset.fin) - t); });
  document.querySelectorAll('[data-jauge-fin]').forEach((el) => {
    el.style.width = `${Math.max(0, Math.min(100, ((Number(el.dataset.jaugeFin) - t) / Number(el.dataset.jaugeTotal)) * 100))}%`;
  });
  if (s.repos && t >= s.repos.fin) {
    s.repos = null;
    sauver();
    signalFin();
    rendre();
    return;
  }
  const e = courante();
  if (e && e.chrono && t >= e.chrono.fin) {
    signalFin();
    valider(e);
  }
}

/* ---------- Fin de séance ---------- */

vues.fin = {
  html(p) {
    const s = seance();
    if (!s) return vues.accueil.html();
    const restantes = s.etapes.filter((e) => e.etat === 'a-faire').length;
    const douleurs = Array.from({ length: 11 }, (_, n) => `<button class="${p.douleur === n ? 'choisi' : ''}" data-action="douleur" data-v="${n}" aria-pressed="${p.douleur === n}">${n}</button>`).join('');
    return `<main class="ecran fin">
      ${entete('Fin de séance')}
      ${restantes
        ? `<div class="info"><p>${restantes} étape${restantes > 1 ? 's' : ''} non faite${restantes > 1 ? 's' : ''} : elles seront notées « passées ».</p><button class="lien" data-action="retour-seance">Revenir à la séance</button></div>`
        : '<p class="bravo">Séance terminée. Bien joué.</p>'}
      <h2 class="question">Douleur au dos maintenant</h2>
      <p class="aide">0 : aucune douleur. 10 : douleur maximale.</p>
      <div class="grille-douleur">${douleurs}</div>
      <button class="case ${p.jambe ? 'cochee' : ''}" data-action="jambe" aria-pressed="${!!p.jambe}">
        <span class="carre" aria-hidden="true">${p.jambe ? '✓' : ''}</span>
        <span>Douleur qui descend dans la jambe ou fourmillements</span>
      </button>
      <label class="champ"><span>Note (facultatif)</span><textarea data-note rows="3" placeholder="Machine occupée, fatigue, sensations…">${esc(p.note)}</textarea></label>
      <div class="pied"><button class="principal" data-action="enregistrer">Enregistrer la séance</button></div>
    </main>`;
  },
};

actions.douleur = (d) => { ui.p.douleur = Number(d.v); rendre(); };
actions.jambe = () => { ui.p.jambe = !ui.p.jambe; rendre(); };
actions['retour-seance'] = () => aller('seance');

actions.enregistrer = () => {
  const s = seance();
  if (ui.p.douleur == null) { toast('Choisis d’abord ta douleur au dos, de 0 à 10.'); return; }
  const record = finaliser(s, ui.p);
  enregistrer(record);
  libererEcran();
  aller('resultat', { id: record.id });
};

/* ---------- Résultat ---------- */

vues.resultat = {
  html(p) {
    const s = donnees.seances.find((x) => x.id === p.id);
    if (!s) return vues.accueil.html();
    const raisons = raisonsAlerte(s);
    const sug = suggestionsApres(s);
    const faites = s.series.filter((x) => x.etat === 'faite').length;
    return `<main class="ecran resultat">
      ${entete('Séance enregistrée')}
      ${raisons.length ? `<div class="alerte" role="alert"><p class="fort">${esc(MESSAGE_ARRET)}</p>${raisons.map((r) => `<p>${esc(r)}</p>`).join('')}</div>` : ''}
      <section class="tuiles">
        <div class="tuile"><span class="grand">${esc(dureeTexte(s.fin - s.debut))}</span><span>durée</span></div>
        <div class="tuile"><span class="grand">${faites}<small>/${s.series.length}</small></span><span>séries</span></div>
        <div class="tuile"><span class="grand">${s.douleur}<small>/10</small></span><span>douleur</span></div>
        ${s.velo ? `<div class="tuile"><span class="grand">${s.velo.minutes}<small> min</small></span><span>vélo</span></div>` : ''}
      </section>
      ${sug.length ? `<h2>Pour la prochaine fois</h2>
        <p class="aide">Ce sont des suggestions : rien ne change tout seul, c’est toi qui décides.</p>
        <ul class="suggestions">${sug.map((x) => `<li class="${x.texte === MESSAGE_BARRE ? 'avis' : 'suggestion'}"><strong>${esc(x.nom)}</strong><br>${esc(x.texte)}</li>`).join('')}</ul>` : ''}
      <div class="pied"><button class="principal" data-action="onglet" data-vue="accueil">Retour à l’accueil</button></div>
    </main>`;
  },
};
