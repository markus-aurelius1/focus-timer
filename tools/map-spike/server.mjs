/** Local experiment server with explicit byte ranges; no remote map services. */
import { createServer } from 'node:http'
import { readFileSync, statSync } from 'node:fs'
import { resolve, extname } from 'node:path'
const root = resolve('.')
createServer((req,res) => {
  const path=resolve(root,`.${decodeURIComponent((req.url ?? '/').split('?')[0]==='/' ? '/index.html' : req.url.split('?')[0])}`)
  if (!path.startsWith(root+'\\') && !path.startsWith(root+'/')) { res.writeHead(403).end(); return }
  try {
    const data=readFileSync(path), size=statSync(path).size
    const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.pmtiles':'application/octet-stream'}[extname(path)] ?? 'application/octet-stream'
    const range=req.headers.range?.match(/bytes=(\d+)-(\d*)/)
    res.setHeader('Content-Type',mime);res.setHeader('Accept-Ranges','bytes')
    if (range) { const start=+range[1],end=Math.min(range[2] ? +range[2] : size-1,size-1);res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${size}`});res.end(data.subarray(start,end+1)) }
    else res.end(data)
  } catch { res.writeHead(404).end() }
}).listen(4176,'127.0.0.1',()=>console.log('Isolated map spike http://127.0.0.1:4176'))
