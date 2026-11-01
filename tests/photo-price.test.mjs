import test from 'node:test';
import assert from 'node:assert/strict';
import {photoCost,PHOTO_MAX_BYTES,DEMO_WALLET_CREDIT} from '../shared/photo.js';
test('priority photo pricing is calculated server-side',()=>{
 assert.equal(photoCost(6),10000);
 assert.equal(photoCost(9),10000);
 assert.equal(photoCost(10),20000);
 assert.equal(photoCost(30),60000);
 assert.equal(photoCost(60),120000);
 for(const v of [0,5,61,NaN,10.5,'10'])assert.equal(photoCost(v),null);
 assert.equal(PHOTO_MAX_BYTES,12*1024*1024);
 assert.equal(DEMO_WALLET_CREDIT,200000);
});
