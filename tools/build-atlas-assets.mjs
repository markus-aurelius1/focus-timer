/** Independent deterministic asset inventory. Reads Job 1 outputs without regenerating or modifying them. */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
const sha=b=>createHash('sha256').update(b).digest('hex')
const out='public/atlas-assets/v1';mkdirSync(out,{recursive:true})

/** Convert the existing controlled India border from the fitted study-sheet projection back to lon/lat for MapLibre. */
function writeControlledIndiaBorder() {
  const sheet=JSON.parse(readFileSync('public/atlas/v1/india.json'))
  const topo=sheet.lines
  const obj=topo.objects.indiaBorder
  if(!obj||obj.type!=='MultiLineString')throw new Error('Controlled India border missing')
  const rad=Math.PI/180,half=Math.PI/2,p0=12*rad,p1=32*rad
  const n=Math.log(Math.cos(p0)/Math.cos(p1))/Math.log(Math.tan((half+p1)/2)/Math.tan((half+p0)/2))
  const f=Math.cos(p0)*Math.pow(Math.tan((half+p0)/2),n)/n
  const raw=(lon,lat)=>{const lam=(lon-81)*rad,phi=lat*rad,r=f/Math.pow(Math.tan((half+phi)/2),n);return[r*Math.sin(n*lam),f-r*Math.cos(n*lam)]}
  const [x0,y0,x1,y1]=sheet.bbox,N=40,edge=[
    ...Array.from({length:N},(_,i)=>[x0,y0+(y1-y0)*i/N]),
    ...Array.from({length:N},(_,i)=>[x0+(x1-x0)*i/N,y1]),
    ...Array.from({length:N},(_,i)=>[x1,y1-(y1-y0)*i/N]),
    ...Array.from({length:N},(_,i)=>[x1-(x1-x0)*i/N,y0]),
  ].map(([lon,lat])=>raw(lon,lat))
  const minX=Math.min(...edge.map(p=>p[0])),maxX=Math.max(...edge.map(p=>p[0])),maxY=Math.max(...edge.map(p=>p[1]))
  const k=sheet.width/(maxX-minX)
  const inverse=(x,y)=>{const rx=x/k+minX,ry=maxY-y/k,fy=f-ry,r=Math.hypot(rx,fy),lam=Math.atan2(rx,fy)/n,phi=2*Math.atan(Math.pow(f/r,1/n))-half;return[lam/rad+81,phi/rad]}
  const decodeArc=index=>{
    const reverse=index<0,i=reverse?~index:index,arc=topo.arcs[i],out=[];let x=0,y=0
    for(const pair of arc){x+=pair[0];y+=pair[1];out.push([x*topo.transform.scale[0]+topo.transform.translate[0],y*topo.transform.scale[1]+topo.transform.translate[1]])}
    if(reverse)out.reverse()
    return out
  }
  const stitch=indexes=>{const line=[];for(const index of indexes){const arc=decodeArc(index);if(line.length&&arc.length&&line[line.length-1][0]===arc[0][0]&&line[line.length-1][1]===arc[0][1])arc.shift();line.push(...arc)}return line.map(([x,y])=>inverse(x,y))}
  const geojson={type:'FeatureCollection',features:obj.arcs.map((indexes,i)=>({type:'Feature',properties:{id:'india-controlled-border-'+i,source:'Tars controlled India sheet'},geometry:{type:'LineString',coordinates:stitch(indexes)}}))}
  writeFileSync(join(out,'india-controlled-border.geojson'),JSON.stringify(geojson))
}
writeControlledIndiaBorder()
const pyq=JSON.parse(readFileSync('public/pyq-atlas/v1/manifest.json'))
const hotspots={}
for(const p of pyq.papers){const pack=JSON.parse(readFileSync(join('public/pyq-atlas/v1',p.questions)));for(const q of pack.questions){for(const id of new Set(q.relations.filter(r=>r.quizIncluded&&!['incidental','distractor'].includes(r.semanticRole)).map(r=>r.placeId))){hotspots[id]??={CSE:0,PCS:0,CDS:0};hotspots[id][q.family]++}}}
writeFileSync(join(out,'pyq-hotspots.json'),JSON.stringify({schema:'atlas-pyq-hotspots/v1',canonicalManifestHash:pyq.identity.manifestHash,places:Object.fromEntries(Object.entries(hotspots).sort(([a],[b])=>a.localeCompare(b)))},null,2)+'\n')
const files=[]
const walk=dir=>{for(const name of readdirSync(dir,{withFileTypes:true})){const path=join(dir,name.name);if(name.isDirectory())walk(path);else{const bytes=readFileSync(path),url=path.replaceAll('\\','/').replace(/^public\//,'');files.push({id:url,path:url,version:sha(bytes),bytes:bytes.length,tier:url.startsWith('atlas/v1/india')?'INDIA':'CORE',bundled:true,compatibility:'atlas-data/v2 + atlas-pyq/v1',removable:false})}}}
walk('public/atlas/v1');walk('public/pyq-atlas/v1');walk(out)
// Exclude this manifest from its own content identity.
const assets=files.filter(f=>f.path!=='atlas-assets/v1/manifest.json').sort((a,b)=>a.id.localeCompare(b.id))
const manifest={schema:'tars-atlas-assets/v1',version:sha(JSON.stringify(assets)),renderer:'tars-svg/v1',indiaBoundaryPolicy:'Existing controlled Atlas India sheet and overlays; no generic service substitution',tiers:{CORE:{policy:'Always bundled and precached. Complete curated study data and world context.'},INDIA:{policy:'Bundled India vectors, overlays and relief.'},REGIONAL:{policy:'Optional verified packs only; none published in this release.',packs:[]},ONLINE:{policy:'No online map provider in this release.',cacheBudgetBytes:0}},assets,totalBytes:assets.reduce((n,a)=>n+a.bytes,0)}
writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
console.log(`Atlas assets: ${assets.length} files · ${manifest.totalBytes} bytes · ${Object.keys(hotspots).length} meaningful PYQ places`)
