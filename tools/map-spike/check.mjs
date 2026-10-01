/** Comparable headless phone measurements; records limitations rather than claiming device validation. */
import { chromium } from '../perf/node_modules/playwright-core/index.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox']})
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true})
const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});page.on('console',m=>{if(m.type()==='error')console.error(m.text())})
const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4})
await page.goto('http://127.0.0.1:4176');await page.waitForFunction(()=>window.spikeReady,null,{timeout:45000})
const measure=async(name,action)=>{
 await page.evaluate(()=>{window.frames=[];window.lastFrame=performance.now();const generation=window.generation=(window.generation??0)+1;function frame(t){if(window.generation!==generation)return;window.frames.push(t-window.lastFrame);window.lastFrame=t;requestAnimationFrame(frame)}requestAnimationFrame(frame)})
 await action();await page.waitForTimeout(1800)
 return page.evaluate(name=>{window.generation++;const f=window.frames.sort((a,b)=>a-b);return {name,n:f.length,p95:f[Math.floor(f.length*.95)],max:f.at(-1),over50:f.filter(v=>v>50).length}},name)
}
const samples=[]
samples.push(await measure('idle',async()=>{}))
samples.push(await measure('pan',async()=>{await page.mouse.move(190,390);await page.mouse.down();await page.mouse.move(80,320,{steps:24});await page.mouse.up()}))
samples.push(await measure('wheel zoom',async()=>{await page.mouse.move(180,420);for(let i=0;i<6;i++){await page.mouse.wheel(0,-100);await page.waitForTimeout(80)}}))
const anchor=await page.evaluate(()=>{const p=spikeMap.unproject([180,420]);return [p.lng,p.lat]})
await page.mouse.dblclick(180,420);await page.waitForTimeout(800)
await page.locator('canvas').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('+');await page.waitForTimeout(400)
await page.evaluate(()=>spikeMap.flyTo({center:[81,23],zoom:6,duration:400}));await page.waitForTimeout(800)
const heap=await cdp.send('Runtime.getHeapUsage')
// Network-independent warm pan: requests to the local archive still need a deliberate install/cache policy for cold offline use.
await page.context().setOffline(true);await page.evaluate(()=>spikeMap.panBy([20,0],{duration:100}));await page.waitForTimeout(500)
mkdirSync('../perf/out/spike',{recursive:true});await page.screenshot({path:'../perf/out/spike/maplibre-phone.png'})
const sizes=Object.fromEntries(['maplibre-gl/dist/maplibre-gl.mjs','maplibre-gl/dist/maplibre-gl-shared.mjs','maplibre-gl/dist/maplibre-gl-worker.mjs','pmtiles/dist/pmtiles.js'].map(p=>{const b=readFileSync('node_modules/'+p);return [p,{raw:b.length,gzip:gzipSync(b).length}]}))
const result={environment:'Headless Chromium phone viewport, 4x CPU throttle; no physical device',versions:{maplibre:JSON.parse(readFileSync('node_modules/maplibre-gl/package.json')).version,pmtiles:JSON.parse(readFileSync('node_modules/pmtiles/package.json')).version},startup:await page.evaluate(()=>window.spikeReady),samples,heap,sizes,anchor,errors,limitations:['Controlled archive has existing Atlas detail only (z0-4).','HTML label density is a prototype, not production-equivalent collision hierarchy.','Warm offline pan does not verify a cold offline archive install.','Expedition/mastery/protected geometry/controlled India border integration is not acceptance-tested in this prototype.','Headless WebGL is not representative of target-phone GPU performance.']}
writeFileSync('../perf/out/spike/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close()
if(errors.length)process.exitCode=1
