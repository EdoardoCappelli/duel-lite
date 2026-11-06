// Headless check: node test_engine.mjs. Pot of Greed answered by Ash Blossom must draw nothing.
import { readFileSync } from 'node:fs';
import { nodeOpts } from './nodecore.mjs';
import { Scripts, Sim, COMMON, freePlaces, scriptNames, loadCore, MsgType as T, cardName } from '../engine.js';
import { OcgResponseType as R, SelectIdleCMDAction as I } from '../vendor/index.js';

const cards = JSON.parse(readFileSync(new URL('../cards.json', import.meta.url)));
const POT = 55144522, ASH = 14558127, FILL = 89631139;
const fill = Array(10).fill(FILL);
const run = async ash => {
  const pos = { p0: { hand: [POT], deck: fill }, p1: { hand: ash ? [ASH] : [], deck: fill } };
  const scripts = new Scripts();
  let t = Date.now();
  await scripts.preload([...COMMON, ...scriptNames(pos)]);
  const tFetch = Date.now() - t; t = Date.now();
  const core = await loadCore(nodeOpts);
  const tCore = Date.now() - t; t = Date.now();
  const sim = new Sim(core, cards, scripts, pos);
  const tDuel = Date.now() - t;
  const trace = [];
  let usedPot = false, usedAsh = false, m;
  for (let i = 0; i < 40 && (m = sim.next()); i++) {
    trace.push(`P${m.player} ${T[m.type]}`);
    if (m.type === T.SELECT_IDLECMD) {
      if (!usedPot) { usedPot = true; sim.respond({ type: R.SELECT_IDLECMD, action: I.SELECT_ACTIVATE, index: m.activates.findIndex(c => c.code === POT) }); }
      else break;
    } else if (m.type === T.SELECT_CHAIN) {
      const k = m.selects.findIndex(c => c.code === ASH);
      if (k >= 0) usedAsh = true;
      sim.respond({ type: R.SELECT_CHAIN, index: k >= 0 ? k : null });
    } else if (m.type === T.SELECT_EFFECTYN || m.type === T.SELECT_YESNO) sim.respond({ type: m.type === T.SELECT_YESNO ? R.SELECT_YESNO : R.SELECT_EFFECTYN, yes: true });
    else if (m.type === T.SELECT_PLACE) sim.respond({ type: R.SELECT_PLACE, places: freePlaces(m).slice(0, m.count) });
    else { trace.push('UNHANDLED'); break; }
  }
  const draws = sim.events.filter(e => e.type === T.DRAW).map(e => `P${e.player}:${e.drawn.length}`);
  const negated = sim.events.filter(e => e.type === T.CHAIN_NEGATED || e.type === T.CHAIN_DISABLED).length;
  console.log(JSON.stringify({ ash, tFetch, tCore, tDuel, usedPot, usedAsh, draws, negated, trace, errors: sim.errors.slice(0, 8), missing: [...scripts.missing], late: scripts.late, last: cardName(cards, POT) }));
};
await run(false);
await run(true);
