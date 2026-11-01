import 'dotenv/config';
import {readFileSync} from 'node:fs';
const url=process.env.DATABASE_URL;
if(!url)throw Error('Cần DATABASE_URL để chạy migration');
const {Client}=await import('pg');
const client=new Client({connectionString:url});
await client.connect();
try{
 for(const file of ['001_wallet.sql','002_auth.sql']) {
  await client.query(readFileSync(new URL('../db/'+file,import.meta.url),'utf8'));
  console.log('PostgreSQL migration complete: '+file);
 }
}finally{await client.end();}
