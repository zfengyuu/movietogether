// PostgreSQL-backed wallet. Every balance mutation and ledger entry is part of a transaction.
// No real-money functionality is enabled by this module: deploy still requires merchant onboarding,
// account/session hardening, reconciliation, backups and production payment sign-off.
import crypto from 'node:crypto';
import { matchIncomingPayment } from '../shared/payments.js';

const round = row => ({balance:Number(row.balance),demoCredited:row.demo_credited,skins:row.skins||[]});

export function makeWalletStore(pool){
 const transaction=async fn=>{
  const client=await pool.connect();
  try {await client.query('BEGIN');const result=await fn(client);await client.query('COMMIT');return result;}
  catch(e){try{await client.query('ROLLBACK')}catch{}throw e;}
  finally{client.release();}
 };
 const ensure=async(c,userId)=>{
  await c.query('INSERT INTO wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',[userId]);
  const {rows}=await c.query('SELECT user_id,balance,demo_credited,skins FROM wallets WHERE user_id=$1 FOR UPDATE',[userId]);
  return rows[0];
 };
 return {
  async getWallet(userId){
   return transaction(async c=>{
    const wallet=round(await ensure(c,userId));
    const ledger=await c.query('SELECT id,type,amount,created_at,description FROM wallet_ledger WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100',[userId]);
    return {...wallet,ledger:ledger.rows.map(x=>({id:x.id,type:x.type,amount:Number(x.amount),at:new Date(x.created_at).getTime(),description:x.description}))};
   });
  },
  async getOrders(userId){
   const {rows}=await pool.query('SELECT id,amount,code,status,created_at,paid_at FROM topup_orders WHERE user_id=$1 ORDER BY created_at DESC LIMIT 10',[userId]);
   return rows.map(o=>({id:o.id,amount:Number(o.amount),code:o.code,status:o.status,createdAt:new Date(o.created_at).getTime(),paidAt:o.paid_at?new Date(o.paid_at).getTime():null}));
  },
  async createTopupOrder(userId,amount,code){
   return transaction(async c=>{
    await ensure(c,userId);
    const id=crypto.randomUUID();
    await c.query('INSERT INTO topup_orders(id,user_id,amount,code,status) VALUES($1,$2,$3,$4,$5)',[id,userId,amount,code,'pending']);
    return {id,userId,amount,code,status:'pending',createdAt:Date.now()};
   });
  },
  async creditVerifiedPayment(event,expectedBankAccount){
   const txId=String(event?.id??'');
   if(!/^\d+$/.test(txId))return {ok:false,reason:'Invalid bank transaction id'};
   return transaction(async c=>{
    const duplicate=await c.query('SELECT order_id FROM bank_transactions WHERE provider_tx_id=$1',[txId]);
    if(duplicate.rowCount)return {ok:true,duplicate:true};
    // Enforce incoming direction + exact receiving account + integer amount before touching funds.
    if(event?.transferType!=='in'||String(event?.accountNumber??'')!==String(expectedBankAccount))return {ok:false,reason:'Incorrect recipient/direction'};
    const amount=Number(event?.transferAmount);
    if(!Number.isSafeInteger(amount)||amount<=0)return {ok:false,reason:'Invalid amount'};
    const {rows}=await c.query("SELECT id,user_id,amount,code,status FROM topup_orders WHERE status='pending' AND amount=$1 AND created_at > NOW()-INTERVAL '24 hours' FOR UPDATE",[amount]);
    const order=rows.find(o=>matchIncomingPayment(event,{...o,amount:Number(o.amount)},expectedBankAccount));
    if(!order)return {ok:false,reason:'No exact matching pending order'};
    const inserted=await c.query('INSERT INTO bank_transactions(provider_tx_id,order_id,amount) VALUES($1,$2,$3) ON CONFLICT (provider_tx_id) DO NOTHING RETURNING provider_tx_id',[txId,order.id,amount]);
    if(!inserted.rowCount)return {ok:true,duplicate:true};
    await ensure(c,order.user_id);
    await c.query('UPDATE wallets SET balance=balance+$1 WHERE user_id=$2',[amount,order.user_id]);
    await c.query("UPDATE topup_orders SET status='paid',paid_at=NOW(),provider_tx_id=$1 WHERE id=$2",[txId,order.id]);
    await c.query('INSERT INTO wallet_ledger(id,user_id,type,amount,description,order_id) VALUES($1,$2,$3,$4,$5,$6)',[crypto.randomUUID(),order.user_id,'verified_topup',amount,`Nạp sandbox đã xác minh · ${order.code}`,order.id]);
    return {ok:true,duplicate:false,userId:order.user_id,amount,orderId:order.id};
   });
  },
  async spendForPhoto(userId,photoId,amount,description){
   return transaction(async c=>{
    const wallet=await ensure(c,userId);
    const exists=await c.query("SELECT id FROM wallet_ledger WHERE photo_id=$1 AND type='photo_spend'",[photoId]);
    if(exists.rowCount)return {ok:false,reason:'Ảnh đã được thanh toán.',duplicate:true,balance:Number(wallet.balance)};
    if(Number(wallet.balance)<amount)return {ok:false,insufficient:true,balance:Number(wallet.balance),shortfall:amount-Number(wallet.balance)};
    await c.query('UPDATE wallets SET balance=balance-$1 WHERE user_id=$2',[amount,userId]);
    await c.query('INSERT INTO wallet_ledger(id,user_id,type,amount,description,photo_id) VALUES($1,$2,$3,$4,$5,$6)',[crypto.randomUUID(),userId,'photo_spend',-amount,description,photoId]);
    return {ok:true,balance:Number(wallet.balance)-amount};
   });
  },
  async creditDemoOnce(userId,amount){
   return transaction(async c=>{
    const wallet=await ensure(c,userId);
    if(wallet.demo_credited)return {ok:false,reason:'Đã nhận lượt demo.'};
    await c.query('UPDATE wallets SET balance=balance+$1,demo_credited=TRUE WHERE user_id=$2',[amount,userId]);
    await c.query('INSERT INTO wallet_ledger(id,user_id,type,amount,description) VALUES($1,$2,$3,$4,$5)',[crypto.randomUUID(),userId,'demo_credit',amount,'Xu dùng thử — không phải tiền thật']);
    return {ok:true,balance:Number(wallet.balance)+amount};
   });
  },
  async buySkin(userId,skin,cost){
   return transaction(async c=>{
    const wallet=await ensure(c,userId);
    if((wallet.skins||[]).includes(skin))return {ok:true,alreadyOwned:true,balance:Number(wallet.balance),skins:wallet.skins};
    if(Number(wallet.balance)<cost)return {ok:false,insufficient:true,balance:Number(wallet.balance)};
    await c.query('UPDATE wallets SET balance=balance-$1,skins=array_append(skins,$2) WHERE user_id=$3',[cost,skin,userId]);
    await c.query('INSERT INTO wallet_ledger(id,user_id,type,amount,description) VALUES($1,$2,$3,$4,$5)',[crypto.randomUUID(),userId,'skin_spend',-cost,`Skin ${skin}`]);
    return {ok:true,balance:Number(wallet.balance)-cost,skins:[...(wallet.skins||[]),skin]};
   });
  },
  async health(){await pool.query('SELECT 1 FROM wallets LIMIT 1');return true;},
  async close(){await pool.end();}
 };
}
export async function openPgWallet(url){
 const {Pool}=await import('pg');
 const pool=new Pool({connectionString:url,max:10,connectionTimeoutMillis:7000});
 const store=makeWalletStore(pool);
 try{await store.health();return store;}catch(e){await pool.end();throw Error('Chưa chạy migration PostgreSQL (npm run db:migrate) hoặc DB không kết nối được: '+e.message);}
}
