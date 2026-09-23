/* _v-qc-req-type2.cjs — 判定:打字是「写进行了对象但界面不刷新」还是「根本没写进去」
   手法:打字 → 点「完成」(退出编辑态,触发一次权威重渲染)→ 再点「修改」→ 读输入框的 value。
        若显示刚才打的字 = 写进去了(raw 行无响应式,界面没跟上);
        若还是空 = 压根没写进。
   另附对照组:同页面上其它面板的可编辑输入框,验证探针的打字手法本身有效。
   用法:node tools/archive/_probe-qc-logic/_v-qc-req-type2.cjs [前端基址] */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9363
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:8090/api'
const WEB = process.argv[2] || 'http://localhost:5173'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const T0 = Date.now()

const HELPERS = `window.__tr = (n) => {
  const f = [...document.querySelectorAll('.qc-paper')].find(p => (p.querySelector('.qc-title')?.innerText || '').includes('折叠棉'))
  const trs = [...f.querySelectorAll('tbody tr')].filter(t => t.querySelector('.rs-td'))
  return n === 'last' ? trs[trs.length - 1] : trs[n]
}; window.__val = (n) => { const tr = window.__tr(n); const i = tr.querySelector('.rs-td input'); return i ? i.value : '(只读:' + tr.querySelector('.rs-td').innerText.trim() + ')' };
window.__click = (n, label) => { const tr = window.__tr(n); const b = [...tr.querySelectorAll('.rs-op-btn')].find(x => x.innerText.includes(label)); if (!b) return 'no-btn'; b.click(); return 'ok' };
window.__type = (n, text) => { const tr = window.__tr(n); const i = tr.querySelector('.rs-td input'); if (!i) return 'no-input'; i.focus(); i.select && i.select(); document.execCommand('insertText', false, text); return 'typed:' + i.value };
'ok'`

async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login.data.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-req-t2-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1400,900', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let seq = 0; const pending = new Map(); const msgs = []
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
    if (m.method === 'Runtime.consoleAPICalled') msgs.push((m.params.args || []).map(a => a.value ?? a.description).join(' '))
    if (m.method === 'Runtime.exceptionThrown') msgs.push('EXC ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text))
  })
  const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
  const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(900); return } } }
  const waitFor = async (exp, ms = 30000, step = 800) => { for (let i = 0; i < Math.ceil(ms / step); i++) { const v = await evaluate(exp); if (v) return v; await sleep(step) } return null }
  await send('Page.enable'); await send('Runtime.enable')

  await navigate(`${WEB}/#/login`)
  await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
  for (let a = 1; a <= 2; a++) {
    await navigate('about:blank')
    await navigate(`${WEB}/#/panelx/list/QC_INSP_REQ`)
    await sleep(3000)
    await evaluate(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 1 })()`)
    await waitFor(`!document.querySelector('.wizard-mask')`, 8000, 400)
    const ready = await waitFor(`(() => {
      const f = [...document.querySelectorAll('.qc-paper')].find(p => (p.querySelector('.qc-title')?.innerText || '').includes('折叠棉'))
      return (f && f.querySelector('.rs-add')) ? 'READY' : ''
    })()`, 15000)
    if (ready === 'READY') break
  }
  await evaluate(HELPERS)

  console.log('\n=== A. 新增行:打字 → 完成 → 再修改,看字在不在 ===')
  await evaluate(`(() => { const f = [...document.querySelectorAll('.qc-paper')].find(p => (p.querySelector('.qc-title')?.innerText || '').includes('折叠棉')); f.querySelector('.rs-add').click(); return 1 })()`)
  await sleep(1200)
  console.log('新增后第一格 value:', JSON.stringify(await evaluate(`window.__val('last')`)))
  console.log('打字:', await evaluate(`window.__type('last', 'AAA111')`))
  await sleep(600)
  console.log('打完 600ms 后 value:', JSON.stringify(await evaluate(`window.__val('last')`)))
  console.log('点「完成」:', await evaluate(`window.__click('last', '完成')`))
  await sleep(600)
  console.log('完成态(只读文本):', JSON.stringify(await evaluate(`window.__val('last')`)))
  console.log('点「修改」:', await evaluate(`window.__click('last', '修改')`))
  await sleep(600)
  console.log('再进编辑态 value:', JSON.stringify(await evaluate(`window.__val('last')`)), '  ← 非空=字写进了对象、只是界面不刷新')

  console.log('\n=== B. 已有行(第 1 行):打字 → 完成 → 再修改 ===')
  console.log('点「修改」:', await evaluate(`window.__click(0, '修改')`))
  await sleep(600)
  console.log('进编辑态 value:', JSON.stringify(await evaluate(`window.__val(0)`)))
  console.log('打字:', await evaluate(`window.__type(0, 'BBB222')`))
  await sleep(600)
  console.log('打完 600ms 后 value:', JSON.stringify(await evaluate(`window.__val(0)`)))
  console.log('点「完成」:', await evaluate(`window.__click(0, '完成')`))
  await sleep(600)
  console.log('完成态(只读文本):', JSON.stringify(await evaluate(`window.__val(0)`)))
  console.log('点「修改」:', await evaluate(`window.__click(0, '修改')`))
  await sleep(600)
  console.log('再进编辑态 value:', JSON.stringify(await evaluate(`window.__val(0)`)), '  ← 非空=字写进了对象')

  if (msgs.length) { console.log('\n控制台:'); msgs.slice(0, 15).forEach(m => console.log('  ', String(m).slice(0, 240))) }
  else console.log('\n控制台: 无输出/无异常')

  // 对照组:换一个面板(有普通输入框的),确认探针打字手法本身有效
  console.log('\n=== C. 对照组:另一个面板的输入框能否正常打字 ===')
  await navigate('about:blank')
  await navigate(`${WEB}/#/panelx/list/QC_INSP_REC`)
  await sleep(3500)
  const ctrl = await evaluate(`(() => {
    const i = document.querySelector('.qc-paper input, .rs-t input, .approval-sheet input, input.el-input__inner')
    if (!i) return 'NO-INPUT'
    i.focus(); i.select && i.select();
    const before = i.value
    document.execCommand('insertText', false, 'CTRL99')
    const now = i.value
    return JSON.stringify({ before, now })
  })()`)
  await sleep(700)
  const ctrlAfter = await evaluate(`(() => { const a = document.activeElement; return JSON.stringify({ tag: a?.tagName, cls: a?.className, value: a?.value }) })()`)
  console.log('对照组打字:', ctrl, ' 700ms 后:', ctrlAfter)

  try { edge.kill() } catch {}
  ws.close()
  console.log(`\n总耗时 ${Math.round((Date.now() - T0) / 1000)}s`)
  process.exit(0)
}
main().catch(e => { console.error('探针异常:', e.message); process.exitCode = 1 })
