import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAX_STAGE_DANCERS,SKIN_PRICES,votesNeeded,stageSlot,queueOrder} from '../shared/room-rules.js';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const theatre=read('../src/components/Theatre.jsx'),app=read('../src/App.jsx');
const yt=read('../src/components/YouTubePlayer.jsx'),server=read('../server/index.js');
test('stage has four exclusive spots',()=>{
 assert.equal(MAX_STAGE_DANCERS,4);
 assert.equal(stageSlot([0,1,2].map(i=>({id:String(i),zone:'stage',action:'dance',stageSlot:i}))),3);
 assert.equal(stageSlot([0,1,2,3].map(i=>({id:String(i),zone:'stage',action:'dance',stageSlot:i}))),null);
 assert.equal(stageSlot([{id:'a',zone:'stage',action:'dance',stageSlot:0}], 'a'),0);
});
test('queue sorts by vote then original submit time',()=>{
 const items=[{votes:2,addedAt:300},{votes:3,addedAt:500},{votes:2,addedAt:100}].sort(queueOrder);
 assert.deepEqual(items.map(x=>x.addedAt),[500,100,300]);
});
test('skip vote threshold is possible for a one person room',()=>{assert.equal(votesNeeded(1),1);assert.equal(votesNeeded(10),4);assert.equal(votesNeeded(100),35)});
test('skin costs are server enforced',()=>assert.deepEqual(Object.values(SKIN_PRICES),[10000,20000,30000,50000]));
test('3D screen uses only one iframe and no fullscreen video',()=>{
 assert.match(theatre,/room\.media\.type==='youtube'&&<Html transform center/);
 assert.match(yt,/controls:0/);
 assert.doesNotMatch(yt,/Xem lớn|enterFocus|requestFullscreen/);
 assert.doesNotMatch(app,/watch-full-button|fullscreenVideo/);
});
test('routes, 4 slots and nametags appear',()=>{
 assert.match(theatre,/route\.current=/);assert.match(theatre,/p\.stageSlot/);
 assert.match(theatre,/VỊ TRÍ \{i\+1\}/);assert.match(theatre,/p\.name\.slice\(0,18\)/);
});
test('voice removed from runtime',()=>{
 assert.doesNotMatch(app,/toggleVoice|LiveKitRoom|panel==='voice'/);
 assert.doesNotMatch(server,/livekit\/token|AccessToken/);
});
test('VietQR never credits wallet directly from QR creation',()=>{
 const i=server.indexOf("app.post('/api/wallet/vietqr-intent'");
 const j=server.indexOf("app.get('/api/wallet/vietqr-intent/:reference'",i);
 assert.ok(i>0&&j>i);
 const body=server.slice(i,j);
 assert.doesNotMatch(body,/\.balance\s*(?:\+\+|\+=|=)/);
 assert.match(body,/status:'pending'/);
});
test('chat sends with Enter and emoji picker is interactive',()=>{
 assert.match(app,/onSubmit=\{e=>\{e\.preventDefault\(\)/);
 assert.match(app,/vimo-emoji-panel/);
});
test('no sample video button remains',()=>assert.doesNotMatch(app,/example-youtube|M7lc1UVf-VE/));
