import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'
const BASE='http://127.0.0.1:8090', PORT=9477
const EDGE='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const L = await fetch(`${BASE}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456',factory:'YJ_TEST'})}).then(r=>r.json())
const TOK=L.data.token, H={'Content-Type':'application/json',Authorization:'Bearer '+TOK}
const post=async(u,b)=>(await fetch(`${BASE}${u}`,{method:'POST',headers:H,body:JSON.stringify(b)}).then(r=>r.json()))
const created=await post('/api/px/callButton',{panelCode:'QC_ASM_INSP',buttonName:'保存',formData:{},buttonParam:{}})
const NO=created?.data?.['编号']||created?.['编号']
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'yj-dbg4-'))
const edge=spawn(EDGE,['--headless=new','--disable-gpu','--no-first-run','--window-size=1760,1200',`--remote-debugging-port=${PORT}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore'})
await sleep(3000)
const tab=await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`,{method:'PUT'}).then(r=>r.json())
const ws=new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej})
let n=0;const pend=new Map(); const reqs=[]; const logs=[]
ws.onmessage=(e)=>{const m=JSON.parse(e.data);
  if(m.method==='Network.requestWillBeSent'&&/callButton/.test(m.params?.request?.url||'')) reqs.push('REQ '+m.params.request.url+' body='+String(m.params.request.postData||'').slice(0,200))
  if(m.method==='Runtime.consoleAPICalled') logs.push('CONSOLE '+String(m.params.args?.map(a=>a.value??a.description).join(' ')).slice(0,200))
  if(m.method==='Runtime.exceptionThrown') logs.push('EXC '+String(m.params.exceptionDetails?.exception?.description||'').slice(0,300))
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(mm,p={})=>new Promise((res)=>{const id=++n;pend.set(id,res);ws.send(JSON.stringify({id,method:mm,params:p}))})
const ev=async(x)=>(await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true})).result?.result?.value
await send('Page.enable');await send('Runtime.enable');await send('Network.enable')
await send('Page.navigate',{url:`${BASE}/#/login`});await sleep(1500)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(TOK)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(L.data.user))}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
await send('Page.navigate',{url:'about:blank'});await sleep(300)
await send('Page.navigate',{url:`${BASE}/#/panelx/list/QC_ASM_INSP`});await sleep(7000)
for (let i=0;i<30;i++){ const t=await ev(`document.body.innerText||''`); if(String(t).includes(NO)) break;
  const c=await ev(`(()=>{const b=[...document.querySelectorAll('.page-btn')].find(x=>(x.getAttribute('title')||'')==='下一张');if(!b)return 'NO';b.click();return 'OK'})()`); if(c!=='OK')break; await sleep(1500) }
console.log('到探针单?', String(await ev(`document.body.innerText||''`)).includes(NO))
console.log('保存按钮 class =', await ev(`(()=>{const g=[...document.querySelectorAll('.tools .tb-group')].find(x=>/保存/.test(x.innerText||''));const m=g&&g.querySelector('.tb-main');return m?m.className:'NO'})()`))
console.log('isDraft 类 =', await ev(`!!document.querySelector('.header-fields.is-draft')`))
reqs.length=0; logs.length=0
await ev(`(()=>{const g=[...document.querySelectorAll('.tools .tb-group')].find(x=>/保存/.test(x.innerText||''));const m=g&&(g.querySelector('.tb-main')||g);m&&m.click();return 1})()`)
await sleep(3500)
console.log('--- 网络请求 ---'); console.log(reqs.join('\n')||'(无 callButton 请求)')
console.log('--- 控制台 ---'); console.log(logs.join('\n')||'(无)')
await post('/api/px/callButton',{panelCode:'QC_ASM_INSP',buttonName:'删除',formData:{编号:NO,单据编号:NO},buttonParam:{}})
process.exit(0)
