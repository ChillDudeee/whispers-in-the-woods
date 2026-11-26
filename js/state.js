export const initialState = () => ({health:100, inventory:[], flags:{}, history:[]});
export function allowed(choice, state) {
  const r = choice.requires || {};
  return (r.items || []).every(x => state.inventory.includes(x)) &&
    (r.notItems || []).every(x => !state.inventory.includes(x)) &&
    Object.entries(r.flags || {}).every(([k,v]) => state.flags[k] === v) &&
    (r.minHealth == null || state.health >= r.minHealth);
}
export function availableChoices(scene, state) {return (scene.choices || []).map((choice,index)=>({choice,index})).filter(({choice})=>allowed(choice,state));}
export function transition(story, sceneId, state, index) {
  const scene = story[sceneId], choice = scene?.choices?.[index];
  if (!choice || !allowed(choice,state) || !story[choice.next]) throw new Error('That choice is unavailable.');
  const e = choice.effects || {};
  const inventory = new Set(state.inventory);
  for (const item of e.addItems || []) inventory.add(item);
  for (const item of e.removeItems || []) inventory.delete(item);
  return {sceneId:choice.next, state:{health:Math.max(0,Math.min(100,state.health + (e.health || 0))), inventory:[...inventory],flags:{...state.flags,...(e.setFlags || {})},history:[...state.history,{from:sceneId,choice:choice.text,to:choice.next}]}};
}
