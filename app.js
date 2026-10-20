import * as T from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createForest } from './world.js';

const icons={
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  fog:'<path d="M4 9a4 4 0 0 1 4-4 5 5 0 0 1 9 2 3 3 0 0 1 3 3M3 13h15M6 17h15M3 21h12"/>',
  rain:'<path d="M5 12a4 4 0 0 1 2-7 5 5 0 0 1 9 1 4 4 0 1 1 2 8H8M6 17l-1 3m7-3-1 3m7-3-1 3"/>',
  sunset:'<path d="M3 16h18M6 16a6 6 0 0 1 12 0M12 3v3M3 8l2 2m14-2-2 2M6 20h12"/>',
  moon:'<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z"/><path d="m18 3 .6 1.4L20 5l-1.4.6L18 7l-.6-1.4L16 5l1.4-.6Z"/>',
  sound:'<path d="m4 9 4 0 5-4v14l-5-4H4Z"/><path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  camera:'<path d="M3 7h5l2-3h4l2 3h5v13H3Z"/><circle cx="12" cy="13" r="4"/>',
  fullscreen:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  hide:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  home:'<path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7"/>',
  flower:'<circle cx="12" cy="9" r="3"/><path d="M10 6C7 0 2 6 7 9c-6 2-2 8 3 4 1 6 7 4 5-1 6 1 7-5 2-5 1-5-5-6-5-1M12 14v8m0-4c4 0 6-3 6-3"/>',
  bird:'<path d="M4 15c3-1 3-6 6-7 0-5 6-5 7-1l4 2-4 1c0 7-5 10-11 7l-3 2 1-4Z"/><path d="m8 11 4 2-4 2m7-8h.1"/>',
  water:'<path d="M2 7c3-3 5 3 8 0s5 3 8 0 4 0 4 0M2 12c3-3 5 3 8 0s5 3 8 0 4 0 4 0M2 17c3-3 5 3 8 0s5 3 8 0 4 0 4 0"/>',
  play:'<path d="m8 4 12 8-12 8Z"/>',
  pause:'<path d="M8 5v14M16 5v14"/>',
  leaf:'<path d="M20 3C7 2 2 8 6 15c8 5 14-2 14-12ZM4 21 15 10"/>'
};
const svg=name=>`<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.leaf}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=svg(el.dataset.icon));
const $=s=>document.querySelector(s);
let toastTimer;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3000);}
function reportError(error){
  console.error(error);
  const loader=$('#loader');loader.style.display='flex';loader.style.opacity='1';
  loader.querySelector('p').textContent='场景未能启动，请刷新页面重试。'+(error.message||'');
  loader.querySelector('.loading-line').style.display='none';
}
window.addEventListener('error',e=>{if(!window.__FOREST__?.ready)reportError(e.error||new Error(e.message));});

try { init(); } catch(error){reportError(error);}
function init(){
  const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<650?1.5:1.65));
  renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  renderer.outputColorSpace=T.SRGBColorSpace;
  $('#world').appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#c9dcd0');scene.fog=new T.FogExp2('#c9dcd0',.011);
  const camera=new T.PerspectiveCamera(40,innerWidth/innerHeight,.1,160);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.065;controls.enablePan=true;controls.minDistance=3.5;controls.maxDistance=60;
  controls.maxPolarAngle=Math.PI*.475;controls.minPolarAngle=.18;controls.autoRotateSpeed=.4;controls.target.set(-1,2.4,0);controls.zoomToCursor=false;
  const hemi=new T.HemisphereLight('#dae9ef','#697c43',2.5);scene.add(hemi);
  const sun=new T.DirectionalLight('#fff0cc',3.5);sun.position.set(-17,26,14);sun.castShadow=true;
  sun.shadow.mapSize.set(innerWidth<650?1024:2048,innerWidth<650?1024:2048);sun.shadow.camera.left=-25;sun.shadow.camera.right=25;sun.shadow.camera.top=25;sun.shadow.camera.bottom=-25;sun.shadow.camera.near=1;sun.shadow.camera.far=85;sun.shadow.normalBias=.045;sun.shadow.bias=-.00015;sun.shadow.radius=3;sun.target.position.set(-1,0,-1);scene.add(sun,sun.target);
  const fill=new T.DirectionalLight('#d8ecd3',.45);fill.position.set(12,10,-14);scene.add(fill);
  const porchLight=new T.PointLight('#ffd29a',0,12,1.5);porchLight.position.set(-1.6,2.7,-.1);scene.add(porchLight);
  const world=createForest(scene);
  const skyGeo=new T.SphereGeometry(1,24,16);
  const sunBall=new T.Mesh(skyGeo,new T.MeshBasicMaterial({color:'#fff5d3',fog:false}));sunBall.position.set(-36,43,-55);sunBall.scale.setScalar(2.9);scene.add(sunBall);
  const moon=new T.Mesh(skyGeo,new T.MeshBasicMaterial({color:'#e9f3df',fog:false}));moon.position.set(25,39,-60);moon.scale.setScalar(2);moon.visible=false;scene.add(moon);
  const weatherPresets={
    sunny:{sky:'#c7ddd3',fog:'#c7ddd3',density:.011,light:'#fff0c9',sun:3.5,hemi:2.5,exposure:1.13,night:0,rain:0,dusk:0,cloud:'#ecf1df',pos:[-17,26,14],time:'09:40',tag:'林间晴日',title:'阳光，落在花瓣上。',desc:'向日葵迎着微风，蜜蜂正忙着收集今天的甜。'},
    fog:{sky:'#c5d5ce',fog:'#c5d5ce',density:.043,light:'#e5eadd',sun:.65,hemi:2.5,exposure:1.13,night:0,rain:0,dusk:0,cloud:'#dae4d9',pos:[-14,23,10],time:'06:15',tag:'清晨薄雾',title:'森林，轻轻披上一层纱。',desc:'小屋隐在晨雾里，枝头传来第一声问候。'},
    rain:{sky:'#94b1ad',fog:'#94b1ad',density:.024,light:'#cfdfdd',sun:.45,hemi:1.8,exposure:1.03,night:0,rain:1,dusk:0,cloud:'#a2b9b2',pos:[-14,20,8],time:'14:20',tag:'午后细雨',title:'听，雨在替森林写信。',desc:'雨丝掠过屋檐，溪水泛起细小的涟漪。'},
    sunset:{sky:'#ddae89',fog:'#d8aa83',density:.014,light:'#ffb25c',sun:3.2,hemi:1.35,exposure:1.12,night:0,rain:0,dusk:1,cloud:'#f4c7a1',pos:[-25,10,8],time:'17:45',tag:'日落时分',title:'把今天，留在金色里。',desc:'长长的树影越过花田，小屋的灯慢慢亮起。'},
    night:{sky:'#142b44',fog:'#243c4d',density:.018,light:'#a9c9e9',sun:.42,hemi:.8,exposure:1.2,night:1,rain:0,dusk:0,cloud:'#415b6b',pos:[12,24,8],time:'21:30',tag:'星夜小憩',title:'晚安，每一片发光的叶子。',desc:'窗内有暖光，草间有萤火，星星陪着猫头鹰醒来。'}
  };
  let mode='sunny',weather=structuredClone(weatherPresets.sunny),paused=matchMedia('(prefers-reduced-motion: reduce)').matches,touring=false,view='home',wind=.35;
  let transition=null,move=null,elapsed=0,last=performance.now(),frameCount=0,lastFps=last,fps=0,ready=false;
  const colorKeys=['sky','fog','light','cloud'],numKeys=['density','sun','hemi','exposure','night','rain','dusk'];
  const cameraViews={
    home:{pos:[22,16,29],target:[-1.5,2.6,0]},
    flowers:{pos:[-1.4,4.6,13.4],target:[-5,1.8,3.3]},
    animals:{pos:[3.2,7.6,9],target:[-5.4,4.9,-1.5]},
    stream:{pos:[18,5.7,12.5],target:[8.6,1.1,1.6]}
  };
  function mobileAdjusted(v){
    const p=new T.Vector3(...v.pos),target=new T.Vector3(...v.target);
    if(innerWidth<650){p.sub(target).multiplyScalar(view==='home'?1.35:1.2).add(target);target.y+=view==='home'?1.2:0;}
    return {p,target};
  }
  function setView(key,immediate=false){
    view=key;setTour(false);
    document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===key));
    $('#animal-card').hidden=true;
    const {p,target}=mobileAdjusted(cameraViews[key]);
    if(immediate){camera.position.copy(p);controls.target.copy(target);controls.update();move=null;}
    else move={from:camera.position.clone(),to:p,fromTarget:controls.target.clone(),toTarget:target,start:performance.now(),duration:1600};
  }
  setView('home',true);
  function setWeather(key){
    if(!weatherPresets[key])return;
    mode=key;transition={start:performance.now(),from:structuredClone(weather),to:weatherPresets[key]};
    const p=weatherPresets[key];
    $('#moment-tag').textContent=p.tag;$('#moment-time').textContent=p.time;$('#moment-title').textContent=p.title;$('#moment-description').textContent=p.desc;
    document.querySelectorAll('[data-weather]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.weather===key));
    document.body.classList.toggle('dark',key==='night');
    if(sound)updateSound();
  }
  document.querySelectorAll('[data-weather]').forEach(b=>b.addEventListener('click',()=>setWeather(b.dataset.weather)));
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  $('#wind').addEventListener('input',e=>{wind=+e.target.value;$('#wind-value').textContent=wind<.12?'静谧':wind<.45?'轻柔':wind<.75?'微风':'轻快';if(sound)updateSound();});
  function setTour(value){touring=value;controls.autoRotate=value;$('#tour').setAttribute('aria-pressed',value);$('#tour').setAttribute('aria-label',value?'停止环绕漫游':'开始环绕漫游');$('#tour').innerHTML=svg(value?'pause':'play');}
  $('#tour').addEventListener('click',()=>{move=null;setTour(!touring);});
  function setPause(value){paused=value;$('#pause').setAttribute('aria-pressed',value);$('#pause').setAttribute('aria-label',value?'继续场景动画':'暂停场景动画');$('#pause').innerHTML=svg(value?'play':'pause');}
  setPause(paused);$('#pause').addEventListener('click',()=>setPause(!paused));
  controls.addEventListener('start',()=>{move=null;if(touring)setTour(false);});
  $('#hide').addEventListener('click',()=>document.body.classList.add('immersive'));
  $('#restore').addEventListener('click',()=>document.body.classList.remove('immersive'));
  $('#fullscreen').addEventListener('click',async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
    catch{toast('当前窗口不支持全屏，可使用沉浸模式。');}
  });
  $('#photo').addEventListener('click',()=>{
    renderer.render(scene,camera);
    renderer.domElement.toBlob(blob=>{if(!blob){toast('照片生成失败，请重试。');return;}const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=`霖林小屋-${weatherPresets[mode].tag}.png`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);toast('照片已生成，请在下载中查看');},'image/png');
  });
  document.addEventListener('keydown',e=>{
    if(/INPUT|TEXTAREA/.test(e.target.tagName))return;
    if(e.key.toLowerCase()==='h')document.body.classList.toggle('immersive');
    if(e.key==='Escape'){$('#animal-card').hidden=true;document.body.classList.remove('immersive');}
    if(e.code==='Space'&&e.target===document.body){e.preventDefault();setPause(!paused);}
    if(e.key==='0')setView('home');
    if(['1','2','3','4','5'].includes(e.key))setWeather(Object.keys(weatherPresets)[+e.key-1]);
  });
  const raycaster=new T.Raycaster(),pointer=new T.Vector2();let press=null;
  function showAnimal(a,focus=false){
    a.wave=1;$('#animal-kind').textContent=a.kind;$('#animal-name').textContent=a.name;$('#animal-description').textContent=a.desc;$('#animal-card').hidden=false;
    if(focus){
      setTour(false);const target=a.base.clone().add(new T.Vector3(0,.55,0));
      const to=target.clone().add(new T.Vector3(3,1.6,5.4));
      move={from:camera.position.clone(),to,fromTarget:controls.target.clone(),toTarget:target,start:performance.now(),duration:1500};
      document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));
    }
    if(sound)chirp();
  }
  renderer.domElement.addEventListener('pointerdown',e=>press={x:e.clientX,y:e.clientY,time:performance.now()});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(!press||Math.hypot(e.clientX-press.x,e.clientY-press.y)>7||performance.now()-press.time>500)return;
    pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(world.targets,false)[0];if(hit)showAnimal(hit.object.userData.animal);
  });
  $('#close-animal').addEventListener('click',()=>$('#animal-card').hidden=true);
  $('#field-guide').addEventListener('click',()=>$('#guide').showModal());
  $('#close-guide').addEventListener('click',()=>$('#guide').close());
  $('#guide').addEventListener('click',e=>{if(e.target===$('#guide')){const b=e.target.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)e.target.close();}});
  const distinct=world.animals.filter((a,i,list)=>list.findIndex(b=>b.kind===a.kind)===i);
  for(const a of distinct){
    const b=document.createElement('button');b.innerHTML=`${a.name}<span>${a.kind}</span>`;b.addEventListener('click',()=>{$('#guide').close();showAnimal(a,true);});$('#guide-list').append(b);
  }
  for(const [name,kind]of[['花间访客','18 只蝴蝶'],['采蜜时刻','14 只蜜蜂']]){
    const b=document.createElement('button');b.innerHTML=`${name}<span>${kind}</span>`;b.addEventListener('click',()=>{$('#guide').close();setView('flowers');if(mode==='night'||mode==='rain')toast('蝴蝶和蜜蜂在休息，切换晴日可以看见它们。');});$('#guide-list').append(b);
  }
  // Natural ambience synthesized locally; playback only follows a user action.
  let audio=null,sound=false,master=null,windGain=null,rainGain=null,birdTimer=null;
  function noise(ctx,frequency,gain){
    const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),d=buffer.getChannelData(0);
    let last=0;for(let i=0;i<d.length;i++){last=(last+Math.random()*.12-.06)/1.02;d[i]=last*3;}
    const src=ctx.createBufferSource();src.buffer=buffer;src.loop=true;
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=frequency;
    const volume=ctx.createGain();volume.gain.value=gain;src.connect(filter).connect(volume).connect(master);src.start();return volume;
  }
  function chirp(){
    if(!audio||!sound||mode==='rain')return;
    const now=audio.currentTime,f=mode==='night'?480:1600+Math.random()*1400;
    for(let i=0;i<3;i++){
      const osc=audio.createOscillator(),g=audio.createGain();osc.type='sine';
      osc.frequency.setValueAtTime(f,now+i*.14);osc.frequency.exponentialRampToValueAtTime(f*1.45,now+i*.14+.055);osc.frequency.exponentialRampToValueAtTime(f*.9,now+i*.14+.12);
      g.gain.setValueAtTime(0,now+i*.14);g.gain.linearRampToValueAtTime(.035,now+i*.14+.02);g.gain.exponentialRampToValueAtTime(.0001,now+i*.14+.13);
      osc.connect(g).connect(master);osc.start(now+i*.14);osc.stop(now+i*.14+.15);
    }
  }
  function updateSound(){
    if(!audio)return;const now=audio.currentTime;
    windGain.gain.setTargetAtTime(.07+wind*.12,now,.5);
    rainGain.gain.setTargetAtTime(mode==='rain'?.32:.025,now,.7);
  }
  $('#sound').addEventListener('click',async()=>{
    try{
      if(!audio){
        audio=new (window.AudioContext||window.webkitAudioContext)();master=audio.createGain();master.gain.value=.65;master.connect(audio.destination);
        windGain=noise(audio,650,.1);rainGain=noise(audio,3200,.03);
      }
      sound=!sound;if(sound){await audio.resume();updateSound();chirp();birdTimer=setInterval(chirp,4400);}else{clearInterval(birdTimer);await audio.suspend();}
      $('#sound').setAttribute('aria-pressed',sound);$('#sound').setAttribute('aria-label',sound?'关闭自然声音':'开启自然声音');
      toast(sound?'自然声音已开启':'自然声音已关闭');
    }catch{sound=false;toast('当前窗口暂时无法播放声音。');}
  });
  function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<650?1.5:1.65));}
  addEventListener('resize',resize);
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();toast('图形上下文已暂停，恢复后将继续。');});
  renderer.domElement.addEventListener('webglcontextrestored',()=>toast('场景已恢复'));
  document.addEventListener('visibilitychange',()=>{last=performance.now();if(audio&&sound){if(document.hidden)audio.suspend();else audio.resume();}});
  function animate(now){
    requestAnimationFrame(animate);
    if(document.hidden)return;
    const dt=Math.min((now-last)/1000,.06);last=now;
    if(!paused)elapsed+=dt;
    if(transition){
      renderer.shadowMap.needsUpdate=true;
      const k=clamp01((now-transition.start)/1900),ease=k*k*(3-2*k);
      for(const key of numKeys)weather[key]=T.MathUtils.lerp(transition.from[key],transition.to[key],ease);
      for(const key of colorKeys)weather[key]='#'+new T.Color(transition.from[key]).lerp(new T.Color(transition.to[key]),ease).getHexString();
      weather.pos=transition.from.pos.map((v,i)=>T.MathUtils.lerp(v,transition.to.pos[i],ease));
      if(k===1)transition=null;
    }
    scene.background.set(weather.sky);scene.fog.color.set(weather.fog);scene.fog.density=weather.density;
    sun.color.set(weather.light);sun.intensity=weather.sun;sun.position.set(...weather.pos);hemi.intensity=weather.hemi;
    renderer.toneMappingExposure=weather.exposure;porchLight.intensity=Math.max(weather.night,weather.dusk*.6,weather.rain*.25)*11;
    sunBall.visible=weather.rain<.1&&mode!=='fog'&&weather.night<.1;sunBall.material.color.set(weather.light);sunBall.position.y=T.MathUtils.lerp(43,14,weather.dusk);
    moon.visible=weather.night>.5;
    world.update(elapsed,paused?0:dt,weather,wind);
    if(move){
      const k=clamp01((now-move.start)/move.duration),e=k*k*(3-2*k);
      camera.position.lerpVectors(move.from,move.to,e);controls.target.lerpVectors(move.fromTarget,move.toTarget,e);
      if(k===1)move=null;
    }
    controls.autoRotate=touring&&!paused;controls.update(dt);renderer.render(scene,camera);
    frameCount++;if(now-lastFps>1000){fps=Math.round(frameCount*1000/(now-lastFps));frameCount=0;lastFps=now;}
    if(!ready){ready=true;window.__FOREST__.ready=true;$('#loader').style.opacity='0';setTimeout(()=>$('#loader').style.display='none',900);}
  }
  const clamp01=n=>Math.min(1,Math.max(0,n));
  window.__FOREST__={
    ready:false,setWeather,setView,
    snapshot:()=>({ready,weather:mode,view,paused,touring,sound,wind,elapsed,fps,camera:camera.position.toArray(),target:controls.target.toArray(),fogDensity:scene.fog.density,night:weather.night,rain:weather.rain,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,counts:world.counts,canvas:{width:renderer.domElement.width,height:renderer.domElement.height},webgl:renderer.getContext().isContextLost()?'lost':'active'}),
    animalScreenPosition:(kind)=>{const a=world.animals.find(a=>a.kind===kind);if(!a)return null;const p=a.root.position.clone().add(new T.Vector3(0,.45,0)).project(camera);return {x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};}
  };
  requestAnimationFrame(animate);
}
