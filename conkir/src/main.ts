import './style.css';
import './input'; // registers all event listeners
import { beginSpawnPhase, beginMultiplayerSpawnPhase, launchMultiplayerGame, updateMpSpawnInfo } from './init';
import { W, H } from './constants';
import { setTer, setOwn, setAtkRatio, P } from './state';
import { connect, send, onMsg, applyGameStart, isMultiplayer, getMyPlayerIndex } from './network';

// Auto-detect WebSocket URL (localhost → dev server, else production)
const WS_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'ws://localhost:3000/ws'
  : `wss://${location.host}/ws`;

// ---- Solo game ----

(document.getElementById('startBtn') as HTMLButtonElement).onclick = () => {
  const df = parseInt((document.getElementById('dif') as HTMLSelectElement).value);
  const bc = parseInt((document.getElementById('bots') as HTMLSelectElement).value);
  const sd = Math.random() * 1e5 | 0;
  setTer(new Uint8Array(W * H));
  setOwn(new Int16Array(W * H).fill(-2));
  beginSpawnPhase(sd, df, bc);
  (document.getElementById('menu') as HTMLElement).style.display = 'none';
};

// Attack ratio slider — updates local state and sends ratioChange in MP mode
document.addEventListener('input', e => {
  const target = e.target as HTMLInputElement;
  if (target.id === 'ratioSlider') {
    const val = parseInt(target.value) / 100;
    setAtkRatio(val);
    (document.getElementById('ratioVal') as HTMLElement).textContent = target.value + '%';
    if (isMultiplayer()) send({ type: 'ratioChange', value: val });
  }
});

// ---- Multiplayer state ----

let _mpMySpawn: { x: number; y: number } | null = null;
let _mpGameLaunched = false;
let _mpDefeated = false;

function launchMpIfReady() {
  if (!_mpGameLaunched && _mpMySpawn) {
    _mpGameLaunched = true;
    launchMultiplayerGame(_mpMySpawn.x, _mpMySpawn.y);
  }
}

// ---- Lobby UI wiring ----

(document.getElementById('mpBtn') as HTMLButtonElement).onclick = () => {
  (document.getElementById('lobbyScreen') as HTMLElement).style.display = 'flex';
  (document.getElementById('menu') as HTMLElement).style.display = 'none';
};

(document.getElementById('lobbyBackBtn') as HTMLButtonElement).onclick = () => {
  (document.getElementById('lobbyScreen') as HTMLElement).style.display = 'none';
  (document.getElementById('menu') as HTMLElement).style.display = '';
  (document.getElementById('lobbyJoinSection') as HTMLElement).style.display = 'block';
  (document.getElementById('waitingRoom') as HTMLElement).style.display = 'none';
  clearLobbyError();
};

(document.getElementById('createLobbyBtn') as HTMLButtonElement).onclick = async () => {
  const name = (document.getElementById('mpName') as HTMLInputElement).value.trim() || 'Player';
  const botCount = parseInt((document.getElementById('mpBotCount') as HTMLSelectElement).value);
  const difficulty = parseInt((document.getElementById('mpDifficulty') as HTMLSelectElement).value);
  clearLobbyError();
  try {
    await connect(WS_URL);
    send({ type: 'lobbyCreate', playerName: name, botCount, difficulty });
  } catch {
    showLobbyError('Could not connect to server');
  }
};

(document.getElementById('joinLobbyBtn') as HTMLButtonElement).onclick = async () => {
  const name = (document.getElementById('mpName') as HTMLInputElement).value.trim() || 'Player';
  const code = (document.getElementById('lobbyCode') as HTMLInputElement).value.trim().toUpperCase();
  if (!code) { showLobbyError('Enter a room code'); return; }
  clearLobbyError();
  try {
    await connect(WS_URL);
    send({ type: 'lobbyJoin', code, playerName: name });
  } catch {
    showLobbyError('Could not connect to server');
  }
};

(document.getElementById('startMpBtn') as HTMLButtonElement).onclick = () => {
  send({ type: 'lobbyStart' });
};

document.getElementById('mpBotCount')?.addEventListener('change', () => {
  if (!isMultiplayer()) return;
  const botCount = parseInt((document.getElementById('mpBotCount') as HTMLSelectElement).value);
  const difficulty = parseInt((document.getElementById('mpDifficulty') as HTMLSelectElement).value);
  send({ type: 'lobbyConfig', botCount, difficulty });
});

document.getElementById('mpDifficulty')?.addEventListener('change', () => {
  if (!isMultiplayer()) return;
  const botCount = parseInt((document.getElementById('mpBotCount') as HTMLSelectElement).value);
  const difficulty = parseInt((document.getElementById('mpDifficulty') as HTMLSelectElement).value);
  send({ type: 'lobbyConfig', botCount, difficulty });
});

// ---- Server message handlers ----

onMsg('lobbyCreated', () => {
  (document.getElementById('lobbyJoinSection') as HTMLElement).style.display = 'none';
  (document.getElementById('waitingRoom') as HTMLElement).style.display = 'block';
});

onMsg('lobbyUpdate', (msg) => {
  (document.getElementById('lobbyJoinSection') as HTMLElement).style.display = 'none';
  (document.getElementById('waitingRoom') as HTMLElement).style.display = 'block';
  (document.getElementById('lobbyCodeDisplay') as HTMLElement).textContent = msg.code;

  const list = document.getElementById('waitingPlayerList') as HTMLElement;
  list.innerHTML = msg.players
    .map(p => `<div class="wp">${p.isHost ? '👑 ' : ''}${p.name}</div>`)
    .join('');

  (document.getElementById('mpBotCount') as HTMLSelectElement).value = String(msg.botCount);
  (document.getElementById('mpDifficulty') as HTMLSelectElement).value = String(msg.difficulty);

  const startBtn = document.getElementById('startMpBtn') as HTMLElement;
  startBtn.style.display = msg.hostIsYou ? 'block' : 'none';

  document.querySelectorAll<HTMLElement>('.lobbyHostOnly').forEach(el => {
    el.style.display = msg.hostIsYou ? '' : 'none';
  });
});

onMsg('lobbyError', (msg) => {
  const reasons: Record<string, string> = {
    notFound: 'Room not found',
    full: 'Room is full (max 8 players)',
    inProgress: 'Game already in progress'
  };
  showLobbyError(reasons[msg.reason] || msg.reason);
});

onMsg('gameStarting', (msg) => {
  _mpMySpawn = null;
  _mpGameLaunched = false;
  _mpDefeated = false;
  applyGameStart(msg);
  (document.getElementById('lobbyScreen') as HTMLElement).style.display = 'none';
  beginMultiplayerSpawnPhase(msg, (x, y) => {
    _mpMySpawn = { x, y };
    send({ type: 'spawn', x, y });
  });
});

onMsg('spawnUpdate', (msg) => {
  updateMpSpawnInfo(msg.chosenSpawns, msg.remainingMs);
});

onMsg('spawnForced', (msg) => {
  _mpMySpawn = msg.yourSpawn;
  launchMpIfReady();
});

// First tick signals that the spawn phase is over and the game has begun
onMsg('tick', () => {
  launchMpIfReady();
  // Show defeat overlay if human player just died
  if (_mpGameLaunched && !_mpDefeated) {
    const hi = P.findIndex(p => p.hu);
    if (hi >= 0 && !P[hi].alive) {
      _mpDefeated = true;
      (document.getElementById('go') as HTMLElement).style.display = 'flex';
      (document.getElementById('goT') as HTMLElement).textContent = '💀 DEFEATED';
      (document.getElementById('goP') as HTMLElement).textContent = 'Your territory has been eliminated.';
    }
  }
});

onMsg('gameOver', (msg) => {
  const ov = document.getElementById('victoryOverlay') as HTMLElement;
  const msgEl = document.getElementById('victoryMsg') as HTMLElement;
  const imWinner = msg.winnerId === getMyPlayerIndex();
  msgEl.textContent = imWinner
    ? `🏆 VICTORY! You control ${msg.winnerTerritoryPct.toFixed(1)}% of the world!`
    : `${msg.winnerName} has conquered the world! (${msg.winnerTerritoryPct.toFixed(1)}%)`;
  ov.style.display = 'flex';
});

// ---- UI helpers ----

function showLobbyError(msg: string) {
  const el = document.getElementById('lobbyError') as HTMLElement;
  el.textContent = msg;
  el.style.display = 'block';
}

function clearLobbyError() {
  const el = document.getElementById('lobbyError') as HTMLElement;
  el.textContent = '';
  el.style.display = 'none';
}
