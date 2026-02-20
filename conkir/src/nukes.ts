import { P, bld, unt, missiles, exp, own, ter, setBld, setUnt, addNotif, nextMid } from './state';
import { C } from './constants';
import { B, I } from './mapgen';
import type { NukeType } from './types';

export function doNuke(pi: number, nukeType: NukeType, targetX: number, targetY: number) {
  const p = P[pi]; if (!p || !p.alive) return;
  const cost = nukeType === 'a' ? C.naC : C.nhC;
  if (p.money < cost) return;
  const silos = bld.filter(b => b.ow === pi && b.type === 'silo');
  if (silos.length === 0) { addNotif(pi, 'Build a Missile Silo first!', '#E74C3C'); return; }
  p.money -= cost;
  let nearSilo = silos[0], nearD = 1e9;
  for (const s of silos) { const d = Math.hypot(s.x - targetX, s.y - targetY); if (d < nearD) { nearD = d; nearSilo = s; } }
  missiles.push({ id: nextMid(), pi, type: nukeType, x: nearSilo.x, y: nearSilo.y, tx: targetX, ty: targetY, hp: 100 });
}

export function procMissiles() {
  for (let mi = missiles.length - 1; mi >= 0; mi--) {
    const m = missiles[mi];
    const dx = m.tx - m.x, dy = m.ty - m.y, dist = Math.hypot(dx, dy);
    let samIntercepted = false;
    for (const b of bld) {
      if (b.type !== 'sam') continue;
      if (b.ow === m.pi) continue;
      if ((b.samCd || 0) > 0) { b.samCd!--; continue; }
      if (Math.hypot(b.x - m.x, b.y - m.y) < C.samRange) {
        b.samCd = C.samCooldown;
        samIntercepted = true;
        break;
      }
    }
    if (samIntercepted) {
      exp.push({ x: m.x, y: m.y, rad: 8, f: 0, mx: 20 });
      addNotif(m.pi, 'Missile intercepted by SAM! 🛡', '#E67E22');
      missiles.splice(mi, 1);
      continue;
    }
    if (dist < C.naSp) {
      detonateNuke(m.pi, m.type, m.tx, m.ty);
      missiles.splice(mi, 1);
    } else {
      m.x += dx / dist * C.naSp;
      m.y += dy / dist * C.naSp;
    }
  }
}

export function detonateNuke(pi: number, nukeType: NukeType, tx: number, ty: number) {
  const innerR = nukeType === 'a' ? C.naR : C.nhR;
  const outerR = nukeType === 'a' ? C.naRo : C.nhRo;
  const r2i = innerR * innerR, r2o = outerR * outerR;
  const tilesHit = new Map<number, number>();
  const totalTiles = new Map<number, number>();
  for (const p of P) if (p.alive) totalTiles.set(p.id, p.territory || 1);
  for (let dy = -outerR; dy <= outerR; dy++) for (let dx = -outerR; dx <= outerR; dx++) {
    const d2 = dx * dx + dy * dy; if (d2 > r2o) continue;
    const x = tx + dx, y = ty + dy; if (!B(x, y) || ter[I(x, y)] === 0) continue;
    const o = own[I(x, y)]; if (o < 0) continue;
    const hit = d2 <= r2i || Math.random() < 0.5;
    if (hit) { own[I(x, y)] = -1; tilesHit.set(o, (tilesHit.get(o) || 0) + 1); }
  }
  for (const [pid, killed] of tilesHit) {
    const p = P[pid]; if (!p?.alive) continue;
    const total = totalTiles.get(pid) || 1;
    const landPct = Math.min(1, killed / total);
    const mult = nukeType === 'h' ? 3.0 : 2.0;
    const troopsKilled = Math.min(p.troops, p.maxTroops * landPct * mult);
    p.troops = Math.max(0, p.troops - troopsKilled);
    p.maxTroops = Math.max(0, p.maxTroops - killed * C.mtT);
    addNotif(pid, `☢ Nuclear strike! Lost ${Math.round(troopsKilled)} troops!`, '#FF4500');
  }
  setBld(bld.filter(b => Math.hypot(b.x - tx, b.y - ty) > innerR));
  setUnt(unt.filter(u => Math.hypot(u.x - tx, u.y - ty) > innerR));
  exp.push({ x: tx, y: ty, rad: outerR, f: 0, mx: 40 });
  const ttlHit = Array.from(tilesHit.values()).reduce((a, b) => a + b, 0);
  addNotif(pi, `${nukeType === 'h' ? 'H-Bomb' : 'A-Bomb'} detonated! ${ttlHit} tiles! ☢`, '#F39C12');
}
