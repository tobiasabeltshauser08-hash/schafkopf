// Selbsttest: Computer spielen gegeneinander, Regeln werden nebenbei geprüft.
// Aufruf: node tests/test.js [Anzahl Runden]
import assert from 'node:assert/strict';
import { DECK, Round, Contract, deal, card, GAME_RANK, SAUSPIEL, SOLO, WENZ } from '../js/rules.js';
import { chooseBid, chooseCard } from '../js/ai.js';

// Einige feste Regelfälle
{
  const ace = card('gras', 'A');
  const k = new Contract(SAUSPIEL, 0, 'gras');
  // Spieler 1 hat Gras-Sau + Gras-7 und muss bei Gras-Ausspiel die Sau legen
  const hands = [
    [card('gras', '9'), card('herz', 'O'), card('eichel', '7'), card('eichel', '8'), card('eichel', '9'), card('schellen', '7'), card('schellen', '8'), card('schellen', '9')],
    [ace, card('gras', '7'), card('eichel', 'A'), card('eichel', 'K'), card('eichel', '10'), card('schellen', 'A'), card('schellen', 'K'), card('schellen', '10')],
    [card('gras', '8'), card('gras', 'K'), card('gras', '10'), card('herz', 'U'), card('herz', 'A'), card('herz', '10'), card('herz', 'K'), card('herz', '9')],
    [card('eichel', 'O'), card('gras', 'O'), card('schellen', 'O'), card('eichel', 'U'), card('gras', 'U'), card('schellen', 'U'), card('herz', '8'), card('herz', '7')],
  ];
  const r = new Round(hands, 1, k);
  assert.equal(r.partner, 1);
  // Ausspiel: Gras-7 verboten (nur 2 Gras-Karten), Sau erlaubt
  assert.ok(!r.legal(1).includes(card('gras', '7')));
  assert.ok(r.legal(1).includes(ace));
  r.play(1, card('eichel', 'A'));
  // Spieler 2 hat kein Eichel -> darf alles
  assert.equal(r.legal(2).length, 8);
  r.play(2, card('herz', '9'));
  r.play(3, card('herz', '8'));
  r.play(0, card('eichel', '7'));
  assert.equal(r.points[2], 11); // Herz-9 sticht Herz-8
  assert.equal(r.toMove, 2);
  r.play(2, card('herz', 'U'));
  r.play(3, card('herz', '7'));
  r.play(0, card('herz', 'O'));
  // Spieler 1: kein Trumpf, darf aber die Rufsau nicht abwerfen
  assert.ok(!r.legal(1).includes(ace));
  r.play(1, card('schellen', 'A'));
  assert.equal(r.toMove, 0);
  r.play(0, card('gras', '9'));
  assert.deepEqual(r.legal(1), [ace]); // gesucht -> Sau muss kommen
  // Laufende: Spieler 0 + Partner 1 haben weder Eichel- noch Gras-Ober -> "ohne 2" zählt nicht (ab 3)
  assert.equal(r.laufende(), 2);
  assert.equal(r.initial[0].length, 8); // Startkarten bleiben erhalten
}
{
  // Solo mit den 4 Obern und 2 Untern: 6 Laufende
  const hand = [card('eichel', 'O'), card('gras', 'O'), card('herz', 'O'), card('schellen', 'O'),
    card('eichel', 'U'), card('gras', 'U'), card('herz', 'A'), card('herz', '7')];
  const rest = DECK.filter(x => !hand.includes(x));
  const r = new Round([hand, rest.slice(0, 8), rest.slice(8, 16), rest.slice(16)], 0, new Contract(SOLO, 0, 'herz'));
  while (!r.finished) r.play(r.toMove, r.legal(r.toMove)[0]);
  assert.equal(r.laufende(), 6);
  assert.ok(r.settle().parts.some(([l, v]) => l === '6 Laufende' && v === 60));
}
{
  // Wenz: Ober sind keine Trümpfe, Unter schon
  const k = new Contract(WENZ, 0);
  assert.ok(k.isTrump(card('schellen', 'U')));
  assert.ok(!k.isTrump(card('eichel', 'O')));
  assert.ok(k.beats(card('gras', 'A'), card('gras', 'O')));
  // Solo: Ober > Unter > Farbe
  const s = new Contract(SOLO, 0, 'eichel');
  assert.ok(s.beats(card('schellen', 'O'), card('eichel', 'U')));
  assert.ok(s.beats(card('eichel', '7'), card('gras', 'A')));
  assert.equal(s.trumpOrder().length, 14);
}

const n = Number(process.argv[2] ?? 40);
let played = 0, declWins = 0, thrown = 0, maxMs = 0;
const kinds = {};
const balance = [0, 0, 0, 0];
for (let g = 0; g < n; g++) {
  const hands = deal();
  const leader = g % 4;
  let contract = null;
  for (let i = 0; i < 4; i++) {
    const p = (leader + i) % 4;
    const b = chooseBid(hands[p], p, leader);
    if (b && (!contract || GAME_RANK[b.kind] > GAME_RANK[contract.kind])) contract = b;
  }
  if (!contract) { thrown++; continue; }
  const r = new Round(hands, leader, contract);
  while (!r.finished) {
    const p = r.toMove;
    const t = Date.now();
    const x = chooseCard(r, p);
    maxMs = Math.max(maxMs, Date.now() - t);
    r.play(p, x);
  }
  assert.equal(r.points.reduce((a, b) => a + b), 120);
  assert.equal(r.trickCount.reduce((a, b) => a + b), 8);
  const s = r.settle();
  assert.equal(s.deltas.reduce((a, b) => a + b), 0);
  s.deltas.forEach((d, i) => (balance[i] += d));
  played++;
  if (s.won) declWins++;
  kinds[contract.kind] = (kinds[contract.kind] ?? 0) + 1;
}
console.log(`Regeltests ok. ${played} Spiele, ${thrown} zamgschmissn, Spieler gewinnt ${declWins}/${played}`);
console.log('Spielarten:', kinds, '| langsamster KI-Zug:', maxMs, 'ms | Konten:', balance);
