/**
 * shot-paged-preview.mjs —— A4 横向「日期列太多 ⇒ 自动拆页」的效果截图(2026-11-04)
 *
 * 用户口径:「纸肯定是 A4 的」⇒ 日期列放不下一页就横向拆页(每页重复固定列+二维码,页眉标页码/区间)。
 *
 * 做法:取 /planSheet(1号机 2 行 × 16 天) → schedPlanPrintHtml → 按 <div class="pg"> 拆成各页 →
 *       每页单独以「打印媒体 + A4 横向」截图;同时用 CDP printToPDF 数一下真实打印页数。
 *
 * 用法: node shot-paged-preview.mjs [base]
 * 产物: shot-paged-1hao-p1.png / shot-paged-1hao-p2.png
 */
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const LINE = process.argv[3] || '1号机'

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
const d = res?.data || {}
const rows = d['行'] || []
if (!rows.length) { console.log('无行'); process.exit(1) }

const m = await import('file:///D:/workspace/yinjia/frontend/src/business/print-formats.js')
const dates = m.planSheetDatesFromRows(rows, d['今天'] || '', 5)
const html = await m.schedPlanPrintHtml(rows, d['日期'] || [], { today: d['今天'] || '', dates })
console.log(`产线=${LINE} 行=${rows.length} 日期列=${dates.length}(${dates[0]}~${dates.at(-1)})`)

const styleM = html.match(/^(<style>[\s\S]*?<\/style>)/)
const style = styleM ? styleM[1] : ''
const body = html.slice(style.length)
const pages = body.split('<div class="pg">').slice(1).map((x) => '<div class="pg">' + x)
console.log('拆页数 =', pages.length, '| 每页日期列 =', pages.map((p) => (p.match(/title="\d{4}-\d{2}-\d{2}"/g) || []).length).join(' + '))
const pageInfo = pages.map((p) => (p.match(/第 \d+\/\d+ 页 · [^<]*/) || [''])[0])
console.log('页眉 =', JSON.stringify(pageInfo))

const s = await launch({ port: 9485 })
try {
  const pageHtml = (pageBody) => '<!doctype html><html><head><meta charset="utf-8"><title>成型车间排单计划</title>' + style
    + '</head><body style="margin:6mm;background:#fff">' + pageBody + '</body></html>'
  for (let i = 0; i < pages.length; i++) {
    const file = `_paged_${i + 1}.html`
    await fs.writeFile(file, pageHtml(pages[i]), 'utf-8')
    await s.send('Emulation.setEmulatedMedia', { media: 'print' })
    await s.send('Emulation.setDeviceMetricsOverride', { width: 1123, height: 794, deviceScaleFactor: 2, mobile: false })
    await s.navigate('file:///' + (process.cwd() + '\\' + file).replace(/\\/g, '/'))
    await sleep(900)
    const png = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    await fs.writeFile(`shot-paged-1hao-p${i + 1}.png`, Buffer.from(png.result.data, 'base64'))
    console.log('[written]', `shot-paged-1hao-p${i + 1}.png`)
    await fs.unlink(file).catch(() => {})
  }

  // 真实打印页数(printToPDF 数 /Type /Page)
  const full = '<!doctype html><html><head><meta charset="utf-8"><title>x</title>' + style
    + '</head><body style="margin:6mm;background:#fff">' + body + '</body></html>'
  await fs.writeFile('_paged_full.html', full, 'utf-8')
  await s.navigate('file:///' + (process.cwd() + '\\_paged_full.html').replace(/\\/g, '/'))
  await sleep(800)
  const pdf = await s.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true })
  const buf = Buffer.from(pdf.result.data, 'base64')
  const cnt = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
  console.log('printToPDF 页数 =', cnt, '(期望 =', pages.length + ')')
  await fs.unlink('_paged_full.html').catch(() => {})
  console.log('DONE')
} finally {
  try { s.close?.() } catch { /* ignore */ }
}
