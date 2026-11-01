import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const theatre=readFileSync(new URL('../src/components/Theatre.jsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const player=readFileSync(new URL('../src/components/YouTubePlayer.jsx',import.meta.url),'utf8');
test('official YouTube iframe stays attached to cinema plane in 3D',()=>{
 assert.match(theatre,/room\.media\.type==='youtube'&&<Html transform center distanceFactor=\{0\.96\}/);
 assert.match(theatre,/position=\{\[0,4\.80,-8\.37\]\}/);
 assert.match(theatre,/<YouTubePlayer/);
 assert.doesNotMatch(app,/screenRect|onScreenRect/);
});
test('priority photos follow 3D perspective',()=>{
 assert.match(theatre,/room\.photoActive&&<Html transform center/);
 assert.match(theatre,/className="photo-projection vimo-photo-plane"/);
});
test('no enlarged detached YouTube player',()=>{
 assert.doesNotMatch(player,/requestFullscreen|enterFocus|Xem lớn/);
 assert.match(player,/controls:0/);
 assert.doesNotMatch(app,/fullscreenVideo|watch-full-button/);
});
