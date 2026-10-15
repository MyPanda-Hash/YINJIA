import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'
const BASE='http://127.0.0.1:8090', PORT=9476
const EDGE='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
const L = await fetch(`${BASE}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456',factory:'YJ_TEST'})}).then(r=>r.json())
const TOK=L.data.token, H={'Content-Type':'application/json',Authorization:'Bearer '+TOK}
const post=async(u,b)=>(await fetch(`${BASE}${u}`,{method:'POST',headers:H,body:JSON.stringify(b)}).then(r=>r.json()))
const created=await post('/api/px/callButton',{panelCode:'QC_ASM_INSP',buttonName:'保存',formData:{},buttonParam:{}})
const NO=created?.data?.['编号']||created?.['编号']
console.log('探针单 =', NO)
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'yj-dbg3-'))
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
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(TOK)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(L.data.user))}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
await send('Page.navigate',{url:'about:blank'});await sleep(300)
await send('Page.navigate',{url:`${BASE}/#/panelx/list/QC_ASM_INSP`});await sleep(7000)
for (let i=0;i<30;i++){ const t=await ev(`document.body.innerText||''`); if(String(t).includes(NO)) break;
  const c=await ev(`(()=>{const b=[...document.querySelectorAll('.page-btn')].find(x=>(x.getAttribute('title')||'')==='下一张');if(!b)return 'NO';b.click();return 'OK'})()`); if(c!=='OK')break; await sleep(1500) }
console.log('到探针单?', String(await ev(`document.body.innerText||''`)).includes(NO))
/* 在 检验结果 格打字 */
const pt=JSON.parse(String(await ev(`(()=>{const s=[...document.querySelectorAll('.arch-section')].find(x=>/外观/.test(x.querySelector('.arch-section-title')?.innerText||''));
 const hs=[...s.querySelectorAll('.el-table__header th')].map(th=>(th.innerText||'').replace(/[\\s⇅↑↓]+/g,''));const ci=hs.indexOf('检验结果');
 const tr=[...s.querySelectorAll('.el-table__body tbody tr')].find(x=>/端盖两头/.test(x.innerText||''));
 const td=tr.querySelectorAll('td')[ci];const sp=td.querySelector('.cell-lazy')||td;const r=sp.getBoundingClientRect();
 return JSON.stringify({x:Math.round(r.x+4),y:Math.round(r.y+r.height/2)})})()`)))
for (const t of ['mousePressed','mouseReleased']) await send('Input.dispatchMouseEvent',{type:t,x:pt.x,y:pt.y,button:'left',clickCount:1})
await sleep(800); await send('Input.insertText',{text:'无异常'}); await sleep(400)
/* 点保存,并抓提示 */
await ev(`(()=>{const g=[...document.querySelectorAll('.tools .tb-group')].find(x=>/保存/.test(x.innerText||''));const m=g&&(g.querySelector('.tb-main')||g);m&&m.click();return 1})()`)
await sleep(4000)
console.log('--- 保存后页面提示 ---')
console.log(await ev(`[...document.querySelectorAll('.el-message,.el-message__content,.el-notification__content')].map(x=>(x.innerText||'').trim()).join(' || ')`))
console.log('--- 库里的明细(测试账套) ---')
const chk=await post('/api/px/queryFormDataList',{panelCode:'QC_ASM_INSP',condition:{},pageNo:1,pageSize:300})
const doc=(chk.data?.list||[]).find(x=>x['单据编号']===NO||x['编号']===NO)
console.log('doc?', !!doc, 'items=', JSON.stringify((doc?.detail?.items||[]).map(r=>({t:r['表区'],i:r['检验项目'],v:r['检验结果']}))))
/* 清理 */
const del=await post('/api/px/callButton',{panelCode:'QC_ASM_INSP',buttonName:'删除',formData:{编号:NO,单据编号:NO},buttonParam:{}})
console.log('清理 =', del?.code)
process.exit(0)
