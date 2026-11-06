// Random play with the preset decks, to find engine questions the UI can't answer: node fuzz.mjs [duels] [maxSteps]
import { readFileSync } from 'node:fs';
import { nodeOpts } from './nodecore.mjs';
import { Scripts, Sim, COMMON, scriptNames, freePlaces, loadCore, MsgType as T } from '../engine.js';
import { OcgResponseType as R, SelectIdleCMDAction as I, SelectBattleCMDAction as B, ocgPositionParse } from '../vendor/index.js';

const cards = JSON.parse(readFileSync(new URL('../cards.json', import.meta.url)));
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const dec = b => { const u = Buffer.from(b, 'base64'), a = []; for (let i = 0; i + 4 <= u.length; i += 4) a.push(u.readUInt32LE(i)); return a; };
const decks = [...html.matchAll(/\['([^']+)','ydke:\/\/([^']+)'\]/g)].map(m => { const [main, extra] = m[2].split('!'); return { name: m[1], main: dec(main), extra: dec(extra) }; });
const rnd = n => Math.floor(Math.random() * n), pick = a => a[rnd(a.length)];
const sample = (n, k) => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, k); };

function answer(m) {
  switch (m.type) {
    case T.SELECT_IDLECMD: {
      const o = [];
      [[m.activates, I.SELECT_ACTIVATE], [m.summons, I.SELECT_SUMMON], [m.special_summons, I.SELECT_SPECIAL_SUMMON], [m.monster_sets, I.SELECT_MONSTER_SET], [m.spell_sets, I.SELECT_SPELL_SET], [m.pos_changes, I.SELECT_POS_CHANGE]]
        .forEach(([a, action]) => a.forEach((_, index) => o.push({ action, index })));
      if (o.length && Math.random() < .85) return { type: R.SELECT_IDLECMD, ...pick(o) };
      return { type: R.SELECT_IDLECMD, action: m.to_bp ? I.TO_BP : I.TO_EP, index: null };
    }
    case T.SELECT_BATTLECMD: {
      const o = m.attacks.map((_, index) => ({ action: B.SELECT_BATTLE, index })).concat(m.chains.map((_, index) => ({ action: B.SELECT_CHAIN, index })));
      if (o.length && Math.random() < .8) return { type: R.SELECT_BATTLECMD, ...pick(o) };
      return { type: R.SELECT_BATTLECMD, action: m.to_m2 ? B.TO_M2 : B.TO_EP, index: null };
    }
    case T.SELECT_CHAIN: return { type: R.SELECT_CHAIN, index: m.selects.length && (m.forced || Math.random() < .6) ? rnd(m.selects.length) : null };
    case T.SELECT_EFFECTYN: return { type: R.SELECT_EFFECTYN, yes: Math.random() < .7 };
    case T.SELECT_YESNO: return { type: R.SELECT_YESNO, yes: Math.random() < .7 };
    case T.SELECT_OPTION: return { type: R.SELECT_OPTION, index: rnd(m.options.length) };
    case T.SELECT_CARD: return { type: R.SELECT_CARD, indicies: sample(m.selects.length, m.min + rnd(m.max - m.min + 1)) };
    case T.SELECT_TRIBUTE: return { type: R.SELECT_TRIBUTE, indicies: sample(m.selects.length, m.min) };
    case T.SELECT_UNSELECT_CARD: return { type: R.SELECT_UNSELECT_CARD, index: m.select_cards.length ? rnd(m.select_cards.length) : null };
    case T.SELECT_PLACE: return { type: R.SELECT_PLACE, places: freePlaces(m).slice(0, m.count) };
    case T.SELECT_DISFIELD: return { type: R.SELECT_DISFIELD, places: freePlaces(m).slice(0, m.count) };
    case T.SELECT_POSITION: return { type: R.SELECT_POSITION, position: pick(ocgPositionParse(m.positions)) };
    case T.SORT_CARD: return { type: R.SORT_CARD, order: null };
    case T.ANNOUNCE_NUMBER: return { type: R.ANNOUNCE_NUMBER, value: rnd(m.options.length) };
    case T.ANNOUNCE_CARD: return { type: R.ANNOUNCE_CARD, card: 89631139 };
    case T.ROCK_PAPER_SCISSORS: return { type: R.ROCK_PAPER_SCISSORS, value: 1 + rnd(3) };
    case T.SELECT_COUNTER: { let left = m.count; return { type: R.SELECT_COUNTER, counters: m.cards.map(c => { const n = Math.min(c.count, left); left -= n; return n; }) }; }
    case T.SELECT_SUM: { // find a real subset summing to the amount
      const list = m.selects, must = m.selects_must.reduce((s, c) => s + (c.amount & 0xffff), 0);
      for (let t = 0; t < 400; t++) {
        const ix = sample(list.length, 1 + rnd(list.length));
        const sum = ix.reduce((s, i) => s + (list[i].amount & 0xffff), must);
        if (sum === m.amount) return { type: R.SELECT_SUM, indicies: ix };
      }
      return { type: R.SELECT_SUM, indicies: [] };
    }
    default: return null;
  }
}

const duels = +process.argv[2] || 12, maxSteps = +process.argv[3] || 400;
const scripts = new Scripts();
const all = { p0: { deck: decks.flatMap(d => d.main), ex: decks.flatMap(d => d.extra) }, p1: {} };
await scripts.preload([...COMMON, ...scriptNames(all)]);
scripts.mem.set('c0.lua', null); scripts.mem.set('proc_unofficial.lua', null);
const core = await loadCore(nodeOpts);
const seen = {}, unhandled = {}, retries = {}, errs = {};
let steps = 0, ended = 0, crashes = 0, t0 = Date.now(), slowest = 0;
for (let d = 0; d < duels; d++) {
  const a = decks[d % decks.length], b = decks[(d + 1) % decks.length];
  const pos = { startHand: 5, p0: { deck: a.main, ex: a.extra }, p1: { deck: b.main, ex: b.extra } };
  let sim;
  try {
    sim = new Sim(core, cards, scripts, pos);
    let m, stuck = 0, prevErr = 0;
    for (let i = 0; i < maxSteps; i++) {
      const t = performance.now();
      m = sim.next();
      slowest = Math.max(slowest, performance.now() - t);
      if (!m) { ended++; break; }
      const name = T[m.type]; seen[name] = (seen[name] || 0) + 1; steps++;
      const retried = sim.events.at(-1)?.type === T.RETRY;
      if (retried) { retries[name] = (retries[name] || 0) + 1; if (++stuck > 30) break; } else stuck = 0;
      const r = answer(m);
      if (!r) { unhandled[name] = (unhandled[name] || 0) + 1; break; }
      sim.respond(r);
    }
    sim.errors.filter(e => !e.startsWith('RETRY')).forEach(e => { const k = e.split('\n')[0].slice(0, 140); errs[k] = (errs[k] || 0) + 1; });
    sim.destroy();
    // the browser fetches these on the fly; here they are fetched for the next duel
    const late = [...scripts.missing]; late.forEach(n => { scripts.mem.delete(n); scripts.missing.delete(n); });
    await scripts.preload(late);
  } catch (e) { crashes++; console.log('CRASH', a.name, 'vs', b.name, String(e).slice(0, 200)); }
}
console.log(JSON.stringify({ decks: decks.map(d => d.name), duels, steps, ended, crashes, ms: Date.now() - t0, slowestStepMs: Math.round(slowest), seen, unhandled, retries, errs, late: [...new Set(scripts.late)].filter(n => !/c0|unofficial/.test(n)), missing: [...scripts.missing] }, null, 1));
