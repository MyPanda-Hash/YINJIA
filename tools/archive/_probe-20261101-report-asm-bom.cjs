/**
 * _probe-20261101-report-asm-bom.cjs —— 工序报工「组装物料」界面取证(2026-11-01)
 *
 * 用户口径:「只有组装工序有 BOM;只有当前工序为组装的时候,我在这个工序报工这里能看到
 * 当前对应的组装 BOM 就行,其它工序的 BOM 和这个无关」。
 * 本探针:工序报工页(PROD_REPORT)→ 输工单 GD-2026-10-0226-1 → 查询 → 校验
 *   ① 默认选中「组装」时显示组装物料(BOM编号/版本 + 子件行 + 本次需求);
 *   ② 切到「成型」时该块消失(只有组装才有 BOM);截图。
 */
async function main() {
  const { spawn } = require('node:child_process')
  const fs = require('node:fs')
  const path = require('node:path')
  const WebSocket = require('ws')
  const BASE = 'http://127.0.0.1:8090'
  const PORT = 9378
  const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  const OUT = path.join('D:/workspace/yinjia/tools/archive', '_report-asm-bom.png')
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const profileDir = path.join('D:/workspace/yinjia/.tmp', 'yj-report-bom-' + Date.now())
  fs.mkdirSync(profileDir, { recursive: true })
  const edge = spawn(EDGE, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run',
    '--disable-crash-reporter', '--window-size=1500,1000',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' })
  try {
    let tab = null
    for (let i = 0; i < 40; i++) {
      try {
        tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
        if (tab?.webSocketDebuggerUrl) break
      } catch { /* port not ready */ }
      await sleep(500)
    }
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0
    const pending = new Map()
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } }
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const shot = async (file) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(r.result.data, 'base64')) }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(300); if (await ev('document.readyState') === 'complete') { await sleep(1500); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(BASE + '/#/login')
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); localStorage.setItem('mes_locale','zh'); 'ok'`)
    await nav('about:blank')
    await nav(BASE + '/#/panelx/list/PROD_REPORT')
    await sleep(4000)

    // 输入工单号并查询
    const typed = await ev(`(() => {
      const inp = document.querySelector('.mp-row input')
      if (!inp) return 'no-input'
      inp.value = 'GD-2026-10-0226-1'
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      return 'typed'
    })()`)
    console.log('[1] 输入工单 =', typed)
    await sleep(500)
    const clicked = await ev(`(() => {
      const btn = [...document.querySelectorAll('.mp-row button')].find((b) => b.textContent.trim() === '查询')
      if (!btn) return 'no-query-btn'
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return 'clicked'
    })()`)
    console.log('[2] 点查询 =', clicked)
    await sleep(4000)

    const state = await ev(`(() => {
      const title = document.querySelector('.mp-bom-title')
      const doc = document.querySelector('.mp-bom-doc')
      const rows = [...document.querySelectorAll('.mp-bom-tbl tbody tr')]
      const first = rows[0] ? [...rows[0].querySelectorAll('td')].map((td) => td.innerText.trim()) : []
      const qtyInp = document.querySelector('.mp-qty input')
      return {
        title: title ? title.textContent.trim() : '',
        doc: doc ? doc.textContent.trim() : '',
        rows: rows.length,
        firstRow: first,
        qty: qtyInp ? qtyInp.value : '',
        pickedOp: [...document.querySelectorAll('.mp-op')].filter((e) => e.classList.contains('is-active')).map((e) => e.innerText.split('\\n')[0].trim()),
      }
    })()`)
    console.log('[3] 组装物料块 =', JSON.stringify(state))
    await shot(OUT)
    console.log('[4] 截图 =', OUT)

    // 切到「成型」工序:组装物料块应消失(只有组装有 BOM)
    const switched = await ev(`(() => {
      const op = [...document.querySelectorAll('.mp-op')].find((e) => e.innerText.split('\\n')[0].trim() === '成型')
      if (!op) return 'no-成型-op'
      op.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return 'clicked-成型'
    })()`)
    await sleep(800)
    const after = await ev(`({ bomVisible: !!document.querySelector('.mp-bom'), activeOps: [...document.querySelectorAll('.mp-op')].filter((e) => e.classList.contains('is-active')).map((e) => e.innerText.split('\\n')[0].trim()) })`)
    console.log('[5] 切到成型 =', switched, '| 组装物料块 =', JSON.stringify(after))

    const pass = state.title === '组装物料' && state.rows > 0 && state.firstRow.length >= 4
      && String(state.qty) !== '' && !after.bomVisible
    console.log('RESULT:', pass ? 'PASS' : 'FAIL')
    ws.close()
  } finally {
    edge.kill()
    try { fs.rmSync(profileDir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
}
main().catch((e) => { console.error('FAIL:', e.message); process.exit(1) })
