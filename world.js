import * as T from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

export function createForest(scene) {
  let seed = 21731;
  const rand = () => {seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296;};
  const r = (a,b) => a + (b-a)*rand();
  const pick = a => a[Math.floor(rand()*a.length)];
  const clamp = T.MathUtils.clamp;
  const dummy = new T.Object3D(), batches = new Map();
  const mobile = innerWidth < 650;
  const sphere = new T.SphereGeometry(1,mobile?9:12,mobile?6:8);
  const ico = new T.IcosahedronGeometry(1,1);
  const box = new T.BoxGeometry(1,1,1);
  const cylinder = new T.CylinderGeometry(1,1,1,8);
  const cone = new T.ConeGeometry(1,1,9);
  const mats = {};
  const mat = (name,color,extra={}) => mats[name] ||= new T.MeshStandardMaterial({color,roughness:.88,...extra});
  const wood = mat('wood','#795133'), woodLight = mat('woodLight','#b07c47'), woodDark = mat('woodDark','#543a2b');
  const cream = mat('cream','#e7d7a3'), dark = mat('dark','#28352f'), stone = mat('stone','#8b9690');
  const greens = ['#345c36','#416d38','#557e3f','#69934b','#82a44f','#8bad52'].map((c,i)=>mat('green'+i,c));
  const grasses = ['#617f37','#83a544','#91ae4c','#577634'].map((c,i)=>mat('grass'+i,c,{side:T.DoubleSide}));
  const windows = mat('windows','#f4c67a',{emissive:'#ffc369',emissiveIntensity:.3,roughness:.22});
  const glass = mat('glass','#a4d8d4',{metalness:.18,roughness:.23});
  const terracotta = mat('pot','#b47550'), leaves = mat('leaves','#3f833e',{side:T.DoubleSide});
  const roofMats = ['#39564c','#486856','#547965','#648776'].map((c,i)=>mat('roof'+i,c));
  const windUniform = {value:.35}, timeUniform = {value:0};
  function windMaterial(m,strength) {
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = timeUniform; sh.uniforms.uWind = windUniform;
      sh.vertexShader = 'uniform float uTime;uniform float uWind;\n'+sh.vertexShader;
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        #ifdef USE_INSTANCING
        vec3 wp=instanceMatrix[3].xyz;
        float w=sin(uTime*1.4+wp.x*.63+wp.z*.42)+.45*sin(uTime*2.1+wp.z);
        transformed.x += w*uWind*${strength.toFixed(3)}*max(0.0,position.y);
        #endif`);
    };
    m.customProgramCacheKey = ()=>`wind-${strength}`;
    return m;
  }
  grasses.forEach(m=>windMaterial(m,.65));
  greens.forEach(m=>windMaterial(m,.06));
  function batch(g,m,p,s=[1,1,1],rot=[0,0,0],shadow=true) {
    const key=g.uuid+m.uuid+(shadow?'s':'n');
    if(!batches.has(key))batches.set(key,{g,m,items:[],shadow});
    dummy.position.set(...p);dummy.scale.set(...s);dummy.rotation.set(rot[0]||0,rot[1]||0,rot[2]||0);dummy.updateMatrix();
    batches.get(key).items.push(dummy.matrix.clone());
  }
  function mesh(g,m,parent,p=[0,0,0],s=[1,1,1],rot=[0,0,0]) {
    const o=new T.Mesh(g,m);o.position.set(...p);o.scale.set(...s);o.rotation.set(...rot);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
  }
  function beam(a,b,width,material=wood,round=false) {
    const av=new T.Vector3(...a),bv=new T.Vector3(...b),mid=av.clone().add(bv).multiplyScalar(.5);
    dummy.position.copy(mid);dummy.scale.set(width,av.distanceTo(bv),width);
    dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bv.sub(av).normalize());dummy.updateMatrix();
    const g=round?cylinder:box,key=g.uuid+material.uuid+'s';
    if(!batches.has(key))batches.set(key,{g,m:material,items:[],shadow:true});
    batches.get(key).items.push(dummy.matrix.clone());
  }
  const height=(x,z)=>.12*Math.sin(x*.35)+.13*Math.sin(z*.44)+.08*Math.sin(x*.7+z*.34);
  const riverX=z=>9.8+Math.sin(z*.19)*2.2+Math.cos(z*.41)*.7;
  const pathX=z=>-1+Math.sin((z+1)*.27)*1.7;
  const isPath=(x,z)=>z>-.7 && z<18 && Math.abs(x-pathX(z))<1.05;
  const isCabin=(x,z)=>x>-5.4&&x<3.5&&z>-6.8&&z<1;
  const land = new T.PlaneGeometry(180,180,140,140);land.rotateX(-Math.PI/2);
  const pa=land.attributes.position;
  const col=[];
  for(let i=0;i<pa.count;i++){
    const x=pa.getX(i),z=pa.getZ(i),outside=clamp((Math.hypot(x,z)-20)/45,0,1);
    pa.setY(i,height(x,z)+outside*(Math.sin(x*.12)*Math.cos(z*.1)+1)*2.5);
    const c=new T.Color().setHSL(.235+r(-.015,.015),.31+r(0,.1),.32+r(0,.055)).convertSRGBToLinear();
    col.push(c.r,c.g,c.b);
  }
  land.setAttribute('color',new T.Float32BufferAttribute(col,3));land.computeVertexNormals();
  mesh(land,new T.MeshStandardMaterial({vertexColors:true,roughness:1}),scene).castShadow=false;
  // Creek: continuous ribbon, river banks, stepping stones, lilies.
  const ribbon=[],riverUvs=[],indices=[];
  for(let i=0;i<=100;i++){
    const z=-40+i*.8,x=riverX(z),width=1.05+.3*Math.sin(z*.13);
    ribbon.push(x-width,-.02,z,x+width,-.02,z);riverUvs.push(0,i/4,1,i/4);
    if(i<100){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(ribbon,3));wg.setAttribute('uv',new T.Float32BufferAttribute(riverUvs,2));wg.setIndex(indices);wg.computeVertexNormals();
  const waterMat=new T.MeshStandardMaterial({color:'#77bcb2',roughness:.2,metalness:.25,transparent:true,opacity:.9,side:T.DoubleSide});
  waterMat.onBeforeCompile=sh=>{
    sh.uniforms.uTime=timeUniform;sh.vertexShader='uniform float uTime;\nvarying vec3 vWater;\n'+sh.vertexShader;
    sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWater=position;transformed.y+=sin(position.z*2.+uTime*1.1)*.018;');
    sh.fragmentShader='uniform float uTime;\nvarying vec3 vWater;\n'+sh.fragmentShader;
    sh.fragmentShader=sh.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat ripple=pow(max(0.,sin(vWater.z*8.+sin(vWater.x*7.+uTime)-uTime*2.)),16.);diffuseColor.rgb+=ripple*.17;');
  };
  mesh(wg,waterMat,scene).castShadow=false;
  for(let i=0;i<190;i++){
    const z=r(-32,30),side=rand()>.5?1:-1,x=riverX(z)+side*r(1.04,1.45);
    batch(ico,rand()>.6?stone:mat('mossStone','#6c805c'),[x,height(x,z)-.08,z],[r(.25,.6),r(.18,.4),r(.25,.65)],[r(0,1),r(0,6),r(0,.3)]);
  }
  const rippleMat = new T.MeshBasicMaterial({color:'#d7efe1',transparent:true,opacity:.3,side:T.DoubleSide,depthWrite:false});
  const ripples=[];
  for(let i=0;i<13;i++){
    const z=r(-15,19),o=mesh(new T.RingGeometry(.2,.215,32),rippleMat,scene,[riverX(z),.055,z],[1,1,1],[-Math.PI/2,0,0]);o.castShadow=false;ripples.push(o);
  }
  for(let i=0;i<19;i++){
    const z=r(3,15),x=riverX(z)+r(-.7,.7);
    batch(cylinder,mat('lily','#59955d'),[x,.06,z],[.22,.025,.2],[0,r(0,6),0],false);
    if(i%4===0)for(let j=0;j<7;j++){const a=j*Math.PI*2/7;batch(sphere,mat('lotus','#edb9be'),[x+Math.cos(a)*.06,.12,z+Math.sin(a)*.06],[.045,.08,.025],[Math.cos(a)*.6,a,Math.sin(a)*.6]);}
  }
  // Meandering gravel lane with individual weathered flagstones.
  for(let i=0;i<34;i++){
    const z=.2+i*.46,x=pathX(z)+r(-.15,.15);
    batch(ico,mat('path','#beb9a0'),[x,height(x,z)+.025,z],[r(.65,.9),.08,r(.4,.55)],[0,r(0,3),0]);
    if(i%3===0)batch(ico,stone,[x+r(-1,1),height(x,z)+.05,z+.25],[.14,.08,.12]);
  }
  // Cottage, aligned toward the flower meadow (+Z).
  const cx=-1.6,cz=-3.7;
  for(let row=0;row<3;row++)for(let j=0;j<11;j++){
    batch(box,rand()>.4?stone:mat('warmStone','#a8a58e'),[cx-3.2+j*.64,.16+row*.22,cz+2.5],[.61,.2,.55],[0,r(-.025,.025),0]);
    batch(box,stone,[cx+3.2,.16+row*.22,cz-2.25+j*.48],[.5,.2,.45]);
  }
  batch(box,wood,[cx,2.25,cz],[6.4,3.4,4.9]);
  for(let i=0;i<16;i++){
    const y=.7+i*.205;
    batch(box,i%3?woodLight:mat('plank','#a47141'),[cx,y,cz+2.49],[6.36,.18,.13]);
    batch(box,i%3?wood:woodLight,[cx+3.24,y,cz],[.13,.18,4.98]);
    batch(box,wood,[cx-3.24,y,cz],[.13,.18,4.98]);
    batch(box,wood,[cx,y,cz-2.5],[6.36,.18,.13]);
  }
  for(const x of [-3.12,3.12])for(const z of [-2.4,2.51])batch(box,woodDark,[cx+x,2.2,cz+z],[.24,3.5,.24]);
  const gable=new T.BufferGeometry();
  gable.setAttribute('position',new T.Float32BufferAttribute([-3.2,0,0,3.2,0,0,0,2.6,0],3));gable.computeVertexNormals();
  batch(gable,mat('gable','#bc905b',{side:T.DoubleSide}),[cx,3.9,cz+2.51]);
  batch(gable,wood,[cx,3.9,cz-2.51],[1,1,1],[0,Math.PI,0]);
  for(let i=-6;i<=6;i++){let x=i*.44,h=2.6-Math.abs(x)*.8125;batch(box,woodLight,[cx+x,3.9+h/2,cz+2.55],[.055,h,.06]);}
  const roofAngle=Math.atan2(2.6,3.65),slope=Math.hypot(2.6,3.65);
  for(const side of [-1,1]){
    batch(box,roofMats[0],[cx+side*1.82,5.17,cz],[slope+.2,.18,6.2],[0,0,-side*roofAngle]);
    for(let row=0;row<12;row++)for(let j=0;j<16;j++){
      const u=(row+.45)/12;
      batch(box,pick(roofMats),[cx+side*(u*3.7),6.52-u*2.64+.065,cz-3+(j+(row%2)*.35)*.39],[.39,.08,.43],[0,0,-side*roofAngle]);
    }
    for(const z of [-3.08,3.08])beam([cx,6.6,cz+z],[cx+side*3.8,3.92,cz+z],.18,woodDark);
    beam([cx+side*3.75,3.98,cz-3.1],[cx+side*3.75,3.98,cz+3.1],.16,woodDark);
  }
  beam([cx,6.65,cz-3.14],[cx,6.65,cz+3.14],.16,roofMats[1],true);
  // Brick chimney with a dark open top.
  const chimney=[cx+1.7,6,cz-.9];
  batch(box,stone,chimney,[.75,3,.8]);
  for(let row=0;row<10;row++)for(let j=0;j<2;j++)batch(box,row%3?mat('brick','#98755c'):mat('brick2','#bd9473'),[chimney[0]-.2+j*.4,5+row*.25,chimney[2]+.41],[.38,.23,.06]);
  batch(box,woodDark,[chimney[0],7.55,chimney[2]],[.95,.16,1]);
  batch(box,dark,[chimney[0],7.65,chimney[2]],[.62,.03,.65]);
  const frontZ=cz+2.62;
  // Door and brass handle.
  batch(box,woodDark,[cx,.65+1.25,frontZ],[1.25,2.5,.18]);
  batch(box,mat('door','#527a65'),[cx,1.83,frontZ+.11],[1.06,2.25,.12]);
  for(let i=0;i<6;i++)batch(box,mat('doorLine','#395d4d'),[cx-.44+i*.176,1.8,frontZ+.18],[.018,2.1,.02]);
  batch(box,windows,[cx,2.45,frontZ+.2],[.6,.52,.05]);
  for(const x of [-.33,0,.33])batch(box,cream,[cx+x,2.45,frontZ+.24],[.045,.58,.05]);
  batch(box,cream,[cx,2.45,frontZ+.24],[.68,.035,.05]);
  batch(sphere,mat('brass','#c4a04f',{metalness:.7,roughness:.3}),[cx+.37,1.58,frontZ+.27],[.06,.06,.06]);
  function windowFront(x,y,w=1.25,h=1.2) {
    batch(box,woodDark,[x,y,frontZ+.04],[w+.25,h+.24,.22]);
    batch(box,windows,[x,y,frontZ+.17],[w,h,.04]);
    batch(box,cream,[x,y,frontZ+.22],[.065,h+.1,.07]);batch(box,cream,[x,y,frontZ+.23],[w+.1,.07,.07]);
    for(const side of [-1,1]){
      batch(box,mat('shutter','#77916a'),[x+side*(w/2+.32),y,frontZ+.04],[.43,h+.2,.12],[0,side*.13,0]);
      for(let j=0;j<5;j++)batch(box,roofMats[1],[x+side*(w/2+.32),y-h*.4+j*h*.2,frontZ+.13],[.35,.035,.03]);
    }
    batch(box,woodLight,[x,y-h/2-.13,frontZ+.34],[w+.3,.14,.5]);
    batch(box,woodDark,[x,y-h/2-.3,frontZ+.4],[w+.1,.25,.32]);
    for(let i=0;i<7;i++){
      const fx=x+r(-w/2,w/2),fy=y-h/2+r(-.05,.2);
      batch(sphere,leaves,[fx,fy,frontZ+.4],[.17,.2,.19]);
      batch(sphere,mat('geranium','#cf797c'),[fx,fy+.16,frontZ+.48],[.09,.09,.09]);
    }
  }
  windowFront(cx-2,2.38);windowFront(cx+2,2.38);
  batch(cylinder,woodDark,[cx,4.94,frontZ],[.57,.13,.57],[Math.PI/2,0,0]);
  batch(cylinder,windows,[cx,4.94,frontZ+.08],[.44,.05,.44],[Math.PI/2,0,0]);
  batch(box,cream,[cx,4.94,frontZ+.13],[.06,.86,.06]);batch(box,cream,[cx,4.94,frontZ+.14],[.86,.06,.06]);
  // Side window.
  batch(box,woodDark,[cx+3.35,2.4,cz],[.18,1.6,1.55]);batch(box,glass,[cx+3.46,2.4,cz],[.03,1.35,1.3]);
  batch(box,cream,[cx+3.5,2.4,cz],[.04,.07,1.4]);batch(box,cream,[cx+3.5,2.4,cz],[.04,1.4,.07]);
  // Porch, a bench, lanterns and pots.
  for(let i=0;i<19;i++)batch(box,woodLight,[cx-3+i*.333,.58,.15],[.315,.17,2.25]);
  for(let i=0;i<3;i++)batch(box,woodLight,[cx,.15+i*.15,1.1-i*.25],[1.8,.18,.6]);
  for(const x of [-4.5,1.3]){
    batch(box,woodDark,[x,1.01,.95],[.13,.9,.13]);
    batch(sphere,cream,[x,1.52,.95],[.12,.1,.12]);
  }
  for(const side of [-1,1]){
    const x=cx+side*2.3;
    beam([x-.65,1.3,.85],[x+.65,1.3,.85],.09,woodLight);
    for(let j=0;j<5;j++)batch(box,woodLight,[x-.6+j*.3,1.02,.85],[.06,.6,.06]);
  }
  batch(box,wood,[cx+2.2,.99,-.1],[1.7,.12,.53]);
  batch(box,woodLight,[cx+2.2,1.44,-.35],[1.7,.42,.1],[.1,0,0]);
  for(const x of [cx+1.6,cx+2.8])batch(box,woodDark,[x,.78,-.1],[.1,.48,.4]);
  const glowMeshes=[];
  for(const x of [cx-.94,cx+.94]){
    beam([x,2.86,frontZ],[x,2.86,frontZ+.4],.05,dark);
    batch(box,dark,[x,2.4,frontZ+.38],[.27,.4,.25]);
    const m=mesh(box,windows,scene,[x,2.4,frontZ+.4],[.2,.3,.2]);glowMeshes.push(m);
    batch(cone,dark,[x,2.66,frontZ+.4],[.22,.17,.22]);
  }
  for(const [x,z]of[[-4.5,.3],[1.3,.4],[2.5,-2.6]]){
    batch(cylinder,terracotta,[x,.73,z],[.3,.5,.3]);batch(cylinder,woodDark,[x,1,z],[.3,.03,.3]);
    for(let j=0;j<6;j++){const a=j*1.1;batch(sphere,leaves,[x+Math.cos(a)*.15,1.15+r(0,.22),z+Math.sin(a)*.15],[.12,.25,.1],[0,a,.4]);}
  }
  const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=192;const ctx=signCanvas.getContext('2d');
  ctx.fillStyle='#b88d55';ctx.fillRect(0,0,512,192);ctx.strokeStyle='#765430';ctx.lineWidth=8;ctx.strokeRect(12,12,488,168);ctx.fillStyle='#443b28';ctx.font='bold 70px SimSun, serif';ctx.textAlign='center';ctx.fillText('霖林小屋',256,118);
  const signMat=new T.MeshStandardMaterial({map:new T.CanvasTexture(signCanvas),roughness:.95});
  mesh(new T.PlaneGeometry(1.35,.5),signMat,scene,[cx,3.45,frontZ+.2]);
  // Fences border the meadow, with a little entry and a mailbox.
  function fence(points){
    for(let i=0;i<points.length;i++){
      const [x,z]=points[i],y=height(x,z);
      batch(box,woodLight,[x,y+.56,z],[.15,1.1,.15]);batch(cone,woodLight,[x,y+1.15,z],[.13,.16,.13],[0,Math.PI/4,0]);
      if(i){const [px,pz]=points[i-1],py=height(px,pz);for(const h of [.42,.86])beam([px,py+h,pz],[x,y+h,z],.09,woodLight);}
    }
  }
  fence(Array.from({length:11},(_,i)=>[-10.9+i*.87,9.5+Math.sin(i*.28)*.5]));
  fence(Array.from({length:10},(_,i)=>[-10.9,-.5+i*1.1]));
  fence(Array.from({length:6},(_,i)=>[2.6+i*.8,9.5-i*.2]));
  batch(box,wood,[1.7,.7,8.6],[.14,1.5,.14]);
  batch(box,roofMats[1],[1.7,1.52,8.6],[.58,.45,.62]);
  batch(box,woodDark,[1.7,1.52,8.94],[.46,.07,.02]);
  beam([1.95,1.6,8.6],[1.95,2,8.6],.035,mat('red','#c16e51'));
  batch(box,mats.red,[2.07,1.94,8.6],[.24,.13,.04]);
  // Rustic footbridge across the creek.
  for(let i=0;i<15;i++){const x=riverX(1.2)-1.8+i*.25,y=.28+Math.sin(i/14*Math.PI)*.28;batch(box,woodLight,[x,y,1.2],[.24,.14,1.5]);}
  for(const z of [.4,2])for(const x of [riverX(1.2)-1.75,riverX(1.2),riverX(1.2)+1.75])batch(box,wood,[x,.9,z],[.12,1.35,.12]);
  for(const z of [.4,2])for(const off of [-1.75,0])beam([riverX(1.2)+off,1.35,z],[riverX(1.2)+off+1.75,1.35,z],.09,woodLight);
  // Firewood under the eaves.
  for(let row=0;row<3;row++)for(let i=0;i<6-row;i++){
    const x=2.1+row*.11+i*.24,y=.35+row*.24;
    batch(cylinder,woodDark,[x,y,-5.6],[.13,.85,.13],[Math.PI/2,0,0]);
    batch(cylinder,cream,[x,y,-5.16],[.102,.02,.102],[Math.PI/2,0,0]);
  }
  // Tall broadleaf trees: tapered trunks, visible boughs, irregular leaf clusters.
  const treeRoots=[];
  function tree(x,z,h,size=1){
    const y=height(x,z);treeRoots.push([x,z,h]);
    beam([x,y,z],[x+.1,y+h*.73,z-.1],h*.057,wood,true);
    for(let i=0;i<5;i++){let a=i*1.26;beam([x,y+.4,z],[x+Math.cos(a)*.75*size,y-.05,z+Math.sin(a)*.75*size],.19,wood,true);}
    for(let branch=0;branch<6;branch++){
      let a=branch*2.4+r(-.3,.3),len=r(1.1,2.3)*size,by=y+h*(.43+branch*.055);
      let ex=x+Math.cos(a)*len,ez=z+Math.sin(a)*len,ey=by+r(1.1,2);
      beam([x,by,z],[ex,ey,ez],.14*size,wood,true);
      for(let k=0;k<11;k++){
        let ca=r(0,6.28),rad=r(0,1.35)*size;
        batch(ico,pick(greens),[ex+Math.cos(ca)*rad,ey+r(.1,1.6)*size,ez+Math.sin(ca)*rad],[r(.55,1.08)*size,r(.48,.85)*size,r(.55,1.05)*size],[r(0,3),r(0,3),r(0,3)]);
      }
    }
    for(let i=0;i<12;i++)batch(ico,pick(greens),[x+r(-1.1,1.1)*size,y+h+r(-.3,.7),z+r(-1,1)*size],[r(.7,1.3)*size,r(.6,1)*size,r(.7,1.3)*size],[r(0,3),r(0,3),0]);
  }
  tree(-8,-2,8.2,1.05);tree(5.1,-4,9,1.15);tree(-7.5,-10,10,1.2);
  tree(3.4,-11,11,1.3);tree(12,-7,10.5,1.25);tree(-13,3,8.7,1.15);
  tree(-15,-6,10,1.1);tree(15,3,9.8,1.1);tree(16,-14,12,1.3);
  tree(-14,-16,12,1.35);tree(-3,-17,10,1.3);tree(7,-18,12.2,1.25);
  function pine(x,z,h){
    const y=height(x,z);
    batch(cylinder,wood,[x,y+h*.35,z],[.16,h*.7,.16]);
    for(let i=0;i<5;i++)batch(cone,greens[i%3],[x,y+h*(.35+i*.13),z],[h*(.25-i*.035),h*.42,h*(.25-i*.035)],[0,r(0,6),0]);
  }
  for(let i=0;i<90;i++){
    const a=r(-Math.PI,0),rr=r(24,62),x=Math.cos(a)*rr,z=Math.sin(a)*rr;
    pine(x,z,r(7,12.5));
  }
  for(let i=0;i<18;i++){let side=i%2?1:-1;pine(side*r(21,38),r(-15,26),r(7,11));}
  // Mossy stones, shrubs, ferns and forest floor.
  for(let i=0;i<120;i++){
    const x=r(-20,19),z=r(-19,18);if(isCabin(x,z)||isPath(x,z)||Math.abs(x-riverX(z))<1.7)continue;
    if(rand()>.55)batch(ico,pick(greens),[x,height(x,z)+.18,z],[r(.35,.7),r(.25,.55),r(.3,.7)]);
    else batch(ico,rand()>.5?stone:mats.mossStone,[x,height(x,z),z],[r(.3,.65),r(.2,.45),r(.25,.6)],[r(0,.5),r(0,6),r(0,.4)]);
  }
  const blade=new T.BufferGeometry();
  blade.setAttribute('position',new T.Float32BufferAttribute([-.045,0,0,.045,0,0,-.024,.36,.025,.025,.36,.025,.04,.68,.06],3));blade.setIndex([0,1,2,1,3,2,2,3,4]);blade.computeVertexNormals();
  for(let i=0;i<(mobile?10000:14000);i++){
    const x=r(-23,23),z=r(-21,21);if(isCabin(x,z)||isPath(x,z)||Math.abs(x-riverX(z))<1.28)continue;
    const h=r(.3,.9)*(z>0?.65:1);
    batch(blade,pick(grasses),[x,height(x,z),z],[r(.6,1.3),h,r(.6,1.3)],[0,r(0,6.28),r(-.16,.16)],false);
  }
  const leafG=new T.SphereGeometry(1,7,4);
  for(let i=0;i<110;i++){
    const x=r(-17,17),z=r(-15,17);if(isCabin(x,z)||isPath(x,z)||Math.abs(x-riverX(z))<1.7)continue;
    const y=height(x,z);
    for(let j=0;j<6;j++){
      const a=j*1.047;
      for(let k=1;k<=4;k++)for(const side of [-1,1]){
        let d=k*.08;batch(leafG,leaves,[x+Math.cos(a)*d+Math.sin(a)*side*.055,y+.3-d*.4,z+Math.sin(a)*d-Math.cos(a)*side*.055],[.04,.015,.12],[.1,a+side*.45,.25]);
      }
    }
  }
  // Hundreds of sunflowers, varied in height, each with two whorls of petals.
  const stalkMat=mat('stalk','#427531'),petalMats=['#efba2d','#f4cb44','#e9ad21'].map((c,i)=>mat('petal'+i,c));
  const heartMat=mat('heart','#68432b'),seedMat=mat('seed','#ac8050');
  const flowerCenters=[];
  for(let i=0;i<240;i++){
    const x=r(-10,-2.1),z=r(.3,8.9);
    if(Math.abs(x-pathX(z))<1.4)continue;
    const y=height(x,z),h=r(1.15,2.2),head=.24+r(0,.1),lean=r(-.09,.09),angle=r(-.32,.28);
    const hx=x+lean,hy=y+h,hz=z;
    beam([x,y,z],[hx,hy,hz],.029,stalkMat,true);
    for(let j=0;j<3;j++){
      const side=j%2?1:-1;batch(leafG,leaves,[x+side*.16,y+h*(.28+j*.17),z],[.13,.035,.3],[side*.25,side*.9,side*.5]);
    }
    // Front faces generally toward the clearing; flower disks face +Z.
    batch(sphere,heartMat,[hx,hy,hz],[head*.57,head*.57,.075],[angle,0,0]);
    batch(sphere,seedMat,[hx,hy,hz+.063],[head*.43,head*.43,.026]);
    for(let ring=0;ring<2;ring++)for(let j=0;j<12;j++){
      let a=j*Math.PI/6+ring*.26,rr=head*(ring?.66:.77);
      batch(leafG,petalMats[(i+ring)%3],[hx+Math.sin(a)*rr,hy+Math.cos(a)*rr,hz+(ring?.03:-.02)],[head*.23,head*.54,.045],[angle,0,-a]);
    }
    if(i%3===0)for(let j=0;j<9;j++){let a=j*2.4,rr=head*.32*Math.sqrt(j/9);batch(sphere,heartMat,[hx+Math.cos(a)*rr,hy+Math.sin(a)*rr,hz+.088],[.014,.017,.008],[],false);}
    flowerCenters.push(new T.Vector3(hx,hy,hz));
  }
  // Smaller sunflower patch to the right of the path.
  for(let i=0;i<45;i++){
    const x=r(2.8,6.7),z=r(3.4,8),y=height(x,z),h=r(.9,1.65),head=.23;
    beam([x,y,z],[x,y+h,z],.025,stalkMat,true);
    batch(sphere,heartMat,[x,y+h,z],[.135,.135,.065]);
    for(let j=0;j<11;j++){let a=j*6.28/11;batch(leafG,petalMats[i%3],[x+Math.sin(a)*head*.7,y+h+Math.cos(a)*head*.7,z],[.055,.13,.035],[0,0,-a]);}
    batch(leafG,leaves,[x+.1,y+h*.5,z],[.09,.03,.24],[0,.6,.5]);flowerCenters.push(new T.Vector3(x,y+h,z));
  }
  // Meadow daisies, cornflowers, buttercups, mushrooms.
  const bloomMats=['#e9e9c9','#c6b5d9','#d4b553','#a8c4df'].map((c,i)=>mat('bloom'+i,c));
  for(let i=0;i<470;i++){
    const x=r(-16,16),z=r(-8,18);if(isCabin(x,z)||isPath(x,z)||Math.abs(x-riverX(z))<1.4)continue;
    const y=height(x,z),h=r(.18,.5);
    batch(cylinder,stalkMat,[x,y+h/2,z],[.012,h,.012],[],false);
    const m=pick(bloomMats);
    for(let j=0;j<5;j++){let a=j*6.28/5;batch(sphere,m,[x+Math.cos(a)*.055,y+h,z+Math.sin(a)*.055],[.047,.018,.035],[],false);}
    batch(sphere,petalMats[0],[x,y+h+.01,z],[.025,.02,.025],[],false);
  }
  const mushroomCap = new T.SphereGeometry(1,10,6,0,Math.PI*2,0,Math.PI*.55);
  for(let i=0;i<45;i++){
    const x=r(-12,13),z=r(-12,15);if(isCabin(x,z)||isPath(x,z)||Math.abs(x-riverX(z))<1.6)continue;
    const y=height(x,z),s=r(.13,.23);
    batch(cylinder,cream,[x,y+s*.6,z],[s*.22,s*1.2,s*.22]);
    batch(mushroomCap,mat('mushroom','#bc6550'),[x,y+s*1.1,z],[s,s*.55,s]);
    for(let j=0;j<4;j++)batch(sphere,cream,[x+r(-.6,.6)*s,y+s*1.55,z+r(-.4,.4)*s],[s*.12,s*.04,s*.12]);
  }
  // Tree-mounted animals with articulated heads and limbs.
  const animals=[],targets=[];
  function animal(kind,name,desc,pos,scale=1,rotation=0){
    const root=new T.Group();scene.add(root);root.position.set(...pos);root.scale.setScalar(scale);root.rotation.y=rotation;
    const head=new T.Group();root.add(head);
    const data={kind,name,desc,root,head,phase:r(0,6.28),base:root.position.clone(),focus:new T.Vector3(...pos),wave:0};
    animals.push(data);root.userData.animal=data;
    return data;
  }
  const black=mat('eyes','#192a25',{roughness:.3}),white=mat('white','#f3e6c6');
  const brown=mat('squirrel','#b47b43'),brownLight=mat('belly','#e1bc80');
  function eyes(group,x,y,z,s=.045){
    for(const side of [-1,1]){
      mesh(sphere,black,group,[side*x,y,z],[s,s*1.15,s*.7]);mesh(sphere,white,group,[side*x-s*.2,y+s*.3,z+s*.65],[s*.24,s*.24,s*.18]);
    }
  }
  function squirrel(pos,scale=1,rot=0){
    const a=animal('赤腹松鼠','栗栗','把松果藏在树枝间，偶尔会停下来，摇摇尾巴和你打个招呼。',pos,scale,rot),g=a.root;
    mesh(sphere,brown,g,[0,.35,0],[.24,.37,.22]);mesh(sphere,brownLight,g,[0,.34,.17],[.16,.25,.075]);
    a.head.position.set(0,.69,.06);mesh(sphere,brown,a.head,[0,0,0],[.24,.23,.22]);
    mesh(sphere,brownLight,a.head,[0,-.07,.18],[.13,.09,.11]);mesh(sphere,black,a.head,[0,-.025,.275],[.045,.028,.025]);eyes(a.head,.095,.04,.195,.036);
    for(const side of [-1,1]){
      mesh(cone,brown,a.head,[side*.16,.24,-.015],[.08,.23,.065],[0,0,-side*.15]);
      mesh(sphere,brown,g,[side*.19,.08,.12],[.12,.09,.17]);
      mesh(sphere,brown,g,[side*.18,.38,.2],[.09,.16,.08],[0,0,side*.45]);
    }
    const tail=new T.Group();g.add(tail);tail.position.set(0,.13,-.14);
    mesh(sphere,brown,tail,[0,.3,-.23],[.21,.38,.23],[.45,0,0]);mesh(sphere,brown,tail,[0,.66,-.3],[.29,.35,.25],[-.4,0,0]);mesh(sphere,brownLight,tail,[0,.82,-.15],[.17,.17,.1]);
    a.tail=tail;mesh(sphere,woodDark,g,[0,.35,.31],[.09,.12,.08]);return a;
  }
  beam([-8,3.8,-2],[-5.5,4.8,-.55],.19,wood,true);
  squirrel([-6.1,4.65,-.8],1.1,.2);
  beam([5.1,4.3,-4],[7.2,5.1,-2],.18,wood,true);
  const owl=animal('领角鸮','咕咕','住在右边老树上的夜行邻居。白天慢慢眨眼，星夜里陪着小屋守望。',[6.6,5.04,-2.5],1.12,-.2);
  const om=mat('owl','#9b8664');mesh(sphere,om,owl.root,[0,.34,0],[.31,.4,.25]);owl.head.position.set(0,.76,0);mesh(sphere,om,owl.head,[0,0,0],[.36,.28,.26]);
  for(const side of [-1,1]){
    mesh(sphere,cream,owl.head,[side*.15,-.01,.2],[.16,.18,.07]);
    mesh(sphere,mat('iris','#d2a94e'),owl.head,[side*.15,.01,.26],[.085,.09,.035]);mesh(sphere,black,owl.head,[side*.15,.01,.29],[.045,.06,.025]);
    mesh(cone,om,owl.head,[side*.26,.25,0],[.12,.25,.1],[0,0,-side*.4]);
    mesh(sphere,wood,owl.root,[side*.28,.35,0],[.1,.3,.19],[0,0,side*.15]);mesh(sphere,woodLight,owl.root,[side*.13,.02,.11],[.1,.045,.1]);
  }
  mesh(cone,petalMats[0],owl.head,[0,-.1,.29],[.055,.13,.06],[Math.PI,0,0]);
  for(let j=0;j<3;j++)for(let k=0;k<3-j;k++)mesh(sphere,brownLight,owl.root,[-.13+k*.13+j*.065,.42-j*.12,.23],[.04,.06,.018]);
  function bird(pos,color,rot=0,scale=1){
    const a=animal('林间小鸟','青羽','枝头上的小歌手。听一会儿，树林里有它轻轻的啁啾。',pos,scale,rot),m=mat('bird'+color,color);
    mesh(sphere,m,a.root,[0,.16,0],[.19,.21,.3]);mesh(sphere,brownLight,a.root,[0,.15,.19],[.14,.14,.1]);
    a.head.position.set(0,.38,.12);mesh(sphere,m,a.head,[0,0,0],[.16,.17,.16]);eyes(a.head,.075,.02,.14,.027);
    mesh(cone,petalMats[0],a.head,[0,-.035,.22],[.06,.16,.05],[Math.PI/2,0,0]);
    for(const side of [-1,1])mesh(sphere,m,a.root,[side*.17,.2,-.05],[.08,.13,.26],[0,side*.2,side*.1]);
    mesh(cone,m,a.root,[0,.12,-.36],[.1,.35,.07],[-Math.PI/2-.3,0,0]);
    for(const x of [-.07,.07])mesh(cylinder,woodDark,a.root,[x,-.04,.05],[.018,.12,.018]);return a;
  }
  beam([-8,5.5,-2],[-10.2,6.2,-.2],.14,wood,true);
  bird([-9.7,6.15,-.6],'#719ead',.4,1.35);
  bird([-5.1,3.96,-.2],'#bd804d',-.5,1);
  bird([1.7,6.4,-4.2],'#719ead',.4,.9);
  squirrel([-12,.1,7],.9,-.3);
  const rabbit=animal('林地野兔','团团','喜欢石板路边的嫩草。看见蝴蝶时，它会抬头张望。',[2.4,height(2.4,5.1),5.1],1,.1);
  const rabbitMat=mat('rabbit','#e1d7ba');mesh(sphere,rabbitMat,rabbit.root,[0,.25,-.1],[.29,.3,.4]);rabbit.head.position.set(0,.47,.18);mesh(sphere,rabbitMat,rabbit.head,[0,0,0],[.24,.23,.23]);
  for(const side of [-1,1]){
    mesh(sphere,rabbitMat,rabbit.head,[side*.12,.35,-.015],[.075,.3,.07],[0,0,-side*.13]);
    mesh(sphere,mat('pink','#ceaaa0'),rabbit.head,[side*.12,.37,.046],[.04,.23,.015],[0,0,-side*.13]);
    mesh(sphere,rabbitMat,rabbit.root,[side*.22,.07,.1],[.14,.09,.22]);
  }
  eyes(rabbit.head,.13,.025,.19,.035);mesh(sphere,mats.pink,rabbit.head,[0,-.045,.23],[.04,.025,.025]);mesh(sphere,white,rabbit.root,[0,.25,-.45],[.13,.13,.13]);
  // Butterflies and honeybees orbit among sunflower heads.
  const flyers=[];
  const wingShape=new T.Shape();wingShape.moveTo(0,0);wingShape.bezierCurveTo(.08,.34,.48,.39,.4,.13);wingShape.bezierCurveTo(.38,.01,.21,-.04,.12,-.04);wingShape.bezierCurveTo(.35,-.14,.23,-.37,.07,-.22);wingShape.quadraticCurveTo(0,-.12,0,0);
  const wingGeo=new T.ShapeGeometry(wingShape,10);
  const butterColors=['#e5ba57','#a3c8df','#dc967c','#d0b5da'];
  for(let i=0;i<18;i++){
    const g=new T.Group();scene.add(g);
    const m=mat('butter'+i%4,butterColors[i%4],{side:T.DoubleSide,roughness:.6});
    const w1=mesh(wingGeo,m,g),w2=mesh(wingGeo,m,g);w2.scale.x=-1;
    mesh(sphere,woodDark,g,[0,0,0],[.025,.15,.025]);
    for(const side of [-1,1])mesh(sphere,cream,g,[side*.17,.15,.012],[.055,.065,.01]);
    g.scale.setScalar(r(.55,.9));
    flyers.push({g,w1,w2,phase:r(0,6.28),center:new T.Vector3(r(-9,6),r(1.5,3.1),r(1,9)),speed:r(.3,.65),type:'butterfly'});
  }
  const beeYellow=mat('bee','#deb547'),beeBlack=mat('beeBlack','#473f2a');
  const beeWing=new T.MeshStandardMaterial({color:'#e6f3e6',transparent:true,opacity:.64,side:T.DoubleSide,roughness:.2});
  for(let i=0;i<14;i++){
    const g=new T.Group();scene.add(g);g.scale.setScalar(.7);
    mesh(sphere,beeYellow,g,[0,0,0],[.16,.12,.24]);
    for(const z of [-.09,.07])mesh(new T.TorusGeometry(.116,.026,5,12),beeBlack,g,[0,0,z],[1.27,1,1]);
    mesh(sphere,beeBlack,g,[0,.015,.23],[.1,.09,.09]);
    const w1=mesh(sphere,beeWing,g,[-.16,.11,-.02],[.22,.025,.11],[0,0,-.4]);
    const w2=mesh(sphere,beeWing,g,[.16,.11,-.02],[.22,.025,.11],[0,0,.4]);
    flyers.push({g,w1,w2,phase:r(0,6.28),center:pick(flowerCenters).clone(),speed:r(.4,.8),type:'bee'});
  }
  // Cloud canopy and drifting smoke.
  const cloudMat=new T.MeshStandardMaterial({color:'#edf1de',roughness:1,transparent:true,opacity:.8,depthWrite:false});
  const clouds=[];
  for(let i=0;i<12;i++){
    const g=new T.Group();g.position.set(r(-55,55),r(23,32),r(-65,-24));scene.add(g);
    for(let j=0;j<7;j++)mesh(ico,cloudMat,g,[j*1.9,r(-.3,.5),r(-1,1)],[r(1.9,3),r(.7,1.3),r(1.1,2)]).castShadow=false;
    clouds.push(g);
  }
  const smokeMat=new T.MeshBasicMaterial({color:'#e7e7d4',transparent:true,opacity:.18,depthWrite:false});
  const smoke=[];
  for(let i=0;i<12;i++){const m=mesh(ico,smokeMat,scene,[chimney[0],7.8+i*.4,chimney[2]],[.2,.2,.2]);m.castShadow=false;smoke.push(m);}
  // Glowing points for fireflies and stars, rain streaks.
  const glowCanvas=document.createElement('canvas');glowCanvas.width=64;glowCanvas.height=64;
  const gc=glowCanvas.getContext('2d'),grad=gc.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(255,255,220,1)');grad.addColorStop(.18,'rgba(255,255,190,.9)');grad.addColorStop(.45,'rgba(255,250,130,.2)');grad.addColorStop(1,'rgba(255,250,130,0)');gc.fillStyle=grad;gc.fillRect(0,0,64,64);
  const glowTex=new T.CanvasTexture(glowCanvas);
  const ffPos=new Float32Array(110*3);const ffBase=[];
  for(let i=0;i<110;i++){ffBase.push([r(-16,16),r(.5,4),r(-11,17),r(0,6.28)]);}
  const ffGeo=new T.BufferGeometry();ffGeo.setAttribute('position',new T.BufferAttribute(ffPos,3));
  const ffMat=new T.PointsMaterial({map:glowTex,color:'#f6f1a1',size:.22,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending});
  scene.add(new T.Points(ffGeo,ffMat));
  const starsPos=[];
  for(let i=0;i<1000;i++){const v=new T.Vector3(r(-1,1),r(.08,1),r(-1,1)).normalize().multiplyScalar(85);starsPos.push(v.x,v.y,v.z);}
  const starGeo=new T.BufferGeometry();starGeo.setAttribute('position',new T.Float32BufferAttribute(starsPos,3));
  const starMat=new T.PointsMaterial({map:glowTex,color:'#edf4f3',size:.28,transparent:true,opacity:0,depthWrite:false,fog:false});
  scene.add(new T.Points(starGeo,starMat));
  const rainBase=Array.from({length:1400},()=>[r(-24,24),r(0,24),r(-20,22)]);
  const rainGeo=new T.BufferGeometry();rainGeo.setAttribute('position',new T.BufferAttribute(new Float32Array(1400*6),3));
  const rainMat=new T.LineBasicMaterial({color:'#c0dad4',transparent:true,opacity:0,depthWrite:false});
  const rainObj=new T.LineSegments(rainGeo,rainMat);rainObj.frustumCulled=false;scene.add(rainObj);
  // A suspended swing under the left tree.
  const swing=new T.Group();swing.position.set(-10.6,4.7,2.5);scene.add(swing);
  mesh(box,woodLight,swing,[0,-3.5,0],[1.1,.12,.45]);
  for(const x of [-.47,.47])mesh(cylinder,cream,swing,[x,-1.75,0],[.018,3.5,.018]);
  beam([-13,4.6,3],[-10.1,4.7,2.5],.15,wood,true);
  // Batching keeps the dense flora within a small number of draw calls.
  let instanceCount=0;
  for(const {g,m,items,shadow}of batches.values()){
    const inst=new T.InstancedMesh(g,m,items.length);items.forEach((matrix,i)=>inst.setMatrixAt(i,matrix));
    inst.castShadow=shadow;inst.receiveShadow=true;inst.computeBoundingSphere();scene.add(inst);instanceCount+=items.length;
  }
  // Merge rigid pieces per material, while retaining articulated heads and tails.
  function mergeRigid(group){
    const byMaterial=new Map();
    for(const child of [...group.children]){
      if(child.isGroup){mergeRigid(child);continue;}
      if(!child.isMesh||Array.isArray(child.material))continue;
      const key=child.material.uuid;
      if(!byMaterial.has(key))byMaterial.set(key,[]);
      byMaterial.get(key).push(child);
    }
    for(const items of byMaterial.values()){
      if(items.length<2)continue;
      const geos=items.map(o=>{o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();return g.applyMatrix4(o.matrix);});
      const merged=mergeGeometries(geos,false);
      if(merged){const m=mesh(merged,items[0].material,group);m.castShadow=items[0].castShadow;for(const o of items)group.remove(o);}
      geos.forEach(g=>g.dispose());
    }
  }
  clouds.forEach(mergeRigid);
  for(const a of animals){mergeRigid(a.root);a.root.traverse(o=>{if(o.isMesh){o.userData.animal=a;targets.push(o);}});}
  function update(t,dt,weather,wind){
    timeUniform.value=t;windUniform.value=wind;
    const night=weather.night,rain=weather.rain;
    windows.emissiveIntensity=T.MathUtils.lerp(.24,2.4,Math.max(night,weather.dusk*.6,rain*.35));
    ffMat.opacity=night*.95;starMat.opacity=night;rainMat.opacity=rain*.45;
    cloudMat.color.set(weather.cloud);
    for(let i=0;i<clouds.length;i++)clouds[i].position.x+=dt*(.12+wind*.24);
    for(let i=0;i<smoke.length;i++){
      const q=(t*.23+i/12)%1,m=smoke[i];m.position.set(chimney[0]+Math.sin(q*4+t*.2)*q*.4+q*wind*2,7.8+q*4,chimney[2]+q*.8);
      m.scale.setScalar(.13+q*.58);m.visible=q<.93;
    }
    ripples.forEach((m,i)=>{const q=(t*.3+i*.17)%1;m.scale.setScalar(.5+q*1.4);});
    swing.rotation.x=Math.sin(t*.9)*(.025+wind*.055);
    for(const a of animals){
      a.head.rotation.y=Math.sin(t*.65+a.phase)*.14;
      a.head.rotation.z=Math.sin(t*.43+a.phase)*.045;
      a.root.position.y=a.base.y+Math.sin(t*1.7+a.phase)*.015;
      if(a.tail)a.tail.rotation.z=Math.sin(t*2+a.phase)*(.08+a.wave*.18);
      a.wave=Math.max(0,a.wave-dt*.3);
      if(a.wave>0){a.head.rotation.y=Math.sin(t*3)*.2;a.root.position.y+=Math.abs(Math.sin(t*5))*.08*a.wave;}
    }
    owl.head.scale.y=1-Math.pow(Math.max(0,Math.sin(t*.67)),40)*.08;
    for(const f of flyers){
      const v=t*f.speed+f.phase;
      f.g.visible=night<.6&&rain<.8;
      if(f.type==='bee'){
        f.g.position.set(f.center.x+Math.cos(v)*.6,f.center.y+.3+Math.sin(v*2)*.18,f.center.z+.25+Math.sin(v)*.5);
        f.g.rotation.y=-v;f.w1.rotation.z=Math.sin(t*53+f.phase)*.7;f.w2.rotation.z=-f.w1.rotation.z;
      }else{
        f.g.position.set(f.center.x+Math.sin(v)*1.8,f.center.y+Math.sin(v*1.7)*.45,f.center.z+Math.cos(v*.8)*1.1);
        f.g.rotation.set(-.2,Math.cos(v)*.6,Math.sin(v)*.17);
        f.w1.rotation.y=Math.sin(t*10+f.phase)*1.0;f.w2.rotation.y=-f.w1.rotation.y;
      }
    }
    for(let i=0;i<ffBase.length;i++){const [x,y,z,p]=ffBase[i];ffPos[i*3]=x+Math.sin(t*.4+p)*.65;ffPos[i*3+1]=y+Math.sin(t*.7+p)*.3;ffPos[i*3+2]=z+Math.cos(t*.3+p)*.7;}
    ffGeo.attributes.position.needsUpdate=true;
    if(rain>.01){
      const pos=rainGeo.attributes.position;
      for(let i=0;i<rainBase.length;i++){const [x,y,z]=rainBase[i],yy=(y-t*10%24+24)%24;pos.setXYZ(i*2,x+yy*.1*wind,yy,z);pos.setXYZ(i*2+1,x+yy*.1*wind+.02,yy+.5,z);}
      pos.needsUpdate=true;
    }
  }
  return {update,animals,targets,counts:{sunflowers:flowerCenters.length,butterflies:18,bees:14,animals:animals.length,instances:instanceCount},height};
}
