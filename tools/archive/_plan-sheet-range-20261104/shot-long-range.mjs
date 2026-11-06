/**
 * shot-long-range.mjs —— 「日期列很长(23 天)」版式截图(2026-11-04)
 *
 * 用户截图场景:2号车间 3 行、日期 10/29~11/20(23 列) ⇒ 单页横向排不下。
 * 期望:表头**竖排** + 二维码自适应该缩(>22 天 40px) + 日期列 ≥~7mm,数字不再折成竖条。
 *
 * 用法: node shot-long-range.mjs [base]   → shot-long-range-23days.png
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const LINE = process.argv[3] || '2号车间'

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json()
const token = login?.data?.token
if (!token) { console.log('登录失败'); process.exit(1) }
const res = await (await fetch(BASE + '/api/px/scheduleBoard/planSheet', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ scope: '未完工', 生产线: LINE }),
})).json()
const rows = res?.data?.['行'] || []
if (!rows.length) { console.log('无行'); process.exit(1) }

const m = await import('file:///D:/workspace/yinjia/frontend/src/business/print-formats.js')
const dates = m.planSheetWindow('2026-10-29', 23)          // 复刻用户截图的长日期段
// 复刻用户场景:最后一行 11/2~11/20 每天都有量(136/137),让版式接近真实
const rowsX = rows.map((r, i) => {
  if (i !== rows.length - 1) return r
  const plan = {}
  dates.forEach((d, j) => { if (j >= 4) plan[d] = j === 22 ? 136 : 137 })
  return { ...r, 日计划: plan }
})
const html = await m.schedPlanPrintHtml(rowsX, [], { dates })
console.log('行 =', rowsX.length, '日期列 =', dates.length, '(10/29~11/20)')
console.log('竖排表头 =', (html.match(/<th class="v"/g) || []).length, '| 二维码样式 =', (html.match(/td\.qr img\{[^}]*\}/) || [])[0])
console.log('二维码列 =', (html.match(/width:4\.6%/) || ['无'])[0], '| 日期列宽 =', (html.match(/width:2\.\d+%/) || ['无'])[0])

const styleM = html.match(/^(<style>[\s\S]*?<\/style>)/)
const style = styleM ? styleM[1] : ''
const file = '_long_range.html'
await fs.writeFile(file, '<!doctype html><html><head><meta charset="utf-8"><title>成型车间排单计划</title>' + style
  + '</head><body style="margin:6mm;background:#fff">' + html.slice(style.length) + '</body></html>', 'utf-8')

const s = await launch({ port: 9487 })
try {
  await s.send('Emulation.setEmulatedMedia', { media: 'print' })
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1123, height: 794, deviceScaleFactor: 2, mobile: false })
  await s.navigate('file:///' + (process.cwd() + '\\' + file).replace(/\\/g, '/'))
  await sleep(900)
  const png = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await fs.writeFile('shot-long-range-23days.png', Buffer.from(png.result.data, 'base64'))
  console.log('[written] shot-long-range-23days.png')
  await fs.unlink(file).catch(() => {})
} finally { try { s.close?.() } catch { /* ignore */ } }
