import type { GameState } from './state';
import { C } from './constants';
import { cntT } from './buildings';
import { procWaves } from './waves';
import { procMissiles } from './nukes';
import { spawnTradeShips, updTradeShips } from './naval';
import { updUnits, updBullets } from './units';
import { decayConflict } from './diplomacy';

export function gameTick(gs: GameState) {
  gs.tk++;
  procWaves(gs);
  procMissiles(gs);
  gs.notifs = gs.notifs.filter(n => { n.ttl--; return n.ttl > 0; });
  if (gs.tk % 50 === 0) decayConflict(gs);
  for (const [pi, tks] of gs.betrayalDebuff) {
    if (tks <= 1) gs.betrayalDebuff.delete(pi);
    else gs.betrayalDebuff.set(pi, tks - 1);
  }
  if (gs.tk === 1 || gs.tk % 10 === 0) {
    for (const p of gs.P) {
      if (!p.alive) continue;
      p.territory = cntT(gs, p.id);
      const ci = gs.bld.filter(b => b.ow === p.id && b.type === 'city');
      p.maxTroops = p.territory * C.mtT + ci.length * C.ciB;
      p.troops = Math.min(p.troops, p.maxTroops);
      const pop = p.troops, mx = p.maxTroops || 1;
      const r = Math.max(pop / mx, 0.001);
      const g = Math.max(0, 1.5 * Math.pow(mx, 0.6) * Math.pow(r, 0.3) * (1 - r));
      p.growth = g;
      p.troops = Math.min(p.troops + g, p.maxTroops);
      const fa = gs.bld.filter(b => b.ow === p.id && b.type === 'factory');
      p.income = fa.length * C.faI + p.territory * 0.05;
      p.money += p.income;
    }
  }
  if (gs.tk % 5 === 0 && gs.tk % 10 !== 0) for (const p of gs.P) if (p.alive) p.territory = cntT(gs, p.id);
  spawnTradeShips(gs);
  updTradeShips(gs);
  updUnits(gs);
  updBullets(gs);
  for (const e of gs.exp) e.f++;
  gs.exp = gs.exp.filter(e => e.f < e.mx);
  if (gs.tk > 50) {
    for (const p of gs.P) {
      if (!p.alive || p.territory > 0) continue;
      p.alive = false;
      gs.bld = gs.bld.filter(b => b.ow !== p.id);
      gs.unt = gs.unt.filter(u => u.ow !== p.id);
      gs.wav = gs.wav.filter(w => w.pi !== p.id);
    }
    // Victory check is handled in GameRoom.tick() — no DOM code here
  }
}
