/*
 * _probe-first-insp-picker-ui.mjs — 首件检验单「选生产工单」界面验收(2026-10-20)
 *
 * 用户口径:「首件检验单需要关联当前的生产工单即可,不需要实现成型报工完成流程才产生。就是当前检验单
 *   能选取工单,未完工的工单就可以选取,但是已经完成的就不需要能被选取,已经被当前的检验单选取的也不能
 *   被再次选取。」
 *
 * 验什么(界面,跑在**测试账套**;全程新建的单跑完删掉):
 *   ① 弹窗提示语改成「未完工」口径,门槛提示写明「已完工/已结案/已有首件单不再列出」;
 *   ② 列头里**没有**成型完工量/成型计划量/可开单/已建单号(首件不再判成型报工),有「完工状态」;
 *   ③ 列出的行数 = 测试账套里「未完工 + 未被占用」的行数,且每行都不置灰;
 *   ④ 选中一行点确定 ⇒ 建出首件检验单(表头绑工单号+工单行号、明细按工艺清单预铺),该行随即从列表消失。
 *
 * 用法: node tools/archive/_first-insp-open-20261020/_probe-first-insp-picker-ui.mjs [base]
 *       base 默认 http://localhost:5173 (vite 源码即时生效;它把 /api 代理到 8090)
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'

const BASE = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '')
const LOCALE = process.argv[3] || 'zh-CN'
const FACTORY = 'YJ_TEST'
const DB = 'HSDZ_MES_TEST'
const PORT = 9496
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const mssql = createRequire('D:/workspace/yinjia/deploy/package.json')('mssql')
const pool = await new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}).connect()
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

// 库里「应可选」行数(与后端同一口径,独立写一遍)
const expRows = await q(`
  SELECT p.pl_no AS wo, p.pl_xc AS xc FROM dbo.plang p
  WHERE ISNULL(p.asp_cancel,'N')<>'Y'
    AND NOT (ISNULL(p.ja,'N') IN (N'T',N'Y')
             AND ((ISNULL(p.pl_sl,0)>0 AND ISNULL(p.rk_sl,0)>=ISNULL(p.pl_sl,0)) OR p.pl_no LIKE N'GD2608%'))
    AND NOT (ISNULL(p.[完工状态],N'') IN (N'生产完工', N'已完工'))
    AND NOT EXISTS (SELECT 1 FROM dbo.qc_first_insp_head h
                    WHERE h.[工单号]=p.pl_no AND h.[工单行号]=p.pl_xc AND ISNULL(h.asp_cancel,'N')<>'Y')`)

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-fio-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1700,1100', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
let created = ''
let ws = null
try {
  ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pend = new Map(); const errs = []
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
    if (m.method === 'Runtime.exceptionThrown') errs.push(String(m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
  }
  const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pend.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
  const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value

  await send('Page.enable'); await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1700, height: 1100, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});
    localStorage.setItem('mes_locale', ${JSON.stringify(LOCALE)}); localStorage.setItem('mes_init_done','1'); 'ok'`)
  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_FIRST_INSP` })
  for (let i = 0; i < 80; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-list')`)) break }
  await sleep(3000)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()}
    const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(800)

  // ① 打开弹窗
  const actions = (await ev(`[...document.querySelectorAll('.approval-side [class*=as-side], .approval-side button')]
    .map((e) => (e.innerText || '').trim()).filter(Boolean)`)) || []
  console.log(`  工具栏=${JSON.stringify(actions)}`)
  const opened = await ev(`(() => {
    const el = [...document.querySelectorAll('button, .as-side-btn, [class*=as-side] span, .el-button')]
      .find((e) => ['选生产工单', 'Pick production work order', 'Select work order'].includes((e.innerText || '').trim()))
    if (!el) return false
    el.click(); return true
  })()`)
  await sleep(2500)
  const tip = String(await ev(`document.querySelector('.wopick-tip')?.innerText || ''`))
  const hint = String(await ev(`document.querySelector('.wopick-gate')?.innerText || ''`))
  console.log(`  提示=${JSON.stringify(tip)}`)
  console.log(`  门槛=${JSON.stringify(hint)}`)
  ok('① 弹窗打开', opened === true)
  ok(`① 提示语是首件检验单 + 未完工(${LOCALE})`, LOCALE === 'zh-CN' ? (/首件检验单/.test(tip) && /未完工/.test(tip)) : !/[一-龥]/.test(tip), tip)
  ok(`① 门槛提示已翻译(${LOCALE})`, LOCALE === 'zh-CN' ? (/未完工/.test(hint) && /已完工/.test(hint) && /首件检验单/.test(hint)) : !/[一-龥]/.test(hint), hint)

  // ② 列头
  const heads = (await ev(`[...document.querySelectorAll('.el-dialog .el-table__header th')]
    .map((th) => (th.innerText || '').trim()).filter(Boolean)`)) || []
  console.log(`  列头=${JSON.stringify(heads)}`)
  ok('② 没有「成型完工量/成型计划量/可开单/已建单号」',
    !heads.includes('成型完工量') && !heads.includes('成型计划量') && !heads.includes('可开单') && !heads.includes('已建单号'),
    JSON.stringify(heads))
  ok(`② 有「完工状态」列(${LOCALE})`, LOCALE === 'zh-CN' ? heads.includes('完工状态') : heads.some((h) => !/[一-龥]/.test(h) && /status|state|完成/i.test(h)), JSON.stringify(heads))

  // ③ 行数与内容
  const rows = Number(await ev(`document.querySelectorAll('.el-dialog .el-table__body tbody tr').length`))
  console.log(`  弹窗行数=${rows} / 库里应可选=${expRows.length}`)
  ok('③ 行数 = 库里「未完工 + 未被占用」', rows === expRows.length, `界面 ${rows} / 库 ${expRows.length}`)
  const greyRows = Number(await ev(`document.querySelectorAll('.el-dialog .el-table__body tbody tr.wopick-blocked').length`))
  ok('③ 没有置灰行(每行都可选)', greyRows === 0, `置灰 ${greyRows} 行`)
  const statusTags = (await ev(`[...document.querySelectorAll('.el-dialog .el-table__body tbody tr')]
    .map((tr) => [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').trim()))`)) || []
  ok('③ 每行的「完工状态」不是已完工/已结案',
    statusTags.every((cells) => !cells.includes('生产完工') && !cells.includes('已完工')), JSON.stringify(statusTags).slice(0, 300))

  // ④ 选中第一行 → 建单
  const first = String(await ev(`(document.querySelector('.el-dialog .el-table__body tbody tr td')?.innerText || '').trim()`))
  await ev(`(() => { const tr=document.querySelector('.el-dialog .el-table__body tbody tr'); if(tr) tr.click(); return 'ok' })()`)
  await sleep(700)
  const okText = `['确定','OK','Confirm']`
  const confirmDisabled = await ev(`(() => { const b=[...document.querySelectorAll('.el-dialog__footer button')].find((x)=>${okText}.includes((x.innerText||'').trim())); return b ? b.disabled : null })()`)
  ok('④ 选中行后「确定」可用', confirmDisabled === false, String(confirmDisabled))
  await ev(`(() => { const b=[...document.querySelectorAll('.el-dialog__footer button')].find((x)=>${okText}.includes((x.innerText||'').trim())); if(b) b.click(); return 'ok' })()`)
  await sleep(3200)
  const msg = String(await ev(`[...document.querySelectorAll('.el-message')].map((m) => (m.innerText || '').trim()).join(' | ')`))
  console.log(`  建单提示=${JSON.stringify(msg.slice(0, 140))}`)
  ok(`④ 选中工单行 ⇒ 建出首件检验单(${LOCALE})`,
    (LOCALE === 'zh-CN' ? /首件检验单/.test(msg) : /first-article/i.test(msg)) && /SJ-/.test(msg), msg.slice(0, 140))
  created = (msg.match(/SJ-[0-9A-Za-z-]+/) || [''])[0]
  if (created) {
    const h = (await q(`SELECT ISNULL([工单号],'') wo, ISNULL([工单行号],0) xc,
        ISNULL([产品编码],'') dm FROM dbo.qc_first_insp_head WHERE [单据编号]=N'${created}'`))[0] || {}
    ok('④ 新单绑了 工单号 + 工单行号', String(h.wo).trim() !== '' && Number(h.xc) > 0, JSON.stringify(h))
    const n = (await q(`SELECT COUNT(*) n FROM dbo.qc_first_insp_detail WHERE [单据编号]=N'${created}'`))[0]?.n
    ok('④ 新单明细按成型工艺清单预铺(>0 行)', Number(n) > 0, `明细 ${n} 行`)
  } else {
    ok('④ 能从提示里取到新单号(便于清场)', false, msg.slice(0, 140))
  }
  // ⑥ 制程检验单回归:同一个弹窗、原样的门禁列与话术(2026-10-20 只动首件,制程一个字节不该变)
  //    只在 zh-CN 跑 —— 断言的列头是中文源键,切 en 后 tt() 会翻成英文,比不了。
  if (LOCALE === 'zh-CN') {
  await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/QC_PROC_INSP` })
  for (let i = 0; i < 80; i++) { await sleep(500); if (await ev(`!!document.querySelector('.panelx-list')`)) break }
  await sleep(2500)
  await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()}
    const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
  await sleep(600)
  const procOpened = await ev(`(() => {
    const el = [...document.querySelectorAll('button, .as-side-btn, [class*=as-side] span, .el-button')]
      .find((e) => ['选生产工单', 'Pick production work order', 'Select work order'].includes((e.innerText || '').trim()))
    if (!el) return false
    el.click(); return true
  })()`)
  await sleep(2500)
  const procHeads = (await ev(`[...document.querySelectorAll('.el-dialog .el-table__header th')]
    .map((th) => (th.innerText || '').trim()).filter(Boolean)`)) || []
  console.log(`  制程列头=${JSON.stringify(procHeads)}`)
  ok('⑥ 制程弹窗仍能打开', procOpened === true)
  ok('⑥ 制程列头仍有「成型完工量/成型计划量/可开单/已建单号」',
    ['成型完工量', '成型计划量', '可开单', '已建单号'].every((h) => procHeads.includes(h)), JSON.stringify(procHeads))
  ok('⑥ 制程列头**没有**「完工状态」(那是首件独有的新列)', !procHeads.includes('完工状态'), JSON.stringify(procHeads))
  }

  ok('⑤ 无未捕获的运行时异常', errs.length === 0, errs.join(' | '))
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
  if (created) {
    await q(`DELETE FROM dbo.qc_first_insp_detail WHERE [单据编号]=N'${created}';
             DELETE FROM dbo.qc_first_insp_head WHERE [单据编号]=N'${created}'`)
    console.log(`  清场:删掉探针建的 ${created}`)
  }
  await pool.close()
}
console.log(`\n== 首件检验单「选生产工单」界面:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
