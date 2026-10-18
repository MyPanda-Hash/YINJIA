/**
 * _q-dc-scan-shot.mjs — 扫码枪演示数据活体验证(2026-10-18)
 *
 * 依次打开 数采平台 三页并截图:
 *   /#/dc/config  设备配置管理(看 FX-001 卡片:5 项检查、在线、采集点/规则数)
 *   /#/dc/monitor 数据监控(点开「扫码枪」,看实时值 + 报警)
 *   /#/dc/stats   状态统计(在线率/报警分布)
 * 同时 dump 关键文案,便于和库里数据对账。
 *
 * 用法(仓库根):node tools/archive/_dc-scan-demo-20261018/_q-dc-scan-shot.mjs [http://127.0.0.1:8090]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachCdp } from '../_cdp.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PORT = 9437
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = path.join(__dirname, 'shots')
const ADMIN = { userName: 'admin', password: '123456', factory: 'YINJIA-MES' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-dcscan-'))
  const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
  await sleep(2500)
  let cdp = null
  try {
    const net = []
    const errs = []
    cdp = await attachCdp(PORT, undefined, (m) => {
      if (m.method === 'Network.responseReceived' && /\/api\/dc\//.test(m.params.response.url)) {
        net.push(m.params.response.status + ' ' + new URL(m.params.response.url).pathname + (m.params.response.url.split('?')[1] ? '?' + m.params.response.url.split('?')[1].slice(0, 40) : ''))
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errs.push((m.params.args || []).map((a) => a.value ?? a.description).join(' ').slice(0, 300))
      if (m.method === 'Runtime.exceptionThrown') errs.push('EXC ' + (m.params.exceptionDetails?.exception?.description || '').slice(0, 300))
    })
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable')
    const ev = cdp.ev
    const waitFor = async (expr, ms = 25000) => { for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) } return false }
    const shot = async (name, w = 1440, h = 1000) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false })
      await sleep(700)
      const r = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, fromSurface: true })
      fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.result.data, 'base64'))
      console.log('   截图', name + '.png')
    }

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
    const ok = await waitFor(`location.hash.indexOf('/login') < 0`, 30000)
    console.log('[login]', ok ? 'OK' : 'FAIL')
    if (!ok) process.exit(1)

    // ① 设备配置管理
    await ev(`(location.hash='#/dc/config','ok')`)
    await sleep(3500)
    const devText = await ev(`(() => {
      const all=[...document.querySelectorAll('body *')].filter(e=>e.children.length===0 && /FX-001/.test(e.textContent||''))
      const card=all.map(e=>e.closest('[class*="card"],[class*="dev"]')).filter(Boolean)[0]
      const box=card||document.querySelector('.dc-page')
      return (box?box.innerText:'').replace(/\\n{2,}/g,'\\n').slice(0,900) })()`)
    console.log('\n=== 设备配置 · FX-001 卡片 ===\n' + devText)
    await shot('dc-config-1440')

    // ② 数据监控:选扫码枪
    await ev(`(location.hash='#/dc/monitor','ok')`)
    await sleep(3000)
    const clicked = await ev(`(() => { const d=[...document.querySelectorAll('.dc-dev')].find(e=>/扫码枪/.test(e.innerText)); if(!d) return 'no-dev'; d.click(); return 'ok' })()`)
    await sleep(2500)
    const monText = await ev(`(() => { const m=document.querySelector('.dc-main'); return (m?m.innerText:'').replace(/\\n{2,}/g,'\\n').slice(0,1200) })()`)
    console.log('\n[monitor] 选中扫码枪=' + clicked + '\n=== 数据监控 · 扫码枪 ===\n' + monText)
    await shot('dc-monitor-scan-1440')

    // ③ 状态统计
    await ev(`(location.hash='#/dc/stats','ok')`)
    await sleep(3500)
    const stText = await ev(`(() => { const p=document.querySelector('.dc-page'); return (p?p.innerText:'').replace(/\\n{2,}/g,'\\n').slice(0,1200) })()`)
    console.log('\n=== 状态统计 ===\n' + stText)
    await shot('dc-stats-1440')
    await shot('dc-stats-375', 375, 1400)
    await shot('dc-config-375', 375, 1600)

    console.log('\n=== /api/dc/* ===\n' + net.join('\n'))
    console.log('\n=== console.error ===\n' + (errs.length ? errs.join('\n---\n') : '(无)'))
  } finally {
    if (cdp) cdp.close?.()
    edge.kill()
  }
}

main().catch((e) => { console.error('探针异常:', e); process.exit(1) })
