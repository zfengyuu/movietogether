import React,{useState} from 'react';
import {ROOM_CATEGORIES} from '../../shared/rooms.js';

export default function RoomCreateForm({onCreate,onCancel,busy=false}){
 const [name,setName]=useState('Hội của chúng mình'),[category,setCategory]=useState('cinema');
 const [maxPeople,setMaxPeople]=useState(12),[privateRoom,setPrivateRoom]=useState(true),[password,setPassword]=useState('');
 const settings=ROOM_CATEGORIES[category];
 const chooseCategory=category=>{setCategory(category);setMaxPeople(ROOM_CATEGORIES[category].defaultSize)};
 return <div className="room-create-form">
  <label>Loại phòng</label><div className="room-type-picker">{[
   ['cinema','🎬','Cinema','Xem phim chung'],['dj','🎧','DJ Club','Sàn nhảy 3D'],['musicbox','🎤','Music Box','Karaoke & mic']
  ].map(([value,emoji,title,desc])=><button key={value} type="button" className={category===value?'active':''} onClick={()=>chooseCategory(value)}><span>{emoji}</span><strong>{title}</strong><small>{desc}</small></button>)}</div>
  <label>Tên phòng</label><input value={name} onChange={e=>setName(e.target.value)} maxLength={50} placeholder="Tên phòng của bạn"/>
  <label>Số người tối đa ({settings.min}–{settings.max})</label>
  <input type="number" inputMode="numeric" min={settings.min} max={settings.max} step="1" value={maxPeople} onChange={e=>setMaxPeople(Number(e.target.value))}/>
  <label className="room-private-toggle"><input type="checkbox" checked={privateRoom} onChange={e=>setPrivateRoom(e.target.checked)}/><span>🔒 Phòng riêng — chỉ ai có link mời mới vào được</span></label>
  {privateRoom&&<div className="room-private-note">Link mời có mã ngẫu nhiên bảo mật. Không hiển thị trong danh sách phòng công cộng.</div>}
  <label>Mật khẩu bổ sung (không bắt buộc)</label><input type="password" maxLength={32} autoComplete="off" placeholder="Có thể bỏ trống" value={password} onChange={e=>setPassword(e.target.value)}/>
  <button className="cta" disabled={busy||!name.trim()||!Number.isInteger(maxPeople)||maxPeople<settings.min||maxPeople>settings.max} onClick={()=>onCreate({name,category,maxPeople,isPrivate:privateRoom,password})}>✨ Tạo {settings.label}</button>
  <button className="secondary-cta" onClick={onCancel}>Quay lại</button>
 </div>;
}
