import {useCallback,useEffect,useRef,useState} from 'react';

// One microphone broadcaster per Music Box. Direct peer-to-peer WebRTC is intended
// for small (<=8) test rooms. A TURN server or LiveKit SFU is required for broad NAT support.
export function useKaraokeMic(socket,room,you,notify){
 const [broadcasting,setBroadcasting]=useState(false);
 const stream=useRef(null),peers=useRef(new Map()),elements=useRef(new Map()),singer=useRef(null),roomRef=useRef(room);
 roomRef.current=room;
 const closePeers=useCallback(()=>{
  peers.current.forEach(pc=>pc.close());peers.current.clear();
  elements.current.forEach(a=>a.remove());elements.current.clear();
 },[]);
 const stopLocal=useCallback(()=>{stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setBroadcasting(false);closePeers();},[closePeers]);
 const makePeer=useCallback((remoteId)=>{
  if(peers.current.has(remoteId))return peers.current.get(remoteId);
  const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  pc.onicecandidate=e=>{if(e.candidate)socket.emit('karaoke_signal',{to:remoteId,type:'ice',data:e.candidate.toJSON()});};
  pc.ontrack=e=>{let audio=elements.current.get(remoteId);if(!audio){audio=document.createElement('audio');audio.autoplay=true;audio.playsInline=true;audio.setAttribute('aria-label','Âm thanh người đang hát');document.body.appendChild(audio);elements.current.set(remoteId,audio);}audio.srcObject=e.streams[0]||new MediaStream([e.track]);audio.play().catch(()=>{});};
  pc.onconnectionstatechange=()=>{if(['failed','closed'].includes(pc.connectionState)){pc.close();peers.current.delete(remoteId);}};
  peers.current.set(remoteId,pc);return pc;
 },[socket]);
 const callListener=useCallback(async remoteId=>{
  if(!stream.current||peers.current.has(remoteId))return;
  const pc=makePeer(remoteId);
  stream.current.getTracks().forEach(track=>pc.addTrack(track,stream.current));
  const offer=await pc.createOffer();await pc.setLocalDescription(offer);
  socket.emit('karaoke_signal',{to:remoteId,type:'offer',data:{type:offer.type,sdp:offer.sdp}});
 },[makePeer,socket]);
 const start=useCallback(async()=>{
  if(!roomRef.current||roomRef.current.category!=='musicbox')return;
  if(!navigator.mediaDevices?.getUserMedia){notify('Mic yêu cầu HTTPS hoặc localhost.');return;}
  try{
   const local=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
   const ack=await new Promise(resolve=>socket.emit('karaoke_enqueue',{},resolve));
   if(!ack?.ok){local.getTracks().forEach(t=>t.stop());notify(ack?.error||'Không đăng ký hát được');return;}
   stream.current=local;setBroadcasting(true);
  }catch(e){notify(`Không mở được mic: ${e.message}`);}
 },[socket,notify]);
 const stop=useCallback(()=>{socket.emit('karaoke_leave',{});stopLocal();},[socket,stopLocal]);
 const nowSinger=room?.karaokeSinger, members=(room?.participants||[]).map(x=>x.id).sort().join('|');
 useEffect(()=>{
  if(room?.category!=='musicbox'||!you){stopLocal();return;}
  if(singer.current!==nowSinger){singer.current=nowSinger;closePeers();}
  if(stream.current&&nowSinger===you){for(const other of (room.participants||[]))if(other.id!==you)callListener(other.id).catch(()=>{});}
  if(stream.current&&nowSinger!==you){ // waiting in singing queue; release local microphone until selected
   stopLocal();
  }
 },[room?.category,nowSinger,members,you,callListener,closePeers,stopLocal]);
 useEffect(()=>{
  const onSignal=async ({from,type,data})=>{
   if(!roomRef.current||roomRef.current.category!=='musicbox'||![from,you].includes(roomRef.current.karaokeSinger))return;
   try{
    const pc=makePeer(from);
    if(type==='offer'){
     await pc.setRemoteDescription(new RTCSessionDescription(data));
     const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
     socket.emit('karaoke_signal',{to:from,type:'answer',data:{type:answer.type,sdp:answer.sdp}});
    }else if(type==='answer')await pc.setRemoteDescription(new RTCSessionDescription(data));
    else if(type==='ice'){
     if(pc.remoteDescription)await pc.addIceCandidate(new RTCIceCandidate(data));
    }
   }catch(error){notify(`Kết nối mic gặp lỗi: ${error.message}`);}
  };
  socket.on('karaoke_signal',onSignal);return()=>socket.off('karaoke_signal',onSignal);
 },[socket,you,makePeer,notify]);
 useEffect(()=>()=>{stopLocal();},[stopLocal]);
 return {broadcasting,start,stop};
}
