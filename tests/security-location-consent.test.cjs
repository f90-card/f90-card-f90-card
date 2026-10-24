const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const {harness}=require('./dom-harness.cjs');const source=fs.readFileSync(require('node:path').join(__dirname,'../f90-security-ui.js'),'utf8');
async function setup(allow=true){
 const h=await harness();const calls=[];let gps=0;
 h.window.AbortSignal=AbortSignal;
 h.window.F90API.client.auth.getSession=async()=>({data:{session:{access_token:'fixture-session-token',user:{id:'fixture-user'}}}});
 const geo={getCurrentPosition:(ok,fail)=>{gps++;if(allow)ok({coords:{latitude:31.9,longitude:35.2,accuracy:20},timestamp:Date.now()});else fail({code:1});}};
 h.window.fetch=async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return {ok:true,json:async()=>({saved:true})};};
 vm.runInNewContext(source,{window:h.window,document:h.document,navigator:{geolocation:geo},localStorage:h.window.localStorage,fetch:h.window.fetch,AbortSignal,setTimeout:h.window.setTimeout,setInterval:h.window.setInterval,clearInterval:h.window.clearInterval});await h.settle();await h.settle();
 return {...h,calls,geo,gps:()=>gps};
}
test('GPS is not requested on login and network audit uses the same-origin gateway',async()=>{
 const h=await setup();try{assert.equal(h.gps(),0);assert.ok(h.document.querySelector('[data-location-allow]'));assert.ok(h.calls.some(c=>c.url==='/api/security-activity'&&c.body.action==='record'));assert.ok(h.calls.every(c=>!c.body.location));}finally{h.cleanup();}
});
test('explicit sharing records location and stop clears it without collecting another fix',async()=>{
 const h=await setup();try{
  h.document.querySelector('[data-location-allow]').click();await h.settle();await h.settle();
  assert.ok(h.calls.some(c=>c.body.location_consent===true&&c.body.location?.accuracy===20),JSON.stringify({calls:h.calls,gps:h.gps(),text:h.document.getElementById('f90LocationConsent')?.textContent}));
  const count=h.gps();h.document.querySelector('[data-location-stop]').click();await h.settle();await h.settle();
  assert.ok(h.calls.some(c=>c.body.clear_location===true));assert.equal(h.gps(),count);assert.equal(h.document.getElementById('f90LocationConsent'),null);
 }finally{h.cleanup();}
});
test('deferring permission leaves the store usable and does not access GPS',async()=>{
 const h=await setup();try{h.document.querySelector('[data-location-later]').click();await h.settle();assert.equal(h.gps(),0);assert.equal(h.document.getElementById('f90LocationConsent'),null);assert.ok(h.document.getElementById('mainContent'));}finally{h.cleanup();}
});

test('permission denial never uploads location or blocks the store',async()=>{
 const h=await setup(false);try{h.document.querySelector('[data-location-allow]').click();await h.settle();assert.ok(h.calls.every(c=>!c.body.location));assert.ok(h.document.getElementById('mainContent'));assert.match(h.document.getElementById('f90LocationConsent').textContent,/لم يُمنح إذن/);}finally{h.cleanup();}
});
test('revocation while GPS is pending cannot upload the pending location',async()=>{
 const h=await setup();try{
  h.document.querySelector('[data-location-allow]').click();await h.settle();await h.settle();
  let finish;h.geo.getCurrentPosition=ok=>{finish=ok;};const start=h.calls.length;
  const request=h.window.F90SecurityUI.record('fixture-user',true);await h.settle();assert.equal(typeof finish,'function');
  h.document.querySelector('[data-location-stop]').click();finish({coords:{latitude:32,longitude:35,accuracy:10},timestamp:Date.now()});
  await request;await h.settle();assert.ok(h.calls.slice(start).every(c=>!c.body.location));assert.ok(h.calls.slice(start).some(c=>c.body.clear_location));
 }finally{h.cleanup();}
});
