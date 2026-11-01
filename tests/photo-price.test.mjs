import test from 'node:test';
import assert from 'node:assert/strict';
import {photoCost,PHOTO_MIN_SECONDS,PHOTO_MAX_SECONDS,freezePlaybackForPhoto,restorePlaybackAfterPhotos} from '../shared/photo.js';
test('1.000 VND equivalent per second, 1–60 seconds',()=>{assert.equal(PHOTO_MIN_SECONDS,1);assert.equal(PHOTO_MAX_SECONDS,60);for(const n of [1,5,10,30,60])assert.equal(photoCost(n),n*1000);for(const bad of [0,-1,61,1.5,null,'10'])assert.equal(photoCost(bad),null);});
test('video pauses for photo and resumes exactly at frozen time',()=>{const r={media:{position:20,playing:true,updatedAt:1000}};freezePlaybackForPhoto(r,6000);assert.equal(r.media.position,25);assert.equal(r.media.playing,false);freezePlaybackForPhoto(r,7000);restorePlaybackAfterPhotos(r,10000);assert.equal(r.media.position,25);assert.equal(r.media.playing,true);assert.equal(r.media.updatedAt,10000);});
test('already paused video remains paused',()=>{const r={media:{position:50,playing:false,updatedAt:1000}};freezePlaybackForPhoto(r,6000);restorePlaybackAfterPhotos(r,8000);assert.equal(r.media.playing,false);assert.equal(r.media.position,50);});
