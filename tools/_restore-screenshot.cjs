// _restore-screenshot.cjs — 恢复瞬间截屏取证
const { spawn, execSync } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9357
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rs2-'))
  const edge = spawn(EDGE, ['--no-first-run', '--window-size=1400,900',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(3000)
  try {
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json()
    const ws = new WebSocket(tab.webSocketDebuggerUrl)
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
    let seq = 0; const pending = new Map()
    ws.on('message', (d) => { let m; try { m = JSON.parse(d.toString()) } catch { return }
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
    const send = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const wait = (method, params = {}) => new Promise((res) => { const id = ++seq; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })) })
    const ev = async (exp) => { const r = await send('Runtime.evaluate', { expression: exp, returnByValue: true, awaitPromise: true })
      return r.result && r.result.result ? r.result.result.value : undefined }
    const nav = async (url) => { await wait('Page.navigate', { url }); for (let i = 0; i < 80; i++) { await sleep(200); if (await ev('document.readyState') === 'complete') { await sleep(3500); return } } }
    await send('Page.enable'); await send('Runtime.enable')
    await nav(`${BASE}/#/login`)
    console.log('最小化…')
    try { execSync('powershell -NoProfile -ExecutionPolicy Bypass -File tools\\_min-flip.ps1', { cwd: 'C:/INCER/YINJIA-MES', encoding: 'utf8', timeout: 20000 }) } catch {}
    // 恢复后立刻截屏(截的是页面渲染,不是 OS 窗口——但能看出页面/弹层状态)
    const shot = await wait('Page.captureScreenshot', { format: 'png' })
    const p1 = 'C:/INCER/YINJIA-MES/tools/_restore-shot-page.png'
    fs.writeFileSync(p1, Buffer.from(shot.result.data, 'base64'))
    console.log('页面截图 →', p1)
  } finally {
    try { edge.kill() } catch {}
    await sleep(1000); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
