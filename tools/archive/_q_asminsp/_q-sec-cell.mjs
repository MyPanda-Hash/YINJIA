import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'
const BASE='http://127.0.0.1:8090', PORT=9474
const EDGE='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const login = await fetch(`${BASE}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456',factory:'YJ'})}).then(r=>r.json())
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'yj-dbg-'))
const edge=spawn(EDGE,['--headless=new','--disable-gpu','--no-first-run','--window-size=1760,1200',`--remote-debugging-port=${PORT}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'})
await sleep(3000)
const tab=await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json())
const ws=new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej})
let n=0;const pend=new Map()
ws.onmessage=(e)=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(mm,p={})=>new Promise((res)=>{const id=++n;pend.set(id,res);ws.send(JSON.stringify({id,method:mm,params:p}))})
const ev=async(x)=>(await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true})).result?.result?.value
await send('Page.enable');await send('Runtime.enable')
await send('Page.navigate',{url:`${BASE}/#/login`});await sleep(1500)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
await send('Page.navigate',{url:'about:blank'});await sleep(300)
await send('Page.navigate',{url:`${BASE}/#/panelx/list/QC_ASM_INSP`});await sleep(7000)
/* 找草稿 */
for (let i=0;i<8;i++){ if (await ev(`!!document.querySelector('.header-fields.is-draft')`)) break;
  const c=await ev(`(()=>{const b=[...document.querySelectorAll('.page-btn')].find(x=>(x.getAttribute('title')||'')==='下一张');if(!b)return 'NO';b.click();return 'OK'})()`); if(c!=='OK')break; await sleep(1500) }
console.log('草稿?', await ev(`!!document.querySelector('.header-fields.is-draft')`))
console.log('--- 外观区每列表头/单元格 HTML ---')
console.log(await ev(`(()=>{const s=[...document.querySelectorAll('.arch-section')].find(x=>/外观/.test(x.querySelector('.arch-section-title')?.innerText||''));
 if(!s) return 'NO_SEC';
 const hs=[...s.querySelectorAll('.el-table__header th')].map(th=>(th.innerText||'').replace(/[\\s⇅↑↓]+/g,''));
 const tr=[...s.querySelectorAll('.el-table__body tbody tr')][0];
 const tds=[...tr.querySelectorAll('td')];
 return hs.map((h,i)=>h+' => '+((tds[i]?.innerHTML||'(no td)').slice(0,110))).join('\\n')})()`))
