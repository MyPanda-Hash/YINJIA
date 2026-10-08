const { spawn } = require('node:child_process')
const fs=require('fs'),os=require('os'),path=require('path')
const API='http://127.0.0.1:8090', PORT=9431, FRONT='http://127.0.0.1:8090'
const EDGE='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms))
;(async()=>{
  const lg=await (await fetch(API+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456',factory:'YJ_TEST'})})).json()
  const user=lg.data.user
  const prof=fs.mkdtempSync(path.join(os.tmpdir(),'yj-tip-'))
  const edge=spawn(EDGE,['--headless=new','--disable-gpu','--no-first-run','--window-size=1920,1080',`--remote-debugging-port=${PORT}`,`--user-data-dir=${prof}`,'about:blank'],{stdio:'ignore'})
  await sleep(3000)
  try{
    const tab=await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`,{method:'PUT'})).json()
    const ws=new WebSocket(tab.webSocketDebuggerUrl); await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej})
    let seq=0; const pend=new Map()
    ws.onmessage=(e)=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
    const send=(method,params={})=>new Promise(res=>{const id=++seq;pend.set(id,res);ws.send(JSON.stringify({id,method,params}))})
    const ev=async(x)=>{const r=await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise:true});return r.result?.result?.value}
    const nav=async(u)=>{await send('Page.navigate',{url:u});for(let i=0;i<50;i++){await sleep(300);if((await ev('document.readyState'))==='complete'){await sleep(800);return}}}
    await send('Page.enable');await send('Runtime.enable')
    await nav(FRONT+'/#/login')
    await ev(`localStorage.setItem('mes_token',${JSON.stringify(lg.data.token)});localStorage.setItem('mes_user',${JSON.stringify(JSON.stringify(user))});localStorage.setItem('mes_factory',${JSON.stringify(JSON.stringify({code:'YJ_TEST',name:'YINJIA-MES·测试库'}))});localStorage.setItem('mes_login_date','2026-10-08');'ok'`)
    await nav('about:blank'); await nav(FRONT+'/#/panelx/list/WHLOC'); await sleep(4500)
    const hdrs=await ev(`[...document.querySelectorAll('.el-table__header th')].map(t=>t.textContent.replace(/\\s+/g,'').trim())`)
    const z=hdrs.findIndex(h=>h.includes('存储分区'))
    await ev(`(()=>{const c=document.querySelectorAll('.el-table__body .el-table__row')[0].children[${z}];(c.querySelector('.zone-pick-cell')||c.querySelector('.cell-lazy')||c).click();return 'ok'})()`)
    await sleep(1200)
    console.log('[提示行]', JSON.stringify(await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].filter(x=>x.offsetParent!==null).pop();return [...d.querySelectorAll('.zpd-tip')].map(e=>e.textContent.trim())})()`)))
    console.log('[残留检查] 含「选择时会同时填入」:', await ev(`(()=>{const d=[...document.querySelectorAll('.el-dialog')].filter(x=>x.offsetParent!==null).pop();return d.textContent.includes('选择时会同时填入')})()`))
  } finally { try{edge.kill()}catch{} }
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)})