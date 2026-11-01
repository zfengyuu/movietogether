import React, {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import { io } from 'socket.io-client';
import { Armchair, AudioLines, Check, ChevronDown, Clapperboard, Clipboard, Crown, DoorOpen, Eye, Film, Heart, Info, LockKeyhole, LogIn, Maximize2, Menu, MessageCircle, Mic, Music2, Pause, Play, Plus, Send, Settings, Share2, Shirt, SkipForward, Smile, Sparkles, Theater, Ticket, Users, Video, Volume2, VolumeX, Vote, Waves, X } from 'lucide-react';
import Theatre from './components/Theatre.jsx';
import RoomCreateForm from './components/RoomCreateForm.jsx';
import {useKaraokeMic} from './components/useKaraokeMic.js';
import {ROOM_CATEGORIES} from '../shared/rooms.js';
import {photoCost,PHOTO_MIN_SECONDS,PHOTO_MAX_SECONDS,PHOTO_VND_PER_SECOND} from '../shared/photo.js';
import AudioPlayer from './components/AudioPlayer.jsx';
import {useBeat} from './components/useBeat.js';

const socket=io({autoConnect:false});
const params=new URLSearchParams(window.location.search);
const initialCode=(params.get('room')||'DISCO').toUpperCase();
const initialInvite=params.get('invite')||'';
const sampleMedia={type:'demo',url:'',title:'DISCO NIGHT • 128 BPM',playing:false,position:0,updatedAt:Date.now()};
const preview={category:'cinema',id:'DISCO',name:'Phòng Disco cộng đồng',maxPeople:100,participants:[],media:sampleMedia,queue:[],disco:true,bpm:128,stageTheme:'neon',messages:[],votes:0};
const formatTime=n=>{n=Math.max(0,Math.floor(n||0));return `${Math.floor(n/60).toString().padStart(2,'0')}:${(n%60).toString().padStart(2,'0')}`};
const control=(event, payload={}, callback)=>socket.emit(event,payload,(ack)=>callback?.(ack));
const emojiList=['😀','😂','🤣','😊','😍','🥰','😘','😎','🥳','😢','😭','😱','🤔','😡','❤️','🔥','👏','🎉','🕺','🎶','🎬','🌹'];
// Convert server snapshot time to client receive time, avoiding skewed device clocks.
const localizeRoom=r=>({...r,media:{...r.media,updatedAt:Date.now()}});
function App(){
 const [joined,setJoined]=useState(false),[room,setRoom]=useState(null),[you,setYou]=useState('');
 const [name,setName]=useState(localStorage.getItem('disco-name')||''),[code,setCode]=useState(initialCode),[password,setPassword]=useState('');
 const [account,setAccount]=useState(null),[authMode,setAuthMode]=useState('login'),[authOpen,setAuthOpen]=useState(false),[authName,setAuthName]=useState(''),[authPassword,setAuthPassword]=useState(''),[authConfirmPassword,setAuthConfirmPassword]=useState(''),[authBusy,setAuthBusy]=useState(false);
 const [wallet,setWallet]=useState({balance:0,demoCredited:false,demoEnabled:false,ledger:[]}),[photoFile,setPhotoFile]=useState(null),[photoCaption,setPhotoCaption]=useState(''),[photoDuration,setPhotoDuration]=useState(10),[photoBusy,setPhotoBusy]=useState(false),[topupOpen,setTopupOpen]=useState(false),[pendingPhoto,setPendingPhoto]=useState(null),[topupAmount,setTopupAmount]=useState(20000),[topupOrder,setTopupOrder]=useState(null);
 const [newName,setNewName]=useState('Phòng party của tôi'),[newPassword,setNewPassword]=useState(''),[inviteToken,setInviteToken]=useState(initialInvite);
 const [create,setCreate]=useState(false),[rooms,setRooms]=useState([]),[panel,setPanel]=useState(''),[notice,setNotice]=useState('');
 const [view,setView]=useState('front'),[volume,setVolume]=useState(.75),[audioEnabled,setAudioEnabled]=useState(false);
 const [videoFocus,setVideoFocus]=useState(false);
 const [chat,setChat]=useState(''),[url,setUrl]=useState(''),[title,setTitle]=useState(''),[messages,setMessages]=useState([]);
 const [sandboxQrUrl,setSandboxQrUrl]=useState(null);const [reactions,setReactions]=useState([]),[dance,setDance]=useState('bounce'),[emojiOpen,setEmojiOpen]=useState(false),[depositAmount,setDepositAmount]=useState(20000),[depositInfo,setDepositInfo]=useState(null),[depositBusy,setDepositBusy]=useState(false),[qrConfigured,setQrConfigured]=useState(false);
 const [online,setOnline]=useState(true),[clock,setClock]=useState(0),[uploadBusy,setUploadBusy]=useState(false),[uploadFile,setUploadFile]=useState(null),[giftFlash,setGiftFlash]=useState(null);
 const chatEnd=useRef(null),joinRef=useRef(null),roomRef=useRef(null),audioRef=useRef(null),uploadToken=useRef(null);
 roomRef.current=room;
 const toast=useCallback((s)=>{setNotice(s);setTimeout(()=>setNotice(n=>n===s?'':n),4200);},[]);
 const karaokeMic=useKaraokeMic(socket,room,you,toast);
 const showPanel=p=>setPanel(v=>v===p?'':p);
 const youMember=room?.participants.find(p=>p.id===you);
 const isHost=!!you&&room?.hostId===you;
 const demoBeat=useBeat(room?.media||sampleMedia,room?.bpm||128,volume);
 const refreshRooms=useCallback(()=>{fetch('/api/rooms').then(r=>r.json()).then(setRooms).catch(()=>{});},[]);
 useEffect(()=>{fetch('/api/auth/me').then(r=>r.json()).then(d=>{if(d.user){setAccount(d.user);setName(d.user.username);}}).catch(()=>{});},[]);
 useEffect(()=>{
  refreshRooms();socket.connect();
  const onConnect=()=>{
   setOnline(true);
   if(joinRef.current){socket.emit('join_room',joinRef.current,(ack)=>{if(ack?.ok){setYou(ack.you);uploadToken.current=ack.uploadToken;if(ack.walletToken){localStorage.setItem('disco-demo-wallet',ack.walletToken);joinRef.current={...joinRef.current,walletToken:ack.walletToken};}setRoom(localizeRoom(ack.room));setMessages(ack.room.messages);setJoined(true);}else toast(ack?.error||'Không thể vào lại phòng');});}
  };
  const onDisconnect=()=>setOnline(false);
  const onRoom=r=>{setRoom(localizeRoom(r));setMessages(r.messages||[]);};
  const onMessage=m=>setMessages(v=>[...v,m].slice(-80));
  const onMedia=m=>setRoom(v=>v?{...v,media:{...m,updatedAt:Date.now()}}:v);
  const onReaction=r=>{setReactions(v=>[...v,r]);setTimeout(()=>setReactions(v=>v.filter(x=>x.id!==r.id)),2600);};
  const onKicked=msg=>{joinRef.current=null;uploadToken.current=null;setJoined(false);setRoom(null);setYou('');setPanel('');toast(msg);};
  const onWallet=w=>setWallet(w);
  const onPhotoIntent=status=>{setPendingPhoto(null);setTopupOpen(false);if(status.ok){setPhotoFile(null);setPhotoCaption('');}toast(status.message||'Trạng thái ảnh đã cập nhật.');};
  const onGift=g=>{setGiftFlash(g);setTimeout(()=>setGiftFlash(old=>old?.id===g.id?null:old),3800);};
  socket.on('connect',onConnect);socket.on('disconnect',onDisconnect);socket.on('room_state',onRoom);socket.on('chat_message',onMessage);socket.on('media_sync',onMedia);socket.on('reaction',onReaction);socket.on('kicked',onKicked);socket.on('gift_received',onGift);socket.on('wallet_state',onWallet);socket.on('photo_intent_status',onPhotoIntent);
  return ()=>{socket.off('connect',onConnect);socket.off('disconnect',onDisconnect);socket.off('room_state',onRoom);socket.off('chat_message',onMessage);socket.off('media_sync',onMedia);socket.off('reaction',onReaction);socket.off('kicked',onKicked);socket.off('gift_received',onGift);socket.off('wallet_state',onWallet);socket.off('photo_intent_status',onPhotoIntent);socket.disconnect();};
 },[refreshRooms,toast]);
 useEffect(()=>{chatEnd.current?.scrollIntoView({block:'end',behavior:'smooth'});},[messages.length,panel]);
 useEffect(()=>{const t=setInterval(()=>setClock(n=>n+1),1000);return ()=>clearInterval(t);},[]);
 useEffect(()=>{if(room?.media?.type!=='youtube')setVideoFocus(false);},[room?.media?.type]);
 useEffect(()=>{fetch('/api/wallet/vietqr-config').then(r=>r.json()).then(d=>setQrConfigured(!!d.configured)).catch(()=>{});},[]);
 const send=(event,value={},okMessage='')=>socket.emit(event,value,a=>{if(!a?.ok)toast(a?.error||'Thao tác thất bại');else if(okMessage)toast(okMessage);});
 const joinRoom=useCallback((nextCode=code,pass=password,roomInvite=inviteToken)=>{
  const display=name.trim().slice(0,22);if(!display)return toast('Hãy nhập tên hiển thị trước nhé');
  const data={roomId:nextCode.trim().toUpperCase(),name:display,password:pass,invite:roomInvite,walletToken:localStorage.getItem('disco-demo-wallet')||''};
  if(!socket.connected){toast('Đang kết nối server, hãy thử lại');return;}
  socket.emit('join_room',data,ack=>{
   if(!ack?.ok)return toast(ack?.error||'Không thể vào phòng');
   joinRef.current={...data,walletToken:ack.walletToken};uploadToken.current=ack.uploadToken;localStorage.setItem('disco-demo-wallet',ack.walletToken);localStorage.setItem('disco-name',display);setYou(ack.you);setRoom(localizeRoom(ack.room));setMessages(ack.room.messages||[]);setJoined(true);setPanel('');
   window.history.replaceState({},'',`?room=${encodeURIComponent(data.roomId)}${data.invite?'&invite='+encodeURIComponent(data.invite):''}`);
  });
 },[code,password,name,inviteToken,toast]);
 const createRoom=async options=>{if(!name.trim())return toast('Hãy nhập tên trước');try{const res=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(options)});const body=await res.json();if(!res.ok)throw Error(body.error||'Không tạo được phòng');setCode(body.id);setInviteToken(body.inviteToken||'');joinRoom(body.id,options.password||'',body.inviteToken||'');}catch(e){toast(e.message)}};
 const leave=()=>{
  socket.emit('leave_room');joinRef.current=null;uploadToken.current=null;setJoined(false);setRoom(null);setYou('');setMessages([]);setPanel('');
  refreshRooms();
 };
 const invite=async()=>{const build=t=>location.origin+'/?room='+encodeURIComponent(room?.id||'')+(room?.isPrivate?'&invite='+encodeURIComponent(t||''):'');const copy=t=>navigator.clipboard.writeText(build(t)).then(()=>toast('Đã sao chép link mời!')).catch(()=>window.prompt('Sao chép link:',build(t)));const token=inviteToken||joinRef.current?.invite||'';if(room?.isPrivate&&!token){socket.emit('room_invite',{},ack=>{if(!ack?.ok)return toast(ack?.error||'Không lấy được link mời');setInviteToken(ack.inviteToken);copy(ack.inviteToken)})}else copy(token)};
 const player=cmd=>send('media_control',{command:cmd});
 const screenMedia=room?.media||sampleMedia;
 const progress=screenMedia.position+(screenMedia.playing?(Date.now()-screenMedia.updatedAt)/1000:0);
 const changeMedia=(queueOnly=false)=>{
  if(!url.trim())return toast('Hãy dán link YouTube / SoundCloud / MP3 / MP4 / HLS');
  const event=queueOnly?'queue_add':'media_control';
  const payload=queueOnly?{url,title:title||'Nhạc / video được gửi'}:{command:'load',media:{url,title:title||'Nhạc / video được gửi'}};
  socket.emit(event,payload,a=>{if(!a?.ok)return toast(a?.error||'Không gửi được');setUrl('');setTitle('');setPanel('queue');toast(queueOnly?'Đã thêm vào hàng chờ':'Đã phát nội dung mới');});
 };
 const uploadAudio=async()=>{
  if(!uploadFile)return toast('Hãy chọn tệp nhạc trước');
  if(uploadFile.size>20*1024*1024)return toast('Tệp nhạc phải nhỏ hơn 20 MB');
  setUploadBusy(true);
  try{
   const r=await fetch('/api/upload-audio',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Socket-ID':you,'X-Upload-Token':uploadToken.current||'','X-File-Name':encodeURIComponent(uploadFile.name)},body:uploadFile});
   const data=await r.json();if(!r.ok)throw Error(data.error||'Không thể tải nhạc lên');
   socket.emit('queue_add',data.media,a=>{if(!a?.ok)return toast(a?.error||'Không thêm được vào hàng chờ');setUploadFile(null);setPanel('queue');toast('Đã tải nhạc lên và thêm vào hàng chờ!');});
  }catch(e){toast(e.message||'Lỗi tải nhạc')}finally{setUploadBusy(false)}
 };
 const stageAction=(zone='floor')=>send('avatar_action',{action:'dance',dance,zone},zone==='stage'?'Đã lên sân khấu nhảy!':'Đang nhảy dưới sàn!');
 const editOutfit=(field,value)=>send('appearance_update',{[field]:value});
 const audioToggle=async()=>{
  if(audioEnabled){setAudioEnabled(false);demoBeat.disable();return;}
  setAudioEnabled(true);if(screenMedia.type==='audio'&&screenMedia.playing){audioRef.current?.play().catch(()=>{});}await demoBeat.enable().catch(()=>{});
 };
 const authSubmit=async e=>{
  e.preventDefault();
  if(authMode==='register'&&authPassword!==authConfirmPassword)return toast('Mật khẩu nhập lại không khớp.');
  setAuthBusy(true);
  try{
   const r=await fetch(`/api/auth/${authMode}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:authName,password:authPassword,...(authMode==='register'?{confirmPassword:authConfirmPassword}:{})})});
   const data=await r.json();if(!r.ok)throw Error(data.error||'Không đăng nhập được');
   setAccount(data.user);setName(data.user.username);localStorage.setItem('disco-name',data.user.username);setAuthOpen(false);setAuthPassword('');setAuthConfirmPassword('');
   if(joined){socket.emit('leave_room');joinRef.current={...joinRef.current,name:data.user.username};}
   socket.disconnect();socket.connect();toast('Đã đăng nhập '+data.user.username);
  }catch(error){toast(error.message);}finally{setAuthBusy(false);}
 };
 const authLogout=async()=>{
  try{await fetch('/api/auth/logout',{method:'POST'});}catch{}
  setAccount(null);socket.disconnect();socket.connect();toast('Đã đăng xuất');
 };
 const createDeposit=async()=>{
  if(!account)return toast('Đăng nhập để tạo mã VietQR');
  setDepositBusy(true);
  try{const r=await fetch('/api/wallet/topup-orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:depositAmount})});const d=await r.json();if(!r.ok)throw Error(d.error||'Không tạo được mã QR');setDepositInfo(d);}
  catch(e){toast(e.message)}finally{setDepositBusy(false)}
 };
 const createSandboxTopup=async()=>{
  if(!account)return toast('Vui lòng đăng nhập username trước khi tạo lệnh nạp');
  try {
   const response=await fetch('/api/wallet/topup-orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount:topupAmount})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Không tạo được lệnh nạp');
   setTopupOrder(data.order);setSandboxQrUrl(data.qrUrl||null);toast('Đã tạo lệnh nạp SANDBOX. Không chuyển khoản tiền thật!');
  }catch(e){toast(e.message);}
 };
 const submitPhoto=async()=>{
  if(!photoFile)return toast('Vui lòng chọn ảnh trước khi gửi');
  if(!account&&wallet.balance<photoCost(photoDuration)){setAuthOpen(true);return toast('Đăng nhập username trước để có thể nạp tiền và tự gửi ảnh sau khi thanh toán.');}
  if(photoFile.size>12*1024*1024)return toast('Ảnh vượt quá 12 MB');
  setPhotoBusy(true);
  try{
   const result=await fetch('/api/upload-photo',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Socket-ID':you,'X-Upload-Token':uploadToken.current||''},body:photoFile});
   const data=await result.json();if(!result.ok)throw Error(data.error||'Không tải được ảnh');
   socket.emit('photo_submit',{photoId:data.photoId,duration:photoDuration,caption:photoCaption,deferIfInsufficient:true},ack=>{
    setPhotoBusy(false);
    if(ack?.needsTopup){setPendingPhoto({photoId:data.photoId,duration:photoDuration,cost:photoCost(photoDuration)});setTopupAmount(Math.min(1000000,Math.max(10000,Math.ceil((ack.shortfall||10000)/1000)*1000)));setTopupOpen(true);return toast('Đã giữ ảnh chờ. Nạp đủ xu sandbox để tự đưa ảnh lên màn hình.');}
    if(!ack?.ok)return toast(ack?.error||'Không thể chiếu ảnh');
    setPhotoFile(null);setPhotoCaption('');setPanel('photo');toast('Ảnh đã vào hàng chiếu ưu tiên!');
   });
  }catch(error){setPhotoBusy(false);toast(error.message);}
 };
 const activeRoom=room||preview;
 return <div className="app-shell">
  <div className="scene-layer"><Theatre room={activeRoom} you={you} view={view} onSeat={i=>joined&&send('choose_seat',i,`Đã chọn ghế ${i+1}`)} onPerson={p=>p.id===you?showPanel('appearance'):showPanel('people')} onMediaEnded={()=>{if(isHost)player('next')}} messages={messages} volume={volume} audioEnabled={audioEnabled} videoFocus={videoFocus} onVideoFocusChange={setVideoFocus} onEnableAudio={()=>setAudioEnabled(true)} onDuration={n=>{if(isHost&&Math.abs((screenMedia.duration||0)-n)>2)send('media_control',{command:'duration',duration:n})}} onError={toast}/></div>
  <div className="cinema-glow"/>
  <AudioPlayer media={screenMedia} volume={volume} audioEnabled={audioEnabled} playerRef={audioRef} onEnded={()=>{if(isHost)player('next')}} onDuration={n=>{if(isHost&&screenMedia.type==='audio'&&Math.abs((screenMedia.duration||0)-n)>1)send('media_control',{command:'duration',duration:n});}} onError={toast}/>
  <header className="topbar">
   <div className="brand" onClick={()=>showPanel('about')} role="button" tabIndex={0}><div className="logo">V</div><div><div className="brand-main">HỘI<b>ROOM</b></div><div className="brand-small">XEM · NGHE · QUẨY</div></div></div>
   <div className="online-bar"><span className="live-dot"/> {screenMedia.playing?'Đang chiếu':'Sẵn sàng'} <span className="sep"/> <Users size={14}/> <b>{activeRoom.participants.length}</b> / {activeRoom.maxPeople} trong phòng</div>
   <div className="top-actions">
    {joined&&<><button className="pill-code" onClick={invite}><Ticket size={15}/> {room.id} <Clipboard size={14}/></button><button className="icon-btn" onClick={invite} title="Chia sẻ"><Share2 size={17}/></button></>}
    <button className="icon-btn" onClick={()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.()} title="Xem toàn màn hình"><Maximize2 size={17}/></button>
    <button className="icon-btn" onClick={()=>showPanel('settings')} title="Cài đặt"><Settings size={18}/></button>
    <button className="avatar-profile" onClick={()=>setAuthOpen(true)} title={account?'Tài khoản: '+account.username:'Đăng nhập / Đăng ký'}>{(account?.username?.[0]||name[0]||'K').toUpperCase()}</button>
   </div>
  </header>
  <section className="now-playing">
   <div className="overline">TRÊN MÀN ẢNH</div>
   <h1><span className="youtube-mark">{screenMedia.type==='youtube'?'▶':'♫'}</span>{screenMedia.title}</h1>
   <div className="muted-s">{screenMedia.type==='demo'?'Original disco demo · Không bản quyền':screenMedia.type==='youtube'?'YouTube • Phát đồng bộ':screenMedia.type==='audio'?'Audio • Phát đồng bộ':'Video MP4 / HLS'} · {formatTime(progress)}</div>
   {joined?<>
     <div className="play-controls"><button className="play-button" onClick={()=>player(screenMedia.playing?'pause':'play')} disabled={!isHost}>{screenMedia.playing?<Pause size={14}/>:<Play size={14}/>} {screenMedia.playing?'Tạm dừng':'Phát nhạc'}</button>
     <button className="vote-btn" onClick={()=>send('vote_skip',{})}><Vote size={14}/> {room.votedIds?.includes(account?.id||you)?'Rút phiếu':'Skip'} {room.votes}/{room.skipNeeded}</button></div>
     <div className="media-progress" title={`${formatTime(progress)} / ${screenMedia.duration?formatTime(screenMedia.duration):'--:--'}`}><div style={{width:`${screenMedia.duration?Math.max(0,Math.min(100,progress/screenMedia.duration*100)):0}%`}}/></div>
     <div className="bpm-row"><div className="bpm-label"><Waves size={13}/> Disco · {room.bpm} BPM</div></div>
   </>:<div className="bpm-label"><Waves size={13}/> Disco · 128 BPM</div>}
  </section>
  <aside className="side-rail">
   {[
    ...(activeRoom.category==='cinema'?[['seats',Armchair,'Chọn ghế']]:[]),...(activeRoom.category==='musicbox'?[['karaoke',Mic,'Karaoke']]:[]),['media',Plus,'Gửi nhạc/video'],['queue',Music2,'Hàng chờ'],['photo',Sparkles,'Chiếu ảnh'],['support',Heart,'Ủng hộ'],['chat',MessageCircle,'Trò chuyện'],['people',Users,'Người xem'],['appearance',Shirt,'Tủ đồ'],['settings',Settings,'Cài đặt'],
   ].map(([key,Icon,label])=><button key={key} className={'rail-btn '+(panel===key?'active':'')} onClick={()=>showPanel(key)}><Icon size={19}/><small>{label}</small>{key==='people'&&joined&&<span className="tiny-count">{room.participants.length}</span>}</button>)}

  </aside>
  <div className="bottom-left"><div className="camera-switch"><button className={view==='iso'?'selected':''} onClick={()=>setView('iso')} title="Góc nhìn 3D"><Eye size={18}/></button><button className={view==='front'?'selected':''} onClick={()=>setView('front')} title="Nhìn từ phía trước"><Film size={18}/></button><button className={view==='top'?'selected':''} onClick={()=>setView('top')} title="Nhìn từ trên"><Theater size={18}/></button><button className={view==='stage'?'selected':''} onClick={()=>setView('stage')} title="Góc nhìn từ sân khấu ra khán giả"><Users size={18}/></button></div><button className="private-button" onClick={()=>joined?showPanel('room'):setCreate(true)}><DoorOpen size={18}/> {joined?'Phòng của bạn':'Tạo phòng riêng'}</button></div>
  {joined&&<div className="dance-bar">
    <button className={youMember?.action==='sit'?'chosen':''} onClick={()=>send('avatar_action',{action:'sit'})}>🪑 <span>Ngồi</span></button>
    <button className={youMember?.action==='dance'&&youMember?.zone==='floor'?'chosen disco-choice':''} onClick={()=>stageAction('floor')}>🕺 <span>Nhảy dưới sàn</span></button><button className={youMember?.action==='dance'&&youMember?.zone==='stage'?'chosen disco-choice':''} onClick={()=>stageAction('stage')}>⭐ <span>Lên sân khấu nhảy</span></button>
    <button className={youMember?.action==='wave'?'chosen':''} onClick={()=>send('avatar_action',{action:'wave'})}>👋 <span>Vẫy tay</span></button>
    <button className={youMember?.action==='cheer'?'chosen':''} onClick={()=>send('avatar_action',{action:'cheer'})}>🙌 <span>Cổ vũ</span></button>
    <select value={dance} onChange={e=>{setDance(e.target.value);if(youMember?.action==='dance')send('avatar_action',{action:'dance',dance:e.target.value,zone:youMember.zone})}} aria-label="Kiểu nhảy"><option value="bounce">Bounce</option><option value="shuffle">Shuffle</option><option value="spin">Spin</option></select>
   </div>}
  {joined&&<div className="chat-bar"><button onClick={()=>setEmojiOpen(v=>!v)} title="Chọn emoji"><Smile size={20}/></button><form onSubmit={e=>{e.preventDefault();if(chat.trim())send('chat_send',chat);setChat('');}}><input value={chat} onChange={e=>setChat(e.target.value)} maxLength={240} placeholder="Nói gì với cả rạp đi..."/><button type="submit" title="Gửi"><Send size={20}/></button></form></div>}
  {joined&&emojiOpen&&<div className="vimo-emoji-panel"><div className="emoji-heading"><strong>Thêm chút cảm xúc ✨</strong><button onClick={()=>setEmojiOpen(false)}><X size={16}/></button></div><div className="vimo-emojis">{emojiList.map(e=><button key={e} onClick={()=>{setChat(t=>(t+e).slice(0,240));setEmojiOpen(false)}}>{e}</button>)}</div></div>}
  <div className="volume-control"><button onClick={audioToggle} title="Bật hoặc tắt âm thanh">{audioEnabled?<Volume2 size={20}/>:<VolumeX size={20}/>}</button><input aria-label="Âm lượng" type="range" min="0" max="1" step=".01" value={volume} onChange={e=>setVolume(Number(e.target.value))}/><b>{Math.round(volume*100)}%</b></div>
  {giftFlash&&<div key={giftFlash.id} className="gift-toast">🎁 <strong>{giftFlash.name}</strong> vừa gửi {({heart:'trái tim ❤️',star:'ngôi sao ⭐',flower:'hoa 🌹',confetti:'pháo giấy 🎉'})[giftFlash.gift]}!</div>}
  {reactions.map((r,i)=><div key={r.id} className="floating-reaction" style={{left:`${42+(i%7)*3}%`}}>{r.emoji}</div>)}
  {joined&&messages.length>0&&!panel&&<div className="chat-peek">{messages.slice(-2).map(m=><div key={m.id}>{m.system?'✨':<b>{m.name}: </b>}{m.text}</div>)}</div>}
  {!joined&&<div className="join-overlay"><div className="join-card"><div className="join-icon">🪩</div><div className="eyebrow">RẠP 3D REALTIME</div><h2>Vào rạp, bật nhạc<br/><em>cùng quẩy!</em></h2><p>Chọn ghế, xem phim, nghe nhạc và nhảy disco cùng bạn bè ngay trong trình duyệt.</p>
    {account?<div className="logged-user">✓ Đã đăng nhập: <strong>{account.username}</strong></div>:<button className="auth-entry" onClick={()=>setAuthOpen(true)}>🔐 Đăng nhập / Tạo tài khoản</button>}
    <label>Tên hiển thị</label><input maxLength={22} placeholder="Bạn muốn được gọi là gì?" value={name} onChange={e=>setName(e.target.value)} disabled={!!account}/>
    {create?<RoomCreateForm onCreate={createRoom} onCancel={()=>setCreate(false)}/>:
       <><label>Mã phòng</label><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={16} placeholder="DISCO"/><label>Mật khẩu (nếu phòng riêng)</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Không cần cho phòng công khai" onKeyDown={e=>e.key==='Enter'&&joinRoom()}/><button className="cta" onClick={()=>joinRoom()}><LogIn size={18}/> Vào rạp ngay</button><button className="secondary-cta" onClick={()=>setCreate(true)}><Plus size={16}/> Tạo phòng riêng</button></>}
    <div className="join-public">{rooms.slice(0,3).map(r=><button key={r.id} onClick={()=>{setCode(r.id);if(name.trim())joinRoom(r.id,'')}}><span className="live-dot"/> {r.name} <small>{r.online}/{r.maxPeople}</small></button>)}</div>
   </div></div>}
  {joined&&panel&&<div className="panel" key={panel}>
   <div className="panel-top"><div><div className="overline">HỘIROOM</div><h3>{({seats:'Sơ đồ ghế',media:'Gửi nhạc / video',queue:'Danh sách chờ',support:'Ủng hộ phòng',chat:'Trò chuyện',people:'Thành viên online',appearance:'Tủ đồ avatar',photo:'Chiếu ảnh ưu tiên',settings:'Cài đặt rạp',room:'Thông tin phòng',about:'Thông tin dự án'})[panel]||panel}</h3></div><button onClick={()=>setPanel('')}><X size={20}/></button></div>
   <div className="panel-scroll">
    {panel==='seats'&&<><p className="panel-hint">Chạm vào một ghế trống để chuyển chỗ ngồi.</p><div className="screen-mini">MÀN HÌNH / SÂN KHẤU</div><div className="seat-row-label">{room.maxPeople} ghế · {room.participants.filter(p=>p.seat!==null).length} ghế đã chọn</div><div className="seats-grid">{Array.from({length:room.maxPeople},(_,i)=>{const p=room.participants.find(p=>p.seat===i);return <button key={i} title={p?.name||`Ghế ${i+1}`} disabled={!!p&&p.id!==you} className={(p?'occupied ':'')+(youMember?.seat===i?'mine':'')} onClick={()=>send('choose_seat',i,`Đã đổi sang ghế ${i+1}`)}><Armchair size={15}/></button>})}</div><div className="legend"><span>🟩 Bạn</span><span>⬜ Trống</span><span>🟨 Có người</span></div></>}
    {panel==='media'&&<div className="vimo-clean-form"><p className="panel-hint">Gửi YouTube hoặc SoundCloud vào hàng chờ. Video được xếp theo số vote của người xem.</p><label>Liên kết YouTube / SoundCloud</label><input autoFocus value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..."/><label>Tiêu đề (tuỳ chọn)</label><input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Tên bài hát / video"/><button className="panel-main" onClick={()=>changeMedia(true)} disabled={!url.trim()}><Plus size={18}/> Thêm vào hàng chờ</button><button className="panel-outline" onClick={()=>setPanel('queue')}>Xem hàng chờ</button><details className="vimo-details"><summary>Tải file nhạc riêng (tùy chọn)</summary><input type="file" accept=".mp3,.m4a,.wav,.ogg,.aac,.flac,audio/*" onChange={e=>setUploadFile(e.target.files?.[0]||null)}/><button disabled={!uploadFile||uploadBusy} className="panel-outline" onClick={uploadAudio}>{uploadBusy?'Đang tải lên':'Thêm file nhạc'}</button></details><small>Chỉ dùng nội dung được phép chia sẻ và nhúng.</small></div>}
    {panel==='queue'&&<>
      <div className="queue-summary"><div className="overline">CÙNG CHỌN · CÙNG XEM</div><p>Thêm video YouTube hoặc bài hát vào danh sách. Bài nhiều vote sẽ phát trước. Bằng phiếu thì bài gửi sớm hơn được ưu tiên.</p></div>
      <div className="queue-current modern-current"><div><span className="on-air-dot"/> <span className="overline">ĐANG PHÁT TRONG RẠP</span></div><strong>{screenMedia.title}</strong><small>{screenMedia.type==='youtube'?'YouTube':screenMedia.type==='audio'?'Audio':screenMedia.type==='file'?'Video':'Demo'} · {formatTime(progress)} {screenMedia.duration?' / '+formatTime(screenMedia.duration):''}</small><div className="media-button-row"><button onClick={()=>player(screenMedia.playing?'pause':'play')} disabled={!isHost}>{screenMedia.playing?<Pause size={16}/>:<Play size={16}/>} {screenMedia.playing?'Tạm dừng':'Phát'}</button><button onClick={()=>player('next')} disabled={!isHost}><SkipForward size={16}/> Chuyển bài</button><button onClick={()=>send('vote_skip',{})}><Vote size={16}/> {room.votedIds?.includes(account?.id||you)?'Rút vote':'Skip'} {room.votes}/{room.skipNeeded}</button></div>{isHost&&<label className="seek-line">Tua <input type="range" min="0" max={screenMedia.duration||3600} value={Math.max(0,Math.min(progress,screenMedia.duration||3600))} onChange={e=>send('media_control',{command:'seek',position:Number(e.target.value)})}/></label>}</div>
      <div className="queue-heading"><span>TIẾP THEO <b>{room.queue.length} bài</b></span><span>↑ Bình chọn để lên đầu</span></div>
      <div className="queue-items">{room.queue.length?room.queue.map((m,i)=>{
       const youtubeId=m.type==='youtube'?(m.url.match(/[?&]v=([\w-]{11})/)||[])[1]:null;
       return <article className="queue-item-card" key={m.id}><div className="queue-rank">{String(i+1).padStart(2,'0')}</div><div className="queue-art">{youtubeId?<img src={`https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`} loading="lazy" alt="Ảnh thu nhỏ video"/>:<Music2 size={23}/>}</div><div className="queue-details"><strong title={m.title}>{m.title}</strong><small>{m.addedBy} · {m.type==='youtube'?'YouTube':m.type==='audio'?'Audio':'Video'} {m.duration?' · '+formatTime(m.duration):''}</small></div><button className={'queue-vote '+(m.voters?.includes(account?.id||you)?'voted':'')} title="Bình chọn bài này" onClick={()=>send('queue_vote',{id:m.id})}><span>↑</span><b>{m.votes||0}</b></button><div className="queue-tools">{(isHost||m.addedById===you)&&<button title="Xóa" onClick={()=>send('queue_manage',{id:m.id,command:'remove'})}><X size={14}/></button>}</div></article>
      }):<div className="queue-empty"><Music2 size={30}/><strong>Danh sách chờ đang trống</strong><p>Hãy thêm một bài hát hoặc video YouTube đầu tiên!</p></div>}</div>
      <button className="queue-add-main" onClick={()=>setPanel('media')}><Plus size={20}/> Thêm video YouTube / bài hát</button>
    </>}
    {panel==='photo'&&<>
      <p className="panel-hint">Chiếu ảnh và lời nhắn lên màn hình của cả rạp. Video sẽ tạm dừng đúng vị trí, sau khi hết lượt ảnh sẽ tự phát tiếp. Mức giá đề xuất <strong>1.000đ/giây</strong>. <strong>Hiện chỉ thử bằng xu demo, chưa thu tiền thật.</strong></p>
      <div className="wallet-balance"><small>SỐ DƯ VÍ KIỂM THỬ (KHÔNG PHẢI TIỀN THẬT)</small><strong>{(wallet.balance||0).toLocaleString('vi-VN')} xu</strong><span>Ví gắn với UUID tài khoản khi đăng nhập; chưa kết nối nạp tiền thật.</span></div>
      {account&&<div className="panel-hint">Ví tài khoản <b>{account.username}</b> · ID {account.id.slice(0,8)}… · {wallet.accountLinked?'Đã liên kết':'Đang kết nối'}</div>}
      {wallet.demoEnabled&&!wallet.demoCredited&&<button className="panel-outline" onClick={()=>send('wallet_demo_topup',{},'Đã nhận tín dụng demo')}>+ Nhận 200.000 xu dùng thử (một lần)</button>}
      <h4>Kiểm thử nạp VietQR / SePay</h4>
      <p className="panel-hint">Chỉ SANDBOX: không có mã QR chuyển khoản thật. Chỉ webhook có chữ ký hợp lệ mới được cộng vào ví UUID của tài khoản. Mỗi giao dịch được nhận một lần.</p>
      <select value={topupAmount} onChange={e=>setTopupAmount(Number(e.target.value))}>{[10000,20000,50000,100000,200000].map(a=><option key={a} value={a}>{a.toLocaleString('vi-VN')}đ</option>)}</select>
      <button className="panel-outline" onClick={createSandboxTopup} disabled={!account}>Tạo lệnh nạp SANDBOX (không chuyển tiền)</button>
      {topupOrder&&<p className="panel-hint">Mã đơn: <b>{topupOrder.code}</b> · {topupOrder.amount.toLocaleString('vi-VN')}đ · Chờ webhook ký số xác nhận.</p>}
      <label>Chọn ảnh JPG / PNG / WebP / GIF tối đa 12 MB</label>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>setPhotoFile(e.target.files?.[0]||null)}/>
      {photoFile&&<div className="photo-file-name">📸 {photoFile.name}</div>}
      <label>Lời nhắn hiển thị (tối đa 160 ký tự)</label>
      <textarea value={photoCaption} maxLength={160} onChange={e=>setPhotoCaption(e.target.value)} placeholder="Chúc mọi người xem phim vui vẻ!" rows={3}/>
      <label>Thời gian chiếu: {photoDuration} giây · {PHOTO_VND_PER_SECOND.toLocaleString('vi-VN')}đ / giây</label><input type="range" min={PHOTO_MIN_SECONDS} max={PHOTO_MAX_SECONDS} value={photoDuration} onChange={e=>setPhotoDuration(Number(e.target.value))}/>
      <div className="photo-cost"><span>Giá quy đổi:</span><strong>{photoCost(photoDuration).toLocaleString('vi-VN')}đ</strong></div>
      <p className="panel-hint">Thao tác thử trừ {photoCost(photoDuration).toLocaleString('vi-VN')} xu. Production cần tích hợp xác minh giao dịch và sổ cái SQL.</p>
      <button className="panel-main" disabled={photoBusy||!photoFile||!!pendingPhoto} onClick={submitPhoto}>{photoBusy?'Đang gửi ảnh...':pendingPhoto?'⏳ Ảnh đang chờ xác minh nạp tiền':wallet.balance<photoCost(photoDuration)?'💗 Gửi ảnh và mở modal ủng hộ':'✨ Chiếu ảnh ưu tiên'}</button>
      {pendingPhoto&&<p className="panel-hint">Ảnh đã được giữ để tự gửi lên màn hình khi webhook SANDBOX xác minh nạp đủ. Nếu bạn rời phòng/khởi động lại server, số dư vẫn còn nhưng có thể cần tải ảnh lại.</p>}
      <button className="panel-outline" onClick={()=>setTopupOpen(true)}>💗 Mở modal ủng hộ / nạp xu sandbox</button>
      <p className="panel-hint">Ảnh được lưu tạm và xoá định kỳ. Đăng nhập không tạo ví tiền thật; khi triển khai thanh toán cần webhook xác minh và database giao dịch.</p>
      <h4>Hàng chiếu ảnh ({room.photoQueue?.length||0})</h4>
      {room.photoActive?<div className="photo-queue-item"><img src={room.photoActive.url} alt="Ảnh đang chiếu"/><div><strong>Đang chiếu · {room.photoActive.addedBy}</strong><small>{room.photoActive.duration} giây</small></div></div>:<p className="panel-hint">Chưa có ảnh nào đang chiếu.</p>}
      {(room.photoQueue||[]).map(p=><div className="photo-queue-item" key={p.id}><img src={p.url} alt="Ảnh chờ"/><div><strong>{p.addedBy}</strong><small>{p.duration} giây · Đang chờ</small></div></div>)}
    </>}
    {panel==='support'&&<><div className="support-hero"><span>💖</span><h4>Ủng hộ rạp disco</h4><p>Gửi quà ảo để cổ vũ mọi người cùng nhảy. Đây là quà miễn phí trong bản demo, <b>không phải thanh toán tiền thật</b>.</p><div className="gift-total">{room.supportCount||0} lượt tặng quà trong phòng</div></div><div className="gift-grid">{[['heart','❤️','Thả tim'],['star','⭐','Ngôi sao'],['flower','🌹','Hoa hồng'],['confetti','🎉','Pháo giấy']].map(([gift,emoji,label])=><button key={gift} onClick={()=>send('support_gift',{gift})}><span>{emoji}</span><b>{label}</b></button>)}</div><h4>Quà vừa nhận</h4>{(room.gifts||[]).length===0?<p className="panel-hint">Chưa có ai gửi quà, hãy là người đầu tiên!</p>:[...(room.gifts||[])].reverse().map(g=><div key={g.id} className="gift-entry"><span>{({heart:'❤️',star:'⭐',flower:'🌹',confetti:'🎉'})[g.gift]}</span><strong>{g.name}</strong><small>{new Date(g.time).toLocaleTimeString('vi-VN')}</small></div>)}</>}
    {panel==='support'&&<button className="panel-main" onClick={()=>setTopupOpen(true)}>💗 Mở ví / nạp xu SANDBOX</button>}
    {panel==='chat'&&<><div className="chat-log">{messages.map(m=><div key={m.id} className={'message '+(m.system?'system':'')}>
     {m.system?<span>✦ {m.text}</span>:<><div className="msg-author">{m.name}{m.userId===you?' (Bạn)':''} <small>{new Date(m.time).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</small></div><div>{m.text}</div></>}
    </div>)}<div ref={chatEnd}/></div><div className="reaction-row">{emojiList.map(e=><button key={e} onClick={()=>send('reaction',e)}>{e}</button>)}</div></>}
    {panel==='people'&&<><div className="stat-row"><Users size={19}/><span>{room.participants.length} người đang trong phòng</span></div>{room.participants.map(p=><div className="person-row" key={p.id}><span className="person-icon" style={{background:['#9dd5be','#f6b9a6','#a7c6f2','#e5c4ee','#d9ca93','#a7e4e1'][p.color]}}>{p.name[0]?.toUpperCase()}</span><div><strong>{p.name}{p.id===you?' (Bạn)':''}</strong><small>{p.action==='dance'?'🕺 Đang nhảy':p.action==='sit'?'🪑 Đang ngồi':p.action==='wave'?'👋 Đang vẫy tay':'🙌 Đang cổ vũ'}</small></div>{p.id===room.hostId&&<Crown size={16} color="#d5e88a"/>}{isHost&&p.id!==you&&<button className="kick-btn" title="Mời người này ra khỏi phòng" onClick={()=>{if(window.confirm(`Mời ${p.name} ra khỏi phòng?`))send('kick_user',p.id)}}><X size={14}/></button>}</div>)}</>}
    {panel==='appearance'&&<><div className="vimo-skin-market"><h4>Skin cho avatar</h4><p className="panel-hint">4 mẫu với giá 10k, 20k, 30k và 50k xu demo. Mua một lần, dùng lại miễn phí.</p><div className="vimo-skin-grid">{[['mint','Mint Pop',10000],['peach','Peach Idol',20000],['midnight','Midnight',30000],['royal','Royal Disco',50000]].map(([skin,label,price])=><button key={skin} className={'vimo-skin-card '+(youMember?.skin===skin?'on':'')} onClick={()=>send('skin_purchase',{skin},'Đã chọn '+label)}><span className={'skin-swatch skin-'+skin}>✦</span><strong>{label}</strong><small>{(wallet.ownedSkins||[]).includes(skin)?'Đã sở hữu':price.toLocaleString('vi-VN')+' xu'}</small></button>)}</div></div><p className="panel-hint">Tùy chỉnh avatar realtime. Các thành viên khác sẽ thấy trang phục bạn chọn ngay.</p><h4>Áo / màu nhân vật</h4><div className="color-picker">{['#9dd5be','#f6b9a6','#a7c6f2','#e5c4ee','#d9ca93','#a7e4e1'].map((c,i)=><button key={c} aria-label={`Áo màu ${i+1}`} style={{background:c}} onClick={()=>editOutfit('color',i)}>{youMember?.color===i?<Check color="#182321"/>:null}</button>)}</div><h4>Kiểu tóc</h4><div className="option-group">{['Tóc đen','Tóc hồng','Mũ xanh','Mũ tím'].map((n,i)=><button key={n} className={youMember?.hair===i?'on':''} onClick={()=>editOutfit('hair',i)}>{n}</button>)}</div><h4>Phụ kiện</h4><div className="option-group">{['Không','Kính râm','Tai nghe','Vương miện'].map((n,i)=><button key={n} className={youMember?.accessory===i?'on':''} onClick={()=>editOutfit('accessory',i)}>{n}</button>)}</div><h4>Quần</h4><div className="option-group">{['Đen','Tím','Xanh','Nâu','Trắng'].map((n,i)=><button key={n} className={youMember?.pants===i?'on':''} onClick={()=>editOutfit('pants',i)}>{n}</button>)}</div><h4>Điệu nhảy & vị trí</h4><div className="option-group">{[['bounce','Bounce'],['shuffle','Shuffle'],['spin','Xoay vòng']].map(([v,label])=><button className={dance===v?'on':''} key={v} onClick={()=>{setDance(v);if(youMember?.action==='dance')send('avatar_action',{action:'dance',dance:v,zone:youMember.zone});}}>🕺 {label}</button>)}</div><div className="option-group"><button onClick={()=>stageAction('floor')}>🪩 Nhảy dưới sàn</button><button onClick={()=>stageAction('stage')}>⭐ Lên sân khấu</button><button onClick={()=>send('avatar_action',{action:'sit'})}>🪑 Về ghế</button></div><p className="panel-hint">Trang phục được dựng bằng các mô hình 3D low-poly trong bản demo.</p></>}
    {panel==='karaoke'&&<div className="karaoke-room-controls"><h4>🎤 Music Box · Danh sách hát</h4><div className="karaoke-singer">Đang hát: <strong>{room.participants.find(p=>p.id===room.karaokeSinger)?.name||'Chưa có ai'}</strong></div><div className="karaoke-queue">{(room.karaokeQueue||[]).map((id,i)=><span key={id}>{i+1}. {room.participants.find(p=>p.id===id)?.name||'Đã rời phòng'}</span>)}</div><p className="karaoke-mic-note">Mic cần HTTPS hoặc localhost; nên dùng tai nghe. Một số mạng cần TURN.</p>{room.karaokeSinger!==you?<button className="panel-main" onClick={()=>send('karaoke_enqueue',{})}>🎙️ Đăng ký hát</button>:<button className="panel-main" onClick={karaokeMic.broadcasting?karaokeMic.stop:karaokeMic.start}>{karaokeMic.broadcasting?'🔴 Tắt mic / kết thúc lượt':'🎤 Bật mic để hát'}</button>}{room.karaokeQueue?.includes(you)&&<button className="panel-outline" onClick={()=>send('karaoke_leave',{})}>Rời hàng chờ</button>}{isHost&&<button className="panel-outline" onClick={()=>send('karaoke_next',{})}>Chuyển lượt hát</button>}</div>}
    {panel==='settings'&&<><div className="setting"><div><strong>Đèn disco</strong><small>Đèn laser và ánh sáng sân khấu</small></div><button disabled={!isHost} className="switch" aria-label="Bật tắt disco" aria-pressed={room.disco} onClick={()=>send('media_control',{command:'disco',enabled:!room.disco})}><span/></button></div><div className="setting"><div><strong>Phong cách sân khấu</strong><small>LED sân khấu đồng bộ mọi người</small></div><select value={room.stageTheme||'neon'} disabled={!isHost} onChange={e=>send('media_control',{command:'stage_theme',theme:e.target.value})}>{[['neon','Neon xanh'],['sunset','Hoàng hôn'],['galaxy','Ngân hà']].map(([v,n])=><option value={v} key={v}>{n}</option>)}</select></div><div className="setting"><div><strong>Nhịp Disco (BPM)</strong><small>Điều chỉnh tốc độ nhạc demo</small></div><select value={room.bpm} disabled={!isHost} onChange={e=>send('media_control',{command:'bpm',bpm:Number(e.target.value)})}>{[90,100,110,120,128,138,150,160].map(v=><option key={v} value={v}>{v}</option>)}</select></div><div className="setting"><div><strong>Trạng thái mạng</strong><small>{online?'Đã kết nối server':'Mất kết nối'}</small></div><span className="live-dot"/></div><div className="setting"><div><strong>Người quản lý</strong><small>{isHost?'Bạn là chủ phòng':'Chỉ chủ phòng điều khiển phát'}</small></div><Crown size={19}/></div><button className="panel-outline danger" onClick={leave}><DoorOpen size={16}/> Rời phòng</button></>}
    {panel==='room'&&<><div className="room-code"><small>{ROOM_CATEGORIES[room.category]?.label||'Phòng'} · {room.isPrivate?'Riêng tư':'Công khai'} · MÃ PHÒNG</small><strong>{room.id}</strong><p>{room.name}</p></div><button className="panel-main" onClick={invite}><Share2 size={16}/> Sao chép link mời bạn bè</button><div className="stat-row"><Users size={17}/> {room.participants.length} / {room.maxPeople} thành viên</div><div className="stat-row">{room.hasPassword?<LockKeyhole size={17}/>:<Users size={17}/>} {room.hasPassword?'Phòng có mật khẩu':'Phòng công khai'}</div><button className="panel-outline danger" onClick={leave}>Rời phòng</button></>}
    {panel==='about'&&<p className="panel-hint">HỘIROOM 3D — demo công nghệ React Three Fiber + Socket.IO. Giao diện được thiết kế mới dựa trên yêu cầu của bạn. Đây không phải mã nguồn của choigivui.com.</p>}
   </div>
  </div>}
  {!joined&&panel&&<div className="generic-modal" onClick={()=>setPanel('')}><div className="simple-dialog" onClick={e=>e.stopPropagation()}><button className="dialog-close" onClick={()=>setPanel('')}><X/></button><h3>HỘIROOM</h3><p>Đăng nhập vào rạp để sử dụng tính năng này. Tạo phòng hoặc chọn phòng công khai!</p></div></div>}
  {topupOpen&&<div className="auth-backdrop" onClick={()=>setTopupOpen(false)}><div className="auth-dialog topup-dialog" role="dialog" aria-modal="true" aria-label="Ủng hộ rạp qua ví sandbox" onClick={e=>e.stopPropagation()}>
    <button className="auth-close" onClick={()=>setTopupOpen(false)}><X size={20}/></button><div className="auth-logo">♥</div>
    <h2>Ủng hộ rạp · Nạp ví thử</h2><p>Ví hiện có <b>{(wallet.balance||0).toLocaleString('vi-VN')} xu</b>. {pendingPhoto?`Ảnh ${pendingPhoto.duration} giây cần ${pendingPhoto.cost.toLocaleString('vi-VN')} xu.`:'Bạn có thể nạp xu thử để kiểm tra webhook.'}</p>
    <p><strong>Sandbox — KHÔNG chuyển khoản tiền thật.</strong> Tiền chỉ được cộng sau khi backend nhận webhook SePay HMAC hợp lệ. Một giao dịch chỉ ghi nhận một lần.</p>
    {!account?<><p>Vui lòng đăng nhập tài khoản để nạp ví.</p><button className="auth-primary" onClick={()=>{setTopupOpen(false);setAuthOpen(true)}}>Đăng nhập / Đăng ký</button></>:<>
      <label>Số tiền thử (đơn vị VND mô phỏng)</label><select value={topupAmount} onChange={e=>setTopupAmount(Number(e.target.value))}>{[10000,20000,50000,100000,200000,500000,1000000].includes(topupAmount)?[10000,20000,50000,100000,200000,500000,1000000].map(a=><option key={a} value={a}>{a.toLocaleString('vi-VN')}đ</option>):[topupAmount,10000,20000,50000,100000,200000,500000,1000000].map(a=><option key={a} value={a}>{a.toLocaleString('vi-VN')}đ</option>)}</select>
      <button className="auth-primary" onClick={createSandboxTopup}>Tạo lệnh nạp sandbox</button>
      {topupOrder&&<div className="topup-order"><b>Đang chờ webhook có chữ ký</b><span>Mã: {topupOrder.code}</span><span>Số tiền: {topupOrder.amount.toLocaleString('vi-VN')}đ</span>{sandboxQrUrl&&<img src={sandboxQrUrl} alt="QR sandbox, không chuyển tiền thật" style={{maxWidth:230,width:'100%',borderRadius:12,margin:'12px auto',display:'block'}}/>}<small>CHỈ SANDBOX — KHÔNG chuyển tiền thật. Mã QR khớp mã đơn PostgreSQL; ví chỉ cộng sau webhook HMAC hợp lệ.</small></div>}
      {wallet.demoEnabled&&!wallet.demoCredited&&<button className="panel-outline" onClick={()=>send('wallet_demo_topup',{},'Đã nhận xu demo')}>Nhận 200.000 xu demo (một lần)</button>}
    </>}
   </div></div>}
  {authOpen&&<div className="auth-backdrop" onClick={()=>setAuthOpen(false)}><div className="auth-dialog" role="dialog" aria-modal="true" aria-label="Tài khoản HỘIROOM" onClick={e=>e.stopPropagation()}>
    <button className="auth-close" onClick={()=>setAuthOpen(false)}><X size={20}/></button>
    <div className="auth-logo">V</div><h2>{account?'Tài khoản của bạn':authMode==='login'?'Chào mừng trở lại':'Tạo tài khoản mới'}</h2>
    <p>{account?'Bạn đã đăng nhập và có thể tiếp tục xem cùng bạn bè.':'Tài khoản được lưu bằng PostgreSQL khi đã cấu hình DATABASE_URL; mật khẩu được băm bằng scrypt.'}</p>
    {account?<><div className="account-tag"><Users size={17}/>{account.username}</div><button className="auth-primary" onClick={authLogout}>Đăng xuất</button></>:<>
    <div className="auth-tabs"><button className={authMode==='login'?'selected':''} onClick={()=>{setAuthMode('login');setAuthConfirmPassword('')}}>Đăng nhập</button><button className={authMode==='register'?'selected':''} onClick={()=>{setAuthMode('register');setAuthConfirmPassword('')}}>Đăng ký</button></div>
    <form onSubmit={authSubmit}><label>Tên tài khoản</label><input autoFocus required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" autoComplete="username" value={authName} onChange={e=>setAuthName(e.target.value)} placeholder="ten_cua_ban"/><label>Mật khẩu</label><input required type="password" minLength={8} autoComplete={authMode==='login'?'current-password':'new-password'} value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="Ít nhất 8 ký tự"/>{authMode==='register'&&<><label htmlFor="auth-confirm-password">Nhập lại mật khẩu</label><input id="auth-confirm-password" required type="password" minLength={8} maxLength={100} autoComplete="new-password" value={authConfirmPassword} onChange={e=>setAuthConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu để xác nhận" /></>}<button className="auth-primary" disabled={authBusy} type="submit">{authBusy?'Đang xử lý...':authMode==='login'?'Đăng nhập':'Đăng ký và đăng nhập'}</button></form>
    </>}
   </div></div>}
  {notice&&<div className="toast"><Info size={16}/>{notice}</div>}
  {joined&&!audioEnabled&&<button className="sound-enable" onClick={audioToggle}><Volume2 size={17}/> Bấm để bật âm thanh</button>}
  </div>;
}
export default App;
