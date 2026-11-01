import 'dotenv/config';
import {readFileSync} from 'node:fs';
const url=process.env.DATABASE_URL;
if(!url)throw Error('Cần DATABASE_URL để chạy migration');
const {Client}=await import('pg');
const client=new Client({connectionString:url});
await client.connect();
try{
 await client.query(readFileSync(new URL('../db/001_wallet.sql',import.meta.url),'utf8'));
 console.log('PostgreSQL wallet migration OK');
}finally{await client.end();}
