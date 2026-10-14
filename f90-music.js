(function () {
  "use strict";
  // Original, continuously repeating instrumental patterns: no third-party music streams or tracks.
  const root = document.getElementById("f90MusicPlayer");
  if (!root) return;
  const stations = [
    { id:"tarab", label:"طربي", bpm:85, wave:"triangle", notes:[57,60,64,65,64,60,57,55,57,60,64,67,65,64,60,57], chords:[[45,52,57],[41,48,53]], accent:0.26 },
    { id:"romantic", label:"رومانسي", bpm:70, wave:"sine", notes:[60,64,67,72,69,67,64,60,62,65,69,72,69,65,62,60], chords:[[48,55,60],[45,52,57]], accent:0.20 },
    { id:"epic", label:"حماسي", bpm:120, wave:"sawtooth", notes:[48,55,60,62,63,60,55,48,50,57,62,65,63,62,57,50], chords:[[36,43,48],[38,45,50]], accent:0.20 },
    { id:"calm", label:"هادئ", bpm:64, wave:"sine", notes:[60,67,64,67,62,69,65,69,57,64,60,64,55,62,59,62], chords:[[48,55,60],[45,52,57]], accent:0.19 },
    { id:"active", label:"نشيط", bpm:132, wave:"triangle", notes:[60,64,67,72,67,64,62,67,60,65,69,72,69,65,62,60], chords:[[48,55,60],[53,60,65]], accent:0.24 }
  ];
  let context=null, master=null, timer=null, playing=false, station=0, step=0, nextTime=0, volume=0.19;
  try {
    const saved=JSON.parse(localStorage.getItem("f90-music-preferences")||"null");
    if(saved && Number.isInteger(saved.station) && saved.station>=0 && saved.station<stations.length) station=saved.station;
    if(saved && Number.isFinite(saved.volume)) volume=Math.max(0,Math.min(1,saved.volume));
  } catch {}
  function savePrefs(){try{localStorage.setItem("f90-music-preferences",JSON.stringify({station,volume}));}catch{}}

  root.innerHTML = '<div class="f90-music-brand"><span class="f90-music-pulse" aria-hidden="true">♫</span><div><strong>ميوزك أف تسعين</strong><small id="f90MusicStatus">أنغام أصلية · اختر النمط واضغط تشغيل</small></div></div><div class="f90-music-ctrl"><label class="sr-only" for="f90MusicGenre">نوع الموسيقى</label><select id="f90MusicGenre"></select><button id="f90MusicPlay" type="button" aria-label="تشغيل الموسيقى" aria-pressed="false">▶</button><label class="sr-only" for="f90MusicVolume">مستوى الصوت</label><input id="f90MusicVolume" type="range" min="0" max="100" value="19" aria-label="مستوى الصوت"></div>';
  const genre=root.querySelector("#f90MusicGenre"), play=root.querySelector("#f90MusicPlay"), vol=root.querySelector("#f90MusicVolume"), status=root.querySelector("#f90MusicStatus");
  stations.forEach((s,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=s.label;genre.append(o);});
  genre.value=String(station);vol.value=String(Math.round(volume*100));
  function noteFrequency(n) { return 440*Math.pow(2,(n-69)/12); }
  function tone(pitch,when,duration,wave,gainValue) {
    if(!context || !master || when<context.currentTime-.08) return;
    const osc=context.createOscillator(),envelope=context.createGain();
    osc.type=wave;osc.frequency.setValueAtTime(noteFrequency(pitch),when);
    envelope.gain.setValueAtTime(.0001,when);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.001,gainValue),when+.025);
    envelope.gain.exponentialRampToValueAtTime(.0001,when+duration);
    osc.connect(envelope);envelope.connect(master);
    osc.start(when);osc.stop(when+duration+.02);
    osc.onended=()=>{osc.disconnect();envelope.disconnect();};
  }
  function schedule() {
    if(!playing||!context)return;
    const p=stations[station],seconds=60/p.bpm/2;
    if(nextTime<context.currentTime-.2)nextTime=context.currentTime+.05;
    while(nextTime<context.currentTime+.15){
      const n=p.notes[step%p.notes.length];
      tone(n,nextTime,Math.min(seconds*.82,.4),p.wave,p.accent);
      if(step%4===0)tone(p.chords[Math.floor(step/8)%2][0],nextTime,seconds*3.8,"sine",.11);
      if(step%8===0)p.chords[Math.floor(step/8)%2].slice(1).forEach(x=>tone(x,nextTime,seconds*7.5,"sine",.032));
      step++;nextTime+=seconds;
    }
  }
  async function begin() {
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio){status.textContent="متصفحك لا يدعم المشغّل";return;}
    if(!context){
      context=new Audio();master=context.createGain();master.gain.value=volume;master.connect(context.destination);
    }
    try { await context.resume(); } catch {status.textContent="اضغط تشغيل للسماح بالصوت";return;}
    playing=true;step=0;nextTime=context.currentTime+.05;
    clearInterval(timer);timer=setInterval(schedule,75);schedule();
    play.textContent="Ⅱ";play.setAttribute("aria-pressed","true");play.setAttribute("aria-label","إيقاف الموسيقى");
    root.classList.add("is-playing");
    status.textContent=stations[station].label+" · عزف آلي متكرر";
  }
  function stop(){
    playing=false;clearInterval(timer);timer=null;
    if(context&&context.state==="running")context.suspend().catch(()=>{});
    play.textContent="▶";play.setAttribute("aria-pressed","false");play.setAttribute("aria-label","تشغيل الموسيقى");
    root.classList.remove("is-playing");status.textContent="متوقف مؤقتاً";
  }
  play.addEventListener("click",()=>playing?stop():void begin());
  genre.addEventListener("change",()=>{station=Number(genre.value);step=0;savePrefs();if(playing){stop();void begin();}else status.textContent=stations[station].label+" · جاهز للتشغيل";});
  vol.addEventListener("input",()=>{volume=Number(vol.value)/100;savePrefs();if(master)master.gain.setTargetAtTime(volume,context.currentTime,.04);});
  function visible(){
    const page=(location.hash||"#/welcome").split("/")[1]||"welcome";
    const show=page==="welcome"||page==="";
    root.hidden=!show;
    if(!show && playing)stop();
  }
  window.addEventListener("hashchange",visible);
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden && playing && context?.state==="running") { nextTime=context.currentTime+.05; schedule(); } });
  visible();
})();
