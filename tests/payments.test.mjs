import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { normalizeTopupAmount, verifySePaySignature, matchIncomingPayment, applyVerifiedPayment } from '../shared/payments.js';

test('validates exact VND topup amounts',()=>{
 assert.equal(normalizeTopupAmount(20000),20000);assert.equal(normalizeTopupAmount(9999),null);assert.equal(normalizeTopupAmount(10001),null);assert.equal(normalizeTopupAmount(Infinity),null);
});
test('rejects forged signature, stale timestamp, altered body',()=>{
 const body=Buffer.from('{"id":1}');const ts=String(Math.floor(Date.now()/1000));const secret='sandbox-secret';
 const sig='sha256='+crypto.createHmac('sha256',secret).update(ts+'.').update(body).digest('hex');
 assert.equal(verifySePaySignature(body,ts,sig,secret),true);
 assert.equal(verifySePaySignature(body,ts,sig,'wrong'),false);
 assert.equal(verifySePaySignature(Buffer.from('{}'),ts,sig,secret),false);
 assert.equal(verifySePaySignature(body,String(Number(ts)-500),sig,secret),false);
});
test('credits only exact account, amount, memo, incoming transfer, and pending order',()=>{
 const order={id:'order',userId:'uuid-account-1',amount:20000,code:'VIMO1A2B3C4D5E6F',status:'pending'};
 const event={id:42,accountNumber:'BANK-ABC',code:order.code,content:'VIMO1A2B3C4D5E6F',transferType:'in',transferAmount:20000};
 assert.equal(matchIncomingPayment(event,order,'BANK-ABC'),true);
 for(const wrong of [{...event,accountNumber:'HACKER'},{...event,transferAmount:20001},{...event,transferType:'out'},{...event,code:'OTHER',content:'OTHER'}]){
  assert.equal(matchIncomingPayment(wrong,order,'BANK-ABC'),false);
 }
 const state={wallets:{'uuid-account-1':{balance:10,ledger:[]},'uuid-account-2':{balance:0,ledger:[]}},orders:{order},transactions:{}};
 const result=applyVerifiedPayment(state,event,'BANK-ABC');assert.equal(result.ok,true);
 assert.equal(state.wallets['uuid-account-1'].balance,20010);assert.equal(state.wallets['uuid-account-2'].balance,0);
 assert.equal(state.orders.order.status,'paid');
 assert.equal(applyVerifiedPayment(state,event,'BANK-ABC').duplicate,true);
 assert.equal(state.wallets['uuid-account-1'].balance,20010);
 assert.equal(applyVerifiedPayment(state,{...event,id:43},'BANK-ABC').ok,false);
});
