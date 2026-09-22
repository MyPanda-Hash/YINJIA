/* _v-qc-catalog-save.cjs — 检验目录纸面改值 → 右侧「保存」→ 落库 端到端核查
   ① 纸面把第一行「数量」51Kg 改成探针值 → ② 点右侧竖排操作栏「保存」→ ③ 读回该单明细核对 →
   ④ 还原为 51Kg 再存一次(不留脏数据)。用法:node tools/archive/_probe-qc-catalog/_v-qc-catalog-save.cjs */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9352
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = 'http://localhost:8090/api'
const MARK = '88Kg'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const ok = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`)
  if (!cond) process.exitCode = 1
}

/** 读库核对(走接口,不引 JDBC):该单明细行 */
async function rows(token) {
  const r = await (await fetch(`${BASE}/px/getFormDescriptor?panelCode=QC_CATALOG&code=${encodeURIComponent('JYML-2026-09-0001')}`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json()
  return r?.data?.detailData?.items || []
}

async function main() {
  const login = await (await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const token = login.data.token
  const before = await rows(token)
  ok('初始明细两行', before.length === 2, JSON.stringify(before.map((r) => r['数量'])))

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-catsave-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1338,1750',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map(); const calls = []
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
      if (m.method === 'Network.responseReceived' && m.params.response.url.includes('/px/callButton'))
        calls.push(m.params.response.status)
    })
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(900); return } } }
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')
    await navigate('http://localhost:5173/#/panelx/list/QC_CATALOG')
    await sleep(5500)
    await evaluate(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 1 })()`)
    await sleep(1200)

    // 等纸面与批次行渲染完(固定睡眠不够稳:面板要拉配置+取单)
    let ready = null
    for (let i = 0; i < 20; i++) {
      ready = await evaluate(`(() => {
        const inputs = [...document.querySelectorAll('.catalog-sheet tbody input')]
        const side = [...document.querySelectorAll('.approval-side .as-side-btn')].map(e => e.innerText.replace(/\\s/g, ''))
        return JSON.stringify({ n: inputs.length, vals: inputs.map(i => i.value).slice(0, 8), side })
      })()`)
      const r = JSON.parse(ready || '{}')
      if ((r.vals || []).includes('51Kg') && (r.side || []).includes('保存')) break
      await sleep(1000)
    }
    console.log('   诊断:', ready)

    /** 纸面上按值定位输入框并改值(触发 Vue 的 input 事件) */
    const setByValue = (from, to) => `(() => {
      const el = [...document.querySelectorAll('.catalog-sheet tbody input')].find(i => i.value === ${JSON.stringify(from)})
      if (!el) return 'NOTFOUND'
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(el, ${JSON.stringify(to)})
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return 'SET'
    })()`

    ok('纸面定位到 51Kg 输入框', await evaluate(setByValue('51Kg', MARK)) === 'SET')
    await sleep(500)
    const dirty = await evaluate(`!!document.querySelector('.catalog-sheet')`)
    ok('纸面仍在(改值未跳页)', dirty)

    // 点右侧竖排操作栏「保存」
    const clicked = await evaluate(`(() => {
      const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find(e => e.innerText.replace(/\\s/g, '') === '保存')
      if (!b) return 'NOBTN'
      b.click()
      return 'CLICKED'
    })()`)
    ok('右侧「保存」可点', clicked === 'CLICKED', clicked)
    for (let i = 0; i < 20 && !calls.length; i++) await sleep(500)
    ok('保存请求已发出', calls.length > 0, JSON.stringify(calls))
    await sleep(2500)

    // 读回核对
    const after = await rows(token)
    const got = after[0]?.['数量']
    ok(`数量已落库为 ${MARK}`, got === MARK, `实际=${JSON.stringify(got)} 全部=${JSON.stringify(after.map((r) => r['数量']))}`)
    ok('行数未变(仍两行)', after.length === 2, `rows=${after.length}`)

    // 还原:再改回 51Kg 并保存
    ok('还原输入框', await evaluate(setByValue(MARK, '51Kg')) === 'SET')
    await sleep(500)
    await evaluate(`(() => { const b = [...document.querySelectorAll('.approval-side .as-side-btn')].find(e => e.innerText.replace(/\\s/g, '') === '保存'); b?.click(); return !!b })()`)
    await sleep(3500)
    const restored = await rows(token)
    ok('已还原为 51Kg(不留脏数据)', restored[0]?.['数量'] === '51Kg', JSON.stringify(restored.map((r) => r['数量'])))
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* 清理失败无碍 */ }
  }
  console.log(process.exitCode ? '\n== 有失败项 ==' : '\n== 全部通过 ==')
  process.exit(process.exitCode || 0)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
