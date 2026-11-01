import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const base=process.env.TEST_BASE_URL||'http://127.0.0.1:3001';
const req=async(path,options)=>{const r=await fetch(base+path,options);assert(r.ok,`HTTP ${r.status}: ${path}`);return r.json()};
const connect=()=>new Promise((resolve,reject)=>{
 const c=io(base,{reconnection:false});c.on('connect',()=>resolve(c));c.on('connect_error',reject);
});
const ack=(s,name,data)=>new Promise((resolve,reject)=>{
 const t=setTimeout(()=>reject(new Error(`Timeout event ${name}`)),3000);
 s.emit(name,data,r=>{clearTimeout(t);resolve(r)});
});
let a,b;
try{
 const health=await req('/api/health');assert.equal(health.ok,true);
 const create=await req('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Automated smoke test',password:'securetest'})});
 assert(create.id);
 [a,b]=await Promise.all([connect(),connect()]);
 let r=await ack(a,'join_room',{roomId:create.id,name:'Alice',password:'wrong'});
 assert.equal(r.ok,false,'Wrong password must fail');
 const host=await ack(a,'join_room',{roomId:create.id,name:'Alice',password:'securetest'});assert(host.ok);
 const guest=await ack(b,'join_room',{roomId:create.id,name:'Bob',password:'securetest'});assert(guest.ok);
 assert.equal(guest.room.participants.length,2);
 r=await ack(b,'choose_seat',0);assert.equal(r.ok,false,'Occupied seat must fail');
 r=await ack(b,'choose_seat',21);assert(r.ok,'Free seat should work');
 r=await ack(b,'media_control',{command:'pause'});assert.equal(r.ok,false,'Guest cannot control player');
 r=await ack(a,'media_control',{command:'play'});assert(r.ok);
 r=await ack(a,'media_control',{command:'seek',position:30});assert(r.ok);
 r=await ack(b,'avatar_action',{action:'dance',dance:'shuffle'});assert(r.ok);
 r=await ack(b,'avatar_action',{action:'dance',dance:'shuffle',zone:'stage'});assert(r.ok,'Dancing on stage should work');
 r=await ack(b,'appearance_update',{color:2,hair:1,accessory:2,pants:3});assert(r.ok,'Outfit sync should work');
 r=await ack(a,'media_control',{command:'stage_theme',theme:'galaxy'});assert(r.ok,'Stage theme should work');
 r=await ack(b,'support_gift',{gift:'heart'});assert(r.ok,'Virtual gifts should work');
 r=await ack(b,'chat_send','Hello from Bob');assert(r.ok);
 r=await ack(b,'queue_add',{url:'demo:',type:'demo',title:'Test disco'});assert(r.ok);
 r=await ack(b,'queue_add',{url:'https://youtu.be/jfKfPfyJRdk',title:'Demo YouTube'});assert(r.ok&&r.id,'YouTube queue should work');
 r=await ack(b,'queue_vote',{id:r.id});assert(r.ok,'Queue voting should work');
 r=await ack(b,'vote_skip',{});assert(r.ok);
 r=await ack(a,'vote_skip',{});assert(r.ok);
 console.log('✅ 2 users, rooms, seats, YouTube queue, outfits, stage dancing/themes, virtual gifts, permissions, chat, skip vote PASS');
} catch(e){console.error('❌ Smoke test failed:',e);process.exitCode=1;}finally{a?.disconnect();b?.disconnect();}
