import type { GameState } from './state';
import { BC, C, W, H } from './constants';
import { B, I, isL, isW, isCo } from './mapgen';
import { gD, sD, proposePeace } from './diplomacy';
import { mkWave } from './waves';
import { navInv, needsNaval, spShip } from './naval';
import { doNuke } from './nukes';
import { buildB } from './buildings';
import type { BotConfig, IBot } from './types';

export class Bot implements IBot {
  gs: GameState;
  pi: number;
  c: BotConfig;
  le: number; lb: number; ln: number; ls: number; lnv: number;
  bCache: Array<{ x: number; y: number }>;
  bTk: number;
  // Naval follow-up: track the enemy targeted by last naval invasion
  navTarget: { pi: number; tk: number } | null = null;

  constructor(gs: GameState, pi: number) {
    this.gs = gs;
    this.pi = pi;
    this.c = BC[gs.P[pi].df] || BC[1];
    this.le = -pi * 7; this.lb = -pi * 21; this.ln = -pi * 35; this.ls = -pi * 28; this.lnv = -pi * 42;
    this.bCache = []; this.bTk = -1;
  }

  u() {
    const gs = this.gs;
    const p = gs.P[this.pi], c = this.c; if (!p.alive) return;
    if (c.tm > 1 && gs.tk % 10 === 0) { p.maxTroops *= c.tm; p.troops = Math.min(p.troops + (c.tm - 1) * p.growth, p.maxTroops); p.maxTroops /= c.tm; }
    if (c.mm > 1 && gs.tk % 10 === 0) p.money += (c.mm - 1) * p.income;
    if (gs.tk - this.le >= c.ef) { this.ex(); this.le = gs.tk; }
    if (gs.tk - this.lb >= c.bf) { this.bu(); this.lb = gs.tk; }
    if (c.nk && c.nf > 0 && gs.tk - this.ln >= c.nf) { this.nu(); this.ln = gs.tk; }
    if (c.sf > 0 && gs.tk - this.ls >= c.sf) { this.sh(); this.ls = gs.tk; }
    if (c.nvf > 0 && gs.tk - this.lnv >= c.nvf) { this.nv(); this.lnv = gs.tk; }
    if (gs.tk % 300 === 0) this.checkBetray();
    if (gs.tk % 200 === 0) this.checkProposePeace();
  }

  checkProposePeace() {
    const gs = this.gs, p = gs.P[this.pi];
    for (let i = 0; i < gs.P.length; i++) {
      if (i === this.pi || !gs.P[i].alive || gD(gs, this.pi, i) !== 'war') continue;
      const them = gs.P[i];
      const sharedEnemies = gs.P.filter((_, ei) => ei !== this.pi && ei !== i && gs.P[ei]?.alive && gD(gs, this.pi, ei) === 'war' && gD(gs, i, ei) === 'war').length > 0;
      const weLosing = p.territory < them.territory * 0.5;
      const similar = p.territory > them.territory * 0.4 && p.territory < them.territory * 2.5;
      const proposeChance = (sharedEnemies ? 0.25 : 0) + (weLosing ? 0.30 : 0) + (similar ? 0.05 : 0);
      if (Math.random() < proposeChance) {
        proposePeace(gs, this.pi, i);
      }
    }
  }

  checkBetray() {
    const gs = this.gs, p = gs.P[this.pi];
    for (let i = 0; i < gs.P.length; i++) {
      if (i === this.pi || !gs.P[i].alive || gD(gs, this.pi, i) !== 'peace') continue;
      const them = gs.P[i];
      const weStronger = p.territory > them.territory * 1.4;
      const betrayChance = this.c.ag * (weStronger ? 0.12 : 0.02);
      if (Math.random() < betrayChance) {
        sD(gs, this.pi, i, 'war', true);
        gs.betrayalDebuff.set(this.pi, (gs.betrayalDebuff.get(this.pi) || 0) + 1200);
        gs.addNotif(i, `${p.name} betrayed the peace treaty! 🗡`, '#E74C3C');
      }
    }
  }

  getBorder() {
    const gs = this.gs;
    if (gs.tk - this.bTk < 15 && this.bCache.length > 0) return this.bCache;
    const b: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      if (gs.own[I(x, y)] !== this.pi) continue;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (B(nx, ny) && gs.ter[I(nx, ny)] > 0 && gs.own[I(nx, ny)] !== this.pi) { b.push({ x, y }); break; }
      }
    }
    this.bCache = b; this.bTk = gs.tk; return b;
  }

  getCentroid() {
    const gs = this.gs;
    let cx = 0, cy = 0, cn = 0;
    for (let y = 0; y < H; y += 6) for (let x = 0; x < W; x += 6) if (gs.own[I(x, y)] === this.pi) { cx += x; cy += y; cn++; }
    if (!cn) return null; return { x: (cx / cn) | 0, y: (cy / cn) | 0 };
  }

  ex() {
    const gs = this.gs, p = gs.P[this.pi]; if (!p.alive) return;

    // Reserve ratio: don't attack if we're below the minimum troop reserve
    const minReserve = p.maxTroops * this.c.mr;
    if (p.troops < minReserve) return;

    const attackersOnUs = gs.wav.filter(w => w.targetOwner === this.pi && gs.P[w.pi]?.alive && w.troops > 50);
    const isUnderPressure = attackersOnUs.length > 0;

    // Troops available above reserve (cap at ep ratio for normal attacks)
    const available = p.troops - minReserve;
    let sendRatio = this.c.ep;
    if (isUnderPressure) sendRatio = Math.min(this.c.ep * 1.8, 0.55);
    const tr = available * sendRatio;
    if (tr < 10) return;

    // Priority 1: Retaliate against the strongest attacker
    if (isUnderPressure) {
      const strongest = attackersOnUs.reduce((a, b) => b.troops > a.troops ? b : a);
      const t = this.findBorderWith(strongest.pi);
      if (t) { mkWave(gs, this.pi, t.x, t.y, tr, strongest.pi); return; }
    }

    // Priority 2: Follow up a naval beachhead — attack the nav target from any border we have with them
    if (this.navTarget && gs.tk - this.navTarget.tk < 600) {
      const enemyPi = this.navTarget.pi;
      if (gs.P[enemyPi]?.alive && gD(gs, this.pi, enemyPi) !== 'peace') {
        const t = this.findBorderWith(enemyPi);
        if (t) {
          // Send a stronger wave to capitalize on the beachhead
          const beachheadTr = Math.min(available * Math.min(sendRatio * 1.5, 0.6), available);
          mkWave(gs, this.pi, t.x, t.y, beachheadTr, enemyPi);
          return;
        }
      } else {
        this.navTarget = null;
      }
    }

    // Priority 3: Attack a very weak enemy we border (< 15% of their maxTroops)
    const veryWeak = this.findVeryWeakEnemy();
    if (veryWeak !== null) {
      const t = this.findBorderWith(veryWeak);
      if (t) { mkWave(gs, this.pi, t.x, t.y, tr, veryWeak); return; }
    }

    // Priority 4: Attack a "victim" — enemy currently being gang-attacked by others
    const victim = this.findVictim();
    if (victim !== null) {
      const t = this.findBorderWith(victim);
      if (t) { mkWave(gs, this.pi, t.x, t.y, tr, victim); return; }
    }

    // Priority 5: Standard attack/expand logic
    let t: { x: number; y: number; tgt: number } | null = null;
    const roll = Math.random();
    if (roll < this.c.ag) t = this.attackEnemy();
    if (!t) t = this.expandFrontier();
    if (!t) t = this.attackEnemy();
    if (t) mkWave(gs, this.pi, t.x, t.y, tr, t.tgt);
  }

  // Find the weakest bordering enemy by troops (< 15% of their maxTroops)
  findVeryWeakEnemy(): number | null {
    const gs = this.gs, p = gs.P[this.pi];
    const border = this.getBorder();
    const adj = new Map<number, number>(); // enemyPi -> their troops
    for (const b of border) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = b.x + dx, ny = b.y + dy; if (!B(nx, ny)) continue;
        const o = gs.own[I(nx, ny)];
        if (o >= 0 && o !== this.pi && gs.P[o]?.alive && gD(gs, this.pi, o) !== 'peace') {
          if (!adj.has(o)) adj.set(o, gs.P[o].troops);
        }
      }
    }
    let best: number | null = null, bestTroops = Infinity;
    for (const [eid, troops] of adj) {
      const enemyMaxTroops = gs.P[eid].maxTroops || 1;
      if (troops < enemyMaxTroops * 0.15 && troops < p.troops * 1.2 && troops < bestTroops) {
        best = eid; bestTroops = troops;
      }
    }
    return best;
  }

  // Find a bordering enemy that's currently being attacked by others (good pile-on target)
  findVictim(): number | null {
    const gs = this.gs, p = gs.P[this.pi];
    const border = this.getBorder();
    const adj = new Set<number>();
    for (const b of border) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = b.x + dx, ny = b.y + dy; if (!B(nx, ny)) continue;
        const o = gs.own[I(nx, ny)];
        if (o >= 0 && o !== this.pi && gs.P[o]?.alive && gD(gs, this.pi, o) !== 'peace') adj.add(o);
      }
    }
    for (const eid of adj) {
      const enemy = gs.P[eid];
      if (enemy.troops > p.troops * 1.2) continue;
      // Check if they're under significant attack from waves
      const totalIncoming = gs.wav.filter(w => w.targetOwner === eid && w.pi !== this.pi).reduce((s, w) => s + w.troops, 0);
      if (totalIncoming > enemy.troops * 0.4) return eid;
    }
    return null;
  }

  findBorderWith(enemyPi: number) {
    const gs = this.gs;
    for (const b of this.getBorder())
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = b.x + dx, ny = b.y + dy;
        if (B(nx, ny) && gs.own[I(nx, ny)] === enemyPi) return b;
      }
    return null;
  }

  attackEnemy() {
    const gs = this.gs;
    const border = this.getBorder();
    const adj = new Map<number, { x: number; y: number; cnt: number; troops: number }>();
    for (const b of border) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = b.x + dx, ny = b.y + dy; if (!B(nx, ny)) continue;
        const o = gs.own[I(nx, ny)];
        if (o >= 0 && o !== this.pi && gs.P[o]?.alive && gD(gs, this.pi, o) !== 'peace') {
          if (!adj.has(o)) adj.set(o, { x: b.x, y: b.y, cnt: 0, troops: gs.P[o].troops });
          adj.get(o)!.cnt++;
        }
      }
    }
    if (adj.size === 0) return null;
    const p = gs.P[this.pi];
    // Pick enemy: prefer weakest among those we heavily border (> half max count),
    // otherwise fall back to most-border (classic behavior)
    let best: { x: number; y: number; tgt: number } | null = null;
    let bestScore = -Infinity;
    const maxCnt = Math.max(...Array.from(adj.values()).map(v => v.cnt));
    for (const [eid, info] of adj) {
      // Score: border density bonus minus troop ratio penalty
      const borderScore = info.cnt / maxCnt;
      const troopRatio = info.troops / (p.troops || 1);
      // Prefer high border, low troop ratio; weight more toward border when ag is high
      const score = borderScore * (1 + this.c.ag) - troopRatio * (1 - this.c.ag * 0.5);
      if (score > bestScore) { bestScore = score; best = { x: info.x, y: info.y, tgt: eid }; }
    }
    return best;
  }

  expandFrontier() {
    const gs = this.gs;
    const border = this.getBorder();
    const cands: Array<{ x: number; y: number; tgt: number }> = [];
    for (let i = 0; i < Math.min(border.length, 60); i++) {
      const b = border[Math.random() * border.length | 0];
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = b.x + dx, ny = b.y + dy;
        if (B(nx, ny) && gs.ter[I(nx, ny)] > 0 && gs.own[I(nx, ny)] === -1) { cands.push({ x: b.x, y: b.y, tgt: -1 }); break; }
      }
    }
    if (cands.length > 0) return cands[Math.random() * cands.length | 0];
    return null;
  }

  bu() {
    const gs = this.gs, p = gs.P[this.pi];
    const my = gs.bld.filter(b => b.ow === this.pi);
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
        if (gs.own[I(x, y)] === this.pi && isCo(gs, x, y)) {
          if (!gs.bld.some(b => Math.abs(b.x - x) < 12 && Math.abs(b.y - y) < 12)) { buildB(gs, this.pi, 'port', x, y); return; }
        }
      }
      return;
    }
    for (let t = 0; t < 40; t++) {
      const cx = (cen.x + ((Math.random() - .5) * 80)) | 0;
      const cy = (cen.y + ((Math.random() - .5) * 80)) | 0;
      if (!B(cx, cy) || gs.own[I(cx, cy)] !== this.pi) continue;
      if (gs.bld.some(b => Math.abs(b.x - cx) < 12 && Math.abs(b.y - cy) < 12)) continue;
      buildB(gs, this.pi, ty, cx, cy); return;
    }
  }

  nu() {
    const gs = this.gs, p = gs.P[this.pi];
    if (!gs.bld.some(b => b.ow === this.pi && b.type === 'silo')) return;
    let b = -1, bt = 0;
    for (let i = 0; i < gs.P.length; i++) { if (i === this.pi || !gs.P[i].alive || gD(gs, this.pi, i) === 'peace') continue; if (gs.P[i].territory > bt) { bt = gs.P[i].territory; b = i; } }
    if (b < 0) return;
    const ty = p.money >= C.nhC && Math.random() < .3 ? 'h' : 'a';
    if (p.money < (ty === 'a' ? C.naC : C.nhC)) return;
    for (let t = 0; t < 30; t++) { const x = Math.random() * W | 0, y = Math.random() * H | 0; if (gs.own[I(x, y)] === b) { doNuke(gs, this.pi, ty as 'a' | 'h', x, y); return; } }
  }

  sh() {
    const gs = this.gs, p = gs.P[this.pi]; if (p.money < C.shC) return;
    const ports = gs.bld.filter(b => b.ow === this.pi && b.type === 'port');
    if (ports.length === 0) return;
    const port = ports[Math.random() * ports.length | 0];
    for (let r = 1; r < 20; r++)
      for (const [dx, dy] of [[-r, 0], [r, 0], [0, -r], [0, r], [-r, -r], [r, -r], [-r, r], [r, r]])
        if (isW(gs, port.x + dx, port.y + dy) && B(port.x + dx, port.y + dy)) {
          spShip(gs, this.pi, port.x + dx, port.y + dy); return;
        }
  }

  nv() {
    const gs = this.gs, p = gs.P[this.pi]; if (p.troops < 200) return;

    // Build list of candidate targets: prefer enemies weaker than us on separate landmasses
    const candidates: Array<{ x: number; y: number; pi: number; score: number }> = [];
    for (let t = 0; t < 80; t++) {
      const x = Math.random() * W | 0, y = Math.random() * H | 0;
      if (!isL(gs, x, y)) continue;
      const o = gs.own[I(x, y)];
      if (o === this.pi) continue;
      if (o >= 0 && gD(gs, this.pi, o) === 'peace') continue;
      if (!needsNaval(gs, this.pi, x, y)) continue;
      // Score: prefer weaker enemies, avoid already-targeted ones
      const enemyTroops = o >= 0 ? gs.P[o].troops : 0;
      const isNavTarget = this.navTarget && this.navTarget.pi === o;
      const score = (p.troops - enemyTroops) / (p.troops || 1) + (isNavTarget ? 0.3 : 0);
      candidates.push({ x, y, pi: o, score });
      if (candidates.length >= 5) break;
    }

    if (candidates.length === 0) return;

    // Pick best candidate (highest score = weakest/preferred enemy)
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    navInv(gs, this.pi, best.x, best.y);

    // Track this as our active naval target for follow-up land attacks
    if (best.pi >= 0) {
      this.navTarget = { pi: best.pi, tk: gs.tk };
    }
  }
}
