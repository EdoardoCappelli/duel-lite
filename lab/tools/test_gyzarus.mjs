// Gladiator Beast Gyzarus: contact fusion, needs Bestiari + a Gladiator Beast on the field.
import { readFileSync } from 'node:fs';
import { nodeOpts } from './nodecore.mjs';
import { Scripts, Sim, COMMON, scriptNames, freePlaces, loadCore, MsgType as T, cardName } from '../engine.js';
import { OcgResponseType as R, SelectIdleCMDAction as I } from '../vendor/index.js';
const cards = JSON.parse(readFileSync(new URL('../cards.json', import.meta.url)));
const byName = n => +Object.keys(cards).find(k => cards[k][8] === n);
const GY = byName('Gladiator Beast Gyzarus'), BE = byName('Gladiator Beast Bestiari'), LA = byName('Gladiator Beast Laquari'), F = 89631139;
const core = await loadCore(nodeOpts);
const run = async (label, p0) => {
  const pos = { p0: { deck: Array(10).fill(F), ...p0 }, p1: { deck: Array(10).fill(F) } };
  const s = new Scripts(); s.mem.set('c0.lua', null); s.mem.set('proc_unofficial.lua', null);
  await s.preload([...COMMON, ...scriptNames(pos)]);
  const sim = new Sim(core, cards, s, pos); let m, trace = [], ss = null, done = false;
  for (let i = 0; i < 30 && (m = sim.next()); i++) {
    if (m.type === T.SELECT_IDLECMD) {
      if (ss === null) ss = m.special_summons.map(c => cardName(cards, c.code));
      const k = m.special_summons.findIndex(c => c.code === GY);
      if (k < 0 || done) break;
      done = true; sim.respond({ type: R.SELECT_IDLECMD, action: I.SELECT_SPECIAL_SUMMON, index: k }); continue;
    }
    trace.push(T[m.type]);
    if (m.type === T.SELECT_CHAIN) sim.respond({ type: R.SELECT_CHAIN, index: null });
    else if (m.type === T.SELECT_UNSELECT_CARD) sim.respond({ type: R.SELECT_UNSELECT_CARD, index: m.select_cards.length ? 0 : null });
    else if (m.type === T.SELECT_CARD) sim.respond({ type: R.SELECT_CARD, indicies: Array.from({ length: m.min }, (_, x) => x) });
    else if (m.type === T.SELECT_PLACE) sim.respond({ type: R.SELECT_PLACE, places: freePlaces(m).slice(0, m.count) });
    else if (m.type === T.SELECT_POSITION) sim.respond({ type: R.SELECT_POSITION, position: 1 });
    else break;
  }
  console.log(JSON.stringify({ label, specialSummons: ss, trace: trace.slice(0, 8), onField: sim.zone(0, 4).filter(c => c?.code).map(c => cardName(cards, c.code)), extra: sim.core.duelQueryCount(sim.h, 0, 64), errors: sim.errors.slice(0, 3), missing: [...s.missing] }));
  sim.destroy();
};
await run('extra, nothing on field', { ex: [GY] });
await run('extra + Bestiari + Laquari', { ex: [GY], m: [BE, LA] });
await run('extra + 2 Bestiari', { ex: [GY], m: [BE, BE] });
await run('extra + Bestiari only', { ex: [GY], m: [BE] });
await run('placed in hand by mistake', { hand: [GY], m: [BE, LA] });
