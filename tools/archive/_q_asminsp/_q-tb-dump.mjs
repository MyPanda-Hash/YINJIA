import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'
const BASE='http://127.0.0.1:8090'
const PORT=9469
const EDGE='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const login = await fetch(`${BASE}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456',factory:'YJ'})}).then(r=>r.json())
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'yj-tb-'))
const edge=spawn(EDGE,['--headless=new','--disable-gpu','--no-first-run',`--remote-debugging-port=${PORT}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'})
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
await send('Page.navigate',{url:`${BASE}/#/panelx/list/QC_ASM_INSP`});await sleep(6500)
console.log('--- 含「导出报表」的元素 ---')
console.log(await ev(`[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&/导出报表/.test(e.innerText||'')).map(e=>'tag='+e.tagName+' cls='+e.className+' parentCls='+(e.parentElement?e.parentElement.className:'')+' gpCls='+(e.parentElement&&e.parentElement.parentElement?e.parentElement.parentElement.className:'')).slice(0,6).join('\\n')`))
console.log('--- 工具栏顶层结构 ---')
console.log(await ev(`[...document.querySelectorAll('.tb-group,.tb-menu,.toolbar,.list-toolbar,.tb-item')].slice(0,14).map(e=>'cls='+e.className+' txt='+(e.innerText||'').replace(/\\s+/g,' ').slice(0,30)).join('\\n')`))
console.log('--- 直接找可点元素 ---')
console.log(await ev(`(()=>{const e=[...document.querySelectorAll('*')].filter(x=>/导出报表/.test(x.innerText||'')&&x.innerText.length<20);return e.map(x=>x.tagName+'.'+x.className).join(' | ')})()`))
try{edge.kill()}catch{}
