/* _v4-matout-edit.cjs — 明细「计量单位/材料编码」在编辑态下的控件与候选
   路径:打开面板 → 点「修改」进编辑态 → 点首行「计量单位」单元格 → 读控件与候选
   (草稿单据,只点不保存;若未进编辑态则退回双击单元格)
*/
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9360
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:8090'
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-v4-'))
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

    const clickBtn = async (name) => evaluate(`(() => {
      const b = [...document.querySelectorAll('button')].find(x => (x.innerText||'').replace(/\\s+/g,'') === ${JSON.stringify(name)})
      if (!b) return 'NO'
      b.click(); return 'OK'
    })()`)
    console.log('点「修改」:', await clickBtn('修改'))
    await sleep(3000)
    console.log('点「新增数据」:', await clickBtn('新增数据'))
    await sleep(3000)

    const probe = await evaluate(`(async () => {
      const clean = s => (s||'').replace(/\\s+/g,' ').trim()
      const t = [...document.querySelectorAll('table')].find(t => [...t.querySelectorAll('thead th')].some(th => clean(th.innerText) === '计量单位'))
      if (!t) return 'NO-TABLE'
      const heads = [...t.querySelectorAll('thead th')].map(th => clean(th.innerText))
      const iu = heads.indexOf('计量单位'), im = heads.indexOf('材料编码')
      const rows = [...t.querySelectorAll('tbody tr')]
      const out = { 列数: heads.length, 行数: rows.length, 单元格: [] }
      for (const [label, i] of [['计量单位', iu], ['材料编码', im], ['仓库', heads.indexOf('仓库')]]) {
        const r = rows[0]; if (!r || i < 0) continue
        const c = r.children[i]
        out.单元格.push({ 列: label, html: (c?.innerHTML || '').replace(/\\s+/g,' ').slice(0, 200),
                          控件: c?.querySelector('.el-select') ? 'el-select' : (c?.querySelector('[class*=ref]') ? 'ref' : (c?.querySelector('input') ? 'input' : '文本')) })
      }
      return out
    })()`)
    console.log('=== 编辑态明细单元格 ===')
    console.log(JSON.stringify(probe, null, 1).slice(0, 1500))

    const open = await evaluate(`(async () => {
      const clean = s => (s||'').replace(/\\s+/g,' ').trim()
      const t = [...document.querySelectorAll('table')].find(t => [...t.querySelectorAll('thead th')].some(th => clean(th.innerText) === '计量单位'))
      if (!t) return 'NO-TABLE'
      const heads = [...t.querySelectorAll('thead th')].map(th => clean(th.innerText))
      const i = heads.indexOf('计量单位')
      const r = [...t.querySelectorAll('tbody tr')][0]; if (!r) return 'NO-ROW'
      const c = r.children[i]
      const target = c.querySelector('input, .el-select, [class*=ref]') || c
      target.click()
      await new Promise(x => setTimeout(x, 2500))
      const dlg = [...document.querySelectorAll('.el-dialog, .el-drawer')].filter(d => d.offsetParent !== null)
      return { 弹出: dlg.length, 标题: dlg.map(d => clean(d.querySelector('.el-dialog__title, .el-drawer__title')?.innerText || '')),
               下拉候选: [...document.querySelectorAll('.el-select-dropdown__item')].map(e => clean(e.innerText)).filter(Boolean).slice(0, 50) }
    })()`)
    console.log('=== 点开「计量单位」===')
    console.log('  ', JSON.stringify(open).slice(0, 1800))
    ws.close()
  } finally { try { edge.kill() } catch {} }
}
main().catch(e => { console.error('FAIL', e); process.exit(1) })
