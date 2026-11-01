import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const theatre=readFileSync(new URL('../src/components/Theatre.jsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
const player=readFileSync(new URL('../src/components/YouTubePlayer.jsx',import.meta.url),'utf8');

test('YouTube surface is anchored to the cinema plane in CSS3D',()=>{
 assert.match(theatre,/room\.media\.type==='youtube'&&<Html transform center distanceFactor=\{0\.96\}/);
 assert.match(theatre,/position=\{\[0,4\.80,-8\.37\]\}/);
 assert.match(theatre,/<YouTubePlayer/);
 assert.doesNotMatch(app,/screenRect|onScreenRect/);
});
test('priority photos use the same 3D projection',()=>{
 assert.match(theatre,/room\.photoActive&&<Html transform center/);
 assert.match(theatre,/className="photo-projection vimo-photo-plane"/);
});
test('same YouTube iframe is used for room and fullscreen',()=>{
 assert.match(player,/requestFullscreen\?\.\(\)/);
 assert.match(player,/controls:0/);
 assert.doesNotMatch(player,/style=\{!focus\?/);
});
