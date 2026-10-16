import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { parseHTML } from "linkedom";

const source=readFileSync(new URL("../f90-media-player.js",import.meta.url),"utf8");
const css=readFileSync(new URL("../f90-radio.css",import.meta.url),"utf8");

function mockPlayer({tracks=[
  {title:"الأغنية الأولى",mode:"audio"},
  {title:"الأغنية الثانية",mode:"audio"},
  {title:"الأغنية الثالثة",mode:"audio"}
],duration=120}={}){
  const {window}=parseHTML("<html><body></body></html>");
  const {document}=window;
  const elements=[];
  const create=document.createElement.bind(document);
  document.createElement=(tag)=>{
    const el=create(tag);
    if(tag==="audio"||tag==="video"){
      el.currentTime=0;el.duration=duration;el.paused=true;el.ended=false;
      el.play=async()=>{
        el.paused=false;
        el.dispatchEvent(new window.Event("play"));
        el.dispatchEvent(new window.Event("playing"));
      };
      el.pause=()=>{
        el.paused=true;el.dispatchEvent(new window.Event("pause"));
      };
      el.load=()=>el.dispatchEvent(new window.Event("loadedmetadata"));
      elements.push(el);
    }
    return el;
  };
  const stored=new Map();
  const state={enabled:true,revision:"one",tracks,selected_index:0,mode:"audio",
    start_seconds:0,volume:.2,bubble:{}};
  const apiCalls=[];
  window.F90API={call:async(action,args)=>{
    apiCalls.push({action,args});
    if(action==="media.state")return state;
    if(action==="media.ticket")return {url:"https://example.com/track-"+String(args.track_index)+".mp3"};
    throw Error("unexpected action "+action);
  }};
  const ctx={
    window,document,console,URL,location:{href:"https://f90-card.github.io/f90-card-f90-card/"},
    localStorage:{getItem:k=>stored.get(k)??null,setItem:(k,v)=>stored.set(k,String(v))},
    setInterval:()=>0,setTimeout,clearTimeout,Number,String,Math,JSON,
  };
  vm.runInNewContext(source,ctx);
  const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
  return {window,document,elements,state,apiCalls,flush,player:window.F90MediaPlayer,
    latest:()=>elements.at(-1)};
}

test("listener can seek with the small slider and read elapsed/total time",async()=>{
 const h=mockPlayer();
 h.player.sync({music:{enabled:true}});
 await h.flush();
 const {document,window}=h;
 const bar=document.getElementById("f90RadioSeek");
 assert.ok(bar,"Seek control is rendered");
 assert.equal(bar.disabled,false);
 assert.equal(document.getElementById("f90RadioDuration").textContent,"2:00");
 bar.value="500";
 bar.dispatchEvent(new window.Event("input",{bubbles:true}));
 assert.equal(document.getElementById("f90RadioElapsed").textContent,"1:00");
 bar.dispatchEvent(new window.Event("change",{bubbles:true}));
 assert.equal(h.latest().currentTime,60);
 assert.match(bar.getAttribute("aria-valuetext"),/1:00/);
});

test("small previous/next buttons change only the listener's track",async()=>{
 const h=mockPlayer();
 h.player.sync({music:{enabled:true}});
 await h.flush();
 const {document,window}=h;
 const prev=document.getElementById("f90RadioPrev");
 const next=document.getElementById("f90RadioNext");
 assert.equal(prev.disabled,false);assert.equal(next.disabled,false);
 next.dispatchEvent(new window.Event("click",{bubbles:true}));
 await h.flush();
 assert.equal(h.player.status().trackIndex,1);
 assert.match(document.getElementById("f90RadioTrack").textContent,/الثانية/);
 prev.dispatchEvent(new window.Event("click",{bubbles:true}));
 await h.flush();
 assert.equal(h.player.status().trackIndex,0);
 assert.match(document.getElementById("f90RadioTrackCount").textContent,/1 \/ 3/);
 assert.equal(h.state.selected_index,0,"Local arrows never update the manager's global playlist");
});

test("play/pause stays a local option, without disabling the station",async()=>{
 const h=mockPlayer();
 h.player.sync({music:{enabled:true}});
 await h.flush();
 const btn=h.document.getElementById("f90RadioPlayPause");
 assert.equal(btn.disabled,false);
 btn.dispatchEvent(new h.window.Event("click",{bubbles:true}));
 assert.equal(h.latest().paused,true);
 assert.equal(btn.getAttribute("aria-label"),"تشغيل الموسيقى");
 btn.dispatchEvent(new h.window.Event("click",{bubbles:true}));
 await h.flush();
 assert.equal(h.latest().paused,false);
 assert.equal(h.state.enabled,true);
});

test("live streams and single tracks disable unavailable skip and seeking",async()=>{
 const h=mockPlayer({tracks:[],duration:Infinity});
 h.player.sync({music:{enabled:true}});
 await h.flush();
 const {document}=h;
 assert.equal(document.getElementById("f90RadioPrev").disabled,true);
 assert.equal(document.getElementById("f90RadioNext").disabled,true);
 assert.equal(document.getElementById("f90RadioSeek").disabled,true);
 assert.equal(document.getElementById("f90RadioDuration").textContent,"--:--");
 assert.match(document.getElementById("f90RadioTrackCount").textContent,/بث مباشر/);
});

test("player keeps dark and cream theme contrast with touch-friendly controls",()=>{
 assert.match(css,/f90-radio-transport/);
 assert.match(css,/f90-radio-seek/);
 assert.match(css,/:root\[data-theme="cream"\]/);
 assert.match(source,/aria-label="الأغنية التالية"/);
 assert.match(source,/aria-label="الأغنية السابقة"/);
});
