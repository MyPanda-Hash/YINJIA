/*
 * _verify-qc-item-plan.mjs — 检验项目/检验方案「接口 + 界面」核查(2026-10-09,一次性探针)
 *
 * 链路:登录 → /api/px/queryFormDataList 取 QC_ITEM / QC_PLAN 存档行(断言 YJ-Q-125 播种行齐、新列有值)
 *       → /api/px/getPanelConfig 断言三类工序检验单已挂 检验方案/表区/检验方法 字段
 *       → 用 Edge(headless+CDP)打开「检验项目」面板,断言表格渲染出 13 行并截图留证。
 *
 * 用法:
 *   node tools/archive/_verify-qc-item-plan.mjs                       # 默认 http://127.0.0.1:8091
 *   node tools/archive/_verify-qc-item-plan.mjs http://127.0.0.1:8091
 *
 * 只读:仅查询与截图。
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'

const BASE = (process.argv[2] || 'http://127.0.0.1:8091').replace(/\/$/, '')
const PORT = 9453
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const HERE = import.meta.dirname
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
}).then((r) => r.json())
const token = login.data?.token
if (!token) { console.error('登录失败: ' + JSON.stringify(login).slice(0, 200)); process.exit(1) }
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
const post = async (p, b) => (await fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) })).json()
const get = async (p) => (await fetch(BASE + p, { headers: H })).json()

/** 档案式面板(queryArchive)的取数口径:data.list[*].detail.<detailKey>[] 摊平 */
const archiveRows = (res) => (res?.data?.list || []).flatMap((d) => Object.values(d?.detail || {}).flat())

// ── ① 检验项目档案:14 行(成品 2 + 原料 12)+ 新列有值 ───────────────────────────
console.log('\n=== ① 检验项目(QC_ITEM)===')
const itemRes = await post('/api/px/queryFormDataList', { panelCode: 'QC_ITEM', pageNo: 1, pageSize: 100 })
const items = archiveRows(itemRes)
ok('接口取到检验项目行 = 14(YJ-Q-125 播种)', items.length === 14, items.length + ' 行')
const mesh = items.filter((r) => String(r['方案编码'] || '') === 'QP-CAS18')
ok('成品方案 QP-CAS18 下 2 条目数项目', mesh.length === 2, mesh.map((r) => r['项目名称']).join(','))
ok('目数(+20目) 标准 = +20目占比≤15%', mesh.some((r) => r['检验标准'] === '+20目占比≤15%'), JSON.stringify(mesh.map((r) => r['检验标准'])))
ok('新列「检验方法」有值', mesh.every((r) => String(r['检验方法'] || '').includes('筛分')), String(mesh[0]?.['检验方法'] || '').slice(0, 40))
ok('新列「取样要求」= 称取100g', mesh.every((r) => r['取样要求'] === '称取100g'))
ok('新列「不合格处置」= 重新筛分', mesh.every((r) => r['不合格处置'] === '重新筛分'))
const health = items.filter((r) => String(r['方案编码'] || '') === 'QP-YCAS23')
ok('原料方案 QP-YCAS23 下 12 项(性能1+卫生安全11)', health.length === 12, health.length + ' 行')

// ── ② 检验方案:2 行 + 取样规则/文件编码 ────────────────────────────────────────
console.log('\n=== ② 检验方案(QC_PLAN)===')
const planRes = await post('/api/px/queryFormDataList', { panelCode: 'QC_PLAN', pageNo: 1, pageSize: 100 })
const plans = archiveRows(planRes)
ok('接口取到检验方案行 = 2', plans.length === 2, plans.length + ' 行')
const p18 = plans.find((r) => r['方案编码'] === 'QP-CAS18')
ok('QP-CAS18 存在', !!p18)
ok('适用存货 = Y料(与 bs_inv.CAS-18 存货名称一致 ⇒ 按产品可命中)', p18?.['适用存货'] === 'Y料', String(p18?.['适用存货']))
ok('文件编码 = YJ-Q-125', p18?.['文件编码'] === 'YJ-Q-125')
ok('取样规则 = 每50kg成品取样1个，每个样品200g', String(p18?.['取样规则'] || '').startsWith('每50kg成品'), String(p18?.['取样规则']))

// ── ③ 三类工序检验单已挂新字段(建单后能在单上显示)────────────────────────────
console.log('\n=== ③ 三类工序检验单字段(QC_ASM_INSP / QC_MOLD_INSP / QC_CUT_INSP)===')
for (const pc of ['QC_ASM_INSP', 'QC_MOLD_INSP', 'QC_CUT_INSP']) {
  const cfg = await get('/api/px/getPanelConfig?panelCode=' + pc)
  const txt = JSON.stringify(cfg)
  ok(`${pc} 含 检验方案/文件编码/执行标准/表区/检验方法 字段`,
    ['检验方案', '文件编码', '执行标准', '表区', '检验方法'].every((k) => txt.includes(k)))
}

// ── ④ 界面:「检验项目」面板渲染 13 行 + 截图 ──────────────────────────────────
console.log('\n=== ④ 界面:打开「检验项目」面板 ===')
{
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-qcitem-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1000',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }).then((r) => r.json())
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pend = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
    const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
    const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable')
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(1500)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_init_done','1'); localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
    await send('Page.navigate', { url: `${BASE}/#/panelx/list/QC_ITEM` }); await sleep(5000)

    const rows = await ev(`document.querySelectorAll('.el-table__row').length`)
    ok('「检验项目」面板渲染出数据行', rows >= 14, rows + ' 行')
    const cols = await ev(`[...document.querySelectorAll('.el-table__header-wrapper th')].map(th=>(th.innerText||'').trim().split('\\n')[0]).filter(Boolean)`)
    ok('列头含 检验方法/取样要求/方案编码/不合格处置',
      ['检验方法', '取样要求', '方案编码', '不合格处置'].every((k) => (cols || []).includes(k)), JSON.stringify(cols))
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    if (shot?.result?.data) {
      const out = path.join(HERE, '_shot-qc-item-plan.png')
      fs.writeFileSync(out, Buffer.from(shot.result.data, 'base64'))
      console.log('    [截图] ' + out)
    }
  } finally { try { edge.kill() } catch { /* ignore */ } }
}

console.log(`\n[结果] pass=${pass} fail=${fail}`)
process.exit(fail === 0 ? 0 : 1)
