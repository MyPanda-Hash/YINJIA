/* _v2-matout-ctrl.cjs — 材料出库单:表头/明细 字段的控件类型与「参照」弹窗实测
   ① 逐个字段读控件 DOM(参照 = 只读输入 + 点选图标;下拉 = el-select;文本 = 可输入)
   ② 点开「生产车间」的参照入口,看是否弹出部门档案(烧结车间/原料车间/…)
   ③ 点开明细首行「计量单位」,读候选(应为单位档案 个/支/张/PCS…,而非旧的 件/kg/套/升)
*/
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9358
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:8090'
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const login = await (await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' })
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-v2-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  let ready = false
  for (let i = 0; i < 40 && !ready; i++) { await sleep(500); try { if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) ready = true } catch {} }
  if (!ready) throw new Error('Edge 未就绪')
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const errors = []
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails?.exception?.description || '').slice(0, 160))
    })
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    await send('Page.enable'); await send('Runtime.enable')
    const nav = async (u) => { await send('Page.navigate', { url: u }); for (let i = 0; i < 60; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(900); return } } }
    await nav(BASE + '/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(BASE + '/#/panelx/list/MATERIAL_OUT')
    await sleep(6000)

    // ① 表头字段控件类型:标签节点 → 同级控件 outerHTML
    const ctrls = await evaluate(`(() => {
      const clean = s => (s||'').replace(/\\s+/g,' ').trim()
      const want = ['生产车间','领用人','部门编码','经手人编码','仓库','项目','出库类别','业务类型','领料类型','单据类型编码']
      const out = []
      const all = [...document.querySelectorAll('*')]
      for (const lab of want) {
        const node = all.find(e => e.children.length === 0 && clean(e.textContent) === lab)
        if (!node) { out.push({ 字段: lab, 结果: '未找到标签' }); continue }
        // 控件通常在标签的父级的下一个兄弟,或父级内部的后一个元素
        const cand = node.nextElementSibling || node.parentElement?.nextElementSibling
        const html = cand ? cand.outerHTML.replace(/\\s+/g, ' ').slice(0, 260) : '(无)'
        out.push({
          字段: lab,
          控件: cand ? (cand.className || '').toString().slice(0, 60) : '(无)',
          只读: cand?.querySelector?.('input') ? !!cand.querySelector('input').readOnly : null,
          输入框: cand?.querySelector?.('input') ? '有' : '无',
          HTML: html,
        })
      }
      return out
    })()`)
    console.log('=== ① 表头字段控件 ===')
    for (const f of ctrls) console.log('  ', JSON.stringify(f).slice(0, 420))

    // ② 点「生产车间」参照入口 → 期待弹出部门档案
    const refProbe = await evaluate(`(async () => {
      const clean = s => (s||'').replace(/\\s+/g,' ').trim()
      const node = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && clean(e.textContent) === '生产车间')
      if (!node) return 'NO-LABEL'
      const box = node.parentElement
      const clickable = box.querySelector('input, i, svg, .el-input__suffix, button') || box
      clickable.click()
      await new Promise(r => setTimeout(r, 2600))
      const dlgs = [...document.querySelectorAll('.el-dialog, .el-drawer')].filter(d => d.offsetParent !== null)
      return {
        弹出: dlgs.length,
        标题: dlgs.map(d => clean(d.querySelector('.el-dialog__title, .el-drawer__title')?.innerText || '')),
        弹窗内文本: dlgs.length ? clean(dlgs[0].innerText).slice(0, 500) : '',
        下拉项: [...document.querySelectorAll('.el-select-dropdown__item')].map(e => clean(e.innerText)).filter(Boolean).slice(0, 25),
      }
    })()`)
    console.log('=== ② 点「生产车间」参照入口 ===')
    console.log('  ', JSON.stringify(refProbe, null, 1).slice(0, 1400))

    // 关掉可能弹出的层
    await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); 'ok'`)
    await sleep(800)

    // ③ 明细首行「计量单位」候选
    const unit = await evaluate(`(async () => {
      const clean = s => (s||'').replace(/\\s+/g,' ').trim()
      const ths = [...document.querySelectorAll('th, .col-header, [class*=header-cell]')]
      const th = ths.find(t => clean(t.innerText) === '计量单位')
      if (!th) return 'NO-COL'
      return { 表头HTML: th.outerHTML.replace(/\\s+/g,' ').slice(0, 200) }
    })()`)
    console.log('=== ③ 明细「计量单位」列 ===')
    console.log('  ', JSON.stringify(unit).slice(0, 400))
    console.log('=== console 异常 ===')
    console.log('  ', errors.length ? errors.slice(0, 4).join('\n   ') : '(无)')
    ws.close()
  } finally { try { edge.kill() } catch {} }
}
main().catch(e => { console.error('FAIL', e); process.exit(1) })
