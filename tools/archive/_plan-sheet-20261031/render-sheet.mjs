/**
 * render-sheet.mjs —— 把「成型车间排单计划」渲染成图片看版式(2026-10-31)
 *
 * 取数:POST /px/scheduleBoard/planSheet(全部产线一张表)
 * 渲染:直接调前端导出的纯函数 schedPlanSheetHtml(与真正出纸的 HTML 完全一致)
 *      写到临时 html → 无头浏览器按 A4 横向尺寸截图
 *
 * 用法: node render-sheet.mjs [base] [outName]
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import path from 'node:path'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const OUT = process.argv[3] || 'sheet.png'

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json()
const token = login?.data?.token
if (!token) { console.log('登录失败'); process.exit(1) }
const res = await (await fetch(BASE + '/api/px/scheduleBoard/planSheet', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ scope: '未完工' }),
})).json()
const d = res?.data || {}
console.log('行数 =', (d['行'] || []).length, '日期列 =', (d['日期'] || []).join(' '), '今天 =', d['今天'])
if (!(d['行'] || []).length) { console.log('无数据'); process.exit(1) }

const { schedPlanSheetHtml } = await import('file:///D:/workspace/yinjia/frontend/src/business/print-formats.js')
const body = schedPlanSheetHtml(d['行'], d['日期'] || [], { today: d['今天'] || '', days: 7 })
const html = '<!doctype html><html><head><meta charset="utf-8"><title>成型车间排单计划</title></head>'
  + '<body style="margin:6mm;background:#fff">' + body + '</body></html>'
const file = path.join(process.cwd(), '_sheet_preview.html')
await fs.writeFile(file, html, 'utf-8')
console.log('[written]', file)

const s = await launch({ port: 9479 })
try {
  // A4 横向 297×210mm ≈ 1123×794px @96dpi;留一点余量看整张
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 860, deviceScaleFactor: 1.4, mobile: false })
  await s.navigate('file:///' + file.replace(/\\/g, '/'))
  await sleep(1200)
  const png = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await fs.writeFile(new URL('./' + OUT, import.meta.url), Buffer.from(png.result.data, 'base64'))
  console.log('[written]', OUT)
} finally {
  try { s.close?.() } catch { /* ignore */ }
  try { await fs.unlink(file) } catch { /* ignore */ }
}
