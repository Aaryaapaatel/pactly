const {chromium}=require('/opt/node22/lib/node_modules/playwright');const {spawn}=require('child_process');
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file://'+__dirname+'/index.html');await p.evaluate(()=>document.fonts.ready);
 const ff=spawn(require('ffmpeg-static'),['-v','error','-y','-f','image2pipe','-framerate','60','-c:v','mjpeg','-i','-','-i','music.wav',
  '-filter_complex','[0:v]tmix=frames=2,fps=30,format=yuv420p[v]','-map','[v]','-map','1:a','-c:v','libx264','-preset','slow','-crf','16','-profile:v','high',
  '-c:a','aac','-b:a','256k','-t','15','-movflags','+faststart','pactly-reel.mp4'],{stdio:['pipe','inherit','inherit']});
 const F=900;
 for(let i=0;i<F;i++){await p.evaluate(t=>render(t),i/60);const buf=await p.screenshot({type:'jpeg',quality:94});
  if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(i%150===0)console.log('frame',i);}
 ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();console.log('done');
})();
