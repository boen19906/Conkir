import { P, own, ter, bld, wav, tk, addNotif, betrayalDebuff } from './state';
import { BC, C, W, H } from './constants';
import { B, I, isL, isW, isCo } from './mapgen';
import { gD, sD, proposePeace } from './diplomacy';
import { mkWave } from './waves';
import { navInv, needsNaval, spShip } from './naval';
import { doNuke } from './nukes';
import { buildB } from './buildings';
import type { BotConfig, IBot } from './types';

export class Bot implements IBot {
  pi: number;
  c: BotConfig;
  le: number; lb: number; ln: number; ls: number; lnv: number;
  bCache: Array<{ x: number; y: number }>;
  bTk: number;

  constructor(pi: number) {
    this.pi = pi;
    this.c = BC[P[pi].df] || BC[1];
    this.le = -pi * 7; this.lb = -pi * 21; this.ln = -pi * 35; this.ls = -pi * 28; this.lnv = -pi * 42;
    this.bCache = []; this.bTk = -1;
  }

  u() {
    const p = P[this.pi], c = this.c; if (!p.alive) return;
    if (c.tm > 1 && tk % 10 === 0) { p.maxTroops *= c.tm; p.troops = Math.min(p.troops + (c.tm - 1) * p.growth, p.maxTroops); p.maxTroops /= c.tm; }
    if (c.mm > 1 && tk % 10 === 0) p.money += (c.mm - 1) * p.income;
    if (tk - this.le >= c.ef) { this.ex(); this.le = tk; }
    if (tk - this.lb >= c.bf) { this.bu(); this.lb = tk; }
    if (c.nk && c.nf > 0 && tk - this.ln >= c.nf) { this.nu(); this.ln = tk; }
    if (c.sf > 0 && tk - this.ls >= c.sf) { this.sh(); this.ls = tk; }
    if (c.nvf > 0 && tk - this.lnv >= c.nvf) { this.nv(); this.lnv = tk; }
    if (tk % 300 === 0) this.checkBetray();
    if (tk % 200 === 0) this.checkProposePeace();
  }

  checkProposePeace() {
    const p = P[this.pi];
    for (let i = 0; i < P.length; i++) {
      if (i === this.pi || !P[i].alive || gD(this.pi, i) !== 'war') continue;
      const them = P[i];
      const sharedEnemies = P.filter((_, ei) => ei !== this.pi && ei !== i && P[ei]?.alive && gD(this.pi, ei) === 'war' && gD(i, ei) === 'war').length > 0;
      const weLosing = p.territory < them.territory * 0.5;
      const similar = p.territory > them.territory * 0.4 && p.territory < them.territory * 2.5;
      const proposeChance = (sharedEnemies ? 0.25 : 0) + (weLosing ? 0.30 : 0) + (similar ? 0.05 : 0);
      if (Math.random() < proposeChance) {
        proposePeace(this.pi, i);
      }
    }
  }

  checkBetray() {
    const p = P[this.pi];
    for (let i = 0; i < P.length; i++) {
      if (i === this.pi || !P[i].alive || gD(this.pi, i) !== 'peace') continue;
      const them = P[i];
      const weStronger = p.territory > them.territory * 1.4;
      const betrayChance = this.c.ag * (weStronger ? 0.12 : 0.02);
      if (Math.random() < betrayChance) {
        sD(this.pi, i, 'war', true);
        betrayalDebuff.set(this.pi, (betrayalDebuff.get(this.pi) || 0) + 1200);
        addNotif(i, `${p.name} betrayed the peace treaty! 🗡`, '#E74C3C');
      }
    }
  }

  getBorder() {
    if (tk - this.bTk < 15 && this.bCache.length > 0) return this.bCache;
    const b: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      if (own[I(x, y)] !== this.pi) continue;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (B(nx, ny) && ter[I(nx, ny)] > 0 && own[I(nx, ny)] !== this.pi) { b.push({ x, y }); break; }
      }
    }
    this.bCache = b; this.bTk = tk; return b;
  }

  getCentroid() {
    let cx = 0, cy = 0, cn = 0;
    for (let y = 0; y < H; y += 6) for (let x = 0; x < W; x += 6) if (own[I(x, y)] === this.pi) { cx += x; cy += y; cn++; }
    if (!cn) return null; return { x: (cx / cn) | 0, y: (cy / cn) | 0 };
  }

  ex() {
    const p = P[this.pi]; if (!p.alive) return;
    const attackersOnUs = wav.filter(w => w.targetOwner === this.pi && P[w.pi]?.alive && w.troops > 50);
    const isUnderPressure = attackersOnUs.length > 0;
    let ratio = this.c.ep;
    if (isUnderPressure) ratio = Math.min(this.c.ep * 1.8, 0.45);
    const tr = p.troops * ratio; if (tr < 10) return;
    if (isUnderPressure) {
      const strongest = attackersOnUs.reduce((a, b) => b.troops > a.troops ? b : a);
      const t = this.findBorderWith(strongest.pi);
      if (t) { mkWave(this.pi, t.x, t.y, tr, strongest.pi); return; }
    }
    let t: { x: number; y: number; tgt: number } | null = null;
    const roll = Math.random();
    if (roll < this.c.ag) t = this.attackEnemy();
    if (!t) t = this.expandFrontier();
    if (!t) t = this.attackEnemy();
    if (t) mkWave(this.pi, t.x, t.y, tr, t.tgt);
  }

  findBorderWith(enemyPi: number) {
    for (const b of this.getBorder())
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = b.x + dx, ny = b.y + dy;
        if (B(nx, ny) && own[I(nx, ny)] === enemyPi) return b;
      }
    return null;
  }

  attackEnemy() {
    const border = this.getBorder();
    const adj = new Map<number, { x: number; y: number; cnt: number }>();
    for (const b of border) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = b.x + dx, ny = b.y + dy; if (!B(nx, ny)) continue;
        const o = own[I(nx, ny)];
        if (o >= 0 && o !== this.pi && P[o]?.alive && gD(this.pi, o) !== 'peace') {
          if (!adj.has(o)) adj.set(o, { x: b.x, y: b.y, cnt: 0 });
          adj.get(o)!.cnt++;
        }
      }
    }
    if (adj.size === 0) return null;
    let best: { x: number; y: number; tgt: number } | null = null, bestCnt = 0;
    for (const [eid, info] of adj) if (info.cnt > bestCnt) { bestCnt = info.cnt; best = { x: info.x, y: info.y, tgt: eid }; }
    return best;
  }

  expandFrontier() {
    const border = this.getBorder();
    const cands: Array<{ x: number; y: number; tgt: number }> = [];
    for (let i = 0; i < Math.min(border.length, 60); i++) {
      const b = border[Math.random() * border.length | 0];
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = b.x + dx, ny = b.y + dy;
        if (B(nx, ny) && ter[I(nx, ny)] > 0 && own[I(nx, ny)] === -1) { cands.push({ x: b.x, y: b.y, tgt: -1 }); break; }
      }
    }
    if (cands.length > 0) return cands[Math.random() * cands.length | 0];
    return null;
  }

  bu() {
    const p = P[this.pi];
    const my = bld.filter(b => b.ow === this.pi);
    const f = my.filter(b => b.type === 'factory');
    const ci = my.filter(b => b.type === 'city');
    const sam = my.filter(b => b.type === 'sam');
    const po = my.filter(b => b.type === 'port');
    const silo = my.filter(b => b.type === 'silo');
    const fort = my.filter(b => b.type === 'fort');
    let ty: string;
    if (this.c.sa && sam.length < 2 && f.length >= 1 && p.money >= C.samC) ty = 'sam';
    else if (this.c.sa && fort.length < 2 && p.territory > 100 && p.money >= C.fortC && Math.random() < 0.4) ty = 'fort';
    else if (this.c.nk && silo.length < 1 && p.territory > 200 && p.money >= C.siloC) ty = 'silo';
    else if (po.length < 1 && p.territory > 150 && p.money >= C.poC && Math.random() < .35) ty = 'port';
    else if (Math.random() < this.c.ec && p.money >= C.faC) ty = f.length < ci.length + 2 ? 'factory' : 'city';
    else if (p.money >= C.ciC) ty = 'city';
    else return;
    const cen = this.getCentroid(); if (!cen) return;
    if (ty === 'port') {
      for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) {
        if (own[I(x, y)] === this.pi && isCo(x, y)) {
          if (!bld.some(b => Math.abs(b.x - x) < 12 && Math.abs(b.y - y) < 12)) { buildB(this.pi, 'port', x, y); return; }
        }
      }
      return;
    }
    for (let t = 0; t < 40; t++) {
      const cx = (cen.x + ((Math.random() - .5) * 80)) | 0;
      const cy = (cen.y + ((Math.random() - .5) * 80)) | 0;
      if (!B(cx, cy) || own[I(cx, cy)] !== this.pi) continue;
      if (bld.some(b => Math.abs(b.x - cx) < 12 && Math.abs(b.y - cy) < 12)) continue;
      buildB(this.pi, ty, cx, cy); return;
    }
  }

  nu() {
    const p = P[this.pi];
    if (!bld.some(b => b.ow === this.pi && b.type === 'silo')) return;
    let b = -1, bt = 0;
    for (let i = 0; i < P.length; i++) { if (i === this.pi || !P[i].alive || gD(this.pi, i) === 'peace') continue; if (P[i].territory > bt) { bt = P[i].territory; b = i; } }
    if (b < 0) return;
    const ty = p.money >= C.nhC && Math.random() < .3 ? 'h' : 'a';
    if (p.money < (ty === 'a' ? C.naC : C.nhC)) return;
    for (let t = 0; t < 30; t++) { const x = Math.random() * W | 0, y = Math.random() * H | 0; if (own[I(x, y)] === b) { doNuke(this.pi, ty as 'a' | 'h', x, y); return; } }
  }

  sh() {
    const p = P[this.pi]; if (p.money < C.shC) return;
    const ports = bld.filter(b => b.ow === this.pi && b.type === 'port');
    if (ports.length === 0) return;
    const port = ports[Math.random() * ports.length | 0];
    for (let r = 1; r < 20; r++)
      for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r], [-r, -r], [r, -r], [-r, r], [r, r]])
        if (isW(port.x + dx, port.y + dy) && B(port.x + dx, port.y + dy)) {
          spShip(this.pi, port.x + dx, port.y + dy); return;
        }
  }

  nv() {
    const p = P[this.pi]; if (p.troops < 200) return;
    for (let t = 0; t < 60; t++) {
      const x = Math.random() * W | 0, y = Math.random() * H | 0;
      if (!isL(x, y)) continue;
      const o = own[I(x, y)];
      if (o === this.pi) continue;
      if (o >= 0 && gD(this.pi, o) === 'peace') continue;
      if (needsNaval(this.pi, x, y)) { navInv(this.pi, x, y); return; }
    }
  }
}
