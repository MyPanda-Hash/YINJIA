/**
 * render-range-sheet.mjs —— 渲染「勾选行 最前日期→最后日期」实际会打出去的排单计划(2026-11-04)
 *
 * 与页面同一条链路:POST /px/scheduleBoard/planSheet 取数 → 按勾选行过滤 →
 * planSheetDatesFromRows 算日期列 → schedPlanPrintHtml → A4 横向截图,肉眼确认版式。
 *
 * 用法: node render-range-sheet.mjs [base] [outName] [产线] [要勾的工单号,逗号分隔]
 * 例:   node render-range-sheet.mjs http://127.0.0.1:8091 range-2.png 2号车间 GD-2026-10-0227,GD-2026-10-0228,GD-2026-10-0229,GD-2026-11-0008
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import path from 'node:path'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8091'
const OUT = process.argv[3] || 'range-sheet.png'
const LINE = process.argv[4] || ''
const WANT = (process.argv[5] || '').split(',').filter(Boolean)

const login = await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
})).json()
const token = login?.data?.token
if (!token) { console.log('登录失败'); process.exit(1) }
const res = await (await fetch(BASE + '/api/px/scheduleBoard/planSheet', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify({ scope: '未完工', ...(LINE ? { 生产线: LINE } : {}) }),
})).json()
const d = res?.data || {}
const all = d['行'] || []
const rows = WANT.length ? all.filter((r) => WANT.includes(String(r['加工单号']))) : all
console.log('产线 =', LINE || '(全部)', '| 该线行数 =', all.length, '| 勾选/出纸行数 =', rows.length)
if (!rows.length) { console.log('无行'); process.exit(1) }

const { schedPlanPrintHtml, planSheetDatesFromRows } = await import('file:///D:/workspace/yinjia/frontend/src/business/print-formats.js')
const dates = planSheetDatesFromRows(rows, d['今天'] || '', 5)
console.log('日期列(' + dates.length + ') =', dates.join(' '))
const body = await schedPlanPrintHtml(rows, d['日期'] || [], { today: d['今天'] || '', dates })
const html = '<!doctype html><html><head><meta charset="utf-8"><title>成型车间排单计划</title></head>'
  + '<body style="margin:6mm;background:#fff">' + body + '</body></html>'
const file = path.join(process.cwd(), '_sheet_range_preview.html')
await fs.writeFile(file, html, 'utf-8')

const s = await launch({ port: 9477 })
try {
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 900, deviceScaleFactor: 1.4, mobile: false })
  await s.navigate('file:///' + file.replace(/\\/g, '/'))
  await sleep(1500)
  const png = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await fs.writeFile(new URL('./' + OUT, import.meta.url), Buffer.from(png.result.data, 'base64'))
  console.log('[written]', OUT)
} finally {
  try { s.close?.() } catch { /* ignore */ }
  try { await fs.unlink(file) } catch { /* ignore */ }
}
