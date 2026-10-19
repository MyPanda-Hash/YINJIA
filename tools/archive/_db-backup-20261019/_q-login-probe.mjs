/**
 * _q-login-probe.mjs — 诊断登录页「登录工厂」下拉的 DOM 结构(为选测试账套截图取证)。
 * 用法:node tools/archive/_db-backup-20261019/_q-login-probe.mjs [http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { attachCdp } from '../_cdp.mjs'

const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9484
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-lp-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
const cdp = await attachCdp(PORT)
await cdp.send('Page.enable'); await cdp.send('Runtime.enable')
const ev = cdp.ev
const waitFor = async (expr, ms = 20000) => { for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) } return false }
try {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await cdp.send('Page.navigate', { url: `${BASE}/#/login` })
  await waitFor(`document.querySelectorAll('.login-form input').length >= 2`)
  await sleep(2500)
  console.log('selects:', await ev(`document.querySelectorAll('.login-form .el-select').length`))
  console.log('selected text:', await ev(`(() => { const s=document.querySelector('.login-form .el-select'); return s ? s.innerText : 'none' })()`))
  await ev(`(() => { const s=document.querySelector('.login-form .el-select'); s.querySelector('.el-select__wrapper')?.click(); s.click(); return 1 })()`)
  await sleep(1200)
  console.log('dropdown items:', await ev(`JSON.stringify([...document.querySelectorAll('.el-select-dropdown__item')].map(e=>({t:e.textContent.trim(), vis:!!e.offsetParent})))`))
  console.log('popper html has 测试:', await ev(`(document.body.innerText.indexOf('测试库')>=0)`))
} finally {
  cdp.close?.()
  edge.kill()
}
