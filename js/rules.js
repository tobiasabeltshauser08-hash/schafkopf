// Spielregeln: Karten, Spielarten, erlaubte Karten, Stiche und Abrechnung.

export const SUITS = ['eichel', 'gras', 'herz', 'schellen']; // höchste zuerst
export const SUIT_NAMES = { eichel: 'Eichel', gras: 'Gras', herz: 'Herz', schellen: 'Schellen' };
export const RANKS = ['A', '10', 'K', 'O', 'U', '9', '8', '7'];
export const RANK_NAMES = { A: 'Sau', 10: 'Zehn', K: 'König', O: 'Ober', U: 'Unter', 9: 'Neun', 8: 'Acht', 7: 'Sieben' };
const POINTS = { A: 11, 10: 10, K: 4, O: 3, U: 2, 9: 0, 8: 0, 7: 0 };
// Rangfolge innerhalb einer Farbe, wenn die Karte kein Trumpf ist
export const PLAIN = { A: 7, 10: 6, K: 5, O: 4, U: 3, 9: 2, 8: 1, 7: 0 };

export const SAUSPIEL = 'sauspiel', WENZ = 'wenz', SOLO = 'solo';
export const GAME_RANK = { sauspiel: 1, wenz: 2, solo: 3 };
export const GAME_NAMES = { sauspiel: 'Sauspiel', wenz: 'Wenz', solo: 'Solo' };
export const TARIF = { sauspiel: 10, wenz: 50, solo: 50 }; // in Cent

// Jede der 32 Karten existiert genau einmal als Objekt, Vergleich per ===.
export const DECK = SUITS.flatMap((suit, si) =>
  RANKS.map((rank, ri) => Object.freeze({ suit, rank, id: si * 8 + ri, points: POINTS[rank] })));

export const card = (suit, rank) => DECK[SUITS.indexOf(suit) * 8 + RANKS.indexOf(rank)];
export const cardName = c => `${SUIT_NAMES[c.suit]}-${RANK_NAMES[c.rank]}`;

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function deal() {
  const deck = shuffle(DECK.slice());
  return [0, 1, 2, 3].map(i => deck.slice(i * 8, i * 8 + 8));
}

export class Contract {
  constructor(kind, declarer, suit = null) {
    this.kind = kind;
    this.declarer = declarer;
    this.suit = suit; // Sauspiel: gerufene Farbe, Solo: Trumpffarbe
    this._order = null;
  }

  get trumpSuit() {
    if (this.kind === SAUSPIEL) return 'herz';
    if (this.kind === SOLO) return this.suit;
    return null;
  }

  get calledAce() {
    return this.kind === SAUSPIEL ? card(this.suit, 'A') : null;
  }

  get label() {
    if (this.kind === SAUSPIEL) return `Sauspiel auf die ${SUIT_NAMES[this.suit]}-Sau`;
    if (this.kind === SOLO) return `${SUIT_NAMES[this.suit]}-Solo`;
    return 'Wenz';
  }

  isTrump(c) {
    if (this.kind === WENZ) return c.rank === 'U';
    return c.rank === 'O' || c.rank === 'U' || c.suit === this.trumpSuit;
  }

  trumpRank(c) {
    const s = 3 - SUITS.indexOf(c.suit);
    if (c.rank === 'O' && this.kind !== WENZ) return 40 + s;
    if (c.rank === 'U') return 30 + s;
    return PLAIN[c.rank];
  }

  // "Farbe" im Sinne des Farbzwangs: alle Trümpfe zählen als eine Farbe
  color(c) {
    return this.isTrump(c) ? 'trumpf' : c.suit;
  }

  // Sticht Karte a die bisher höchste Karte b des Stichs?
  beats(a, b) {
    if (this.isTrump(a)) return !this.isTrump(b) || this.trumpRank(a) > this.trumpRank(b);
    if (this.isTrump(b)) return false;
    return a.suit === b.suit && PLAIN[a.rank] > PLAIN[b.rank];
  }

  trumpOrder() {
    return this._order ??= DECK.filter(c => this.isTrump(c)).sort((a, b) => this.trumpRank(b) - this.trumpRank(a));
  }

  sortValue(c) {
    if (this.isTrump(c)) return 100 - this.trumpRank(c);
    return 100 + SUITS.indexOf(c.suit) * 10 + (10 - PLAIN[c.rank]);
  }
}

// Sortierung vor dem Reizen (wie im Sauspiel)
export const DEFAULT_ORDER = new Contract(SAUSPIEL, -1, 'eichel');

export function callableSuits(hand) {
  return ['eichel', 'gras', 'schellen'].filter(s =>
    !hand.includes(card(s, 'A')) && hand.some(c => c.suit === s && c.rank !== 'O' && c.rank !== 'U'));
}

export function possibleContracts(hand, p) {
  const list = callableSuits(hand).map(s => new Contract(SAUSPIEL, p, s));
  list.push(new Contract(WENZ, p));
  for (const s of SUITS) list.push(new Contract(SOLO, p, s));
  return list;
}

export class Round {
  constructor(hands, leader, contract) {
    this.contract = contract;
    this.hands = hands.map(h => h.slice());
    this.leader = leader;
    this.toMove = leader;
    this.trick = [];      // laufender Stich: [{p, c}]
    this.tricks = [];     // fertige Stiche: {cards, winner}
    this.played = new Set();
    this.points = [0, 0, 0, 0];
    this.trickCount = [0, 0, 0, 0];
    this.voids = [0, 1, 2, 3].map(() => new Set()); // Farben, die ein Spieler sicher nicht mehr hat
    this.noAce = new Set();                         // Spieler, die die Rufsau sicher nicht haben
    this.acePlayed = false;
    this.ranAway = false;
    this._setTeams(hands.map(h => h.slice()));
  }

  _setTeams(initial) {
    this.initial = initial;
    const ace = this.contract.calledAce;
    this.partner = ace ? initial.findIndex(h => h.includes(ace)) : -1;
    this.team = new Set([this.contract.declarer]);
    if (this.partner >= 0) this.team.add(this.partner);
  }

  // Kopie für die KI-Simulation, optional mit (geratenen) Handkarten der anderen
  clone(hands = null) {
    const r = Object.create(Round.prototype);
    Object.assign(r, this);
    r.hands = (hands ?? this.hands).map(h => h.slice());
    r.trick = this.trick.slice();
    r.tricks = this.tricks.slice();
    r.played = new Set(this.played);
    r.points = this.points.slice();
    r.trickCount = this.trickCount.slice();
    r.voids = this.voids.map(v => new Set(v));
    r.noAce = new Set(this.noAce);
    if (hands) r._setTeams(r.hands.map((h, q) => h.concat(this.playedBy(q))));
    return r;
  }

  playedBy(q) {
    const out = [];
    for (const t of this.tricks) for (const x of t.cards) if (x.p === q) out.push(x.c);
    for (const x of this.trick) if (x.p === q) out.push(x.c);
    return out;
  }

  get finished() {
    return this.tricks.length === 8;
  }

  legal(p) {
    const hand = this.hands[p], c = this.contract, ace = c.calledAce;
    const holdsAce = ace && !this.ranAway && hand.includes(ace);
    if (this.trick.length === 0) {
      if (!holdsAce) return hand.slice();
      // Rufsau: Die gerufene Farbe darf man nur mit der Sau anspielen,
      // außer man hat 4 oder mehr Karten dieser Farbe ("davonlaufen").
      const n = hand.filter(x => c.color(x) === ace.suit).length;
      if (n >= 4) return hand.slice();
      return hand.filter(x => x === ace || c.color(x) !== ace.suit);
    }
    const lead = c.color(this.trick[0].c);
    const same = hand.filter(x => c.color(x) === lead);
    if (same.length) return holdsAce && lead === ace.suit ? [ace] : same;
    // Die Rufsau darf nicht abgeworfen werden (außer im letzten Stich)
    if (holdsAce && hand.length > 1) return hand.filter(x => x !== ace);
    return hand.slice();
  }

  currentBest() {
    let best = this.trick[0];
    for (const x of this.trick.slice(1)) if (this.contract.beats(x.c, best.c)) best = x;
    return best;
  }

  play(p, x) {
    if (p !== this.toMove) throw new Error(`Spieler ${p} ist nicht dran`);
    if (!this.legal(p).includes(x)) throw new Error(`Karte nicht erlaubt: ${cardName(x)}`);
    const c = this.contract, ace = c.calledAce;
    if (ace && this.trick.length === 0 && x !== ace && c.color(x) === ace.suit && this.hands[p].includes(ace)) {
      this.ranAway = true;
    }
    if (this.trick.length) {
      const lead = c.color(this.trick[0].c);
      if (c.color(x) !== lead) this.voids[p].add(lead);
      else if (ace && lead === ace.suit && x !== ace && !this.ranAway) this.noAce.add(p);
    }
    this.hands[p] = this.hands[p].filter(y => y !== x);
    this.trick.push({ p, c: x });
    this.played.add(x);
    if (x === ace) this.acePlayed = true;

    if (this.trick.length < 4) {
      this.toMove = (p + 1) % 4;
      return { done: false };
    }
    const winner = this.currentBest().p;
    this.points[winner] += this.trick.reduce((s, t) => s + t.c.points, 0);
    this.trickCount[winner]++;
    this.tricks.push({ cards: this.trick, winner });
    this.trick = [];
    this.toMove = winner;
    return { done: true, winner };
  }

  teamPoints() {
    let s = 0;
    for (const q of this.team) s += this.points[q];
    return s;
  }

  laufende() {
    const teamCards = new Set([...this.team].flatMap(q => this.initial[q]));
    const order = this.contract.trumpOrder();
    const first = teamCards.has(order[0]);
    let n = 0;
    for (const t of order) {
      if (teamCards.has(t) !== first) break;
      n++;
    }
    return n;
  }

  settle() {
    const c = this.contract;
    const tp = this.teamPoints();
    let tt = 0;
    for (const q of this.team) tt += this.trickCount[q];
    const won = tp >= 61;
    const loserPoints = won ? 120 - tp : tp;
    const loserTricks = won ? 8 - tt : tt;

    const parts = [[GAME_NAMES[c.kind], TARIF[c.kind]]];
    if (loserPoints <= 30) parts.push(['Schneider', 10]);
    if (loserTricks === 0) parts.push(['Schwarz', 10]);
    const l = this.laufende();
    if (l >= (c.kind === WENZ ? 2 : 3)) parts.push([`${l} Laufende`, 10 * l]);
    const value = parts.reduce((s, [, v]) => s + v, 0);

    const deltas = [0, 1, 2, 3].map(q => {
      const inTeam = this.team.has(q);
      const sign = inTeam === won ? 1 : -1;
      const mult = c.kind === SAUSPIEL ? 1 : inTeam ? 3 : 1;
      return sign * mult * value;
    });
    return { won, teamPoints: tp, value, parts, deltas };
  }
}
