/*
 * _ui-tcin-attach.cjs —— 特采单附件入口位置核对(2026-10-19 第二轮用户口径:
 *   「特采单的上传附件的链接放在右边会影响单据的陈列,放在上面吧」)
 *
 * 断言:
 *   ① 纸面上**没有**右侧备注列(.as-remark);
 *   ② 附件条 .as-attach-top 在标题行(**上方**),且在表格 .as-table 之前;
 *   ③ 「上传附件」入口在附件条内(不是右侧列里);
 *   ④ 表格宽度 = 纸面整宽(不再被 250px 备注列压窄)。
 *
 * 用法: node tools/archive/_1019-verify/_ui-tcin-attach.cjs
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9355
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const FE = process.env.YJ_FE || 'http://localhost:5173'   // 可指到 8090 验证"部署包那一版"
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
  const user = login.data.user
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-attach-'))
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
    const navigate = async (url, wait = 3800) => {
      await send('Page.navigate', { url })
      for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') break }
      await sleep(wait)
    }
    await send('Page.enable'); await send('Runtime.enable')
    // 固定视口:headless 默认 800x600 会把纸面压到 100px 宽(量出来的宽度全是错的),必须先定死
    await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1200, deviceScaleFactor: 1, mobile: false })

    await navigate(`${FE}/#/login`, 800)
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)});
                    localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(user))}); 'ok'`)
    await navigate('about:blank', 300)
    await navigate(`${FE}/#/panelx/list/QC_TC_IN?docNo=TCI-2026-09-0024`, 4600)

    console.log('\n特采单(YJ-QR-60)附件入口位置 —— 2026-10-19 用户口径「放在上面」\n')
    const info = await evaluate(`(() => {
      // keep-alive 会同时挂着多个面板的纸面 ⇒ 只认**可见**的那一个(宽度 > 200)
      const vis = (sel) => [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width > 200)[0]
      const sheet = vis('.approval-sheet')
      const strip = sheet ? sheet.querySelector('.as-attach-top') : null
      const remark = sheet ? sheet.querySelector('.as-remark') : null
      const table = sheet ? sheet.querySelector('.as-table') : null
      const btn = sheet ? [...sheet.querySelectorAll('*')].find(e => !e.children.length && /上传附件/.test(e.textContent || '')) : null
      const rect = el => el ? el.getBoundingClientRect() : null
      const s = rect(strip), t = rect(table), sh = rect(sheet)
      return {
        hasSheet: !!sheet,
        hasStrip: !!strip,
        stripText: strip ? (strip.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80) : '',
        hasRemarkCol: !!remark,
        hasBtn: !!btn,
        btnInStrip: !!(btn && strip && strip.contains(btn)),
        stripTop: s ? Math.round(s.top) : null,
        tableTop: t ? Math.round(t.top) : null,
        tableWidth: t ? Math.round(t.width) : null,
        sheetWidth: sh ? Math.round(sh.width) : null,
      }
    })()`)
    ok(info.hasSheet, '纸面渲染出来了')
    ok(!info.hasRemarkCol, '右侧备注列已不再占用纸面(没有 .as-remark)')
    ok(info.hasStrip, '出现了顶部「附件」条 .as-attach-top', info.stripText)
    ok(info.hasStrip && info.tableTop !== null && info.stripTop < info.tableTop,
      '附件条在表格**上方**', `strip.top=${info.stripTop} < table.top=${info.tableTop}`)
    ok(info.btnInStrip, '「上传附件」入口在顶部附件条里(不在右侧列)')
    ok(info.tableWidth && info.sheetWidth && info.tableWidth >= info.sheetWidth - 40,
      '表格恢复纸面整宽(不再被 250px 列压窄)', `table=${info.tableWidth} / sheet=${info.sheetWidth}`)

    // 回归:立项申请表(RD_APPROVAL)有真正的「备注」列 ⇒ 附件仍应留在右侧备注列里,不能被这次改动带走
    await navigate(`${FE}/#/panelx/list/RD_APPROVAL`, 4600)
    const rd = await evaluate(`(() => {
      const sheet = [...document.querySelectorAll('.approval-sheet')].find(e => e.getBoundingClientRect().width > 200)
      const remark = sheet ? sheet.querySelector('.as-remark') : null
      return {
        hasSheet: !!sheet,
        hasRemark: !!remark,
        remarkText: remark ? (remark.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 60) : '',
        hasTopStrip: !!(sheet && sheet.querySelector('.as-attach-top')),
      }
    })()`)
    ok(rd.hasSheet, '立项申请表纸面渲染出来了')
    ok(rd.hasRemark, '立项申请表仍有右侧「备注」列(未受影响)', rd.remarkText)
    ok(!rd.hasTopStrip, '立项申请表没有多出顶部附件条(只有无备注列的文书才走那条)', `topStrip=${rd.hasTopStrip}`)

    console.log(`\n结果: PASS ${pass} · FAIL ${fail}`)
  } finally {
    try { edge.kill() } catch {}
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error('[探针异常]', e); process.exit(2) })
