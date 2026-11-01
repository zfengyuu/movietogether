import {useEffect,useRef,useState} from 'react';
// A tiny original synthetic disco beat, generated locally (no copyrighted audio assets).
export function useBeat(media,bpm,volume){
 const ctx=useRef(null),[enabled,setEnabled]=useState(false);
 const state=useRef({media,bpm,volume});state.current={media,bpm,volume};
 const beat=useRef(-1);
 const enable=async()=>{
  if(!ctx.current)ctx.current=new (window.AudioContext||window.webkitAudioContext)();
  await ctx.current.resume();setEnabled(true);
 };
 const disable=()=>{setEnabled(false);ctx.current?.suspend();};
 useEffect(()=>{
  if(!enabled)return;
  const t=setInterval(()=>{
   const ac=ctx.current;if(!ac||ac.state!=='running')return;
   const {media,bpm,volume}=state.current;
   if(media?.type!=='demo'||!media.playing)return;
   const elapsed=media.position+(Date.now()-media.updatedAt)/1000;
   const index=Math.floor(elapsed*bpm/60);
   if(index<beat.current-2)beat.current=index-1; // Handle rewinds / switching tracks.
   if(index<=beat.current)return;beat.current=index;
   const now=ac.currentTime;
   const gain=ac.createGain();gain.gain.setValueAtTime(Math.max(.001,volume*.10),now);gain.gain.exponentialRampToValueAtTime(.001,now+.13);gain.connect(ac.destination);
   const osc=ac.createOscillator();osc.type=index%4===0?'sine':'triangle';osc.frequency.setValueAtTime(index%4===0?130:220,now);osc.frequency.exponentialRampToValueAtTime(index%4===0?50:145,now+.11);osc.connect(gain);osc.start(now);osc.stop(now+.14);
  },24);
  return ()=>clearInterval(t);
 },[enabled]);
 useEffect(()=>()=>ctx.current?.close(),[]);
 return {enabled,enable,disable};
}
