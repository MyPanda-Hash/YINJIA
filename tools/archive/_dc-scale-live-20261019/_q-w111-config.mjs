/**
 * _q-w111-config.mjs — 读 W111 模块「系统 / 端口1」当前配置(2026-10-19)
 *
 * 目的:秤的串口字节到了模块却没转发出来,先确认模块侧串口参数(波特率/数据位/校验)、
 *       传输模式(TCP 服务端/客户端/HTTP/MQTT)、目标地址是否与 MES 侧一致。
 * 用法:node tools/archive/_dc-scale-live-20261019/_q-w111-config.mjs [http://192.168.23.120]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { attachCdp } from '../_cdp.mjs'

const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://192.168.23.120').replace(/\/$/, '')
const PORT = 9463
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'yj-w111-'))
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
await sleep(2500)
const cdp = await attachCdp(PORT)
await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable')
const ev = cdp.ev
const waitFor = async (expr, ms = 20000) => { for (let i = 0; i < ms / 250; i++) { if (await ev(expr)) return true; await sleep(250) } return false }
try {
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false })
  await cdp.send('Page.navigate', { url: BASE + '/' })
  await waitFor(`document.body && document.body.innerText.length > 0`)
  await sleep(1500)
  console.log('[page]', (await ev(`document.body.innerText.replace(/\\s+/g,' ').slice(0,300)`)))

  const inputs = await ev(`JSON.stringify([...document.querySelectorAll('input,select')].slice(0,40).map(e => ({
    tag: e.tagName.toLowerCase(), type: e.type, name: e.name || e.id || '',
    value: e.type === 'password' ? '***' : (e.value || e.textContent || ''),
    checked: e.type === 'radio' || e.type === 'checkbox' ? e.checked : undefined,
  })))`)
  console.log('[输入项]', inputs)

  // 试着进入「端口1」
  const clicked = await ev(`(() => {
    const t = [...document.querySelectorAll('a,div,span,li')].find(e => (e.textContent || '').trim() === '端口1')
    if (!t) return 'no-tab'
    t.click(); return 'ok'
  })()`)
  await sleep(1500)
  console.log('[端口1 页签]', clicked)
  console.log('[端口1 输入项]', await ev(`JSON.stringify([...document.querySelectorAll('input,select')].slice(0,40).map(e => ({
    type: e.type, name: e.name || e.id || '', value: e.type === 'password' ? '***' : (e.value || ''), checked: (e.type === 'radio' || e.type === 'checkbox') ? e.checked : undefined,
  })))`))
  console.log('[端口1 文案]', await ev(`document.body.innerText.replace(/\\s+/g,' ').slice(0,500)`))
} finally {
  cdp.close?.()
  edge.kill()
}
