import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeWalletStore} from '../server/wallet-store.js';
const sql=readFileSync(new URL('../db/001_wallet.sql',import.meta.url),'utf8');

test('SQL schema enforces nonnegative wallet and unique paid photo and provider transaction',()=>{
 assert.match(sql,/balance BIGINT NOT NULL DEFAULT 0 CHECK\(balance >= 0\)/);
 assert.match(sql,/provider_tx_id TEXT PRIMARY KEY/);
 assert.match(sql,/photo_id UUID UNIQUE/);
 assert.match(sql,/order_id UUID UNIQUE/);
});

class FakePool{
 constructor(){this.wallets=new Map();this.ledger=[];this.orders=[];this.transactions=new Map();this.calls=[];}
 async connect(){return {query:(q,args)=>this.query(q,args),release:()=>{}};}
 async query(q,args=[]){
  this.calls.push(q);
  const ok=(rows=[])=>({rows,rowCount:rows.length});
  if(['BEGIN','COMMIT','ROLLBACK'].includes(q))return ok();
  if(q.startsWith('INSERT INTO wallets')){if(!this.wallets.has(args[0]))this.wallets.set(args[0],{user_id:args[0],balance:0,demo_credited:false});return ok();}
  if(q.startsWith('SELECT user_id,balance'))return ok([this.wallets.get(args[0])]);
  if(q.startsWith('SELECT id,type,amount,created_at'))return ok(this.ledger.filter(l=>l.user_id===args[0]).map(l=>({...l,created_at:new Date()})));
  if(q.startsWith('SELECT id,amount,code,status,created_at'))return ok(this.orders.filter(o=>o.user_id===args[0]));
  if(q.startsWith('INSERT INTO topup_orders')){this.orders.push({id:args[0],user_id:args[1],amount:args[2],code:args[3],status:args[4],created_at:new Date()});return ok();}
  if(q.startsWith('SELECT order_id FROM bank_transactions'))return ok(this.transactions.has(args[0])?[{order_id:this.transactions.get(args[0])}]:[]);
  if(q.startsWith('SELECT id,user_id,amount,code,status FROM topup_orders'))return ok(this.orders.filter(o=>o.status==='pending'&&o.amount===args[0]));
  if(q.startsWith('INSERT INTO bank_transactions')){if(this.transactions.has(args[0]))return ok([]);this.transactions.set(args[0],args[1]);return ok([{provider_tx_id:args[0]}]);}
  if(q.startsWith('UPDATE topup_orders')){const o=this.orders.find(o=>o.id===args[1]);o.status='paid';o.paid_at=new Date();return ok();}
  if(q.startsWith('SELECT id FROM wallet_ledger'))return ok(this.ledger.filter(l=>l.photo_id===args[0]&&l.type==='photo_spend'));
  if(q.startsWith('UPDATE wallets SET balance=balance+')){this.wallets.get(args[1]).balance+=args[0];return ok();}
  if(q.startsWith('UPDATE wallets SET balance=balance-')){this.wallets.get(args[1]).balance-=args[0];return ok();}
  if(q.startsWith('UPDATE wallets SET balance=balance+')){this.wallets.get(args[1]).balance+=args[0];return ok();}
  if(q.startsWith('UPDATE wallets SET balance=balance+'))return ok();
  if(q.startsWith('INSERT INTO wallet_ledger')){this.ledger.push({id:args[0],user_id:args[1],type:args[2],amount:args[3],description:args[4],photo_id:q.includes('photo_id')?args[5]:null});return ok();}
  throw Error('Mock query not supported: '+q);
 }
}
const userid='e11c8ccb-e70f-4b54-bdc2-fb49b6295cfb';
test('signed bank event credits exactly one account once, and cannot double-charge same photo',async()=>{
 const db=new FakePool(),store=makeWalletStore(db);
 const order=await store.createTopupOrder(userid,20000,'VIMOF00ABCEEDD11');
 const event={id:731,accountNumber:'TEST-ACCOUNT',code:order.code,content:order.code,transferType:'in',transferAmount:20000};
 assert.equal((await store.creditVerifiedPayment({...event,transferAmount:21000},'TEST-ACCOUNT')).ok,false);
 assert.equal((await store.getWallet(userid)).balance,0);
 const paid=await store.creditVerifiedPayment(event,'TEST-ACCOUNT');assert.equal(paid.ok,true);
 assert.equal((await store.creditVerifiedPayment(event,'TEST-ACCOUNT')).duplicate,true);
 assert.equal((await store.getWallet(userid)).balance,20000);
 const photoId='7c53b20e-4b85-40cd-adcb-3503d5af599b';
 const first=await store.spendForPhoto(userid,photoId,10000,'Ảnh 10 giây');assert.equal(first.ok,true);
 assert.equal((await store.spendForPhoto(userid,photoId,10000,'Replay')).duplicate,true);
 assert.equal((await store.spendForPhoto(userid,'aa53b20e-4b85-40cd-adcb-3503d5af599b',11000,'Overdraft')).insufficient,true);
 assert.equal((await store.getWallet(userid)).balance,10000);
 assert.equal(db.ledger.filter(x=>x.type==='photo_spend').length,1);
 assert.ok(db.calls.includes('BEGIN'));assert.ok(db.calls.includes('COMMIT'));
});

test('frontend has insufficient balance modal + server-owned pending intent',()=>{
 const app=readFileSync(new URL('../src/App.jsx',import.meta.url),'utf8');
 const server=readFileSync(new URL('../server/index.js',import.meta.url),'utf8');
 assert.match(app,/deferIfInsufficient:true/);
 assert.match(app,/setTopupOpen\(true\)/);
 assert.match(app,/photo_intent_status/);
 assert.match(server,/pendingPhotoRequests\.set/);
 assert.match(server,/resumePendingPhoto\(receipt\.userId\)/);
 assert.match(server,/await walletDb\.spendForPhoto/);
});
