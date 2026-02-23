import {
  P, bld, unt, wav, exp, notifs,
  setExp, setBld, setUnt, setWav, setNotifs,
  incTk, tk, victoryShown, setVictoryShown, onVictory,
  betrayalDebuff
} from './state';
import { C } from './constants';
import { cntT } from './buildings';
import { procWaves } from './waves';
import { procMissiles } from './nukes';
import { spawnTradeShips, updTradeShips } from './naval';
import { updUnits, updBullets } from './units';
import { decayConflict } from './diplomacy';

export function gameTick() {
  incTk();
  procWaves();
  procMissiles();
  setNotifs(notifs.filter(n => { n.ttl--; return n.ttl > 0; }));
  if (tk % 50 === 0) decayConflict();
  for (const [pi, tks] of betrayalDebuff) {
    if (tks <= 1) betrayalDebuff.delete(pi);
    else betrayalDebuff.set(pi, tks - 1);
  }
  if (tk === 1 || tk % 10 === 0) {
    for (const p of P) {
      if (!p.alive) continue;
      p.territory = cntT(p.id);
      const ci = bld.filter(b => b.ow === p.id && b.type === 'city');
      p.maxTroops = p.territory * C.mtT + ci.length * C.ciB;
      p.troops = Math.min(p.troops, p.maxTroops);
      const pop = p.troops, mx = p.maxTroops || 1;
      const r = Math.max(pop / mx, 0.001);
      const g = Math.max(0, 1.5 * Math.pow(mx, 0.6) * Math.pow(r, 0.3) * (1 - r));
      p.growth = g;
      p.troops = Math.min(p.troops + g, p.maxTroops);
      const fa = bld.filter(b => b.ow === p.id && b.type === 'factory');
      p.income = fa.length * C.faI + p.territory * 0.05;
      p.money += p.income;
    }
  }
  if (tk % 5 === 0 && tk % 10 !== 0) for (const p of P) if (p.alive) p.territory = cntT(p.id);
  spawnTradeShips();
  updTradeShips();
  updUnits();
  updBullets();
  for (const e of exp) e.f++;
  setExp(exp.filter(e => e.f < e.mx));
  if (tk > 50) {
    const totalClaimed = P.reduce((s, p) => s + (p.alive ? p.territory : 0), 0) || 1;
    for (const p of P) {
      if (!p.alive || p.territory / totalClaimed >= 0.0005) continue;
      p.alive = false;
      setBld(bld.filter(b => b.ow !== p.id));
      setUnt(unt.filter(u => u.ow !== p.id));
      setWav(wav.filter(w => w.pi !== p.id));
    }
    if (!victoryShown) {
      const totalClaimed = P.reduce((s, p) => s + (p.alive ? p.territory : 0), 0) || 1;
      for (const p of P) {
        if (!p.alive) continue;
        if (p.territory / totalClaimed >= 0.9) {
          setVictoryShown(true);
          onVictory?.(p);
          break;
        }
      }
    }
  }
}
