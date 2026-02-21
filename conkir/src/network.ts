import {
  setTer, setOwn, setP, setBld, setUnt, setMissiles, setExp, setNotifs, setDip, setWav, setTk,
  own, notifs, P, bld, exp
} from './state';
import { COL } from './constants';
import type {
  ServerMessage, MsgTick, MsgGameStarting, ClientMessage
} from './protocol';

export type NetworkMode = 'solo' | 'multiplayer';
export let netMode: NetworkMode = 'solo';

let ws: WebSocket | null = null;
let _connId: string = localStorage.getItem('conkir_connId') || '';
let _myPlayerIndex: number = -1;
let _serverUrl: string = '';

// Typed message handlers registered by main.ts / init.ts
type Handler<T> = (msg: T) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handlers: Record<string, Handler<any>> = {};

export function onMsg<K extends ServerMessage['type']>(
  type: K,
  handler: Handler<Extract<ServerMessage, { type: K }>>
) {
  handlers[type] = handler;
}

export function connect(serverUrl: string): Promise<void> {
  _serverUrl = serverUrl;
  netMode = 'multiplayer';
  const url = `${serverUrl}?connId=${encodeURIComponent(_connId)}`;
  return new Promise((resolve, reject) => {
    ws = new WebSocket(url);
    ws.onopen = () => resolve();
    ws.onerror = (e) => reject(e);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as ServerMessage & { type: string };
        if (msg.type === 'connId') {
          _connId = (msg as any).id as string;
          localStorage.setItem('conkir_connId', _connId);
          return;
        }
        // Apply tick automatically
        if (msg.type === 'tick') applyTick(msg as MsgTick);
        // Fire typed handlers
        const h = handlers[msg.type];
        if (h) h(msg);
      } catch { /* ignore parse errors */ }
    };
    ws.onclose = () => {
      // Auto-reconnect after 2s
      if (netMode === 'multiplayer') {
        setTimeout(() => {
          if (netMode === 'multiplayer') {
            connect(_serverUrl).catch(() => {});
          }
        }, 2000);
      }
    };
  });
}

export function send(msg: ClientMessage) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function applyGameStart(msg: MsgGameStarting) {
  _myPlayerIndex = msg.yourPlayerIndex;

  // Decode ter (Uint8Array)
  const terBytes = Uint8Array.from(atob(msg.terB64), c => c.charCodeAt(0));
  setTer(terBytes);

  // Decode own (Int16Array stored as raw bytes)
  const ownRawBytes = Uint8Array.from(atob(msg.ownB64), c => c.charCodeAt(0));
  const ownArr = new Int16Array(ownRawBytes.buffer);
  setOwn(ownArr);

  // Initialize P array
  const newP = msg.playerNames.map((name, i) => ({
    id: i,
    name,
    color: msg.playerColors[i] ?? COL[i % COL.length],
    troops: 50,
    maxTroops: 200,
    money: 2000,
    hu: i === msg.yourPlayerIndex,
    alive: true,
    df: 1,
    territory: 0,
    growth: 0,
    income: 0
  }));
  setP(newP);
  setBld([]);
}

function applyTick(msg: MsgTick) {
  // Sync server tick counter — drives label building, water animation, notification timers
  setTk(msg.tk);

  // Apply ownership changes
  for (const [idx, owner] of msg.ownChanges) {
    own[idx] = owner;
  }

  // Update player stats
  for (const ps of msg.players) {
    const p = P[ps.id];
    if (p) {
      p.troops = ps.troops;
      p.maxTroops = ps.maxTroops;
      p.money = ps.money;
      p.territory = ps.territory;
      p.growth = ps.growth;
      p.income = ps.income;
      p.alive = ps.alive;
    }
  }

  // Apply waves (for attack/defend counters and under-attack notifications)
  setWav(msg.waves.map(w => ({
    id: w.id,
    pi: w.pi,
    troops: w.troops,
    heap: null as any,
    inHeap: null as any,
    targetOwner: w.targetOwner,
    _pressing: new Set<number>()
  })));

  // Apply buildings if changed
  if (msg.bldChanged && msg.bld) {
    setBld(msg.bld.map(b => ({
      id: b.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: b.type as any,
      ow: b.ow,
      x: b.x,
      y: b.y,
      samCd: b.samCd
    })));
  }

  // Apply units
  setUnt(msg.units.map(u => ({
    id: u.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ty: u.ty as any,
    ow: u.ow,
    x: u.x,
    y: u.y,
    tx: null,
    ty2: null,
    hp: u.hp
  })));

  // Apply missiles
  setMissiles(msg.missiles.map(m => ({
    id: m.id,
    pi: m.pi,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type: m.type as any,
    x: m.x,
    y: m.y,
    tx: m.tx,
    ty: m.ty,
    hp: 100
  })));

  // Merge new explosions with existing (advance existing frames client-side)
  const curExp = exp.slice();
  for (const e of curExp) e.f++;
  const filtered = curExp.filter(e => e.f < e.mx);
  for (const ne of msg.newExplosions) {
    filtered.push({ x: ne.x, y: ne.y, rad: ne.rad, f: 0, mx: ne.mx });
  }
  setExp(filtered);

  // Apply notifs
  if (msg.notifs.length > 0) {
    const current = notifs.filter(n => n.ttl > 0);
    for (const n of msg.notifs) {
      current.push({ msg: n.msg, color: n.color, ttl: n.ttl, pi: n.pi });
    }
    setNotifs(current);
  } else {
    setNotifs(notifs.map(n => ({ ...n, ttl: n.ttl - 1 })).filter(n => n.ttl > 0));
  }

  // Apply diplomacy if changed
  if (msg.dipChanged && msg.dip) {
    setDip(new Map(msg.dip));
  }
}

export function isMultiplayer(): boolean { return netMode === 'multiplayer'; }
export function getMyPlayerIndex(): number { return _myPlayerIndex; }
export function getConnId(): string { return _connId; }
