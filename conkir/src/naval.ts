import { P, bld, unt, own, ter, addNotif, nextUid, nextTid, atkRatio, tk } from './state';
import { C, W, H } from './constants';
import { isW, isL, isCo, B, I } from './mapgen';
import { gD } from './diplomacy';

export function waterBFS(sx: number, sy: number, gx: number, gy: number): number[] | null {
  if (!isW(sx, sy)) {
    let snapped = false;
    for (let r = 1; r <= 8 && !snapped; r++)
      for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r], [-r, -r], [r, -r], [-r, r], [r, r]])
        if (isW(sx + dx, sy + dy) && B(sx + dx, sy + dy)) { sx += dx; sy += dy; snapped = true; break; }
    if (!snapped) return null;
  }
  if (!isW(gx, gy)) {
    let snapped = false;
    for (let r = 1; r <= 8 && !snapped; r++)
      for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r], [-r, -r], [r, -r], [-r, r], [r, r]])
        if (isW(gx + dx, gy + dy) && B(gx + dx, gy + dy)) { gx += dx; gy += dy; snapped = true; break; }
    if (!snapped) return null;
  }
  const startI = I(sx, sy), goalI = I(gx, gy);
  if (startI === goalI) return [];
  const prev = new Map<number, number | null>([[startI, null]]);
  const q = [startI];
  let found = false;
  while (q.length) {
    const cur = q.shift()!;
    if (cur === goalI) { found = true; break; }
    const cx = cur % W, cy = (cur / W) | 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (!B(nx, ny)) continue;
      const ni = I(nx, ny);
      if (prev.has(ni) || !isW(nx, ny)) continue;
      prev.set(ni, cur); q.push(ni);
    }
  }
  if (!found) return null;
  const path: number[] = [];
  let cur: number | null | undefined = goalI;
  while (cur !== null && cur !== undefined) { path.push(cur); cur = prev.get(cur); }
  path.reverse(); path.shift();
  return path;
}

export function spawnTradeShips() {
  if (tk % C.tradeSpawnInterval !== 0) return;
  const ports = bld.filter(b => b.type === 'port');
  for (const srcPort of ports) {
    const srcPi = srcPort.ow;
    const destCandidates = ports.filter(p => {
      if (p.ow === srcPi) return false;
      if (gD(srcPi, p.ow) === 'war') return false;
      if (unt.some(u => u.ty === 'tr' && u.srcPort === srcPort.id && u.dstPort === p.id)) return false;
      return true;
    });
    if (destCandidates.length === 0) continue;
    destCandidates.sort((a, b) => Math.hypot(b.x - srcPort.x, b.y - srcPort.y) - Math.hypot(a.x - srcPort.x, a.y - srcPort.y));
    const dst = destCandidates[Math.random() * Math.min(3, destCandidates.length) | 0];
    let sx: number | null = null, sy: number | null = null;
    for (let r = 1; r < 25 && sx === null; r++)
      for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r], [-r, -r], [r, -r], [-r, r], [r, r]])
        if (isW(srcPort.x + dx, srcPort.y + dy) && B(srcPort.x + dx, srcPort.y + dy)) { sx = srcPort.x + dx; sy = srcPort.y + dy; }
    if (sx === null) continue;
    let dwx: number | null = null, dwy: number | null = null;
    for (let r2 = 1; r2 < 20 && dwx === null; r2++)
      for (const [ddx, ddy] of [[-r2, 0], [r2, 0], [0, -r2], [0, r2], [-r2, -r2], [r2, -r2], [-r2, r2], [r2, r2]])
        if (isW(dst.x + ddx, dst.y + ddy) && B(dst.x + ddx, dst.y + ddy)) { dwx = dst.x + ddx; dwy = dst.y + ddy; }
    if (dwx === null) continue;
    const dist = Math.abs(dst.x - srcPort.x) + Math.abs(dst.y - srcPort.y);
    unt.push({ id: nextUid(), tid: nextTid(), ty: 'tr', ow: srcPi, x: sx, y: sy!, tx: dwx, ty2: dwy!, srcPort: srcPort.id, dstPort: dst.id, dstOwner: dst.ow, dist, hp: 999, stuck: 0 });
  }
}

export function updTradeShips() {
  for (let i = unt.length - 1; i >= 0; i--) {
    const s = unt[i]; if (s.ty !== 'tr') continue;
    const dstPort = bld.find(b => b.id === s.dstPort);
    if (!dstPort || dstPort.ow === s.ow) { unt.splice(i, 1); continue; }
    const distToPort = Math.hypot((s.tx || 0) - s.x, (s.ty2 || 0) - s.y);
    if (distToPort < 5) {
      const gold = C.tradeBase + C.tradeDistMult * Math.pow(s.dist || 0, 1.1);
      const srcP = P[s.ow];
      const currentDstOwner = dstPort.ow;
      const dstP = P[currentDstOwner];
      if (srcP?.alive) srcP.money += gold;
      if (dstP?.alive && currentDstOwner !== s.ow) dstP.money += gold;
      addNotif(s.ow, `⚓ Trade arrived! +$${Math.round(gold)}`, '#F39C12');
      if (currentDstOwner !== s.ow) addNotif(currentDstOwner, `⚓ Trade arrived! +$${Math.round(gold)}`, '#F39C12');
      unt.splice(i, 1); continue;
    }
    let nearShore = false;
    for (let sr = 1; sr <= 6 && !nearShore; sr++)
      for (const [dx, dy] of [[-sr, 0], [sr, 0], [0, -sr], [0, sr]])
        if (isL((s.x + dx) | 0, (s.y + dy) | 0)) { nearShore = true; break; }
    s.safe = nearShore;
    if (!s.path || s.path.length === 0) {
      const path = waterBFS(s.x | 0, s.y | 0, (s.tx || 0) | 0, (s.ty2 || 0) | 0);
      if (!path) { unt.splice(i, 1); continue; }
      s.path = path;
    }
    if (s.path.length > 0) {
      const ni = s.path[0];
      const wx = ni % W, wy = (ni / W) | 0;
      const dx = wx - s.x, dy = wy - s.y, d = Math.hypot(dx, dy);
      if (d <= C.tradeSpd) { s.x = wx; s.y = wy; s.path.shift(); }
      else { s.x += dx / d * C.tradeSpd; s.y += dy / d * C.tradeSpd; }
    }
  }
}

export function spShip(pi: number, clickWx: number, clickWy: number) {
  const p = P[pi];
  const shipScale = Math.min(5, 1 + p.territory / 600);
  const shCost = Math.round(C.shC * shipScale);
  if (!p || !p.alive || p.money < shCost) return false;
  const ports = bld.filter(b => b.ow === pi && b.type === 'port');
  if (ports.length === 0) return false;
  let bp = ports[0], bd2 = 1e9;
  for (const port of ports) { const d = Math.hypot(port.x - clickWx, port.y - clickWy); if (d < bd2) { bd2 = d; bp = port; } }
  let sx: number | null = null, sy: number | null = null;
  for (let r = 1; r < 30 && sx === null; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
      const nx = bp.x + dx, ny = bp.y + dy;
      if (isW(nx, ny)) { sx = nx; sy = ny; }
    }
    if (sx !== null) break;
  }
  if (sx === null) return false;
  p.money -= shCost;
  unt.push({ id: nextUid(), ty: 'w', ow: pi, x: sx, y: sy!, tx: null, ty2: null, hp: 100, cd: 0, stuck: 0 });
  return true;
}

export function navInv(pi: number, tx: number, ty: number) {
  const p = P[pi]; if (!p || !p.alive) return;
  let bx = -1, by = 0, bd2 = 1e9;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    if (own[I(x, y)] !== pi || !isCo(x, y)) continue;
    const d = Math.hypot(x - tx, y - ty);
    if (d < bd2) { bd2 = d; bx = x; by = y; }
  }
  if (bx < 0) return;
  let spawnX: number | null = null, spawnY: number | null = null;
  for (let r = 1; r < 15 && spawnX === null; r++)
    for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r], [-r, -1], [r, -1], [-r, 1], [r, 1], [-1, -r], [1, -r], [-1, r], [1, r]])
      if (isW(bx + dx, by + dy) && B(bx + dx, by + dy)) { spawnX = bx + dx; spawnY = by + dy; break; }
  if (spawnX === null) return;
  let navX: number | null = null, navY: number | null = null, navDist = 1e9;
  for (let r = 0; r <= Math.max(W, H); r += 1) {
    const x0 = Math.max(0, tx - r), x1 = Math.min(W - 1, tx + r);
    const y0 = Math.max(0, ty - r), y1 = Math.min(H - 1, ty + r);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!isW(x, y)) continue;
      let adjEnemy = false;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (B(nx, ny) && isL(nx, ny) && own[I(nx, ny)] !== pi) { adjEnemy = true; break; }
      }
      if (!adjEnemy) continue;
      const d = Math.hypot(x - tx, y - ty);
      if (d < navDist) { navDist = d; navX = x; navY = y; }
    }
    if (navX !== null && r > 5) break;
  }
  if (navX === null) { navX = tx; navY = ty; }
  const path = waterBFS(spawnX, spawnY!, navX, navY!);
  if (path === null) { addNotif(pi, 'Naval invasion: no water route to target! 🚢', '#E74C3C'); return; }
  const tr = p.troops * atkRatio; if (tr < 10) return;
  p.troops -= tr;
  unt.push({ id: nextUid(), ty: 't', ow: pi, x: spawnX, y: spawnY!, tx: navX, ty2: navY!, hp: 1, tr, stuck: 0, path });
}

export function needsNaval(pi: number, tx: number, ty: number) {
  const visited = new Set<number>(); const queue = [I(tx, ty)]; visited.add(queue[0]);
  let steps = 0; const maxSteps = 2000;
  while (queue.length > 0 && steps < maxSteps) {
    steps++; const ni = queue.shift()!;
    const x = ni % W, y = (ni / W) | 0;
    if (own[ni] === pi) return false;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = x + dx, ny = y + dy; if (!B(nx, ny)) continue;
      const nni = I(nx, ny); if (!visited.has(nni) && ter[nni] > 0) { visited.add(nni); queue.push(nni); }
    }
  }
  return true;
}

