import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {StoryEngine} from '../js/engine.js';
import {availableChoices,transition,initialState} from '../js/state.js';
const story=JSON.parse(await readFile(new URL('../story/chapter1.json',import.meta.url),'utf8'));
test('all story destinations exist and scenes have text',()=>{
 assert.ok(story.start);
 for(const [id,scene] of Object.entries(story)){
  assert.equal(typeof scene.text,'string',`missing text: ${id}`);
  for(const choice of scene.choices||[]){
   assert.equal(typeof choice.text,'string');
   assert.ok(story[choice.next],`broken destination: ${id} -> ${choice.next}`);
  }
 }
});
test('every scene is reachable from start (ignoring requirements)',()=>{
 const visited=new Set(['start']),queue=['start'];
 while(queue.length){const scene=story[queue.shift()];for(const c of scene.choices||[]){if(!visited.has(c.next)){visited.add(c.next);queue.push(c.next);}}}
 assert.deepEqual([...Object.keys(story).filter(id=>!visited.has(id))],[]);
});
test('initial stats and choices are valid',()=>{
 const engine=new StoryEngine(story);
 assert.equal(engine.state.health,100);
 assert.ok(engine.choices().length>0);
});
test('choices update history and restore snapshots',()=>{
 const engine=new StoryEngine(story),index=engine.choices()[0].index;
 engine.choose(index);
 const restored=new StoryEngine(story);restored.restore(JSON.parse(JSON.stringify(engine.snapshot())));
 assert.deepEqual(restored.snapshot(),engine.snapshot());
});
test('bad save is rejected without changing current game',()=>{
 const engine=new StoryEngine(story),before=engine.snapshot();
 assert.throws(()=>engine.restore({sceneId:'start',state:{health:999,inventory:[],flags:{},history:[]}}));
 assert.deepEqual(engine.snapshot(),before);
});
test('locked choices are excluded and cannot be forced',()=>{
 const sample={start:{text:'Start',choices:[{text:'Locked',next:'end',requires:{items:['key']}}]},end:{text:'End',choices:[]}};
 assert.equal(availableChoices(sample.start,initialState()).length,0);
 assert.throws(()=>transition(sample,'start',initialState(),0));
 const unlocked={...initialState(),inventory:['key']};
 assert.equal(transition(sample,'start',unlocked,0).sceneId,'end');
});

test('phase 5 room snapshot preserves votes and host identity', async()=>{
 const {serializeRoom,hydrateRoom,validToken,newToken}=await import('../room-store.js');
 const id=newToken(),guest=newToken();
 assert.ok(validToken(id));
 const room={code:'ABCDE',sceneId:'start',state:initialState(),hostId:id,players:new Map([[id,{name:'Host',socketId:'socket1'}],[guest,{name:'Guest',socketId:'socket2'}]]),votes:new Map([[guest,0]])};
 const restored=hydrateRoom(JSON.parse(JSON.stringify(serializeRoom(room))));
 assert.equal(restored.hostId,id);
 assert.equal(restored.players.get(id).socketId,null);
 assert.equal(restored.votes.get(guest),0);
});
