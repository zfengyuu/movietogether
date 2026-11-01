import React,{useEffect,useMemo,useRef,useState} from 'react';

let scriptLoad;
function loadWidget(){
 if(window.SC?.Widget)return Promise.resolve(window.SC.Widget);
 if(scriptLoad)return scriptLoad;
 scriptLoad=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://w.soundcloud.com/player/api.js';script.async=true;
  script.onload=()=>window.SC?.Widget?resolve(window.SC.Widget):reject(Error('SoundCloud widget không có sẵn'));
  script.onerror=()=>reject(Error('Không tải được SoundCloud Widget API'));document.head.appendChild(script);
 }).catch(err=>{scriptLoad=null;throw err});return scriptLoad;
}
const position=media=>Math.max(0,media.position+(media.playing?(Date.now()-media.updatedAt)/1000:0));
export default function SoundCloudPlayer({media,volume=1,audioEnabled=false,onEnded=()=>{},onError=()=>{},onDuration=()=>{}}){
 const iframe=useRef(null),widget=useRef(null),info=useRef({});info.current={media,volume,audioEnabled,onEnded,onError,onDuration};
 const [ready,setReady]=useState(false);
 const embed=useMemo(()=>`https://w.soundcloud.com/player/?url=${encodeURIComponent(media.url)}&color=%239a64f5&auto_play=false&show_artwork=true&visual=true&hide_related=true`,[media.url]);
 useEffect(()=>{
  let active=true;let w;
  loadWidget().then(Widget=>{
   if(!active||!iframe.current)return;
   w=Widget(iframe.current);widget.current=w;
   w.bind(Widget.Events.READY,()=>{if(!active)return;setReady(true);w.getDuration(duration=>{if(duration>0)info.current.onDuration?.(duration/1000)});});
   w.bind(Widget.Events.FINISH,()=>info.current.onEnded?.());
  }).catch(error=>info.current.onError?.(error.message));
  return()=>{active=false;setReady(false);widget.current=null;};
 },[embed]);
 useEffect(()=>{
  if(!ready||!widget.current)return;
  const w=widget.current;
  const update=()=>{
   const m=info.current.media;
   w.setVolume(info.current.audioEnabled?Math.round(info.current.volume*100):0);
   w.getPosition(ms=>{const wanted=position(m);if(Math.abs((ms||0)/1000-wanted)>1.8)w.seekTo(Math.round(wanted*1000));});
   if(m.playing)w.play();else w.pause();
  };
  update();const tick=setInterval(update,6000);return()=>clearInterval(tick);
 },[ready,media.url,media.position,media.playing,media.updatedAt,audioEnabled,volume]);
 return <div className="soundcloud-player"><iframe ref={iframe} title="SoundCloud player" src={embed} allow="autoplay" referrerPolicy="strict-origin-when-cross-origin"/></div>;
}
