import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { existsSync, mkdirSync, writeFileSync, unlinkSync, readFileSync, renameSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import crypto from 'node:crypto';
import {validateRoomOptions,canJoinRoom,soundcloudTrack,nextSinger} from '../shared/rooms.js';
import { MAX_STAGE_DANCERS, SKIN_PRICES, votesNeeded, stageSlot, queueOrder } from '../shared/room-rules.js';
import { normalizeTopupAmount, createPaymentCode, verifySePaySignature } from '../shared/payments.js';
import { openPgWallet } from './wallet-store.js';
import { photoCost, PHOTO_MAX_BYTES, DEMO_WALLET_CREDIT, freezePlaybackForPhoto, restorePlaybackAfterPhotos, PHOTO_MIN_SECONDS, PHOTO_MAX_SECONDS } from '../shared/photo.js';

const app = express();
const server = createServer(app);
const port = Number(process.env.PORT || 3001);
const origin = process.env.FRONTEND_ORIGIN || '*';
const io = new Server(server, { cors: {origin, methods: ['GET','POST']}, maxHttpBufferSize: 30_000 });
const walletDb=process.env.DATABASE_URL ? await openPgWallet(process.env.DATABASE_URL) : null;
const paymentMode=process.env.PAYMENTS_MODE==='sandbox' && walletDb ? 'sandbox' : 'disabled';
const sepaySecret=process.env.SEPAY_WEBHOOK_SECRET||'';
const bankAccount=process.env.VIETQR_BANK_ACCOUNT||'';
const pendingPhotoRequests=new Map();
app.post('/api/webhooks/sepay', express.raw({type:'application/json',limit:'32kb'}),async(req,res)=>{
 if(paymentMode!=='sandbox'||!sepaySecret||!bankAccount)return res.status(503).json({success:false});
 if(!verifySePaySignature(req.body,req.headers['x-sepay-timestamp'],req.headers['x-sepay-signature'],sepaySecret))return res.status(401).json({success:false});
 let payload;try{payload=JSON.parse(req.body.toString('utf8'));}catch{return res.status(400).json({success:false});}
 try{
  const receipt=await walletDb.creditVerifiedPayment(payload,bankAccount);
  if(!receipt.ok)return res.status(422).json({success:false,error:receipt.reason});
  if(!receipt.duplicate){
   for(const socket of io.sockets.sockets.values())if(socket.data.accountId===receipt.userId)await sendWallet(socket);
   await resumePendingPhoto(receipt.userId);
  }
  return res.status(200).json({success:true,duplicate:!!receipt.duplicate});
 }catch(error){console.error('Webhook transaction failed',error);return res.status(503).json({success:false});}
});
app.use(express.json({ limit: '8kb' }));
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff'); next();});

// Minimal account system for a SINGLE NODE demo deployment: no third-party auth dependency.
// Passwords are scrypt-hashed; cookies are HttpOnly/SameSite. Use managed auth + DB in production.
const authDir=resolve('auth-data');mkdirSync(authDir,{recursive:true});
const accountFile=join(authDir,'accounts.json');
let accounts=[];
try { accounts=JSON.parse(readFileSync(accountFile,'utf8')); if(!Array.isArray(accounts))accounts=[]; }catch { accounts=[]; }
const sessions=new Map(); // ephemeral sessions: logout / server restart expires session
const failedLogins=new Map();
function saveAccounts(){
 const temp=accountFile+'.tmp';writeFileSync(temp,JSON.stringify(accounts,null,2),{mode:0o600});renameSync(temp,accountFile);
}
function parseCookie(req){
 const entry=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('wetube_sid='));
 return entry?.slice('wetube_sid='.length)||'';
}
function getSession(req){
 const token=parseCookie(req);const session=sessions.get(token);
 if(!session||session.expires<Date.now())return null;
 return accounts.find(a=>a.id===session.userId)||null;
}
function publicUser(user){return user?{id:user.id,username:user.username,createdAt:user.createdAt}:null;}
function sessionCookie(req,token,maxAge){
 const secure=process.env.NODE_ENV==='production'?' Secure;':'';
 return `wetube_sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge};${secure}`;
}
function createSession(req,res,user){
 const token=crypto.randomBytes(32).toString('hex');
 sessions.set(token,{userId:user.id,expires:Date.now()+7*86400e3});
 res.setHeader('Set-Cookie',sessionCookie(req,token,7*86400));
 res.json({ok:true,user:publicUser(user)});
}
function validateCredentials(body){
 const username=String(body?.username||'').trim();const password=String(body?.password||'');
 if(!/^[a-zA-Z0-9_]{3,24}$/.test(username))return 'Tên tài khoản 3–24 ký tự, chỉ chữ, số và dấu gạch dưới.';
 if(password.length<8||password.length>100)return 'Mật khẩu phải có 8–100 ký tự.';
 return null;
}
app.get('/api/auth/me',(req,res)=>res.json({ok:true,user:publicUser(getSession(req))}));
app.post('/api/auth/register',(req,res)=>{
 const error=validateCredentials(req.body);if(error)return res.status(400).json({error});
 const username=req.body.username.trim();
 if(accounts.some(a=>a.username.toLowerCase()===username.toLowerCase()))return res.status(409).json({error:'Tên tài khoản đã tồn tại.'});
 if(accounts.length>=5000)return res.status(503).json({error:'Đã đạt giới hạn tài khoản demo.'});
 const salt=crypto.randomBytes(16).toString('hex');
 const hash=crypto.scryptSync(req.body.password,salt,64).toString('hex');
 const user={id:crypto.randomUUID(),username,salt,hash,createdAt:Date.now()};
 accounts.push(user);saveAccounts();createSession(req,res,user);
});
app.post('/api/auth/login',(req,res)=>{
 const key=req.ip||'unknown';const track=failedLogins.get(key)||{count:0,until:0};
 if(track.until>Date.now())return res.status(429).json({error:'Thử lại sau ít phút.'});
 const username=String(req.body?.username||'').trim();const password=String(req.body?.password||'');
 const user=accounts.find(a=>a.username.toLowerCase()===username.toLowerCase());
 let valid=false;
 if(user&&password.length<=100){
  const check=Buffer.from(crypto.scryptSync(password,user.salt,64).toString('hex'),'hex');
  valid=crypto.timingSafeEqual(check,Buffer.from(user.hash,'hex'));
 }
 if(!valid){const count=track.count+1;failedLogins.set(key,{count,until:count>=7?Date.now()+5*60_000:0});return res.status(401).json({error:'Tài khoản hoặc mật khẩu không đúng.'});}
 failedLogins.delete(key);createSession(req,res,user);
});
app.post('/api/auth/logout',(req,res)=>{sessions.delete(parseCookie(req));res.setHeader('Set-Cookie',sessionCookie(req,'',0));res.json({ok:true});});
app.get('/api/wallet/me',async(req,res)=>{
 const user=getSession(req);if(!user)return res.status(401).json({error:'Vui lòng đăng nhập.'});
 try{
  if(walletDb){const w=await walletDb.getWallet(user.id);return res.json({ok:true,user:publicUser(user),balance:w.balance,ledger:w.ledger.slice(0,30),orders:await walletDb.getOrders(user.id),paymentsMode:paymentMode});}
  const online=[...io.sockets.sockets.values()].find(s=>s.data.accountId===user.id);const w=online?walletOf(online):null;return res.json({ok:true,user:publicUser(user),balance:w?.balance||0,ledger:w?.ledger.slice(-30).reverse()||[],orders:[],paymentsMode:'disabled'});
 }catch{return res.status(503).json({error:'Ví tạm thời không sẵn sàng.'});}
});
app.post('/api/wallet/topup-orders',async(req,res)=>{
 const user=getSession(req);if(!user)return res.status(401).json({error:'Vui lòng đăng nhập.'});
 if(paymentMode!=='sandbox')return res.status(503).json({error:'Chưa bật môi trường thanh toán sandbox PostgreSQL. Không nạp tiền thật.'});
 if(!sepaySecret||!bankAccount)return res.status(503).json({error:'Thiếu cấu hình SePay sandbox / tài khoản mẫu.'});
 const amount=normalizeTopupAmount(req.body?.amount);if(amount===null)return res.status(400).json({error:'Nạp từ 10.000đ đến 1.000.000đ, bội số 1.000đ.'});
 try{
  const order=await walletDb.createTopupOrder(user.id,amount,createPaymentCode());
  return res.status(201).json({ok:true,order,qrUrl:null,message:'Chỉ sandbox. KHÔNG chuyển khoản thật. Kiểm tra webhook có chữ ký HMAC hợp lệ.'});
 }catch(error){console.error('Topup order failed',error);return res.status(503).json({error:'Không tạo được đơn nạp.'});}
});




const MAX_PEOPLE = 100;
// Local demo credits only; NEVER deposit real money based on a button click.
const demoWalletEnabled = process.env.NODE_ENV !== 'production' && process.env.DEMO_WALLET_ENABLED !== 'false';
const wallets = new Map(); // temporary demo credits only, never a real-money ledger
const depositRequests=new Map(); // pending VietQR intents; no auto-credit without payment-provider verification
const photos = new Map(); // temporary, validated files only
const photoDir = resolve('photo-uploads');
mkdirSync(photoDir, {recursive:true});
const MAX_PHOTO_FILES = 100;
const MAX_PHOTO_QUEUE = 15;
const PHOTO_TTL = 24 * 60 * 60 * 1000;
const detectImage = buffer => {
 if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
 if (buffer[0]===0xff && buffer[1]===0xd8 && buffer[2]===0xff) return {ext:'.jpg',type:'image/jpeg'};
 if (buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return {ext:'.png',type:'image/png'};
 if (buffer.toString('ascii',0,4)==='RIFF' && buffer.toString('ascii',8,12)==='WEBP') return {ext:'.webp',type:'image/webp'};
 if (['GIF87a','GIF89a'].includes(buffer.toString('ascii',0,6))) return {ext:'.gif',type:'image/gif'};
 return null;
};
const walletOf = socket => wallets.get(socket.data.walletToken);
const sendWallet = async socket => {
 try{
  const w=walletDb&&socket.data.accountId ? await walletDb.getWallet(socket.data.accountId) : walletOf(socket);
  socket.emit('wallet_state',{balance:w?.balance||0,demoEnabled:demoWalletEnabled,demoCredited:!!w?.demoCredited,ledger:walletDb&&socket.data.accountId?w?.ledger.slice(0,12)||[]:w?.ledger.slice(-12).reverse()||[],accountLinked:!!socket.data.accountId,realPaymentsEnabled:false,paymentsMode});
 }catch(e){console.error('wallet state failed',e);socket.emit('wallet_error','Ví tạm thời không sẵn sàng');}
};
const publicPhoto = p => p ? ({id:p.id,url:p.url,caption:p.caption,addedBy:p.addedBy,duration:p.duration,cost:p.cost,startedAt:p.startedAt,endsAt:p.endsAt}) : null;

const MAX_AUDIO_BYTES = 20 * 1024 * 1024;
const MAX_UPLOADS = 150;
const UPLOAD_TTL = 24 * 60 * 60 * 1000; // local demo only; use object storage in production
const uploadDir = resolve('uploads');
mkdirSync(uploadDir, {recursive:true});
const uploadedAudio = new Map();
const supportedAudio = new Set(['.mp3','.m4a','.wav','.ogg','.aac','.flac']);
// Never trust the extension alone: reject clearly mismatched uploads.
const looksLikeAudio = (buf, ext) => {
 if(!Buffer.isBuffer(buf)||buf.length<12)return false;
 if(ext==='.mp3')return buf.toString('ascii',0,3)==='ID3'||(buf[0]===0xff&&(buf[1]&0xe0)===0xe0);
 if(ext==='.wav')return buf.toString('ascii',0,4)==='RIFF'&&buf.toString('ascii',8,12)==='WAVE';
 if(ext==='.ogg')return buf.toString('ascii',0,4)==='OggS';
 if(ext==='.m4a')return buf.toString('ascii',4,8)==='ftyp';
 if(ext==='.aac')return buf[0]===0xff&&(buf[1]&0xf0)===0xf0;
 if(ext==='.flac')return buf.toString('ascii',0,4)==='fLaC';
 return false;
};
const rooms = new Map();
const safeText = (v, n=60) => String(v ?? '').replace(/[\u0000-\u001F\u007F<>]/g,'').trim().slice(0,n);
const roomCode = () => crypto.randomBytes(4).toString('hex').toUpperCase();
const sample = {type:'demo', url:'', title:'HộiRoom • DISCO NIGHT', duration:240};
const newRoom = (id, name, password='', permanent=false,options={}) => ({
 id, name, password, permanent, category:options.category||'cinema', maxPeople:options.maxPeople||100, isPrivate:!!options.isPrivate, inviteToken:options.isPrivate?crypto.randomBytes(24).toString('hex'):null, karaokeQueue:[], karaokeSinger:null, createdAt:Date.now(), hostId:null, participants:new Map(), messages:[], queue:[], votes:new Set(),
 media:{...sample, playing:false, position:0, updatedAt:Date.now()}, photoActive:null, photoQueue:[], photoPlayback:null, disco:true, bpm:128, stageTheme:'neon', supportCount:0, gifts:[],
});
rooms.set('DISCO', newRoom('DISCO','Phòng Disco cộng đồng','',true));
rooms.set('CLUB',newRoom('CLUB','DJ Club công cộng','',true,{category:'dj',maxPeople:50}));
rooms.set('KBOX',newRoom('KBOX','Music Box cộng đồng','',true,{category:'musicbox',maxPeople:8}));
const elapsedMedia = r => Math.max(0, r.media.position + (r.media.playing ? (Date.now()-r.media.updatedAt)/1000 : 0));
const mediaSnapshot = r => ({...r.media, position:elapsedMedia(r), updatedAt:Date.now()});
const participants = r => [...r.participants.values()];
const snapshot = r => ({id:r.id,name:r.name,category:r.category,isPrivate:r.isPrivate,karaokeQueue:r.karaokeQueue,karaokeSinger:r.karaokeSinger,hasPassword:!!r.password,hostId:r.hostId,participants:participants(r),messages:r.messages.slice(-70),queue:r.queue,votes:r.votes.size,votedIds:[...r.votes],skipNeeded:votesNeeded(r.participants.size),media:mediaSnapshot(r),photoActive:publicPhoto(r.photoActive),photoQueue:r.photoQueue.map(publicPhoto),disco:r.disco,bpm:r.bpm,stageTheme:r.stageTheme,supportCount:r.supportCount,gifts:r.gifts.slice(-20),maxPeople:r.maxPeople});
const emitRoom = r => io.to(r.id).emit('room_state',snapshot(r));
const err = (ack,message) => typeof ack==='function' && ack({ok:false,error:message});
const success = (ack,info={})=>typeof ack==='function'&&ack({ok:true,...info});
const inRoom = socket => rooms.get(socket.data.roomId);
const emitSystem = (r,txt) => { const msg={id:crypto.randomUUID(),system:true,text:txt,time:Date.now()};r.messages.push(msg);r.messages=r.messages.slice(-80);io.to(r.id).emit('chat_message',msg);};
const release = socket => {
 const r=inRoom(socket); if(!r) return;
 const p=r.participants.get(socket.id);if(!p)return;
 r.participants.delete(socket.id);
 r.karaokeQueue=r.karaokeQueue.filter(id=>id!==socket.id);
 if(r.karaokeSinger===socket.id)r.karaokeSinger=nextSinger(r.karaokeQueue,r.participants.keys());
 const voterKey=socket.data.accountId||socket.id;
 if(!socket.data.accountId || !participants(r).some(other=>other.accountId===socket.data.accountId))r.votes.delete(voterKey);
 for(const item of r.queue){if(!socket.data.accountId&&item.voters?.includes(socket.id)){item.voters=item.voters.filter(id=>id!==socket.id);item.votes=item.voters.length;}}r.queue.sort(queueOrder);socket.leave(r.id);socket.data.roomId=null;socket.data.uploadToken=null;
 if(r.hostId===socket.id) r.hostId=participants(r)[0]?.id||null;
 emitSystem(r, `${p.name} đã rời phòng`);
 emitRoom(r);
 if(!r.permanent && r.participants.size===0) rooms.delete(r.id);
};
const normalizeMedia = (raw) => {
 const title=safeText(raw?.title,100)||'Bài hát / video mới'; const url=String(raw?.url||'').trim();
 if(url==='demo:') return {...sample,title: title==='Bài hát / video mới'?sample.title:title};
 const localMatch=url.match(/^\/api\/uploads\/([a-f0-9-]+\.(?:mp3|m4a|wav|ogg|aac|flac))$/i);
 if(localMatch && uploadedAudio.has(localMatch[1]))return {type:'audio',url,title,duration:0};
 let u;try{u=new URL(url);}catch{return null;}
 if(!['http:','https:'].includes(u.protocol))return null;
 const h=u.hostname.toLowerCase();
 let videoId='';
 if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(h)) {
  videoId=u.searchParams.get('v')||u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1]||'';
 }else if(['youtu.be','www.youtu.be'].includes(h)){videoId=u.pathname.slice(1).split('/')[0]||'';}
 if(/^[\w-]{11}$/.test(videoId))return {type:'youtube',url:`https://www.youtube.com/watch?v=${videoId}`,title,duration:0};
 const sc=soundcloudTrack(url);if(sc)return {type:'soundcloud',url:sc,title,duration:0};
 // Direct MP4/HLS URLs only. Browser CORS and remote hosting restrictions apply.
 const extension=extname(u.pathname).toLowerCase();
 if(supportedAudio.has(extension))return {type:'audio',url:u.href,title,duration:0};
 if(!['.mp4','.webm','.m3u8'].includes(extension))return null;
 return {type:'file',url:u.href,title,duration:0};
};
const nextMedia = r => {r.queue.sort(queueOrder);r.media = {...(r.queue.shift()||sample),position:0,playing:true,updatedAt:Date.now()};r.votes.clear();};
const changes = r => {emitRoom(r);};
const advancePhoto = r => {
 r.photoActive=r.photoQueue.shift()||null;
 if(r.photoActive){r.photoActive.startedAt=Date.now();r.photoActive.endsAt=Date.now()+r.photoActive.duration*1000;}
 else restorePlaybackAfterPhotos(r);
 emitRoom(r);
};

// VietQR generates transfer instructions, not proof of payment. Only authenticated
// users can request a unique reference. No client action may credit a wallet.
app.get('/api/wallet/vietqr-config',(_req,res)=>{
 const configured=!!(process.env.VIMO_BANK_ID&&process.env.VIMO_BANK_ACCOUNT&&process.env.VIMO_BANK_NAME);
 res.json({configured,verifiedPaymentsEnabled:false});
});
app.post('/api/wallet/vietqr-intent',(req,res)=>{
 const user=getSession(req);
 if(!user)return res.status(401).json({error:'Đăng nhập để tạo mã nạp ví.'});
 const {VIMO_BANK_ID,VIMO_BANK_ACCOUNT,VIMO_BANK_NAME}=process.env;
 if(!VIMO_BANK_ID||!VIMO_BANK_ACCOUNT||!VIMO_BANK_NAME)return res.status(503).json({error:'Chủ rạp chưa cấu hình VietQR.'});
 const amount=Number(req.body?.amount);
 if(!Number.isInteger(amount)||amount<10000||amount>1000000||amount%10000!==0)
  return res.status(400).json({error:'Chọn số tiền từ 10.000đ đến 1.000.000đ theo bước 10.000đ.'});
 const reference='VIMO'+crypto.randomBytes(5).toString('hex').toUpperCase();
 const id=crypto.randomUUID();const expiresAt=Date.now()+30*60*1000;
 depositRequests.set(reference,{id,userId:user.id,amount,expiresAt,status:'pending'});
 const qrUrl='https://img.vietqr.io/image/'+encodeURIComponent(VIMO_BANK_ID)+'-'+encodeURIComponent(VIMO_BANK_ACCOUNT)+'-compact2.png?'+
  new URLSearchParams({amount:String(amount),addInfo:reference,accountName:VIMO_BANK_NAME});
 res.json({id,reference,amount,qrUrl,expiresAt,status:'pending',
  notice:'QR chỉ tạo yêu cầu chuyển khoản. Ví sẽ KHÔNG được cộng tiền cho đến khi ngân hàng/cổng thanh toán xác minh.'});
});
app.get('/api/wallet/vietqr-intent/:reference',(req,res)=>{
 const user=getSession(req);if(!user)return res.status(401).json({error:'Bạn cần đăng nhập'});
 const entry=depositRequests.get(String(req.params.reference));
 if(!entry||entry.userId!==user.id)return res.status(404).json({error:'Không tìm thấy yêu cầu nạp'});
 res.json({id:entry.id,reference:req.params.reference,amount:entry.amount,status:entry.status,expiresAt:entry.expiresAt});
});

app.get('/api/health',(_req,res)=>res.json({ok:true,rooms:rooms.size,online:[...rooms.values()].reduce((s,r)=>s+r.participants.size,0)}));
app.get('/api/rooms',(_req,res)=>res.json([...rooms.values()].filter(r=>!r.password&&!r.isPrivate).map(r=>({id:r.id,name:r.name,category:r.category,online:r.participants.size,maxPeople:r.maxPeople}))));
const roomCreateTimes=new Map();
app.post('/api/rooms',(req,res)=>{
 const ip=req.ip||'unknown';if(Date.now()-(roomCreateTimes.get(ip)||0)<2000)return res.status(429).json({error:'Hãy đợi ít nhất 2 giây trước khi tạo phòng khác.'});
 if(rooms.size>=300)return res.status(503).json({error:'Đã đạt giới hạn 300 phòng thử nghiệm.'});
 const name=safeText(req.body?.name,50)||'Phòng của tôi';
 const password=safeText(req.body?.password,32);
 const options=validateRoomOptions(req.body);if(options.error)return res.status(400).json({error:options.error});
 let id;do{id=roomCode();}while(rooms.has(id));
 const room=newRoom(id,name,password,false,options);rooms.set(id,room);roomCreateTimes.set(ip,Date.now());res.status(201).json({ok:true,id,name,category:room.category,maxPeople:room.maxPeople,isPrivate:room.isPrivate,inviteToken:room.inviteToken,hasPassword:!!password});
});
// Upload an audio track and make it available to everyone in the room.
// This demo stores files on disk temporarily; proxy/CDN and storage quotas are needed in production.
app.post('/api/upload-audio', express.raw({type:()=>true, limit:MAX_AUDIO_BYTES}), (req,res)=>{
 const socketId=String(req.get('x-socket-id')||'');
 const token=String(req.get('x-upload-token')||'');
 const member=io.sockets.sockets.get(socketId);
 if(!member || !member.data.roomId || !member.data.uploadToken || member.data.uploadToken!==token)
  return res.status(403).json({error:'Hãy vào phòng trước khi tải nhạc lên.'});
 if(Date.now()-(member.data.uploadAt||0)<8000)return res.status(429).json({error:'Vui lòng đợi 8 giây trước khi tải bài khác.'});
 if(uploadedAudio.size>=MAX_UPLOADS)return res.status(503).json({error:'Kho nhạc tạm đã đầy. Hãy thử lại sau.'});
 let name='';try{name=decodeURIComponent(String(req.get('x-file-name')||''))}catch{return res.status(400).json({error:'Tên tệp không hợp lệ.'})}
 name=safeText(name,120);
 const ext=extname(name).toLowerCase();
 if(!supportedAudio.has(ext))return res.status(400).json({error:'Chỉ nhận MP3, M4A, WAV, OGG, AAC, FLAC.'});
 if(!Buffer.isBuffer(req.body)||req.body.length>MAX_AUDIO_BYTES || !looksLikeAudio(req.body,ext))
  return res.status(400).json({error:'File audio không hợp lệ hoặc vượt quá 20 MB.'});
 const file=`${crypto.randomUUID()}${ext}`;
 try{writeFileSync(join(uploadDir,file),req.body,{flag:'wx'});}catch{return res.status(500).json({error:'Không thể lưu tệp nhạc.'})}
 uploadedAudio.set(file,Date.now());member.data.uploadAt=Date.now();
 return res.status(201).json({ok:true,media:{type:'audio',url:`/api/uploads/${file}`,title:safeText(name.replace(/\.[^.]+$/,''),100)||'Nhạc tải lên'}});
});
// Photos are accepted only from an active room member with their per-connection upload token.
// Uploading only stages an image: credits are charged atomically in photo_submit.
app.post('/api/upload-photo',express.raw({type:()=>true,limit:PHOTO_MAX_BYTES}), (req,res)=>{
 const member=io.sockets.sockets.get(String(req.get('x-socket-id')||''));
 if (!member || !member.data.roomId || !member.data.uploadToken ||
     member.data.uploadToken!==String(req.get('x-upload-token')||''))
  return res.status(403).json({error:'Hãy vào phòng để gửi ảnh.'});
 if (Date.now()-(member.data.photoUploadAt||0)<4000)
  return res.status(429).json({error:'Vui lòng đợi trước khi tải thêm ảnh.'});
 if (photos.size>=MAX_PHOTO_FILES) return res.status(503).json({error:'Kho ảnh tạm đã đầy.'});
 if (!req.body?.length || req.body.length>PHOTO_MAX_BYTES) return res.status(400).json({error:'Ảnh tối đa 12 MB.'});
 const kind=detectImage(req.body);
 if (!kind) return res.status(400).json({error:'Chỉ hỗ trợ JPEG, PNG, WebP và GIF hợp lệ.'});
 const id=crypto.randomUUID();const file=id+kind.ext;
 try { writeFileSync(join(photoDir,file),req.body,{flag:'wx'}); }
 catch { return res.status(500).json({error:'Không lưu được ảnh.'}); }
 photos.set(id,{id,file,ownerToken:member.data.walletToken,roomId:member.data.roomId,createdAt:Date.now(),submitted:false});
 member.data.photoUploadAt=Date.now();
 res.status(201).json({ok:true,photoId:id,url:`/api/photo-uploads/${file}`});
});
app.use('/api/photo-uploads',express.static(photoDir,{index:false,fallthrough:false,
 setHeaders:(res,file)=>{
  const extension=extname(file).toLowerCase();
  res.setHeader('Content-Type',({'.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif'})[extension]||'application/octet-stream');
  res.setHeader('Cache-Control','private, max-age=3600');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
 }
}));
app.use('/api/uploads',express.static(uploadDir,{index:false,fallthrough:false,
 setHeaders:(res,path)=>{res.setHeader('Cache-Control','private, max-age=3600');res.setHeader('X-Content-Type-Options','nosniff');}
}));
// One-time admission after verified payment. A charged photo can never enter twice.
async function submitPhotoNow(socket,raw){
 const r=inRoom(socket);
 if(!r)return {ok:false,reason:'Chưa vào phòng'};
 const duration=Number(raw?.duration),price=photoCost(duration);
 if(price===null)return {ok:false,reason:`Thời lượng ảnh phải từ ${PHOTO_MIN_SECONDS} đến ${PHOTO_MAX_SECONDS} giây.`};
 const id=String(raw?.photoId||''),pending=photos.get(id);
 if(!pending||pending.submitted||pending.submitting||pending.ownerToken!==socket.data.walletToken||pending.roomId!==r.id)return {ok:false,reason:'Ảnh không hợp lệ hoặc đã sử dụng.'};
 if(!existsSync(join(photoDir,pending.file)))return {ok:false,reason:'Ảnh đã hết hạn, vui lòng tải lại.'};
 if(r.photoQueue.length+(r.photoReservations||0)>=MAX_PHOTO_QUEUE)return {ok:false,reason:'Hàng chờ ảnh đã đầy.'};
 pending.submitting=true;r.photoReservations=(r.photoReservations||0)+1;
 try{
  let balance;
  if(walletDb){
   if(!socket.data.accountId)return {ok:false,reason:'Cần đăng nhập tài khoản để gửi ảnh khi dùng ví PostgreSQL.'};
   const spent=await walletDb.spendForPhoto(socket.data.accountId,id,price,`Chiếu ảnh ${duration} giây · ${r.name}`);
   if(!spent.ok)return {ok:false,insufficient:!!spent.insufficient,balance:spent.balance,shortfall:spent.shortfall,reason:spent.reason};
   balance=spent.balance;
  }else{
   const w=walletOf(socket);
   if(!w||w.balance<price)return {ok:false,insufficient:true,balance:w?.balance||0,shortfall:price-(w?.balance||0),reason:`Cần ${price.toLocaleString('vi-VN')} xu.`};
   w.balance-=price;balance=w.balance;
   w.ledger.push({id:crypto.randomUUID(),type:'photo_spend',amount:-price,at:Date.now(),description:`Chiếu ảnh ${duration} giây · ${r.name}`});
   w.ledger=w.ledger.slice(-60);
  }
  pending.submitted=true;
  const member=r.participants.get(socket.id);
  const photo={id,url:`/api/photo-uploads/${pending.file}`,caption:safeText(raw?.caption,160),duration,cost:price,addedBy:member?.name||'Thành viên',createdAt:Date.now(),startedAt:null,endsAt:null};
  if(r.photoActive)r.photoQueue.push(photo);
  else{freezePlaybackForPhoto(r);r.photoActive=photo;photo.startedAt=Date.now();photo.endsAt=photo.startedAt+duration*1000;}
  changes(r);await sendWallet(socket);emitSystem(r,`${photo.addedBy} đã gửi ảnh ưu tiên (${duration} giây).`);
  return {ok:true,balance,photoId:id,cost:price};
 }catch(error){console.error('photo submit transaction failed',error);return {ok:false,reason:'Giao dịch ảnh tạm thời thất bại.'};}
 finally{pending.submitting=false;r.photoReservations--;}
}
async function resumePendingPhoto(userId){
 const intent=pendingPhotoRequests.get(userId);if(!intent)return;
 if(Date.now()-intent.createdAt>20*60*1000){pendingPhotoRequests.delete(userId);return;}
 const socket=[...io.sockets.sockets.values()].find(s=>s.data.accountId===userId&&s.data.roomId===intent.roomId);
 if(!socket)return; // Keep credited balance. User may submit the photo manually after reconnect.
 const result=await submitPhotoNow(socket,intent);
 if(result.ok){pendingPhotoRequests.delete(userId);socket.emit('photo_intent_status',{ok:true,photoId:intent.photoId,message:'Nạp sandbox được xác minh, ảnh đã vào hàng chiếu.'});}
 else if(!result.insufficient){pendingPhotoRequests.delete(userId);socket.emit('photo_intent_status',{ok:false,message:result.reason||'Ảnh chưa thể hiển thị. Tiền vẫn còn trong ví.'});}
}

io.on('connection', socket => {
 socket.data.roomId=null;
 const loggedIn=getSession({headers:{cookie:socket.handshake.headers.cookie||''}});
 socket.data.accountId=loggedIn?.id||null;
 socket.on('join_room',(raw,ack)=>{
  const id=safeText(raw?.roomId,16).toUpperCase();const r=rooms.get(id);
  if(!r)return err(ack,'Phòng không tồn tại. Hãy tạo phòng mới.');
  if(!canJoinRoom(r,{password:String(raw?.password??''),invite:String(raw?.invite||'')}))return err(ack,'Link mời hoặc mật khẩu phòng không hợp lệ.');
  if(r.participants.size>=r.maxPeople)return err(ack,`Phòng đã đủ ${r.maxPeople} người.`);
  if(inRoom(socket))release(socket);
  const used=new Set(participants(r).filter(p=>p.seat!==null).map(p=>p.seat));
  let seat=r.category==='cinema'?Array.from({length:r.maxPeople},(_,i)=>i).find(i=>!used.has(i)):null;seat??=null;
  const user=accounts.find(a=>a.id===socket.data.accountId);
  const p={id:socket.id,name:user?.username||safeText(raw?.name,22)||'Khách xem phim',seat,action:r.category==='dj'?'dance':'sit',dance:'bounce',zone:r.category==='dj'?'floor':'seat',stageSlot:null,skin:'default',accountId:socket.data.accountId||null,color:Math.floor(Math.random()*6),hair:0,accessory:0,pants:0,joinedAt:Date.now()};
  socket.data.uploadToken=crypto.randomBytes(24).toString('hex');
  // Unpredictable bearer token persists between reloads for THIS DEMO ONLY.
  // Real money requires authenticated accounts and a transactional database.
  const requested=String(raw?.walletToken||'');
  const walletToken=socket.data.accountId ? `account:${socket.data.accountId}` : (/^[a-f0-9]{64}$/.test(requested)&&wallets.has(requested)?requested:crypto.randomBytes(32).toString('hex'));
  if(!wallets.has(walletToken))wallets.set(walletToken,{balance:0,demoCredited:false,ledger:[],skins:[]});
  socket.data.walletToken=walletToken;
  r.participants.set(socket.id,p);socket.join(id);socket.data.roomId=id;
  if(!r.hostId)r.hostId=socket.id;
  success(ack,{room:snapshot(r),you:socket.id,uploadToken:socket.data.uploadToken,walletToken});
  sendWallet(socket);
  emitSystem(r,`${p.name} đã vào rạp`);changes(r);
 });
 socket.on('leave_room',()=>release(socket));
 socket.on('room_invite',(_,ack)=>{const r=inRoom(socket);if(!r||r.hostId!==socket.id)return err(ack,'Chỉ chủ phòng được lấy link mời.');success(ack,{inviteToken:r.inviteToken,isPrivate:r.isPrivate});});
  socket.on('choose_seat',(seat,ack)=>{
  const r=inRoom(socket);if(!r)return err(ack,'Chưa vào phòng');
  if(r.category!=='cinema'||!Number.isInteger(seat)||seat<0||seat>=r.maxPeople)return err(ack,'Ghế không hợp lệ');
  if(participants(r).some(p=>p.id!==socket.id&&p.seat===seat))return err(ack,'Ghế đã có người ngồi');
  const p=r.participants.get(socket.id);p.seat=seat;p.action='sit';p.zone='seat';p.stageSlot=null;changes(r);success(ack);
 });
 socket.on('avatar_action',(raw,ack)=>{
  const r=inRoom(socket);if(!r)return err(ack,'Chưa vào phòng');
  const action=raw?.action;
  if(!['sit','dance','wave','cheer'].includes(action))return err(ack,'Hành động không hợp lệ');
  const p=r.participants.get(socket.id);
  const zone=action==='dance'?(raw?.zone||p.zone||'floor'):'seat';
  if(action==='dance'&&!['floor','stage'].includes(zone))return err(ack,'Vị trí nhảy không hợp lệ');
  if(action==='dance'&&zone==='stage'){
   const place=p.zone==='stage'&&p.stageSlot!==null?p.stageSlot:stageSlot(participants(r),socket.id);
   if(place===null)return err(ack,'Sân khấu chỉ có 4 vị trí nhảy. Vui lòng đợi chỗ trống!');
   p.stageSlot=place;
  }else p.stageSlot=null;
  p.action=action;p.zone=zone;
  if(['bounce','shuffle','spin'].includes(raw?.dance))p.dance=raw.dance;
  changes(r);success(ack);
 });
 socket.on('avatar_color',(color)=>{const r=inRoom(socket);if(!r)return;const p=r.participants.get(socket.id);if(!Number.isInteger(color)||color<0||color>5)return;p.color=color;changes(r);});
 socket.on('appearance_update',(raw,ack)=>{
  const r=inRoom(socket);if(!r)return err(ack,'Chưa vào phòng');
  if(!raw||typeof raw!=='object')return err(ack,'Trang phục không hợp lệ');
  const allowed={color:5,hair:3,accessory:3,pants:4};
  const p=r.participants.get(socket.id);
  for(const [key,max] of Object.entries(allowed)) {
   if(raw[key]!==undefined){if(!Number.isInteger(raw[key])||raw[key]<0||raw[key]>max)return err(ack,'Trang phục không hợp lệ');p[key]=raw[key];}
  }
  changes(r);success(ack);
 });
 socket.on('skin_purchase',async(raw,ack)=>{
  const r=inRoom(socket);if(!r)return err(ack,'Chưa vào phòng');
  const skin=String(raw?.skin||'');
  if(!(skin in SKIN_PRICES))return err(ack,'Skin không hợp lệ');
  const w=walletOf(socket), p=r.participants.get(socket.id), cost=SKIN_PRICES[skin];
   if(walletDb){
    if(!socket.data.accountId)return err(ack,'Đăng nhập để mua skin.');
    try{const result=await walletDb.buySkin(socket.data.accountId,skin,cost);if(!result.ok)return err(ack,'Không đủ số dư mua skin.');p.skin=skin;changes(r);await sendWallet(socket);return success(ack,{skin,balance:result.balance});}catch(e){console.error(e);return err(ack,'Không thể mua skin lúc này.');}
   }
  if(!w)return err(ack,'Không tìm thấy ví');
  if(!Array.isArray(w.skins))w.skins=[];
  if(!w.skins.includes(skin)){
   if(w.balance<cost)return err(ack,'Ví chưa đủ xu cho skin này');
   w.balance-=cost;w.skins.push(skin);
   w.ledger.push({id:crypto.randomUUID(),type:'skin_spend',amount:-cost,at:Date.now(),description:'Mua skin '+skin});
  }
  p.skin=skin;changes(r);sendWallet(socket);success(ack,{skin,balance:w.balance});
 });
 socket.on('wallet_demo_topup',async(_,ack)=>{
  if(!inRoom(socket))return err(ack,'Chưa vào phòng');
  if(!demoWalletEnabled)return err(ack,'Chỉ có tín dụng thử trong môi trường local.');
  try{
   if(walletDb && socket.data.accountId){
    const result=await walletDb.creditDemoOnce(socket.data.accountId,DEMO_WALLET_CREDIT);
    if(!result.ok)return err(ack,result.reason);
    await sendWallet(socket);void resumePendingPhoto(socket.data.accountId);success(ack,{balance:result.balance});return;
   }
   const w=walletOf(socket);if(!w)return err(ack,'Không tìm thấy ví');
   if(w.demoCredited)return err(ack,'Ví đã nhận tín dụng dùng thử.');
   w.demoCredited=true;w.balance+=DEMO_WALLET_CREDIT;
   w.ledger.push({id:crypto.randomUUID(),type:'demo_credit',amount:DEMO_WALLET_CREDIT,at:Date.now(),description:'Xu dùng thử (không phải tiền thật)'});
   
   await sendWallet(socket);if(socket.data.accountId)void resumePendingPhoto(socket.data.accountId);success(ack,{balance:w.balance});
  }catch(error){console.error('demo wallet failed',error);err(ack,'Không cấp được xu demo.');}
 });
 socket.on('photo_submit',async(raw,ack)=>{
  if(Date.now()-(socket.data.photoSubmitAt||0)<2000)return err(ack,'Hãy đợi trước khi gửi ảnh tiếp.');
  socket.data.photoSubmitAt=Date.now();
  const result=await submitPhotoNow(socket,raw);
  if(result.ok){pendingPhotoRequests.delete(socket.data.accountId);return success(ack,result);}
  if(result.insufficient&&raw?.deferIfInsufficient&&socket.data.accountId){
   // Preserve the uploaded photo, price and room until signed webhook arrives.
   pendingPhotoRequests.set(socket.data.accountId,{photoId:raw.photoId,duration:raw.duration,caption:raw.caption,roomId:socket.data.roomId,createdAt:Date.now()});
   return typeof ack==='function'&&ack({ok:false,needsTopup:true,error:'Số dư chưa đủ. Hãy nạp thử qua modal hỗ trợ.',balance:result.balance,shortfall:result.shortfall});
  }
  err(ack,result.reason||'Không thể thêm ảnh vào hàng chiếu.');
 });
 socket.on('support_gift',(raw,ack)=>{
  const r=inRoom(socket);if(!r)return err(ack,'Chưa vào phòng');
  if(Date.now()-(socket.data.giftAt||0)<2500)return err(ack,'Hãy đợi 2 giây trước khi gửi quà tiếp');
  const gift=String(raw?.gift||'');if(!['heart','star','flower','confetti'].includes(gift))return err(ack,'Món quà không hợp lệ');
  const p=r.participants.get(socket.id);
  const item={id:crypto.randomUUID(),userId:socket.id,name:p.name,gift,message:safeText(raw?.message,90),time:Date.now()};
  socket.data.giftAt=Date.now();r.supportCount++;r.gifts.push(item);r.gifts=r.gifts.slice(-20);
  io.to(r.id).emit('gift_received',item);emitSystem(r,`${p.name} vừa gửi một món quà cổ vũ!`);changes(r);success(ack);
 });
 socket.on('chat_send',(v,ack)=>{
  const r=inRoom(socket);if(!r)return err(ack,'Chưa vào phòng');
  if(Date.now()-(socket.data.chatAt||0)<750)return err(ack,'Bạn đang gửi tin quá nhanh');
  const text=safeText(v,240);if(!text)return err(ack,'Tin nhắn trống');
  socket.data.chatAt=Date.now();const p=r.participants.get(socket.id);
  const msg={id:crypto.randomUUID(),userId:socket.id,name:p.name,text,time:Date.now()};
  r.messages.push(msg);r.messages=r.messages.slice(-80);io.to(r.id).emit('chat_message',msg);success(ack);
 });
 socket.on('reaction',(emoji)=>{
  const r=inRoom(socket);if(!r)return;
  if(Date.now()-(socket.data.reactAt||0)<1200)return;
  if(!['❤️','🔥','👏','🎉','😂','🕺'].includes(emoji))return;
  socket.data.reactAt=Date.now();io.to(r.id).emit('reaction',{id:crypto.randomUUID(),userId:socket.id,emoji,time:Date.now()});
 });
 // WebRTC signaling is relayed only among members of the same Music Box.
 socket.on('karaoke_signal',(raw)=>{
  const r=inRoom(socket),target=String(raw?.to||'');
  if(!r||r.category!=='musicbox'||!r.participants.has(target)||target===socket.id)return;
  if(![socket.id,target].includes(r.karaokeSinger))return;
  if(!['offer','answer','ice'].includes(raw?.type))return;
  if(!raw.data||typeof raw.data!=='object')return;
  const payload=JSON.stringify(raw.data);if(payload.length>12000)return;
  io.to(target).emit('karaoke_signal',{from:socket.id,type:raw.type,data:raw.data});
 });
 socket.on('karaoke_enqueue',(_,ack)=>{
  const r=inRoom(socket);if(!r)return err(ack,'Chưa vào phòng');
  if(r.category!=='musicbox')return err(ack,'Chỉ dùng trong Music Box');
  if(r.karaokeQueue.includes(socket.id)||r.karaokeSinger===socket.id)return err(ack,'Bạn đã có trong hàng chờ hát');
  r.karaokeQueue.push(socket.id);if(!r.karaokeSinger)r.karaokeSinger=nextSinger(r.karaokeQueue,r.participants.keys());
  void enforceKaraokeMic(r);changes(r);success(ack);
 });
 socket.on('karaoke_leave',(_,ack)=>{
  const r=inRoom(socket);if(!r||r.category!=='musicbox')return err(ack,'Không thuộc Music Box');
  r.karaokeQueue=r.karaokeQueue.filter(id=>id!==socket.id);if(r.karaokeSinger===socket.id)r.karaokeSinger=nextSinger(r.karaokeQueue,r.participants.keys());
  void enforceKaraokeMic(r);changes(r);success(ack);
 });
 socket.on('karaoke_next',(_,ack)=>{
  const r=inRoom(socket);if(!r||r.category!=='musicbox')return err(ack,'Không thuộc Music Box');
  if(r.hostId!==socket.id)return err(ack,'Chỉ chủ phòng chuyển lượt hát');
  const current=r.karaokeSinger;r.karaokeQueue=r.karaokeQueue.filter(id=>id!==current);r.karaokeSinger=nextSinger(r.karaokeQueue,r.participants.keys());
  void enforceKaraokeMic(r);changes(r);success(ack);
 });
 socket.on('queue_add',(raw,ack)=>{
  const r=inRoom(socket);if(!r)return err(ack,'Chưa vào phòng');
  if(r.queue.length>=30)return err(ack,'Hàng chờ đã đầy');
  const m=normalizeMedia(raw);if(!m)return err(ack,'Chỉ hỗ trợ YouTube hoặc link .mp4 / .webm / .m3u8 công khai.');
  const p=r.participants.get(socket.id);
  if(r.queue.filter(x=>x.addedById===socket.id).length>=3)return err(ack,'Mỗi người chỉ được chờ tối đa 3 video');
  const entry={...m,id:crypto.randomUUID(),addedBy:p.name,addedById:socket.id,votes:0,voters:[],addedAt:Date.now()};r.queue.push(entry);changes(r);success(ack,{id:entry.id});
 });
 socket.on('queue_vote',(raw,ack)=>{
  const r=inRoom(socket);if(!r)return err(ack,'Chưa vào phòng');
  if(Date.now()-(socket.data.queueVoteAt||0)<650)return err(ack,'Bạn đang bình chọn quá nhanh');
  const entry=r.queue.find(m=>m.id===raw?.id);if(!entry)return err(ack,'Video không còn trong hàng chờ');
  socket.data.queueVoteAt=Date.now();
  entry.voters=Array.isArray(entry.voters)?entry.voters:[];
  const voter=socket.data.accountId||socket.id;
  if(entry.voters.includes(voter))entry.voters=entry.voters.filter(id=>id!==voter);
  else entry.voters.push(voter);
  entry.votes=entry.voters.length;
  // Sort by community votes; stable sorting keeps original order on ties.
  r.queue.sort(queueOrder);
  changes(r);success(ack);
 });
 socket.on('queue_manage',(raw,ack)=>{
  const r=inRoom(socket);if(!r)return err(ack,'Chưa vào phòng');
  const index=r.queue.findIndex(x=>x.id===raw?.id);if(index<0)return err(ack,'Bài hát không còn trong hàng chờ');
  const command=raw?.command;
  if(command==='remove'){
   if(r.hostId!==socket.id && r.queue[index].addedById!==socket.id)return err(ack,'Bạn chỉ có thể xóa bài mình thêm');
   r.queue.splice(index,1);
  }else return err(ack,'Thứ tự hàng chờ được tính tự động theo vote.');
  changes(r);success(ack);
 });
 socket.on('media_control',(raw,ack)=>{
  const r=inRoom(socket);if(!r)return err(ack,'Chưa vào phòng');
  if(r.hostId!==socket.id)return err(ack,'Chỉ chủ phòng được điều khiển nhạc / phim');
  const cmd=raw?.command;
   if(r.photoActive&&['next','play','pause','seek','load'].includes(cmd))return err(ack,'Ảnh ưu tiên đang chiếu. Video sẽ tiếp tục khi hết ảnh.');
  if(cmd==='next') nextMedia(r);
  else if(cmd==='play'||cmd==='pause') {r.media.position=elapsedMedia(r);r.media.playing=cmd==='play';r.media.updatedAt=Date.now();}
  else if(cmd==='seek') {const sec=Number(raw?.position);if(!Number.isFinite(sec)||sec<0||sec>86400)return err(ack,'Thời gian không hợp lệ');r.media.position=sec;r.media.updatedAt=Date.now();}
  else if(cmd==='load') {const m=normalizeMedia(raw?.media);if(!m)return err(ack,'Link video không hợp lệ');r.media={...m,position:0,playing:true,updatedAt:Date.now()};r.votes.clear();}
  else if(cmd==='duration') {const seconds=Number(raw?.duration);if(!Number.isFinite(seconds)||seconds<=0||seconds>86400)return err(ack,'Thời lượng không hợp lệ');r.media.duration=Math.round(seconds);}
  else if(cmd==='disco') r.disco=!!raw?.enabled;
  else if(cmd==='stage_theme') {if(!['neon','sunset','galaxy'].includes(raw?.theme))return err(ack,'Giao diện sân khấu không hợp lệ');r.stageTheme=raw.theme;}
  else if(cmd==='bpm') {const bpm=Number(raw?.bpm);if(!Number.isInteger(bpm)||bpm<60||bpm>200)return err(ack,'BPM phải từ 60 tới 200');r.bpm=bpm;}
  else return err(ack,'Lệnh không hợp lệ');
  changes(r);success(ack);
 });
 socket.on('vote_skip',(_,ack)=>{
  const r=inRoom(socket);if(!r)return err(ack,'Chưa vào phòng');
  const voter=socket.data.accountId||socket.id;
  if(r.votes.has(voter))r.votes.delete(voter);else r.votes.add(voter);const need=votesNeeded(r.participants.size);
  if(r.votes.size>=need){nextMedia(r);emitSystem(r,'Bỏ phiếu thành công! Đã chuyển bài.');}
  changes(r);success(ack);
 });
 socket.on('kick_user',(targetId,ack)=>{
  const r=inRoom(socket);if(!r)return err(ack,'Chưa vào phòng');
  if(r.hostId!==socket.id)return err(ack,'Chỉ chủ phòng mới được mời người khác ra khỏi rạp');
  if(targetId===socket.id)return err(ack,'Không thể tự mời mình ra');
  const target=io.sockets.sockets.get(targetId);
  if(!target||target.data.roomId!==r.id)return err(ack,'Thành viên không còn trong phòng');
  target.emit('kicked','Bạn đã được chủ phòng mời ra khỏi rạp');release(target);success(ack);
 });
 socket.on('disconnect',()=>release(socket));
});
setInterval(()=>{for(const [id,p] of photos){
 if(Date.now()-p.createdAt>PHOTO_TTL){photos.delete(id);try{unlinkSync(join(photoDir,p.file))}catch{}}
}},60*60*1000).unref();
setInterval(()=>{for(const r of rooms.values()){
 if(r.photoActive&&Date.now()>=r.photoActive.endsAt)advancePhoto(r);
}},500).unref();
setInterval(()=>{for(const [file,time] of uploadedAudio){if(Date.now()-time>UPLOAD_TTL){uploadedAudio.delete(file);try{unlinkSync(join(uploadDir,file))}catch{}}}},60*60*1000).unref();
setInterval(()=>{for(const r of rooms.values()){
 if(r.participants.size===0)continue;
 if(r.media.type==='demo'&&r.media.playing&&elapsedMedia(r)>=240){nextMedia(r);emitRoom(r);}
 else io.to(r.id).emit('media_sync',mediaSnapshot(r));
}},5000).unref();
const dist=resolve('dist');
if(process.env.SERVE_STATIC==='true' && existsSync(join(dist,'index.html'))) {
 app.use(express.static(dist));app.get('/{*splat}',(_req,res)=>res.sendFile(join(dist,'index.html')));
}
server.listen(port,()=>console.log(`🎬 HộiRoom API: http://localhost:${port}`));
