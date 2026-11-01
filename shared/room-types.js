// Single source of truth for publicly selectable room categories.
export const ROOM_TYPES = Object.freeze({
 cinema: {label:'Rạp chiếu phim',min:2,max:100,seatLayout:true},
 dj: {label:'Sàn nhảy DJ 3D',min:2,max:100,seatLayout:false},
 karaoke: {label:'Music Box karaoke',min:2,max:8,seatLayout:false},
});
export function roomConfiguration(raw={}){
 const category=String(raw.category||'cinema');
 const rule=ROOM_TYPES[category];
 if(!rule)return {ok:false,error:'Loại phòng không được hỗ trợ.'};
 const capacity=Number(raw.capacity??rule.max);
 if(!Number.isInteger(capacity)||capacity<rule.min||capacity>rule.max)return {ok:false,error:`${rule.label}: chọn từ ${rule.min} đến ${rule.max} người.`};
 const privateRoom=raw.privateRoom===true;
 return {ok:true,category,capacity,privateRoom};
}
export function inviteMatches(room,token){
 if(!room.privateRoom)return true;
 return typeof token==='string'&&/^[a-f0-9]{48}$/.test(token)&&token===room.inviteToken;
}
export function seatAllowed(room,seat){
 return room.category==='cinema'&&Number.isInteger(seat)&&seat>=0&&seat<room.capacity;
}
export function mayRelayKaraoke(room,origin,target){
 return room.category==='karaoke'&&room.participants.has(origin)&&room.participants.has(target)&&origin!==target;
}
