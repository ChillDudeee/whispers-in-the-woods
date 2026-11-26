import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {exportAdventure,validateAdventure} from '../multiplayer-save.js';
import {initialState,availableChoices,transition} from '../js/state.js';
const story=JSON.parse(await readFile(new URL('../story/chapter1.json',import.meta.url),'utf8'));
function sample(){
 const state=initialState();
 const index=availableChoices(story.start,state)[0].index;
 const next=transition(story,'start',state,index);
 return exportAdventure({sceneId:next.sceneId,state:next.state,code:'ABCDE',hostId:'SECRET',players:new Map(),votes:new Map()});
}
test('multiplayer export can be reimported without a database',()=>{
 const exported=sample();
 const restored=validateAdventure(JSON.parse(JSON.stringify(exported)),story);
 assert.equal(restored.sceneId,exported.sceneId);
 assert.deepEqual(restored.state,exported.state);
});
test('export excludes room identity, session tokens, and votes',()=>{
 const exported=sample();const text=JSON.stringify(exported);
 for(const secret of ['ABCDE','SECRET','players','votes','hostId','token'])assert.equal(text.includes(secret),false);
});
test('rejects altered inventory, health, path, and unsupported format',()=>{
 const good=sample();
 for(const mutation of [
  s=>s.state.health=50,
  s=>s.state.inventory.push('secret-key'),
  s=>s.sceneId='start',
  s=>s.version=42,
  s=>s.state.history[0].choice='fabricated choice'
 ]){const bad=structuredClone(good);mutation(bad);assert.throws(()=>validateAdventure(bad,story));}
});
test('supports exporting the opening scene',()=>{
 const data=exportAdventure({sceneId:'start',state:initialState()});
 assert.deepEqual(validateAdventure(data,story),{sceneId:'start',state:initialState()});
});
