// 120 BPM synthesized track, beat = 0.5s. Every cut in the edit sits on this grid.
const fs=require('fs');const SR=44100,DUR=15.2,N=Math.floor(SR*DUR);
const L=new Float32Array(N),R=new Float32Array(N);
let seed=1;const rn=()=>{seed=(seed*16807)%2147483647;return seed/2147483647*2-1};
const add=(i,v,pan=0)=>{if(i<0||i>=N)return;L[i]+=v*(1-Math.max(0,pan));R[i]+=v*(1+Math.min(0,pan));};
function kick(t0,a=1){let ph=0;const n=.4*SR,s=Math.floor(t0*SR);for(let i=0;i<n;i++){const t=i/SR,f=45+130*Math.exp(-t*32);ph+=2*Math.PI*f/SR;
  add(s+i,a*(Math.sin(ph)*Math.exp(-t*7)+ (i<60?rn()*.4*(1-i/60):0)));}}
function clap(t0,a=.55){const s=Math.floor(t0*SR);let y=0,px=0;for(let i=0;i<.3*SR;i++){const t=i/SR;
  const env=(t<.03?(Math.exp(-((t%.01)*300))):0)+Math.exp(-t*16);const x=rn();const hp=x-px;px=x;y+=.5*(hp-y);
  add(s+i,a*y*env*.8,.0);}}
function hat(t0,a=.18,dec=70,pan=.3){const s=Math.floor(t0*SR);let px=0;for(let i=0;i<.15*SR;i++){const t=i/SR,x=rn(),hp=x-px;px=x;add(s+i,a*hp*Math.exp(-t*dec),pan);}}
function impact(t0,a=1){const s=Math.floor(t0*SR);let ph=0,y=0;for(let i=0;i<2.2*SR;i++){const t=i/SR,f=55*Math.exp(-t*1.2)+22;ph+=2*Math.PI*f/SR;
  y+=.08*(rn()-y);add(s+i,a*(Math.sin(ph)*Math.exp(-t*2.2)*.9+y*3*Math.exp(-t*5)));}}
function snap(t0,a=.5){const s=Math.floor(t0*SR);let px=0;for(let i=0;i<.12*SR;i++){const t=i/SR,x=rn(),hp=x-px;px=x;add(s+i,a*(hp*.7+Math.sin(2*Math.PI*190*t)*.6)*Math.exp(-t*35));}}
function whoosh(t0,d=.35,a=.35){const s=Math.floor(t0*SR);let y=0;for(let i=0;i<d*SR;i++){const t=i/SR,k=t/d,fc=300+6000*Math.sin(Math.PI*k);const al=1-Math.exp(-2*Math.PI*fc/SR);y+=al*(rn()-y);add(s+i,a*y*Math.sin(Math.PI*k),Math.sin(k*6)*.6);}}
function riser(t0,t1,a=.35){const s=Math.floor(t0*SR),n=(t1-t0)*SR;let y=0,ph=0;for(let i=0;i<n;i++){const k=i/n,fc=200+9000*k*k;const al=1-Math.exp(-2*Math.PI*fc/SR);y+=al*(rn()-y);
  ph+=2*Math.PI*(180+900*k*k)/SR;add(s+i,a*k*k*(y*.9+Math.sin(ph)*.25));}}
function saw(f,t){return 2*((f*t)%1)-1}
const KICKS=[];
function tone(t0,d,f,a,{type='saw',cut=1200,dec=6,pan=0,att=.005,det=0}={}){const s=Math.floor(t0*SR);let y=0;for(let i=0;i<d*SR;i++){const t=i/SR;
  let x=type==='saw'?(saw(f,t)+(det?saw(f*(1+det),t):0))*(det?.5:1):Math.sin(2*Math.PI*f*t);
  const al=1-Math.exp(-2*Math.PI*cut/SR);y+=al*(x-y);const env=Math.min(1,t/att)*Math.exp(-t*dec);
  const gt=t0+t;let duck=1;for(const kt of KICKS){if(gt>=kt&&gt-kt<.3)duck=Math.min(duck,1-.75*Math.exp(-(gt-kt)*14));}
  add(s+i,a*y*env*duck,pan);}}

// ---- arrangement ----
// HOOK 0-1.25: four slams + big impact
impact(0,1.1);[0,.25,.5,.75].forEach((t,i)=>{kick(t,1);snap(t,.55);});kick(1.0,1);clap(1.0,.6);whoosh(1.15,.2,.4);
// GROOVE 1.25-3.0
for(let b=1.5;b<3;b+=.5){KICKS.push(b);kick(b,.9);} [1.5,2.5].forEach(t=>clap(t,.45));
for(let t=1.25;t<3;t+=.25)hat(t+.125,.12,80,(t*4%2)?.4:-.4);
[1.30,1.75,2.25].forEach(t=>tone(t,.12,1318.5,.12,{type:'sine',dec:25}));// message pops
riser(2.6,3.0,.3);
// TENSION 3.0-4.5 + riser into drop
impact(3,.7);for(let b=3;b<4.5;b+=.5){KICKS.push(b);kick(b,1);snap(b,.4);}
for(let t=3;t<4.5;t+=.125)hat(t,.1,90,rn()*.6);
for(let i=0;i<10;i++){tone(3.02+i*.035,.03,2000+rn()*3000,.08,{type:'saw',cut:6000,dec:60,pan:rn()});}// glitch stutter
riser(3.0,5.0,.45);
let r=4.0;const roll=[.125,.125,.0625,.0625,.0625,.0625,.03125,.03125,.03125,.03125,.03125,.03125];for(const d of roll){if(r<4.75)clap(r,.28*(r-3.7));r+=d;}
whoosh(4.45,.3,.45);
// DROP 5.0-12.0
impact(5,1.2);
const chords=[[55,[440,523.25,659.25]],[43.65,[349.23,440,523.25]],[65.41,[523.25,659.25,783.99]],[49,[392,493.88,587.33]]];
for(let b=5;b<12;b+=.5)KICKS.push(b);
for(let b=5;b<12;b+=.5){kick(b,1);if(Math.round((b-5)/.5)%2===1)clap(b,.55);}
for(let t=5;t<12;t+=.125){const off=Math.round((t-5)/.125)%2;hat(t,off?.16:.08,off?45:90,off?.35:-.35);}
for(let t=5;t<12;t+=.25){const bar=Math.floor((t-5)/2)%4,[root,arp]=chords[bar];
  tone(t,.24,root*2,.32,{cut:500,dec:5,det:.006});
  const step=Math.round((t-5)/.25);const n=arp[[0,1,2,1,2,0,1,2][step%8]]*(step%8>5?2:1);
  tone(t,.25,n,.07,{cut:3200,dec:9,pan:step%2?.5:-.5,det:.004});}
[6.5,7,7.5].forEach(t=>{tone(t,.1,880,.12,{type:'sine',dec:30});});
[6.75,7.75].forEach(t=>snap(t,.35));[7.25].forEach(t=>tone(t,.2,1760,.1,{type:'sine',dec:15}));
[8.5,8.75,9,9.25].forEach(t=>{snap(t,.5);whoosh(t-.08,.12,.2);});
impact(9.5,.8);
for(let i=0;i<22;i++)tone(10.1+i*.032,.02,2400,.05,{type:'sine',dec:80});// typing ticks
impact(11,1.1);tone(11,.4,110,.35,{cut:900,dec:4});
// MONTAGE 12-13: quarter-beat slams + riser
[12,12.25,12.5,12.75].forEach((t,i)=>{kick(t,1);snap(t,.5);clap(t,.3);});
for(let t=12;t<13;t+=.0625)hat(t,.12,80,rn()*.5);
riser(12,13,.4);
// END 13+: final hit + pad ring-out
impact(13,1);kick(13,1.1);clap(13,.5);
[110,164.81,220,261.63,329.63,493.88].forEach((f,i)=>tone(13,2.2,f,.09,{cut:1800,dec:1.4,att:.02,det:.005,pan:(i%2?.4:-.4)}));
whoosh(13.0,.3,.3);tone(13.28,.5,1760,.1,{type:'sine',dec:6});tone(13.28,.5,2637,.06,{type:'sine',dec:7});
tone(14.15,.3,1318.5,.07,{type:'sine',dec:10});

// master: soft clip, normalize, fade tail
let pk=0;for(let i=0;i<N;i++){L[i]=Math.tanh(L[i]*1.1);R[i]=Math.tanh(R[i]*1.1);pk=Math.max(pk,Math.abs(L[i]),Math.abs(R[i]));}
const g=.89/pk;const buf=Buffer.alloc(44+N*4);
buf.write('RIFF',0);buf.writeUInt32LE(36+N*4,4);buf.write('WAVEfmt ',8);buf.writeUInt32LE(16,16);buf.writeUInt16LE(1,20);buf.writeUInt16LE(2,22);
buf.writeUInt32LE(SR,24);buf.writeUInt32LE(SR*4,28);buf.writeUInt16LE(4,32);buf.writeUInt16LE(16,34);buf.write('data',36);buf.writeUInt32LE(N*4,40);
for(let i=0;i<N;i++){const f=i/SR>14.6?Math.max(0,1-(i/SR-14.6)/.6):1;buf.writeInt16LE(Math.round(L[i]*g*f*32767),44+i*4);buf.writeInt16LE(Math.round(R[i]*g*f*32767),46+i*4);}
fs.writeFileSync('music.wav',buf);console.log('music.wav ok');
