const {chromium}=require('/opt/node22/lib/node_modules/playwright');
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
 p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file://'+__dirname+'/index.html');await p.evaluate(()=>document.fonts.ready);
 const ts=process.argv.slice(2).map(Number);
 for(const [i,t] of ts.entries()){await p.evaluate(t=>render(t),t);await p.screenshot({path:`st/${String(i).padStart(2,'0')}.png`});}
 await b.close();
})();
