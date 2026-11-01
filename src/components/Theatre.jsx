import React, {useEffect, useMemo, useRef} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, RoundedBox, Text, Environment } from '@react-three/drei';
import * as THREE from 'three';
import Hls from 'hls.js';
import YouTubePlayer from './YouTubePlayer.jsx';
import SoundCloudPlayer from './SoundCloudPlayer.jsx';

const colors=['#c1a0fb','#f4a4c9','#87c8ff','#eab4f5','#f4cb96','#88d7d8'];
const seatXY = i => ({x:(i%10-4.5)*1.75, y:0.35+Math.floor(i/10)*.105, z:-2.4+Math.floor(i/10)*1.2});
const pantsColors=['#27333e','#3b3347','#253b38','#644f47','#dfd2bd'];
const danceXY = (p, all) => {
 const stage = p.zone === 'stage';
 const dancers=all.filter(x=>x.action==='dance' && (x.zone==='stage')===stage);
 const i=Math.max(0,dancers.findIndex(x=>x.id===p.id));
 if(!stage && i>=16)return seatXY(p.seat ?? 0);
 return stage
  ? {x:(i%6-2.5)*1.78,y:.72,z:-6.55+Math.floor(i/6)*.92}
  : {x:(i%8-3.5)*1.27,y:.34,z:-4.38+Math.floor(i/8)*.84};
};
function Box({position,args,color,emissive,emissiveIntensity=0,metalness=0,roughness=.72, ...p}){
 return <mesh position={position} {...p}><boxGeometry args={args}/><meshStandardMaterial color={color} emissive={emissive||'#000'} emissiveIntensity={emissiveIntensity} metalness={metalness} roughness={roughness}/></mesh>;
}
function Avatar({p,others,isMe,onClick,lastMessage,bpm=128}){
 const root=useRef(), pivot=useRef(), armL=useRef(), armR=useRef(),head=useRef();
 const seat=p.seat===null?seatXY(0):seatXY(p.seat);
 const target=p.action==='dance'?danceXY(p,others):seat;
 const col=colors[(p.color||0)%colors.length];
 useFrame(({clock},delta)=>{
  if(!root.current||!pivot.current)return;
  const t=clock.getElapsedTime();
  const tx=target.x+(p.action==='dance'&&p.dance==='shuffle'?Math.sin(t*bpm/60*Math.PI*2)*.16:0),tz=target.z,ty=target.y;
  const k=Math.min(1,delta*3.5);
  root.current.position.x+=(tx-root.current.position.x)*k;
  root.current.position.y+=(ty-root.current.position.y)*k;
  root.current.position.z+=(tz-root.current.position.z)*k;
  const dancing=p.action==='dance', active=dancing||p.action==='wave'||p.action==='cheer';
  const beat=t*(bpm/60)*Math.PI*2;
  pivot.current.position.y=p.action==='sit'?-0.17:active?Math.abs(Math.sin(beat))*.13:0;
  pivot.current.rotation.z=dancing?Math.sin(beat)*.16:0;
  pivot.current.rotation.y=p.action==='sit'?Math.PI+Math.sin(t*1.6)*.025:dancing&&p.dance==='spin'?t*2.8:Math.sin(t*1.6)*.12;
  if(armL.current)armL.current.rotation.z=active?(p.action==='cheer'?-2.5:-1.2+Math.sin(beat)*.65):.12;
  if(armR.current)armR.current.rotation.z=active?(p.action==='cheer'?2.5:1.2+Math.cos(beat)*.65):-.12;
  if(head.current)head.current.rotation.z=active?Math.sin(beat)*.13:0;
 });
 return <group ref={root} position={[seat.x,seat.y,seat.z]} onClick={e=>{e.stopPropagation();onClick?.(p)}}>
   <group ref={pivot}>
    <mesh position={[0, .60, 0]} castShadow><capsuleGeometry args={[.2,.33,4,8]}/><meshStandardMaterial color={col}/></mesh>
    <group ref={head} position={[0,1.02,0]}><mesh castShadow><sphereGeometry args={[.245,12,10]}/><meshStandardMaterial color="#e9b99a"/></mesh>
     {p.hair===0&&<mesh position={[0,.13,-.085]}><sphereGeometry args={[.22,12,8,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color="#342a27"/></mesh>}
     {p.hair===1&&<mesh position={[0,.16,-.055]}><sphereGeometry args={[.23,12,8,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color="#e3a9c2"/></mesh>}
     {p.hair===2&&<><mesh position={[0,.20,0]}><sphereGeometry args={[.24,12,8,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color="#83c9e5"/></mesh><mesh position={[0,.15,.20]}><boxGeometry args={[.32,.04,.14]}/><meshStandardMaterial color="#83c9e5"/></mesh></>}
     {p.hair===3&&<mesh position={[0,.21,-.09]}><coneGeometry args={[.24,.37,9]}/><meshStandardMaterial color="#5a437e"/></mesh>}
     {p.accessory===1&&<><Box position={[0,.025,.235]} args={[.30,.09,.045]} color="#202631"/><Box position={[0,.03,.25]} args={[.30,.022,.02]} color="#bdcfd9"/></>}
     {p.accessory===2&&<><mesh position={[-.23,.02,0]}><sphereGeometry args={[.10,8,8]}/><meshStandardMaterial color="#b0ecaa"/></mesh><mesh position={[.23,.02,0]}><sphereGeometry args={[.10,8,8]}/><meshStandardMaterial color="#b0ecaa"/></mesh></>}
     {p.accessory===3&&<mesh position={[0,.36,0]}><coneGeometry args={[.19,.17,7]}/><meshStandardMaterial color="#efdc86" metalness={.65}/></mesh>}
     <mesh position={[-.075,.015,.224]}><sphereGeometry args={[.015,6,4]}/><meshBasicMaterial color="#1c1d22"/></mesh>
     <mesh position={[.075,.015,.224]}><sphereGeometry args={[.015,6,4]}/><meshBasicMaterial color="#1c1d22"/></mesh>
    </group>
    <group ref={armL} position={[-.23,.78,0]}><mesh position={[-.055,-.22,0]} rotation={[0,0,-.12]}><capsuleGeometry args={[.066,.30,4,6]}/><meshStandardMaterial color={col}/></mesh></group>
    <group ref={armR} position={[.23,.78,0]}><mesh position={[.055,-.22,0]} rotation={[0,0,.12]}><capsuleGeometry args={[.066,.30,4,6]}/><meshStandardMaterial color={col}/></mesh></group>
    <Box args={[.15,.27,.16]} position={[-.12,.17,.03]} color={pantsColors[p.pants||0]}/>
    <Box args={[.15,.27,.16]} position={[.12,.17,.03]} color={pantsColors[p.pants||0]}/>
    {isMe&&<mesh position={[0,.012,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.35,.42,32]}/><meshBasicMaterial color="#e6a0ff" side={THREE.DoubleSide}/></mesh>}
    {(p.action==='dance'||p.action==='cheer')&&<Html position={[0,1.45,0]} center distanceFactor={12} style={{pointerEvents:'none'}}><div className="avatar-bubble">{p.action==='cheer'?'🙌':p.zone==='stage'?'⭐':'♫'}</div></Html>}
    {lastMessage&&<Html position={[0,1.85,0]} center distanceFactor={12} style={{pointerEvents:'none'}}><div className="avatar-chat">{lastMessage.text.slice(0,55)}</div></Html>}
    {isMe&&<Html position={[0,1.55,0]} center distanceFactor={12} style={{pointerEvents:'none'}}><div className="avatar-label">Bạn</div></Html>}
   </group>
 </group>;
}
function Stage({disco, theme='neon'}){
 const palette={neon:['#de83ff','#789dff','#2c1a4d'],sunset:['#ffa476','#ff65ba','#42233e'],galaxy:['#80a8ff','#bc84ff','#19183b']}[theme] || ['#78ffc2','#a48df7','#0c2e32'];
 const strips=useRef();
 useFrame(({clock})=>{if(strips.current)strips.current.position.y=.015+Math.sin(clock.elapsedTime*2.3)*.014;});
 return <group>
  {/* Raised 3D dance platform in front of the cinema screen. */}
  <Box args={[13.8,.53,2.55]} position={[0,.02,-6.55]} color="#182127" metalness={.45}/>
  <Box args={[13.2,.075,2.33]} position={[0,.33,-6.55]} color={palette[2]} emissive={palette[2]} emissiveIntensity={disco?.4:.05} metalness={.55}/>
  <group ref={strips}>
   <Box args={[13.75,.09,.10]} position={[0,.33,-5.26]} color={palette[0]} emissive={palette[0]} emissiveIntensity={2.1}/>
   <Box args={[13.75,.08,.10]} position={[0,.33,-7.83]} color={palette[1]} emissive={palette[1]} emissiveIntensity={1.8}/>
   {[-6.84,6.84].map(x=><Box key={x} args={[.09,.08,2.52]} position={[x,.34,-6.55]} color={palette[0]} emissive={palette[0]} emissiveIntensity={2}/>) }
   {Array.from({length:11},(_,i)=><Box key={i} position={[-6+i*1.2,.355,-5.37]} args={[.47,.018,.08]} color={i%2?palette[0]:palette[1]} emissive={i%2?palette[0]:palette[1]} emissiveIntensity={2.5}/>)}
  </group>
  {/* Animated-looking LED floor tiles using emissive materials, kept cheap for WebGL. */}
  {Array.from({length:22},(_,i)=><Box key={'floor'+i} position={[(i%11-5)*1.11,.38,-6.1-Math.floor(i/11)*.77]} args={[1.01,.025,.67]} color={palette[i%2]} emissive={palette[i%2]} emissiveIntensity={disco?.72:.12} metalness={.65}/>)}
  {/* Stairs to climb onto the stage, kept clear of the main dance floor. */}
  {[-1,1].map(side=><group key={side} position={[side*6.0,0,-4.73]}>
   <Box position={[0,-.19,-.18]} args={[1.7,.18,.7]} color="#39484a"/>
   <Box position={[0,-.10,-.65]} args={[1.7,.29,.7]} color="#47515c"/>
   <Box position={[0,-.01,-.17]} args={[1.65,.04,.08]} color={palette[0]} emissive={palette[0]} emissiveIntensity={2}/>
  </group>)}
  {/* Light truss and overhead spots. */}
  <Box position={[0,7.68,-6.75]} args={[16,.15,.16]} color="#536164" metalness={.75}/>
  {Array.from({length:9},(_,i)=>{
   const x=(i-4)*1.72;
   return <group key={i} position={[x,7.54,-6.55]}>
    <Box position={[0,0,0]} args={[.42,.36,.48]} color="#10171d" metalness={.65}/>
    <mesh position={[0,-.22,.06]} rotation={[Math.PI/2,0,0]}><circleGeometry args={[.15,16]}/><meshBasicMaterial color={i%2?palette[0]:palette[1]}/></mesh>
   </group>;
  })}
  {disco && <>
   <pointLight position={[-5,4.3,-5.8]} color={palette[0]} intensity={12} distance={9}/>
   <pointLight position={[5,4.3,-5.8]} color={palette[1]} intensity={12} distance={9}/>
  </>}
  <Html transform center position={[0,.55,-7.71]} distanceFactor={4} style={{pointerEvents:'none'}}><div className="stage-brand">✦ DISCO STAGE ✦</div></Html>
 </group>;
}
function AudioTower({x,z=-7.55,accent='#bd7bff'}){
 return <group position={[x,0,z]}>
  <Box position={[0,1.64,0]} args={[.92,3.15,.84]} color="#0b101d" roughness={.35} metalness={.5}/>
  <Box position={[0,1.64,.437]} args={[.79,3.04,.045]} color="#1e1a34" metalness={.55}/>
  {[.84,1.72,2.60].map((y,i)=><group key={i} position={[0,y,.47]}>
   <mesh><torusGeometry args={[i===1?.29:.22,.037,10,36]}/><meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.5}/></mesh>
   <mesh position={[0,0,-.018]}><circleGeometry args={[i===1?.24:.18,32]}/><meshStandardMaterial color="#0d1221" metalness={.85} roughness={.26}/></mesh>
   <mesh position={[0,0,.013]}><sphereGeometry args={[.075,16,10]}/><meshStandardMaterial color="#34384b" metalness={.45}/></mesh>
  </group>)}
  <Box position={[0,3.20,0]} args={[.96,.09,.89]} color={accent} emissive={accent} emissiveIntensity={2}/>
  <Box position={[0,.06,0]} args={[1.2,.13,1.08]} color="#11162a"/>
 </group>;
}
function CeilingLEDs({disco,theme}){
 const palette={neon:['#ff80ca','#8c8aff','#74d9ff'],sunset:['#ffad7e','#ff6dab','#ffd39a'],galaxy:['#6d9bff','#cc77ff','#72ebf5']}[theme]||['#ff80ca','#8c8aff','#74d9ff'];
 const wheel=useRef();useFrame(({clock})=>{if(wheel.current)wheel.current.rotation.y=clock.elapsedTime*(disco?.23:.03)});
 return <group>
  {[-1,1].map(side=><group key={side}>
   {Array.from({length:11},(_,i)=><Box key={i} position={[side*10.93,5.8,-7.8+i*1.7]} args={[.09,.12,1.24]} color={palette[i%3]} emissive={palette[i%3]} emissiveIntensity={disco?2.4:.7}/>)}
  </group>)}
  <mesh position={[0,7.68,-3.3]} rotation={[-Math.PI/2,0,0]}><torusGeometry args={[5.2,.075,8,96]}/><meshBasicMaterial color={palette[0]}/></mesh>
  <mesh position={[0,7.68,-3.3]} rotation={[-Math.PI/2,0,0]}><torusGeometry args={[4.7,.045,8,96]}/><meshBasicMaterial color={palette[1]}/></mesh>
  <group ref={wheel} position={[0,6.93,-5.8]}>
   <mesh><icosahedronGeometry args={[.48,2]}/><meshStandardMaterial color="#d7cbff" metalness={.9} roughness={.12}/></mesh>
   {Array.from({length:16},(_,i)=>{const a=i/16*Math.PI*2;return <mesh key={i} position={[Math.sin(a)*.45,0,Math.cos(a)*.45]} rotation={[0,a,0]}><boxGeometry args={[.12,.5,.05]}/><meshStandardMaterial color={palette[i%3]} emissive={palette[i%3]} emissiveIntensity={disco?2.4:.15}/></mesh>})}
  </group>
 </group>;
}
function Chairs({occupants, onSeat}){
 const occupied=new Set(occupants.filter(p=>p.seat!==null).map(p=>p.seat));
 const list=useMemo(()=>Array.from({length:100},(_,i)=>({...seatXY(i),i})),[]);
 return <>{list.map(s=><group key={s.i} position={[s.x,s.y-.16,s.z]} onClick={e=>{e.stopPropagation();onSeat(s.i)}}>
  <Box args={[1.23,.20,.95]} position={[0,0,0]} color={occupied.has(s.i)?'#373b6c':'#293259'}/>
  <Box args={[1.27,.75,.19]} position={[0,.35,.36]} color={occupied.has(s.i)?'#434a85':'#303960'}/>
  <Box args={[.2,.28,.8]} position={[-.65,.11,0]} color="#263438"/>
  <Box args={[.2,.28,.8]} position={[.65,.11,0]} color="#263438"/>
  <Box args={[.10,.39,.10]} position={[-.50,-.24,.1]} color="#131a20"/>
  <Box args={[.10,.39,.10]} position={[.50,-.24,.1]} color="#131a20"/>
 </group>)}</>;
}
function Laser({disco}){
 const group=useRef();
 useFrame(({clock})=>{if(group.current)group.current.rotation.y=Math.sin(clock.getElapsedTime()*.35)*.25;});
 if(!disco)return null;
 return <group ref={group} position={[0,7,-6]}>
  {Array.from({length:11},(_,i)=>{const a=(i/11)*Math.PI*2;return <mesh key={i} position={[Math.sin(a)*5,-2,Math.cos(a)*4]} rotation={[Math.PI/2+.2,a,0]}>
   <coneGeometry args={[.08,9,5,1,true]}/><meshBasicMaterial color={i%3===0?'#ab8cff':i%3===1?'#f68be6':'#88c5ff'} transparent opacity={.22} depthWrite={false} side={THREE.DoubleSide}/>
  </mesh>})}
  <mesh><sphereGeometry args={[.34,10,8]}/><meshStandardMaterial color="#bccdc0" metalness={.95} roughness={.2}/></mesh>
 </group>;
}
function ScreenVideo({media, volume, audioEnabled, onEnded}){
 const video=useMemo(()=>{const v=document.createElement('video');v.playsInline=true;v.crossOrigin='anonymous';v.preload='auto';v.loop=false;v.setAttribute('playsinline','');return v;},[]);
 const texture=useMemo(()=>{const t=new THREE.VideoTexture(video);t.colorSpace=THREE.SRGBColorSpace;return t;},[video]);
 useEffect(()=>{
  if(media.type!=='file')return;
  let hls;
  video.pause();video.removeAttribute('src');video.load();
  if(media.url.includes('.m3u8')&&Hls.isSupported()){hls=new Hls();hls.loadSource(media.url);hls.attachMedia(video);}
  else video.src=media.url;
  return ()=>{video.pause();hls?.destroy();};
 },[media.url,media.type,video]);
 useEffect(()=>{video.volume=audioEnabled?volume:0;video.muted=!audioEnabled;},[audioEnabled,volume,video]);
 useEffect(()=>{
  if(media.type!=='file')return;
  const desired=media.position+(media.playing?(Date.now()-media.updatedAt)/1000:0);
  const sync=()=>{if(Number.isFinite(video.duration)&&Math.abs(video.currentTime-desired)>1.6){try{video.currentTime=desired;}catch{}}};
  if(video.readyState>=1)sync(); else video.addEventListener('loadedmetadata',sync,{once:true});
  if(media.playing)video.play().catch(()=>{});else video.pause();
  return ()=>video.removeEventListener('loadedmetadata',sync);
 },[media.position,media.playing,media.updatedAt,media.url,media.type,video]);
 useEffect(()=>{const done=()=>onEnded?.();video.addEventListener('ended',done);return ()=>video.removeEventListener('ended',done);},[video,onEnded]);
 useEffect(()=>()=>{video.pause();texture.dispose();},[video,texture]);
 if(media.type!=='file')return null;
 return <mesh position={[0,4.80,-8.58]}><planeGeometry args={[12.3,6.91]}/><meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide}/></mesh>;
}
function DemoScreen({media, disco}){
 const surface=useRef();
 useFrame(({clock})=>{if(surface.current)surface.current.material.emissiveIntensity=.18+Math.sin(clock.elapsedTime*2)*.06;});
 if(media.type==='file')return null;
 return <group position={[0,4.8,-8.5]}>
  <mesh ref={surface}><planeGeometry args={[12.35,6.9]}/><meshStandardMaterial color="#111c22" emissive="#378888" emissiveIntensity={.2}/></mesh>
  <mesh position={[0,0,.03]}><planeGeometry args={[11.8,6.35]}/><meshBasicMaterial color="#061015"/></mesh>
  <Html transform center position={[0,0,.07]} distanceFactor={1.28} style={{pointerEvents:'none'}}><div className="demo-screen"><div className="sun"/><div className="wave wave-a"/><div className="wave wave-b"/><div className="demo-label">HỘI<span>ROOM</span></div><div className="demo-sub">{media.type==='audio'?media.title:'WELCOME TO THE PARTY'}</div><div className="equalizer">{Array.from({length:22},(_,i)=><i key={i} style={{animationDelay:`${i*-.11}s`}}/>)}</div><div className="demo-ticker">✦ LIVE TOGETHER · DANCE TOGETHER · FEEL THE BEAT ✦</div></div></Html>
 </group>;
}
function CategoryDecor({category}) {
 if(category==='dj')return <group>
  <Box position={[0,.88,-5.7]} args={[5.3,1.15,1.32]} color="#211032" metalness={.7}/>
  <Box position={[0,1.5,-5.35]} args={[4.7,.1,.75]} color="#f44de0" emissive="#b945ec" emissiveIntensity={2}/>
  {[-1,1].map(side=><group key={side} position={[side*1.5,1.55,-5.05]}>
   <mesh rotation={[-Math.PI/2,0,0]}><cylinderGeometry args={[.48,.48,.05,32]}/><meshStandardMaterial color="#212c39" metalness={.8}/></mesh>
   <mesh position={[0,.04,0]} rotation={[-Math.PI/2,0,0]}><torusGeometry args={[.32,.04,8,32]}/><meshBasicMaterial color="#91eeff"/></mesh>
  </group>)}
  <Html center position={[0,2.25,-5.65]}><div className="room3d-label">🎧 HOIROOM DJ CLUB</div></Html>
 </group>;
 if(category==='musicbox')return <group>
  {[-1,1].map(side=><group key={side} position={[side*7.5,.2,3.5]}>
   <Box args={[4.2,.7,2.1]} position={[0,.2,0]} color="#655477"/>
   <Box args={[4.2,1.3,.4]} position={[0,.75,.95]} color="#886ba0"/>
  </group>)}
  <Box position={[0,.6,-5.6]} args={[.14,1.8,.14]} color="#ced3e9" metalness={.9}/>
  <mesh position={[0,1.55,-5.6]} rotation={[.3,0,-.3]}><capsuleGeometry args={[.10,.24,5,8]}/><meshStandardMaterial color="#f2c3f9" metalness={.7}/></mesh>
  <Html center position={[0,2.25,-5.8]}><div className="room3d-label">🎤 MUSIC BOX KARAOKE</div></Html>
 </group>;
 return null;
}
function Scene({room,you,view,onSeat,onPerson,onMediaEnded,messages,audioEnabled,volume,videoFocus,onVideoFocusChange,onEnableAudio,onDuration,onError}){
 const {camera}=useThree();const participants=room?.participants||[];const orbit=useRef();
 useEffect(()=>{const target=view==='stage'?[0,2.2,3]:[0,3,-3];if(view==='front')camera.position.set(0,8.7,19);else if(view==='top')camera.position.set(0,20,7);else if(view==='stage')camera.position.set(0,3.0,-7.3);else camera.position.set(13,10,19);camera.lookAt(...target);orbit.current?.target.set(...target);orbit.current?.update();},[view,camera]);
 return <>
  <color attach="background" args={['#080719']}/><ambientLight intensity={.72}/><hemisphereLight args={['#b4c9c3','#171c21',1.2]}/>
  <directionalLight position={[0,14,7]} intensity={1.2} castShadow shadow-mapSize={[1024,1024]}/>
  <pointLight position={[0,7,-4]} color="#bf79ff" intensity={22} distance={18}/>
  <pointLight position={[-9,5,3]} color="#657dff" intensity={14} distance={16}/>
  <pointLight position={[9,5,3]} color="#ff8da6" intensity={14} distance={16}/>
  <Box args={[23,.44,23]} position={[0,-.52,0]} color="#151b1e"/>
  <Box args={[23,8,.38]} position={[0,3.8,-10.7]} color="#1f282c"/>
  <Box args={[.35,8,23]} position={[-11.55,3.8,0]} color="#1d2529"/>
  <Box args={[.35,8,23]} position={[11.55,3.8,0]} color="#1b2529"/>
  <Box args={[23,.20,23]} position={[0,-.95,0]} color="#0c1214"/>
  <Box args={[15,.15,3.1]} position={[0,.06,-7.15]} color="#20262a"/>
  <Box args={[13.2,7.65,.3]} position={[0,4.8,-8.73]} color="#3d4843" metalness={.75}/>
  <Box args={[12.8,7.2,.18]} position={[0,4.8,-8.54]} color="#080516"/>
  <Stage disco={room.disco} theme={room.stageTheme}/><CategoryDecor category={room.category}/><DemoScreen media={room.media} disco={room.disco}/><ScreenVideo media={room.media} volume={volume} audioEnabled={audioEnabled} onEnded={onMediaEnded}/>
  {/* HTML is attached to the real cinema plane. Drei transform projects the entire
      16:9 YouTube iframe in CSS3D, so it follows orbit and perspective exactly. */}
  {room.media.type==='youtube'&&<Html transform center distanceFactor={0.96} position={[0,4.80,-8.37]} zIndexRange={[4,2]} wrapperClass="vimo-3d-video-anchor" style={{width:1280,height:720,pointerEvents:'none'}}>
   <YouTubePlayer key={room.media.url} media={room.media} volume={volume} audioEnabled={audioEnabled} focus={videoFocus} onFocusChange={onVideoFocusChange} onEnableAudio={onEnableAudio} onEnded={onMediaEnded} onDuration={onDuration} onError={onError}/>
  </Html>}
  {room.media.type==='soundcloud'&&<Html transform center distanceFactor={0.96} position={[0,4.80,-8.37]} zIndexRange={[4,2]} wrapperClass="vimo-3d-video-anchor" style={{width:1280,height:720,pointerEvents:'none'}}>
   <SoundCloudPlayer media={room.media} volume={volume} audioEnabled={audioEnabled} onEnded={onMediaEnded} onDuration={onDuration} onError={onError}/>
  </Html>}
  {room.photoActive&&<Html transform center distanceFactor={0.96} position={[0,4.80,-8.32]} zIndexRange={[5,3]} wrapperClass="vimo-3d-photo-anchor" style={{width:1280,height:720,pointerEvents:'none'}}>
   <div className="photo-projection vimo-photo-plane"><img src={room.photoActive.url} alt="Ảnh đang được chiếu ưu tiên"/><div className="photo-projection-caption"><strong>{room.photoActive.caption||'Khoảnh khắc đáng nhớ'}</strong><span>Ảnh của {room.photoActive.addedBy} · Đang hiển thị</span></div></div>
  </Html>}
  {/* Two symmetrical pairs of matching 3-driver LED speakers. */}
  {[-1,1].flatMap((side)=>[0,1].map((row)=><AudioTower key={`${side}-${row}`} x={side*(7.10+row*1.15)} z={-7.55+row*.95} accent={row?'#73ccff':'#cb79ff'}/>))}
  <CeilingLEDs disco={room.disco} theme={room.stageTheme}/>
  {Array.from({length:12},(_,i)=><group key={i}>
   <Box args={[.08,4.5,.11]} position={[-11.20+i%2*.01,2.35,-7.3+i*1.55]} color="#ffb890" emissive="#b95788" emissiveIntensity={1.1}/>
   <Box args={[.08,4.5,.11]} position={[11.20,2.35,-7.3+i*1.55]} color="#ffb890" emissive="#b95788" emissiveIntensity={1.1}/>
  </group>)}
  {Array.from({length:10},(_,i)=><Box key={i} args={[18,.12,.21]} position={[0,-.08+i*.105,-2.5+i*1.2]} color="#27252a"/>)}
  {room.category!=='dj'&&<Chairs occupants={participants} onSeat={onSeat}/>}
  {participants.map(p=><Avatar key={p.id} p={p} others={participants} isMe={you===p.id} onClick={onPerson} bpm={room.bpm} lastMessage={(messages||[]).filter(m=>m.userId===p.id&&Date.now()-m.time<5500).at(-1)}/>)}
  <Laser disco={room.disco}/>
  {room.disco&&<pointLight position={[0,6,-5]} intensity={22} distance={17} color="#d297ff"/>}
  <OrbitControls ref={orbit} makeDefault target={[0,3,-3]} minDistance={8} maxDistance={37} maxPolarAngle={Math.PI*.48} minPolarAngle={.23} enablePan={false}/>
 </>;
}
export default function Theatre({room,you,view='iso',onSeat=()=>{},onPerson=()=>{},onMediaEnded=()=>{},messages=[],volume=1,audioEnabled=false,videoFocus=false,onVideoFocusChange=()=>{},onEnableAudio=()=>{},onDuration=()=>{},onError=()=>{}}) {
 return <Canvas dpr={[1,1.7]} shadows={false} gl={{antialias:true,powerPreference:'high-performance'}} camera={{position:[16,11,19],fov:46,near:.1,far:150}}>
  <Scene room={room} you={you} view={view} onSeat={onSeat} onPerson={onPerson} onMediaEnded={onMediaEnded} messages={messages} volume={volume} audioEnabled={audioEnabled} videoFocus={videoFocus} onVideoFocusChange={onVideoFocusChange} onEnableAudio={onEnableAudio} onDuration={onDuration} onError={onError}/>
 </Canvas>;
}
