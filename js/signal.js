// Son, vibration, flash d'écran et écran maintenu allumé.
import { donnees } from './stockage.js';

let ctx = null;

// À appeler pendant un toucher : iPhone n'autorise le son qu'après un geste.
export function preparerSon() {
  try {
    if (!ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      ctx = new C();
      // Son silencieux pour « déverrouiller » l'audio.
      const b = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = b;
      src.connect(ctx.destination);
      src.start(0);
    }
    if (ctx.state !== 'running') ctx.resume();
  } catch (e) { /* pas de son */ }
}

export function bip(nombre = 3) {
  if (!donnees.reglages.son || !ctx) return;
  try {
    const t0 = ctx.currentTime + 0.02;
    for (let i = 0; i < nombre; i++) {
      const t = t0 + i * 0.28;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === nombre - 1 ? 1320 : 880;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(g).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    }
  } catch (e) { /* rien */ }
}

export function signalFin() {
  bip(3);
  if (navigator.vibrate) navigator.vibrate([300, 150, 300]); // Android seulement
  document.body.classList.remove('flash');
  void document.body.offsetWidth;
  document.body.classList.add('flash');
  setTimeout(() => document.body.classList.remove('flash'), 2000);
}

let verrou = null;
let voulu = false;

export async function garderEcranAllume() {
  voulu = true;
  if (!('wakeLock' in navigator) || verrou) return;
  try {
    verrou = await navigator.wakeLock.request('screen');
    verrou.addEventListener('release', () => { verrou = null; });
  } catch (e) { verrou = null; }
}

export function libererEcran() {
  voulu = false;
  if (verrou) verrou.release().catch(() => {});
  verrou = null;
}

export const ecranGerable = () => 'wakeLock' in navigator;

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && voulu) garderEcranAllume();
});
