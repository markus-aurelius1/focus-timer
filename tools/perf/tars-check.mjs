/** Production continuity through commands, durable timer history, travel, curated PYQ, revision and offline core. */
import { readFileSync,readdirSync,mkdirSync,writeFileSync } from 'node:fs'
import { launch,prepare } from './lib.mjs'
const base=process.argv[2]??'http://localhost:4174/'
const checks=[],errors=[]
const ok=(name,value)=>{checks.push({name,ok:!!value});console.log(`${value?'PASS':'FAIL'} ${name}`)}
const questions=readdirSync(new URL('../../public/pyq-atlas/v1/papers/',import.meta.url)).flatMap(f=>JSON.parse(readFileSync(new URL('../../public/pyq-atlas/v1/papers/'+f,import.meta.url))).questions)
const eligible=questions.find(q=>q.relations.some(r=>r.masteryEligible&&r.semanticRole==='primary'&&r.locationInQuestion==='stem'))
const answer=JSON.parse(readFileSync(new URL('../../public/pyq-atlas/v1/answers/'+eligible.id.replace(/-Q\d+$/,'')+'.json',import.meta.url))).answers.find(a=>a.questionId===eligible.id)
const target=eligible.relations.find(r=>r.masteryEligible&&r.semanticRole==='primary'&&r.locationInQuestion==='stem').placeId
const targetName=JSON.parse(readFileSync(new URL('../../public/atlas/v1/places.json',import.meta.url))).places.find(p=>p.id===target).name
for(const [width,scheme,reduced] of [[1366,'light',false],[375,'dark',true]]) {
  const {browser,ctx,page}=await launch({touch:width<500});const requestedScripts=[];page.on('request',r=>{if(r.resourceType()==='script')requestedScripts.push(r.url().split('/').at(-1))});await page.setViewportSize({width,height:900});await page.emulateMedia({colorScheme:scheme,reducedMotion:reduced?'reduce':'no-preference'});page.on('pageerror',e=>errors.push(e.message))
  await page.clock.install();await prepare(page,base,{sample:false,route:'#/focus'})
  const initialScripts=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>r.name.endsWith('.js')).map(r=>r.name.split('/').at(-1)))
  const prefix=`${width} ${scheme}${reduced?' reduced':''}`
  const command=async(text)=>{await page.keyboard.press('Control+k');const input=page.getByRole('dialog',{name:'Search and commands'}).getByRole('combobox');await input.fill(text);await page.waitForTimeout(200);await input.press('Enter');await page.waitForTimeout(550)}
  const records=store=>page.evaluate(store=>new Promise((resolve,reject)=>{const req=indexedDB.open('lodestar');req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result,r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>{db.close();resolve(r.result)};r.onerror=()=>reject(r.error)}}),store)
  ok(prefix+' map renderer absent on initial Focus',!initialScripts.some(n=>n.startsWith('FieldReview-')||n.startsWith('AtlasScreen-')))
  await command('Polity revision today @Polity !high')
  const tasks=await records('tasks');const task=tasks.find(t=>t.title==='Polity revision')
  ok(prefix+' command captures planned task and subject',task&&task.plannedFor&&task.labelId)
  await command('Start 50 minutes of Polity')
  const timer=await page.evaluate(()=>JSON.parse(localStorage.getItem('tars.timer.v1')))
  ok(prefix+' natural duration starts the existing timer',timer.status==='running'&&timer.targetMs===3000000&&timer.context.labelId===task.labelId)
  await command('Pause timer');ok(prefix+' command pauses',await page.evaluate(()=>JSON.parse(localStorage.getItem('tars.timer.v1')).status==='paused'))
  await command('Resume timer');ok(prefix+' command resumes',await page.evaluate(()=>JSON.parse(localStorage.getItem('tars.timer.v1')).status==='running'))
  await command('Stop timer')
  await command('Plan tomorrow');ok(prefix+' command opens next calendar day',page.url().includes('#/calendar?date='))
  await page.getByRole('button',{name:'New calendar item',exact:true}).click()
  await page.getByPlaceholder('What will you focus on?').fill('Scheduled Polity')
  await page.getByLabel(/^Linked task/).selectOption(task.id)
  await page.getByRole('button',{name:'Add to calendar',exact:true}).click();await page.waitForTimeout(400)
  await page.getByText('Scheduled Polity',{exact:true}).first().click();await page.waitForTimeout(300)
  await page.getByRole('button',{name:'Start now',exact:true}).click();await page.waitForTimeout(500)
  ok(prefix+' calendar block starts its linked task through the registry',await page.evaluate(id=>{const t=JSON.parse(localStorage.getItem('tars.timer.v1'));return t.status==='running'&&t.context.taskId===id},task.id))
  await command('Stop timer')
  await command('Open my next task');ok(prefix+' command opens task sheet',await page.getByRole('textbox',{name:'Task title'}).inputValue()==='Polity revision')
  await page.keyboard.press('Escape')
  await page.goto(base+'#/atlas?expeditions=1');await page.waitForTimeout(900)
  const row=page.getByRole('dialog').getByRole('button',{expanded:false}).first();await row.click();await page.getByRole('button',{name:'Start this expedition',exact:true}).click();await page.waitForTimeout(400);await page.keyboard.press('Escape')
  const runs=await records('expeditions');ok(prefix+' expedition is durably activated',runs.some(r=>r.endedAt===null))
  await command('Open my next task');await page.getByRole('button',{name:'Focus',exact:true}).last().click();await page.waitForTimeout(500)
  ok(prefix+' task flows into focus with stable identity',await page.evaluate(id=>JSON.parse(localStorage.getItem('tars.timer.v1')).context.taskId===id,task.id))
  // Accelerate wall time through the browser clock; the production engine performs completion and persistence.
  await page.clock.setSystemTime(await page.evaluate(() => Date.now()+25*60000+2500));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(3000)
  const sessions=await records('sessions');const session=sessions.find(s=>s.taskId===task.id)
  ok(prefix+' completed timer persists one canonical session',session&&session.duration===1500&&session.completed&&sessions.filter(s=>s.taskId===task.id).length===1)
  await page.waitForTimeout(300)
  if(await page.getByRole('dialog').count()){await page.keyboard.press('Escape');await page.waitForTimeout(600)}
  await command('Continue my expedition');ok(prefix+' focus returns to expedition/place',page.url().includes('#/atlas'))
  if(width<500)await page.keyboard.press('Escape')
  await page.goto(base+'#/atlas?expeditions=1');await page.waitForTimeout(800)
  const progress=await page.getByRole('dialog',{name:'Expeditions',exact:true}).innerText()
  ok(prefix+' persisted focus advances expedition minutes and reached stops',/25 \/ \d+ min/.test(progress)&&/[1-9]\d* of \d+ stops/.test(progress))
  await page.keyboard.press('Escape')
  await page.goto(base+'#/atlas?place='+target);await page.waitForTimeout(900)
  ok(prefix+' place offers canonical questions without access gating',await page.getByRole('button',{name:'Test me',exact:true}).count()>0)
  if(width<500)await page.keyboard.press('Escape')
  await command('Show CSE questions for straits');await page.getByRole('dialog',{name:'Previous questions'}).waitFor();ok(prefix+' geographic PYQ catalogue opens',await page.getByText('Geographic type: strait').isVisible());await page.keyboard.press('Escape')
  await command('Show places from 2024 CSE');await page.getByRole('dialog',{name:'Previous questions'}).waitFor();ok(prefix+' year/exam query selects mapped-place view',await page.getByLabel('Catalogue view').inputValue()==='places'&&await page.getByLabel('Question year').inputValue()==='2024');await page.keyboard.press('Escape')
  await command('Open Nathu La');ok(prefix+' exact place intent preserves Atlas ID',await page.getByRole('heading',{name:'Nathu La',exact:true}).isVisible())
  if(width<500)await page.keyboard.press('Escape')
  await page.goto(base+'#/atlas?pyq='+eligible.id);await page.locator('[data-question-id]').waitFor();
  await page.locator('[data-question-id]').getByRole('radio').nth('ABCD'.indexOf(answer.correctOptions[0])).click();await page.getByRole('button',{name:'Submit answer',exact:true}).click();await page.waitForTimeout(600)
  const recalls=await records('recalls'),attempt=recalls.find(r=>r.pyq?.canonicalQuestionId===eligible.id)
  ok(prefix+' PYQ persists hashes and only eligible mastery relations',attempt?.correct===1&&attempt.pyq.baseQuestionHash===eligible.baseQuestionHash&&attempt.pyq.eligiblePlaceIds.includes(target)&&!attempt.pyq.eligiblePlaceIds.some(id=>eligible.relations.some(r=>r.placeId===id&&r.semanticRole==='distractor')))
  await page.keyboard.press('Escape');await page.goto(base+'#/atlas?place='+target);await page.waitForTimeout(700)
  ok(prefix+' eligible PYQ shows Familiar independently of travel',await page.getByText('Familiar',{exact:true}).isVisible())
  if(width<500){await page.keyboard.press('Escape');await page.waitForTimeout(350)}
  await page.goto(base+'#/atlas?search='+encodeURIComponent(targetName));const gazetteer=page.getByRole('dialog',{name:'Gazetteer',exact:true});await gazetteer.waitFor();await page.waitForTimeout(400)
  ok(prefix+' gazetteer shows recall mastery for an untravelled place',await gazetteer.getByRole('button').filter({hasText:targetName}).getByText('Familiar',{exact:true}).count()>0)
  await page.keyboard.press('Escape');await page.goto(base+'#/atlas?place='+target);await page.waitForTimeout(700)
  await page.getByRole('button',{name:'Revision task',exact:true}).click();await page.waitForTimeout(400)
  const revised=(await records('tasks')).find(t=>t.notes?.includes('#/atlas?place='+target));ok(prefix+' place creates linked revision task',!!revised)
  if(width<500)await page.keyboard.press('Escape')
  await command('Insights');await page.getByRole('heading',{name:'Insights',exact:true}).waitFor();ok(prefix+' Insights shows travel and learning separately',await page.getByText('Places travelled',{exact:true}).isVisible()&&await page.getByText('Canonical PYQ',{exact:true}).isVisible())
  ok(prefix+' persistent Tars command access',await page.getByRole('button',{name:'Ask Tars',exact:true}).isVisible())
  await page.goto(base+'#/focus');await page.waitForTimeout(600)
  const scripts=requestedScripts
  ok(prefix+' map renderer is route-loaded',scripts.some(n=>n.startsWith('FieldReview-')))
  await page.evaluate(async()=>{await navigator.serviceWorker.ready});await page.waitForTimeout(1000);await ctx.setOffline(true);await page.goto(base+'#/atlas?pyq='+eligible.id);await page.locator('[data-question-id]').waitFor();ok(prefix+' canonical question opens offline',await page.getByRole('radio').count()===4)
  mkdirSync(new URL('./out/tars/',import.meta.url),{recursive:true});await page.screenshot({path:new URL(`./out/tars/${width}-${scheme}.png`,import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1'),fullPage:true});await browser.close()
}
ok('no page errors',errors.length===0);writeFileSync(new URL('./out/tars/results.json',import.meta.url),JSON.stringify({checks,errors},null,2));if(checks.some(c=>!c.ok))process.exitCode=1
