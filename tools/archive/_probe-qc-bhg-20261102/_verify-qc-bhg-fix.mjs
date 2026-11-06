/**
 * _verify-qc-bhg-fix.mjs — 不合格报告(制程) QC_BHG 两处修复的界面取证(2026-11-02)
 *
 * 用户报障(附截图):「当前这个不合格处理中的填写人应该默认当前创建的账号名称
 *   而且当前填写部门中的点击选择的框体明细超出表格」。
 *
 * 本脚本在**真实浏览器**里跑两段,并截图:
 *   Ⓐ 打开**已有空草稿**(用户截图那张就是 2026-09-10 的老草稿,填写人为空)
 *      ⇒ 「填写人」应显示当前登录人姓名(显示层默认,不动库);
 *   Ⓑ 点「新增」建一张新草稿
 *      ⇒ 「填写人」= 当前登录人姓名、且是纯文本(不是"填了也存不进"的输入框);
 *      ⇒ 「填写部门」的参照框(.as-ref-ctl)右边界必须 ≤ 信息表右边界(overflowPx ≤ 0);
 *      ⇒ 后端建单预填生效:库内该单「填写人」也应有值。
 * 收尾把 Ⓑ 新建的草稿作废(不留脏数据)。
 *
 * 用法: node tools/archive/_probe-qc-bhg-20261102/_verify-qc-bhg-fix.mjs
 *   env YJ_API 默认 http://localhost:8090/api;YJ_FRONT 默认 http://localhost:5173
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const API = process.env.YJ_API || 'http://localhost:8090/api'
const FRONT = process.env.YJ_FRONT || 'http://localhost:5173'
const PORT = 9427
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const SKIP_OLD = process.env.YJ_SKIP_OLD === '1'   // 只验证「新增」那条流(截图会是新单,方便对照)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let fails = 0
const ok = (c, msg) => { console.log(`  ${c ? '[PASS]' : '[FAIL]'} ${msg}`); if (!c) fails++ }

// ── 1. API 登录 + 当前单据清单(用于挑老草稿 / 识别并清理本次新增) ─────────────
const lj = await (await fetch(API + '/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json()
const token = lj?.data?.token
const who = lj?.data?.user?.realName || lj?.data?.user?.userName
if (!token) throw new Error('登录失败: ' + JSON.stringify(lj).slice(0, 200))
const H = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + token }
const post = async (p, b) => (await (await fetch(API + p, { method: 'POST', headers: H, body: JSON.stringify(b) })).json())
const listRows = async () => {
  const r = await post('/px/queryFormDataList', { panelCode: 'QC_BHG', condition: {}, keyword: '', pageNo: 1, pageSize: 200 })
  return r?.data?.list || r?.list || []
}
const rowsBefore = await listRows()
const noOf = (x) => String(x['编号'] ?? x['单据编号'] ?? '')
const before = new Set(rowsBefore.map(noOf).filter(Boolean))
// 老草稿:草稿态 + 填写人为空(用户报障的那种)
const oldDraft = rowsBefore.find((x) => String(x['单据状态'] ?? '').includes('草稿')
  && !String(x['填写人'] ?? '').trim())
console.log(`已有空草稿: ${oldDraft ? noOf(oldDraft) : '(无,跳过 Ⓐ)'}`)

// ── 2. 起 Edge(headless)+ CDP ───────────────────────────────────────────────
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-qcbhg-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(800)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* 等端口 */ }
}
if (!tab) throw new Error('Edge CDP 未就绪')

const cdp = await attachCdp(PORT, tab.id)
const ev = cdp.ev

/** 读右上信息表:每行标签/值/是否输入控件/是否参照框 + 参照框与表格的边界 */
const readInfo = () => ev(`(() => {
  const sheet = document.querySelector('.approval-sheet');
  const table = document.querySelector('.as-info-table');
  const ctl = document.querySelector('.as-info-value .as-ref-ctl');
  const rows = [...document.querySelectorAll('.as-info-row')].map((r) => ({
    label: (r.querySelector('.as-info-label')?.textContent || '').trim(),
    value: (r.querySelector('.as-info-value')?.textContent || '').trim(),
    inputCount: r.querySelectorAll('input, textarea').length,
    hasRefCtl: !!r.querySelector('.as-ref-ctl'),
  }));
  const t = table?.getBoundingClientRect();
  const c = ctl?.getBoundingClientRect();
  const s = sheet?.getBoundingClientRect();
  const docNo = (document.querySelector('.as-docno')?.textContent || '').trim();
  return {
    docNo,
    rows,
    table: t ? { left: +t.left.toFixed(1), top: +t.top.toFixed(1), right: +t.right.toFixed(1), width: +t.width.toFixed(1), height: +t.height.toFixed(1) } : null,
    ctl: c ? { left: +c.left.toFixed(1), right: +c.right.toFixed(1), width: +c.width.toFixed(1) } : null,
    sheet: s ? { left: +s.left.toFixed(1), top: +s.top.toFixed(1), right: +s.right.toFixed(1), width: +s.width.toFixed(1) } : null,
    overflowTablePx: c && t ? +(c.right - t.right).toFixed(1) : null,
    overflowSheetPx: c && s ? +(c.right - s.right).toFixed(1) : null,
    scrollW: document.documentElement.scrollWidth,
  };
})()`)

await cdp.send('Page.enable')
await cdp.send('Runtime.enable')
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1000, deviceScaleFactor: 1, mobile: false })

/** 截一张「右上信息表 + 大标题」的图(带上文;红框位置就是用户截图圈的地方) */
async function shoot(info, file) {
  const clip = {
    x: Math.max(0, (info.table?.left || 0) - 460),
    y: Math.max(0, (info.table?.top || 0) - 90),
    width: Math.min(940, (info.table?.width || 300) + 500),
    height: Math.min(320, (info.table?.height || 84) + 150),
    scale: 2,
  }
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip })
  const b64 = shot?.result?.data
  if (b64) { fs.writeFileSync(file, Buffer.from(b64, 'base64')); console.log(`  截图: ${file}`) }
  else console.log('  [WARN] 截图失败(Page.captureScreenshot 无数据)')
}

let createdNo = null
try {
  await cdp.send('Page.navigate', { url: `${FRONT}/#/login` })
  await sleep(2500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user))});
localStorage.setItem('mes_login_date', '2026-11-02'); localStorage.setItem('mes_locale', 'zh-CN'); 'ok'`)

  // ── Ⓐ 已有空草稿 ────────────────────────────────────────────────────────
  if (oldDraft && !SKIP_OLD) {    console.log(`\n=== Ⓐ 打开已有空草稿 ${noOf(oldDraft)}(用户截图那种) ===`)
    await cdp.send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/QC_BHG?docNo=${encodeURIComponent(noOf(oldDraft))}` })
    for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.as-info-table')`)) break }
    await sleep(1200)
    const infoOld = await readInfo()
    const fillerOld = (infoOld.rows || []).find((r) => r.label === '填写人')
    console.log(`  当前单据: ${infoOld.docNo}`)
    ok(!!fillerOld, '找到「填写人」行')
    ok(!!fillerOld && fillerOld.value === who,
      `老草稿的填写人也带出当前登录人「${fillerOld?.value}」(=「${who}」)`)
    ok(!!fillerOld && fillerOld.inputCount === 0, `老草稿的填写人同样是纯文本(输入框数 ${fillerOld?.inputCount})`)
    await shoot(infoOld, path.join(__dirname, 'qc-bhg-old-draft.png'))
  }

  // SKIP_OLD / 无老草稿时还没进过面板:先打开面板(否则页面上没有「新增」按钮)
  if (SKIP_OLD || !oldDraft) {
    await cdp.send('Page.navigate', { url: `${FRONT}/?_v=${Date.now()}#/panelx/list/QC_BHG` })
    for (let i = 0; i < 90; i++) { await sleep(400); if (await ev(`!!document.querySelector('.as-info-table')`)) break }
    await sleep(1200)
  }

  // ── Ⓑ 新增一张 ──────────────────────────────────────────────────────────
  console.log('\n=== Ⓑ 新增一张不合格报告(制程) ===')
  const clicked = await ev(`(() => {
    const b = [...document.querySelectorAll('.as-side-btn, .tb-main, .ctx-item')]
      .find((x) => x.textContent.trim() === '新增');
    if (!b) return 'not-found';
    b.click(); return 'clicked';
  })()`)
  ok(clicked === 'clicked', `找到并点击「新增」(${clicked})`)
  for (let i = 0; i < 40; i++) { await sleep(500); if (await ev(`!!document.querySelector('.as-info-table')`)) break }
  await sleep(2500)

  const rowsAfter = await listRows()
  createdNo = rowsAfter.map(noOf).find((n) => n && !before.has(n)) || null
  console.log(`  本次新增单号: ${createdNo || '(未识别)'}`)
  // 等界面真正切到新单(列表刷新/定位是异步的,早读会量到上一张单 —— 截图会自相矛盾)
  if (createdNo) {
    for (let i = 0; i < 40; i++) {
      await sleep(500)
      if (await ev(`document.body.innerText.includes(${JSON.stringify(createdNo)})`)) break
    }
    await sleep(800)
  }

  const info = await readInfo()
  console.log('  信息表:', JSON.stringify(info, null, 2))

  console.log('\n=== ① 填写人 = 当前登录人姓名,且是纯文本 ===')
  const filler = (info.rows || []).find((r) => r.label === '填写人')
  ok(!!filler, '找到「填写人」行')
  ok(!!filler && filler.value === who, `填写人显示「${filler?.value}」= 登录人「${who}」`)
  ok(!!filler && filler.inputCount === 0, `填写人不是可输入控件(输入框数 ${filler?.inputCount})`)

  console.log('\n=== ② 填写部门的「点击选择」框不得超出信息表 ===')
  const dept = (info.rows || []).find((r) => r.label === '填写部门')
  ok(!!dept && dept.hasRefCtl, '填写部门是参照格(有「点击选择」框)')
  ok(info.overflowTablePx !== null, '量到了参照框与信息表的边界')
  ok(info.overflowTablePx !== null && info.overflowTablePx <= 0,
    `参照框右边界未越过信息表(overflowTablePx=${info.overflowTablePx},应 ≤ 0)`)
  ok(info.ctl !== null && info.ctl.width > 0 && info.ctl.width <= info.table.width * 0.75,
    `参照框宽度受格子约束(${info.ctl?.width}px / 信息表 ${info.table?.width}px)`)
  ok(info.overflowSheetPx !== null && info.overflowSheetPx <= 0,
    `纸上也没顶出去(overflowSheetPx=${info.overflowSheetPx})`)

  // 截图:整块右上信息表(带上下文;红框位置就是用户截图圈的地方)
  await shoot(info, path.join(__dirname, 'qc-bhg-new-doc.png'))

  // 后端建单预填核对:库内该单「填写人」也应有值
  if (createdNo) {
    const row = (await listRows()).find((x) => noOf(x) === createdNo)
    console.log(`\n  库内该单「填写人」= ${JSON.stringify(row?.['填写人'] ?? null)}`)
    ok(String(row?.['填写人'] ?? '') === who, '后端建单时也已按创建人预填进库(不只是前端显示)')
  }
} finally {
  cdp.close()
  try { edge.kill() } catch { /* ignore */ }

  // ── 收尾:作废本次新增的草稿(不留脏数据) ──────────────────────────────────
  if (createdNo) {
    try {
      const del = await post('/px/callButton', { panelCode: 'QC_BHG', buttonName: '删除', formData: { 编号: createdNo }, buttonParam: {} })
      console.log(`  收尾:作废本次新增 ${createdNo} → code=${del?.code}`)
    } catch (e) { console.log(`  [WARN] 收尾作废失败 ${createdNo}: ${e.message}`) }
  }
  console.log(fails === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${fails} 项)`)
  process.exit(fails === 0 ? 0 : 1)
}
