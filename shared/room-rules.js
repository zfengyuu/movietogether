// Shared server-side rules for real-time voting and a four-place stage.
export const MAX_STAGE_DANCERS=4;
export const SKIN_PRICES={mint:10000,peach:20000,midnight:30000,royal:50000};
export const votesNeeded=n=>Math.max(1,Math.ceil(Math.max(1,n)*0.35));
export const stageSlot=(people,exceptId=null)=>{
 const used=new Set(people.filter(p=>p.id!==exceptId&&p.zone==='stage'&&p.action==='dance').map(p=>p.stageSlot));
 return Array.from({length:MAX_STAGE_DANCERS},(_,i)=>i).find(i=>!used.has(i)) ?? null;
};
export const queueOrder=(a,b)=>(b.votes||0)-(a.votes||0)||(a.addedAt||0)-(b.addedAt||0);
