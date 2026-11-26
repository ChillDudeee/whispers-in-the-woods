import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { randomInt } from 'node:crypto';
import { initialState, transition, availableChoices } from './js/state.js';
import { openStore, newToken, validToken } from './room-store.js';

const app=express(), httpServer=createServer(app),io=new Server(httpServer);
const story=JSON.parse(await readFile(new URL('./story/chapter1.json',import.meta.url),'utf8'));
const store=await openStore(),rooms=new Map((await store.load()).map(room=>[room.code,room]));
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code=()=>Array.from({length:5},()=>alphabet[randomInt(alphabet.length)]).join('');
const safeName=value=>typeof value==='string'?value.trim().slice(0,24):'';
const failure=(ack,message)=>{if(typeof ack==='function')ack({ok:false,error:message});};
const active=room=>[...room.players].filter(([,p])=>!!p.socketId);
const roomView=room=>({state:room.state,available:availableChoices(story[room.sceneId],room.state),code:room.code,sceneId:room.sceneId,scene:story[room.sceneId],hostId:room.hostId,players:[...room.players].map(([id,p])=>({id,name:p.name,online:!!p.socketId,voted:room.votes.has(id),choiceIndex:room.votes.get(id)??null})),votes:room.votes.size,tallies:(story[room.sceneId].choices||[]).map((_,i)=>[...room.votes.values()].filter(v=>v===i).length)});
const publish=room=>io.to(room.code).emit('room:update',roomView(room));
const save=async room=>{await store.save(room);publish(room);};
const findRoom=socket=>rooms.get(socket.data.roomCode);
const playerOf=socket=>{const room=findRoom(socket);return room?.players.get(socket.data.playerId)?room:null;};
async function leave(socket,permanent=false){
 const room=playerOf(socket);if(!room)return;
 const id=socket.data.playerId,p=room.players.get(id);
 if(p.socketId!==socket.id)return;
 p.socketId=null;room.votes.delete(id);socket.leave(room.code);socket.data.roomCode=null;socket.data.playerId=null;
 if(permanent){room.players.delete(id);if(room.hostId===id)room.hostId=room.players.keys().next().value??null;}
 if(!room.players.size){rooms.delete(room.code);await store.remove(room.code);}else await save(room);
}
function attach(socket,room,id){
 const player=room.players.get(id);if(player.socketId && player.socketId!==socket.id){const previous=io.sockets.sockets.get(player.socketId);if(previous){previous.data.roomCode=null;previous.data.playerId=null;previous.emit('room:kicked');previous.leave(room.code);}}
 player.socketId=socket.id;socket.data.roomCode=room.code;socket.data.playerId=id;socket.join(room.code);
}
function handle(socket,event,fn){socket.on(event,async(...args)=>{const ack=typeof args.at(-1)==='function'?args.pop():null;try{await fn(args[0],ack);}catch(error){console.error(event,error);failure(ack,'Server error. Please try again.');}});}
io.on('connection',socket=>{
 handle(socket,'room:create',async(name,ack)=>{
  if(!safeName(name))return failure(ack,'Enter a player name.');
  if(rooms.size>=500)return failure(ack,'Server is at room capacity.');
  await leave(socket,true);let roomCode;do{roomCode=code();}while(rooms.has(roomCode));
  const id=newToken(),room={code:roomCode,sceneId:'start',state:initialState(),hostId:id,players:new Map([[id,{name:safeName(name),socketId:null}]]),votes:new Map()};
  rooms.set(roomCode,room);attach(socket,room,id);await save(room);ack?.({ok:true,id,token:id,code:roomCode});
 });
 handle(socket,'room:join',async({code:rawCode,name}={},ack)=>{
  const roomCode=typeof rawCode==='string'?rawCode.trim().toUpperCase():'';const room=rooms.get(roomCode);
  if(!room)return failure(ack,'Room not found. Check the code.');
  if(!safeName(name))return failure(ack,'Enter a player name.');
  if(room.players.size>=12)return failure(ack,'This room is full (12 players).');
  await leave(socket,true);const id=newToken();room.players.set(id,{name:safeName(name),socketId:null});attach(socket,room,id);await save(room);ack?.({ok:true,id,token:id,code:roomCode});
 });
 handle(socket,'room:resume',async({code:rawCode,token}={},ack)=>{
  const room=rooms.get(typeof rawCode==='string'?rawCode.toUpperCase():'');
  if(!room||!validToken(token)||!room.players.has(token))return failure(ack,'Saved room or player session not found.');
  await leave(socket,true);attach(socket,room,token);await save(room);ack?.({ok:true,id:token,token,code:room.code});
 });
 handle(socket,'room:sync',async(_,ack)=>{const room=playerOf(socket);if(!room)return failure(ack,'Room not found.');ack?.({ok:true});socket.emit('room:update',roomView(room));});
 handle(socket,'room:vote',async(index,ack)=>{
  const room=playerOf(socket);if(!room)return failure(ack,'Join a room first.');
  if(room.hostId===socket.data.playerId)return failure(ack,'Host chooses the final path instead of voting.');
  if(!Number.isInteger(index)||!availableChoices(story[room.sceneId],room.state).some(x=>x.index===index))return failure(ack,'Invalid choice.');
  room.votes.set(socket.data.playerId,index);await save(room);ack?.({ok:true});
 });
 handle(socket,'room:decide',async(index,ack)=>{
  const room=playerOf(socket);if(!room||room.hostId!==socket.data.playerId)return failure(ack,'Only the host can decide.');
  const choices=story[room.sceneId].choices||[];
  if(!Number.isInteger(index)||!availableChoices(story[room.sceneId],room.state).some(x=>x.index===index))return failure(ack,'Invalid choice.');
  if(!story[choices[index].next])return failure(ack,'The next scene is missing.');
  const next=transition(story,room.sceneId,room.state,index);room.sceneId=next.sceneId;room.state=next.state;room.votes.clear();
  await save(room);io.to(room.code).emit('room:result',{choice:choices[index].text});ack?.({ok:true});
 });
 handle(socket,'room:restart',async(_,ack)=>{const room=playerOf(socket);if(!room||room.hostId!==socket.data.playerId)return failure(ack,'Only the host can restart.');room.sceneId='start';room.state=initialState();room.votes.clear();await save(room);ack?.({ok:true});});
 handle(socket,'room:transfer',async(target,ack)=>{const room=playerOf(socket);if(!room||room.hostId!==socket.data.playerId)return failure(ack,'Only the host can transfer ownership.');if(!room.players.has(target)||target===room.hostId)return failure(ack,'Choose another player.');room.hostId=target;await save(room);ack?.({ok:true});});
 handle(socket,'room:leave',async(_,ack)=>{await leave(socket,true);ack?.({ok:true});});
 socket.on('disconnect',()=>{leave(socket).catch(console.error);});
});
app.get('/health',(_req,res)=>res.json({ok:true,service:'whispers-in-the-woods',persistent:store.persistent}));
app.use((req,res,next)=>{if(/^\/(?:server\.js|room-store\.js|package(?:-lock)?\.json|README\.md|test(?:\/|$))/i.test(req.path))return res.sendStatus(404);next();});
app.use(express.static(dirname(fileURLToPath(import.meta.url)),{index:'index.html',dotfiles:'deny'}));
const port=Number(process.env.PORT)||3000;
httpServer.listen(port,'0.0.0.0',()=>console.log(`CYOA running at http://localhost:${port}`));
