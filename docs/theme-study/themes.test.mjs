import assert from 'node:assert/strict';
import {presets,defaults,validate,normalize,contrast,actionText} from './themes.mjs';
let checks=0;
for(const [id,p]of Object.entries(presets)){
 const c={...defaults,preset:id,accent:p.accent};assert.equal(validate(c),'');checks++;
 for(const surface of [p.bg,p.panel,p.raised]){assert.ok(contrast(p.text,surface)>=4.5);assert.ok(contrast(p.muted,surface)>=4.5);assert.ok(contrast(p.accent,surface)>=3);assert.ok(contrast('#f0c887',surface)>=4.5);assert.ok(contrast('#ffa59f',surface)>=4.5);checks+=5;}
 assert.ok(contrast(actionText(p.accent),p.accent)>=4.5);checks++;
 assert.ok(validate({...c,accent:p.bg}));checks++;
}
for(const bad of [null,[],{}, {...defaults,preset:'__proto__'}, {...defaults,preset:{}}, {...defaults,accent:'red; background:url(x)'}, {...defaults,density:'giant'}, {...defaults,highContrast:'yes'}, {...defaults,version:2}]){assert.ok(validate(bad));assert.deepEqual(normalize(bad),defaults);checks+=2;}
assert.deepEqual(normalize({...defaults,css:'untrusted',script:'untrusted'}),defaults);checks++;
assert.equal(contrast('#000000','#ffffff'),21);checks++;
console.log(`${checks} theme validation and contrast assertions passed`);
