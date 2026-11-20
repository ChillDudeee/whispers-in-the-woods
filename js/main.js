import { StoryEngine } from './engine.js';
import { renderScene, showError } from './ui.js';

const $ = selector => document.querySelector(selector);
let story, solo, socket, myId, currentMode = 'lobby', currentRoom;
function lobbyError(message) { $('#lobby-error').textContent = message; $('#lobby-error').hidden = !message; }
function displayMode(mode) {
  currentMode = mode;
  $('#lobby').hidden = mode !== 'lobby';
  $('#scene').hidden = mode === 'lobby';
  $('#multiplayer-bar').hidden = mode !== 'multi';
  $('#vote-panel').hidden = mode !== 'multi';
  $('#restart').hidden = mode === 'lobby' || (mode === 'multi' && currentRoom?.hostId !== myId);
  $('#error').hidden = true;
}
async function startSolo() {
  if (!story) return lobbyError('Story has not loaded yet.');
  if (currentMode === 'multi') await leaveRoom();
  solo = new StoryEngine(story);
  displayMode('solo');
  const navigate = id => {
    try { renderScene(solo.goTo(id), navigate); }
    catch (error) { showError(error.message); }
  };
  navigate('start');
  window.soloNavigate = navigate;
}
function connect() {
  if (socket) return socket;
  if (typeof window.io !== 'function') throw new Error('Multiplayer requires the Node.js server. Start it with npm start.');
  socket = window.io({reconnectionAttempts: 3, timeout: 7000});
  socket.on('room:update', room => {
    currentRoom = room;
    if (currentMode !== 'multi') return;
    $('#code-display').textContent = room.code;
    $('#restart').hidden = room.hostId !== myId;
    const list = $('#player-list');
    list.replaceChildren();
    for (const player of room.players) {
      const item = document.createElement('li');
      item.textContent = `${player.name}${player.id === room.hostId ? ' (host)' : ''}${player.voted ? ' ✓' : ''}`;
      list.appendChild(item);
    }
    const isHost = room.hostId === myId;
    const myVote = room.players.find(p => p.id === myId)?.choiceIndex;
    const choices = room.scene.choices || [];
    $('#room-status').textContent = `${room.votes}/${Math.max(0,room.players.length - 1)} guest votes received · ${isHost ? 'You make the final decision' : 'Waiting for host decision'}`;
    $('#vote-summary').textContent = choices.map((c, i) => `${c.text}: ${room.tallies[i] || 0}`).join(' | ') || 'No choices in this scene.';
    const voteList = $('#vote-list');
    voteList.replaceChildren();
    for (const player of room.players) {
      const item = document.createElement('li');
      item.textContent = player.id === room.hostId
        ? `${player.name} (host — final decision)`
        : `${player.name}: ${player.choiceIndex === null ? 'Not voted yet' : (choices[player.choiceIndex]?.text || 'Unknown choice')}`;
      voteList.appendChild(item);
    }
    $('#host-hint').hidden = !isHost || !choices.length;
    renderScene(room.scene, index => send(isHost ? 'room:decide' : 'room:vote', index).catch(showError), {
      choiceIndex:true,
      disabled:!isHost && myVote !== null && myVote !== undefined,
      buttonPrefix: isHost ? 'Decide: ' : 'Vote: '
    });
  });
  socket.on('room:result', result => {$('#room-status').textContent = `The group chose: ${result.choice}`;});
  socket.on('disconnect', () => { if (currentMode === 'multi') showError('Connection lost. Return to the lobby and join a new room if needed.'); });
  socket.on('connect', () => { if (currentMode === 'multi' && currentRoom && socket.id !== myId) {currentRoom = null; displayMode('lobby'); lobbyError('Connection restarted. Please rejoin the room.');} });
  return socket;
}
function send(event, payload) {
  return new Promise((resolve, reject) => {
    try {
      const client = connect();
      client.timeout(8000).emit(event, payload, (error, reply) => {
        if (error) return reject(new Error('Server did not respond. Check your connection.'));
        if (!reply?.ok) return reject(new Error(reply?.error || 'Request failed.'));
        resolve(reply);
      });
    } catch (error) { reject(error); }
  });
}
async function enterRoom(action) {
  lobbyError('');
  const name = $('#player-name').value.trim();
  if (!name) return lobbyError('Enter your player name first.');
  const code = $('#room-code').value.trim().toUpperCase();
  try {
    const reply = await send(action === 'create' ? 'room:create' : 'room:join', action === 'create' ? name : {name, code});
    myId = reply.id;
    currentRoom = {code:reply.code};
    displayMode('multi');
    // The server may emit the first update before the acknowledgement.
    await send('room:sync', null).catch(() => {});
  } catch (error) { lobbyError(error.message); }
}
async function leaveRoom() {
  if (socket?.connected) await send('room:leave', null).catch(() => {});
  currentRoom = null;
  myId = null;
  displayMode('lobby');
}
async function init() {
  try {
    const response = await fetch('./story/chapter1.json');
    if (!response.ok) throw new Error(`Could not load story (${response.status}).`);
    story = await response.json();
    $('#single').addEventListener('click', startSolo);
    $('#create').addEventListener('click', () => enterRoom('create'));
    $('#join').addEventListener('click', () => enterRoom('join'));
    $('#leave').addEventListener('click', leaveRoom);
    $('#copy-code').addEventListener('click', async () => {
      try {await navigator.clipboard.writeText(currentRoom.code); $('#copy-code').textContent = 'Copied!';}
      catch {$('#copy-code').textContent = 'Select code above to copy';}
    });
    $('#restart').addEventListener('click', () => {
      if (currentMode === 'solo') window.soloNavigate('start');
      else if (currentMode === 'multi') send('room:restart', null).catch(showError);
    });
  } catch (error) { lobbyError(`${error.message} Use a local server; see README.`); }
}
init();
