/**
 * _probe-sched-cols.mjs — 快速排产「已排产」列表新增 产品编号/品名/型号 的界面探针(2026-10-21)
 *
 * 用户口径:「快速排产看不到已排单的型号,当前需要增加对应的产品还有规格型号需要增加」
 * 验证点(全部在**渲染出来的 DOM**上看,不看源码):
 *   ① ②③已排产表的列头含 产品编号 / 品名 / 型号,位置在 批次号 之后、生产状态 之前;
 *   ② 数据行里这三列**有值**(与接口返回一致),不是空列;
 *   ③ ①待排产池的列头没被挤掉/改名(同一屏两张表口径一致);
 *   ④ 切到英文后三个列头是英文(Product No. / Item Name / Model),不是中文。
 *
 * 用法(仓库根;8090 已重启后):node tools/archive/_sched-prod-cols-20261021/_probe-sched-cols.mjs
 * 产物:tools/archive/_sched-prod-cols-20261021/sched-cols.png / sched-cols-en.png
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const UI = process.env.MES_UI || 'http://127.0.0.1:8090'
const API = 'http://127.0.0.1:8090'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9347
const OUT = 'tools/archive/_sched-prod-cols-20261021'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(OUT, { recursive: true })

let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log(`  [PASS] ${m}`) } else { fail++; console.log(`  [FAIL] ${m}`) } }

const lg = await (await fetch(API + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lg.data.token

const profile = mkdtempSync(join(tmpdir(), 'edge-sched-'))
const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1920,1100', 'about:blank'], { stdio: 'ignore' })

let ws, msgId = 0
const pending = new Map()
for (let i = 0; i < 40; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
    const page = list.find((t) => t.type === 'page')
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
      break
    }
  } catch { /* 还没起来 */ }
  await sleep(500)
}
if (!ws) { console.error('连不上 Edge CDP'); process.exit(2) }
const send = (method, params) => { const id = ++msgId; return new Promise((r) => { pending.set(id, r); ws.send(JSON.stringify({ id, method, params: params || {} })) }) }
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value

await send('Page.enable'); await send('Runtime.enable')
// headless=new 下 --window-size 不一定生效(实测截图只有 500×320)⇒ 明摆视口尺寸,
// 否则「已排产」那张宽表会被挤成两行,截图看不清新增列。
await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1100, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: UI + '/#/login' })
await sleep(3000)
await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});`
  + `localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lg.data.user))});`
  + `localStorage.setItem('mes_factory', ${JSON.stringify(JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))});`
  + `localStorage.setItem('mes_locale', 'zh-CN'); 'ok'`)
// ⚠ 必须换 URL 才能**整页重载**:只改 hash 时 pinia user store 还是"未登录"的旧内存态,
//   路由守卫会把 /prod/plan/scheduleBoard 弹回 /login,再重载又被弹到 /dashboard(实测)。
//   带一个查询串强制新文档加载,同时保留目标 hash。
await send('Page.navigate', { url: `${UI}/?r=${Date.now()}#/prod/plan/scheduleBoard` })
await sleep(6000)

// 等两张表都渲染出数据行
for (let i = 0; i < 40; i++) {
  if (await ev(`document.querySelectorAll('.sb-block').length >= 2
      && !!document.querySelectorAll('.sb-block')[1].querySelector('.el-table__body tbody tr')`)) break
  await sleep(500)
}
await sleep(1200)

/** 取第 idx 个区块(0=待排产池,1=已排产)的表头列名 + 前 2 行的单元格文本 */
const readTable = (idx) => `(() => {
  const blk = document.querySelectorAll('.sb-block')[${idx}]
  if (!blk) return null
  const heads = [...blk.querySelectorAll('.el-table__header-wrapper thead th')].map(th => (th.innerText || '').trim()).filter(Boolean)
  const rows = [...blk.querySelectorAll('.el-table__body tbody tr')].slice(0, 3).map(tr =>
    [...tr.querySelectorAll('td')].map(td => (td.innerText || '').trim()))
  return { heads, rows }
})()`

const sched = await ev(readTable(1))
console.log('\n[1] ②③已排产 表头(界面实际渲染)')
console.log('     列头 =', JSON.stringify(sched?.heads || []))
const heads = sched?.heads || []
ok(heads.includes('产品编号') && heads.includes('品名') && heads.includes('型号'),
  '列头含 产品编号 / 品名 / 型号')
const iBatch = heads.indexOf('批次号'), iDm = heads.indexOf('产品编号'), iGg = heads.indexOf('型号'), iSt = heads.indexOf('生产状态')
ok(iBatch >= 0 && iDm === iBatch + 1, `产品编号紧跟 批次号(批次号#${iBatch} → 产品编号#${iDm})`)
ok(iGg > iDm && iSt > iGg, `顺序 批次号 → 产品编号 → 品名 → 型号 → 生产状态(型号#${iGg}, 生产状态#${iSt})`)

console.log('\n[2] 数据行里三列有值')
const row0 = sched?.rows?.[0] || []
console.log('     首行 =', JSON.stringify(row0))
// 行首是勾选列(表头无文字 ⇒ 已被 filter(Boolean) 滤掉),所以列下标要按差值平移
const off = row0.length - heads.length
console.log(`     列头 ${heads.length} 列 / 数据 ${row0.length} 列 ⇒ 勾选列偏移 = ${off}`)
ok(off >= 0 && row0.length > iGg + off, '首行有足够单元格')
ok(row0[iDm + off] && row0[iDm + off] !== '-', `产品编号列有值:${row0[iDm + off]}`)
ok(row0[iDm + off + 1], `品名列有值:${row0[iDm + off + 1]}`)
ok(row0[iGg + off], `型号列有值:${row0[iGg + off]}`)

console.log('\n[3] ①待排产池列头未被影响')
const pool = await ev(readTable(0))
console.log('     列头 =', JSON.stringify(pool?.heads || []))
ok((pool?.heads || []).includes('产品编号') && (pool?.heads || []).includes('品名') && (pool?.heads || []).includes('型号'),
  '待排产池仍有 产品编号/品名/型号')

// 切到「全部已排产」(用户截图就是这一档),再看列宽总量是否塞得进可视区 ——
// 加三列后做了一轮列宽收紧,目标:1920 宽屏下「计划线」不被挤出可视区。
await ev(`(() => {
  const sw = document.querySelectorAll('.sb-block')[1]?.querySelector('.el-switch')
  if (sw && !sw.classList.contains('is-checked')) sw.click()
  return 'ok'
})()`)
await sleep(2500)
const metric = await ev(`(() => {
  const blk = document.querySelectorAll('.sb-block')[1]
  if (!blk) return null
  const ths = [...blk.querySelectorAll('.el-table__header-wrapper thead th')]
  const wrap = blk.querySelector('.el-table__header-wrapper')
  return {
    title: blk.querySelector('.sb-block-title')?.innerText.trim(),
    sum: ths.reduce((a, t) => a + t.offsetWidth, 0),
    viewport: wrap?.clientWidth,
    rows: blk.querySelectorAll('.el-table__body tbody tr').length,
  }
})()`)
console.log('\n[4] 全部已排产 档位 + 列宽总量')
console.log('     =', JSON.stringify(metric))
ok(/全部已排产/.test(metric?.title || ''), `已切到「全部已排产」(标题=${metric?.title})`)
ok(metric?.rows > 0, `全部模式有数据行(${metric?.rows} 行)`)
ok((metric?.sum ?? 0) <= (metric?.viewport ?? 0) + 60,
  `列宽合计 ${metric?.sum} vs 可视 ${metric?.viewport} —— 计划线不被整列挤出(容差 60px)`)

// 截图(中文):整屏 + ②③那张表本身(像用户发来的那种长条图)
await ev(`document.querySelectorAll('.sb-block')[1]?.scrollIntoView({ block: 'start' }); 'ok'`)
await sleep(600)
let shot = await send('Page.captureScreenshot', { format: 'png' })
if (shot.result?.data) writeFileSync(join(OUT, 'sched-cols.png'), Buffer.from(shot.result.data, 'base64'))
const rect = await ev(`(() => {
  const blk = document.querySelectorAll('.sb-block')[1]
  if (!blk) return null
  const r = blk.getBoundingClientRect()
  return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }
})()`)
if (rect) {
  const crop = await send('Page.captureScreenshot', {
    format: 'png', clip: { ...rect, scale: 1 }, captureBeyondViewport: false,
  })
  if (crop.result?.data) writeFileSync(join(OUT, 'sched-cols-table.png'), Buffer.from(crop.result.data, 'base64'))
}

// 切英文复核译名(ADR-0001:显示层要翻,数据键不翻)
await ev(`localStorage.setItem('mes_locale','en'); 'ok'`)
await send('Page.reload', { ignoreCache: true })
await sleep(6000)
for (let i = 0; i < 40; i++) {
  if (await ev(`!!document.querySelectorAll('.sb-block')[1]
      && !!document.querySelectorAll('.sb-block')[1].querySelector('.el-table__body tbody tr')`)) break
  await sleep(500)
}
await sleep(1500)
const en = await ev(readTable(1))
console.log('\n[5] 英文下三个列头')
console.log('     列头 =', JSON.stringify(en?.heads || []))
const enHeads = en?.heads || []
ok(enHeads.includes('Product No.') && enHeads.includes('Item Name') && enHeads.includes('Model'),
  '英文列头 = Product No. / Item Name / Model')
ok(enHeads.every((h) => !/[\u4e00-\u9fa5]/.test(h)), '英文下列头不残留中文')
const shot2 = await send('Page.captureScreenshot', { format: 'png' })
if (shot2.result?.data) writeFileSync(join(OUT, 'sched-cols-en.png'), Buffer.from(shot2.result.data, 'base64'))
await ev(`localStorage.setItem('mes_locale','zh-CN'); 'ok'`)
try { edge.kill() } catch { /* ignore */ }
console.log(`\n截图: ${OUT}/sched-cols.png、${OUT}/sched-cols-en.png`)
console.log(`\n== 结果: ${pass} 通过 / ${fail} 失败 ==`)
process.exit(fail ? 1 : 0)
