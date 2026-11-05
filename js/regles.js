// Règles de sécurité, suggestions de progression, statistiques et bilan.
import { donnees } from './stockage.js';
import { seancesTriees, cle } from './seance.js';
import { debutSemaine, finSemaine, periodeSemaine, nombre } from './outils.js';

export const MESSAGE_ARRET = 'Arrête l’exercice concerné et contacte ton kiné.';
export const MESSAGE_BARRE = 'Passage à la barre : valider d’abord le type de barre et la position avec ton kiné.';

export function seancePrecedente(s) {
  const liste = seancesTriees().filter((x) => x.debut < s.debut && x.douleur != null);
  return liste[liste.length - 1] || null;
}

export function douleurEnHausse(s) {
  const p = seancePrecedente(s);
  return !!p && s.douleur != null && s.douleur > p.douleur;
}

// Raisons d'alerte pour une séance enregistrée (liste vide si tout va bien).
export function raisonsAlerte(s) {
  const r = [];
  if (douleurEnHausse(s)) {
    const p = seancePrecedente(s);
    r.push(`Ta douleur au dos est plus forte qu’à la séance précédente (${p.douleur} puis ${s.douleur} sur 10).`);
  }
  if (s.jambe) r.push('Tu as signalé une douleur qui descend dans la jambe ou des fourmillements.');
  return r;
}

const atteintSeuilBarre = (exo, charge) => exo && exo.seuilBarreKg && charge != null && charge >= exo.seuilBarreKg;
export const besoinMessageBarre = (exoId, charge, sansCharge) => !sansCharge && atteintSeuilBarre(donnees.programme.exercices[exoId], charge);

// Suggestions après une séance : jamais appliquées automatiquement.
export function suggestionsApres(s) {
  if (raisonsAlerte(s).length) return [];
  const groupes = new Map();
  for (const x of s.series) {
    const k = cle(x.exo, x.variante, x.sansCharge);
    if (!groupes.has(k)) groupes.set(k, []);
    groupes.get(k).push(x);
  }
  const res = [];
  for (const [k, series] of groupes) {
    if (!series.every((x) => x.etat === 'faite')) continue;
    const x0 = series[0];
    const exo = donnees.programme.exercices[x0.exo];
    const nom = x0.nom + (x0.variante ? `, ${x0.variante.toLowerCase()}` : '');
    const suivante = exo && exo.variantes && x0.variante ? exo.variantes[exo.variantes.indexOf(x0.variante) + 1] : null;
    let texte = null;
    if (x0.mesure === 'charge' && series.every((x) => x.reps >= 12)) {
      const max = Math.max(...series.map((x) => x.charge || 0));
      texte = atteintSeuilBarre(exo, max)
        ? MESSAGE_BARRE
        : 'Toutes tes séries sont à 12 répétitions. Si c’était facile (au moins 2 répétitions en réserve) et sans douleur, tu peux augmenter un peu la charge.';
    } else if (x0.mesure === 'reps' && series.every((x) => x.reps >= 12) && suivante) {
      texte = `Toutes tes séries sont à 12 répétitions. Si c’était facile et sans douleur, tu peux essayer « ${suivante} ».`;
    } else if (x0.mesure === 'duree' && series.every((x) => x.duree >= (x.objectif || 0))) {
      const d = Math.min(...series.map((x) => x.duree));
      if (d >= 60 && suivante) texte = `Tu tiens 1 minute. Si c’était facile et sans douleur, tu peux essayer « ${suivante} ».`;
      else if (d < 60) texte = 'Tu as tenu toute la durée. Si c’était facile et sans douleur, tu peux ajouter 5 secondes (objectif : 1 minute).';
    }
    if (texte) res.push({ cle: k, nom, texte });
  }
  return res;
}

// Suggestion de la dernière fois, rappelée au moment de faire l'exercice.
export function suggestionPour(exoId, variante, sansCharge) {
  const k = cle(exoId, variante, sansCharge);
  const s = seancesTriees();
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i].series.some((x) => cle(x.exo, x.variante, x.sansCharge) === k && x.etat === 'faite')) {
      const sug = suggestionsApres(s[i]).find((x) => x.cle === k);
      return sug ? sug.texte : null;
    }
  }
  return null;
}

export function seancesDeLaSemaine(ref = new Date()) {
  const a = debutSemaine(ref).getTime();
  const b = finSemaine(ref).getTime();
  return seancesTriees().filter((s) => s.debut >= a && s.debut < b);
}

export function statsSemaine(ref = new Date()) {
  const ss = seancesDeLaSemaine(ref);
  const velos = ss.filter((s) => s.velo && s.velo.etat === 'faite');
  return {
    seances: ss.length,
    express: ss.filter((s) => s.mode === 'express').length,
    sansMateriel: ss.filter((s) => s.mode === 'sans-materiel').length,
    velos: velos.length,
    minutesVelo: velos.reduce((t, s) => t + (s.velo.minutes || 0), 0),
    liste: ss,
  };
}

// Meilleure valeur d'une séance pour une clé d'exercice.
function meilleure(series) {
  const faites = series.filter((x) => x.etat === 'faite');
  if (!faites.length) return null;
  const m = faites[0].mesure;
  if (m === 'charge') return { valeur: Math.max(...faites.map((x) => x.charge || 0)), unite: 'kg' };
  if (m === 'duree') return { valeur: Math.max(...faites.map((x) => x.duree || 0)), unite: 's' };
  return { valeur: Math.max(...faites.map((x) => x.reps || 0)), unite: 'répétitions' };
}

// Courbes : une série de points par exercice (et variante).
export function courbesExercices() {
  const res = new Map();
  for (const s of seancesTriees()) {
    const parCle = new Map();
    for (const x of s.series) {
      const k = cle(x.exo, x.variante, x.sansCharge);
      if (!parCle.has(k)) parCle.set(k, []);
      parCle.get(k).push(x);
    }
    for (const [k, series] of parCle) {
      const m = meilleure(series);
      if (!m) continue;
      const x0 = series[0];
      if (!res.has(k)) {
        const nom = x0.nom + (x0.variante ? `, ${x0.variante.toLowerCase()}` : '');
        res.set(k, { cle: k, nom, unite: m.unite, points: [] });
      }
      res.get(k).points.push({ t: s.debut, y: m.valeur });
    }
  }
  return [...res.values()];
}

export function bilanTexte(ref = new Date()) {
  const st = statsSemaine(ref);
  const lignes = [`Bilan de la semaine ${periodeSemaine(ref)}`, ''];
  const dont = [];
  if (st.express) dont.push(`${st.express} express`);
  if (st.sansMateriel) dont.push(`${st.sansMateriel} sans matériel`);
  lignes.push(`Séances : ${st.seances} sur 3${dont.length ? ` (dont ${dont.join(', ')})` : ''}`);
  lignes.push(`Vélo : ${st.velos} séance${st.velos > 1 ? 's' : ''} sur 2${st.velos ? `, ${st.minutesVelo} minutes au total` : ''}`);
  const douleurs = st.liste.map((s) => s.douleur).filter((d) => d != null);
  if (douleurs.length) {
    const moy = douleurs.reduce((a, b) => a + b, 0) / douleurs.length;
    lignes.push(`Douleur au dos : moyenne ${nombre(Math.round(moy * 10) / 10)} sur 10, maximum ${Math.max(...douleurs)} sur 10`);
  } else {
    lignes.push('Douleur au dos : non renseignée');
  }
  lignes.push(`Douleur dans la jambe ou fourmillements : ${st.liste.some((s) => s.jambe) ? 'oui' : 'non'}`);

  // Charges principales : dernière valeur de la semaine pour chaque exercice.
  const derniere = new Map();
  for (const s of st.liste) {
    const parCle = new Map();
    for (const x of s.series) {
      const k = cle(x.exo, x.variante, x.sansCharge);
      if (!parCle.has(k)) parCle.set(k, []);
      parCle.get(k).push(x);
    }
    for (const [k, series] of parCle) {
      const m = meilleure(series);
      if (m) derniere.set(k, { x: series[0], m, reps: series.filter((x) => x.etat === 'faite').map((x) => x.reps) });
    }
  }
  if (derniere.size) {
    lignes.push('', 'Charges principales :');
    for (const { x, m, reps } of derniere.values()) {
      const nom = x.nom + (x.variante ? `, ${x.variante.toLowerCase()}` : '');
      let val;
      if (m.unite === 'kg') val = `${nombre(m.valeur)} kg${x.exo === 'fentes' ? ' au total' : ''}, ${reps.join(' et ')} répétitions`;
      else if (m.unite === 's') val = `${m.valeur} secondes`;
      else val = `${reps.join(' et ')} répétitions`;
      lignes.push(`• ${nom} : ${val}`);
    }
  }
  return lignes.join('\n');
}
