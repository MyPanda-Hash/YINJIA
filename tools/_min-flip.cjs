// _min-flip.cjs — 最小化翻转计数器(给定 URL):启动 Edge→最小化→观测 5 秒内 状态翻转次数
// 用法: node _min-flip.cjs <URL> <标签>
const { spawn, execSync } = require('node:child_process')
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path')
const PORT = 9369 + (process.argv[4] ? Number(process.argv[4]) : 0)
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const URL_ = process.argv[2] || 'about:blank'
const NAME = process.argv[3] || URL_
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-mf-'))
  const edge = spawn(EDGE, ['--no-first-run', '--window-size=1400,900',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, URL_], { stdio: 'ignore' })
  await sleep(Number(process.env.SETTLE_MS || 6000))
  const out = execSync('powershell -NoProfile -ExecutionPolicy Bypass -File tools\\_min-flip.ps1', { cwd: 'C:/INCER/YINJIA-MES', encoding: 'utf8', timeout: 20000 })
  console.log(`[${NAME}] ${out.trim()}`)
  try { edge.kill() } catch {}
  await sleep(1000)
  try { fs.rmSync(profile, { recursive: true, force: true }) } catch {}
}
main().catch((e) => { console.error('ERR', e); process.exit(1) })
