import { WebSocket } from 'ws';
import { GameRoom } from './gameRoom';
import type { ClientMessage, ServerMessage } from './protocol';
import { randomUUID } from 'crypto';

interface ConnectedClient {
  ws: WebSocket;
  connId: string;
  roomCode: string | null;
}

export class LobbyManager {
  private rooms = new Map<string, GameRoom>();
  private clients = new Map<string, ConnectedClient>();

  onConnect(ws: WebSocket, connId: string) {
    this.clients.set(connId, { ws, connId, roomCode: null });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as ClientMessage;
        this.handleMessage(connId, msg);
      } catch { /* ignore malformed */ }
    });

    ws.on('close', () => {
      const client = this.clients.get(connId);
      if (client?.roomCode) {
        const room = this.rooms.get(client.roomCode);
        if (room) {
          room.markDisconnected(connId);
          // Clean up empty rooms after 5 minutes
          setTimeout(() => {
            if (room.isEmpty()) this.rooms.delete(client.roomCode!);
          }, 5 * 60 * 1000);
        }
      }
      this.clients.delete(connId);
    });
  }

  private handleMessage(connId: string, msg: ClientMessage) {
    const client = this.clients.get(connId);
    if (!client) return;

    switch (msg.type) {
      case 'ping':
        this.send(client.ws, { type: 'pong', ts: msg.ts, serverTs: Date.now() });
        return;

      case 'lobbyCreate': {
        const code = this.generateCode();
        const room = new GameRoom(code, connId, client.ws, msg.playerName, msg.botCount, msg.difficulty);
        this.rooms.set(code, room);
        client.roomCode = code;
        this.send(client.ws, { type: 'lobbyCreated', code, playerId: 0, playerName: msg.playerName });
        room.broadcastLobbyUpdate();
        return;
      }

      case 'lobbyJoin': {
        const code = msg.code.toUpperCase();
        const room = this.rooms.get(code);
        if (!room) { this.send(client.ws, { type: 'lobbyError', reason: 'notFound' }); return; }
        if (room.phase !== 'lobby') { this.send(client.ws, { type: 'lobbyError', reason: 'inProgress' }); return; }
        if (room.slots.length >= 8) { this.send(client.ws, { type: 'lobbyError', reason: 'full' }); return; }
        const success = room.addPlayer(client.ws, connId, msg.playerName);
        if (!success) { this.send(client.ws, { type: 'lobbyError', reason: 'full' }); return; }
        client.roomCode = code;
        return;
      }

      case 'lobbyStart': {
        if (!client.roomCode) return;
        const room = this.rooms.get(client.roomCode);
        if (!room || room.hostConnId !== connId) return;
        room.startGame();
        return;
      }

      case 'lobbyConfig': {
        if (!client.roomCode) return;
        const room = this.rooms.get(client.roomCode);
        if (!room || room.hostConnId !== connId) return;
        room.updateConfig(
          msg.botCount !== undefined ? msg.botCount : room.botCount,
          msg.difficulty !== undefined ? msg.difficulty : room.difficulty
        );
        return;
      }

      case 'spawn': {
        if (!client.roomCode) return;
        const room = this.rooms.get(client.roomCode);
        if (!room) return;
        room.handleSpawn(connId, msg.x, msg.y);
        return;
      }

      case 'action':
      case 'ratioChange': {
        if (!client.roomCode) return;
        const room = this.rooms.get(client.roomCode);
        if (!room) return;
        room.handleAction(connId, msg);
        return;
      }
    }
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = Array.from({ length: 6 }, () => chars[Math.random() * chars.length | 0]).join('');
    } while (this.rooms.has(code));
    return code;
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }
}
