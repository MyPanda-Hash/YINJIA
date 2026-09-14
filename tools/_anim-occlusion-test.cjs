// _anim-occlusion-test.cjs — 验证:禁用CSS动画 / 禁用occlusion特性 是否消除最小化自动恢复
// 用法: node _anim-occlusion-test.cjs <mode>   mode: anim-off | flag | plain
const { spawn, execSync } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const WebSocket = require('C:/INCER/YINJIA-MES/tools/node_modules/ws')
const PORT = 9362
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const MODE = process.argv[2] || 'plain'
const URL_ = process.env.TURL || 'http://localhost:8090/#/panelx/list/RD_PROD_INFO'
const NAME = process.env.TNAME || MODE
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-ao-'))
  const flags = ['--no-first-run', '--window-size=1400,900', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`]
  if (MODE === 'flag') flags.splice(1, 0, '--disable-features=CalculateNativeWinOcclusion')
  flags.push(URL_)
  const edge = spawn(EDGE, flags, { stdio: 'ignore' })
  await sleep(9000)
  try {
    if (MODE === 'anim-off') {
      const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const page = tab.find((t) => t.type === 'page')
      const ws = new WebSocket(page.webSocketDebuggerUrl)
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
      const send = (method, params = {}) => new Promise((res) => { const id = Date.now() % 1e6; ws.send(JSON.stringify({ id, method, params })); setTimeout(res, 700) })
      await send('Runtime.evaluate', { expression: `var s=document.createElement('style');s.textContent='*{animation:none!important;transition:none!important}';document.head.appendChild(s);'ok'`, returnByValue: true })
      await sleep(500)
    }
    const out = execSync('powershell -NoProfile -ExecutionPolicy Bypass -File tools\\_min-flip.ps1', { cwd: 'C:/INCER/YINJIA-MES', encoding: 'utf8', timeout: 20000 }).trim()
    console.log(`[${NAME}] ${out}`)
  } finally {
    try { edge.kill() } catch {}
    await sleep(1000); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
