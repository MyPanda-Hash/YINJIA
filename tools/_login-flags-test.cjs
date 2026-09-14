// _login-flags-test.cjs — 登录页 + 不同浏览器特性开关,定位哪个子系统导致最小化恢复
// mode: baseline | no-translate | no-autofill | no-ime | chrome-style
const { spawn, execSync } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const PORT = 9355 + Math.floor(Math.random() * 40)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const BASE = process.argv[2] || 'http://localhost:8090'
const MODE = process.argv[3] || 'baseline'
const LABEL = process.argv[4] || MODE
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-lf2-'))
  const flags = ['--no-first-run', '--window-size=1400,900', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`]
  if (MODE === 'no-translate') flags.splice(1, 0, '--disable-features=Translate,TranslateUI')
  if (MODE === 'no-autofill') flags.splice(1, 0, '--disable-features=AutofillServerCommunication,AutofillEnableAccountWalletStorage')
  if (MODE === 'minimal') flags.splice(1, 0, '--disable-features=Translate,TranslateUI,AutofillEnableAccountWalletStorage,msImplicitSignin,EdgeSync,EdgeSuggestions')
  flags.push(`${BASE}/#/login`)
  const edge = spawn(EDGE, flags, { stdio: 'ignore' })
  await sleep(9000)
  try {
    const out = execSync('powershell -NoProfile -ExecutionPolicy Bypass -File tools\\_min-flip.ps1', { cwd: 'C:/INCER/YINJIA-MES', encoding: 'utf8', timeout: 20000 }).trim()
    console.log(`[${LABEL}] ${out}`)
  } finally {
    try { edge.kill() } catch {}
    await sleep(1000); try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
