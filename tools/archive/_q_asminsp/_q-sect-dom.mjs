import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'
const BASE='http://127.0.0.1:8090', PORT=9472
const EDGE='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const login = await fetch(`${BASE}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456',factory:'YJ'})}).then(r=>r.json())
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'yj-sec2-'))
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
console.log('草稿?', await ev(`!!document.querySelector('.header-fields.is-draft')`))
console.log('--- 第一个区里 body 行结构 ---')
console.log(await ev(`(()=>{const s=document.querySelector('.arch-section');if(!s)return 'NO_SEC';
  const trs=[...s.querySelectorAll('.el-table__body tbody tr')];
  return trs.map(tr=>[...tr.querySelectorAll('td')].map(td=>({cls:td.className,html:(td.innerHTML||'').slice(0,120)})).slice(0,3)).map(x=>JSON.stringify(x)).join('\\n')})()`))
console.log('--- .cell-empty-hint 数量 ---', await ev(`document.querySelectorAll('.cell-empty-hint').length`))
console.log('--- 行内 input 数量 ---', await ev(`document.querySelectorAll('.arch-section .el-table__body input').length`))
console.log('--- 占位行 class ---', await ev(`(()=>{const s=document.querySelector('.arch-section');return [...s.querySelectorAll('.el-table__body tbody tr')].map(tr=>tr.className).join(' | ')})()`))
try{edge.kill()}catch{}
