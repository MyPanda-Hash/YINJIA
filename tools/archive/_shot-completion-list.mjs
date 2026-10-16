import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import WebSocket from '../node_modules/ws/index.js'
const base=process.argv[2] || 'http://127.0.0.1:8090'
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:process.env.YINJIA_UI_PASS,factory:'YJ'})}).then(r=>r.json())
assert.ok(login.data?.token)
const edge=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--window-size=1730,1050','--remote-debugging-port=9387','--user-data-dir='+fs.mkdtempSync(path.join(os.tmpdir(),'completion-list-')),'about:blank'],{stdio:'ignore'})
let ws
try{
 let tab;for(let i=0;i<40;i++){try{tab=await fetch('http://127.0.0.1:9387/json/new?about:blank',{method:'PUT'}).then(r=>r.json());break}catch{await sleep(250)}}
 ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
 let n=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}}
 const send=(method,params={})=>new Promise(r=>{const id=++n;pending.set(id,r);ws.send(JSON.stringify({id,method,params}))})
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result?.result?.value}
 await send('Page.enable');await send('Page.navigate',{url:base+'/#/login'});await sleep(1800)
 await evaluate(`localStorage.setItem('mes_token',${JSON.stringify(login.data.token)});localStorage.setItem('mes_user',${JSON.stringify(JSON.stringify(login.data.user))});localStorage.setItem('mes_init_done','1');localStorage.setItem('mes_locale','zh-CN')`)
 await send('Page.navigate',{url:'about:blank'});await sleep(200)
 await send('Page.navigate',{url:base+'/#/panelx/list/WO_COMPLETION_LIST'});await sleep(5000)
 for(const locale of ['zh-CN','en','ja']){
  if(locale!=='zh-CN')await evaluate(`(async()=>{const app=document.querySelector('#app').__vue_app__;await app.config.globalProperties.$pinia._s.get('locale').set(${JSON.stringify(locale)})})()`)
  await sleep(1500)
  const text=await evaluate('document.body.innerText')
  for (const no of ['BG-2026-10-0047','BG-2026-10-0046','BG-2026-10-0044'])
    assert.ok(text.includes(no),'all completed records visible together: '+no+' '+locale)
  assert.ok(!/第\s*1\/3\s*张/.test(text),'must not browse one document at a time')
  assert.ok(!await evaluate(`!!document.querySelector('.completion-detail')`),'not old work order dialog')
  const shot=await send('Page.captureScreenshot',{format:'png'})
  fs.writeFileSync('tools/archive/_completion-list-'+locale+'.png',Buffer.from(shot.result.data,'base64'))
  console.log('PASS standalone completion table '+locale+'; BG-2026-10-0047 visible')
 }
 await send('Page.navigate',{url:base+'/#/prod/plan/workOrderList'});await sleep(3500)
 assert.equal(await evaluate(`[...document.querySelectorAll('.wol-btns button')].some(b=>['完工明细','Completion Details','完成明細','完了明細'].includes(b.innerText.trim()))`),false,'work order old entry removed')
 console.log('PASS old work order completion entry removed; original trace retained')
}finally{ws?.close();edge.kill()}
