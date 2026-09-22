/* _v-qc-insp-rec-prefill.cjs — 检验目录「新增检验」带料号跳转的预填核查
   打开 /panelx/list/QC_INSP_REC?new=1&prefillBatch=260807&prefillMaterial=HP-12:
   新单空值时应预填 物料批次/物料名称(已录入内容不覆盖)。用法:node tools/archive/_probe-qc-insp-rec/_v-qc-insp-rec-prefill.cjs */
const { spawn } = require('node:child_process')
const fs = require('node:fs'), os = require('node:os'), path = require('node:path')
const PORT = 9360
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-prefill-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1338,1750',
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

    const readHead = `(() => {
      const sheet = document.querySelector('.qc-rec-sheet')
      if (!sheet) return ''
      const headVal = (label) => {
        const th = [...sheet.querySelectorAll('.qr-head-table th')].find(t => t.innerText.trim() === label)
        return th?.nextElementSibling?.querySelector('input')?.value ?? null
      }
      return JSON.stringify({ batch: headVal('物料批次'), material: headVal('物料名称'), file: headVal('文件编码') })
    })()`
    let got = null
    for (let attempt = 1; attempt <= 5 && !got; attempt++) {
      await navigate('about:blank')
      await navigate('http://localhost:5173/#/panelx/list/QC_INSP_REC?new=1&prefillBatch=260807&prefillMaterial=HP-12')
      await sleep(3500)
      await evaluate(`(() => { const wz = document.querySelector('.wizard-mask'); if (wz) (wz.querySelector('.wz-close') || wz.querySelector('.wz-skip'))?.click(); return 1 })()`)
      for (let i = 0; i < 25; i++) {
        const v = JSON.parse((await evaluate(readHead)) || '{}')
        if (v.batch === '260807') { got = v; break }
        await sleep(800)
      }
      if (!got) console.log(`   [重试 ${attempt}/5] 预填未生效`)
    }
    ok('物料批次已按跳转参数预填(260807)', got?.batch === '260807', JSON.stringify(got))
    ok('物料名称已按跳转参数预填(HP-12)', got?.material === 'HP-12', JSON.stringify(got))
    ok('文件编码默认仍为 YJ-QR-96', got?.file === 'YJ-QR-96', JSON.stringify(got))
  } finally {
    edge.kill()
    try { fs.rmSync(profile, { recursive: true, force: true }) } catch { /* ignore */ }
  }
  console.log(process.exitCode ? '\n== 有失败项 ==' : '\n== 全部通过 ==')
  process.exit(process.exitCode || 0)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
