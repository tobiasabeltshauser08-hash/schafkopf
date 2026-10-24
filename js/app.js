// Spielablauf und Oberfläche.

import { Contract, DEFAULT_ORDER, GAME_RANK, Round, SAUSPIEL, SOLO, SUITS, SUIT_NAMES, WENZ, callableSuits, cardName, deal } from './rules.js';
import { chooseBid, chooseCard } from './ai.js';
import { backImage, cardImage, loadCustomImages } from './cards.js';

const NAMES = ['Du', 'Sepp', 'Vroni', 'Xaver'];
const ME = 0;
const STORE = 'schafkopf-v1';
const SPEED = new URLSearchParams(location.search).get('tempo') === 'schnell'
  ? { bid: 50, card: 50, trick: 150 }
  : { bid: 650, card: 750, trick: 1400 };

const $ = s => document.querySelector(s);
const wait = ms => new Promise(r => setTimeout(r, ms));
const euro = (cents, sign = true) =>
  (sign ? (cents < 0 ? '−' : cents > 0 ? '+' : '') : '') + (Math.abs(cents) / 100).toFixed(2).replace('.', ',') + ' €';

let saved = load();
let hands = null;      // Karten vor dem Spiel (beim Reizen)
let round = null;
let contract = null;
let shown = [];        // Karten, die gerade auf dem Tisch liegen
let winnerSeat = -1;
let pickResolver = null;
let seats = [];
let lastResultHtml = '';

function load() {
  const fresh = { balances: [0, 0, 0, 0], dealer: Math.floor(Math.random() * 4), games: 0 };
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s && Array.isArray(s.balances) && s.balances.length === 4) return { ...fresh, ...s };
  } catch { /* kein Speicher verfügbar */ }
  return fresh;
}

function save() {
  try { localStorage.setItem(STORE, JSON.stringify(saved)); } catch { /* egal */ }
}

// ---------- Darstellung ----------

function img(src, alt = '') {
  const i = document.createElement('img');
  i.className = 'card-img';
  i.src = src;
  i.alt = alt;
  i.draggable = false;
  return i;
}

function buildSeats() {
  seats = [0, 1, 2, 3].map(p => {
    const el = $(`.seat[data-seat="${p}"]`);
    el.innerHTML = `<div class="name"></div><div class="money"></div><div class="bubble">&nbsp;</div>` +
      (p !== ME ? '<div class="backs"></div>' : '') + '<div class="info"></div>';
    return {
      name: el.querySelector('.name'),
      money: el.querySelector('.money'),
      bubble: el.querySelector('.bubble'),
      backs: el.querySelector('.backs'),
      info: el.querySelector('.info'),
      count: -1,
    };
  });
}

function setBubble(p, text) {
  const b = seats[p].bubble;
  b.textContent = text || ' ';
  b.classList.remove('show');
  if (text) {
    void b.offsetWidth; // Animation neu starten
    b.classList.add('show');
  }
}

const clearBubbles = () => [0, 1, 2, 3].forEach(p => setBubble(p, ''));
const setMessage = t => ($('#message').textContent = t);
const setContract = t => ($('#contract').textContent = t);

function renderSeats() {
  for (let p = 0; p < 4; p++) {
    const s = seats[p];
    let tag = '';
    if (contract && p === contract.declarer) tag = '<span class="tag">Spieler</span>';
    else if (round && p === round.partner && (round.acePlayed || ME === round.partner)) tag = '<span class="tag partner">Partner</span>';
    s.name.innerHTML = NAMES[p] + tag + (p === saved.dealer ? ' <span class="dealer">gibt</span>' : '');
    s.money.textContent = euro(saved.balances[p]);
    const tricks = round ? round.trickCount[p] : 0;
    s.info.textContent = round ? `${tricks} ${tricks === 1 ? 'Stich' : 'Stiche'}` : '';
    if (s.backs) {
      const count = round ? round.hands[p].length : hands ? hands[p].length : 0;
      if (count !== s.count) {
        s.count = count;
        s.backs.replaceChildren(...Array.from({ length: count }, () => img(backImage())));
      }
    }
  }
}

function renderTrick() {
  for (const slot of document.querySelectorAll('#trick .slot')) {
    const p = Number(slot.dataset.seat);
    const t = shown.find(x => x.p === p);
    const key = t ? String(t.c.id) : '';
    if (slot.dataset.card !== key) {
      slot.dataset.card = key;
      slot.replaceChildren(...(t ? [img(cardImage(t.c), `${NAMES[p]}: ${cardName(t.c)}`)] : []));
    }
    slot.classList.toggle('winner', p === winnerSeat);
  }
}

function renderHand() {
  const el = $('#hand');
  const cards = (round ? round.hands[ME] : hands ? hands[ME] : []).slice();
  const order = contract ?? DEFAULT_ORDER;
  cards.sort((a, b) => order.sortValue(a) - order.sortValue(b));
  const legal = pickResolver ? new Set(round.legal(ME)) : null;
  el.classList.toggle('my-turn', !!legal);
  el.replaceChildren(...cards.map(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hc';
    b.setAttribute('aria-label', cardName(c));
    b.append(img(cardImage(c)));
    if (legal && legal.has(c)) {
      b.classList.add('playable');
      b.onclick = () => pickResolver?.(c);
    } else {
      b.disabled = true;
      if (legal) b.classList.add('blocked');
    }
    return b;
  }));
}

function render() {
  renderSeats();
  renderTrick();
  renderHand();
}

function setPanel(...children) {
  $('#panel').replaceChildren(...children);
}

function button(label, onClick, primary = false) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  if (primary) b.className = 'primary';
  b.onclick = onClick;
  return b;
}

function group(label, buttons) {
  const g = document.createElement('div');
  g.className = 'group';
  if (label) {
    const l = document.createElement('span');
    l.className = 'group-label';
    l.textContent = label;
    g.append(l);
  }
  g.append(...buttons);
  return g;
}

function openModal(html, actions = [['Schließen', closeModal, true]]) {
  $('#modal-body').innerHTML = html;
  $('#modal-actions').replaceChildren(...actions.map(([l, f, p]) => button(l, f, p)));
  const m = $('#modal');
  if (!m.open) m.showModal();
}

function closeModal() {
  const m = $('#modal');
  if (m.open) m.close();
}

function phrase(k) {
  if (k.kind === SAUSPIEL) return `auf die ${SUIT_NAMES[k.suit]}-Sau`;
  if (k.kind === WENZ) return 'einen Wenz';
  return `ein ${k.label}`;
}

const verb = (p, du, er) => (p === ME ? du : er);

// ---------- Spielablauf ----------

function askBid(hand) {
  return new Promise(resolve => {
    const pick = k => { setPanel(); resolve(k); };
    const prompt = document.createElement('div');
    prompt.className = 'prompt';
    prompt.textContent = 'Spielst du?';
    const calls = callableSuits(hand).map(s => button(`${SUIT_NAMES[s]}-Sau`, () => pick(new Contract(SAUSPIEL, ME, s))));
    setPanel(
      prompt,
      group('', [button('Weiter', () => pick(null), true)]),
      group('Sauspiel:', calls.length ? calls : [Object.assign(document.createElement('span'), { className: 'group-label', textContent: 'keine Sau rufbar' })]),
      group('', [button('Wenz', () => pick(new Contract(WENZ, ME)))]),
      group('Solo:', SUITS.map(s => button(SUIT_NAMES[s], () => pick(new Contract(SOLO, ME, s))))),
    );
  });
}

async function nextGame() {
  closeModal();
  setPanel();
  saved.dealer = (saved.dealer + 1) % 4;
  save();
  hands = deal();
  round = null;
  contract = null;
  shown = [];
  winnerSeat = -1;
  clearBubbles();
  setMessage('');
  setContract('Reizen …');
  render();

  const leader = (saved.dealer + 1) % 4;
  const offers = [];
  for (let i = 0; i < 4; i++) {
    const p = (leader + i) % 4;
    let bid;
    if (p === ME) {
      setMessage(i === 0 ? 'Du hast Vorhand.' : '');
      bid = await askBid(hands[ME]);
      setMessage('');
    } else {
      await wait(SPEED.bid);
      bid = chooseBid(hands[p], p, leader);
    }
    setBubble(p, bid ? 'I spui!' : 'Weiter');
    if (bid) offers.push(bid);
  }

  if (!offers.length) {
    setContract('Alle weiter');
    setMessage('Zamgschmissn – es wird neu gegeben.');
    await wait(2200);
    return nextGame();
  }

  // Höheres Spiel gewinnt, bei Gleichstand der Spieler, der früher dran war
  contract = offers.reduce((a, b) => (GAME_RANK[b.kind] > GAME_RANK[a.kind] ? b : a));
  await wait(600);
  clearBubbles();
  const d = contract.declarer;
  if (offers.length > 1) setMessage('Mehrere wollten spielen – das höhere Spiel gewinnt.');
  setBubble(d, contract.kind === SAUSPIEL ? `${SUIT_NAMES[contract.suit]}-Sau` : contract.label);
  setContract(`${NAMES[d]} ${verb(d, 'spielst', 'spielt')} ${phrase(contract)}`);
  round = new Round(hands, leader, contract);
  hands = null;
  if (round.partner === ME) setMessage(`Du hast die ${SUIT_NAMES[contract.suit]}-Sau – du bist Partner von ${NAMES[d]}!`);
  render();
  await wait(900);
  await playRound();
}

async function playRound() {
  let revealed = false;
  while (!round.finished) {
    const p = round.toMove;
    let x;
    if (p === ME) {
      setMessage(round.trick.length ? 'Du bist dran.' : 'Du kommst raus.');
      x = await new Promise(res => { pickResolver = res; renderHand(); });
      pickResolver = null;
    } else {
      await wait(SPEED.card);
      x = chooseCard(round, p);
    }
    if (round.trick.length === 0) setMessage('');
    const res = round.play(p, x);
    shown.push({ p, c: x });
    if (!revealed && round.acePlayed) {
      revealed = true;
      if (p !== ME) setBubble(p, 'Partner!');
    }
    render();
    if (res.done) {
      const w = res.winner;
      winnerSeat = w;
      renderTrick();
      const pts = round.tricks.at(-1).cards.reduce((s, t) => s + t.c.points, 0);
      setMessage(`${NAMES[w]} ${verb(w, 'machst', 'macht')} den Stich (${pts} Augen).`);
      await wait(SPEED.trick);
      shown = [];
      winnerSeat = -1;
      clearBubbles();
      render();
    }
  }
  showResult();
}

function showResult() {
  const s = round.settle();
  s.deltas.forEach((v, i) => (saved.balances[i] += v));
  saved.games++;
  save();
  render();
  setMessage('');

  const team = [...round.team].sort((a, b) => a - b);
  const teamNames = team.map(q => NAMES[q]).join(' und ');
  const subj = team.length > 1 ? 'haben' : team[0] === ME ? 'hast' : 'hat';
  const meWon = s.deltas[ME] > 0;
  const rows = s.parts.map(([l, v]) => `<tr><td>${l}</td><td class="num">${euro(v, false)}</td></tr>`).join('');
  const per = contract.kind === SAUSPIEL ? 'Jeder Verlierer zahlt einem Gewinner' : 'Jeder Gegner zahlt bzw. bekommt';
  const players = [0, 1, 2, 3].map(q => {
    const v = s.deltas[q];
    return `<tr><td>${NAMES[q]}${round.team.has(q) ? ' ★' : ''}</td><td class="num">${round.points[q]}</td>
      <td class="num">${round.trickCount[q]}</td><td class="num ${v > 0 ? 'plus' : 'minus'}">${euro(v)}</td>
      <td class="num">${euro(saved.balances[q])}</td></tr>`;
  }).join('');

  lastResultHtml = `
    <h2>${meWon ? 'Gewonnen!' : 'Verloren'}</h2>
    <p>${teamNames} (${contract.label}) ${subj} <b>${s.teamPoints} Augen</b> – ${s.won ? 'gewonnen' : 'verloren'}.
       Die Gegner haben ${120 - s.teamPoints} Augen.</p>
    <table class="result-table">${rows}
      <tr><th>${per}</th><th class="num">${euro(s.value, false)}</th></tr></table>
    <h3>Abrechnung</h3>
    <table class="result-table">
      <tr><th>Spieler</th><th class="num">Augen</th><th class="num">Stiche</th><th class="num">Runde</th><th class="num">Konto</th></tr>
      ${players}</table>
    <p class="info">★ = Spielerpartei</p>`;
  openResultAgain();
  setPanel(button('Nächstes Spiel', nextGame, true));
}

function showLastTrick() {
  const t = round?.tricks.at(-1);
  if (!t) {
    openModal('<h2>Letzter Stich</h2><p>Es wurde noch kein Stich gespielt.</p>');
    return;
  }
  const html = t.cards.map(({ p, c }) =>
    `<figure class="${p === t.winner ? 'won' : ''}"><img class="card-img" src="${cardImage(c)}" alt="${cardName(c)}">
     <figcaption>${NAMES[p]}</figcaption></figure>`).join('');
  const pts = t.cards.reduce((s, x) => s + x.c.points, 0);
  // Nach Rundenende geht es zurück zur Abrechnung
  const actions = round.finished
    ? [['Zurück', openResultAgain], ['Nächstes Spiel', nextGame, true]]
    : [['Schließen', closeModal, true]];
  openModal(`<h2>Letzter Stich</h2><div class="last-trick">${html}</div>
    <p>${NAMES[t.winner]} ${verb(t.winner, 'hast', 'hat')} ihn gemacht – ${pts} Augen.</p>`, actions);
}

function openResultAgain() {
  openModal(lastResultHtml, [['Letzter Stich', showLastTrick], ['Nächstes Spiel', nextGame, true]]);
}

function showMenu() {
  openModal(`
    <h2>Menü</h2>
    <p>Gespielte Runden: ${saved.games}</p>
    <h3>Als App installieren</h3>
    <p>Im Browser-Menü „App installieren“ bzw. auf dem Handy „Zum Startbildschirm hinzufügen“ wählen. Danach läuft Schafkopf auch offline.</p>
    <h3>Eigene Kartenbilder</h3>
    <p>Lege Bilder in den Ordner <code>karten/</code>, z. B. <code>herz-ober.jpg</code>, <code>eichel-sau.png</code> oder <code>rueckseite.jpg</code>. Mehr dazu steht in <code>karten/LIESMICH.txt</code>.</p>`,
  [['Konto zurücksetzen', resetBalances], ['Schließen', closeModal, true]]);
}

function resetBalances() {
  if (!confirm('Kontostand aller Spieler auf 0 setzen?')) return;
  saved.balances = [0, 0, 0, 0];
  saved.games = 0;
  save();
  renderSeats();
  closeModal();
}

async function init() {
  buildSeats();
  $('#btn-rules').onclick = () => openModal($('#rules').innerHTML);
  $('#btn-last').onclick = showLastTrick;
  $('#btn-menu').onclick = showMenu;
  // Die Abrechnung darf nicht mit Esc weggeklickt werden, ohne dass man weiterspielen kann
  $('#modal').addEventListener('close', () => {
    if (round?.finished && !$('#panel').children.length) setPanel(button('Nächstes Spiel', nextGame, true));
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  await loadCustomImages();
  render();

  if (saved.games === 0) {
    openModal(`<h2>Servus!</h2>
      <p>Du spielst Schafkopf gegen <b>Sepp</b>, <b>Vroni</b> und <b>Xaver</b>.
      Sauspiel 10 ct, Wenz und Solo 50 ct. Der Kontostand wird gespeichert.</p>
      <p>Die Regeln findest du jederzeit oben unter „Regeln“.</p>`,
    [['Regeln', () => openModal($('#rules').innerHTML, [['Los geht’s', nextGame, true]])], ['Los geht’s', nextGame, true]]);
  } else {
    nextGame();
  }
}

init();
