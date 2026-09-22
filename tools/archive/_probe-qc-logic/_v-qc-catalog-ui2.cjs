/* _v-qc-catalog-ui2.cjs — 检验目录新呈现核验:只读纸面 + 新列 + 行上动作按钮 */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9363
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = ms => new Promise(r => setTimeout(r, ms))
const ok = (name, cond, detail) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}`)
  if (!cond) process.exitCode = 1
}
async function main() {
  const login = await (await fetch('http://localhost:8090/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })).json()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-cat2-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1680,1050',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise(res => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const evaluate = async (exp) => (await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })).result?.result?.value
    const navigate = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 50; i++) { await sleep(300); if (await evaluate('document.readyState') === 'complete') { await sleep(900); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await navigate('http://localhost:5173/#/login')
    await evaluate(`localStorage.setItem('mes_token', ${JSON.stringify(login.data.token)}); localStorage.setItem('mes_user', ${JSON.stringify(JSON.stringify(login.data.user))}); 'ok'`)
    await navigate('about:blank')

    let snap = null
    for (let a = 1; a <= 5 && !snap; a++) {
      await navigate('about:blank')
      await navigate('http://localhost:5173/#/panelx/list/QC_CATALOG')
      await sleep(3500)
      await evaluate(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 1 })()`)
      for (let i = 0; i < 20; i++) {
        const s = await evaluate(`(() => {
          const sheet = document.querySelector('.catalog-sheet')
          if (!sheet) return ''
          const heads = [...sheet.querySelectorAll('thead th')].map(e => e.innerText.replace(/\\s/g,''))
          const rows = sheet.querySelectorAll('tbody tr').length
          return JSON.stringify({
            heads,
            rows,
            bodyInputs: sheet.querySelectorAll('tbody input, tbody textarea').length,
            acts: [...sheet.querySelectorAll('.cs-act')].map(e => e.innerText.trim()),
            links: sheet.querySelectorAll('.cs-link').length,
            text: sheet.innerText.slice(0, 600),
          })
        })()`)
        const j = s ? JSON.parse(s) : null
        if (j && j.rows > 0) { snap = j; break }
        await sleep(800)
      }
      if (!snap) console.log(`   [重试 ${a}/5] 纸面未就绪`)
    }
    ok('纸张已渲染且有数据行', !!snap && snap.rows > 0, JSON.stringify(snap && { rows: snap.rows }))
    for (const h of ['第1类', '第2类', '第3类', '检测物料类别', '物料名称', '物料编码', '批次号', '数量', '检验状态', '是否合格', '检验单号', '检验数据记录单号', '检验记录目录'])
      ok(`表头 ${h}`, (snap?.heads || []).some((x) => x.includes(h)))
    ok('纸面只读(表体无输入框)', (snap?.bodyInputs || 0) === 0, `输入框=${snap?.bodyInputs}`)
    ok('行上出现动作按钮(完成检验/修改/✕)', (snap?.acts || []).length > 0, JSON.stringify(snap?.acts))
    ok('两个单号带查看/跳转链接', (snap?.links || 0) >= 2, `链接数=${snap?.links}`)
    ok('含物料编码/类别/数量示例数据', /折叠棉|YJ-YCYX|kg/.test(snap?.text || ''), (snap?.text || '').slice(0, 120).replace(/\n/g, '|'))
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
  }
  console.log(process.exitCode ? '\n== 有失败项 ==' : '\n== 全部通过 ==')
  process.exit(process.exitCode || 0)
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
