/**
 * 取证:立项申请(RD_APPROVAL)与产品信息表(RD_PROD_INFO)侧栏按钮**实际各有哪些**。
 *
 * 背景(2026-10-16 用户报障):「立项申请流程的按钮和产品文件的流程的按钮有点混乱了,
 *   立项申请是没有定级、对接人和分发责任人的,这个是产品文件里面的产品信息表的流程」。
 * 本探针只做**只读取证**:把两张单侧栏按钮的文本/置灰/分节标题原样打出来,再决定改哪边。
 *
 * 用法:node side-buttons.cjs [URL]      # 默认 http://127.0.0.1:5173/
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const URL_ = (process.argv[2] || 'http://127.0.0.1:5173/').replace(/\/$/, '')
const PORT = 9402
const PANELS = (process.argv[3] || 'RD_APPROVAL,RD_PROD_INFO').split(',')
const EDGE = ['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const DUMP = `JSON.stringify((() => {
  const txt = (el) => (el.textContent || '').replace(/\\s+/g, ' ').trim()
  const side = document.querySelector('.approval-side')
  const seq = []
  if (side) for (const el of side.querySelectorAll('.as-side-btn, .as-side-section, .as-side-title')) {
    seq.push((el.className.includes('as-side-section') ? '## ' : el.className.includes('as-side-title') ? '#title ' : '')
      + txt(el) + (el.className.includes('disabled') ? ' [灰]' : ''))
  }
  return {
    panels: (document.querySelector('.as-side .doc-status') || {}).textContent || '',
    no: (document.querySelector('.as-side-pager .page-no') || {}).textContent || '',
    hasSide: !!side,
    sideButtons: seq,
    tools: [...document.querySelectorAll('.tools .el-button, .tools button')].map(txt).slice(0, 30),
    tabs: [...document.querySelectorAll('.portal-tabs .tab, .tabs .tab')].map(txt).slice(0, 6),
  }
})())`

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-'))
  const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--window-size=1600,1000', 'about:blank'], { stdio: 'ignore' })
  try {
    let target = null
    for (let i = 0; i < 40 && !target; i++) {
      await sleep(300)
      try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((t) => t.type === 'page') } catch {}
    }
    const ws = new WebSocket(target.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let id = 0; const pend = new Map()
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
    const send = (method, params) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
    const ev = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable')

    const lr = await fetch(URL_ + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
    })
    const lj = await lr.json()
    console.log('[登录]', lr.status, 'code=' + lj?.code)
    if (!lj?.data?.token) throw new Error('登录失败: ' + JSON.stringify(lj).slice(0, 160))

    await send('Page.navigate', { url: URL_ + '/#/login' }); await sleep(2500)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(lj.data.token)});
localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(lj.data.user || {}))});
localStorage.setItem('mes_login_date','2026-10-16'); 'ok'`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(400)

    for (const p of PANELS) {
      await send('Page.navigate', { url: URL_ + '/#/panelx/list/' + p.trim() }); await sleep(9000)
      const r = JSON.parse(await ev(DUMP))
      console.log(`\n═══════ ${p.trim()} ═══════`)
      console.log('单据:', r.panels, r.no, '| 有侧栏:', r.hasSide)
      console.log('侧栏按钮:')
      for (const b of r.sideButtons) console.log('   ', b)
      console.log('工具栏:', r.tools.join(' | '))
    }
  } finally {
    edge.kill()
    await sleep(300)
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('探针异常:', e); process.exit(2) })
