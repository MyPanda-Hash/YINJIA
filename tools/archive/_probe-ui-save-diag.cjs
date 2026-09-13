// _probe-ui-save-diag.cjs — 诊断:UI 点「保存」后发生了什么(ElMessage 文案 + API 真实状态)
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9395
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  const api = async (p, body) => (await fetch(`${BASE}${p}`, { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) })).json()
  const listRows = async (panel) => { const r = await api('/api/px/queryFormDataList', { panelCode: panel, pageNo: 1, pageSize: 300 }); const d = r?.data || {}; return d.rows || d.list || d.records || [] }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-sd-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1700,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => { const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + JSON.stringify(r.result.exceptionDetails.exception || {}).slice(0, 200) + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    // 抓 console 错误
    const logs = []
    await send('Runtime.enable')
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return }
      if (m.method === 'Runtime.consoleAPICalled' && m.params && ['error', 'warning'].includes(m.params.type)) {
        logs.push(m.params.type + ': ' + (m.params.args || []).map((a) => String(a.value ?? a.description ?? '')).join(' ').slice(0, 220)) } })
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')

    await nav(`${BASE}/#/panelx/list/RD_EQUIP_USE`); await sleep(900)
    const before = new Set((await listRows('RD_EQUIP_USE')).map((r) => r['单据编号'] || r['编号']))
    await ev(`(function(){var all=[].slice.call(document.querySelectorAll('.as-side-btn,button,li,span'));
      for(var i=0;i<all.length;i++){var t=(all[i].textContent||'').trim();if(t==='新增'&&all[i].offsetParent){all[i].click();return 1}}return 0})()`)
    let no = ''
    for (let i = 0; i < 30; i++) { await sleep(600)
      const fresh = (await listRows('RD_EQUIP_USE')).map((r) => r['单据编号'] || r['编号']).filter((n) => n && !before.has(n))
      if (fresh.length) { no = fresh[0]; break } }
    console.log('draft:', no)
    await nav(`${BASE}/#/panelx/list/RD_EQUIP_USE`); await sleep(1500)
    await ev(`document.querySelector('.rs-add').click();'ok'`); await sleep(500)
    await ev(`(function(){var t=document.querySelector('table.rs-dt');if(!t)return 0;
      var inp=t.querySelectorAll('tbody input,tbody textarea');if(!inp.length)return 0;
      var setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(inp[1],'UI保存诊断');inp[1].dispatchEvent(new Event('input',{bubbles:true}));return inp.length})()`)
    const clicked = await ev(`(function(){var all=[].slice.call(document.querySelectorAll('.as-side-btn,button'));
      for(var i=0;i<all.length;i++){var t=(all[i].textContent||'').trim();
        if(t==='保存'&&all[i].offsetParent&&!all[i].className.match(/disabled/)){all[i].click();return 'clicked:'+all[i].className}
      } return 'not-found/disabled:'+[].concat(all.filter(function(a){return (a.textContent||'').trim()==='保存'}).map(function(a){return a.className})).join('|')})()`)
    console.log('保存点击:', clicked)
    for (const wait of [1500, 2000, 3000]) {
      await sleep(wait)
      const msgs = await ev(`[].slice.call(document.querySelectorAll('.el-message')).map(function(m){return m.textContent.trim()}).join(' || ')`)
      const domStatus = await ev(`(document.querySelector('.doc-status')||{}).textContent || ''`)
      const apiRow = (await listRows('RD_EQUIP_USE')).find((r) => (r['单据编号'] || r['编号']) === no)
      console.log(`+${wait}ms ElMessage="${msgs}" DOM状态=${domStatus.trim()} API状态=${apiRow?.['单据状态']} 行数=${(apiRow?.detail?.items || []).length}`)
    }
    console.log('console 错误/警告:', logs.slice(0, 5))
    // 清理
    await api('/api/px/callButton', { panelCode: 'RD_EQUIP_USE', buttonName: '删除', formData: { 编号: no }, buttonParam: {} })
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
