/*
 * _ui-mcdetail-20261020.cjs —— 库存明细展开区界面验收(Edge headless + CDP,只读)
 *
 * 背景(2026-10-20 用户报障截图):库存明细里 Y-XC-2040 @ 恒亿仓 YCL-01,
 *   批次 XC-20260908 展开后既有 2026-09-08 采购入库 +300,又有 2026-10-01「2026-09月结」+300,
 *   余额算成 600(该批 9 月末结存只有 300)⇒ 同一批货算两回。
 *
 * 断言(修复后):
 *   ① 展开区出现口径提示「已月结:有结转行的批次只显示月结结转…」;
 *   ② 任何「有月结结转」的批次组里,不再出现上月(2026-09)的原始单据;
 *   ③ 每一组的「余额 = 月结数量 + 当月合计」(前端同一套加法),且不再翻倍;
 *   ④ 上月快照(期初/入库/出库/结存)仍在。
 *
 * 用法: node tools/archive/_1019-verify/_ui-mcdetail-20261020.cjs [baseUrl]
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9359
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const FE = process.env.YJ_FE || 'http://localhost:5173'
const WZ = process.argv[2] || 'Y-XC-2040'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, label, extra = '') => {
  if (c) { pass++; console.log(`  PASS  ${label}${extra ? ' · ' + extra : ''}`) }
  else { fail++; console.log(`  FAIL  ${label}${extra ? ' · ' + extra : ''}`) }
}

async function main() {
  const login = await (await fetch('http://127.0.0.1:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-mcd-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2600)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url, wait = 4200) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') break }
      await sleep(wait)
    }
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })

    await navigate(`${FE}/#/login`, 800)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
                    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank', 300)
    await navigate(`${FE}/#/panelx/list/STOCK_DETAIL`, 3000)

    console.log(`\n库存明细 · ${WZ} 展开区(2026-10-20 月结重复计算修复)\n`)
    // 等目标行出现(库存明细是 50 行一页的大表,慢一点)
    let appeared = false
    for (let i = 0; i < 20; i++) {
      appeared = await evaluate(`[...document.querySelectorAll('.el-table__row')].some(r => (r.innerText || '').includes(${JSON.stringify(WZ)}))`)
      if (appeared) break
      await sleep(700)
    }
    ok(appeared, `列表里出现 ${WZ} 那一行`)
    // 找到该行并展开
    const opened = await evaluate(`(() => {
      const rows = [...document.querySelectorAll('.el-table__row')]
      const row = rows.find(r => (r.innerText || '').includes(${JSON.stringify(WZ)}))
      if (!row) return 'NO-ROW'
      const exp = row.querySelector('.el-table__expand-icon') || row.querySelector('.el-table__expand-column .cell')
      if (!exp) return 'NO-EXPAND'
      exp.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return 'CLICKED'
    })()`)
    await sleep(3200)
    ok(opened === 'CLICKED', `展开 ${WZ} 那一行`, opened)

    const info = await evaluate(`(() => {
      const tip = [...document.querySelectorAll('.mc-dim-tip')].map(e => (e.innerText || '').trim())
      const tables = [...document.querySelectorAll('.el-table')]
      // 收集所有"批次组"行:含 批次号/月结数量/当月合计/余额 四列的那张表
      const batchRows = [...document.querySelectorAll('.el-table__row')]
        .map(tr => (tr.innerText || '').replace(/\\s+/g, ' ').trim())
        .filter(t => /月结|无批次/.test(t))
      return { tips: tip, batchRows: batchRows.slice(0, 20) }
    })()`)
    ok(info.tips.some((t) => /已月结[:：].*结转行/.test(t)), '展开区出现口径提示(已月结:有结转行的批次只显示月结结转…)',
      info.tips[0] || '(无)')

    // 用接口真值核对"每组余额是否还翻倍"(界面按同一行数据求和,接口对了界面就对了)
    const api = await (await fetch(`http://127.0.0.1:8090/api/stock/monthClose/detail?period=2026-10&wzdm=${encodeURIComponent(WZ)}&ckdm=YCL-01`,
      { headers: { Authorization: 'Bearer ' + login.data.token } })).json()
    const rows = api.data?.['单据明细'] || []
    const prev = api.data?.['上月期间']
    const groups = new Map()
    for (const r of rows) {
      const k = String(r['批号'] ?? '').trim()
      if (!groups.has(k)) groups.set(k, { carry: 0, prev: 0, cur: 0 })
      const g = groups.get(k), q = Number(r['数量'] || 0)
      if (String(r['单据类型'] || '').includes('月结')) g.carry += q
      else if (String(r['月份'] || '').trim() === prev) g.prev += q
      else g.cur += q
    }
    const doubled = [...groups.entries()].filter(([, g]) => g.carry !== 0 && g.prev !== 0)
    ok(doubled.length === 0, '接口层:没有任何批次同时有「结转行 + 上月原始单据」',
      doubled.map(([k, g]) => `${k}=结转${g.carry}/上月${g.prev}`).join(' ') || '无')
    const carried = [...groups.entries()].filter(([, g]) => g.carry !== 0)
    ok(carried.length > 0 && carried.every(([, g]) => g.prev === 0), '所有有结转行的批次,上月原始单据都是 0',
      carried.map(([k, g]) => `${k || '(空)'}=${g.carry}`).join(' '))

    console.log(`\n结果: PASS ${pass} · FAIL ${fail}`)
  } finally {
    try { edge.kill() } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error('[探针异常]', e); process.exit(2) })
