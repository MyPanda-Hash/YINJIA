import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms)); const API='http://127.0.0.1:8090'
const OUT='tools/archive/_transfer-stocktake-probe/shots'; mkdirSync(OUT,{recursive:true})
const lg=await (await fetch(API+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({userName:'admin',password:'123456'})})).json()
const profile=mkdtempSync(join(tmpdir(),'edge-bin-'))
const edge=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',['--headless=new','--remote-debugging-port=9353',`--user-data-dir=${profile}`,'--no-first-run','--disable-gpu','--window-size=1680,1000','about:blank'],{stdio:'ignore'})
let ws,id=0; const pend=new Map()
for(let i=0;i<40;i++){try{const l=await (await fetch('http://127.0.0.1:9353/json/list')).json();const p=l.find(t=>t.type==='page');if(p){ws=new WebSocket(p.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});ws.onmessage=(e)=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}};break}}catch{}await sleep(500)}
const send=(m,p)=>{const i=++id;return new Promise(r=>{pend.set(i,r);ws.send(JSON.stringify({id:i,method:m,params:p||{}}))})}
const ev=async(e)=>(await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true}))?.result?.result?.value
await send('Page.enable');await send('Runtime.enable')
await send('Page.navigate',{url:API+'/#/login'});await sleep(3500)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lg.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))}); 'ok'`)
await send('Page.navigate',{url:API+'/#/dashboard'});await sleep(1000);await send('Page.reload',{ignoreCache:true});await sleep(8000)
for (const [code,name] of [['TRANSFER','transfer'],['STOCKTAKE','stocktake']]) {
  await ev(`location.hash='#/panelx/list/${code}'; 'ok'`); await sleep(6000)
  await ev(`(()=>{const r=document.querySelector('.doc-select-rail tbody tr'); if(r) r.dispatchEvent(new MouseEvent('click',{bubbles:true})); return 'ok'})()`)
  await sleep(3000)
  const heads = await ev(`[...document.querySelectorAll('table thead th')].map(t=>t.innerText.trim()).filter(Boolean)`)
  console.log(code + ' 明细表头=' + JSON.stringify(heads))
  const shot=await send('Page.captureScreenshot',{format:'png'})
  if (shot.result?.data) writeFileSync(join(OUT,`bin-${name}.png`), Buffer.from(shot.result.data,'base64'))
}
// 参照级联:检查字段元数据
const h={Authorization:'Bearer '+lg.data.token}
for (const p of ['TRANSFER','STOCKTAKE']) {
  const nf=await (await fetch(API+'/px/getNewFormPermMatrix?panelCode='+p,{headers:h})).json()
  const f=(nf.data.detail.tabs[0].fields||[]).filter(x=>/仓位/.test(x.dataName))
  console.log(p+' 仓位字段 meta=' + JSON.stringify(f))
}
try{edge.kill()}catch{}
process.exit(0)
