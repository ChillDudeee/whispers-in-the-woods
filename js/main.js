import { StoryEngine } from './engine.js';
import { renderScene, renderStats, showError } from './ui.js';

const $ = selector => document.querySelector(selector);
let story, solo, socket, myId, currentMode = 'lobby', currentRoom;
let audioContext, soundEnabled=false, lastSceneKey='';
const ROOM_SESSION='whispers-multiplayer-session';
const savedSession=()=>{try{return JSON.parse(localStorage.getItem(ROOM_SESSION)||'null');}catch{return null;}};
function rememberSession(reply){localStorage.setItem(ROOM_SESSION,JSON.stringify({code:reply.code,token:reply.token}));}

function playSceneTone(scene){
 if(!soundEnabled || !scene || !window.AudioContext)return;
 try{
  audioContext ||= new AudioContext();
  if(audioContext.state==='suspended')audioContext.resume();
  const osc=audioContext.createOscillator(), gain=audioContext.createGain();
  osc.type='sine'; osc.frequency.value=scene.background==='cave'?180:scene.background==='cabin'?320:260;
  gain.gain.setValueAtTime(0.0001,audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.045,audioContext.currentTime+0.06);
  gain.gain.exponentialRampToValueAtTime(0.0001,audioContext.currentTime+0.55);
  osc.connect(gain).connect(audioContext.destination);osc.start();osc.stop(audioContext.currentTime+0.56);
 }catch(error){console.warn('Audio unavailable',error);}
}
function sceneChanged(scene,key){if(key!==lastSceneKey){lastSceneKey=key;playSceneTone(scene);}}

function lobbyError(message) { $('#lobby-error').textContent = message; $('#lobby-error').hidden = !message; }
function displayMode(mode) {
  currentMode = mode;
  $('#lobby').hidden = mode !== 'lobby';
  $('#scene').hidden = mode === 'lobby';
  $('#multiplayer-bar').hidden = mode !== 'multi';
  $('#vote-panel').hidden = mode !== 'multi';
  $('#multi-save-tools').hidden = mode !== 'multi' || currentRoom?.hostId !== myId;
  $('#save-status').hidden = mode !== 'solo';
  $('#solo-save-tools').hidden = mode !== 'solo';
  $('#restart').hidden = mode === 'lobby' || (mode === 'multi' && currentRoom?.hostId !== myId);
  $('#error').hidden = true;
}
const SAVE_KEY='whispers-phase2-solo';
function drawSolo(){
 renderStats(solo.state);
 sceneChanged(solo.currentScene(),`solo:${solo.sceneId}`);
 renderScene(solo.currentScene(),index=>{
   try {solo.choose(index);localStorage.setItem(SAVE_KEY,JSON.stringify(solo.snapshot()));drawSolo();}
   catch(error){showError(error.message);}
 },{available:solo.choices()});
}
async function startSolo(){
 if(!story)return lobbyError('Story has not loaded yet.');
 if(currentMode==='multi')await leaveRoom();
 solo=new StoryEngine(story);
 try {const saved=localStorage.getItem(SAVE_KEY);if(saved)solo.restore(JSON.parse(saved));}catch{localStorage.removeItem(SAVE_KEY);}
 displayMode('solo');drawSolo();
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
      item.textContent = `${player.name}${player.id === room.hostId ? ' (host)' : ''}${player.online ? '' : ' (offline)'}${player.voted ? ' ✓' : ''}`;
      list.appendChild(item);
    }
    const isHost = room.hostId === myId;
    $('#multi-save-tools').hidden = !isHost;
    $('#multi-save-message').textContent = '';
    const transfer=$('#host-transfer'),transferButton=$('#transfer-host');
    transfer.hidden=!isHost;
    transferButton.hidden=!isHost;
    transfer.replaceChildren();
    for(const player of room.players.filter(p=>p.id!==myId)){
      const option=document.createElement('option');option.value=player.id;
      option.textContent=`${player.name}${player.online?'':' (offline)'}`;transfer.append(option);
    }
    transferButton.disabled=!transfer.options.length;

    const myVote = room.players.find(p => p.id === myId)?.choiceIndex;
    const choices = room.scene.choices || [];
    renderStats(room.state);
    sceneChanged(room.scene,`multi:${room.code}:${room.state?.history?.length ?? 0}:${room.scene.title}`);
    $('#room-status').textContent = `${room.votes}/${Math.max(0,room.players.length - 1)} guest votes received · ${isHost ? 'You make the final decision' : 'Waiting for host decision'}`;
    const guestCount = Math.max(0, room.players.length - 1);
    const totalVotes = room.votes;
    $('#vote-summary').textContent = `${totalVotes} of ${guestCount} guests voted · Live results`;
    const poll = $('#poll-results');
    poll.replaceChildren();
    const availableIndices = new Set(room.available.map(entry => entry.index));
    choices.forEach((choice, i) => {
      if (!availableIndices.has(i)) return;
      const count = room.tallies[i] || 0;
      const percentage = totalVotes ? Math.round(count / totalVotes * 100) : 0;
      const row = document.createElement('div');
      row.className = 'poll-option';
      const heading = document.createElement('div');
      heading.className = 'poll-heading';
      const name = document.createElement('span');
      name.textContent = choice.text;
      const result = document.createElement('strong');
      result.textContent = `${count} ${count === 1 ? 'vote' : 'votes'} · ${percentage}%`;
      heading.append(name, result);
      const track = document.createElement('div');
      track.className = 'poll-track';
      track.setAttribute('role','progressbar');
      track.setAttribute('aria-label',choice.text);
      track.setAttribute('aria-valuemin','0');
      track.setAttribute('aria-valuemax','100');
      track.setAttribute('aria-valuenow',String(percentage));
      const fill = document.createElement('div');
      fill.className = 'poll-fill';
      fill.style.width = `${percentage}%`;
      track.append(fill);
      row.append(heading, track);
      poll.append(row);
    });
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
      buttonPrefix: isHost ? 'Decide: ' : 'Vote: ',
      available:room.available
    });
  });
  socket.on('room:result', result => {$('#room-status').textContent = `The group chose: ${result.choice}`;});
  socket.on('room:kicked',()=>{currentRoom=null;myId=null;localStorage.removeItem(ROOM_SESSION);displayMode('lobby');lobbyError('This session was opened in another tab.');});
  socket.on('disconnect',()=>{if(currentMode==='multi')showError('Connection interrupted. Reconnecting to your room…');});
  socket.on('connect',async()=>{
    if(currentMode!=='multi'||!currentRoom)return;
    const saved=savedSession();
    if(!saved)return;
    try{const reply=await send('room:resume',saved);myId=reply.id;await send('room:sync',null);}catch(error){currentRoom=null;myId=null;displayMode('lobby');lobbyError(`Could not reconnect: ${error.message}`);}
  });
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
    rememberSession(reply);
    currentRoom = {code:reply.code};
    displayMode('multi');
    // The server may emit the first update before the acknowledgement.
    await send('room:sync', null).catch(() => {});
  } catch (error) { lobbyError(error.message); }
}
async function resumeSavedRoom(){
  const saved=savedSession();if(!saved)return lobbyError('No saved multiplayer session found.');
  try{const reply=await send('room:resume',saved);myId=reply.id;currentRoom={code:reply.code};displayMode('multi');await send('room:sync',null);}
  catch(error){localStorage.removeItem(ROOM_SESSION);$('#resume-room').hidden=true;lobbyError(error.message);}
}
async function leaveRoom() {
  if (socket?.connected) await send('room:leave', null).catch(() => {});
  currentRoom = null;
  myId = null;
  localStorage.removeItem(ROOM_SESSION);
  displayMode('lobby');
}
async function init() {
  try {
    const response = await fetch('./story/chapter1.json');
    if (!response.ok) throw new Error(`Could not load story (${response.status}).`);
    story = await response.json();
    $('#sound-toggle').addEventListener('click',()=>{
      soundEnabled=!soundEnabled;
      $('#sound-toggle').textContent=soundEnabled?'Sound: On':'Sound: Off';
      $('#sound-toggle').setAttribute('aria-pressed',String(soundEnabled));
      if(soundEnabled && currentMode==='solo')playSceneTone(solo.currentScene());
      if(soundEnabled && currentMode==='multi' && currentRoom?.scene)playSceneTone(currentRoom.scene);
    });
    $('#single').addEventListener('click', startSolo);
    $('#export-save').addEventListener('click', () => {
      if (!solo) return;
      const payload = JSON.stringify({format:'whispers-solo-save',version:1,...solo.snapshot()},null,2);
      const url = URL.createObjectURL(new Blob([payload],{type:'application/json'}));
      const link = document.createElement('a');
      link.href=url; link.download='whispers-solo-save.json'; link.click();
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
    $('#import-save').addEventListener('change', async event => {
      const file=event.target.files?.[0];
      if (!file || !solo) return;
      const message=$('#import-message');
      try {
        if (file.size>1024*1024) throw new Error('Save exceeds 1 MB.');
        const data=JSON.parse(await file.text());
        if (data.format!=='whispers-solo-save' || data.version!==1) throw new Error('Unsupported save format.');
        const candidate=new StoryEngine(story);
        candidate.restore(data);
        solo=candidate;
        localStorage.setItem(SAVE_KEY,JSON.stringify(solo.snapshot()));
        drawSolo();message.textContent='Save imported successfully.';
      } catch(error) {message.textContent=`Import failed: ${error.message}`;}
      finally {event.target.value='';}
    });
    $('#export-multi').addEventListener('click', async () => {
      const message=$('#multi-save-message');
      try {
        const reply=await send('room:export',null);
        const payload=JSON.stringify(reply.save,null,2);
        const url=URL.createObjectURL(new Blob([payload],{type:'application/json'}));
        const link=document.createElement('a');
        link.href=url;
        link.download=`whispers-multiplayer-${currentRoom.code}.json`;
        document.body.append(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
        message.textContent='Backup exported. Keep the file somewhere safe.';
      } catch(error){message.textContent=`Export failed: ${error.message}`;}
    });
    $('#import-multi').addEventListener('change', async event => {
      const file=event.target.files?.[0];
      if(!file)return;
      const message=$('#multi-save-message');
      try {
        if(file.size>1024*1024)throw new Error('Save exceeds 1 MB.');
        const data=JSON.parse(await file.text());
        if(!window.confirm("Restore this backup? This replaces the current room's story progress and clears votes."))return;
        await send('room:import',data);
        message.textContent='Multiplayer progress restored! Everyone sees the imported scene.';
      }catch(error){message.textContent=`Import failed: ${error.message}`;}
      finally{event.target.value='';}
    });
    $('#transfer-host').addEventListener('click',()=>send('room:transfer',$('#host-transfer').value).catch(error=>showError(error.message)));
    $('#resume-room').addEventListener('click',resumeSavedRoom);
    if(savedSession())$('#resume-room').hidden=false;
    $('#create').addEventListener('click', () => enterRoom('create'));
    $('#join').addEventListener('click', () => enterRoom('join'));
    $('#leave').addEventListener('click', leaveRoom);
    $('#copy-code').addEventListener('click', async () => {
      try {await navigator.clipboard.writeText(currentRoom.code); $('#copy-code').textContent = 'Copied!';}
      catch {$('#copy-code').textContent = 'Select code above to copy';}
    });
    $('#restart').addEventListener('click', () => {
      if (currentMode === 'solo') {solo.restart();localStorage.removeItem(SAVE_KEY);drawSolo();}
      else if (currentMode === 'multi') send('room:restart', null).catch(showError);
    });
  } catch (error) { lobbyError(`${error.message} Use a local server; see README.`); }
}
init();
