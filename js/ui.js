export function renderScene(scene,onChoice,options={}){
 const sceneEl=document.querySelector('#scene');
 const allowedBackgrounds=new Set(['forest','cabin','cave','cellar','ruins']);
 const bg=allowedBackgrounds.has(scene.background)?scene.background:'forest';
 sceneEl.style.backgroundImage=`linear-gradient(180deg,rgba(9,22,25,.15),rgba(5,15,18,.78)),url("./assets/backgrounds/${bg}.svg")`;
 sceneEl.classList.remove('scene-enter'); void sceneEl.offsetWidth; sceneEl.classList.add('scene-enter');
 const portrait=document.querySelector('#character-portrait');
 portrait.hidden=scene.portrait!=='wolf';
 if(!portrait.hidden){portrait.src='./assets/portraits/wolf.svg';portrait.alt='Illustration of a wolf';}
 document.querySelector('#scene-title').textContent=scene.title;
 document.querySelector('#scene-label').textContent=scene.chapter;
 document.querySelector('#story-text').textContent=scene.text;
 document.querySelector('#error').hidden=true;
 const container=document.querySelector('#choices');container.replaceChildren();
 const available=options.available || (scene.choices||[]).map((choice,index)=>({choice,index}));
 for(const {choice,index} of available){const button=document.createElement('button');button.type='button';button.className='choice';button.textContent=(options.buttonPrefix||'')+choice.text;button.disabled=!!options.disabled;button.addEventListener('click',()=>onChoice(index));container.appendChild(button);}
}
export function renderStats(state){const panel=document.querySelector('#stats-panel');panel.hidden=!state;if(!state)return;
 const health=Math.max(0,Math.min(100,Number(state.health)||0));
 document.querySelector('#health').textContent=String(health);
 document.querySelector('#health-fill').style.width=`${health}%`;
 document.querySelector('#health-track').setAttribute('aria-valuenow',String(health));
 document.querySelector('#health-track').setAttribute('aria-valuetext',`${health} out of 100 health`);
 document.querySelector('#health-track').dataset.level=health<=25?'critical':health<=50?'low':'normal';
 document.querySelector('#inventory').textContent=state.inventory.length?state.inventory.map(x=>x.replaceAll('_',' ')).join(', '):'Empty';
 document.querySelector('#flags').textContent=Object.keys(state.flags).filter(k=>state.flags[k]).map(k=>k.replaceAll('_',' ')).join(', ')||'None';
 document.querySelector('#history-count').textContent=String(state.history.length);
}
export function showError(message){const el=document.querySelector('#error');el.textContent=message instanceof Error?message.message:String(message);el.hidden=false;}
