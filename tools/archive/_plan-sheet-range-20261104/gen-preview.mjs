/**
 * gen-preview.mjs —— 生成排单计划出纸预览 HTML + 列宽指标(2026-11-04)
 * 用法: node gen-preview.mjs [base] [产线] [工单号,逗号分隔] [输出html]
 * 说明:无头浏览器在 DSH 沙箱里起不来(mojo/命名管道被拒),所以这里只产出与出纸**逐字一致**的
 *       HTML,用浏览器打开即可看版式;真正的 window.print 效果与它相同。
 */
import fs from 'node:fs/promises'

const BASE = process.argv[2] || 'http://127.0.0.1:8091'
const LINE = process.argv[3] || '2号车间'
const WANT = (process.argv[4] || '').split(',').filter(Boolean)
const OUT = process.argv[5] || 'preview.html'

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
const all = d['行'] || []
const rows = WANT.length ? all.filter((r) => WANT.includes(String(r['加工单号']))) : all
if (!rows.length) { console.log('无行'); process.exit(1) }

const m = await import('file:///D:/workspace/yinjia/frontend/src/business/print-formats.js')
const dates = m.planSheetDatesFromRows(rows, d['今天'] || '', 5)
const body = await m.schedPlanPrintHtml(rows, d['日期'] || [], { today: d['今天'] || '', dates })
const html = '<!doctype html><html><head><meta charset="utf-8"><title>成型车间排单计划</title></head>'
  + '<body style="margin:6mm;background:#fff">' + body + '</body></html>'
await fs.writeFile(OUT, html, 'utf-8')

const n = dates.length
const compact = n > 7
const scale = compact ? Math.max(0.52, 1 - (n - 7) * 0.035) : 1
const qr = compact ? 4 : 5
const base = 73 * scale
const dw = n ? Math.max(compact ? 2 : 4, (100 - base - qr) / n) : 0
const usable = 285 // A4 横向 297 - 左右各 6mm 边距
console.log(`[written] ${OUT}`)
console.log(`产线=${LINE} 出纸行=${rows.length} 日期列=${n} => ${dates.join(' ')}`)
console.log(`compact=${compact} fixedScale=${scale.toFixed(3)} 固定列=${base.toFixed(1)}% 二维码=${qr}%`)
console.log(`日期列宽=${dw.toFixed(2)}% ≈ ${(usable * dw / 100).toFixed(1)}mm/列;表头=${compact ? 'M/D 7.5px' : 'M月D日 9px'}`)
