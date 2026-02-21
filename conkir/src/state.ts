import { W, H } from './constants';
import type { Player, Building, Wave, Unit, Bullet, Missile, Explosion, Notif, IBot } from './types';

export let ter: Uint8Array = new Uint8Array(W * H);
export let own: Int16Array = new Int16Array(W * H).fill(-2);
export let P: Player[] = [];
export let bld: Building[] = [];
export let unt: Unit[] = [];
export let exp: Explosion[] = [];
export let bullets: Bullet[] = [];
export let missiles: Missile[] = [];
export let wav: Wave[] = [];
export let dip: Map<string, string> = new Map();
export let pendingPeace: Array<{ from: number; to: number }> = [];
export let conflictIntensity: Map<string, number> = new Map();
export let betrayalDebuff: Map<number, number> = new Map();
export let bots: IBot[] = [];
export let notifs: Notif[] = [];
export let botProposals: Array<{ from: number; name: string; color: number; addedAt: number }> = [];
export let selectedWarshipId: number = -1;

export let tk: number = 0;
export let nwid: number = 0;
export let nuid: number = 0;
export let nbid: number = 0;
export let nmid: number = 0;
export let ntid: number = 0;
export let atkRatio: number = 0.20;
export let run: boolean = false;
export let gOv: boolean = false;
export let victoryShown: boolean = false;
export let underAttack: boolean = false;
export let lastAttackNotif: number = 0;

// Setters for reassigned bindings
export function setTer(v: Uint8Array) { ter = v; }
export function setOwn(v: Int16Array) { own = v; }
export function setP(v: Player[]) { P = v; }
export function setBld(v: Building[]) { bld = v; }
export function setUnt(v: Unit[]) { unt = v; }
export function setExp(v: Explosion[]) { exp = v; }
export function setBullets(v: Bullet[]) { bullets = v; }
export function setMissiles(v: Missile[]) { missiles = v; }
export function setWav(v: Wave[]) { wav = v; }
export function setDip(v: Map<string, string>) { dip = v; }
export function setPendingPeace(v: Array<{ from: number; to: number }>) { pendingPeace = v; }
export function setConflictIntensity(v: Map<string, number>) { conflictIntensity = v; }
export function setBetrayalDebuff(v: Map<number, number>) { betrayalDebuff = v; }
export function setBots(v: IBot[]) { bots = v; }
export function setNotifs(v: Notif[]) { notifs = v; }
export function setBotProposals(v: Array<{ from: number; name: string; color: number; addedAt: number }>) { botProposals = v; }
export function setSelectedWarship(id: number) { selectedWarshipId = id; }
export function setTk(v: number) { tk = v; }
export function incTk() { tk++; }
export function setRun(v: boolean) { run = v; }
export function setGOv(v: boolean) { gOv = v; }
export function setVictoryShown(v: boolean) { victoryShown = v; }
export function setUnderAttack(v: boolean) { underAttack = v; }
export function setLastAttackNotif(v: number) { lastAttackNotif = v; }
export function setAtkRatio(v: number) { atkRatio = v; }

// ID counters — return old value and increment (like nwid++)
export function nextWid() { return nwid++; }
export function nextUid() { return nuid++; }
export function nextBid() { return nbid++; }
export function nextMid() { return nmid++; }
export function nextTid() { return ntid++; }
export function resetIds() { nwid = 0; nuid = 0; nbid = 0; nmid = 0; ntid = 0; }

// addNotif lives here to avoid circular dep (diplomacy.ts calls it, ui.ts imports it)
export function addNotif(pi: number, msg: string, color = '#7ec8e3') {
  const h = P.findIndex(p => p.hu);
  if (pi !== h && pi !== -99) return;
  notifs.push({ msg, color, ttl: 180, pi });
}

// Victory callback — solo registers DOM overlay; multiplayer leaves it null
export let onVictory: ((p: Player) => void) | null = null;
export function setOnVictory(fn: ((p: Player) => void) | null) { onVictory = fn; }
