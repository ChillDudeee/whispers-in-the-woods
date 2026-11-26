import { randomBytes } from 'node:crypto';

export const newToken = () => randomBytes(24).toString('hex');
export const validToken = token => typeof token === 'string' && /^[a-f0-9]{48}$/.test(token);
export const serializeRoom = room => ({code:room.code,sceneId:room.sceneId,state:room.state,hostId:room.hostId,players:[...room.players].map(([id,p])=>({id,name:p.name})),votes:[...room.votes],updatedAt:Date.now()});
export const hydrateRoom = data => ({code:data.code,sceneId:data.sceneId,state:data.state,hostId:data.hostId,players:new Map((data.players||[]).map(p=>[p.id,{name:p.name,socketId:null}])),votes:new Map(data.votes||[])});
export async function openStore(){
  if(!process.env.DATABASE_URL){console.warn('DATABASE_URL not set: multiplayer rooms are in-memory only.');return {persistent:false,load:async()=>[],save:async()=>{},remove:async()=>{},close:async()=>{}};}
  const {Pool}=await import('pg');
  const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='disable'?false:{rejectUnauthorized:true},max:3});
  await pool.query('CREATE TABLE IF NOT EXISTS cyoa_rooms (code VARCHAR(5) PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  return {persistent:true,
    load:async()=> (await pool.query('SELECT data FROM cyoa_rooms')).rows.map(r=>hydrateRoom(r.data)),
    save:async room=>{await pool.query('INSERT INTO cyoa_rooms(code,data,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(code) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()',[room.code,JSON.stringify(serializeRoom(room))]);},
    remove:async code=>{await pool.query('DELETE FROM cyoa_rooms WHERE code=$1',[code]);},
    close:async()=>pool.end()};
}
