import { P, own, ter, bld, wav, tk, setWav, addNotif, nextWid } from './state';
import { C, W, H } from './constants';

const _encVis = new Uint8Array(W * H);
import { B, I } from './mapgen';
import { FlatBinaryHeap } from './heap';
import { gD, getDefenseMultiplier, addConflict } from './diplomacy';

function openFrontPriority(ni: number, pi: number, tickNow: number) {
  const x = ni % W, y = (ni / W) | 0;
  let numOwnedByMe = 0;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const nx = x + dx, ny = y + dy;
    if (B(nx, ny) && own[I(nx, ny)] === pi) numOwnedByMe++;
  }
  // Strongly prefer enclosed/surrounded tiles (prevents speckles).
  // Each additional owned neighbor drops priority by 8 units, guaranteeing enclosed
  // tiles are always processed before frontier tiles regardless of tick ordering.
  // Tiny noise (0-1) keeps borders visually natural.
  return tickNow - numOwnedByMe * 8 + Math.random();
}

export function waveCanClaim(pi: number, tileOwner: number, targetOwner: number | null) {
  if (tileOwner === pi) return false;
  if (targetOwner === null) {
    if (tileOwner >= 0 && gD(pi, tileOwner) === 'peace') return false;
    return true;
  }
  if (targetOwner === -1) return tileOwner === -1;
  return tileOwner === targetOwner;
}

export function mkWave(pi: number, cx: number, cy: number, tr: number, targetOwner: number | null) {
  const p = P[pi]; if (!p || !p.alive || tr < 1) return;
  const a = Math.min(tr, p.troops); if (a < 1) return;
  p.troops -= a;

  const heap = new FlatBinaryHeap();
  const inHeap = new Set<number>();
  const sr = 150;
  for (let y = Math.max(0, cy - sr); y < Math.min(H, cy + sr); y++)
    for (let x = Math.max(0, cx - sr); x < Math.min(W, cx + sr); x++) {
      if (own[I(x, y)] !== pi) continue;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (!B(nx, ny)) continue;
        const ni = I(nx, ny);
        if (ter[ni] === 0) continue;
        const no = own[ni];
        if (no === pi) continue;
        if (!waveCanClaim(pi, no, targetOwner)) continue;
        if (!inHeap.has(ni)) { inHeap.add(ni); heap.enqueue(ni, openFrontPriority(ni, pi, tk)); }
      }
    }

  if (heap.size() === 0) { p.troops += a; return; }

  for (const w of wav) {
    if (w.pi !== pi || w.targetOwner !== targetOwner) continue;
    let overlap = false;
    for (const ni of inHeap) {
      if (w.inHeap.has(ni)) { overlap = true; break; }
      const x2 = ni % W, y2 = (ni / W) | 0;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        if (w.inHeap.has(I(x2 + dx, y2 + dy))) { overlap = true; break; }
      }
      if (overlap) break;
    }
    if (overlap) {
      w.troops += a;
      for (const ni of inHeap) if (!w.inHeap.has(ni)) { w.inHeap.add(ni); w.heap.enqueue(ni, openFrontPriority(ni, pi, tk)); }
      return;
    }
  }

  wav.push({ pi, troops: a, heap, inHeap, id: nextWid(), targetOwner, _pressing: new Set() });
}

export function procWaves() {
  for (const w of wav) {
    w._pressing = new Set();
    for (const ni of w.inHeap) {
      const o = own[ni];
      if (o >= 0 && o !== w.pi) w._pressing.add(o);
    }
  }

  const processed = new Set<string>();
  for (const wA of wav) {
    for (const wB of wav) {
      if (wA === wB || wA.pi === wB.pi) continue;
      const key = wA.pi < wB.pi ? `${wA.pi}:${wB.pi}` : `${wB.pi}:${wA.pi}`;
      if (processed.has(key)) continue;
      if (!wA._pressing.has(wB.pi) || !wB._pressing.has(wA.pi)) continue;
      processed.add(key);
      const cancel = Math.min(wA.troops, wB.troops);
      wA.troops -= cancel;
      wB.troops -= cancel;
    }
  }

  setWav(wav.filter(w => w.troops > 0 && w.heap.size() > 0 && P[w.pi]?.alive));

  for (let wi = wav.length - 1; wi >= 0; wi--) {
    const w = wav[wi];
    if (w.troops <= 0 || w.heap.size() === 0) { wav.splice(wi, 1); continue; }

    const tpt = C.tilesPerTick;
    let cl = 0, fortCapCount = 0;

    while (w.heap.size() > 0 && cl < tpt && w.troops > 0) {
      const ni = w.heap.dequeue();
      if (ni === null) break;

      if (!w.inHeap.has(ni)) continue;
      w.inHeap.delete(ni);

      if (ter[ni] === 0) continue;
      const tileOwner = own[ni];
      if (tileOwner === w.pi) continue;
      if (!waveCanClaim(w.pi, tileOwner, w.targetOwner)) continue;

      const tx = ni % W, ty = (ni / W) | 0;
      let onBorder = false;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        if (B(tx + dx, ty + dy) && own[I(tx + dx, ty + dy)] === w.pi) { onBorder = true; break; }
      }
      if (!onBorder) continue;

      let fortMult = 1.0, fortCapping = false;
      if (tileOwner >= 0) {
        for (const fb of bld) {
          if (fb.type !== 'fort' || fb.ow !== tileOwner) continue;
          if (Math.hypot(fb.x - tx, fb.y - ty) <= C.fortRange) { fortMult = C.fortMult; fortCapping = true; break; }
        }
        if (fortCapping && fortCapCount >= 12) break;
      }

      const cost = (tileOwner >= 0) ? C.atkBase * 0.8 * fortMult : C.unclaimedCost;
      if (w.troops < cost) continue;
      w.troops -= cost;

      if (tileOwner >= 0) {
        const def = P[tileOwner];
        if (def?.alive && def.territory > 0) {
          const density = def.troops / def.territory;
          const debuff = getDefenseMultiplier(tileOwner);
          def.troops = Math.max(0, def.troops - density * C.defLoss / debuff);
        }
      }
      if (fortCapping) fortCapCount++;

      const prevOwner = tileOwner;
      own[ni] = w.pi;
      if (prevOwner >= 0 && P[prevOwner]?.alive) P[prevOwner].territory = Math.max(0, P[prevOwner].territory - 1);
      if (P[w.pi]?.alive) P[w.pi].territory++;
      if (prevOwner >= 0) addConflict(prevOwner, w.pi, 1);

      for (const b of bld) {
        if (b.x !== tx || b.y !== ty) continue;
        b.ow = w.pi;
        const bnames: Record<string, string> = { city: '🏙 City', factory: '🏭 Factory', port: '⚓ Port', sam: '🛡 SAM', silo: '🚀 Silo', fort: '🏰 Defense Post' };
        if (bnames[b.type]) addNotif(w.pi, `Captured ${bnames[b.type]}!`, '#2ECC71');
      }
      cl++;

      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = tx + dx, ny = ty + dy;
        if (!B(nx, ny)) continue;
        const nni = I(nx, ny);
        if (ter[nni] === 0) continue;
        const o2 = own[nni];
        if (o2 === w.pi) continue;
        if (!waveCanClaim(w.pi, o2, w.targetOwner)) continue;
        if (w.inHeap.has(nni)) continue;
        w.inHeap.add(nni);
        w.heap.enqueue(nni, openFrontPriority(nni, w.pi, tk));
      }
    }

    if (w.troops <= 0 || w.heap.size() === 0) {
      if (w.troops > 0 && P[w.pi]?.alive) P[w.pi].troops += w.troops;
      wav.splice(wi, 1);
    }
  }

  // Encirclement (every 5 ticks): flood-fill enclosed unclaimed pockets + isolated enemy tiles
  if (tk % 5 === 0) {
    // Pass 1: flood-fill enclosed unclaimed regions (fixes multi-tile craters)
    _encVis.fill(0);
    const vis = _encVis;
    for (let s = 0; s < W * H; s++) {
      if (ter[s] === 0 || own[s] !== -1 || vis[s]) continue;
      const region: number[] = [];
      const q: number[] = [s];
      vis[s] = 1;
      let captor = -1, enclosed = true;
      outer: while (q.length) {
        const ci = q.pop()!;
        region.push(ci);
        if (region.length > 60) { enclosed = false; break; }
        const cx = ci % W, cy = (ci / W) | 0;
        for (const [ddx, ddy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nnx = cx + ddx, nny = cy + ddy;
          if (!B(nnx, nny)) { enclosed = false; break outer; }
          const nni = I(nnx, nny);
          if (ter[nni] === 0) continue;
          const no = own[nni];
          if (no === -1) { if (!vis[nni]) { vis[nni] = 1; q.push(nni); } }
          else if (no >= 0) {
            if (captor < 0) captor = no;
            else if (captor !== no) { enclosed = false; break outer; }
          }
        }
      }
      if (enclosed && captor >= 0 && region.length > 0) {
        for (const ri of region) { own[ri] = captor; if (P[captor]?.alive) P[captor].territory++; }
      }
    }
    // Pass 2: isolated enemy tiles fully surrounded by one player
    for (let i = 0; i < W * H; i++) {
      if (ter[i] === 0 || own[i] < 0) continue;
      const o = own[i];
      let captor = -99, landCount = 0, allSame = true;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (!B(nx, ny)) continue;
        const nni = I(nx, ny);
        if (ter[nni] === 0) continue;
        landCount++;
        const no = own[nni];
        if (no < 0) { allSame = false; break; }
        if (captor === -99) captor = no;
        else if (no !== captor) { allSame = false; break; }
      }
      if (!allSame || captor < 0 || captor === o || landCount < 2) continue;
      if (gD(captor, o) !== 'peace') {
        own[i] = captor;
        if (P[o]?.alive) P[o].territory = Math.max(0, P[o].territory - 1);
        if (P[captor]?.alive) P[captor].territory++;
      }
    }
  }
}
