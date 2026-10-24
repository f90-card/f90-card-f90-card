const encoder=new TextEncoder();
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
const digest=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
const bounded=(value,n=120)=>typeof value==='string'?value.trim().slice(0,n):null;
export function publicIP(value){
 const ip=bounded(value,45);if(!ip)return null;
 if(ip.includes(':')){
  if(!/^[a-f0-9:]+$/i.test(ip))return null;
  try{new URL('https://['+ip+']/')}catch{return null;}
  if(/^(::|fc|fd|fe[89ab]|ff)/i.test(ip))return null;
  return ip.toLowerCase();
 }
 const parts=ip.split('.').map(Number);
 if(!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)||parts.some(n=>n<0||n>255))return null;
 const [a,b]=parts;
 if(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127))return null;
 return parts.join('.');
}
const coordinate=(value,max)=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Math.abs(Number(value))<=max?Math.round(Number(value)*10)/10:null;
export function classify(agent='',mobileHint='',platformHint=''){
 const ua=String(agent).slice(0,500),platform=String(platformHint).replace(/"/g,'');
 const os=/Android/i.test(platform+' '+ua)?'Android':/iPhone|iPad|iPod|iOS/i.test(platform+' '+ua)?'iOS':/Windows/i.test(platform+' '+ua)?'Windows':/Mac OS|Macintosh|macOS/i.test(platform+' '+ua)?'macOS':/Linux/i.test(platform+' '+ua)?'Linux':'unknown';
 const device=/iPad|Tablet|SM-T\d|Nexus (7|9)|Pixel C/i.test(ua)?'tablet':mobileHint==='?1'||/Mobile|iPhone|iPod/i.test(ua)?'phone':os==='Android'?'unknown':/Windows|Macintosh|Linux/i.test(ua)?'desktop':'unknown';
 const browser=/Edg\//i.test(ua)?'Edge':/OPR\//i.test(ua)?'Opera':/Firefox\//i.test(ua)?'Firefox':/Chrome\/|CriOS\//i.test(ua)?'Chrome':/Safari\//i.test(ua)?'Safari':'unknown';
 return {device_type:device,os_name:os,browser_name:browser};
}
export async function signContext(request,body,secret,now=Date.now()){
 const cf=request.cf||{};
 const country=bounded(cf.country,2)?.toUpperCase();
 const value={v:1,at:now,token_hash:await digest(request.headers.get('authorization')||''),body_hash:await digest(body),
  ip:publicIP(request.headers.get('cf-connecting-ip')),country:/^[A-Z]{2}$/.test(country||'')&&!['XX','T1'].includes(country)?country:null,
  city:bounded(cf.city),region:bounded(cf.region),network:bounded(cf.asOrganization,160),asn:Number.isSafeInteger(cf.asn)?cf.asn:null,
  latitude:coordinate(cf.latitude,90),longitude:coordinate(cf.longitude,180),
  agent:bounded(request.headers.get('user-agent'),500),mobile:bounded(request.headers.get('sec-ch-ua-mobile'),4),platform:bounded(request.headers.get('sec-ch-ua-platform'),40)};
 const payload=btoa(String.fromCharCode(...encoder.encode(JSON.stringify(value)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 return {payload,signature:hex(await crypto.subtle.sign('HMAC',key,encoder.encode(payload)))};
}
export async function verifyContext(payload,signature,authorization,body,secret,now=Date.now()){
 if(typeof secret!=='string'||secret.length<32||payload.length>4096||!/^[a-f0-9]{64}$/.test(signature))throw Error('GATEWAY_REQUIRED');
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const bytes=Uint8Array.from(signature.match(/../g),x=>parseInt(x,16));
 if(!await crypto.subtle.verify('HMAC',key,bytes,encoder.encode(payload)))throw Error('GATEWAY_INVALID');
 let c;try{c=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0))))}catch{throw Error('GATEWAY_INVALID')}
 if(c.v!==1||!Number.isFinite(c.at)||Math.abs(now-c.at)>90000||c.token_hash!==await digest(authorization)||c.body_hash!==await digest(body)||!publicIP(c.ip))throw Error('GATEWAY_INVALID');
 return c;
}

export async function readBoundedBody(request,max=8192){
 if(!request.body)return '';
 const reader=request.body.getReader(),chunks=[];let size=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw Error('PAYLOAD_TOO_LARGE');}chunks.push(value);}
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength;}
 return new TextDecoder().decode(bytes);
}
