const key='infomancer-theme-study-v1';
let applied={...defaults},draft;
let storageAvailable=true;
try{const raw=localStorage.getItem(key);if(raw)applied=normalize(JSON.parse(raw));}catch{storageAvailable=false;}
draft={...applied};
const status=document.getElementById('status'),error=document.getElementById('error');
const accent=document.getElementById('accent'),density=document.getElementById('density'),highContrast=document.getElementById('contrast');
const radios=[...document.querySelectorAll('input[name=preset]')];
function preview(){
 const problem=validate(draft);error.textContent=problem;document.getElementById('apply').disabled=Boolean(problem);
 if(problem)return;
 const p=presets[draft.preset];for(const token of ['bg','panel','raised','text','muted','border'])document.documentElement.style.setProperty('--'+token,p[token]);
 document.documentElement.style.setProperty('--accent',draft.accent);document.documentElement.style.setProperty('--on-accent',actionText(draft.accent));
 document.documentElement.style.setProperty('--poster',draft.density==='compact'?'140px':'160px');
 if(draft.highContrast){document.documentElement.style.setProperty('--muted',p.text);document.documentElement.style.setProperty('--border',p.muted);}
 status.textContent=JSON.stringify(draft)===JSON.stringify(applied)?(storageAvailable?'Applied appearance.':'Appearance available for this session; browser storage is unavailable.'):'Unsaved preview. Apply to keep this appearance.';
}
function controls(){radios.forEach(r=>r.checked=r.value===draft.preset);accent.value=draft.accent;density.value=draft.density;highContrast.checked=draft.highContrast;preview();}
radios.forEach(r=>r.addEventListener('change',()=>{draft.preset=r.value;draft.accent=presets[r.value].accent;controls();}));
accent.addEventListener('input',()=>{draft.accent=accent.value;preview();});
density.addEventListener('change',()=>{draft.density=density.value;preview();});
highContrast.addEventListener('change',()=>{draft.highContrast=highContrast.checked;preview();});
document.getElementById('apply').addEventListener('click',()=>{if(validate(draft))return;applied=normalize(draft);draft={...applied};try{localStorage.setItem(key,JSON.stringify(applied));storageAvailable=true;}catch{storageAvailable=false;}preview();status.textContent=storageAvailable?'Appearance applied in this browser.':'Applied for this session only. Browser storage is unavailable.';});
document.getElementById('discard').addEventListener('click',()=>{draft={...applied};controls();});
document.getElementById('reset').addEventListener('click',()=>{draft={...defaults};controls();});
document.getElementById('export').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(applied,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='infomancer-theme.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='Exported applied appearance. Unsaved preview changes are excluded.';});
const samples=['Arrival','Blade Runner 2049','The Bear','Better Call Saul','Dune','Everything Everywhere','Interstellar','The Last of Us','The Lighthouse','Moonrise Kingdom'];
let selected=0;
function layout(mode){document.getElementById('workspace').dataset.layout=mode;document.getElementById('browse-layout').setAttribute('aria-pressed',String(mode==='browse'));document.getElementById('workbench-layout').setAttribute('aria-pressed',String(mode==='workbench'));}
function inspect(i){selected=i;document.getElementById('inspect-title').textContent=samples[i];document.getElementById('inspect-meta').textContent=[2,3,7].includes(i)?'Sample series · Technical metadata':'Sample movie · Technical metadata';document.getElementById('inspect-file').textContent=samples[i]+'.mkv';const img=document.createElement('img');img.src=studyArtwork[i];img.alt='';document.getElementById('inspection-art').replaceChildren(img);document.querySelectorAll('.poster-open').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.sample)===i)));}
document.getElementById('browse-layout').addEventListener('click',()=>layout('browse'));
document.getElementById('workbench-layout').addEventListener('click',()=>layout('workbench'));
function filter(){const query=document.getElementById('query').value.toLowerCase();const container=document.getElementById('posters');container.replaceChildren();let count=0;samples.forEach((name,i)=>{if(!name.toLowerCase().includes(query))return;count++;const article=document.createElement('article');article.className='poster';const button=document.createElement('button');button.type='button';button.className='poster-open';button.dataset.sample=String(i);button.setAttribute('aria-pressed',String(selected===i));button.setAttribute('aria-label','Inspect '+name);button.addEventListener('click',()=>{inspect(i);layout('workbench');});const art=document.createElement('img');art.className='art';art.src=studyArtwork[i];art.alt='';art.width=240;art.height=360;const title=document.createElement('h2');title.textContent=name;const meta=document.createElement('p');meta.textContent=[2,3,7].includes(i)?'Series · Continuing':'Movie · 4K';button.append(art);article.append(button,title,meta);container.append(article);});document.getElementById('count').textContent=count+' sample titles';document.getElementById('empty').hidden=count!==0;document.getElementById('clear').hidden=query.length===0;}
document.getElementById('query').addEventListener('input',filter);document.getElementById('clear').addEventListener('click',()=>{document.getElementById('query').value='';filter();document.getElementById('query').focus();});
function navigate(){const name=['library','review','appearance'].includes(location.hash.slice(1))?location.hash.slice(1):'library';document.querySelectorAll('[data-screen]').forEach(s=>s.hidden=s.dataset.screen!==name);document.querySelectorAll('[data-page]').forEach(a=>{if(a.dataset.page===name)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});document.title=name[0].toUpperCase()+name.slice(1)+' | InfoMancer theme study';}
window.addEventListener('hashchange',navigate);controls();filter();inspect(0);navigate();
