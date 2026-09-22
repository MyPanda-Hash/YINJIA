/* _v-tcin-grid.cjs — QC_TC_IN 版式「对齐/不错位」核查(只读,不改库)
   做法:进编辑态渲染整张文书 → 逐行量出每个格子的 x 边界 → 断言「全表所有竖线都落在同一张网格上」
        (每行的边界集合必须是全局边界集合的子集;任何一行多出一条别的位置的竖线 = 错位)。
   同时报出行高、勾选框位置,并截图 tools/archive/_tc-in-render.png 供与原扫描图逐格比对。
   用法:node tools/archive/_v-tcin-grid.cjs [PANEL=QC_TC_IN] */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9344
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const PANEL = process.argv[2] || 'QC_TC_IN'
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  const login = await (await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-grid-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1338,1500',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const errors = []
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
        errors.push('console: ' + (m.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 200))
      if (m.method === 'Runtime.exceptionThrown')
        errors.push('exception: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || '').slice(0, 200))
    })
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(700); return } } }
    await send('Page.enable'); await send('Runtime.enable')

    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate(`http://localhost:5173/#/panelx/list/${PANEL}`)
    await sleep(3500)

    // 关掉首次进入的「MES 初始化配置」引导弹窗,别挡住纸张
    await evaluate(`(() => {
      const d = [...document.querySelectorAll('.el-dialog, .el-overlay')]
        .find(e => /初始化配置|行业细分/.test(e.innerText || ''));
      if (!d) return 'NO-DIALOG';
      const b = [...d.querySelectorAll('button, .el-button, span')].find(e => /下次再说|关闭/.test(e.innerText || ''));
      if (b) { b.click(); return 'DISMISSED' }
      return 'NO-BUTTON'
    })()`)
    await sleep(1200)

    // 进可编辑态(只为让大填写区渲染成 textarea;「新增」不落库,不点保存就没有写入)
    let editClicked = ''
    for (let i = 0; i < 8; i++) {
      await evaluate(`(() => {
        const b = [...document.querySelectorAll('button')].find(b => b.innerText.replace(/\\s/g,'').includes('新增流程'));
        if (b && !document.querySelector('.approval-sheet')) b.click();
        return !!b
      })()`)
      await sleep(1800)
      editClicked = await evaluate(`(() => {
        if (document.querySelector('.el-textarea__inner')) return 'EDITABLE'
        const b = [...document.querySelectorAll('.as-side-btn')].find(e => e.innerText.replace(/\\s/g,'') === '新增');
        if (!b) return 'NO-BUTTON'
        if ((b.className||'').includes('disabled')) return 'DISABLED'
        b.click(); return 'CLICKED'
      })()`)
      if (editClicked === 'EDITABLE') break
      await sleep(2200)
    }
    await sleep(2000)

    const geom = await evaluate(`(() => {
      const sheet = document.querySelector('.approval-sheet')
      if (!sheet) return { err: 'NO-SHEET' }
      const table = sheet.querySelector('.as-table')
      const t0 = table.getBoundingClientRect()
      const px = n => Math.round(n * 10) / 10
      const rows = [...table.children].map((el, i) => {
        const r = el.getBoundingClientRect()
        const cells = [...el.querySelectorAll('.q-vlabel, .q-label, .q-dept-name')].map(c => {
          const b = c.getBoundingClientRect()
          return { cls: (c.className || '').split(' ')[0], txt: (c.innerText || '').replace(/\\s+/g, '').slice(0, 8),
                   x0: px(b.left - t0.left), x1: px(b.right - t0.left) }
        })
        const pairs = [...el.querySelectorAll('.q-pair')].map(c => {
          const b = c.getBoundingClientRect()
          return { x0: px(b.left - t0.left), x1: px(b.right - t0.left) }
        })
        const checks = [...el.querySelectorAll('.q-check')].map(c => {
          const b = c.getBoundingClientRect()
          return { txt: (c.innerText || '').replace(/\\s+/g, ''), x0: px(b.left - t0.left), x1: px(b.right - t0.left) }
        })
        const ta = el.querySelector('.el-textarea__inner, .as-ro-text')
        return { i, cls: (el.className || '').split(' ').slice(0, 3).join('.'), h: px(r.height),
                 cells, pairs, checks,
                 fill: ta ? { h: px(ta.getBoundingClientRect().height) } : null }
      })
      return { sheetW: px(t0.width), tableW: px(t0.width), rows,
               editState: { 编辑框: sheet.querySelectorAll('.el-textarea__inner').length,
                            只读块: sheet.querySelectorAll('.as-ro-text').length } }
    })()`)
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    if (shot.result?.data) fs.writeFileSync('tools/archive/_tc-in-render.png', Buffer.from(shot.result.data, 'base64'))

    console.log(`=== 新增(编辑态)入口: ${editClicked} ===`)
    if (geom.err) { console.log('渲染失败:', geom.err); ws.close(); return }
    console.log(`=== 表宽 ${geom.tableW}px,共 ${geom.rows.length} 行  编辑态=${JSON.stringify(geom.editState)} ===`)
    const all = new Set()
    for (const r of geom.rows) for (const c of r.cells) { all.add(c.x0); all.add(c.x1) }
    for (const r of geom.rows) for (const c of r.pairs) { all.add(c.x0); all.add(c.x1) }
    const grid = [...all].sort((a, b) => a - b)
    console.log('全局竖线(全表所有边界,应恰好是这些位置):', grid.join(' | '))

    console.log('\n=== 逐行 ===')
    let bad = 0
    for (const r of geom.rows) {
      const b = new Set()
      for (const c of r.cells) { b.add(c.x0); b.add(c.x1) }
      for (const c of r.pairs) { b.add(c.x0); b.add(c.x1) }
      const off = [...b].filter(x => !grid.some(g => Math.abs(g - x) <= 1.5))
      if (off.length) bad++
      const parts = r.cells.map(c => `${c.cls}"${c.txt}"[${c.x0}..${c.x1}]`).join(' ')
      console.log(`  #${String(r.i).padStart(2)} h=${String(r.h).padStart(5)} ${r.cls}`)
      console.log(`       格: ${parts || '(无标签格)'}${r.fill ? `  填写区高=${r.fill.h}` : ''}`)
      console.log(`       对: ${r.pairs.map(p => `[${p.x0}..${p.x1}]`).join(' ')}`)
      if (r.checks.length) console.log(`       勾: ${r.checks.map(c => `${c.txt}@${c.x0}-${c.x1}`).join(' ')}`)
      if (off.length) console.log(`       ⚠ 错位: ${off.join(', ')}`)
    }
    const real = errors.filter(e => !/favicon|WebSocket connection|vite/.test(e))
    console.log(`\n=== 结论 === 错位行数=${bad}  console 报错=${real.length}`)
    real.forEach(e => console.log('   ', e))
    console.log('截图: tools/archive/_tc-in-render.png')
    ws.close()
  } finally { edge.kill(); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {} }
}
main().catch(e => { console.error(e); process.exit(1) })
