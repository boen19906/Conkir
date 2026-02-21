// ============================================================
// CLIENT → SERVER messages
// ============================================================

export interface MsgLobbyCreate {
  type: 'lobbyCreate';
  playerName: string;
  botCount: number;
  difficulty: number;
}

export interface MsgLobbyJoin {
  type: 'lobbyJoin';
  code: string;
  playerName: string;
}

export interface MsgLobbyStart {
  type: 'lobbyStart';
}

export interface MsgLobbyConfig {
  type: 'lobbyConfig';
  botCount?: number;
  difficulty?: number;
}

export interface MsgSpawn {
  type: 'spawn';
  x: number;
  y: number;
}

export interface MsgAction {
  type: 'action';
  action:
    | { kind: 'mkWave'; cx: number; cy: number; tr: number; targetOwner: number | null }
    | { kind: 'buildB'; btype: string; x: number; y: number }
    | { kind: 'sD'; b: number; status: string }
    | { kind: 'doNuke'; nukeType: 'a' | 'h'; tx: number; ty: number }
    | { kind: 'spShip'; wx: number; wy: number }
    | { kind: 'navInv'; tx: number; ty: number }
    | { kind: 'peaceAccept'; target: number }
    | { kind: 'peaceReject'; target: number };
}

export interface MsgRatioChange {
  type: 'ratioChange';
  value: number;
}

export interface MsgPing {
  type: 'ping';
  ts: number;
}

export type ClientMessage =
  | MsgLobbyCreate
  | MsgLobbyJoin
  | MsgLobbyStart
  | MsgLobbyConfig
  | MsgSpawn
  | MsgAction
  | MsgRatioChange
  | MsgPing;

// ============================================================
// SERVER → CLIENT messages
// ============================================================

export interface LobbyPlayer {
  name: string;
  isHost: boolean;
}

export interface MsgConnId {
  type: 'connId';
  id: string;
}

export interface MsgLobbyCreated {
  type: 'lobbyCreated';
  code: string;
  playerId: number;
  playerName: string;
}

export interface MsgLobbyUpdate {
  type: 'lobbyUpdate';
  code: string;
  players: LobbyPlayer[];
  botCount: number;
  difficulty: number;
  hostIsYou: boolean;
}

export interface MsgLobbyError {
  type: 'lobbyError';
  reason: string;
}

export interface MsgGameStarting {
  type: 'gameStarting';
  seed: number;
  terB64: string;
  ownB64: string;
  yourPlayerIndex: number;
  playerNames: string[];
  playerColors: number[];
  botSpawns: Array<{ x: number; y: number }>;
  spawnTimeoutMs: number;
}

export interface SpawnPoint {
  playerIndex: number;
  x: number;
  y: number;
  name: string;
}

export interface MsgSpawnUpdate {
  type: 'spawnUpdate';
  chosenSpawns: SpawnPoint[];
  remainingMs: number;
}

export interface MsgSpawnForced {
  type: 'spawnForced';
  yourSpawn: { x: number; y: number };
}

export interface WireDelta_Player {
  id: number;
  troops: number;
  maxTroops: number;
  money: number;
  territory: number;
  growth: number;
  income: number;
  alive: boolean;
}

export interface WireDelta_Building {
  id: number;
  type: string;
  ow: number;
  x: number;
  y: number;
  samCd?: number;
}

export interface WireDelta_Unit {
  id: number;
  ty: string;
  ow: number;
  x: number;
  y: number;
  hp: number;
}

export interface WireDelta_Missile {
  id: number;
  pi: number;
  type: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
}

export interface WireDelta_Explosion {
  x: number;
  y: number;
  rad: number;
  f: number;
  mx: number;
}

export interface WireDelta_Notif {
  msg: string;
  color: string;
  ttl: number;
  pi: number;
}

export interface WireDelta_Wave {
  id: number;
  pi: number;
  troops: number;
  targetOwner: number | null;
}

export interface WireDelta_Bullet {
  x: number;
  y: number;
  tx: number;
  ty: number;
  ow: number;
}

export interface MsgTick {
  type: 'tick';
  tk: number;
  ownChanges: Array<[number, number]>;
  players: WireDelta_Player[];
  bldChanged: boolean;
  bld: WireDelta_Building[] | null;
  units: WireDelta_Unit[];
  waves: WireDelta_Wave[];
  bullets: WireDelta_Bullet[];
  missiles: WireDelta_Missile[];
  newExplosions: WireDelta_Explosion[];
  notifs: WireDelta_Notif[];
  dipChanged: boolean;
  dip: Array<[string, string]> | null;
}

export interface MsgPeaceProposal {
  type: 'peaceProposal';
  proposerIndex: number;
  proposerName: string;
  proposerColor: number;
}

export interface MsgGameOver {
  type: 'gameOver';
  winnerId: number;
  winnerName: string;
  winnerTerritoryPct: number;
}

export interface MsgPong {
  type: 'pong';
  ts: number;
  serverTs: number;
}

export interface MsgError {
  type: 'error';
  message: string;
}

export type ServerMessage =
  | MsgConnId
  | MsgLobbyCreated
  | MsgLobbyUpdate
  | MsgLobbyError
  | MsgGameStarting
  | MsgSpawnUpdate
  | MsgSpawnForced
  | MsgTick
  | MsgPeaceProposal
  | MsgGameOver
  | MsgPong
  | MsgError;
