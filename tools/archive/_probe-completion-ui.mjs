import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import WebSocket from '../node_modules/ws/index.js'
const base = process.argv[2] || 'http://127.0.0.1:8090'
const pause = ms => new Promise(r => setTimeout(r, ms))
const login = await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:process.env.YINJIA_UI_USER || 'admin',password:process.env.YINJIA_UI_PASS,factory:'YJ'})}).then(r=>r.json())
if(!login.data?.token)throw Error('Login failed')
const token=login.data.token
const list=await fetch(base+'/api/px/workOrderList',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:'{}'}).then(r=>r.json())
const target=list.data.find(r=>r.工单号==='GD-2026-10-0007' && Number(r.工单行号)===1) || list.data[0]
if(!target)throw Error('No work order to inspect')
const response=await fetch(base+'/api/px/workOrderList/completionDetails',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({工单号:target.工单号,行id:target.行id})})
const details=await response.json()
if(!response.ok || !Array.isArray(details.data?.明细))throw Error('Completion API failed: '+response.status)
console.log('PASS live API records='+details.data.明细.length+' line='+details.data.头.工单行号)
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'yj-completion-'))
const edge=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--no-first-run','--disable-gpu','--window-size=1680,1100','--remote-debugging-port=9386','--user-data-dir='+profile,'about:blank'],{stdio:'ignore'})
let ws
try{
 let tab
 for(let i=0;i<40;i++){try{tab=await fetch('http://127.0.0.1:9386/json/new?about:blank',{method:'PUT'}).then(r=>r.json());break}catch{await pause(250)}}
 ws=new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j})
 let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}}
 const send=(method,params={})=>new Promise(r=>{const n=++id;pending.set(n,r);ws.send(JSON.stringify({id:n,method,params}))})
 const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.result?.exceptionDetails)throw Error(JSON.stringify(r.result.exceptionDetails));return r.result?.result?.value}
 await send('Page.enable');await send('Page.navigate',{url:base+'/#/login'});await pause(1800)
 await evaluate(`localStorage.setItem('mes_token',${JSON.stringify(token)});localStorage.setItem('mes_user',${JSON.stringify(JSON.stringify(login.data.user))});localStorage.setItem('mes_init_done','1')`)
 for(const locale of ['zh-CN','en','ja']){
  await evaluate(`localStorage.setItem('mes_locale',${JSON.stringify(locale)})`)
  await send('Page.navigate',{url:'about:blank'});await pause(200)
  await send('Page.navigate',{url:base+'/#/prod/plan/workOrderList'});await pause(4000)
  if(locale==='ja') await evaluate(`(async()=>{const app=document.querySelector('#app').__vue_app__;const store=app.config.globalProperties.$pinia._s.get('locale');await store.set('en');await store.set('ja')})()`)
  const result=await evaluate(`(async()=>{
   const root=document.querySelector('.wol-page');if(!root)throw Error('Work order page missing')
   const row=[...root.querySelectorAll('.el-table__body tr')].find(tr=>tr.querySelector('td:nth-child(3)')?.innerText.trim()===${JSON.stringify(target.工单号)} && tr.querySelector('td:nth-child(4)')?.innerText.trim()===${JSON.stringify(String(target.工单行号))});if(!row)throw Error('Target work order row missing');
   row.querySelector('td:nth-child(3)')?.click();
   await new Promise(r=>setTimeout(r,100));
   const button=[...root.querySelectorAll('button')].find(b=>['完工明细','Completion Details','完成明細'].includes(b.innerText.trim()));
   if(!button || button.disabled)throw Error('Completion entry unavailable');button.click();
   return true
  })()`)
  await pause(1800)
  const text=await evaluate(`document.querySelector('.completion-detail')?.innerText || ''`)
  const expected=locale==='en'?'Completion Records':locale==='ja'?'完成記録':'完工记录'
  if(!text.includes(expected) || text.includes('404') || text.includes('Failed to load'))throw Error('Dialog verification failed '+locale+': '+text.slice(0,300))
  if(locale==='en' && /[\u4e00-\u9fff]/.test(text.replaceAll(target.产品名称||'','').replaceAll(target.规格型号||'','').replaceAll(details.data.头.批次号||'','')))console.log('INFO English dialog includes business data; inspect screenshot')
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
  fs.writeFileSync('tools/archive/_completion-'+locale+'.png',Buffer.from(screenshot.result.data,'base64'))
  console.log('PASS '+locale+' completion dialog; live records='+details.data.明细.length)
 }
}finally{ws?.close();edge.kill()}
