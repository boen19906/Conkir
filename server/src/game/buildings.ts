import type { GameState } from './state';
import { C } from './constants';
import { B, I, isCo, isL } from './mapgen';

function fmt(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'K';
  return (n | 0).toLocaleString();
}

export function cntT(gs: GameState, pi: number) {
  let c = 0;
  for (let i = 0; i < gs.own.length; i++) if (gs.own[i] === pi) c++;
  return c;
}

export function buildB(gs: GameState, pi: number, ty: string, x: number, y: number) {
  const p = gs.P[pi];
  if (!p || !p.alive) return false;
  if (!B(x, y) || gs.own[I(x, y)] !== pi) {
    let found = false;
    for (let r = 1; r <= 4 && !found; r++)
      for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) {
        if (B(x + dx, y + dy) && gs.own[I(x + dx, y + dy)] === pi) { x += dx; y += dy; found = true; }
      }
    if (!found) { gs.addNotif(pi, 'Must build on your own territory!', '#E74C3C'); return false; }
  }
  const baseC = ty === 'city' ? C.ciC : ty === 'factory' ? C.faC : ty === 'port' ? C.poC : ty === 'silo' ? C.siloC : ty === 'fort' ? C.fortC : C.samC;
  const terScale = Math.min(5, 1 + p.territory / 600);
  const cost = Math.round(baseC * terScale);
  if (p.money < cost) { gs.addNotif(pi, `Need $${fmt(cost)} to build ${ty} (have $${fmt(p.money | 0)})`, '#E74C3C'); return false; }
  let bx = x, by = y;
  if (ty === 'port') {
    if (!isCo(gs, x, y)) {
      let found = false;
      const vis = new Set([I(x, y)]);
      const q = [{ x, y }];
      outer: while (q.length) {
        const cur = q.shift()!;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          const nx = cur.x + dx, ny = cur.y + dy;
          if (!B(nx, ny)) continue;
          const ni = I(nx, ny);
          if (vis.has(ni)) continue;
          vis.add(ni);
          if (gs.own[ni] === pi && isL(gs, nx, ny)) {
            if (isCo(gs, nx, ny)) { bx = nx; by = ny; found = true; break outer; }
            q.push({ x: nx, y: ny });
          }
        }
        if (vis.size > 3000) break;
      }
      if (!found) { gs.addNotif(pi, 'No coastal tile found for Port!', '#E74C3C'); return false; }
    }
  }
  if (gs.bld.some(b => Math.abs(b.x - bx) < 12 && Math.abs(b.y - by) < 12)) {
    gs.addNotif(pi, 'Too close to another building!', '#E74C3C'); return false;
  }
  p.money -= cost;
  gs.bld.push({ id: gs.nextBid(), type: ty as any, ow: pi, x: bx, y: by });
  return true;
}
