import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { LobbyManager } from './lobby';

const PORT = parseInt(process.env.PORT || '3000');
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
const lobby = new LobbyManager();

// Serve the Vite-built client
const STATIC_DIR = join(__dirname, '../../conkir/dist');
app.use(express.static(STATIC_DIR));

// SPA fallback
app.get('*', (_, res) => {
  res.sendFile(join(STATIC_DIR, 'index.html'));
});

// WebSocket connections
wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/ws', `http://${req.headers.host}`);
  let connId = url.searchParams.get('connId') || '';

  // Validate UUID format; generate new if missing/invalid
  if (!/^[0-9a-f-]{36}$/.test(connId)) {
    connId = randomUUID();
    ws.send(JSON.stringify({ type: 'connId', id: connId }));
  }

  lobby.onConnect(ws, connId);
});

httpServer.listen(PORT, () => {
  console.log(`Conkir.io server running on port ${PORT}`);
  console.log(`Static files: ${STATIC_DIR}`);
});
