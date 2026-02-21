import './style.css';
import './input'; // registers all event listeners
import { beginSpawnPhase, beginMultiplayerSpawnPhase, launchMultiplayerGame, updateMpSpawnInfo } from './init';
import { W, H } from './constants';
import { setTer, setOwn, setAtkRatio, setBotProposals, botProposals, P } from './state';
import { sD } from './diplomacy';
import { connect, send, onMsg, applyGameStart, isMultiplayer, getMyPlayerIndex } from './network';

// Auto-detect WebSocket URL (localhost → dev server, else production)
const WS_URL = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'ws://localhost:3000/ws'
  : `wss://${location.host}/ws`;

// ---- Name persistence ----

const STORED_NAME_KEY = 'conkir_playerName';

function getStoredName(): string {
  return localStorage.getItem(STORED_NAME_KEY) || '';
}

function saveStoredName(name: string) {
  localStorage.setItem(STORED_NAME_KEY, name);
}

// Pre-fill name inputs from localStorage on load
const playerNameInput = document.getElementById('playerName') as HTMLInputElement;
const mpNameInput = document.getElementById('mpName') as HTMLInputElement;
const storedName = getStoredName();
if (storedName) {
  playerNameInput.value = storedName;
  mpNameInput.value = storedName;
}

playerNameInput.addEventListener('input', () => {
  const v = playerNameInput.value;
  saveStoredName(v);
  mpNameInput.value = v;
});

// ---- Menu page navigation ----

(document.getElementById('soloSetupBtn') as HTMLButtonElement).onclick = () => {
  (document.getElementById('menuHome') as HTMLElement).style.display = 'none';
  (document.getElementById('menuSoloSetup') as HTMLElement).style.display = 'block';
};

(document.getElementById('soloBackBtn') as HTMLButtonElement).onclick = () => {
  (document.getElementById('menuSoloSetup') as HTMLElement).style.display = 'none';
  (document.getElementById('menuHome') as HTMLElement).style.display = 'block';
};

// ---- Solo game start ----

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

// Helper: sync mpName from playerName before opening lobby
function syncMpName() {
  const n = playerNameInput.value.trim();
  if (n) mpNameInput.value = n;
}

// CREATE LOBBY from main menu
(document.getElementById('createLobbyMainBtn') as HTMLButtonElement).onclick = async () => {
  syncMpName();
  const name = mpNameInput.value.trim() || 'Player';
  const botCount = parseInt((document.getElementById('mpBotCount') as HTMLSelectElement).value);
  const difficulty = parseInt((document.getElementById('mpDifficulty') as HTMLSelectElement).value);
  (document.getElementById('lobbyScreen') as HTMLElement).style.display = 'flex';
  (document.getElementById('menu') as HTMLElement).style.display = 'none';
  (document.getElementById('lobbyJoinSection') as HTMLElement).style.display = 'none';
  (document.getElementById('waitingRoom') as HTMLElement).style.display = 'none';
  clearLobbyError();
  try {
    await connect(WS_URL);
    send({ type: 'lobbyCreate', playerName: name, botCount, difficulty });
  } catch {
    showLobbyError('Could not connect to server');
  }
};

// JOIN LOBBY from main menu — show lobby screen with join section
(document.getElementById('joinLobbyMainBtn') as HTMLButtonElement).onclick = () => {
  syncMpName();
  (document.getElementById('lobbyScreen') as HTMLElement).style.display = 'flex';
  (document.getElementById('menu') as HTMLElement).style.display = 'none';
  (document.getElementById('lobbyJoinSection') as HTMLElement).style.display = 'flex';
  (document.getElementById('waitingRoom') as HTMLElement).style.display = 'none';
  clearLobbyError();
};

(document.getElementById('lobbyBackBtn') as HTMLButtonElement).onclick = () => {
  (document.getElementById('lobbyScreen') as HTMLElement).style.display = 'none';
  (document.getElementById('menu') as HTMLElement).style.display = '';
  (document.getElementById('menuHome') as HTMLElement).style.display = 'block';
  (document.getElementById('menuSoloSetup') as HTMLElement).style.display = 'none';
  (document.getElementById('lobbyJoinSection') as HTMLElement).style.display = 'block';
  (document.getElementById('waitingRoom') as HTMLElement).style.display = 'none';
  clearLobbyError();
};

(document.getElementById('createLobbyBtn') as HTMLButtonElement).onclick = async () => {
  const name = mpNameInput.value.trim() || 'Player';
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
  const name = mpNameInput.value.trim() || 'Player';
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

// Click room code to copy it
document.getElementById('lobbyCodeDisplay')?.addEventListener('click', () => {
  const code = (document.getElementById('lobbyCodeDisplay') as HTMLElement).textContent || '';
  if (!code) return;
  navigator.clipboard.writeText(code).then(() => {
    const hint = document.getElementById('lobbyCodeCopyHint') as HTMLElement;
    hint.textContent = '✓ Copied!';
    hint.style.color = '#2ECC71';
    setTimeout(() => { hint.textContent = 'Click code to copy'; hint.style.color = ''; }, 2000);
  });
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
    el.style.display = msg.hostIsYou ? 'flex' : 'none';
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

onMsg('peaceProposal', (msg) => {
  if (msg.isBot) {
    // Bot proposal: inline notification card (not modal)
    if (!botProposals.some(p => p.from === msg.proposerIndex)) {
      setBotProposals([...botProposals, { from: msg.proposerIndex, name: msg.proposerName, color: msg.proposerColor, addedAt: Date.now() }]);
    }
    return;
  }

  // Human→human proposal: modal overlay
  const ov = document.getElementById('peaceOverlay') as HTMLElement;
  const msgEl = document.getElementById('peaceProposalMsg') as HTMLElement;
  const acceptBtn = document.getElementById('peaceAcceptBtn') as HTMLButtonElement;
  const rejectBtn = document.getElementById('peaceRejectBtn') as HTMLButtonElement;

  msgEl.innerHTML = `<span style="color:#FFD700;font-weight:700">${msg.proposerName}</span> is proposing peace.<br><span style="font-size:12px;opacity:0.7">Do you accept?</span>`;
  ov.style.display = 'flex';

  const close = () => { ov.style.display = 'none'; };
  acceptBtn.onclick = () => {
    send({ type: 'action', action: { kind: 'peaceAccept', target: msg.proposerIndex } });
    close();
  };
  rejectBtn.onclick = () => {
    send({ type: 'action', action: { kind: 'peaceReject', target: msg.proposerIndex } });
    close();
  };
});

onMsg('gameOver', (msg) => {
  // Hide defeat overlay if visible — show the victory/game over overlay instead
  (document.getElementById('go') as HTMLElement).style.display = 'none';
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
