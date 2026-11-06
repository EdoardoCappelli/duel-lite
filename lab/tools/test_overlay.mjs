// Number 39: Utopia placed with materials must offer its effect when attacked.
import { readFileSync } from 'node:fs';
import { nodeOpts } from './nodecore.mjs';
import { Scripts, Sim, COMMON, scriptNames, freePlaces, loadCore, MsgType as T } from '../engine.js';
import { OcgResponseType as R, SelectBattleCMDAction as B, SelectIdleCMDAction as I, OcgPosition as P } from '../vendor/index.js';
const cards = JSON.parse(readFileSync(new URL('../cards.json', import.meta.url)));
const UT = 84013237, BE = 89631139, fill = Array(10).fill(BE);
for (const mats of [[BE, BE], []]) {
  const pos = { p0: { m: [{ id: BE, seq: 2 }], deck: fill }, p1: { m: [{ id: UT, seq: 1, mats }], deck: fill } };
  const s = new Scripts(); s.mem.set('c0.lua', null); s.mem.set('proc_unofficial.lua', null);
  await s.preload([...COMMON, ...scriptNames(pos)]);
  const sim = new Sim(await loadCore(nodeOpts), cards, s, pos); let m, offered = false, trace = [];
  for (let i = 0; i < 30 && (m = sim.next()); i++) {
    trace.push(`P${m.player} ${T[m.type]}${m.selects?' '+JSON.stringify(m.selects.map(c=>c.code)):''}${m.description!=null?' d='+m.description:''}`);
    if (m.type === T.SELECT_IDLECMD) sim.respond({ type: R.SELECT_IDLECMD, action: I.TO_BP, index: null });
    else if (m.type === T.SELECT_BATTLECMD) { if (m.attacks.length) sim.respond({ type: R.SELECT_BATTLECMD, action: B.SELECT_BATTLE, index: 0 }); else break; }
    else if (m.type === T.SELECT_CARD) sim.respond({ type: R.SELECT_CARD, indicies: [0] });
    else if (m.type === T.SELECT_CHAIN) { if (m.player === 1 && m.selects.some(c => c.code === UT)) offered = true; sim.respond({ type: R.SELECT_CHAIN, index: null }); if (offered) break; }
    else if (m.type === T.SELECT_EFFECTYN) { if (m.code === UT) offered = true; sim.respond({ type: R.SELECT_EFFECTYN, yes: false }); if (offered) break; }
    else if (m.type === T.SELECT_YESNO) sim.respond({ type: R.SELECT_YESNO, yes: false });
    else break;
  }
  console.log(JSON.stringify({ mats: mats.length, offered, field: sim.core.duelQuery(sim.h, { flags: 0x8000|1, controller: 1, location: 4, sequence: 1, overlaySequence: 0 }), trace, errors: sim.errors, last: sim.events.slice(-14).map(e => T[e.type]) }));
}
