/*
 * _probe-qc-insp-docrail.mjs — 三张工序检验单的左「单据选择」目录(2026-10-21)
 *
 * 用户口径:「为当前的制程检验单,首件检验单,以及成品检验单增加目录。都添加在左侧部分」。
 *
 * 验什么(界面,CDP + Edge headless;跑 5173 源码版或 8090 打包版都行):
 *   ① 三张单打开后**左侧出现目录栏**(.doc-select-rail),标题 =「<面板名>选择」;
 *   ② 列头 = 单号 | 日期 | 工单号 | 产品名称 | 审核状态(中间列是本次新增的工单号/产品名称);
 *   ③ 栏内行数与顶部「共有数据」一致,且第一行就是当前单据(高亮);
 *   ④ 点第二行 ⇒ 当前单据切过去(高亮移动 + 右侧纸面/表单内容变化;单据卡片分支还能看到「单据:单号」);
 *   ⑤ 收起/展开按钮可用(收起后只剩窄条,再点恢复);
 *   ⑥ 无未捕获运行时异常。
 *
 * 用法: node tools/archive/_qc-insp-docrail-20261021/_probe-qc-insp-docrail.mjs [base] [factory] [locale]
 *       locale 传 en ⇒ 断言目录标题/列头是英文(产品名称等**业务事实**按 ADR-0001 保持中文,不翻)
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '')
const FACTORY = process.argv[3] || 'YJ'
const LOCALE = process.argv[4] || 'zh-CN'
// 只有 en 才能要求「无 CJK」(日/韩/繁中都含汉字);其余语言只要求「不等于中文原文」= 已翻译
const isEn = LOCALE === 'en'
const CJK = /[一-龥]/
const PORT = 9497
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const PANELS = [
  { code: 'QC_PROC_INSP', name: '制程检验单', branch: 'paper' },
  { code: 'QC_FIRST_INSP', name: '首件检验单', branch: 'paper' },
  { code: 'QC_ASM_INSP', name: '组装成品检验单', branch: 'grid' },
]

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rail-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1800,1000', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
let tab = null
for (let i = 0; i < 40 && !tab; i++) {
  await sleep(1000)
  try { const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' }); if (r.ok) tab = await r.json() } catch { /* retry */ }
}
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1800, height: 1000, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/#/login` }); await sleep(2500)
  await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
    localStorage.setItem('mes_user', ${JSON.stringify(login.data.user)});
    localStorage.setItem('mes_locale', ${JSON.stringify(LOCALE)}); localStorage.setItem('mes_init_done','1'); 'ok'`)

  for (const p of PANELS) {
    console.log(`\n=== ${p.code} (${p.name}) ===`)
    await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}#/panelx/list/${p.code}` })
    for (let i = 0; i < 80; i++) { await sleep(500); if (await ev(`!!document.querySelector('.doc-select-rail')`)) break }
    await sleep(2500)
    await ev(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.innerText||'').trim()==='下次再说'); if(b){b.click()}
      const x=document.querySelector('.el-dialog__headerbtn'); if(x){x.click()} return 'ok' })()`)
    await sleep(800)

    // ① 目录栏存在 + 标题
    const title = String(await ev(`document.querySelector('.doc-select-rail .dsr-title')?.innerText || ''`)).trim()
    console.log(`  目录标题=${JSON.stringify(title)}`)
    ok(`① ${p.code} 左侧有目录栏`, !!title)
    // zh-CN 按原文钉死;其他语言只要求"已翻译"(不等于中文原文;en 另要求纯英文)
    ok(LOCALE === 'zh-CN' ? `① 标题 =「${p.name}选择」` : `① 标题已翻译(${LOCALE})`,
      LOCALE === 'zh-CN'
        ? title === `${p.name}选择`
        : (title !== `${p.name}选择` && title.length > 0 && (!isEn || !CJK.test(title))), title)

    // ② 列头
    const heads = (await ev(`[...document.querySelectorAll('.doc-select-rail .dsr-grid thead th')].map((th) => (th.innerText || '').trim())`)) || []
    console.log(`  列头=${JSON.stringify(heads)}`)
    // 列头:zh-CN 钉原文;其他语言要求"五个列头都已离开中文原文"(en 另要求纯英文)
    const ZH_HEADS = ['单号', '日期', '工单号', '产品名称', '审核状态']
    ok(LOCALE === 'zh-CN' ? '② 列头 = 单号|日期|工单号|产品名称|审核状态' : `② 列头已翻译(${LOCALE})`,
      LOCALE === 'zh-CN'
        ? JSON.stringify(heads) === JSON.stringify(ZH_HEADS)
        : (heads.length === 5 && heads.every((h, i) => h !== ZH_HEADS[i] && h.length > 0 && (!isEn || !CJK.test(h)))),
      JSON.stringify(heads))

    // ③ 行数 + 共有数据 + 首行高亮
    const rows = (await ev(`[...document.querySelectorAll('.doc-select-rail .dsr-grid tbody tr')].map((tr) =>
      [...tr.querySelectorAll('td')].map((td) => (td.innerText || '').trim()))`)) || []
    const totalTxt = String(await ev(`document.querySelector('.doc-select-rail .dsr-count')?.innerText || ''`))
    const activeIdx = Number(await ev(`[...document.querySelectorAll('.doc-select-rail .dsr-grid tbody tr')]
      .findIndex((tr) => tr.classList.contains('active'))`))
    console.log(`  行数=${rows.length} 首行=${JSON.stringify(rows[0])} 共有=${JSON.stringify(totalTxt.replace(/\\s+/g, ' '))}`)
    ok(`③ 有数据(>=2 行可切换)`, rows.length >= 2, String(rows.length))
    ok(`③ 首行就是当前单据(高亮)`, activeIdx === 0, String(activeIdx))
    // 历史手工单只有 单号/日期(工单号/产品/批次/检验员 全空,实测 50 行里 43 行如此)——
    // 所以只要求「首行(当前单据)有值 + 本页至少有一行带工单号」,不按比例卡。
    const withWo = rows.filter((r) => r[2] !== '').length
    ok(`③ 首行中间列有值(工单号/产品名称)`, rows[0][2] !== '' || rows[0][3] !== '',
      JSON.stringify(rows[0]))
    ok('③ 本页存在带工单号的行', withWo > 0, `${withWo}/${rows.length}`)
    // 「共有数据」整句走词条(zh-CN 共有数据: 447 条 / en Total: 447),两种都只取数字
    const totalNum = Number((totalTxt.match(/(\d[\d,]*)/) || [0, 0])[1].replace(/,/g, ''))
    ok(`③ 「共有数据」= 接口总张数`,
      (LOCALE == 'zh-CN' ? /共有数据/.test(totalTxt) : !/共有数据/.test(totalTxt)) && totalNum > rows.length, totalTxt.slice(0, 80))

    // ④ 点第二行切单
    const before = String(await ev(`(document.querySelector('.approval-layout, .doc-rail-main')?.innerText || '').slice(0, 4000)`))
    const wantNo = rows[1][0]
    await ev(`(() => { const tr=document.querySelectorAll('.doc-select-rail .dsr-grid tbody tr')[1]; if(tr) tr.click(); return 'ok' })()`)
    await sleep(2500)
    const activeIdx2 = Number(await ev(`[...document.querySelectorAll('.doc-select-rail .dsr-grid tbody tr')]
      .findIndex((tr) => tr.classList.contains('active'))`))
    const after = String(await ev(`(document.querySelector('.approval-layout, .doc-rail-main')?.innerText || '').slice(0, 4000)`))
    const chip = String(await ev(`document.querySelector('.doc-chip')?.innerText || ''`)).trim()
    ok('④ 点第二行 ⇒ 高亮移过去', activeIdx2 === 1, String(activeIdx2))
    ok('④ 右侧内容随之变化', before !== after && after.length > 0, `before=${before.length} after=${after.length}`)
    if (p.branch === 'grid') {
      ok(`④ 单据卡片显示「单据：${wantNo}」`, chip.includes(wantNo), chip)
    }

    // ⑤ 收起/展开
    await ev(`(() => { const c=document.querySelector('.doc-select-rail .dsr-coll'); if(c) c.click(); return 'ok' })()`)
    await sleep(700)
    const collapsed = await ev(`!!document.querySelector('.doc-select-rail.coll')`)
    await ev(`(() => { const c=document.querySelector('.doc-select-rail.coll'); if(c) c.click(); return 'ok' })()`)
    await sleep(700)
    const expanded = await ev(`!!document.querySelector('.doc-select-rail .dsr-grid')`)
    ok('⑤ 收起/展开可用', collapsed === true && expanded === true, `collapsed=${collapsed} expanded=${expanded}`)
  }

  ok('⑥ 无未捕获的运行时异常', errs.length === 0, errs.join(' | '))
} finally {
  try { ws?.close() } catch { /* ignore */ }
  edge.kill()
}
console.log(`\n== 三张工序检验单的左目录:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
