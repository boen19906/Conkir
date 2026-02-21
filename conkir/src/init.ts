import {
  P, bld, unt, exp, bullets, wav, missiles, notifs,
  setP, setBld, setUnt, setExp, setBullets, setWav, setMissiles, setNotifs,
  setTk, setBots, setDip, setPendingPeace, setConflictIntensity, setBetrayalDebuff,
  setRun, setGOv, setVictoryShown, setOnVictory,
  bots, run, gOv,
  resetIds
} from './state';
import { W, H, NM, COL, C } from './constants';
import { own, ter } from './state';
import { genMap, findSp, isL, B, I } from './mapgen';
import { Bot } from './bot';
import { render, rsz, setCam, resetRenderCache } from './render';
import { gameTick } from './tick';
import { updUI } from './ui';
import type { MsgGameStarting, SpawnPoint } from './protocol';

interface SpawnData {
  sd: number;
  df: number;
  bc: number;
  botSp: Array<{ x: number; y: number }>;
  sn: string[];
}

let _spawnData: SpawnData | null = null;
let acc = 0, lt = 0;

// ---- Multiplayer spawn state (updated by main.ts via updateMpSpawnInfo) ----
let _mpChosenSpawns: SpawnPoint[] = [];
let _mpRemainingMs = 30000;

export function updateMpSpawnInfo(spawns: SpawnPoint[], remainingMs: number) {
  _mpChosenSpawns = spawns;
  _mpRemainingMs = remainingMs;
}

// ---- Solo game loop ----
function loop(now: number) {
  if (!run) return;
  const dt = Math.min(now - lt, 100); lt = now; acc += dt;
  const iv = 1000 / C.tr;
  while (acc >= iv) {
    for (const b of bots) b.u();
    gameTick();
    acc -= iv;
  }
  render(); updUI();
  if (!gOv) {
    const h = P.find(p => p.hu);
    if (h && !h.alive) {
      setGOv(true);
      (document.getElementById('go') as HTMLElement).style.display = 'flex';
      (document.getElementById('goT') as HTMLElement).textContent = '💀 DEFEATED';
      (document.getElementById('goP') as HTMLElement).textContent = 'Your territory has been eliminated.';
    } else if (P.filter(p => p.alive).length <= 1 && h?.alive) {
      setGOv(true);
      (document.getElementById('go') as HTMLElement).style.display = 'flex';
      (document.getElementById('goT') as HTMLElement).textContent = '🏆 VICTORY!';
      (document.getElementById('goP') as HTMLElement).textContent = 'You conquered the world!';
    }
  }
  requestAnimationFrame(loop);
}

// ---- Multiplayer render-only loop ----
let _mpRunning = false;
function multiplayerLoop() {
  if (!_mpRunning) return;
  render();
  updUI();
  requestAnimationFrame(multiplayerLoop);
}

export function addP(nm: string, sx: number, sy: number, hu: boolean, df: number) {
  const i = P.length;
  P.push({ id: i, name: nm, color: COL[i % COL.length], troops: 50, maxTroops: 200, money: 2000, hu, alive: true, df, territory: 0, growth: 0, income: 0 });
  const r = 10;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++)
    if (dx * dx + dy * dy <= r * r && isL(sx + dx, sy + dy)) own[I(sx + dx, sy + dy)] = i;
  return i;
}

export function beginSpawnPhase(sd: number, df: number, bc: number) {
  genMap(sd);
  const botSp = findSp(bc, sd);
  const sn = [...NM].sort(() => Math.random() - .5);
  _spawnData = { sd, df, bc, botSp, sn };

  const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
  const ox = oc.getContext('2d') as CanvasRenderingContext2D;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = ter[I(x, y)];
    ox.fillStyle = t === 0 ? '#071828' : t === 1 ? '#2a5218' : t === 2 ? '#4a7c2f' : '#6b9e40';
    ox.fillRect(x, y, 1, 1);
  }

  const ss = document.getElementById('spawnScreen') as HTMLElement; ss.style.display = 'block';
  const sc = document.getElementById('spawnCanvas') as HTMLCanvasElement;
  sc.width = window.innerWidth; sc.height = window.innerHeight;
  const ctx2 = sc.getContext('2d') as CanvasRenderingContext2D;
  const scaleX = sc.width / W, scaleY = sc.height / H;
  let hovX = -1, hovY = -1;

  sc.onmousemove = (e) => {
    const r = sc.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / scaleX) | 0, my = ((e.clientY - r.top) / scaleY) | 0;
    if (B(mx, my) && isL(mx, my)) { hovX = mx; hovY = my; } else { hovX = -1; hovY = -1; }
  };

  function drawSpawn() {
    ctx2.clearRect(0, 0, sc.width, sc.height);
    ctx2.drawImage(oc, 0, 0, sc.width, sc.height);
    if (hovX >= 0) {
      ctx2.fillStyle = 'rgba(74,144,217,0.35)'; ctx2.fillRect(hovX * scaleX - 8, hovY * scaleY - 8, 16, 16);
      ctx2.strokeStyle = '#7ec8e3'; ctx2.lineWidth = 1.5; ctx2.strokeRect(hovX * scaleX - 8, hovY * scaleY - 8, 16, 16);
    }
    const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 450);
    for (let i = 0; i < botSp.length; i++) {
      const bx2 = botSp[i].x * scaleX, by2 = botSp[i].y * scaleY;
      ctx2.beginPath(); ctx2.arc(bx2, by2, 11 * pulse, 0, Math.PI * 2);
      ctx2.strokeStyle = `rgba(231,76,60,${pulse * 0.8})`; ctx2.lineWidth = 2; ctx2.stroke();
      ctx2.beginPath(); ctx2.arc(bx2, by2, 5, 0, Math.PI * 2); ctx2.fillStyle = '#E74C3C'; ctx2.fill();
      ctx2.fillStyle = '#ffaaaa'; ctx2.font = 'bold 10px monospace'; ctx2.textAlign = 'center';
      ctx2.fillText(sn[i]?.split(' ')[0] || 'Bot', bx2, by2 - 13);
    }
    if (ss.style.display !== 'none') requestAnimationFrame(drawSpawn);
  }
  drawSpawn();

  sc.onclick = (e) => {
    const r = sc.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / scaleX) | 0, my = ((e.clientY - r.top) / scaleY) | 0;
    let lx = mx, ly = my, found = false;
    for (let rad = 0; rad <= 10 && !found; rad++)
      for (let dy = -rad; dy <= rad && !found; dy++) for (let dx = -rad; dx <= rad && !found; dx++)
        if (B(mx + dx, my + dy) && isL(mx + dx, my + dy)) { lx = mx + dx; ly = my + dy; found = true; }
    if (!found) return;
    launchGame(lx, ly);
  };
}

export function launchGame(spawnX: number, spawnY: number) {
  const data = _spawnData!;
  const { df, bc, botSp, sn } = data;
  setP([]); setBld([]); setUnt([]); setExp([]); setBullets([]); setWav([]);
  setTk(0); setBots([]); resetRenderCache();
  setDip(new Map()); resetIds();
  setMissiles([]); setNotifs([]); setPendingPeace([]);
  setConflictIntensity(new Map()); setBetrayalDebuff(new Map()); setVictoryShown(false);
  (document.getElementById('victoryOverlay') as HTMLElement).style.display = 'none';
  const pname = (document.getElementById('playerName') as HTMLInputElement).value.trim() || 'You';
  addP(pname, spawnX, spawnY, true, df);
  setCam(spawnX, spawnY);
  const newBots: Bot[] = [];
  for (let i = 0; i < bc && i < botSp.length; i++) {
    const bi = addP(sn[i], botSp[i].x, botSp[i].y, false, df);
    newBots.push(new Bot(bi));
  }
  setBots(newBots);
  (document.getElementById('spawnScreen') as HTMLElement).style.display = 'none';
  (document.getElementById('menu') as HTMLElement).style.display = 'none';
  (document.getElementById('hud') as HTMLElement).style.display = 'flex';
  (document.getElementById('plist') as HTMLElement).style.display = 'block';
  setRun(true); setGOv(false); lt = performance.now(); acc = 0;
  (document.getElementById('ratioBar') as HTMLElement).style.display = 'flex';
  // Register solo victory overlay handler
  setOnVictory((p) => {
    const totalClaimed = P.reduce((s, pp) => s + (pp.alive ? pp.territory : 0), 0) || 1;
    const isHuman = p.hu;
    const msg = isHuman
      ? `🏆 VICTORY! You control ${(p.territory / totalClaimed * 100).toFixed(1)}% of the world!`
      : `${p.name} has conquered the world! (${(p.territory / totalClaimed * 100).toFixed(1)}%)`;
    const ov = document.getElementById('victoryOverlay');
    if (ov) {
      (document.getElementById('victoryMsg') as HTMLElement).textContent = msg;
      ov.style.display = 'flex';
    }
  });
  requestAnimationFrame(loop);
}

// ---- Multiplayer spawn phase ----
export function beginMultiplayerSpawnPhase(msg: MsgGameStarting, onSpawn: (x: number, y: number) => void) {
  const botSp = msg.botSpawns;
  _mpChosenSpawns = [];
  _mpRemainingMs = msg.spawnTimeoutMs;

  const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
  const ox = oc.getContext('2d') as CanvasRenderingContext2D;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const t = ter[I(x, y)];
    ox.fillStyle = t === 0 ? '#071828' : t === 1 ? '#2a5218' : t === 2 ? '#4a7c2f' : '#6b9e40';
    ox.fillRect(x, y, 1, 1);
  }

  const ss = document.getElementById('spawnScreen') as HTMLElement; ss.style.display = 'block';
  const sc = document.getElementById('spawnCanvas') as HTMLCanvasElement;
  sc.width = window.innerWidth; sc.height = window.innerHeight;
  const ctx2 = sc.getContext('2d') as CanvasRenderingContext2D;
  const scaleX = sc.width / W, scaleY = sc.height / H;
  let hovX = -1, hovY = -1;
  let mySpawnX = -1, mySpawnY = -1; // -1 means not yet chosen

  sc.onmousemove = (e) => {
    const rect = sc.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / scaleX) | 0, my = ((e.clientY - rect.top) / scaleY) | 0;
    if (B(mx, my) && isL(mx, my)) { hovX = mx; hovY = my; } else { hovX = -1; hovY = -1; }
  };

  function drawSpawn() {
    ctx2.clearRect(0, 0, sc.width, sc.height);
    ctx2.drawImage(oc, 0, 0, sc.width, sc.height);

    // Hover highlight
    if (hovX >= 0) {
      ctx2.fillStyle = 'rgba(74,144,217,0.35)'; ctx2.fillRect(hovX * scaleX - 8, hovY * scaleY - 8, 16, 16);
      ctx2.strokeStyle = '#7ec8e3'; ctx2.lineWidth = 1.5; ctx2.strokeRect(hovX * scaleX - 8, hovY * scaleY - 8, 16, 16);
    }

    // Bot spawn indicators
    const pulse = 0.65 + 0.35 * Math.sin(Date.now() / 450);
    for (const sp of botSp) {
      const bx = sp.x * scaleX, by = sp.y * scaleY;
      ctx2.beginPath(); ctx2.arc(bx, by, 11 * pulse, 0, Math.PI * 2);
      ctx2.strokeStyle = `rgba(231,76,60,${pulse * 0.8})`; ctx2.lineWidth = 2; ctx2.stroke();
      ctx2.beginPath(); ctx2.arc(bx, by, 5, 0, Math.PI * 2); ctx2.fillStyle = '#E74C3C'; ctx2.fill();
    }

    // Other players' chosen spawns
    for (const sp of _mpChosenSpawns) {
      const sx = sp.x * scaleX, sy = sp.y * scaleY;
      const col = '#' + (P[sp.playerIndex]?.color ?? 0x4A90D9).toString(16).padStart(6, '0');
      ctx2.beginPath(); ctx2.arc(sx, sy, 8, 0, Math.PI * 2);
      ctx2.fillStyle = col; ctx2.fill();
      ctx2.strokeStyle = '#fff'; ctx2.lineWidth = 1.5; ctx2.stroke();
      ctx2.fillStyle = '#fff'; ctx2.font = 'bold 9px monospace'; ctx2.textAlign = 'center';
      ctx2.fillText(sp.name.split(' ')[0], sx, sy - 11);
    }

    // My chosen spawn marker (pulsing blue star)
    if (mySpawnX >= 0) {
      const mx2 = mySpawnX * scaleX, my2 = mySpawnY * scaleY;
      ctx2.beginPath(); ctx2.arc(mx2, my2, 10 * pulse, 0, Math.PI * 2);
      ctx2.strokeStyle = `rgba(74,144,217,${pulse})`; ctx2.lineWidth = 2.5; ctx2.stroke();
      ctx2.beginPath(); ctx2.arc(mx2, my2, 5, 0, Math.PI * 2);
      ctx2.fillStyle = '#4A90D9'; ctx2.fill();
      ctx2.strokeStyle = '#fff'; ctx2.lineWidth = 1.5; ctx2.stroke();
      ctx2.fillStyle = '#fff'; ctx2.font = 'bold 9px monospace'; ctx2.textAlign = 'center';
      ctx2.fillText('You', mx2, my2 - 13);
    }

    // Timer and hint
    const timerEl = document.getElementById('spawnTimer');
    if (timerEl) {
      const secs = Math.ceil(_mpRemainingMs / 1000);
      timerEl.textContent = mySpawnX >= 0
        ? `${secs}s — Click to change spawn`
        : `${secs}s — Click to choose spawn`;
    }

    if (ss.style.display !== 'none') requestAnimationFrame(drawSpawn);
  }
  drawSpawn();

  sc.onclick = (e) => {
    const rect = sc.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / scaleX) | 0, my = ((e.clientY - rect.top) / scaleY) | 0;
    let lx = mx, ly = my, found = false;
    for (let rad = 0; rad <= 10 && !found; rad++)
      for (let dy = -rad; dy <= rad && !found; dy++) for (let dx = -rad; dx <= rad && !found; dx++)
        if (B(mx + dx, my + dy) && isL(mx + dx, my + dy)) { lx = mx + dx; ly = my + dy; found = true; }
    if (!found) return;
    mySpawnX = lx; mySpawnY = ly;
    hovX = -1; hovY = -1;
    onSpawn(lx, ly);
  };
}

// ---- Multiplayer game launch (no state init — server owns all state) ----
export function launchMultiplayerGame(spawnX: number, spawnY: number) {
  (document.getElementById('spawnScreen') as HTMLElement).style.display = 'none';
  (document.getElementById('menu') as HTMLElement).style.display = 'none';
  (document.getElementById('hud') as HTMLElement).style.display = 'flex';
  (document.getElementById('plist') as HTMLElement).style.display = 'block';
  (document.getElementById('ratioBar') as HTMLElement).style.display = 'flex';
  if (spawnX > 0 || spawnY > 0) setCam(spawnX, spawnY);
  _mpRunning = true;
  requestAnimationFrame(multiplayerLoop);
}

// init resize listener
addEventListener('resize', rsz);
rsz();
