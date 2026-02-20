import type { GameState } from './state';
import { C, W } from './constants';
import { isW, isL, B, I } from './mapgen';
import { gD } from './diplomacy';
import { mkWave } from './waves';

export function isDeepW(gs: GameState, x: number, y: number) {
  if (!isW(gs, x, y)) return false;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (isL(gs, x + dx, y + dy)) return false;
  return true;
}

export function updUnits(gs: GameState) {
  const shipArr = gs.unt.filter(u => u.ty === 'w');
  for (const s of gs.unt) {
    if (s.ty === 't') {
      let adjEnemyLand = false;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = (s.x + dx) | 0, ny = (s.y + dy) | 0;
        if (!isL(gs, nx, ny)) continue;
        if (gs.own[I(nx, ny)] !== s.ow) adjEnemyLand = true;
      }
      const distToTarget = Math.hypot(s.x - (s.tx || 0), s.y - (s.ty2 || 0));
      const tgtOwner = gs.own[I((s.tx || 0) | 0, (s.ty2 || 0) | 0)];
      if (distToTarget < 15 && tgtOwner === s.ow) { gs.P[s.ow].troops += s.tr || 0; s.hp = 0; continue; }
      const nearDest = distToTarget < 30;
      if (adjEnemyLand && nearDest) {
        let lx = -1, ly = -1;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const nx = (s.x + dx) | 0, ny = (s.y + dy) | 0;
          if (isL(gs, nx, ny) && gs.own[I(nx, ny)] !== s.ow) { lx = nx; ly = ny; break; }
        }
        if (lx >= 0) { gs.own[I(lx, ly)] = s.ow; mkWave(gs, s.ow, lx, ly, s.tr || 100, null); }
        s.hp = 0; continue;
      }
      if (!s.path || s.path.length === 0) {
        s.stuck = (s.stuck || 0) + 1;
        if ((s.stuck || 0) > 200) { gs.P[s.ow].troops += s.tr || 0; s.hp = 0; }
        continue;
      }
      const ni = s.path[0];
      const wx = ni % W, wy = (ni / W) | 0;
      const ddx2 = wx - s.x, ddy2 = wy - s.y, dd = Math.hypot(ddx2, ddy2);
      if (dd <= 1.8) { s.x = wx; s.y = wy; s.path.shift(); }
      else { s.x += ddx2 / dd * 1.8; s.y += ddy2 / dd * 1.8; }
      continue;
    }
    if (s.ty !== 'w') continue;
    s.cd = Math.max(0, (s.cd || 0) - 1);
    let ne: typeof gs.unt[0] | null = null, nd = 1e9;
    for (const o of gs.unt) {
      if (o.ow === s.ow) continue;
      if (o.ty === 'tr') continue;
      if (gD(gs, s.ow, o.ow) === 'peace') continue;
      const d = Math.hypot(o.x - s.x, o.y - s.y);
      if (d < nd) { nd = d; ne = o; }
    }
    if (ne && nd < C.bulletRange && s.cd! <= 0) {
      gs.bullets.push({ x: s.x, y: s.y, tx: ne.x, ty: ne.y, tid: ne.id, ow: s.ow, spd: C.bulletSpd, dmg: C.bulletDmg });
      s.cd = 18;
    }
    for (let ti = gs.unt.length - 1; ti >= 0; ti--) {
      const tr = gs.unt[ti];
      if (tr.ty !== 'tr' || tr.ow === s.ow || tr.safe) continue;
      if (gD(gs, s.ow, tr.ow) === 'peace') continue;
      if (Math.hypot(tr.x - s.x, tr.y - s.y) < 8) {
        const gold = C.tradeBase + C.tradeDistMult * Math.pow(tr.dist || 0, 1.1) * 0.5;
        if (gs.P[s.ow]?.alive) gs.P[s.ow].money += gold;
        gs.addNotif(s.ow, `🏴‍☠️ Captured trade ship! +$${Math.round(gold)}`, '#F39C12');
        gs.unt.splice(ti, 1);
      }
    }
    let destX: number, destY: number;
    if (ne && nd < 120) { destX = ne.x; destY = ne.y; }
    else {
      if (!s.tx || !isW(gs, (s.tx) | 0, (s.ty2 || 0) | 0) || Math.hypot(s.tx - s.x, (s.ty2 || 0) - s.y) < 6) {
        s.tx = null;
        for (let att = 0; att < 40; att++) {
          const wx = (s.x + (Math.random() - .5) * 100) | 0;
          const wy = (s.y + (Math.random() - .5) * 100) | 0;
          if (isDeepW(gs, wx, wy)) { s.tx = wx; s.ty2 = wy; break; }
        }
        if (!s.tx) { for (let att = 0; att < 40; att++) { const wx = (s.x + (Math.random() - .5) * 60) | 0; const wy = (s.y + (Math.random() - .5) * 60) | 0; if (isW(gs, wx, wy)) { s.tx = wx; s.ty2 = wy; break; } } }
      }
      if (s.tx) { destX = s.tx; destY = s.ty2!; } else { destX = s.x; destY = s.y; }
    }
    let sepX = 0, sepY = 0;
    const SEP = 6;
    for (const o of shipArr) {
      if (o.id === s.id) continue;
      const dx = s.x - o.x, dy = s.y - o.y, d = Math.hypot(dx, dy);
      if (d < SEP && d > 0.01) { sepX += dx / d * (SEP - d); sepY += dy / d * (SEP - d); }
    }
    const baseAng = Math.atan2(destY - s.y, destX - s.x);
    let angles: number[];
    if (sepX !== 0 || sepY !== 0) {
      const sAng = Math.atan2(sepY, sepX);
      angles = [sAng, baseAng, baseAng + .5, baseAng - .5, baseAng + 1, baseAng - 1, baseAng + 1.5, baseAng - 1.5];
    } else {
      angles = [baseAng, baseAng + .4, baseAng - .4, baseAng + .8, baseAng - .8, baseAng + 1.3, baseAng - 1.3];
    }
    let moved = false;
    for (const a of angles) {
      const nx = s.x + Math.cos(a) * C.shS, ny = s.y + Math.sin(a) * C.shS;
      if (!isW(gs, nx | 0, ny | 0)) continue;
      let blocked = false;
      for (const o of shipArr) { if (o.id === s.id) continue; if (Math.hypot(nx - o.x, ny - o.y) < SEP - 1) { blocked = true; break; } }
      if (!blocked) { s.x = nx; s.y = ny; moved = true; s.stuck = 0; break; }
    }
    if (!moved) {
      s.stuck = (s.stuck || 0) + 1; s.tx = null;
      if (sepX !== 0 || sepY !== 0) {
        const sm = Math.hypot(sepX, sepY);
        const nx = s.x + sepX / sm * C.shS, ny = s.y + sepY / sm * C.shS;
        if (isW(gs, nx | 0, ny | 0)) { s.x = nx; s.y = ny; s.stuck = 0; }
      }
      if ((s.stuck || 0) > 120) {
        for (let r = 1; r < 20; r++) for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r]]) {
          const nx = s.x + dx, ny = s.y + dy;
          if (isDeepW(gs, nx | 0, ny | 0)) { s.x = nx; s.y = ny; s.stuck = 0; r = 99; break; }
        }
      }
    }
  }
  for (let i = gs.unt.length - 1; i >= 0; i--) { if (gs.unt[i].hp <= 0) gs.unt.splice(i, 1); }
}

export function updBullets(gs: GameState) {
  for (let i = gs.bullets.length - 1; i >= 0; i--) {
    const b = gs.bullets[i];
    const tgt = gs.unt.find(u => u.id === b.tid);
    if (!tgt) { gs.bullets.splice(i, 1); continue; }
    if (tgt.ty === 'tr') { gs.bullets.splice(i, 1); continue; }
    const dx = tgt.x - b.x, dy = tgt.y - b.y, d = Math.hypot(dx, dy);
    if (d < b.spd + 2) { tgt.hp -= b.dmg; gs.bullets.splice(i, 1); continue; }
    b.x += dx / d * b.spd; b.y += dy / d * b.spd;
    if (d > C.bulletRange * 2.5) gs.bullets.splice(i, 1);
  }
}
