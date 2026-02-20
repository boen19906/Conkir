import { W, H } from './constants';
import type { Player, Building, Wave, Unit, Bullet, Missile, Explosion, Notif, IBot } from './types';

export class GameState {
  ter: Uint8Array = new Uint8Array(W * H);
  own: Int16Array = new Int16Array(W * H).fill(-2);
  P: Player[] = [];
  bld: Building[] = [];
  unt: Unit[] = [];
  exp: Explosion[] = [];
  bullets: Bullet[] = [];
  missiles: Missile[] = [];
  wav: Wave[] = [];
  dip: Map<string, string> = new Map();
  pendingPeace: Array<{ from: number; to: number }> = [];
  conflictIntensity: Map<string, number> = new Map();
  betrayalDebuff: Map<number, number> = new Map();
  bots: IBot[] = [];
  notifs: Notif[] = [];
  pendingNotifs: Notif[] = [];

  tk: number = 0;
  nwid: number = 0;
  nuid: number = 0;
  nbid: number = 0;
  nmid: number = 0;
  ntid: number = 0;
  run: boolean = false;
  gOv: boolean = false;
  victoryShown: boolean = false;
  underAttack: boolean = false;
  lastAttackNotif: number = 0;

  // Per-player attack ratio (bots default 0.20)
  atkRatio: Map<number, number> = new Map();

  // Delta tracking: snapshot of own for diffing
  prevOwn: Int16Array = new Int16Array(W * H).fill(-2);

  addNotif(pi: number, msg: string, color = '#7ec8e3') {
    const n: Notif = { msg, color, ttl: 180, pi };
    this.notifs.push(n);
    this.pendingNotifs.push(n);
  }

  computeOwnDelta(): Array<[number, number]> {
    const changes: Array<[number, number]> = [];
    for (let i = 0; i < this.own.length; i++) {
      if (this.own[i] !== this.prevOwn[i]) {
        changes.push([i, this.own[i]]);
        this.prevOwn[i] = this.own[i];
      }
    }
    return changes;
  }

  nextWid() { return this.nwid++; }
  nextUid() { return this.nuid++; }
  nextBid() { return this.nbid++; }
  nextMid() { return this.nmid++; }
  nextTid() { return this.ntid++; }
  resetIds() { this.nwid = 0; this.nuid = 0; this.nbid = 0; this.nmid = 0; this.ntid = 0; }

  getAtkRatio(pi: number): number {
    return this.atkRatio.get(pi) ?? 0.20;
  }

  reset() {
    this.ter = new Uint8Array(W * H);
    this.own = new Int16Array(W * H).fill(-2);
    this.prevOwn = new Int16Array(W * H).fill(-2);
    this.P = []; this.bld = []; this.unt = []; this.exp = [];
    this.bullets = []; this.missiles = []; this.wav = [];
    this.dip = new Map(); this.pendingPeace = [];
    this.conflictIntensity = new Map(); this.betrayalDebuff = new Map();
    this.bots = []; this.notifs = []; this.pendingNotifs = [];
    this.tk = 0; this.nwid = 0; this.nuid = 0; this.nbid = 0;
    this.nmid = 0; this.ntid = 0;
    this.run = false; this.gOv = false; this.victoryShown = false;
    this.underAttack = false; this.lastAttackNotif = 0;
    this.atkRatio = new Map();
  }
}
