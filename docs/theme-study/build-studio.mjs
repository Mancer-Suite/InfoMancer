import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {presets,actionText,contrast} from './themes.mjs';
import {poster,sampleTitles} from './art.mjs';
const dir=fileURLToPath(new URL('.',import.meta.url));
mkdirSync(dir+'artwork',{recursive:true});
for(let i=0;i<sampleTitles.length;i++){
 writeFileSync(dir+`artwork/${i}.svg`,poster(i));
 execFileSync('inkscape',[dir+`artwork/${i}.svg`,'--export-type=png','--export-filename='+dir+`artwork/${i}.png`],{stdio:'ignore'});
}
const artwork=sampleTitles.map((_,i)=>'data:image/png;base64,'+readFileSync(dir+`artwork/${i}.png`).toString('base64'));
const logo=readFileSync(dir+'logo.svg','utf8');
const logoAt=(x,y,w=190)=>logo.replace('<svg ',`<svg x="${x}" y="${y}" width="${w}" height="${w*420/1800}" `);
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
function concept(p,mode='browse'){
 const width=1440,wb=mode==='workbench',appearance=mode==='appearance',height=wb?1110:1040;
 const text=(x,y,s,size=14,fill=p.text,font='Manrope',weight=400)=>`<text x="${x}" y="${y}" fill="${fill}" font-family="${font==='Barlow Condensed'?'Barlow Condensed SemiBold':font==='Manrope'&&weight===600?'Manrope SemiBold':font}" font-size="${size}" font-weight="${weight}">${xml(s)}</text>`;
 const mono=(x,y,s,size=10,fill=p.muted)=>text(x,y,s,size,fill,'IBM Plex Mono');
 const display=(x,y,s,size=44)=>text(x,y,s,size,p.text,'Barlow Condensed',600);
 const rect=(x,y,w,h,fill=p.panel,rx=7,stroke=p.border)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}"/>`;
 const panel=(x,y,w,h)=>`<g filter="url(#shadow)">${rect(x,y,w,h,'url(#panel)')}</g><path d="M${x+8} ${y+1}h${w-16}" stroke="#ffffff" opacity=".07"/>`;
 const line=(x,y,w)=>`<path d="M${x} ${y}h${w}" stroke="${p.border}"/>`;
 const art=(i,x,y,w,h)=>`<image x="${x}" y="${y}" width="${w}" height="${h}" xlink:href="${artwork[i]}"/>`;
 let s=`<defs><linearGradient id="panel" x1="0%" y1="0%" x2="0%" y2="100%"><stop stop-color="${p.raised}"/><stop offset="1" stop-color="${p.panel}"/></linearGradient><filter id="shadow" x="-.1" y="-.1" width="1.2" height="1.2"><feGaussianBlur in="SourceAlpha" stdDeviation="5"/><feOffset dx="0" dy="6"/><feComponentTransfer><feFuncA type="linear" slope=".35"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>${rect(0,0,width,height,p.bg,0,'none')}${rect(0,0,232,height,'url(#panel)',0)}${logoAt(20,25,196)}`;
 s+=mono(24,106,'MEDIA WORKSPACE')+line(24,127,184);
 for(const [i,name]of ['Library','Review','Appearance'].entries()){const y=171+i*54,active=appearance?i===2:i===0;if(active)s+=panel(12,y-29,208,43)+rect(13,y-29,3,43,p.accent,1,'none');s+=text(30,y,['▤','◎','◈'][i],20,active?p.accent:p.muted)+text(64,y,name,14,active?p.text:p.muted,'Manrope',active?600:400);}
 s+=line(24,351,184)+mono(24,378,'LOCAL CATALOG')+text(24,408,'10 sample titles',14)+text(24,432,'7 movies · 3 series',12,p.muted)+mono(24,981,'DESIGN EVALUATION')+mono(24,1002,'Sample data · Local only');
 s+=line(256,66,1160)+mono(256,40,'INFOMANCER / WORKSPACE')+rect(1270,22,142,27,p.panel,5)+text(1285,40,'Sample catalog',11,p.muted);
 s+=mono(256,106,appearance?'MAKE IT YOURS':'BROWSE & INSPECT')+display(256,153,appearance?'APPEARANCE STUDIO':'THE LIBRARY')+text(256,182,appearance?'A personal palette. A consistent workspace.':'Your films, series and the details that matter.',14,p.muted);
 if(appearance){
  s+=panel(256,222,1160,610)+display(280,261,'SURFACE PALETTE',25);
  Object.values(presets).forEach((t,i)=>{const x=280+i*376;s+=rect(x,286,352,198,t.panel,8,i===0?p.accent:p.border)+rect(x+16,302,320,108,t.bg,5,t.border)+rect(x+16,302,48,108,t.raised,0,'none')+rect(x+78,316,155,8,t.muted,2,'none');for(let a=0;a<3;a++)s+=art(a,x+78+a*54,342,42,63);s+=rect(x+275,386,43,7,t.accent,2,'none')+text(x+18,441,t.name,16,p.text,'Manrope',600)+text(x+18,466,['Ink, graphite and restrained lime','Cool steel with a soft blue signal','Warm graphite and brass'][i],12,p.muted);});
  s+=line(280,514,1112)+display(280,553,'ACCENT COLOR',24)+rect(280,573,44,44,p.accent,6)+rect(338,573,190,44,p.bg,6)+mono(354,601,p.accent.toUpperCase(),13,p.text)+text(550,601,'Selection, focus and primary actions.',13,p.muted)+display(280,671,'DENSITY',24)+rect(280,688,145,44,p.raised,6,p.accent)+text(295,716,'Comfortable',13)+rect(437,688,119,44,p.panel,6)+text(453,716,'Compact',13,p.muted)+display(780,671,'HIGH CONTRAST',24)+text(780,716,'Strengthen text, boundaries and focus.',13,p.muted)+rect(1270,695,43,23,p.border,12,'none')+rect(1274,699,15,15,p.text,8,'none')+line(280,758,1112)+text(280,802,'Preview changes, then apply or discard.',12,p.muted)+rect(1058,775,125,39,p.raised,6)+text(1080,800,'Discard',13)+rect(1195,775,196,39,p.accent,6)+text(1212,800,'Apply appearance',13,actionText(p.accent),'Manrope',600);
  s+=panel(256,860,1160,110)+mono(280,890,'TYPE SYSTEM')+display(280,929,'BARLOW CONDENSED',27)+text(674,927,'Manrope for reading and controls',14)+mono(1060,927,'IBM PLEX MONO',12,p.text);
 }else{
  s+=rect(1192,131,222,42,p.panel,6)+rect(wb?1308:1197,136,101,32,p.raised,4,'none')+text(1222,158,'Browse',12,wb?p.muted:p.text)+text(1320,158,'Workbench',12,wb?p.text:p.muted)+`<path d="M${wb?1314:1203} 170h88" stroke="${p.accent}" stroke-width="2"/>`;
  const stageW=wb?848:1160;const shown=wb?8:10;const cardW=wb?178:170,step=cardW+16,cols=wb?4:6;
  s+=panel(256,216,stageW,wb?780:754)+mono(276,244,'LIBRARY')+mono(256+stageW-163,244,wb?'8 VISIBLE / 10':'10 SAMPLE TITLES')+line(276,262,stageW-40)+rect(276,279,Math.min(470,stageW-165),42,p.bg,6)+text(292,305,'Search your library',13,p.muted)+mono(256+stageW-86,305,'COVERS');
  for(let i=0;i<shown;i++){const x=276+i%cols*step,y=343+Math.floor(i/cols)*(wb?326:305);if(wb&&i===0)s+=rect(x-4,y-4,cardW+8,cardW*1.5+8,'none',6,p.accent);s+=`<g filter="url(#shadow)">${art(i,x,y,cardW,cardW*1.5)}</g>`+text(x,y+cardW*1.5+21,sampleTitles[i],i===5?11:12,p.text,'Manrope',600)+mono(x,y+cardW*1.5+42,[2,3,7].includes(i)?'SERIES · CONTINUING':'MOVIE · 4K',9);}
  if(wb){
   s+=panel(1116,216,300,851)+mono(1134,244,'INSPECTOR')+mono(1322,244,'READ ONLY')+line(1134,262,264);
   s+=`<defs><clipPath id="inspector-crop"><rect x="1117" y="278" width="298" height="185"/></clipPath></defs><image x="1117" y="222" width="298" height="447" xlink:href="${artwork[0]}" clip-path="url(#inspector-crop)"/>`;
   s+=mono(1134,497,'SELECTED TITLE')+display(1134,535,'ARRIVAL',35)+text(1134,563,'2016 · Science fiction · Movie',12,p.muted)+text(1134,600,'A file and its evidence, kept beside',12,p.muted)+text(1134,619,'the library you are working in.',12,p.muted)+rect(1134,649,264,233,p.bg,6)+mono(1149,675,'MEDIA FILE')+text(1149,701,'Arrival (2016).mkv',13)+line(1149,722,234);
   [['Resolution','3840 × 2160'],['Video','HEVC · HDR10'],['Audio','DTS · 5.1'],['Container','Matroska']].forEach(([a,b],i)=>{const y=751+i*32;s+=text(1149,y,a,11,p.muted)+mono(1256,y,b,10,p.text);});s+=text(1134,920,'Keep selection and browsing context.',11,p.muted)+text(1134,940,'Panel arrangement is a separate choice.',11,p.muted);
   s+=panel(256,1008,848,59)+mono(276,1033,'ACTIVITY')+text(380,1033,'Catalog scan completed',12)+mono(744,1033,'10 TITLES · 00:12');
  }
 }
 s+=mono(256,height-17,`${p.name} · Revised concept illustration · Actual logo, original sample artwork`);
 return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1440" height="${height}" viewBox="0 0 1440 ${height}">${s}</svg>`;
}
for(const [name,p,mode]of [['studio-library',presets.obsidian,'browse'],['studio-workbench',presets.obsidian,'workbench'],['studio-slate',presets.slate,'workbench'],['studio-appearance',presets.obsidian,'appearance']])writeFileSync(dir+name+'.svg',concept(p,mode));
// A separate mobile drawing, not a claim of browser responsive verification.
const p=presets.obsidian;
const t=(x,y,s,size=13,font='Manrope',fill=p.text,weight=400)=>`<text x="${x}" y="${y}" fill="${fill}" font-family="${font==='Barlow Condensed'?'Barlow Condensed SemiBold':font==='Manrope'&&weight===600?'Manrope SemiBold':font}" font-size="${size}" font-weight="${weight}">${xml(s)}</text>`;
let mobile=`<rect width="390" height="1150" fill="${p.bg}"/><rect width="390" height="123" fill="${p.panel}"/>`+logoAt(15,15,212)+t(20,102,'▤ Library',13,'Manrope',p.text,600)+t(144,102,'◎ Review',13,'Manrope',p.muted)+t(254,102,'◈ Appearance',13,'Manrope',p.muted)+`<path d="M20 116h83" stroke="${p.accent}" stroke-width="2"/>`+t(16,153,'BROWSE & INSPECT',10,'IBM Plex Mono',p.muted)+t(16,198,'THE LIBRARY',40,'Barlow Condensed',p.text,600)+t(16,226,'Your films, series and the details that matter.',12,'Manrope',p.muted)+`<rect x="12" y="250" width="366" height="825" rx="8" fill="${p.panel}" stroke="${p.border}"/>`+t(24,279,'LIBRARY',10,'IBM Plex Mono',p.muted)+t(250,279,'10 SAMPLE TITLES',9,'IBM Plex Mono',p.muted)+`<rect x="24" y="299" width="342" height="43" rx="6" fill="${p.bg}" stroke="${p.border}"/>`+t(38,326,'Search your library',12,'Manrope',p.muted);
for(let i=0;i<4;i++){const x=24+i%2*180,y=366+Math.floor(i/2)*341;mobile+=`<image x="${x}" y="${y}" width="162" height="243" xlink:href="${artwork[i]}"/>`+t(x,y+267,sampleTitles[i],i===1?10:12,'Manrope',p.text,600)+t(x,y+289,i>1?'SERIES · CONTINUING':'MOVIE · 4K',8,'IBM Plex Mono',p.muted);}
mobile+=t(16,1124,'MOBILE CONCEPT · ILLUSTRATIVE ARTWORK',9,'IBM Plex Mono',p.muted);
writeFileSync(dir+'studio-mobile.svg',`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="390" height="1150" viewBox="0 0 390 1150">${mobile}</svg>`);
const faces=[['Barlow Condensed',600,'barlow-condensed-latin-600-normal.woff2'],['Manrope',400,'manrope-latin-400-normal.woff2'],['Manrope',600,'manrope-latin-600-normal.woff2'],['IBM Plex Mono',400,'ibm-plex-mono-latin-400-normal.woff2']];
const fontCSS=faces.map(([family,weight,file])=>`@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${readFileSync(dir+'fonts/'+file).toString('base64')}) format('woff2')}`).join('\n');
const paletteCSS=Object.entries(presets).map(([id,p])=>`.${id}-preview{--preview-bg:${p.bg};--preview-raised:${p.raised};--preview-border:${p.border};--preview-accent:${p.accent}}`).join('\n');
const css=readFileSync(dir+'prototype.css','utf8');
const behavior=readFileSync(dir+'prototype.js','utf8');
const tokenCode=readFileSync(dir+'themes.mjs','utf8').replaceAll('export ','');
const markup=readFileSync(dir+'prototype-body.html','utf8').replace('{{LOGO}}',logo);
writeFileSync(dir+'index.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>InfoMancer media workbench study</title><style>${fontCSS}\n${paletteCSS}\n${css}</style></head><body>${markup}<script>${tokenCode}\nconst studyArtwork=${JSON.stringify(artwork)};\n${behavior}</script></body></html>`);
writeFileSync(dir+'comparison.html',`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>InfoMancer design comparison</title><style>${fontCSS}\n${readFileSync(dir+'comparison.css','utf8')}</style></head><body>${readFileSync(dir+'comparison-body.html','utf8').replace('{{LOGO}}',logo)}</body></html>`);
for(const p of Object.values(presets))console.log(`${p.name}: body/panel ${contrast(p.text,p.panel).toFixed(2)}:1; accent/raised ${contrast(p.accent,p.raised).toFixed(2)}:1`);

for(const name of ["studio-library","studio-workbench","studio-slate","studio-appearance","studio-mobile"])execFileSync("inkscape",[dir+name+".svg","--export-type=png","--export-filename="+dir+name+".png"],{stdio:"ignore"});
