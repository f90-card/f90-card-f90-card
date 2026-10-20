import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { callProvider } from "./provider.mjs";
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const url=Deno.env.get('SUPABASE_URL')||'';
 if(url!=='https://ogkipkavlywgwhtomoca.supabase.co')return reply({error:'Wrong project'},403);
 const worker=req.headers.get('x-f90-worker')||'';
 if(worker.length<28)return reply({error:'Forbidden'},403);
 const db=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',{auth:{persistSession:false,autoRefreshToken:false}});
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(worker));
 const hash=Array.from(new Uint8Array(bytes)).map(x=>x.toString(16).padStart(2,'0')).join('');
 const auth=await db.rpc('f90_worker_authorized',{p_hash:hash});
 if(auth.error||auth.data!==true)return reply({error:'Forbidden'},403);
 const body=await req.json().catch(()=>({}));
 if(body.action==='providerProbe'){
  // Read-only validation from the target Edge runtime; never enables workers or orders.
  const found=await db.from('f90_providers').select('*').eq('adapter','yassen');
  const providers=(found.data||[]).filter((p:any)=>!p.config?.archived_at);
  if(found.error||providers.length!==1)return reply({error:'Expected one Yassen provider'},409);
  const p=providers[0];
  if(p.is_enabled||new URL(p.endpoint).origin!=='https://api.yassen-card.com')return reply({error:'Probe requires isolated target provider'},409);
  const credential=await db.rpc('f90_provider_secret',{p_actor:null,p_provider:p.id});
  if(credential.error||!credential.data)return reply({error:'Provider credential unavailable'},503);
  const resolveDns=async(host:string)=>{const r=await Promise.allSettled([Deno.resolveDns(host,'A'),Deno.resolveDns(host,'AAAA')]);return r.flatMap(x=>x.status==='fulfilled'?x.value:[]);};
  const results=await Promise.allSettled([callProvider(p,credential.data,'balance',{},fetch,resolveDns),callProvider(p,credential.data,'services',{},fetch,resolveDns)]);
  const profile=results[0],catalog=results[1];
  return reply({profile_accepted:profile.status==='fulfilled'&&typeof profile.value==='object'&&profile.value!==null,profile_fields:profile.status==='fulfilled'?Object.keys(profile.value||{}).filter(x=>/^[a-z_]{1,40}$/i.test(x)):[],profile_data_fields:profile.status==='fulfilled'&&typeof profile.value?.data==='object'?Object.keys(profile.value.data||{}).filter(x=>/^[a-z_]{1,40}$/i.test(x)):[],catalog_accepted:catalog.status==='fulfilled'&&Array.isArray(catalog.value),service_count:catalog.status==='fulfilled'&&Array.isArray(catalog.value)?catalog.value.length:0,orders_submitted:0,provider_enabled:false,errors:results.map(x=>x.status==='rejected'?String(x.reason?.message||'Probe unavailable').slice(0,160):null)});
 }
 if(body.action==='privateStorageProbe'){
  // Reads private bytes in this runtime only; never issues public/signed URLs or returns paths.
  let objects=0,verified=0,failed=0,bytes=0,privateBuckets=0,publicAvatarBuckets=0,scanned=0;
  for(const bucket of ['f90-identity','f90-receipts','f90-avatars']){
   const info=await db.storage.getBucket(bucket);
   const expectedPublic=bucket==='f90-avatars';
   if(info.error||info.data.public!==expectedPublic)return reply({error:'Bucket visibility verification failed'},409);
   if(expectedPublic)publicAvatarBuckets++;else privateBuckets++;
   const folders=[''];
   while(folders.length){
    if(++scanned>100)return reply({error:'Unexpected storage inventory size'},409);
    const prefix=folders.shift()!;
    const listing=await db.storage.from(bucket).list(prefix,{limit:100});
    if(listing.error||!listing.data||listing.data.length>=100)return reply({error:'Storage inventory unavailable'},503);
    for(const item of listing.data){
     if(!item.name||item.name.includes('/')||item.name==='.'||item.name==='..')return reply({error:'Unexpected storage path'},409);
     const path=prefix?prefix+'/'+item.name:item.name;
     if(!item.id){folders.push(path);continue;}
     if(++objects>60)return reply({error:'Unexpected private object count'},409);
     const file=await db.storage.from(bucket).download(path);
     if(file.error||!file.data){failed++;continue;}
     const size=file.data.size,expected=Number(item.metadata?.size);
     if(!size||size>20*1024*1024||(Number.isFinite(expected)&&expected!==size)){failed++;continue;}
     // Consuming and hashing the complete stream verifies actual stored bytes, not metadata only.
     await crypto.subtle.digest('SHA-256',await file.data.arrayBuffer());
     bytes+=size;verified++;
    }
   }
  }
  return reply({private_buckets:privateBuckets,public_avatar_buckets:publicAvatarBuckets,objects,verified,failed,total_bytes:bytes,public_urls_created:0,financial_writes:0});
 }
 if(body.action==='testEmail'){
  // Exactly one verified, connected administrative recipient; never a caller-provided address.
  const recipientId='684f921d-2ccc-4be5-9a09-2e5fc5377946';
  const [identity,role,profile]=await Promise.all([db.auth.admin.getUserById(recipientId),db.from('f90_user_roles').select('role').eq('user_id',recipientId).single(),db.from('profiles').select('account_status').eq('id',recipientId).single()]);
  if(identity.error||role.error||profile.error||!identity.data.user.email||!identity.data.user.email_confirmed_at||role.data.role!=='manager'||profile.data.account_status!=='active')return reply({error:'Administrative recipient verification failed'},403);
  const key=Deno.env.get('RESEND_API_KEY')||'',sender=Deno.env.get('F90_EMAIL_FROM')||'';
  if(!key||!sender||/[\r\n]/.test(sender))return reply({error:'Email provider unavailable'},503);
  const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:'Bearer '+key,'content-type':'application/json','Idempotency-Key':'f90-dispatch-acceptance-20261019'},body:JSON.stringify({from:sender,to:[identity.data.user.email],subject:'F90 CARD | اختبار موزع البريد 20261019',text:'هذه رسالة اختبار واحدة للتحقق من وصول البريد من مشروع F90 CARD الجديد. لا تمثل إيداعًا أو عملية مالية. لم تُرسل الإشعارات التاريخية. لوحة الإدارة: https://www.f90card.online/admin.html'}),signal:AbortSignal.timeout(15000)});
  const sent=await res.json().catch(()=>({}));
  return reply({accepted:res.ok&&!!sent.id,provider_status:res.status,message_id:sent.id||null,queue_claimed:false},res.ok?200:502);
 }
 const bearer=Deno.env.get('SUPABASE_ANON_KEY')||'',dispatch=Deno.env.get('F90_EMAIL_DISPATCH_SECRET')||'';
 if(!bearer||dispatch.length<28)return reply({error:'Required environment unavailable',bearerConfigured:!!bearer,bearerJwt:bearer.startsWith('eyJ'),dispatchConfigured:!!dispatch,dispatchSufficient:dispatch.length>=28},503);
 const result=await db.rpc('f90_mail_provision_dispatcher',{p_bearer:bearer,p_dispatch:dispatch});
 if(result.error){console.error('mail_provision_failed',result.error.code);return reply({error:'Provisioning rejected'},409);}
 return reply({configured:result.data===true,cutover_enabled:false,mail_sent:false});
});