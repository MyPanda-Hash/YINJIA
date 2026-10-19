/**
 * _q-backup-shot.mjs — 数据安全(数据库备份)面板的活体验证(2026-10-19)
 *
 * 做的事:登录「测试账套」→ 打开 #/sys/backup → 截图(1440 / 375)+ dump 关键文案;
 *        再打开 #/dc/config 复核联网设备台账已进数采设备数据(133 条)。
 * 用法:node tools/archive/_db-backup-20261019/_q-backup-shot.mjs [http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const LEDGER = process.env.LEDGER || 'test' // test | prod
const PORT = 9483
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, 'shots')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-bk-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
const cdp = await attachCdp(PORT)
await cdp.send('Page.enable'); await cdp.send('Runtime.enable')
const ev = cdp.ev
const waitFor = async (expr, ms = 30000) => { for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) } return false }
const shot = async (name) => {
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'))
  console.log('   截图', name)
}
try {
  fs.mkdirSync(OUT, { recursive: true })
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await cdp.send('Page.navigate', { url: `${BASE}/#/login` })
  await waitFor(`document.querySelectorAll('.login-form input').length >= 2`)
  await ev(`(() => { const ins=[...document.querySelectorAll('.login-form input')]
    const set=(el,v)=>{el.focus();el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
    set(ins[0],'admin'); set(ins[1],'123456'); return 1 })()`)
  // 登录工厂是 el-select(选项里有 YINJIA-MES / YINJIA-MES·测试库);点 wrapper 打开再按文本选,
  // 直接点 .el-select 容器在 Element Plus 下不一定展开(2026-10-19 实测第一次没选上,落到正式账套)。
  await ev(`(() => { const s=document.querySelector('.login-form .el-select'); (s.querySelector('.el-select__wrapper')||s).click(); return 1 })()`)
  await sleep(1000)
  const wantTest = LEDGER === 'test'
  const picked = await ev(`(() => { const it=[...document.querySelectorAll('.el-select-dropdown__item')].filter(e=>e.offsetParent)
    const t=it.find(i=>i.textContent.indexOf('YINJIA-MES')>=0 && (i.textContent.indexOf('测试')>=0) === ${wantTest}); if(!t) return 'no-opt'; t.click(); return t.textContent.trim() })()`)
  console.log('[登录工厂]', picked)
  await sleep(400)
  await ev(`(() => { const b=document.querySelector('.login-submit'); if(b) b.click(); return 1 })()`)
  await waitFor(`location.hash.indexOf('/login') < 0`)

  // ① 数据备份面板
  await ev(`(location.hash='#/sys/backup','ok')`)
  await sleep(2500)
  const txt = await ev(`(document.querySelector('.bk-page')||document.body).innerText.replace(/\\s+/g,' ').slice(0,600)`)
  console.log('[备份面板文案]', txt)
  await shot(`sys-backup-1440.png`)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 900, deviceScaleFactor: 1, mobile: true })
  await sleep(1200)
  await shot(`sys-backup-375.png`)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })

  // ② 数采设备配置管理(联网设备台账)
  await ev(`(location.hash='#/dc/config','ok')`)
  await sleep(3000)
  const kpi = await ev(`(() => { const t=(document.querySelector('.dc-kpis')||document.body).innerText.replace(/\\s+/g,' '); const rows=document.querySelectorAll('.el-table__body tr').length; return t.slice(0,220) + ' || 表格行=' + rows })()`)
  console.log('[数采设备配置]', kpi)
  await shot(`dc-config-devices-1440.png`)
} finally {
  cdp.close?.()
  edge.kill()
}
