import { WebSocket } from 'ws';
import { GameState } from './game/state';
import { genMap, findSp, isL, I, B } from './game/mapgen';
import { gameTick } from './game/tick';
import { Bot } from './game/bot';
import { mkWave } from './game/waves';
import { buildB } from './game/buildings';
import { sD } from './game/diplomacy';
import { doNuke } from './game/nukes';
import { spShip, navInv } from './game/naval';
import { COL, NM, W, H } from './game/constants';
import type { ClientMessage, ServerMessage, MsgTick, SpawnPoint } from './protocol';

export interface PlayerSlot {
  ws: WebSocket;
  playerIndex: number;
  name: string;
  spawnChosen: boolean;
  spawnX: number;
  spawnY: number;
  connId: string;
  connected: boolean;
}

export type GamePhase = 'lobby' | 'spawning' | 'running' | 'over';

export class GameRoom {
  code: string;
  gs: GameState;
  phase: GamePhase = 'lobby';
  slots: PlayerSlot[] = [];
  hostConnId: string;
  botCount: number;
  difficulty: number;
  seed: number = 0;

  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private spawnTimer: ReturnType<typeof setTimeout> | null = null;
  private spawnBroadcastInterval: ReturnType<typeof setInterval> | null = null;
  private spawnDeadline: number = 0;
  private prevBldHash: string = '';
  private prevDipSize: number = 0;
  private botNames: string[] = [];

  constructor(code: string, hostConnId: string, hostWs: WebSocket, hostName: string, botCount: number, difficulty: number) {
    this.code = code;
    this.gs = new GameState();
    this.hostConnId = hostConnId;
    this.botCount = Math.max(0, Math.min(8, botCount));
    this.difficulty = Math.max(0, Math.min(3, difficulty));
    this.slots.push({
      ws: hostWs,
      playerIndex: -1,
      name: hostName,
      spawnChosen: false,
      spawnX: 0,
      spawnY: 0,
      connId: hostConnId,
      connected: true
    });
  }

  // ---- Lobby ----

  addPlayer(ws: WebSocket, connId: string, name: string): boolean {
    if (this.phase !== 'lobby') return false;
    if (this.slots.length >= 8) return false;
    this.slots.push({ ws, playerIndex: -1, name, spawnChosen: false, spawnX: 0, spawnY: 0, connId, connected: true });
    this.broadcastLobbyUpdate();
    return true;
  }

  updateConfig(botCount: number, difficulty: number) {
    this.botCount = Math.max(0, Math.min(8, botCount));
    this.difficulty = Math.max(0, Math.min(3, difficulty));
    this.broadcastLobbyUpdate();
  }

  broadcastLobbyUpdate() {
    const players = this.slots.map(s => ({ name: s.name, isHost: s.connId === this.hostConnId }));
    for (const slot of this.slots) {
      this.send(slot.ws, {
        type: 'lobbyUpdate',
        code: this.code,
        players,
        botCount: this.botCount,
        difficulty: this.difficulty,
        hostIsYou: slot.connId === this.hostConnId
      });
    }
  }

  markDisconnected(connId: string) {
    const slot = this.slots.find(s => s.connId === connId);
    if (slot) slot.connected = false;
    // If host disconnects and game is in lobby, promote next connected player
    if (connId === this.hostConnId && this.phase === 'lobby') {
      const next = this.slots.find(s => s.connId !== connId && s.connected);
      if (next) {
        this.hostConnId = next.connId;
        this.broadcastLobbyUpdate();
      }
    }
  }

  reconnect(connId: string, newWs: WebSocket): boolean {
    const slot = this.slots.find(s => s.connId === connId);
    if (!slot) return false;
    slot.ws = newWs;
    slot.connected = true;
    if (this.phase === 'running') {
      // Resend full state
      const ownBytes = new Uint8Array(this.gs.own.buffer);
      this.send(newWs, {
        type: 'gameStarting',
        seed: this.seed,
        terB64: Buffer.from(this.gs.ter.buffer).toString('base64'),
        ownB64: Buffer.from(ownBytes).toString('base64'),
        yourPlayerIndex: slot.playerIndex,
        playerNames: this.slots.map(s => s.name),
        playerColors: this.slots.map((_, i) => COL[i % COL.length]),
        botSpawns: [],
        spawnTimeoutMs: 0
      });
    }
    return true;
  }

  isEmpty(): boolean {
    return this.slots.every(s => !s.connected);
  }

  // ---- Game start ----

  startGame() {
    if (this.phase !== 'lobby') return;
    this.phase = 'spawning';
    this.seed = Math.random() * 1e5 | 0;

    this.gs.reset();
    genMap(this.gs, this.seed);

    // Assign player indices to human slots
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i].playerIndex = i;
    }

    // Find bot spawn suggestions (will be used again at finalize)
    const botSpawns = findSp(this.gs, this.botCount + this.slots.length + 5, this.seed);

    const terB64 = Buffer.from(this.gs.ter.buffer).toString('base64');
    const ownBytes = new Uint8Array(this.gs.own.buffer);
    const ownB64 = Buffer.from(ownBytes).toString('base64');

    // Pre-generate bot names so they match what finalizeSpawns will use
    const shuffledBotNames = [...NM].sort(() => Math.random() - 0.5);
    this.botNames = Array.from({ length: this.botCount }, (_, i) =>
      shuffledBotNames[i % shuffledBotNames.length] || `Bot ${i + 1}`
    );

    // Include both human and bot names/colors so the client P array covers all players
    const playerNames = [
      ...this.slots.map(s => s.name),
      ...this.botNames
    ];
    const playerColors = playerNames.map((_, i) => COL[i % COL.length]);

    for (const slot of this.slots) {
      this.send(slot.ws, {
        type: 'gameStarting',
        seed: this.seed,
        terB64,
        ownB64,
        yourPlayerIndex: slot.playerIndex,
        playerNames,
        playerColors,
        botSpawns: botSpawns.slice(0, this.botCount),
        spawnTimeoutMs: 30000
      });
    }

    this.spawnDeadline = Date.now() + 30000;
    this.spawnTimer = setTimeout(() => this.finalizeSpawns(), 30000);

    this.spawnBroadcastInterval = setInterval(() => {
      if (this.phase !== 'spawning') {
        if (this.spawnBroadcastInterval) clearInterval(this.spawnBroadcastInterval);
        return;
      }
      const chosenSpawns: SpawnPoint[] = this.slots
        .filter(s => s.spawnChosen)
        .map(s => ({ playerIndex: s.playerIndex, x: s.spawnX, y: s.spawnY, name: s.name }));
      this.broadcast({
        type: 'spawnUpdate',
        chosenSpawns,
        remainingMs: Math.max(0, this.spawnDeadline - Date.now())
      });
    }, 500);
  }

  // ---- Spawn phase ----

  handleSpawn(connId: string, x: number, y: number) {
    if (this.phase !== 'spawning') return;
    const slot = this.slots.find(s => s.connId === connId);
    if (!slot || slot.spawnChosen) return;
    const snapped = this.snapToLand(x, y);
    if (!snapped) return;
    slot.spawnChosen = true;
    slot.spawnX = snapped.x;
    slot.spawnY = snapped.y;
    this.addPlayerToState(slot, snapped.x, snapped.y);
  }

  private addPlayerToState(slot: PlayerSlot, sx: number, sy: number) {
    const i = slot.playerIndex;
    const r = 10;
    // Ensure P array is large enough
    while (this.gs.P.length <= i) this.gs.P.push(null as any);
    this.gs.P[i] = {
      id: i,
      name: slot.name,
      color: COL[i % COL.length],
      troops: 50,
      maxTroops: 200,
      money: 2000,
      hu: true,
      alive: true,
      df: this.difficulty,
      territory: 0,
      growth: 0,
      income: 0
    };
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) {
        const nx = sx + dx, ny = sy + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H && this.gs.ter[ny * W + nx] > 0)
          this.gs.own[ny * W + nx] = i;
      }
    }
  }

  private finalizeSpawns() {
    if (this.spawnBroadcastInterval) { clearInterval(this.spawnBroadcastInterval); this.spawnBroadcastInterval = null; }
    this.phase = 'running';

    // Auto-assign spawns for players who didn't choose
    const usedSpots = this.slots.filter(s => s.spawnChosen).map(s => ({ x: s.spawnX, y: s.spawnY }));
    const allSpawns = findSp(this.gs, this.slots.length + this.botCount + 10, this.seed);

    for (const slot of this.slots) {
      if (!slot.spawnChosen) {
        const sp = this.findAutoSpawn(allSpawns, usedSpots);
        if (sp) {
          slot.spawnChosen = true;
          slot.spawnX = sp.x;
          slot.spawnY = sp.y;
          usedSpots.push(sp);
          this.addPlayerToState(slot, sp.x, sp.y);
          this.send(slot.ws, { type: 'spawnForced', yourSpawn: sp });
        }
      }
    }

    // Add bots after humans (use names pre-generated in startGame to match client's P array)
    const baseIndex = this.slots.length;
    const botSpawnPool = allSpawns.filter(sp =>
      usedSpots.every(u => Math.hypot(u.x - sp.x, u.y - sp.y) > 80)
    );

    for (let i = 0; i < this.botCount && i < botSpawnPool.length; i++) {
      const bi = baseIndex + i;
      const sp = botSpawnPool[i];
      while (this.gs.P.length <= bi) this.gs.P.push(null as any);
      this.gs.P[bi] = {
        id: bi,
        name: this.botNames[i] || `Bot ${i + 1}`,
        color: COL[bi % COL.length],
        troops: 50,
        maxTroops: 200,
        money: 2000,
        hu: false,
        alive: true,
        df: this.difficulty,
        territory: 0,
        growth: 0,
        income: 0
      };
      const r = 10;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r && this.gs.ter[(sp.y + dy) * W + (sp.x + dx)] > 0)
          this.gs.own[(sp.y + dy) * W + (sp.x + dx)] = bi;
      }
      this.gs.bots.push(new Bot(this.gs, bi));
      usedSpots.push(sp);
    }

    // Remove any null placeholders
    this.gs.P = this.gs.P.filter(p => p !== null);

    // Snapshot own for delta tracking
    this.gs.prevOwn.set(this.gs.own);

    this.gs.run = true;
    this.tickInterval = setInterval(() => this.tick(), 100);
  }

  // ---- Game loop ----

  private tick() {
    if (this.phase !== 'running') return;

    // Run bots
    for (const bot of this.gs.bots) bot.u();

    // Save state before tick for change detection
    const bldHashBefore = this.gs.bld.map(b => `${b.id}:${b.ow}:${b.samCd ?? 0}`).join(',');
    const dipSizeBefore = this.gs.dip.size;
    const dipHashBefore = [...this.gs.dip.entries()].map(([k, v]) => `${k}:${v}`).join(',');

    this.gs.pendingNotifs = [];

    gameTick(this.gs);

    // Compute own delta
    const ownChanges = this.gs.computeOwnDelta();

    // Detect building changes
    const bldHashAfter = this.gs.bld.map(b => `${b.id}:${b.ow}:${b.samCd ?? 0}`).join(',');
    const bldChanged = bldHashAfter !== bldHashBefore;

    // Detect diplomacy changes
    const dipHashAfter = [...this.gs.dip.entries()].map(([k, v]) => `${k}:${v}`).join(',');
    const dipChanged = dipHashAfter !== dipHashBefore;

    // Check victory
    if (!this.gs.gOv && this.gs.tk > 50) {
      const totalClaimed = this.gs.P.reduce((s, p) => s + (p.alive ? p.territory : 0), 0) || 1;
      for (const p of this.gs.P) {
        if (!p.alive) continue;
        if (p.territory / totalClaimed >= 0.9) {
          this.gs.gOv = true;
          this.broadcast({
            type: 'gameOver',
            winnerId: p.id,
            winnerName: p.name,
            winnerTerritoryPct: p.territory / totalClaimed * 100
          });
          this.stopGame();
          return;
        }
      }
    }

    // Build tick message per client (notifs are player-specific)
    const baseTick = {
      tk: this.gs.tk,
      ownChanges,
      players: this.gs.P.map(p => ({
        id: p.id,
        troops: p.troops,
        maxTroops: p.maxTroops,
        money: p.money,
        territory: p.territory,
        growth: p.growth,
        income: p.income,
        alive: p.alive
      })),
      bldChanged,
      bld: bldChanged ? this.gs.bld.map(b => ({ id: b.id, type: b.type, ow: b.ow, x: b.x, y: b.y, samCd: b.samCd })) : null,
      units: this.gs.unt.map(u => ({ id: u.id, ty: u.ty, ow: u.ow, x: u.x, y: u.y, hp: u.hp })),
      missiles: this.gs.missiles.map(m => ({ id: m.id, pi: m.pi, type: m.type, x: m.x, y: m.y, tx: m.tx, ty: m.ty })),
      newExplosions: this.gs.exp.filter(e => e.f === 0).map(e => ({ x: e.x, y: e.y, rad: e.rad, f: e.f, mx: e.mx })),
      dipChanged,
      dip: dipChanged ? [...this.gs.dip.entries()] as Array<[string, string]> : null,
    };

    for (const slot of this.slots) {
      if (!slot.connected || slot.ws.readyState !== WebSocket.OPEN) continue;
      const myNotifs = this.gs.pendingNotifs
        .filter(n => n.pi === slot.playerIndex || n.pi === -99)
        .map(n => ({ msg: n.msg, color: n.color, ttl: n.ttl, pi: n.pi }));
      const msg: MsgTick = { type: 'tick', ...baseTick, notifs: myNotifs };
      slot.ws.send(JSON.stringify(msg));
    }
  }

  // ---- Action dispatch ----

  handleAction(connId: string, msg: ClientMessage) {
    if (this.phase !== 'running') return;
    const slot = this.slots.find(s => s.connId === connId);
    if (!slot) return;
    const pi = slot.playerIndex;

    if (msg.type === 'ratioChange') {
      this.gs.atkRatio.set(pi, Math.max(0.05, Math.min(1.0, msg.value)));
      return;
    }

    if (msg.type === 'action') {
      const p = this.gs.P[pi];
      if (!p?.alive) return;
      const a = msg.action;
      switch (a.kind) {
        case 'mkWave':
          mkWave(this.gs, pi, a.cx, a.cy, a.tr, a.targetOwner);
          break;
        case 'buildB':
          buildB(this.gs, pi, a.btype, a.x, a.y);
          break;
        case 'sD':
          sD(this.gs, pi, a.b, a.status);
          break;
        case 'doNuke':
          doNuke(this.gs, pi, a.nukeType, a.tx, a.ty);
          break;
        case 'spShip':
          spShip(this.gs, pi, a.wx, a.wy);
          break;
        case 'navInv':
          navInv(this.gs, pi, a.tx, a.ty);
          break;
      }
    }
  }

  // ---- Utilities ----

  private stopGame() {
    if (this.tickInterval) { clearInterval(this.tickInterval); this.tickInterval = null; }
    this.phase = 'over';
  }

  private broadcast(msg: ServerMessage) {
    const json = JSON.stringify(msg);
    for (const slot of this.slots) {
      if (slot.connected && slot.ws.readyState === WebSocket.OPEN) {
        slot.ws.send(json);
      }
    }
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  private snapToLand(x: number, y: number): { x: number; y: number } | null {
    for (let rad = 0; rad <= 10; rad++)
      for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        const nx = x + dx, ny = y + dy;
        if (B(nx, ny) && isL(this.gs, nx, ny)) return { x: nx, y: ny };
      }
    return null;
  }

  private findAutoSpawn(
    candidates: Array<{ x: number; y: number }>,
    used: Array<{ x: number; y: number }>
  ): { x: number; y: number } | null {
    for (const c of candidates) {
      const tooClose = used.some(u => Math.hypot(u.x - c.x, u.y - c.y) < 60);
      if (!tooClose) return c;
    }
    return candidates[0] || null;
  }
}
