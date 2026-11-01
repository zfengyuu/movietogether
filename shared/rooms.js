// Domain rules shared by realtime backend, UI, and tests.
export const ROOM_CATEGORIES = Object.freeze({
 cinema:{label:'Cinema 3D',min:2,max:100,defaultSize:30},
 dj:{label:'DJ Club 3D',min:2,max:100,defaultSize:50},
 musicbox:{label:'Music Box Karaoke',min:2,max:20,defaultSize:8},
});
export function validateRoomOptions(raw={}) {
 const category=String(raw.category||'cinema');
 const limits=ROOM_CATEGORIES[category];
 if(!limits)return {error:'Loại phòng không hợp lệ'};
 const maxPeople=Number(raw.maxPeople ?? limits.defaultSize);
 if(!Number.isInteger(maxPeople)||maxPeople<limits.min||maxPeople>limits.max)return {error:`Sức chứa phải từ ${limits.min} đến ${limits.max} người`};
 return {category,maxPeople,isPrivate:raw.isPrivate===true};
}
export function canJoinRoom(room,{invite='',password=''}) {
 if(room.isPrivate && (!invite || invite!==room.inviteToken))return false;
 if(room.password && password!==room.password)return false;
 return true;
}
export function soundcloudTrack(raw) {
 try{
  const u=new URL(String(raw));
  if(u.protocol!=='https:' || !['soundcloud.com','www.soundcloud.com','on.soundcloud.com'].includes(u.hostname.toLowerCase()))return null;
  if(u.username||u.password||u.pathname==='/'||u.href.length>800)return null;
  return u.href;
 }catch{return null;}
}
export function nextSinger(queue,participants) {
 const connected=new Set(participants);
 return queue.find(id=>connected.has(id))||null;
}
