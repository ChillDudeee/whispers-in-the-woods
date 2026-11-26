import {initialState,transition} from './js/state.js';

export const MULTIPLAYER_SAVE_FORMAT = 'whispers-multiplayer-save';
export const MULTIPLAYER_SAVE_VERSION = 1;

// Export only story progress. Room codes, player identities and authentication
// tokens deliberately never leave the server in a downloadable save.
export function exportAdventure(room) {
  return {
    format:MULTIPLAYER_SAVE_FORMAT,
    version:MULTIPLAYER_SAVE_VERSION,
    exportedAt:new Date().toISOString(),
    sceneId:room.sceneId,
    state:structuredClone(room.state)
  };
}

export function validateAdventure(data,story) {
  if (!data || typeof data!=='object' || Array.isArray(data) ||
      data.format!==MULTIPLAYER_SAVE_FORMAT || data.version!==MULTIPLAYER_SAVE_VERSION ||
      typeof data.sceneId!=='string' || !Object.hasOwn(story,data.sceneId)) {
    throw new Error('Not a supported multiplayer save file.');
  }
  const s=data.state;
  if (!s || typeof s!=='object' || Array.isArray(s) ||
      !Number.isInteger(s.health) || s.health<0 || s.health>100 ||
      !Array.isArray(s.inventory) || s.inventory.length>200 ||
      !s.inventory.every(x=>typeof x==='string' && x.length<=100) ||
      !s.flags || typeof s.flags!=='object' || Array.isArray(s.flags) ||
      Object.keys(s.flags).length>200 ||
      !Object.values(s.flags).every(x=>typeof x==='boolean' || typeof x==='string' || (typeof x==='number' && Number.isFinite(x))) ||
      !Array.isArray(s.history) || s.history.length>10000 ||
      !s.history.every(x=>x && typeof x==='object' && typeof x.from==='string' && typeof x.to==='string' && typeof x.choice==='string')) {
    throw new Error('Save contains invalid game state.');
  }
  // Recreate the entire adventure from the real story rules, preventing
  // edited saves from granting inventory, health, or impossible story paths.
  let sceneId='start',state=initialState();
  for (const step of s.history) {
    if (step.from!==sceneId) throw new Error('Save history does not match the story.');
    const choices=story[sceneId]?.choices||[];
    const i=choices.findIndex(c=>c.text===step.choice && c.next===step.to);
    if (i<0) throw new Error('Save contains an unknown story choice.');
    try {({sceneId,state}=transition(story,sceneId,state,i));}
    catch {throw new Error('Save contains an unavailable choice.');}
  }
  if (sceneId!==data.sceneId || JSON.stringify(state)!==JSON.stringify(s)) {
    throw new Error('Save progress does not match the story.');
  }
  return {sceneId,state};
}
