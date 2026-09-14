// _probe-spec-cover-edit.cjs — 规格书封面编辑态:输入框内高/字行高/宽度 vs 只读态对照(半截字回归探针)
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9354
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const PAGE = process.argv[3] || '#/panelx/list/RD_SPEC_DOC'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails.push(m) }
async function main() {
  const login = await (await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }) })).json()
  const token = login?.data?.token
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-sc-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1700,1400',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => { const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      if (r.result && r.result.exceptionDetails) return '<<EVAL-ERR ' + JSON.stringify(r.result.exceptionDetails.exception || {}).slice(0, 120) + '>>'
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3500); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    await ev(`localStorage.setItem('mes_token', ${JSON.stringify(token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await nav('about:blank')
    await nav(`${BASE}/${PAGE}`)
    await sleep(3200)
    // 编辑态量测:封面第一个输入框(名称)
    const m = JSON.parse(await ev(`(function(){
      var inp = document.querySelector('.rsp-cover-input input')
      if (!inp) return JSON.stringify({err:'no cover input(可能未开编辑)'})
      var cs = getComputedStyle(inp)
      var lineH = parseFloat(cs.lineHeight), fs = parseFloat(cs.fontSize)
      var wrapper = inp.closest('.el-input__wrapper')
      var wp = wrapper ? getComputedStyle(wrapper) : null
      return JSON.stringify({ h: inp.offsetHeight, lineH: lineH, fs: fs,
        wrapPadL: wp ? parseFloat(wp.paddingLeft) : -1, wrapPadR: wp ? parseFloat(wp.paddingRight) : -1,
        shadow: wp ? wp.boxShadow : '' })
    })()`) || '{}')
    if (m.err) { ok(false, '编辑态封面输入框: ' + m.err); process.exit(1) }
    ok(m.lineH >= m.fs - 0.5, `① 行高≥字号(与只读态 line-height:1 同口径,不削字): lineH=${m.lineH} fs=${m.fs}`)
    ok(m.h >= m.lineH - 1, `② 输入框内高≥行高(内容不被裁): h=${m.h}`)
    ok(m.wrapPadL === 0 && m.wrapPadR === 0, `③ wrapper 左右内边距=0(不再压窄): ${m.wrapPadL}/${m.wrapPadR}`)
    // 与只读态字号一致性:同一封面上 只读 val 的字号 应与编辑输入字号相同(31.3*cok)
    const ro = JSON.parse(await ev(`(function(){
      var v = document.querySelector('.rsp-cover-val'); if (!v) return JSON.stringify({err:'no readonly val'})
      var cs = getComputedStyle(v); return JSON.stringify({ fs: parseFloat(cs.fontSize), lh: parseFloat(cs.lineHeight) })
    })()`) || '{}')
    if (!ro.err) ok(Math.abs(ro.fs - m.fs) < 0.5, `④ 编辑/只读字号一致: ${m.fs} vs ${ro.fs}`)
    console.log(fails.length ? `\n${fails.length} 项失败` : '\n全部通过')
    process.exit(fails.length ? 1 : 0)
  } finally {
    try { edge.kill() } catch {}
    await sleep(1200); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
