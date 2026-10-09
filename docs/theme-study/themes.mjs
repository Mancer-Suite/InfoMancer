// Evaluation tokens only. Production CSS remains owned by app.css/modern.css.
export const presets = {
  obsidian: {name:'Obsidian', bg:'#0c1014', panel:'#151b21', raised:'#1e2730', text:'#edf1f5', muted:'#a7b3bf', border:'#36434f', accent:'#b9d875'},
  slate: {name:'Slate', bg:'#111820', panel:'#1b2631', raised:'#263544', text:'#edf2f7', muted:'#adbdcd', border:'#485c70', accent:'#8ebee9'},
  ember: {name:'Ember', bg:'#181412', panel:'#231e1a', raised:'#302923', text:'#f3eee8', muted:'#bcb0a2', border:'#584c40', accent:'#dfb586'},
};
export const defaults = {version:1, preset:'obsidian', accent:presets.obsidian.accent, density:'comfortable', highContrast:false};
export function luminance(hex) {
  const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
export function contrast(a,b) {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function actionText(accent) {return contrast(accent,'#000000')>=contrast(accent,'#ffffff')?'#000000':'#ffffff';}
export function validate(config) {
  if(!config||typeof config!=='object'||Array.isArray(config)||config.version!==1||typeof config.preset!=='string'||!Object.hasOwn(presets,config.preset))return 'Choose a supported theme.';
  if(typeof config.accent!=='string'||!/^#[0-9a-f]{6}$/i.test(config.accent))return 'Use a six-digit color value.';
  if(!['comfortable','compact'].includes(config.density)||typeof config.highContrast!=='boolean')return 'Unsupported appearance preference.';
  const p=presets[config.preset];
  if(contrast(config.accent,p.bg)<3||contrast(config.accent,p.panel)<3||contrast(config.accent,p.raised)<3)return 'This accent is too close to the surfaces. Choose a lighter accent for visible controls and focus.';
  if(contrast(config.accent,actionText(config.accent))<4.5)return 'This accent cannot support readable action text.';
  return '';
}
export function normalize(config) {
  if(validate(config))return {...defaults};
  // Allowlist values. Never persist arbitrary imported CSS or unknown properties.
  return {version:1,preset:config.preset,accent:config.accent.toLowerCase(),density:config.density,highContrast:config.highContrast};
}
