import { P, bld, own, setBld, addNotif, nextBid } from './state';
import { C } from './constants';
import { B, I, isCo, isL } from './mapgen';
import { fmt } from './ui';

export function cntT(pi: number) {
  let c = 0;
  for (let i = 0; i < own.length; i++) if (own[i] === pi) c++;
  return c;
}

export function buildB(pi: number, ty: string, x: number, y: number) {
  const p = P[pi];
  if (!p || !p.alive) return false;
  if (!B(x, y) || own[I(x, y)] !== pi) {
    let found = false;
    for (let r = 1; r <= 4 && !found; r++)
      for (let dy = -r; dy <= r && !found; dy++) for (let dx = -r; dx <= r && !found; dx++) {
        if (B(x + dx, y + dy) && own[I(x + dx, y + dy)] === pi) { x += dx; y += dy; found = true; }
      }
    if (!found) { addNotif(pi, 'Must build on your own territory!', '#E74C3C'); return false; }
  }
  const baseC = ty === 'city' ? C.ciC : ty === 'factory' ? C.faC : ty === 'port' ? C.poC : ty === 'silo' ? C.siloC : ty === 'fort' ? C.fortC : C.samC;
  const terScale = Math.min(5, 1 + p.territory / 600);
  const cost = Math.round(baseC * terScale);
  if (p.money < cost) { addNotif(pi, `Need $${fmt(cost)} to build ${ty} (have $${fmt(p.money | 0)})`, '#E74C3C'); return false; }
  let bx = x, by = y;
  if (ty === 'port') {
    if (!isCo(x, y)) {
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
          if (own[ni] === pi && isL(nx, ny)) {
            if (isCo(nx, ny)) { bx = nx; by = ny; found = true; break outer; }
            q.push({ x: nx, y: ny });
          }
        }
        if (vis.size > 3000) break;
      }
      if (!found) { addNotif(pi, 'No coastal tile found for Port!', '#E74C3C'); return false; }
    }
  }
  if (bld.some(b => Math.abs(b.x - bx) < 12 && Math.abs(b.y - by) < 12)) {
    addNotif(pi, 'Too close to another building!', '#E74C3C'); return false;
  }
  p.money -= cost;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bld.push({ id: nextBid(), type: ty as any, ow: pi, x: bx, y: by });
  return true;
}
