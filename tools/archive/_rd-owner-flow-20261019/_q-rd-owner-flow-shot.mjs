/**
 * _q-rd-owner-flow-shot.mjs — 立项申请「4 步流程」侧栏活体验证(2026-10-19)
 *
 * 打开 研发管理 → 立项申请 → 打开一张单据,截侧栏「③ 流程」段:
 * 应看到 1 项目定级 / 2 分发对接人 / 3 确认责任人 / 4 责任人确认收到 四步,
 * 第 4 步的置灰/可点状态来自后端 canConfirmReceipt。
 *
 * 用法:node tools/archive/_rd-owner-flow-20261019/_q-rd-owner-flow-shot.mjs [http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9441
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, 'shots')
const ADMIN = { userName: 'admin', password: '123456', factory: 'YINJIA-MES' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-rdflow-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  let cdp = null
  try {
    const errs = []
    cdp = await attachCdp(PORT, undefined, (m) => {
      if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push((m.params.args || []).map((a) => a.value ?? a.description).join(' ').slice(0, 200))
    })
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable')
    const ev = cdp.ev
    const waitFor = async (expr, ms = 30000) => { for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) } return false }
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
    await cdp.send('Page.navigate', { url: `${BASE}/#/login` })
    await waitFor(`document.querySelectorAll('.login-form input').length >= 2`)
    await ev(`(() => { const ins=[...document.querySelectorAll('.login-form input')]
      const set=(el,v)=>{el.focus();el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}
      set(ins[0], ${JSON.stringify(ADMIN.userName)}); set(ins[1], ${JSON.stringify(ADMIN.password)}); return 1 })()`)
    await ev(`(() => { const s=document.querySelector('.login-form .el-select'); if(s) s.click(); return 1 })()`)
    await sleep(600)
    await ev(`(() => { const it=[...document.querySelectorAll('.el-select-dropdown__item')].filter(e=>e.offsetParent)
      const t=it.find(i=>i.textContent.indexOf('YINJIA-MES')>=0 && i.textContent.indexOf('测试')<0); if(t) t.click(); return 1 })()`)
    await sleep(400)
    await ev(`(() => { const b=document.querySelector('.login-submit'); if(b) b.click(); return 1 })()`)
    console.log('[login]', (await waitFor(`location.hash.indexOf('/login') < 0`)) ? 'OK' : 'FAIL')

    await ev(`(location.hash='#/panelx/list/RD_APPROVAL','ok')`)
    await sleep(3000)
    // 打开第一行单据
    const opened = await ev(`(() => {
      const row=document.querySelector('.el-table__body-wrapper .el-table__row')
      if (!row) return 'no-row'
      row.click(); return 'ok' })()`)
    console.log('[open]', opened)
    await sleep(2500)
    const steps = await ev(`(() => [...document.querySelectorAll('.as-side-btn')]
      .filter(e => /定级分发|项目定级|分发对接人|对接人签核|确认责任人|责任人确认收到/.test(e.textContent))
      .map(e => ({ text: e.textContent.trim(), disabled: e.classList.contains('disabled'), title: e.getAttribute('title') })))()`)
    console.log('[流程四步]', JSON.stringify(steps, null, 1))
    await ev(`(() => { const s=document.querySelector('.as-side-section'); if (s) s.scrollIntoView({block:'center'}); return 1 })()`)
    await sleep(600)
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
    fs.writeFileSync(path.join(OUT, 'rd-approval-flow-1440.png'), Buffer.from(r.result.data, 'base64'))
    console.log('   截图 rd-approval-flow-1440.png')
    console.log('[console.error]', errs.length ? errs.join('\n') : '(无)')
  } finally {
    if (cdp) cdp.close?.()
    edge.kill()
  }
}

main().catch((e) => { console.error('探针异常:', e); process.exit(1) })
