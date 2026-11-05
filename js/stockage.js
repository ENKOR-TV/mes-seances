// Toutes les données vivent dans le téléphone, sous une seule clé.
import { programmeParDefaut } from './programme-defaut.js';
import { isoJour } from './outils.js';

const CLE = 'mes-seances';
const VERSION = 1;

export function reglagesParDefaut() {
  return {
    reposSec: 60,
    son: true,
    theme: 'sombre',
    joursVelo: [1, 5], // lundi et vendredi (0 = dimanche)
    echauffementMin: 5,
    velo: { debut: '2026-11-09', departMin: 15, pasMin: 5, maxMin: 30 },
  };
}

function etatInitial() {
  return { version: VERSION, reglages: reglagesParDefaut(), programme: programmeParDefaut(), seances: [], seanceEnCours: null };
}

// Complète les clés manquantes (anciennes sauvegardes, futures versions).
function completer(d) {
  const base = etatInitial();
  const r = { ...base.reglages, ...(d.reglages || {}) };
  r.velo = { ...base.reglages.velo, ...((d.reglages && d.reglages.velo) || {}) };
  const programme = d.programme && d.programme.blocs && d.programme.exercices ? d.programme : base.programme;
  return {
    version: VERSION,
    reglages: r,
    programme,
    seances: Array.isArray(d.seances) ? d.seances : [],
    seanceEnCours: d.seanceEnCours || null,
  };
}

function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) return completer(JSON.parse(brut));
  } catch (e) {
    console.error('Lecture impossible', e);
  }
  return etatInitial();
}

export let donnees = charger();

export function sauver() {
  try {
    localStorage.setItem(CLE, JSON.stringify(donnees));
  } catch (e) {
    console.error('Écriture impossible', e);
    alert('Impossible d’enregistrer sur ce téléphone (mémoire pleine ?). Fais une sauvegarde depuis Réglages.');
  }
}

export function reinitialiserProgramme() {
  donnees.programme = programmeParDefaut();
  sauver();
}

// Demande au navigateur de ne pas effacer les données.
export async function demanderPersistance() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch (e) { /* rien */ }
  return false;
}

export async function exporter() {
  const texte = JSON.stringify(donnees, null, 2);
  const nom = `seances-raphael-sauvegarde-${isoJour()}.json`;
  const fichier = new File([texte], nom, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: nom });
      return true;
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
    }
  }
  const url = URL.createObjectURL(fichier);
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return true;
}

export function importer(texte) {
  const d = JSON.parse(texte);
  if (!d || typeof d !== 'object' || !Array.isArray(d.seances) || !d.programme) {
    throw new Error('Ce fichier n’est pas une sauvegarde des séances de Raphaël.');
  }
  donnees = completer(d);
  sauver();
  return donnees.seances.length;
}
