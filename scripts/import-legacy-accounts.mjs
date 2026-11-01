// Optional one-time import of existing accounts.json into PostgreSQL.
import 'dotenv/config';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
const path=resolve('auth-data/accounts.json');
if(!process.env.DATABASE_URL)throw Error('Cần DATABASE_URL để import');
if(!existsSync(path))throw Error('Không tìm thấy auth-data/accounts.json (đường dẫn dữ liệu cũ)');
const accounts=JSON.parse(readFileSync(path,'utf8'));
if(!Array.isArray(accounts))throw Error('Dữ liệu accounts.json không hợp lệ');
const {Client}=await import('pg');
const db=new Client({connectionString:process.env.DATABASE_URL});
await db.connect();
let count=0;
try{
 await db.query('BEGIN');
 for(const a of accounts){
  if(!/^[A-Za-z0-9_]{3,24}$/.test(a.username||'')||!/^[a-f0-9]{32}$/i.test(a.salt||'')||!/^[a-f0-9]{128}$/i.test(a.hash||''))throw Error('Tài khoản cũ thiếu hash/salt hợp lệ: '+String(a.username));
  const r=await db.query('INSERT INTO auth_accounts(id,username,salt,password_hash,created_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING id',[a.id,a.username,a.salt,a.hash,new Date(a.createdAt||Date.now())]);
  count+=r.rowCount;
 }
 await db.query('COMMIT');
 console.log('Đã import '+count+'/'+accounts.length+' tài khoản, không thay đổi hash/mật khẩu.');
}catch(e){await db.query('ROLLBACK');throw e;}finally{await db.end();}
