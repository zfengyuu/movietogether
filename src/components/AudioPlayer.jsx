import React, {useEffect, useRef} from 'react';

// A separate HTML5 audio element allows the room to play MP3/M4A/OGG/WAV even
// when the WebGL cinema is hidden or running at a low frame rate.
export default function AudioPlayer({media, volume, audioEnabled, playerRef, onEnded, onDuration, onError}){
 const readyCb=useRef({onEnded,onDuration,onError});
 readyCb.current={onEnded,onDuration,onError};
 const reported=useRef('');
 const sourceKey=media.type==='audio'?media.url:'';

 useEffect(()=>{
  const a=playerRef.current;
  if(!a)return;
  a.pause();
  reported.current='';
  if(!sourceKey){a.removeAttribute('src');a.load();return;}
  a.src=sourceKey;
  a.load();
  return ()=>{a.pause();};
 },[sourceKey,playerRef]);

 useEffect(()=>{
  const a=playerRef.current;
  if(!a || media.type!=='audio')return;
  a.volume=Math.max(0,Math.min(1,volume));
  a.muted=!audioEnabled;
 },[volume,audioEnabled,media.type,playerRef]);

 useEffect(()=>{
  const a=playerRef.current;
  if(!a || media.type!=='audio')return;
  const wanted=Math.max(0, media.position+(media.playing?(Date.now()-media.updatedAt)/1000:0));
  const synchronize=()=>{
   const target=Number.isFinite(a.duration)?Math.min(Math.max(0,a.duration-.05),wanted):wanted;
   if(Math.abs(a.currentTime-target)>1.25){try{a.currentTime=target;}catch{}}
  };
  if(a.readyState>0)synchronize();
  else a.addEventListener('loadedmetadata',synchronize,{once:true});
  if(media.playing)a.play().catch(()=>{});else a.pause();
  return ()=>a.removeEventListener('loadedmetadata',synchronize);
 },[media.type,media.url,media.position,media.playing,media.updatedAt,playerRef]);

 useEffect(()=>{
  const a=playerRef.current;
  if(!a)return;
  const onMeta=()=>{
   const d=a.duration;
   if(Number.isFinite(d)&&d>0){
    const key=`${sourceKey}:${Math.round(d)}`;
    if(reported.current!==key){reported.current=key;readyCb.current.onDuration?.(d);}
   }
  };
  const end=()=>readyCb.current.onEnded?.();
  const error=()=>{if(sourceKey)readyCb.current.onError?.('Không thể tải bài hát. Kiểm tra link hoặc định dạng audio.');};
  a.addEventListener('loadedmetadata',onMeta);
  a.addEventListener('ended',end);
  a.addEventListener('error',error);
  return ()=>{a.removeEventListener('loadedmetadata',onMeta);a.removeEventListener('ended',end);a.removeEventListener('error',error);};
 },[playerRef,sourceKey]);
 return <audio ref={playerRef} preload="metadata" playsInline aria-label="Trình phát nhạc chung của phòng"/>;
}
