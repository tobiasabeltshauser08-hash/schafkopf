// Computergegner.
// heuristicMove: schnelle Faustregeln (wird auch in den Simulationen benutzt).
// chooseCard: Monte-Carlo – die unbekannten Karten werden viele Male passend zu allem,
// was man bisher gesehen hat, neu verteilt, jede erlaubte Karte wird zu Ende gespielt
// und die Karte mit dem besten Durchschnittsergebnis gewinnt.

import { DECK, PLAIN, SAUSPIEL, WENZ, SOLO, Round, possibleContracts, shuffle } from './rules.js';

const minBy = (arr, f) => arr.reduce((a, b) => (f(b) < f(a) ? b : a));
const maxBy = (arr, f) => arr.reduce((a, b) => (f(b) > f(a) ? b : a));

// 1 = sicher Mitspieler, -1 = sicher Gegner, 0 = (noch) unbekannt
function relation(r, p, q, perfect) {
  if (p === q) return 1;
  const c = r.contract;
  if (perfect || c.kind !== SAUSPIEL || r.acePlayed || p === r.partner) {
    return r.team.has(p) === r.team.has(q) ? 1 : -1;
  }
  if (p === c.declarer) return 0;
  return q === c.declarer ? -1 : 0;
}

// Bleibt `x` sicher die höchste Karte im laufenden Stich, wenn p dran ist?
function isSafe(r, p, x, perfect) {
  const c = r.contract;
  const later = 3 - r.trick.length;
  if (later === 0) return true;
  if (perfect) {
    const lead = r.trick.length ? c.color(r.trick[0].c) : c.color(x);
    for (let i = 1; i <= later; i++) {
      const h = r.hands[(p + i) % 4];
      const same = h.filter(y => c.color(y) === lead);
      if ((same.length ? same : h).some(y => c.beats(y, x))) return false;
    }
    return true;
  }
  if (!c.isTrump(x)) return false;
  const rank = c.trumpRank(x);
  return c.trumpOrder().every(t => c.trumpRank(t) <= rank || r.played.has(t) || r.hands[p].includes(t));
}

export function heuristicMove(r, p, perfect = false) {
  const c = r.contract;
  const legal = r.legal(p);
  if (legal.length === 1) return legal[0];
  const T = x => c.isTrump(x);
  const cheap = x => (T(x) ? 200 + c.trumpRank(x) * 3 + x.points : x.points * 10 + PLAIN[x.rank]);
  const strength = x => (T(x) ? 100 + c.trumpRank(x) : -x.points);
  const inTeam = r.team.has(p);

  if (r.trick.length === 0) {
    const trumps = legal.filter(T).sort((a, b) => c.trumpRank(b) - c.trumpRank(a));
    const plain = legal.filter(x => !T(x));
    const aces = plain.filter(x => x.rank === 'A' && x !== c.calledAce);
    if (inTeam) {
      const top = c.trumpOrder().find(t => !r.played.has(t));
      if (trumps.length && trumps[0] === top) return top;
      if (trumps.length >= 3) return trumps[trumps.length - 1];
      if (aces.length) return aces[0];
      if (plain.length) return minBy(plain, cheap);
      return trumps[trumps.length - 1];
    }
    if (c.kind === SAUSPIEL && !r.acePlayed) {
      const search = plain.filter(x => x.suit === c.suit);
      if (search.length) return minBy(search, cheap);
    }
    if (aces.length) return aces[0];
    if (plain.length) return minBy(plain, cheap);
    return trumps[trumps.length - 1];
  }

  const best = r.currentBest();
  const rel = relation(r, p, best.p, perfect);
  const last = r.trick.length === 3;
  const pts = r.trick.reduce((s, t) => s + t.c.points, 0);

  if (rel === 1) {
    if (isSafe(r, p, best.c, perfect)) {
      // Schmieren: viele Augen zum Mitspieler, aber keine Ober/Unter verschenken
      return maxBy(legal, x => (T(x) ? (x.rank === 'O' || x.rank === 'U' ? -10 : x.points) : 20 + x.points));
    }
    return minBy(legal, cheap);
  }

  const winners = legal.filter(x => c.beats(x, best.c));
  if (winners.length && (rel === -1 || pts >= 10 || last)) {
    if (last) return minBy(winners, strength);
    const safe = winners.filter(x => isSafe(r, p, x, perfect));
    if (safe.length) return minBy(safe, strength);
    if (pts >= 10) return maxBy(winners, strength);
    return minBy(winners, strength);
  }
  return minBy(legal, cheap);
}

export function playout(r) {
  while (!r.finished) {
    const p = r.toMove;
    r.play(p, heuristicMove(r, p, true));
  }
}

// Passt eine geratene Verteilung zum Reizen? (Wer spielt, hat meist viele Trümpfe.)
function plausible(r, hands, me) {
  const c = r.contract, d = c.declarer;
  if (d === me) return true;
  const all = hands[d].concat(r.playedBy(d));
  const trumps = all.filter(x => c.isTrump(x)).length;
  if (c.kind === WENZ) return trumps >= 2;
  if (c.kind === SOLO) return trumps >= 5;
  return trumps >= 3;
}

// Verteilt die unbekannten Karten zufällig, aber passend zu allem Beobachteten.
export function sampleHands(r, me) {
  const c = r.contract, ace = c.calledAce;
  const unknown = DECK.filter(x => !r.played.has(x) && !r.hands[me].includes(x));
  const others = [0, 1, 2, 3].filter(q => q !== me);
  const canHold = (q, x) =>
    !r.voids[q].has(c.color(x)) && !(x === ace && (q === c.declarer || r.noAce.has(q)));
  const eligible = new Map(unknown.map(x => [x, others.filter(q => canHold(q, x))]));

  let fallback = null;
  for (let attempt = 0; attempt < 50; attempt++) {
    const hands = r.hands.map((h, q) => (q === me ? h.slice() : []));
    const cards = shuffle(unknown.slice()).sort((a, b) => eligible.get(a).length - eligible.get(b).length);
    let ok = true;
    for (const x of cards) {
      const opts = eligible.get(x).filter(q => hands[q].length < r.hands[q].length);
      if (!opts.length) { ok = false; break; }
      hands[opts[Math.floor(Math.random() * opts.length)]].push(x);
    }
    if (!ok) continue;
    if (plausible(r, hands, me)) return hands;
    fallback ??= hands;
  }
  if (fallback) return fallback;
  // Notlösung: ohne Einschränkungen verteilen
  const cards = shuffle(unknown.slice());
  return r.hands.map((h, q) => (q === me ? h.slice() : cards.splice(0, h.length)));
}

function utility(sim, p) {
  const s = sim.settle();
  const mine = sim.team.has(p) ? s.teamPoints : 120 - s.teamPoints;
  return s.deltas[p] + mine * 0.05;
}

export function chooseCard(r, p, { samples = 120, timeMs = 600 } = {}) {
  const legal = r.legal(p);
  if (legal.length === 1) return legal[0];
  const total = new Map(legal.map(x => [x, 0]));
  const start = Date.now();
  for (let i = 0; i < samples && (i < 20 || Date.now() - start < timeMs); i++) {
    const hands = sampleHands(r, p);
    for (const x of legal) {
      const sim = r.clone(hands);
      sim.play(p, x);
      playout(sim);
      total.set(x, total.get(x) + utility(sim, p));
    }
  }
  return maxBy(legal, x => total.get(x));
}

// Lohnt sich ein eigenes Spiel? Grobe Vorauswahl, dann Probespiele mit zufälligen Gegnerkarten.
function worthTrying(hand, k) {
  const trumps = hand.filter(x => k.isTrump(x)).length;
  if (k.kind === SAUSPIEL) return trumps >= 4;
  if (k.kind === WENZ) return trumps >= 2;
  return trumps >= 5;
}

export function chooseBid(hand, me, leader, { samples = 60 } = {}) {
  const rest = DECK.filter(x => !hand.includes(x));
  let best = null, bestEV = -Infinity;
  for (const k of possibleContracts(hand, me)) {
    if (!worthTrying(hand, k)) continue;
    let ev = 0, wins = 0;
    for (let i = 0; i < samples; i++) {
      const cards = shuffle(rest.slice());
      const hands = [0, 1, 2, 3].map(q => (q === me ? hand : cards.splice(0, 8)));
      const r = new Round(hands, leader, k);
      playout(r);
      const s = r.settle();
      ev += s.deltas[me];
      if (s.won) wins++;
    }
    ev /= samples;
    const need = k.kind === SAUSPIEL ? 0.62 : 0.72;
    if (wins / samples >= need && ev > bestEV) {
      best = k;
      bestEV = ev;
    }
  }
  return best;
}
