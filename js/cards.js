// Kartenbilder: selbst gezeichnetes bayerisches Blatt als SVG.
// Liegt im Ordner karten/ ein eigenes Bild (z. B. karten/herz-ober.jpg), wird stattdessen das benutzt.

import { DECK } from './rules.js';

const RANK_FILES = { A: 'sau', 10: 'zehn', K: 'koenig', O: 'ober', U: 'unter', 9: 'neun', 8: 'acht', 7: 'sieben' };
export const fileKey = c => `${c.suit}-${RANK_FILES[c.rank]}`;

const SYM = {
  herz: `<path d="M0 10C-5 5-12 1-12-4.5C-12-9.5-7.5-12-4-11C-2-10.5-.6-9 0-7.5C.6-9 2-10.5 4-11C7.5-12 12-9.5 12-4.5C12 1 5 5 0 10Z" fill="#d83a34"/>
    <path d="M0-7.5C.6-9 2-10.5 4-11C7.5-12 12-9.5 12-4.5C12 1 5 5 0 10Z" fill="#a51f1f"/>
    <path d="M0 10C-5 5-12 1-12-4.5C-12-9.5-7.5-12-4-11C-2-10.5-.6-9 0-7.5C.6-9 2-10.5 4-11C7.5-12 12-9.5 12-4.5C12 1 5 5 0 10Z" fill="none" stroke="#5e1010" stroke-width=".8"/>`,
  gras: `<path d="M0 6V12.5" stroke="#1b4d1e" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M0-12C3-7 11-4 11 2C11 7 5 9 0 6.5C-5 9-11 7-11 2C-11-4-3-7 0-12Z" fill="#4caf50"/>
    <path d="M0-12C3-7 11-4 11 2C11 7 5 9 0 6.5Z" fill="#2e7d32"/>
    <path d="M0-12C3-7 11-4 11 2C11 7 5 9 0 6.5C-5 9-11 7-11 2C-11-4-3-7 0-12Z" fill="none" stroke="#163f19" stroke-width=".8"/>
    <path d="M0-8V6M0-2L-5-6M0-2L5-6M0 3L-6 0M0 3L6 0" stroke="#163f19" stroke-width=".6" fill="none"/>`,
  eichel: `<path d="M0 8V12.5" stroke="#4a2c0c" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cy="-4" rx="6.3" ry="8.3" fill="#d39b3c" stroke="#6b4214" stroke-width=".8"/>
    <ellipse cx="-2.2" cy="-6" rx="1.6" ry="4" fill="#f1cf86"/>
    <path d="M-8.5 1Q-8.5 9 0 9Q8.5 9 8.5 1Z" fill="#5f7a2a" stroke="#2f3f13" stroke-width=".8"/>
    <path d="M-6 2L-2 8.5M-2 1.5L2.5 8.8M2 1.5L6 7.5M6 2L-1 8.8M2 1.5L-5 8M-2 1.5L-7.5 5" stroke="#2f3f13" stroke-width=".45"/>`,
  schellen: `<circle cy="1" r="10" fill="#f0bf2a" stroke="#6e5100" stroke-width=".8"/>
    <rect x="-11" y="-2.2" width="22" height="4.4" fill="#c62828" clip-path="url(#bell)"/>
    <path d="M-10 4.5Q-5 3 0 5Q5 3 10 4.5L10 12H-10Z" fill="#2e7d32" clip-path="url(#bell)"/>
    <circle cy="7.5" r="1.6" fill="#3a2a00"/><path d="M0 7.5V11" stroke="#3a2a00" stroke-width="1"/>
    <circle cy="-10" r="2" fill="none" stroke="#6e5100" stroke-width="1.1"/>
    <circle cy="1" r="10" fill="none" stroke="#6e5100" stroke-width=".8"/>`,
};

const pip = (suit, x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${SYM[suit]}</g>`;

function svg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 160">
<defs><clipPath id="bell"><circle cy="1" r="10"/></clipPath></defs>
<rect x=".6" y=".6" width="98.8" height="158.8" rx="7" fill="#fbf4e1" stroke="#8a7f66" stroke-width="1.2"/>
${body}</svg>`;
}

function corner(c) {
  const label = c.rank;
  const one = `<text x="8.5" y="17" font-family="Georgia,serif" font-weight="bold" font-size="${label === '10' ? 9.5 : 12}" text-anchor="middle" fill="#222">${label}</text>${pip(c.suit, 8.5, 26, 0.32)}`;
  return one + `<g transform="rotate(180 50 80)">${one}</g>`;
}

const FRAME = '<rect x="16" y="6" width="68" height="148" rx="3" fill="none" stroke="#3d3a33" stroke-width=".7"/>';

const PIPS = {
  7: [[36, 32], [64, 32], [50, 56], [36, 82], [64, 82], [36, 128], [64, 128]],
  8: [[36, 28], [64, 28], [36, 62], [64, 62], [36, 98], [64, 98], [36, 132], [64, 132]],
  9: [[36, 28], [64, 28], [36, 58], [64, 58], [50, 80], [36, 102], [64, 102], [36, 132], [64, 132]],
  10: [[36, 24], [64, 24], [36, 50], [64, 50], [50, 68], [50, 92], [36, 110], [64, 110], [36, 136], [64, 136]],
};

function numberCard(c) {
  const s = c.rank === '10' ? 0.78 : 0.88;
  return FRAME + PIPS[c.rank].map(([x, y]) => pip(c.suit, x, y, s)).join('');
}

function aceCard(c) {
  return FRAME +
    `<path d="M22 80C34 70 44 90 50 80C56 70 66 90 78 80" stroke="#b5892b" stroke-width="1.4" fill="none"/>
     <circle cx="50" cy="80" r="3" fill="#c62828" stroke="#6e1010" stroke-width=".6"/>` +
    pip(c.suit, 50, 47, 1.75) + pip(c.suit, 50, 115, 1.75);
}

const COAT = {
  eichel: ['#6f8f2e', '#4d661c'],
  gras: ['#2f8a3a', '#1f5e27'],
  herz: ['#c0392b', '#8e2219'],
  schellen: ['#d8a31a', '#9c7410'],
};

function figureCard(c) {
  const [coat, dark] = COAT[c.suit];
  const gold = '#e2b94b', skin = '#f3cfa8', line = '#3d2b1f';
  let hat = '', extra = '', face = '';
  if (c.rank === 'K') {
    hat = `<path d="M38 66V52L43.5 58L50 49L56.5 58L62 52V66Z" fill="${gold}" stroke="${line}" stroke-width=".7"/>
           <circle cx="50" cy="49" r="1.6" fill="#c62828"/><circle cx="38" cy="52" r="1.2" fill="#c62828"/><circle cx="62" cy="52" r="1.2" fill="#c62828"/>`;
    extra = `<path d="M70 134L74 82" stroke="${gold}" stroke-width="2.2" stroke-linecap="round"/><circle cx="74" cy="80" r="3.2" fill="${gold}" stroke="${line}" stroke-width=".6"/>
             <path d="M36 88Q50 98 64 88L64 94Q50 104 36 94Z" fill="#fff" stroke="#999" stroke-width=".5"/>`;
    face = `<path d="M45 79Q50 84 55 79Q55 88 50 89Q45 88 45 79Z" fill="#6b4423"/>`;
  } else if (c.rank === 'O') {
    hat = `<path d="M40 63Q50 52 60 63Z" fill="#222"/><ellipse cx="50" cy="63.5" rx="16" ry="3.6" fill="#1b1b1b"/>
           <path d="M58 60C66 50 72 46 76 48C70 50 66 56 62 62Z" fill="#d32f2f" stroke="#7f1010" stroke-width=".5"/>`;
    extra = `<path d="M26 140L70 92" stroke="#b9c3cc" stroke-width="2.4" stroke-linecap="round"/><path d="M64 96L70 102" stroke="${gold}" stroke-width="2.2"/>`;
    face = `<path d="M45.5 78Q48 76.5 50 78Q52 76.5 54.5 78Q52 79.5 50 78.5Q48 79.5 45.5 78Z" fill="#6b4423"/>`;
  } else {
    hat = `<ellipse cx="50" cy="63" rx="11.5" ry="4.5" fill="${dark}" stroke="${line}" stroke-width=".6"/><circle cx="50" cy="58.5" r="2" fill="${gold}"/>`;
    extra = `<path d="M28 98Q20 120 34 140" stroke="#b9c3cc" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M26 98H32" stroke="${gold}" stroke-width="2.2"/>`;
  }
  const pipPos = c.rank === 'U' ? [68, 128] : [31, 30];
  return FRAME +
    `<path d="M33 154L36 116H64L67 154Z" fill="${dark}" stroke="${line}" stroke-width=".7"/>
     <path d="M34 120Q32 92 41 86H59Q68 92 66 120Z" fill="${coat}" stroke="${line}" stroke-width=".7"/>
     <path d="M41 86Q30 96 31 116L36 117Q36 100 43 92Z" fill="${dark}" stroke="${line}" stroke-width=".6"/>
     <path d="M59 86Q70 96 69 116L64 117Q64 100 57 92Z" fill="${dark}" stroke="${line}" stroke-width=".6"/>
     <circle cx="33.5" cy="117" r="3" fill="${skin}" stroke="${line}" stroke-width=".5"/>
     <circle cx="66.5" cy="117" r="3" fill="${skin}" stroke="${line}" stroke-width=".5"/>
     <rect x="35" y="109" width="30" height="3.5" fill="${gold}" stroke="${line}" stroke-width=".4"/>
     <path d="M50 88V108" stroke="${gold}" stroke-width="1.2" stroke-dasharray="1.5 3"/>
     <ellipse cx="50" cy="86" rx="11" ry="3.4" fill="#f7f7f2" stroke="#999" stroke-width=".5"/>
     <path d="M39 72Q38 60 50 60Q62 60 61 72L60 80Q58 70 50 69Q42 70 40 80Z" fill="#7a4a24"/>
     <circle cx="50" cy="73" r="10" fill="${skin}" stroke="${line}" stroke-width=".6"/>
     <circle cx="46" cy="71.5" r=".9" fill="#222"/><circle cx="54" cy="71.5" r=".9" fill="#222"/>
     <path d="M50 72.5L49 76H51" stroke="#a87455" stroke-width=".6" fill="none"/>
     <path d="M47 80Q50 81.5 53 80" stroke="#8a3b2b" stroke-width=".7" fill="none"/>
     ${face}${hat}${extra}` +
    pip(c.suit, pipPos[0], pipPos[1], 0.95);
}

function backSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 160">
<defs><pattern id="r" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
<rect width="10" height="10" fill="#fff"/><rect width="5" height="5" fill="#2a6ab8"/><rect x="5" y="5" width="5" height="5" fill="#2a6ab8"/></pattern></defs>
<rect x=".6" y=".6" width="98.8" height="158.8" rx="7" fill="#fbf4e1" stroke="#8a7f66" stroke-width="1.2"/>
<rect x="6" y="6" width="88" height="148" rx="3" fill="url(#r)" stroke="#15406f" stroke-width="1.6"/>
<ellipse cx="50" cy="80" rx="17" ry="22" fill="#fbf4e1" stroke="#15406f" stroke-width="1.6"/>
<text x="50" y="89" font-family="Georgia,serif" font-size="26" font-weight="bold" text-anchor="middle" fill="#15406f">S</text>
</svg>`;
}

function faceSvg(c) {
  let body;
  if (c.rank === 'A') body = aceCard(c);
  else if ('KOU'.includes(c.rank)) body = figureCard(c);
  else body = numberCard(c);
  return svg(body + corner(c));
}

const toUrl = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.replace(/\s+/g, ' '));

const drawn = new Map(DECK.map(c => [c, toUrl(faceSvg(c))]));
const drawnBack = toUrl(backSvg());
const custom = new Map();

export const cardImage = c => custom.get(fileKey(c)) ?? drawn.get(c);
export const backImage = () => custom.get('rueckseite') ?? drawnBack;

function probe(key) {
  return new Promise(resolve => {
    const exts = ['jpg', 'png'];
    const next = () => {
      if (!exts.length) return resolve();
      const url = `karten/${key}.${exts.shift()}`;
      const img = new Image();
      img.onload = () => { custom.set(key, url); resolve(); };
      img.onerror = next;
      img.src = url;
    };
    next();
  });
}

export function loadCustomImages() {
  return Promise.all(DECK.map(fileKey).concat('rueckseite').map(probe));
}
