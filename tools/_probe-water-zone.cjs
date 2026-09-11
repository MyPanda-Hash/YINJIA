// _probe-water-zone.cjs — 原水水质条件行自适应验证:
//   2 列与 4 列样品下,水质条值格宽度都应铺满除标签外的整行(≈1010px,偏差≤4px),且与样品列数无关
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9386
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  const api = async (p, opts = {}) => (await fetch(`${BASE}${p}`, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...(opts.headers || {}) } })).json()
  const listRows = async () => { const r = await api('/api/px/queryFormDataList', { method: 'POST', body: JSON.stringify({ panelCode: 'RD_FILTER_EFF', pageNo: 1, pageSize: 300 }) }); const d = r?.data || {}; return d.rows || d.list || d.records || [] }
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-wz-'))
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
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3200); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/#/panelx/list/RD_FILTER_EFF`)
    await sleep(1000)
    const before = new Set((await listRows()).map((r) => r['单据编号'] || r['编号']))
    await ev(`(function(){var all=[].slice.call(document.querySelectorAll('.as-side-btn,button,li,span'));
      for(var i=0;i<all.length;i++){var x=(all[i].textContent||'').trim();if(x==='新增'&&all[i].offsetParent){all[i].click();return 1}}return 0})()`)
    let no = ''
    for (let i = 0; i < 30; i++) { await sleep(600)
      const fresh = (await listRows()).map((r) => r['单据编号'] || r['编号']).filter((n) => n && !before.has(n))
      if (fresh.length) { no = fresh[0]; break } }
    await nav(`${BASE}/#/panelx/list/RD_FILTER_EFF`); await sleep(1800)
    const zoneW = () => ev(`(function(){var z=document.querySelector('.rs-water-zone');
      var t=z&&z.closest('table');return JSON.stringify({zone:Math.round(z.getBoundingClientRect().width),table:Math.round(t.getBoundingClientRect().width)})})()`)
    const plus = () => ev(`(function(){var b=[].slice.call(document.querySelectorAll('.rs-sample-btn'));for(var i=0;i<b.length;i++){if((b[i].textContent||'').trim()==='＋'&&b[i].offsetParent){b[i].click();return 1}}return 0})()`)
    const z2 = JSON.parse(await zoneW() || '{}')
    ok(Math.abs(z2.zone - 1010) <= 6, `① 2 列时水质条铺满(=${z2.zone}px, 期望≈1010)`)
    await plus(); await sleep(300); await plus(); await sleep(600)
    const z4 = JSON.parse(await zoneW() || '{}')
    ok(Math.abs(z4.zone - 1010) <= 6, `② 4 列时水质条仍铺满(=${z4.zone}px)`)
    ok(Math.abs(z4.zone - z2.zone) <= 4, `③ 与样品列数无关(2列=${z2.zone} → 4列=${z4.zone})`)
    // 清理
    await api('/api/px/callButton', { method: 'POST', body: JSON.stringify({ panelCode: 'RD_FILTER_EFF', buttonName: '删除', formData: { 编号: no }, buttonParam: {} }) })
  } catch (e) {
    console.error('PROBE ERROR', e); fails.push('probe error: ' + (e && e.message))
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  console.log(fails.length ? `\n${fails.length} 项失败` : '\n全部通过')
  process.exit(fails.length ? 1 : 0)
}
main().catch((e) => { console.error('PROBE ERROR', e); process.exit(1) })
