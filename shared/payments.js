import crypto from 'node:crypto';

export const TOPUP_MIN = 10_000;
export const TOPUP_MAX = 1_000_000;
export const normalizeTopupAmount = value => {
 const n = Number(value);
 return Number.isSafeInteger(n) && n >= TOPUP_MIN && n <= TOPUP_MAX && n % 1000 === 0 ? n : null;
};
export function createPaymentCode() { return 'VIMO' + crypto.randomBytes(6).toString('hex').toUpperCase(); }
export function verifySePaySignature(body, timestamp, signature, secret, now=Date.now()) {
 if (!Buffer.isBuffer(body) || !secret || !/^\d{10}$/.test(String(timestamp))) return false;
 if (Math.abs(now - Number(timestamp)*1000) > 300_000) return false;
 if (!/^sha256=[0-9a-f]{64}$/i.test(String(signature))) return false;
 const want='sha256='+crypto.createHmac('sha256',secret).update(String(timestamp)+'.').update(body).digest('hex');
 const a=Buffer.from(want),b=Buffer.from(String(signature).toLowerCase());
 return a.length===b.length && crypto.timingSafeEqual(a,b);
}
export function matchIncomingPayment(event, order, expectedBankAccount) {
 if (!order || order.status!=='pending') return false;
 if (event?.transferType!=='in' || String(event?.accountNumber??'')!==String(expectedBankAccount)) return false;
 if (!Number.isSafeInteger(Number(event?.transferAmount)) || Number(event.transferAmount)!==order.amount) return false;
 const text=[String(event?.code||''),String(event?.content||'')].join(' ').toUpperCase();
 return new RegExp(`(?:^|[^A-Z0-9])${order.code}(?:$|[^A-Z0-9])`).test(text);
}
export function applyVerifiedPayment(state, event, expectedBankAccount, at=Date.now()) {
 if(!event || !/^\d+$/.test(String(event.id??'')))return {ok:false,reason:'Invalid transaction id'};
 const id=String(event.id);
 if(state.transactions[id])return {ok:true,duplicate:true};
 const order=Object.values(state.orders).find(o=>matchIncomingPayment(event,o,expectedBankAccount));
 if(!order)return {ok:false,reason:'No exact matching pending order'};
 const wallet=state.wallets[order.userId];if(!wallet)return {ok:false,reason:'Missing wallet'};
 order.status='paid';order.paidAt=at;order.transactionId=id;
 wallet.balance += order.amount;
 wallet.ledger.push({id,type:'verified_topup',amount:order.amount,at,description:`Nạp tiền (sandbox) · ${order.code}`});
 wallet.ledger=wallet.ledger.slice(-100);
 state.transactions[id]={orderId:order.id,amount:order.amount,at};
 return {ok:true,duplicate:false,userId:order.userId,amount:order.amount,orderId:order.id};
}
