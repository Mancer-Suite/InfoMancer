import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {presets,contrast,actionText} from './themes.mjs';
const dir=fileURLToPath(new URL('.',import.meta.url));
const titles=['Arrival','Blade Runner 2049','The Bear','Better Call Saul','Dune','Everything Everywhere','Interstellar','The Last of Us','The Lighthouse','Moonrise Kingdom'];
const colors=['#526c77','#505b70','#775452','#677055','#83704b','#776578','#4b6977','#73705a','#686873','#7a594f'];
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
function svg(p,appearance=false) {
  const height=appearance?930:1040;
  const text=(x,y,s,size=16,fill=p.text,weight=400)=>`<text x="${x}" y="${y}" fill="${fill}" font-family="DejaVu Sans, sans-serif" font-size="${size}" font-weight="${weight}">${xml(s)}</text>`;
  const rect=(x,y,w,h,fill,rx=0,stroke='none')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`;
  const line=(x,y,w)=>`<path d="M${x} ${y}h${w}" stroke="${p.border}"/>`;
  let content=rect(0,0,1280,height,p.bg)+rect(0,0,212,height,p.panel)+text(24,45,'InfoMancer',21,p.text,600)+rect(24,62,28,3,p.accent)+text(24,100,'PERSONAL ARCHIVE',10,p.muted,600);
  for(const [i,name] of ['Overview','Library','Collections','Review','Sources','Activity'].entries()){
    const y=148+i*46;const active=!appearance&&name==='Library';
    if(active)content+=rect(12,y-27,188,38,p.raised,6)+rect(12,y-27,3,38,p.accent,1);
    content+=text(29,y,name,14,active?p.text:p.muted,active?600:400);
  }
  content+=line(24,437,164)+text(28,470,'ACCOUNT',10,p.muted,600)+text(29,506,'Profile',14,p.muted)+text(29,550,'Appearance',14,appearance?p.text:p.muted,appearance?600:400)+text(29,860,'Design study',13,p.muted)+text(29,882,'Local preview only',11,p.muted);
  content+=line(212,68,1068)+text(244,42,appearance?'Account / Appearance':'Library / All titles',13,p.muted)+text(1040,42,'Sample catalog',12,p.muted)+text(244,120,appearance?'Appearance':'Your library',32,p.text,600)+text(244,151,appearance?'One layout. Your preferred palette.':'Movies and television, in one place.',14,p.muted);
  if(appearance){
    content+=text(244,207,'Theme',18,p.text,600)+text(244,232,'Palettes change color, not layout or behavior.',13,p.muted);
    Object.values(presets).forEach((t,i)=>{const x=244+i*320;content+=rect(x,254,300,156,t.panel,8,i===0?p.accent:p.border)+rect(x+16,274,268,75,t.bg,4)+rect(x+25,284,34,55,t.raised,2)+rect(x+70,284,80,8,t.muted,2)+rect(x+70,304,35,35,t.border,2)+rect(x+113,304,35,35,t.border,2)+rect(x+156,304,35,35,t.border,2)+rect(x+224,324,24,8,t.accent,2)+text(x+16,382,t.name,15,p.text,600);});
    content+=line(244,444,940)+text(244,486,'Accent color',18,p.text,600)+text(244,512,'Used for selection, focus and primary actions.',13,p.muted)+rect(244,531,44,44,p.accent,6)+rect(302,531,190,44,p.panel,6,p.border)+text(317,559,p.accent.toUpperCase(),14)+text(512,559,'Contrast checked against every surface',13,p.muted);
    content+=text(244,625,'Density',18,p.text,600)+rect(244,645,146,44,p.raised,6,p.accent)+text(261,673,'Comfortable',14)+rect(402,645,122,44,p.panel,6,p.border)+text(419,673,'Compact',14,p.muted)+text(622,625,'High contrast',18,p.text,600)+text(622,662,'Strengthen text, boundaries and focus.',13,p.muted)+rect(956,634,42,24,p.border,12)+rect(960,638,16,16,p.text,8);
    content+=line(244,740,940)+text(244,784,'Preview before applying. Restore defaults at any time.',13,p.muted)+rect(864,760,124,44,p.panel,6,p.border)+text(883,788,'Discard',14)+rect(1000,760,184,44,p.accent,6)+text(1017,788,'Apply appearance',14,actionText(p.accent),600);
  }else{
    content+=rect(244,181,484,44,p.panel,6,p.border)+text(260,209,'Search titles, people or years',14,p.muted)+rect(744,181,144,44,p.panel,6,p.border)+text(761,209,'All media',14)+rect(904,181,132,44,p.panel,6,p.border)+text(922,209,'Saved views',14)+rect(1052,181,132,44,p.raised,6,p.border)+text(1070,209,'Covers',14);
    content+=text(244,263,'10 sample titles',13,p.muted)+text(993,263,'Recently added',13,p.muted)+line(244,282,940);
    for(let i=0;i<10;i++){const x=244+(i%5)*192,y=306+Math.floor(i/5)*336;content+=rect(x,y,176,264,colors[i],5)+`<circle cx="${x+120}" cy="${y+55}" r="28" fill="#ffffff" opacity=".14"/><path d="M${x} ${y+160}L${x+62} ${y+95}L${x+115} ${y+151}L${x+176} ${y+81}V${y+264}H${x}Z" fill="#000000" opacity=".32"/>`+text(x+14,y+236,['FILM','TELEVISION'][i===2||i===3||i===7?1:0],9,'#ffffff',600)+text(x,y+290,titles[i],i===5?12:14,p.text,600)+text(x,y+312,i===2||i===3||i===7?'Series · Continuing':'Movie · 4K',11,p.muted);}
  }
  content+=text(244,height-24,`${p.name} · Concept illustration, not a production screenshot`,11,p.muted);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="${height}" viewBox="0 0 1280 ${height}" role="img" aria-label="InfoMancer ${p.name} ${appearance?'appearance':'library'} concept">${content}</svg>`;
}
for(const [id,p]of Object.entries(presets))writeFileSync(dir+id+'.svg',svg(p));
writeFileSync(dir+'appearance.svg',svg(presets.obsidian,true));
// Mobile concept uses the same 2:3 artwork, two columns and 16px gaps.
const p=presets.obsidian;
const txt=(x,y,s,size=14,color=p.text,weight=400)=>`<text x="${x}" y="${y}" fill="${color}" font-family="DejaVu Sans, sans-serif" font-size="${size}" font-weight="${weight}">${xml(s)}</text>`;
let phone=`<rect width="390" height="1050" fill="${p.bg}"/><rect width="390" height="104" fill="${p.panel}"/>`+txt(16,34,'InfoMancer',21,p.text,600)+txt(16,79,'Library',14,p.text,600)+txt(116,79,'Review',14,p.muted)+txt(220,79,'Appearance',14,p.muted)+`<path d="M16 94h55" stroke="${p.accent}" stroke-width="2"/>`+txt(16,151,'Your library',28,p.text,600)+txt(16,179,'Movies and television, in one place.',13,p.muted)+`<rect x="16" y="205" width="358" height="44" rx="6" fill="${p.panel}" stroke="${p.border}"/>`+txt(30,233,'Search titles',14,p.muted)+txt(16,285,'10 sample titles',13,p.muted)+txt(236,285,'Recently added',12,p.muted);
for(let i=0;i<4;i++){const x=16+(i%2)*187,y=310+Math.floor(i/2)*333;phone+=`<rect x="${x}" y="${y}" width="171" height="256.5" rx="6" fill="${colors[i]}"/><circle cx="${x+118}" cy="${y+52}" r="26" fill="#ffffff" opacity=".14"/><path d="M${x} ${y+155}l60-60 52 52 59-65V${y+256.5}H${x}Z" fill="#000000" opacity=".32"/>`+txt(x,y+281,titles[i],i===1?12:14,p.text,600)+txt(x,y+305,i>1?'Series · Continuing':'Movie · 4K',11,p.muted);}
phone+=txt(16,1015,'Obsidian · Mobile concept illustration',11,p.muted);
writeFileSync(dir+'mobile.svg',`<svg xmlns="http://www.w3.org/2000/svg" width="390" height="1050" viewBox="0 0 390 1050">${phone}</svg>`);
const css=readFileSync(dir+'prototype.css','utf8');
const behavior=readFileSync(dir+'prototype.js','utf8');
const tokenCode=readFileSync(dir+'themes.mjs','utf8').replaceAll('export ','');
const markup=readFileSync(dir+'prototype-body.html','utf8');
writeFileSync(dir+'index.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>InfoMancer theme study</title><style>${css}</style></head><body>${markup}<script>${tokenCode}\n${behavior}</script></body></html>`);
for(const p of Object.values(presets))console.log(`${p.name}: text ${contrast(p.text,p.panel).toFixed(2)}:1, muted ${contrast(p.muted,p.panel).toFixed(2)}:1, accent ${contrast(p.accent,p.raised).toFixed(2)}:1`);
