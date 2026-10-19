/**
 * _q-inspfreq-shot.mjs — 出货检验计划表「检查频率」下拉+标准库维护 活体验证(2026-10-19)
 *
 * 打开 出货检验计划表 第一张单,进入明细编辑态:
 *   ① 检查列表头有 ⌄ 维护入口;
 *   ② 检查频率单元格是下拉(el-select),候选来自 yj_std_lib.INSP_FREQ(每批次 / 型式检验 …);
 *   ③ 截图留证。
 *
 * 用法:node tools/archive/_insp-freq-20261019/_q-inspfreq-shot.mjs [http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9447
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, 'shots')
const ADMIN = { userName: 'admin', password: '123456', factory: 'YINJIA-MES' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-inspfreq-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  let cdp = null
  try {
    const errs = []
    const net = []
    cdp = await attachCdp(PORT, undefined, (m) => {
      if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails?.exception?.description || '').slice(0, 200))
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push((m.params.args || []).map((a) => a.value ?? a.description).join(' ').slice(0, 200))
      if (m.method === 'Network.responseReceived' && /stdlib/.test(m.params.response.url)) net.push(m.params.response.status + ' ' + new URL(m.params.response.url).pathname)
    })
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable')
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

    await ev(`(location.hash='#/panelx/list/RD_INSP_PLAN','ok')`)
    await sleep(3500)
    const opened = await ev(`(() => { const r=document.querySelector('.el-table__body-wrapper .el-table__row'); if(!r) return 'no-row'; r.click(); return 'ok' })()`)
    console.log('[open]', opened)
    await sleep(2500)

    const info = await ev(`(() => {
      const picks = [...document.querySelectorAll('.rs-lib-pick')].map(e => e.textContent.trim())
      const selects = [...document.querySelectorAll('.rs-gd, .rs-td')].map(td => {
        const s = td.querySelector('.el-select')
        return s ? (td.getAttribute('data-key') || td.className) : null
      }).filter(Boolean)
      return JSON.stringify({ picks, selectCells: selects.length })
    })()`)
    console.log('[列头⌄]', info)

    // 点开第一行「检查频率」的下拉,读候选
    const cell = await ev(`(() => {
      const th = [...document.querySelectorAll('th')].find(e => e.textContent.indexOf('检查频率') >= 0)
      if (!th) return 'no-th'
      th.scrollIntoView({ block: 'center' })
      const idx = [...th.parentElement.children].indexOf(th)
      const tr = document.querySelectorAll('.rs-gd + tr, .rs-gd, table tbody tr')
      // 找表格里第 idx 列的 el-select
      const rows = [...document.querySelectorAll('tr')].filter(r => r.querySelector('.el-select'))
      for (const r of rows) {
        const tds = [...r.children]
        const td = tds[idx] || tds[tds.length - 1]
        const s = td && td.querySelector('.el-select')
        if (s) { s.querySelector('.el-select__wrapper')?.click(); return 'clicked' }
      }
      return 'no-select'
    })()`)
    console.log('[点开下拉]', cell)
    await sleep(900)
    const opts = await ev(`JSON.stringify([...document.querySelectorAll('.el-select-dropdown__item')].filter(e=>e.offsetParent).map(e=>e.textContent.trim()).slice(0,12))`)
    console.log('[候选]', opts)

    const r = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
    fs.writeFileSync(path.join(OUT, 'insp-plan-freq-1440.png'), Buffer.from(r.result.data, 'base64'))
    console.log('   截图 insp-plan-freq-1440.png')
    console.log('[stdlib 请求]', net.join(' | ') || '(无)')
    console.log('[console.error]', errs.length ? errs.join('\n') : '(无)')
  } finally {
    if (cdp) cdp.close?.()
    edge.kill()
  }
}

main().catch((e) => { console.error('探针异常:', e); process.exit(1) })
