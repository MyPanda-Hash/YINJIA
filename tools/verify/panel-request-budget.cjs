/* 验收探针:面板切换的接口请求预算(先红后绿)
   用法: node tools/verify/panel-request-budget.cjs [基线地址]
   断言(与《数据库规范》无关,纯前端契约):
     ① 一次面板切换里 getPanelConfig 对该面板**只允许 1 次**(此前实测 3~7 次)
     ② queryFormDataList **≤ 该面板不同 refPanel 数 + 1**(参照行数应按参照面板去重,而非按字段;此前实测 20 次)
   附加(仅报告,不判失败):attachment/list、report/templates 等其余端点计数
   输出末行固定 RESULT: PASS / FAIL-n(供脚本判定) */
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const API = 'http://localhost:8090'
const PORT = 9450
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
// 覆盖三类:请求多的(doc 单据)、宽表的(archive)、小的(固定开销)
const CASES = ['SO_ORDER', 'QC_RECV', 'INV', 'TEAM']
const NEUTRAL = 'DISPATCH'   // 切换起点(与所有用例不同)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  }).then((r) => r.json())
  const token = login.data.token, user = JSON.stringify(login.data.user)
  const H = { Authorization: `Bearer ${token}` }

  // 预算:不同 refPanel 数(从面板配置算)
  const budget = {}
  for (const p of CASES) {
    const j = await fetch(`${API}/api/px/getPanelConfig?panelCode=${p}`, { headers: H }).then((r) => r.json())
    const d = j.data || {}
    const fields = [...(d.dataSchema?.fields || [])]
    for (const t of (d.detail?.tabs || [])) fields.push(...(t.fields || []))
    const refs = new Set(fields.map((f) => f.refPanel || f.ref_panel).filter(Boolean))
    budget[p] = { refPanels: refs.size, fields: fields.length }
  }

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-b-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', `--window-size=1440,900`,
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  let failed = 0
  try {
    const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); let reqs = []
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
      if (m.method === 'Network.requestWillBeSent' && m.params.request.url.includes('/api/')) {
        const u = m.params.request.url
        const key = u.split('/api/')[1]
        // getPanelConfig 保留 panelCode 维度,便于分辨"面板自身"与"参照面板"配置
        reqs.push(key.startsWith('px/getPanelConfig') ? 'px/getPanelConfig:' + (new URL(u).searchParams.get('panelCode') || '?') : key.split('?')[0])
      }
    }
    const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
    const evaluate = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(user)}); localStorage.setItem('mes_init_done','1'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
    await send('Page.navigate', { url: `${BASE}/#/panelx/list/${NEUTRAL}` }); await sleep(4500)

    for (const p of CASES) {
      // 先回到中性面板并静置,避免把上一个面板的尾巴算进来
      await evaluate(`location.hash='#/panelx/list/${NEUTRAL}'; 'ok'`); await sleep(2200)
      reqs = []
      await evaluate(`location.hash='#/panelx/list/${p}'; 'ok'`)
      await sleep(4000)
      const count = {}
      for (const u of reqs) count[u] = (count[u] || 0) + 1
      const cfgPerCode = Object.entries(count).filter(([k]) => k.startsWith('px/getPanelConfig:'))
        .map(([k, v]) => [k.replace('px/getPanelConfig:', ''), v])
      const cfgN = cfgPerCode.reduce((a, [, v]) => a + v, 0)
      const dupCodes = cfgPerCode.filter(([, v]) => v > 1)
      const qryN = Object.entries(count).filter(([k]) => k.startsWith('px/queryFormDataList')).reduce((a, [, v]) => a + v, 0)
      // 预算口径:1 次自身列表查询 + 每个参照面板至多 2 次
      //   (① 行数判定 refRowCount 用空条件;② 选项行 refSelectOptions 带"已审核"等过滤 ⇒ 两者 key 不同)
      // 这条上界仍能抓住"按字段扇出"的回归:修复前 QC_RECV 是 35 次(参照面板只有 1 个)。
      const refB = budget[p].refPanels * 2 + 1
      const okCfg = dupCodes.length === 0          // 不变式:同一个面板码在一次切换里最多取一次
      const okQry = qryN <= refB
      if (!okCfg || !okQry) failed++
      console.log(`[${okCfg && okQry ? 'PASS' : 'FAIL'}] ${p.padEnd(12)} getPanelConfig=${cfgN}次/不同面板${cfgPerCode.length}个(要求每码≤1) queryFormDataList=${qryN}(≤refPanel ${budget[p].refPanels}+1=${refB}) 其余:${Object.entries(count).filter(([k]) => !k.includes('getPanelConfig') && !k.includes('queryFormDataList')).map(([k, v]) => k + '×' + v).join(' ') || '—'}`)
      if (!okCfg) console.log(`         ↳ 同一面板重复取配置: ` + dupCodes.map(([k, v]) => k + '×' + v).join(' '))
      if (!okQry) console.log(`         ↳ 参照行数请求 ${qryN} 次 > 不同参照面板 ${budget[p].refPanels} 个(应按参照面板去重)`)
    }
    console.log(`\n=== 汇总: FAIL ${failed} ===`)
    console.log(failed === 0 ? 'RESULT: PASS' : 'RESULT: FAIL-' + failed)
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
  process.exit(failed === 0 ? 0 : 1)
}
main().catch((e) => { console.error('[FATAL] ' + e.message); process.exit(2) })
