import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { randomInt } from 'node:crypto';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const story = JSON.parse(await readFile(new URL('./story/chapter1.json', import.meta.url), 'utf8'));
const rooms = new Map();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = () => Array.from({length: 5}, () => alphabet[randomInt(alphabet.length)]).join('');
const safeName = value => typeof value === 'string' ? value.trim().slice(0, 24) : '';
const roomView = room => ({code: room.code, sceneId: room.sceneId, scene: story[room.sceneId], hostId: room.hostId, players: [...room.players].map(([id, p]) => ({id, name:p.name, voted:room.votes.has(id)})), votes: room.votes.size});
const publish = room => io.to(room.code).emit('room:update', roomView(room));
const failure = (ack, message) => { if (typeof ack === 'function') ack({ok:false, error:message}); };
function leave(socket) {
  const room = rooms.get(socket.data.roomCode);
  if (!room) return;
  room.players.delete(socket.id);
  room.votes.delete(socket.id);
  socket.leave(room.code);
  socket.data.roomCode = null;
  if (room.players.size === 0) rooms.delete(room.code);
  else {
    if (room.hostId === socket.id) room.hostId = room.players.keys().next().value;
    resolveIfReady(room);
    if (rooms.has(room.code)) publish(room);
  }
}
function resolveIfReady(room) {
  if (!room.players.size || room.votes.size !== room.players.size) return;
  const scene = story[room.sceneId];
  const counts = (scene.choices || []).map((_, i) => [...room.votes.values()].filter(v => v === i).length);
  // A tied vote is resolved by the first tied choice in story order.
  const winner = counts.indexOf(Math.max(...counts));
  if (winner < 0 || !scene.choices[winner] || !story[scene.choices[winner].next]) return;
  const winningText = scene.choices[winner].text;
  room.sceneId = scene.choices[winner].next;
  room.votes.clear();
  io.to(room.code).emit('room:result', {choice:winningText});
}
io.on('connection', socket => {
  socket.on('room:create', (name, ack) => {
    if (!safeName(name)) return failure(ack, 'Enter a player name.');
    leave(socket);
    if (rooms.size >= 500) return failure(ack, 'Server is at room capacity.');
    let roomCode;
    do {roomCode = code();} while (rooms.has(roomCode));
    const room = {code:roomCode, sceneId:'start', hostId:socket.id, players:new Map([[socket.id, {name:safeName(name)}]]), votes:new Map()};
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    ack?.({ok:true, id:socket.id, code:roomCode});
    publish(room);
  });
  socket.on('room:join', ({code:rawCode, name} = {}, ack) => {
    const roomCode = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
    const room = rooms.get(roomCode);
    if (!room) return failure(ack, 'Room not found. Check the code.');
    if (!safeName(name)) return failure(ack, 'Enter a player name.');
    if (room.players.size >= 12) return failure(ack, 'This room is full (12 players).');
    leave(socket);
    room.players.set(socket.id, {name:safeName(name)});
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    ack?.({ok:true, id:socket.id, code:roomCode});
    publish(room);
  });
  socket.on('room:sync', (_, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return failure(ack, 'Room not found.');
    ack?.({ok:true});
    socket.emit('room:update', roomView(room));
  });
  socket.on('room:vote', (index, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !room.players.has(socket.id)) return failure(ack, 'Join a room first.');
    const choices = story[room.sceneId].choices || [];
    if (!Number.isInteger(index) || index < 0 || index >= choices.length) return failure(ack, 'Invalid choice.');
    if (room.votes.has(socket.id)) return failure(ack, 'You already voted this round.');
    room.votes.set(socket.id, index);
    ack?.({ok:true});
    resolveIfReady(room);
    publish(room);
  });
  socket.on('room:restart', (_, ack) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) return failure(ack, 'Only the room host can restart.');
    room.sceneId = 'start';
    room.votes.clear();
    ack?.({ok:true});
    publish(room);
  });
  socket.on('room:leave', (_, ack) => {leave(socket); ack?.({ok:true});});
  socket.on('disconnect', () => leave(socket));
});
app.use(express.static(dirname(fileURLToPath(import.meta.url)), {index:'index.html', dotfiles:'deny'}));
const port = Number(process.env.PORT) || 3000;
httpServer.listen(port, '0.0.0.0', () => console.log(`CYOA running at http://localhost:${port}`));
