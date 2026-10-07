/* _v3-matout-detail.cjs — 明细两列的最后核实:
   ③ 首行「计量单位」点开 → 候选应来自单位档案(个/支/张/PCS/件/kg/套…),不再是硬编码 4 项
   ④ 首行「材料编码」点开 → 应是商品档案参照弹窗(并检查表头「明细」页签下控件形态)
   全程只点不保存(草稿单据,客户端动作不落库)
*/
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9359
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:8090'
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-v3-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let ready = false
  for (let i = 0; i < 40 && !ready; i++) { await sleep(500); try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) ready = true } catch {} }
  if (!ready) throw new Error('Edge 未就绪')
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable')
    const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(900); return } } }
    await nav(BASE + '/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(BASE + '/#/panelx/list/MATERIAL_OUT')
    await sleep(6500)

    // 明细表格结构:哪张表含「计量单位」表头、首行该列单元格里是什么控件
    const cells = await evaluate(`(() => {
      const clean = s => (s||'').replace(/\\s+/g,' ').trim()
      const tables = [...document.querySelectorAll('table')]
      const out = []
      for (const t of tables) {
        const heads = [...t.querySelectorAll('thead th')].map(th => clean(th.innerText))
        const iu = heads.indexOf('计量单位'), ic = heads.indexOf('材料编码')
        if (iu < 0 && ic < 0) continue
        const rows = [...t.querySelectorAll('tbody tr')]
        const pick = (r, i) => {
          if (!r || i < 0) return null
          const c = r.children[i]; if (!c) return null
          const inp = c.querySelector('input')
          return { tag: c.tagName, cls: (c.className||'').toString().slice(0,50),
                   控件: c.querySelector('.el-select') ? 'el-select' : (c.querySelector('[class*=ref]') ? 'ref' : (inp ? 'input' : '文本')),
                   只读: inp ? !!inp.readOnly : null, html: c.innerHTML.replace(/\\s+/g,' ').slice(0, 180) }
        }
        out.push({ 列数: heads.length, 行数: rows.length, 计量单位列: iu, 材料编码列: ic,
                   首行计量单位: pick(rows[0], iu), 首行材料编码: pick(rows[0], ic) })
      }
      return out
    })()`)
    console.log('=== 明细表格结构 ===')
    console.log(JSON.stringify(cells, null, 1).slice(0, 2000))

    // 点开首行「计量单位」单元格控件 → 读候选
    const unitProbe = await evaluate(`(async () => {
      const clean = s => (s||'').replace(/\\s+/g,' ').trim()
      const t = [...document.querySelectorAll('table')].find(t => [...t.querySelectorAll('thead th')].some(th => clean(th.innerText) === '计量单位'))
      if (!t) return 'NO-TABLE'
      const heads = [...t.querySelectorAll('thead th')].map(th => clean(th.innerText))
      const i = heads.indexOf('计量单位')
      const row = t.querySelector('tbody tr'); if (!row) return 'NO-ROW'
      const cell = row.children[i]; if (!cell) return 'NO-CELL'
      const target = cell.querySelector('input, .el-select, [class*=ref], i') || cell
      target.click()
      await new Promise(r => setTimeout(r, 2500))
      const dlg = [...document.querySelectorAll('.el-dialog, .el-drawer')].filter(d => d.offsetParent !== null)
      return {
        弹出: dlg.length,
        标题: dlg.map(d => clean(d.querySelector('.el-dialog__title, .el-drawer__title')?.innerText || '')),
        下拉候选: [...document.querySelectorAll('.el-select-dropdown__item')].map(e => clean(e.innerText)).filter(Boolean).slice(0, 45),
      }
    })()`)
    console.log('=== ③ 首行「计量单位」候选 ===')
    console.log('  ', JSON.stringify(unitProbe).slice(0, 1600))

    await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); 'ok'`)
    await sleep(700)

    // 点开首行「材料编码」→ 看是否为商品档案参照
    const matProbe = await evaluate(`(async () => {
      const clean = s => (s||'').replace(/\\s+/g,' ').trim()
      const t = [...document.querySelectorAll('table')].find(t => [...t.querySelectorAll('thead th')].some(th => clean(th.innerText) === '材料编码'))
      if (!t) return 'NO-TABLE'
      const heads = [...t.querySelectorAll('thead th')].map(th => clean(th.innerText))
      const i = heads.indexOf('材料编码')
      const row = t.querySelector('tbody tr'); if (!row) return 'NO-ROW'
      const cell = row.children[i]
      const target = cell.querySelector('input, .el-select, [class*=ref], i') || cell
      target.click()
      await new Promise(r => setTimeout(r, 2600))
      const dlg = [...document.querySelectorAll('.el-dialog, .el-drawer')].filter(d => d.offsetParent !== null)
      return { 弹出: dlg.length,
               标题: dlg.map(d => clean(d.querySelector('.el-dialog__title, .el-drawer__title')?.innerText || '')),
               弹窗文本: dlg.length ? clean(dlg[0].innerText).slice(0, 400) : '' }
    })()`)
    console.log('=== ④ 首行「材料编码」参照 ===')
    console.log('  ', JSON.stringify(matProbe, null, 1).slice(0, 1200))
    ws.close()
  } finally { try { edge.kill() } catch {} }
}
main().catch(e => { console.error('FAIL', e); process.exit(1) })
