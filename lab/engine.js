// Runs a position through EDOPro's rules engine (ocgcore-wasm) and exposes its questions as prompts.
import createCore, { OcgDuelMode, OcgLocation as L, OcgPosition as P, OcgProcessResult, OcgMessageType as T, OcgQueryFlags as Q } from './vendor/index.js';

const BASE = 'https://raw.githubusercontent.com/ProjectIgnis/CardScripts/master/';
export const COMMON = ['constant.lua', 'utility.lua', 'archetype_setcode_constants.lua', 'card_counter_constants.lua', 'cards_specific_functions.lua',
  'chain.lua', 'debug_utility.lua', 'deprecated_functions.lua', 'proc_equip.lua', 'proc_fusion.lua', 'proc_fusion_spell.lua', 'proc_gemini.lua', 'proc_link.lua',
  'proc_maximum.lua', 'proc_normal.lua', 'proc_pendulum.lua', 'proc_persistent.lua', 'proc_ritual.lua', 'proc_rush.lua', 'proc_skill.lua', 'proc_spirit.lua',
  'proc_synchro.lua', 'proc_union.lua', 'proc_workaround.lua', 'proc_xyz.lua'];
const pathsFor = name => /^c\d+\.lua$/.test(name)
  ? ['official/', 'unofficial/', 'pre-release/', 'pre-errata/'].map(d => d + name)
  : [name, 'unofficial/' + name];

/* Script store: card scripts are downloaded ahead of time; anything the engine asks for later
   (tokens, cards named by another script) falls back to `syncFetch`. */
export class Scripts {
  constructor({ store, syncFetch } = {}) { this.mem = new Map(); this.store = store; this.syncFetch = syncFetch; this.missing = new Set(); this.late = []; }
  async fetchOne(name) {
    if (this.mem.has(name)) return;
    const cached = await this.store?.get(name);
    if (cached !== undefined && cached !== null) { this.mem.set(name, cached); return; }
    for (const p of pathsFor(name)) {
      const r = await fetch(BASE + p);
      if (r.ok) { const t = await r.text(); this.mem.set(name, t); this.store?.put(name, t); return; }
    }
    this.mem.set(name, null); // normal monsters have no script
  }
  async preload(names) {
    const q = [...names];
    await Promise.all(Array.from({ length: 8 }, async () => { while (q.length) await this.fetchOne(q.shift()); }));
  }
  read(name) {
    if (this.mem.has(name)) return this.mem.get(name);
    this.late.push(name);
    let text = null;
    if (this.syncFetch) for (const p of pathsFor(name)) { text = this.syncFetch(BASE + p); if (text !== null) break; }
    if (text === null) this.missing.add(name); else this.store?.put(name, text);
    this.mem.set(name, text);
    return text;
  }
}

/* cards.json row: [alias,setcode,type,atk,def,level,race,attribute,name,strs?] (see tools/build_cards.py) */
const TYPE_LINK = 0x4000000;
export function cardData(cards, code) {
  const r = cards[code];
  if (!r) return null;
  const [alias, set, type, atk, def, lvl, race, attr] = r, setcodes = [];
  for (let s = BigInt(set); s > 0n; s >>= 16n) if (s & 0xffffn) setcodes.push(Number(s & 0xffffn));
  const link = (type & TYPE_LINK) !== 0;
  return { code, alias, setcodes, type, level: lvl & 0xff, attribute: attr, race: BigInt(race), attack: atk, defense: link ? 0 : def,
    lscale: (lvl >> 24) & 0xff, rscale: (lvl >> 16) & 0xff, link_marker: link ? def : 0 };
}
export const cardName = (cards, code) => cards[code]?.[8] || '#' + code;
/* an effect description is code*16+index into that card's strings */
export function effectText(cards, desc) {
  const d = BigInt(desc ?? 0), code = Number(d >> 20n) || Number(d / 16n), idx = Number(d & 0xfn);
  return cards[code]?.[9]?.[idx] || '';
}
export const scriptNames = pos => [...new Set(['p0', 'p1'].flatMap(p => ['hand', 'm', 's', 'gy', 'ban', 'deck', 'ex'].flatMap(z => (pos[p][z] || []).map(c => c.id ?? c))))].filter(Boolean).map(id => `c${id}.lua`);

/* position: {p0:{lp,hand,m,s,gy,ban,deck,ex}, p1:{...}}; entries: id or {id,pos,seq,mats,borrowed} */
/* last step reached and engine messages, readable even when the constructor throws */
export const trace = { step: '', log: [] };
export class Sim {
  constructor(core, cards, scripts, pos, seed) {
    this.core = core; this.cards = cards; this.events = []; this.errors = []; this.ended = false;
    trace.step = 'createDuel'; trace.log = [];
    this.seed = seed || Array.from({ length: 4 }, () => BigInt(Math.floor(Math.random() * 2 ** 48) + 1));
    const team = lp => ({ startingLP: lp ?? 8000, startingDrawCount: pos.startHand ?? 0, drawCountPerTurn: 1 });
    this.h = core.createDuel({
      flags: OcgDuelMode.MODE_MR5 | OcgDuelMode.ATTACK_FIRST_TURN,
      seed: this.seed,
      team1: team(pos.p0.lp), team2: team(pos.p1.lp),
      cardReader: c => { trace.step = 'cardReader ' + c; return cardData(cards, c); },
      scriptReader: n => { trace.step = 'scriptReader ' + n; return scripts.read(n); },
      errorHandler: (t, text) => { this.errors.push(text); trace.log.push(text); },
    });
    if (!this.h) throw new Error('createDuel failed');
    trace.step = 'loadScript constant.lua';
    core.loadScript(this.h, 'constant.lua', scripts.read('constant.lua'));
    trace.step = 'loadScript utility.lua';
    core.loadScript(this.h, 'utility.lua', scripts.read('utility.lua'));
    trace.step = 'duelNewCard';
    ['p0', 'p1'].forEach((p, team) => {
      const s = pos[p];
      const entries = (arr, loc, dflt) => (arr || []).forEach((c, i) => {
        const o = typeof c === 'object' ? c : { id: c }, seq = o.seq ?? i;
        // `borrowed`: on this side of the field but owned by the other player (control switched)
        core.duelNewCard(this.h, { team: o.borrowed ? 1 - team : team, duelist: 0, code: o.id, controller: team, location: loc, sequence: seq, position: o.pos ?? dflt });
        // duelNewCard can't attach materials: Debug.AddCard on an occupied monster zone does (same as puzzles)
        (o.mats || []).forEach(id => core.loadScript(this.h, 'position.lua', `Debug.AddCard(${id},${team},${team},${L.MZONE},${seq},${P.FACEUP_ATTACK})`));
      });
      entries(s.deck, L.DECK, P.FACEDOWN_DEFENSE);
      entries(s.ex, L.EXTRA, P.FACEDOWN_DEFENSE);
      entries(s.hand, L.HAND, P.FACEDOWN_DEFENSE);
      entries(s.gy, L.GRAVE, P.FACEUP_ATTACK);
      entries(s.ban, L.REMOVED, P.FACEUP_ATTACK);
      entries(s.m, L.MZONE, P.FACEUP_ATTACK);
      entries(s.s, L.SZONE, P.FACEDOWN_DEFENSE);
    });
    trace.step = 'startDuel';
    core.startDuel(this.h);
    trace.step = 'running';
  }
  /* runs until the engine needs an answer: returns the prompt message, or null when the duel is over */
  next() {
    for (;;) {
      const status = this.core.duelProcess(this.h);
      let prompt = null;
      for (const m of this.core.duelGetMessage(this.h)) {
        this.events.push(m);
        if (m.type === T.RETRY) this.errors.push('RETRY: risposta rifiutata dal motore');
        if (String(T[m.type] ?? '').match(/^(SELECT_|SORT_|ANNOUNCE_|ROCK_)/)) prompt = m;
      }
      // the engine keeps going after announcing a winner: the duel is over at the first WIN
      if (status === OcgProcessResult.END || this.events.some(e => e.type === T.WIN)) { this.ended = true; return null; }
      // after a rejected answer (RETRY) the engine waits on the same question again
      if (status === OcgProcessResult.WAITING) return this.lastPrompt = prompt || this.lastPrompt;
    }
  }
  respond(r) { this.core.duelSetResponse(this.h, r); }
  /* what is on the board right now, read back from the engine */
  zone(player, location) {
    return this.core.duelQueryLocation(this.h, { flags: Q.CODE | Q.POSITION | Q.ATTACK | Q.DEFENSE | Q.OVERLAY_CARD, controller: player, location, sequence: 0, overlaySequence: 0 });
  }
  destroy() { try { this.core.destroyDuel?.(this.h); } catch {} }
}

/* zones offered by SELECT_PLACE: a 0 bit means free. Low 16 bits are the asking player's side
   (0-6 monster zones, 8-15 S/T zones: 13 field, 14-15 pendulum), high 16 the opponent's */
export function freePlaces(m) {
  const out = [];
  for (const [shift, player] of [[0, m.player], [16, 1 - m.player]]) {
    for (let i = 0; i < 7; i++) if (!(m.field_mask >>> (shift + i) & 1)) out.push({ player, location: L.MZONE, sequence: i });
    for (let i = 0; i < 8; i++) if (!(m.field_mask >>> (shift + 8 + i) & 1)) out.push({ player, location: L.SZONE, sequence: i });
  }
  return out;
}

// the wasm sits next to the glue (see vendor/BUILD.md); `opts` lets Node tests load it from disk
export const loadCore = (opts = {}) => createCore({ sync: true, locateFile: f => new URL('./vendor/' + f, import.meta.url).href, ...opts });
export { T as MsgType };
