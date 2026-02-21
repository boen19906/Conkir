import type { FlatBinaryHeap } from './heap';

export type BuildingType = 'city' | 'factory' | 'port' | 'sam' | 'silo' | 'fort';
export type UnitType = 'w' | 't' | 'tr';
export type NukeType = 'a' | 'h';

export interface Player {
  id: number;
  name: string;
  color: number;
  troops: number;
  maxTroops: number;
  money: number;
  hu: boolean;
  alive: boolean;
  df: number;
  territory: number;
  growth: number;
  income: number;
}

export interface Building {
  id: number;
  type: BuildingType;
  ow: number;
  x: number;
  y: number;
  samCd?: number;
}

export interface Wave {
  id: number;
  pi: number;
  troops: number;
  heap: FlatBinaryHeap;
  inHeap: Set<number>;
  targetOwner: number | null;
  _pressing: Set<number>;
}

export interface Unit {
  id: number;
  ty: UnitType;
  ow: number;
  x: number;
  y: number;
  tx: number | null;
  ty2: number | null;
  hp: number;
  cd?: number;
  stuck?: number;
  tr?: number;
  path?: number[];
  srcPort?: number;
  dstPort?: number;
  dstOwner?: number;
  dist?: number;
  safe?: boolean;
  tid?: number;
}

export interface Bullet {
  x: number;
  y: number;
  tx: number;
  ty: number;
  tid: number;
  ow: number;
  spd: number;
  dmg: number;
}

export interface Missile {
  id: number;
  pi: number;
  type: NukeType;
  x: number;
  y: number;
  tx: number;
  ty: number;
  hp: number;
}

export interface Explosion {
  x: number;
  y: number;
  rad: number;
  f: number;
  mx: number;
}

export interface Notif {
  msg: string;
  color: string;
  ttl: number;
  pi: number;
}

export interface BotConfig {
  ef: number;
  ep: number;
  bf: number;
  nf: number;
  sf: number;
  nvf: number;
  ag: number;
  nk: number;
  sa: number;
  ec: number;
  tm: number;
  mm: number;
  mr: number; // minimum reserve ratio (0-1): don't attack if troops < maxTroops * mr
}

export interface IBot {
  u(): void;
}
