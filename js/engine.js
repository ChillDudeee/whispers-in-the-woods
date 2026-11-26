import {initialState,transition,availableChoices} from './state.js';
export class StoryEngine {
 constructor(story){if(!story?.start)throw new Error('Missing start scene');this.story=story;this.restart();}
 restart(){this.sceneId='start';this.state=initialState();return this.currentScene();}
 currentScene(){return this.story[this.sceneId];}
 choices(){return availableChoices(this.currentScene(),this.state);}
 choose(index){const next=transition(this.story,this.sceneId,this.state,index);this.sceneId=next.sceneId;this.state=next.state;return this.currentScene();}
 restore(data){
  if (!data || typeof data !== 'object' || !Object.hasOwn(this.story,data.sceneId) || !data.state || typeof data.state !== 'object') throw new Error('Invalid save file');
  const state=data.state;
  if (!Number.isFinite(state.health) || state.health<0 || state.health>100 || !Array.isArray(state.inventory) || state.inventory.length>200 || !state.inventory.every(x=>typeof x==='string' && x.length<=100) || !Array.isArray(state.history) || state.history.length>10000 || !state.history.every(x=>x && typeof x.from==='string' && typeof x.to==='string' && typeof x.choice==='string') || !state.flags || typeof state.flags!=='object' || Array.isArray(state.flags) || Object.keys(state.flags).length>200 || !Object.values(state.flags).every(x=>typeof x==='boolean' || typeof x==='number' || typeof x==='string')) throw new Error('Invalid save state');
  this.sceneId=data.sceneId;
  this.state={health:state.health,inventory:[...state.inventory],flags:{...state.flags},history:state.history.map(x=>({from:x.from,to:x.to,choice:x.choice}))};
 }
 snapshot(){return {sceneId:this.sceneId,state:this.state};}
}
