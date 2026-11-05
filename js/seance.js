// Construction et déroulé d'une séance.
import { donnees, sauver } from './stockage.js';
import { uid, debutSemaine, lireIsoJour, nombre } from './outils.js';

export const MODES = {
  complete: 'Séance complète',
  express: 'Séance express',
  'sans-materiel': 'Sans matériel',
};

export const cle = (exo, variante, sansCharge) => `${exo}|${variante || ''}|${sansCharge ? 1 : 0}`;

export function seancesTriees() {
  return [...donnees.seances].sort((a, b) => a.debut - b.debut);
}

// Vélo : 15 min la première semaine, +5 min par semaine, jusqu'à 30 min.
export function objectifVelo(date = new Date()) {
  const v = donnees.reglages.velo;
  const semaines = Math.floor((debutSemaine(date) - debutSemaine(lireIsoJour(v.debut))) / (7 * 864e5));
  return Math.min(v.maxMin, v.departMin + v.pasMin * Math.max(0, semaines));
}

export const veloParDefaut = (date = new Date()) => donnees.reglages.joursVelo.includes(date.getDay());

export function nomExercice(id, sansCharge) {
  const exo = donnees.programme.exercices[id];
  if (!exo) return id;
  return sansCharge && exo.sansMateriel && exo.sansMateriel.nom ? exo.sansMateriel.nom : exo.nom;
}

function mesureEffective(exo, sansCharge) {
  return sansCharge && exo.mesure === 'charge' ? 'reps' : exo.mesure;
}

function derniereVariante(exoId) {
  const s = seancesTriees();
  for (let i = s.length - 1; i >= 0; i--) {
    const serie = s[i].series.find((x) => x.exo === exoId && x.etat === 'faite');
    if (serie) return serie.variante;
  }
  return null;
}

// Séries faites la dernière fois pour cet exercice (même variante, même mode).
export function seriesPrecedentes(exoId, variante, sansCharge) {
  const s = seancesTriees();
  const k = cle(exoId, variante, sansCharge);
  for (let i = s.length - 1; i >= 0; i--) {
    const series = s[i].series.filter((x) => cle(x.exo, x.variante, x.sansCharge) === k && x.etat === 'faite');
    if (series.length) return { seance: s[i], series };
  }
  return null;
}

function prereplir(e) {
  const exo = donnees.programme.exercices[e.exo] || {};
  const prec = seriesPrecedentes(e.exo, e.variante, e.sansCharge);
  const meme = prec && (prec.series.find((x) => x.n === e.n && x.cote === e.cote) || prec.series[prec.series.length - 1]);
  e.premiereFois = !prec;
  e.charge = e.mesure === 'charge' ? (meme ? meme.charge : exo.chargeDepart ?? 0) : null;
  e.reps = e.mesure === 'duree' ? null : meme ? meme.reps : 10;
  e.duree = e.mesure === 'duree' ? (meme ? meme.objectif ?? meme.duree : exo.dureeDepart ?? 30) : null;
}

export function creerSeance(mode, avecVelo) {
  const p = donnees.programme;
  const sansCharge = mode === 'sans-materiel';
  const etapes = [];
  if (!sansCharge) etapes.push({ id: uid(), type: 'echauffement', minutes: donnees.reglages.echauffementMin, etat: 'a-faire' });

  // Blocs retenus, avec leurs exercices. Des blocs voisins réduits à un seul exercice
  // (cas de la séance sans matériel) sont regroupés pour garder l'alternance.
  const retenus = [];
  for (const b of p.blocs) {
    if (mode === 'express' && !b.express) continue;
    const ids = b.exercices.filter((id) => p.exercices[id] && (!sansCharge || p.exercices[id].sansMateriel));
    if (!ids.length) continue;
    const prec = retenus[retenus.length - 1];
    if (sansCharge && ids.length === 1 && prec && prec.seul) {
      prec.ids.push(ids[0]);
      prec.tours = Math.max(prec.tours, b.tours);
      prec.noms.push(b.nom);
    } else {
      retenus.push({ id: b.id, noms: [b.nom], tours: b.tours, ids, seul: ids.length === 1 });
    }
  }

  const variantes = {};
  for (const r of retenus) {
    const bloc = { id: r.id, nom: r.noms.length > 1 ? `${r.noms[0]} à ${r.noms[r.noms.length - 1].replace(/^Bloc\s*/i, '')}` : r.noms[0], tours: r.tours };
    const ids = r.ids;
    for (let t = 1; t <= bloc.tours; t++) {
      for (const id of ids) {
        const exo = p.exercices[id];
        if (!(id in variantes)) variantes[id] = exo.variantes.length ? derniereVariante(id) ?? exo.variantes[0] : null;
        if (variantes[id] && !exo.variantes.includes(variantes[id])) variantes[id] = exo.variantes[0] ?? null;
        for (const cote of exo.cotes ? ['gauche', 'droit'] : [null]) {
          const e = {
            id: uid(), type: 'serie', bloc: bloc.id, blocNom: bloc.nom, exo: id, n: t, total: bloc.tours, cote,
            variante: variantes[id], sansCharge, mesure: mesureEffective(exo, sansCharge), etat: 'a-faire',
            nom: sansCharge && exo.sansMateriel && exo.sansMateriel.nom ? exo.sansMateriel.nom : exo.nom,
          };
          prereplir(e);
          etapes.push(e);
        }
      }
    }
  }
  if (avecVelo && !sansCharge) etapes.push({ id: uid(), type: 'velo', minutes: objectifVelo(), etat: 'a-faire' });

  return { id: uid(), debut: Date.now(), mode, etapes, courante: 0, repos: null };
}

export function changerVariante(s, exoId, variante) {
  for (const e of s.etapes) {
    if (e.type === 'serie' && e.exo === exoId && e.etat !== 'faite') {
      e.variante = variante;
      prereplir(e);
    }
  }
}

// Une charge ou une durée modifiée s'applique aussi aux séries suivantes du même exercice.
export function propager(s, etape, champ) {
  const i = s.etapes.indexOf(etape);
  for (const e of s.etapes.slice(i + 1)) {
    if (e.type === 'serie' && e.exo === etape.exo && e.etat === 'a-faire') e[champ] = etape[champ];
  }
}

export function indexSuivante(s, depuis = s.courante) {
  const n = s.etapes.length;
  for (let i = depuis + 1; i < n; i++) if (s.etapes[i].etat === 'a-faire') return i;
  for (let i = 0; i <= Math.min(depuis, n - 1); i++) if (s.etapes[i].etat === 'a-faire' && i !== depuis) return i;
  return -1;
}

export function progression(s) {
  const total = s.etapes.length;
  const faites = s.etapes.filter((e) => e.etat !== 'a-faire').length;
  return { total, faites, pct: total ? Math.round((faites / total) * 100) : 0 };
}

// Machine occupée : les séries restantes de cet exercice passent après les autres exercices du bloc.
// S'il ne reste que lui dans le bloc, elles passent en fin de séance (avant le vélo).
export function plusTard(s) {
  const courante = s.etapes[s.courante];
  if (!courante || courante.type !== 'serie') return;
  const pos = s.courante;
  const aDeplacer = s.etapes.filter((e) => e.type === 'serie' && e.bloc === courante.bloc && e.exo === courante.exo && e.etat === 'a-faire');
  const autresDuBloc = s.etapes.some((e) => e.type === 'serie' && e.bloc === courante.bloc && e.exo !== courante.exo && e.etat === 'a-faire');
  const reste = s.etapes.filter((e) => !aDeplacer.includes(e));
  let insertion;
  if (autresDuBloc) {
    insertion = reste.map((e) => e.bloc).lastIndexOf(courante.bloc) + 1;
  } else {
    const iVelo = reste.findIndex((e) => e.type === 'velo' && e.etat === 'a-faire');
    insertion = iVelo === -1 ? reste.length : iVelo;
  }
  reste.splice(insertion, 0, ...aDeplacer);
  s.etapes = reste;
  // Nouvelle étape courante : la première à faire à partir de l'ancienne position.
  let i = s.etapes.findIndex((e, j) => j >= pos && e.etat === 'a-faire');
  if (i === -1) i = s.etapes.findIndex((e) => e.etat === 'a-faire');
  s.courante = Math.max(0, i);
}

export function finaliser(s, { douleur, jambe, note }) {
  const series = s.etapes
    .filter((e) => e.type === 'serie')
    .map((e) => ({
      exo: e.exo, nom: e.nom || nomExercice(e.exo, e.sansCharge), variante: e.variante, n: e.n, total: e.total, cote: e.cote,
      mesure: e.mesure, charge: e.charge, reps: e.reps, duree: e.duree, objectif: e.objectif ?? e.duree,
      sansCharge: e.sansCharge, etat: e.etat === 'faite' ? 'faite' : 'passee',
    }));
  const velo = s.etapes.find((e) => e.type === 'velo');
  const echauffement = s.etapes.find((e) => e.type === 'echauffement');
  return {
    id: s.id, debut: s.debut, fin: Date.now(), mode: s.mode, series,
    echauffement: echauffement ? echauffement.etat === 'faite' : false,
    velo: velo ? { objectif: velo.minutes, minutes: velo.etat === 'faite' ? velo.minutesFaites ?? velo.minutes : 0, etat: velo.etat === 'faite' ? 'faite' : 'passee' } : null,
    douleur, jambe: !!jambe, note: (note || '').trim(),
  };
}

export function enregistrer(record) {
  donnees.seances.push(record);
  donnees.seanceEnCours = null;
  sauver();
}

// « 12 kg × 10 », « 10 répétitions », « 30 s »
export function valeurSerie(x) {
  if (x.mesure === 'charge') return `${nombre(x.charge)} kg × ${x.reps}`;
  if (x.mesure === 'duree') return `${x.duree} s`;
  return `${x.reps} répétition${x.reps > 1 ? 's' : ''}`;
}

export function resumeEtape(e) {
  if (!e) return '';
  if (e.type === 'echauffement') return `Échauffement, vélo ${e.minutes} min`;
  if (e.type === 'velo') return `Vélo ${e.minutes} min`;
  const mot = e.mesure === 'duree' ? 'tour' : 'série';
  let t = `${e.nom || nomExercice(e.exo, e.sansCharge)}${e.cote ? `, côté ${e.cote}` : ''}, ${mot} ${e.n}/${e.total}`;
  if (e.mesure === 'charge') t += `, ${nombre(e.charge)} kg`;
  if (e.mesure === 'duree') t += `, ${e.duree} s`;
  return t;
}
