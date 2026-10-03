/* 列级虚拟化正确性探针:INV 滚动到最右端,末列应渲染且单元格有数据(不能只见空白占位)
   用法: node --experimental-websocket tools/verify/col-virtual-test.cjs [baseUrl] */
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const BASE = process.argv[2] || 'http://localhost:5173'
const API = 'http://localhost:8090'
const PORT = 9455
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  }).then((r) => r.json())
  const H = { Authorization: `Bearer ${login.data.token}` }
  const cfg = await fetch(`${API}/api/px/getPanelConfig?panelCode=INV`, { headers: H }).then((r) => r.json())
  const rawCols = cfg.data?.metadata?.panelPageDto?.tablePages?.[0]?.gridTabs?.[0]?.columns || []
  // 档案面板的 columns 是字符串数组(列名即数据键);doc/flat 面板才是对象 —— 两种都兼容
  const cols = rawCols.map((c) => (typeof c === 'string' ? c : String(c.label ?? c.name ?? c.title ?? c.prop ?? ''))).filter(Boolean)
  const lastCol = cols[cols.length - 1]
  const firstCol = cols[0]
  const midCol = cols[Math.floor(cols.length / 2)]

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-cv-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--window-size=1440,900`,
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const errs = []
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push((m.params.args || []).map((a) => a.value || a.description || '').join(' ').slice(0, 160))
      if (m.method === 'Runtime.exceptionThrown') errs.push('exc: ' + String(m.params.exceptionDetails?.exception?.description || '').slice(0, 160))
    }
    const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
    const evaluate = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1200)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_init_done','1'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
    await send('Page.navigate', { url: `${BASE}/#/panelx/list/INV` }); await sleep(5000)

    const headers = () => evaluate(`JSON.stringify([...document.querySelectorAll('.el-table__header th')].map(x=>((x.innerText||'').split('\\n')[0]||'').trim()).filter(Boolean))`)
    ok('控制台无错误(挂载)', errs.length === 0, errs.slice(0, 2).join(' | '))
    const h0 = JSON.parse(await headers())
    ok('首屏含首列「' + firstCol + '」', h0.includes(firstCol), '实际:' + h0.slice(0, 6).join(','))
    ok('首屏列数 < 配置列数(虚拟化生效,配置 ' + cols.length + ' 列)', h0.length < cols.length, '实际渲染 ' + h0.length)

    // 滚到最右端(逐步触发补窗)
    const WRAP = `(document.querySelector('.el-table__body-wrapper .el-scrollbar__wrap')||document.querySelector('.el-table__body-wrapper'))`
    for (let i = 0; i < 60; i++) { const done = await evaluate(`${WRAP} && (${WRAP}.scrollLeft = ${WRAP}.scrollWidth, 'ok')`); if (!done) break; await sleep(150) }
    await sleep(800)
    const h1 = JSON.parse(await headers())
    ok('滚到最右后含末列「' + lastCol + '」', h1.includes(lastCol), '实际末列:' + (h1[h1.length - 1] || '?'))
    ok('控制台无错误(滚动后)', errs.length === 0, errs.slice(0, 2).join(' | '))

    // 滚到中部:中列应渲染且有数据(右端末列在库里可能本来就空,不作数据断言)
    await evaluate(`${WRAP} && (${WRAP}.scrollLeft = ${WRAP}.scrollWidth / 2, 'ok')`)
    for (let i = 0; i < 12; i++) { await evaluate(`${WRAP} && (${WRAP}.scrollLeft = ${WRAP}.scrollWidth / 2, 'ok')`); await sleep(120) }
    await sleep(600)
    const h2 = JSON.parse(await headers())
    const midOk = h2.includes(midCol)
    ok('滚到中部含中列「' + midCol + '」', midOk, '实际:' + h2.slice(0, 5).join(',') + '…')
    const midCells = await evaluate(`(()=>{const tbl=document.querySelector('table.el-table__body');if(!tbl)return 'NO_TBL';const rows=[...tbl.querySelectorAll('tr')].slice(0,5);return JSON.stringify({rows:rows.length,tds:(rows[0]?rows[0].querySelectorAll('td').length:0)})})()`)
    if (midOk) {
      // 数据面事实:INV 测试数据仅 12/55 列有值(右半全空),故中部只断言"窗口非空、行格渲染",
      // 不对中部单元格数值做断言(2026-09-28 实测:列[16..54] 填充 0/114)
      const g = JSON.parse(midCells)
      ok('中部窗口行/格已渲染', g.rows > 0 && g.tds >= 5, JSON.stringify(g))
    }

    // 滚回最左:首列渲染且有数据
    for (let i = 0; i < 20; i++) { await evaluate(`${WRAP} && (${WRAP}.scrollLeft = 0, 'ok')`); await sleep(100) }
    await sleep(600)
    const h3 = JSON.parse(await headers())
    ok('滚回最左后首列「' + firstCol + '」仍在', h3.includes(firstCol), '实际:' + h3.slice(0, 4).join(','))
    const leftCells = await evaluate(`(()=>{const tbl=document.querySelector('table.el-table__body');if(!tbl)return 'NO_TBL';const rows=[...tbl.querySelectorAll('tr')].slice(0,5);return JSON.stringify(rows.map(r=>[...r.querySelectorAll('td')].map(t=>(t.innerText||'').trim())))})()`)
    const gl = JSON.parse(leftCells)
    ok('最左行单元格有数据', gl.some((r) => r.some((c) => c.length > 0)), JSON.stringify(gl[0] || []).slice(0, 100))

    console.log(`\n结果: pass=${pass} fail=${fail}`)
    console.log(fail === 0 ? 'RESULT: PASS' : 'RESULT: FAIL-' + fail)
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(2) })
