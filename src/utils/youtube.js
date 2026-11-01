/** Validate a YouTube URL; support watch, shortened, Shorts, live and embed. */
export function extractYouTubeId(input){
 let u;try{u=new URL(String(input||''));}catch{return '';}
 if(!['http:','https:'].includes(u.protocol))return '';
 const host=u.hostname.toLowerCase();
 let id='';
 if(host==='youtu.be'||host==='www.youtu.be')id=u.pathname.split('/')[1]||'';
 else if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host))
  id=u.searchParams.get('v')||u.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})(?:\/|$)/)?.[1]||'';
 return /^[\w-]{11}$/.test(id)?id:'';
}
