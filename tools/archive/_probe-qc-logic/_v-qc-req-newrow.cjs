/* _v-qc-req-newrow.cjs — 来料检验要求(QC_INSP_REQ)「折叠棉页签 ＋新增数据记录行」不可见问题实测
   目标:新行输入框"能输入但看不见" —— 量出输入框尺寸/可见性/被谁裁剪/在滚动区内的位置。
   用法:node tools/archive/_probe-qc-logic/_v-qc-req-newrow.cjs(需 5173 + 8090 已起) */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9361
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:8090/api'
const sleep = ms => new Promise(r => setTimeout(r, ms))
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
  spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1400,900', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
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

  await navigate('http://localhost:5173/#/login')
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
  let ready = null
  for (let a = 1; a <= 5 && !ready; a++) {
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/panelx/list/QC_INSP_REQ')
    await sleep(3500)
    ready = await waitFor(`(() => {
      const papers = [...document.querySelectorAll('.qc-paper')]
      const f = papers.find(p => (p.querySelector('.qc-title')?.innerText || '').includes('折叠棉'))
      return (f && f.querySelector('.rs-add')) ? 'READY' : ''
    })()`, 20000)
    if (!ready) console.log(`   [重试 ${a}/5] 折叠棉页签未就绪`)
  }
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
  ws.close()
}
main().catch(e => { console.error('探针异常:', e.message); process.exitCode = 1 })
