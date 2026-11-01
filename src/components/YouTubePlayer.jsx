import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Volume2, ExternalLink, Info} from 'lucide-react';
import {extractYouTubeId} from '../utils/youtube.js';

// The official YouTube iframe is a DOM surface aligned to the WebGL screen.
// Its built-in transport controls are hidden with the documented controls=0
// parameter; room-wide playback is controlled through the app's buttons.
// YouTube overlays, logos and embedding restrictions cannot be suppressed.
let apiPromise;
function loadYouTubeAPI(){
 if(window.YT?.Player) return Promise.resolve(window.YT);
 if(apiPromise) return apiPromise;
 apiPromise=new Promise((resolve,reject)=>{
  const original=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=()=>{original?.();resolve(window.YT);};
  let script=document.getElementById('vimo-youtube-api');
  if(!script){
   script=document.createElement('script');script.id='vimo-youtube-api';
   script.src='https://www.youtube.com/iframe_api';script.async=true;
   script.onerror=()=>{apiPromise=undefined;reject(new Error('Không tải được YouTube API. Kiểm tra kết nối hoặc bộ chặn quảng cáo.'));};
   document.head.appendChild(script);
  }
 });
 return apiPromise;
}
const currentPosition=m=>Math.max(0,(m.position||0)+(m.playing?(Date.now()-m.updatedAt)/1000:0));

export default function YouTubePlayer({media,volume,audioEnabled,focus,onFocusChange,onEnableAudio,onEnded,onDuration,onError}){
 const videoId=useMemo(()=>extractYouTubeId(media.url),[media.url]);
 const mount=useRef(null),wrapper=useRef(null),player=useRef(null),ready=useRef(false),data=useRef({});
 const [blocked,setBlocked]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 data.current={media,volume,audioEnabled,onEnded,onDuration,onError};
 useEffect(()=>{
  if(!videoId||!mount.current)return;
  let cancelled=false;ready.current=false;setError('');setBlocked(false);setLoaded(false);
  const node=mount.current;
  const apiNode=document.createElement('div');apiNode.className='yt-instance';node.appendChild(apiNode);
  loadYouTubeAPI().then(YT=>{
   if(cancelled||!node.isConnected)return;
   const instance=new YT.Player(apiNode,{
    videoId,
    width:'100%',height:'100%',
    playerVars:{playsinline:1,controls:0,fs:0,rel:0,disablekb:1,enablejsapi:1,origin:window.location.origin},
    events:{
     onReady:event=>{
      if(cancelled)return;
      player.current=event.target;ready.current=true;setLoaded(true);
      const {media:m,volume:v,audioEnabled:a}=data.current;
      try{
       const iframe=event.target.getIframe();
       iframe?.setAttribute('allow','accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen');
       iframe?.setAttribute('allowfullscreen','');
       iframe?.setAttribute('referrerpolicy','strict-origin-when-cross-origin');
       event.target.setVolume(Math.round(v*100));
       if(a)event.target.unMute();else event.target.mute();
       if(currentPosition(m)>1)event.target.seekTo(currentPosition(m),true);
       if(m.playing)event.target.playVideo();
      }catch{}
     },
     onStateChange:event=>{if(event.data===YT.PlayerState.ENDED)data.current.onEnded?.();},
     onAutoplayBlocked:()=>{if(!cancelled)setBlocked(true);},
     onError:event=>{
      const msg=[101,150].includes(event.data)?'Chủ video không cho phép nhúng. Bạn có thể mở video trên YouTube.':
       event.data===100?'Video không khả dụng hoặc đã bị xóa.':'Không thể phát video này trong trình nhúng YouTube.';
      setError(msg);data.current.onError?.(msg);
     }
    }
   });
   player.current=instance;
  }).catch(e=>{if(!cancelled){setError(e.message);data.current.onError?.(e.message);}});
  return()=>{cancelled=true;ready.current=false;
   try{player.current?.destroy?.();}catch{}
   player.current=null;
   // YT.Player replaces the mount div by an iframe. Restore a clean mount on
   // source change without ever creating two simultaneously-playing players.
   if(node.isConnected)node.replaceChildren();
  };
 },[videoId]);
 useEffect(()=>{
  if(!ready.current||!player.current)return;
  try{
   const p=player.current;
   const target=currentPosition(media);
   if(Math.abs(p.getCurrentTime()-target)>2.5)p.seekTo(target,true);
   if(media.playing)p.playVideo();else p.pauseVideo();
  }catch{}
 },[media.position,media.playing,media.updatedAt,videoId]);
 useEffect(()=>{
  if(!ready.current||!player.current)return;
  try{player.current.setVolume(Math.round(volume*100));if(audioEnabled)player.current.unMute();else player.current.mute();}catch{}
 },[volume,audioEnabled]);
 useEffect(()=>{
  if(!ready.current||!player.current)return;
  const duration=Number(player.current.getDuration?.()||0);
  if(duration>0&&(!media.duration||Math.abs(duration-media.duration)>2))onDuration?.(duration);
 },[loaded,media.duration,videoId,onDuration]);
 const start=()=>{
  onEnableAudio?.();setBlocked(false);
  try{player.current?.unMute();player.current?.playVideo();}catch{}
 };

 return <>
  <section ref={wrapper} className="youtube-layer vimo-three-youtube" aria-label="Trình phát YouTube trong rạp">

   <div className="youtube-video-surface">
    <div className="yt-native-player"><div key={videoId} ref={mount} className="yt-mount"/></div>
   </div>

   {!focus&&<div className="youtube-outside-actions">{(blocked||!audioEnabled)&&<button onClick={start}><Volume2 size={14}/> Bật video</button>}</div>}
   {error&&<div className="youtube-error"><Info size={17}/><span>{error}</span><a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">Mở YouTube <ExternalLink size={13}/></a></div>}
  </section>
 </>;
}
