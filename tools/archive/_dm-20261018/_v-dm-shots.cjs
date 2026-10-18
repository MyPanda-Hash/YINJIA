/* 一次性探针(2026-10-18):把「数据建模」两个面板真在页面上打开并截图,确认不是只有接口通。
 *   · 字段管理 FIELDMGR:列头应为 面板编码/面板名称/字段名/承载列/类型/位置/顺序…,且有一屏数据;
 *   · ERP导入日志 ERPLG :批次表里有 9 个 IMP- 批次(金蝶同步)。
 * 用法:node tools/archive/_dm-20261018/_v-dm-shots.cjs [前端地址,默认 5173]
 * 产物:同目录 _shot-fieldmgr.png / _shot-erplg.png
 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9387
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://127.0.0.1:8090/api'
const APP = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:5173').replace(/\/$/, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dm-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1000',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (mm, p = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method: mm, params: p })) })
    const raw = async (x) => (await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value
    const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 80; i++) { await sleep(300); if (await raw('document.readyState') === 'complete') { await sleep(2000); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${APP}/#/login`); await sleep(1500)
    await raw(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')
    // 先落到 dashboard(应用装好、pinia 有登录态),再用 hash 跳面板 —— 直接首开深链会白屏
    await nav(`${APP}/#/dashboard`)
    await sleep(4000)

    for (const [code, file] of [['FIELDMGR', '_shot-fieldmgr.png'], ['ERPLG', '_shot-erplg.png']]) {
      await raw(`location.hash = '#/panelx/list/${code}'; 'ok'`)
      await sleep(9000)
      const text = await raw(`document.body.innerText.replace(/\\s+/g,' ')`)
      const heads = await raw(`[...document.querySelectorAll('.el-table__header th .cell')].map(e=>e.innerText.trim()).filter(Boolean).slice(0,14)`)
      const rows = await raw(`document.querySelectorAll('.el-table__body tr.el-table__row').length`)
      // 工具栏按钮(2026-10-18 起 ERP集成只读):只读面板应当只剩 查询/刷新/导出/打印 这类
      const toolbar = await raw(`[...document.querySelectorAll('.el-button, .tool-btn, button')].map(e=>e.innerText.trim()).filter(Boolean).slice(0,20)`)
      console.log(`[${code}] 工具栏按钮: ${JSON.stringify(toolbar)}`)
      console.log(`[${code}] 列头: ${JSON.stringify(heads)}`)
      console.log(`[${code}] 渲染行数: ${rows}`)
      console.log(`[${code}] 文本片段: ${String(text).slice(0, 260)}`)
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(path.join(__dirname, file), Buffer.from(shot.result.data, 'base64'))
      console.log(`[${code}] 截图 → ${file}\n`)
    }
  } finally { edge.kill() }
}
main().catch((e) => { console.error('异常:', e); process.exitCode = 1 })
