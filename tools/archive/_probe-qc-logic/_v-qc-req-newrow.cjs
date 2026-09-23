/* _v-qc-req-newrow.cjs — 来料检验要求(QC_INSP_REQ)「折叠棉页签 ＋新增数据记录行」不可见问题实测
   目标:新行输入框"能输入但看不见" —— 量出输入框尺寸/可见性/被谁裁剪/在滚动区内的位置。
   用法:node tools/archive/_probe-qc-logic/_v-qc-req-newrow.cjs [前端基址](需 5173 或 8090 + 8090 接口已起)
        第 2 参默认 http://localhost:5173;量部署产物传 http://localhost:8090 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9361
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:8090/api'
const WEB = process.argv[2] || 'http://localhost:5173'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const T0 = Date.now()
const ok = (name, cond, detail) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`); if (!cond) process.exitCode = 1 }

// 页面内注入的度量函数:量一个元素 + 逐级祖先的裁剪情况
const MEASURE = `window.__m = (el) => {
  if (!el) return null
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  const out = { tag: el.tagName, cls: el.className, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    display: cs.display, visibility: cs.visibility, opacity: cs.opacity, color: cs.color, fontSize: cs.fontSize,
    w: cs.width, h: cs.height, overflow: cs.overflow, position: cs.position, value: el.value ?? null }
  const chain = []
  let p = el.parentElement, i = 0
  while (p && i++ < 8) {
    const pr = p.getBoundingClientRect(), pcs = getComputedStyle(p)
    chain.push({ tag: p.tagName, cls: String(p.className).slice(0, 40), rect: [Math.round(pr.x), Math.round(pr.y), Math.round(pr.width), Math.round(pr.height)],
      overflow: pcs.overflow, maxH: pcs.maxHeight, clip: pr.bottom < r.top || pr.top > r.bottom || pr.right < r.left || pr.left > r.right })
    p = p.parentElement
  }
  out.ancestors = chain
  return out
}; 'ok'`

async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-req-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1400,900', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map()
  ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
  const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
  const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(900); return } } }
  const waitFor = async (exp, ms = 30000, step = 800) => { for (let i = 0; i < Math.ceil(ms / step); i++) { const v = await evaluate(exp); if (v) return v; await sleep(step) } return null }
  await send('Page.enable'); await send('Runtime.enable')

  await navigate(`${WEB}/#/login`)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
  let ready = null
  for (let a = 1; a <= 2 && !ready; a++) {
    await navigate('about:blank')
    await navigate(`${WEB}/#/panelx/list/QC_INSP_REQ`)
    await sleep(3000)
    // 关掉「MES 初始配置」向导遮罩:上一次截图发现它盖住表格,导致度量/截图失真
    await evaluate(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 1 })()`)
    await waitFor(`!document.querySelector('.wizard-mask')`, 8000, 400)
    ready = await waitFor(`(() => {
      const papers = [...document.querySelectorAll('.qc-paper')]
      const f = papers.find(p => (p.querySelector('.qc-title')?.innerText || '').includes('折叠棉'))
      return (f && f.querySelector('.rs-add')) ? 'READY' : ''
    })()`, 15000)
    if (!ready) console.log(`   [重试 ${a}/2] 折叠棉页签未就绪`)
  }
  console.log('向导遮罩(应为 false):', await evaluate(`!!document.querySelector('.wizard-mask')`))
  ok('折叠棉页签就绪(纸面 + ＋新增数据记录行)', ready === 'READY', ready)
  if (ready !== 'READY') {
    console.log('诊断:', await evaluate(`(() => JSON.stringify({ url: location.hash, papers: document.querySelectorAll('.qc-paper').length, body: document.body.innerText.slice(0, 200) }))()`))
    throw new Error('未就绪,终止')
  }
  await evaluate(MEASURE)

  // 页签内原有行:量第一行(只读态)的单元格与输入框
  const before = await evaluate(`(() => {
    const f = [...document.querySelectorAll('.qc-paper')].find(p => (p.querySelector('.qc-title')?.innerText || '').includes('折叠棉'))
    const trs = [...f.querySelectorAll('tbody tr')].filter(t => t.querySelector('.rs-td'))
    const first = trs[0]
    return JSON.stringify({ rowCount: trs.length, firstRowText: first ? first.innerText.replace(/\\s+/g, ' ').slice(0, 80) : null,
      firstRowCells: first ? [...first.querySelectorAll('.rs-td')].map(td => ({ txt: td.innerText.trim().slice(0, 12), inputs: td.querySelectorAll('input').length })) : [] })
  })()`)
  console.log('原有行:', before)

  // 点「＋新增数据记录行」→ 等新行出现
  await evaluate(`(() => {
    const f = [...document.querySelectorAll('.qc-paper')].find(p => (p.querySelector('.qc-title')?.innerText || '').includes('折叠棉'))
    f.querySelector('.rs-add').click(); return 'clicked'
  })()`)
  await sleep(1200)
  const after = await evaluate(`(() => {
    const f = [...document.querySelectorAll('.qc-paper')].find(p => (p.querySelector('.qc-title')?.innerText || '').includes('折叠棉'))
    const trs = [...f.querySelectorAll('tbody tr')].filter(t => t.querySelector('.rs-td'))
    const last = trs[trs.length - 1]
    const tds = [...last.querySelectorAll('.rs-td')]
    return JSON.stringify({
      rowCount: trs.length,
      lastRowHtml: last.outerHTML.replace(/\\s+/g, ' ').slice(0, 400),
      cells: tds.map(td => ({ inputs: td.querySelectorAll('input').length, txt: td.innerText.trim(), el: window.__m(td.querySelector('input') || td) })),
    }, null, 1)
  })()`)
  console.log('新增后最后一行的度量:')
  console.log(after)

  // 点该行「修改」再看一次(用户说点了也不可编辑)
  await evaluate(`(() => {
    const f = [...document.querySelectorAll('.qc-paper')].find(p => (p.querySelector('.qc-title')?.innerText || '').includes('折叠棉'))
    const trs = [...f.querySelectorAll('tbody tr')].filter(t => t.querySelector('.rs-td'))
    const last = trs[trs.length - 1]
    const btn = [...last.querySelectorAll('.rs-op-btn')].find(b => b.innerText.includes('修改'))
    if (btn) { btn.click(); return 'clicked-edit' }
    return 'no-edit-btn'
  })()`)
  await sleep(1000)
  const afterEdit = await evaluate(`(() => {
    const f = [...document.querySelectorAll('.qc-paper')].find(p => (p.querySelector('.qc-title')?.innerText || '').includes('折叠棉'))
    const trs = [...f.querySelectorAll('tbody tr')].filter(t => t.querySelector('.rs-td'))
    const last = trs[trs.length - 1]
    const ins = [...last.querySelectorAll('input')]
    return JSON.stringify({ inputCount: ins.length, measures: ins.slice(0, 3).map(e => window.__m(e)) }, null, 1)
  })()`)
  console.log('点「修改」后:', afterEdit)
  const diag = await evaluate(`(() => {
    const f = [...document.querySelectorAll('.qc-paper')].find(p => (p.querySelector('.qc-title')?.innerText || '').includes('折叠棉'))
    const add = f.querySelector('.rs-add')
    const trs = [...f.querySelectorAll('tbody tr')].filter(t => t.querySelector('.rs-td'))
    const last = trs[trs.length - 1]
    const ins = [...last.querySelectorAll('input')]
    const sc = document.scrollingElement
    return JSON.stringify({
      viewport: [innerWidth, innerHeight],
      pageScroll: [Math.round(sc.scrollTop), Math.round(sc.scrollHeight)],
      addBar: window.__m(add).rect,
      table: window.__m(f.querySelector('table')).rect,
      lastRow: window.__m(last).rect,
      inputCount: ins.length,
      inputRects: ins.map(e => window.__m(e).rect),
      ancestors: (window.__m(ins[0] || last) || {}).ancestors,
    })
  })()`)
  console.log('诊断:', diag)

  // 截图取证:新增行滚进视野后,输入框到底长什么样(供人眼判断"看不见"到底是哪种)
  await evaluate(`(() => { const el = document.querySelector('.qc-paper tr[data-edit="1"]'); if (el) el.scrollIntoView({ block: 'center' }); return 1 })()`)
  await sleep(800)
  const shot1 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('tools/archive/_probe-qc-logic/_newrow.png', Buffer.from(shot1.result.data, 'base64'))
  // 再往新行第一个输入框打一段字,看字形/边框是否出现
  await evaluate(`(() => {
    const el = document.querySelector('.qc-paper tr[data-edit="1"] input')
    if (!el) return 'no-input'
    el.focus()
    el.value = '测试123'
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return 'typed'
  })()`)
  await sleep(800)
  const shot2 = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync('tools/archive/_probe-qc-logic/_newrow-typed.png', Buffer.from(shot2.result.data, 'base64'))
  console.log('截图: tools/archive/_probe-qc-logic/_newrow.png 与 _newrow-typed.png')
  // ⚠ 必须杀掉浏览器子进程并显式退出:否则 node 事件循环被 child 句柄挂住,
  //   进程不退出 → 外层命令一直等到超时(这就是"探针要跑几分钟"的真正原因)
  try { edge.kill() } catch {}
  ws.close()
  console.log(`总耗时 ${Math.round((Date.now() - T0) / 1000)}s`)
  process.exit(0)
}
main().catch(e => { console.error('探针异常:', e.message); process.exitCode = 1 })
