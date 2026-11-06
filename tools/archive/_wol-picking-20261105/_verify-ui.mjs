/**
 * _verify-ui.mjs —— 2026-11-05 两项改动的界面级取证(只读,不写库)
 *
 * ① 生产工单页:按钮条里**没有**「转领料单」(2026-11-05 用户口径「把按钮删除」),
 *    其余按钮照旧;顺带取证「权限设置」下发的动作集也**没有** picking 词(矩阵列消失)。
 * ② 工单排产页:点「排单计划」出的纸表用的是 2026-11-05 新版式
 *    (正文 10.5px、日期列 6%/天、长表头显式换行),并截图留证。
 *
 * 用法(5173 = 源码态;8090 = 打包产物,任选):
 *   node _verify-ui.mjs [--site http://localhost:5173] [--api http://127.0.0.1:8090/api]
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name)
  return i >= 0 ? process.argv[i + 1] : dflt
}
const SITE = arg('site', 'http://localhost:5173')
const API = arg('api', 'http://127.0.0.1:8090/api')

const checks = []
const check = (name, ok, detail) => {
  checks.push({ name, ok, detail })
  console.log(`${ok ? '  ✅' : '  ❌'} ${name}${detail ? ' — ' + detail : ''}`)
}

// ---------- 登录(正式账套,只读;管理员工号) ----------
const login = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json()
const token = login?.data?.token
const user = login?.data?.user
if (!token) { console.error('[FATAL] 登录失败', JSON.stringify(login).slice(0, 300)); process.exit(1) }
console.log('[login]', user?.userName, 'factory =', user?.factory)

const apiGet = async (p) => {
  const r = await fetch(API + p, { headers: { Authorization: 'Bearer ' + token } })
  return r.json()
}

// ---------- ① 权限矩阵动作集里不能有 picking ----------
const roles = await apiGet('/sys/role/list')
const roleList = roles?.data || []
const adminRole = roleList.find((r) => String(r.isAdmin || r.is_admin || '').toUpperCase() === 'Y') || roleList[0]
let matrixChecked = false
if (adminRole?.id) {
  const panels = await apiGet(`/sys/role/${adminRole.id}/panels`)
  const all = panels?.data?.allPanels || []
  const wol = all.find((p) => p.panelCode === 'WORK_ORDER_LIST')
  const words = (wol?.actions || []).map((a) => a[0])
  console.log('[权限矩阵] WORK_ORDER_LIST 动作 =', JSON.stringify(words))
  check('权限设置:WORK_ORDER_LIST 动作集不含 picking(转领料单)',
    !!wol && !words.includes('picking'), `words=${JSON.stringify(words)}`)
  check('权限设置:其余动作照旧(结案/切单/打印/导出/排产)',
    ['view', 'query', 'print', 'close', 'split', 'export', 'assign'].every((w) => words.includes(w)),
    `words=${JSON.stringify(words)}`)
  matrixChecked = !!wol
}
check('权限设置接口已核对到 WORK_ORDER_LIST 面板', matrixChecked)

// ---------- ② 浏览器:生产工单页按钮条 ----------
const s = await launch({ port: 9487 })
try {
  const shot = async (file) => {
    const png = await s.send('Page.captureScreenshot', { format: 'png' })
    await fs.writeFile(path.join(HERE, file), Buffer.from(png.result.data, 'base64'))
    console.log('[截图]', file)
  }
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 950, deviceScaleFactor: 1, mobile: false })
  await s.navigate(SITE + '/#/login', 2500)
  await s.evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
  await s.navigate('about:blank', 400)
  await s.navigate(SITE + '/#/prod/plan/workOrderList', 9000)

  // 首进可能弹初始化向导,关掉
  for (let i = 0; i < 10; i++) {
    const w = await s.evaluate(`(() => {
      const hit = [...document.querySelectorAll('button, span, div, a')]
        .filter(x => (x.innerText || '').trim() === '下次再说' && x.offsetParent !== null)
      if (hit.length) { hit[hit.length - 1].click(); return 'dismissed' }
      return 'none'
    })()`)
    if (w === 'dismissed') break
    await sleep(800)
  }
  await sleep(1200)

  const bar = await s.evaluate(`(() => {
    const btns = [...document.querySelectorAll('.wol-btns button')].map(b => b.innerText.trim())
    return { btns, rows: document.querySelectorAll('.wol-table .el-table__body-wrapper tr.el-table__row').length }
  })()`)
  console.log('[生产工单] 按钮 =', JSON.stringify(bar?.btns), '| 行数 =', bar?.rows)
  check('生产工单:按钮条里没有「转领料单」', Array.isArray(bar?.btns) && !bar.btns.includes('转领料单'),
    JSON.stringify(bar?.btns))
  check('生产工单:其余按钮照旧(结案/切单/排产/打印工单/导出/刷新)',
    ['结案', '切单', '排产', '打印工单', '导出', '刷新'].every((t) => (bar?.btns || []).some((b) => b.includes(t))),
    JSON.stringify(bar?.btns))
  check('生产工单:列表有数据', (bar?.rows || 0) > 0, 'rows=' + bar?.rows)
  await shot('ui-workorder-buttons.png')

  // ---------- ③ 工单排产:排单计划出纸新版式 ----------
  await s.navigate(SITE + '/#/prod/plan/workOrderBoard', 9000)
  for (let i = 0; i < 8; i++) {
    const w = await s.evaluate(`(() => {
      const hit = [...document.querySelectorAll('button, span, div, a')]
        .filter(x => (x.innerText || '').trim() === '下次再说' && x.offsetParent !== null)
      return hit.length ? (hit[hit.length - 1].click(), 'dismissed') : 'none'
    })()`)
    if (w === 'dismissed') break
    await sleep(600)
  }
  // 左侧选一条**有未完成量**的产线 → 右侧明细出数据(0 量的线点了是空表)
  const pickLine = await s.evaluate(`(() => {
    const ls = [...document.querySelectorAll('.wb-line')]
    const l = ls.find(x => !x.classList.contains('off') && Number((x.querySelector('.wb-qty') || {}).innerText || 0) > 0) || ls[0]
    if (!l) return 'none'
    l.click(); return l.innerText.split('\\n')[0]
  })()`)
  console.log('[工单排产] 选中产线 =', pickLine)
  await sleep(4500)

  // 勾选前 2 行
  const picked = await s.evaluate(`(() => {
    const rows = [...document.querySelectorAll('.wb-main tr.el-table__row')]
    const want = rows.slice(0, 2)
    let n = 0
    for (const r of want) { const cb = r.querySelector('td .el-checkbox'); if (cb) { cb.click(); n++ } }
    return { n, total: rows.length }
  })()`)
  console.log('[工单排产] 勾选 =', JSON.stringify(picked))
  await sleep(600)

  // 拦掉真打印(无头下 window.print 会挂),只为把打印层内容留在 DOM 里
  await s.evaluate('window.print = () => { window.__printed = (window.__printed||0)+1 }')
  const clicked = await s.evaluate(`(() => {
    const b = [...document.querySelectorAll('.wb-actions button')].find(x => (x.innerText || '').trim().startsWith('排单计划'))
    if (!b) return 'no-button'
    if (b.disabled) return 'disabled'
    b.click(); return 'clicked'
  })()`)
  console.log('[工单排产] 点排单计划 =', clicked)
  await sleep(2500)
  const sheet = await s.evaluate(`(() => {
    const host = document.getElementById('yj-print-host')
    if (!host) return { err: 'no-print-host' }
    const html = host.innerHTML
    const style = (html.match(/<style>([\\s\\S]*?)<\\/style>/) || [])[1] || ''
    const ths = [...host.querySelectorAll('thead th')].map(t => t.innerText.trim())
    const dateThs = [...host.querySelectorAll('thead th.dt')].map(t => t.innerText.trim())
    const rows = host.querySelectorAll('tbody tr').length
    const cols = [...host.querySelectorAll('colgroup col')].map(c => c.style.width)
    const tdFs = (style.match(/th,td\\{[^}]*font-size:([\\d.]+px)/) || [])[1]
    return { title: host.querySelector('.hd .t')?.innerText, ths, dateThs, rows, cols, tdFs, htmlLen: html.length }
  })()`)
  console.log('[打印层]', JSON.stringify(sheet))
  check('排单计划:打印层已生成(勾 2 行 ⇒ 2 行数据)', (sheet?.rows || 0) === 2, 'rows=' + sheet?.rows)
  check('排单计划:标题仍是「成型车间排单计划」', sheet?.title === '成型车间排单计划', sheet?.title)
  check('排单计划:新版式正文 10.5px', sheet?.tdFs === '10.5px', 'tdFs=' + sheet?.tdFs)
  check('排单计划:日期列每天 6%(默认 3 天)', (sheet?.dateThs || []).length === 3 &&
    (sheet?.cols || []).filter((w) => Math.abs(parseFloat(w) - 6) < 0.01).length === 3,
    `dateThs=${JSON.stringify(sheet?.dateThs)} cols=${JSON.stringify(sheet?.cols)}`)
  check('排单计划:长表头显式换行(生产计划/数量)',
    (sheet?.ths || []).some((t) => t.replace(/\s+/g, '') === '生产计划数量'),
    JSON.stringify(sheet?.ths))
  // 把打印层内容克隆到一个可见容器里截图(打印层本身离屏 + opacity:0)
  await s.evaluate(`(() => {
    const host = document.getElementById('yj-print-host')
    if (!host) return 'no-host'
    const box = document.createElement('div')
    box.id = 'shot-box'
    box.style.cssText = 'position:fixed;left:0;top:0;width:1123px;background:#fff;z-index:99999;padding:0'
    box.innerHTML = host.innerHTML
    document.body.appendChild(box)
    return 'ok'
  })()`)
  await sleep(600)
  await shot('ui-plan-sheet.png')
  await s.evaluate(`document.getElementById('shot-box')?.remove()`)
} finally {
  try { s.close?.() } catch { /* ignore */ }
}

const bad = checks.filter((c) => !c.ok)
console.log(`\n[结果] ${checks.length - bad.length}/${checks.length} PASS`)
process.exit(bad.length ? 1 : 0)
