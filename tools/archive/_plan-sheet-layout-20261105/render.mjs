/**
 * render.mjs —— 排单计划纸表版式取景(2026-11-05,只读探针)
 *
 * 用户口径:「当前这个报表已经调整不需要实现那么多天数,可以调整优化一下当前的这个表格和设计,
 *   不需要那么窄,看着很丑」—— 本脚本用**用户截图里的那三行真数据**渲染 schedPlanSheetHtml,
 * 与真实出纸的 HTML 完全一致(纯函数),再按 A4 横向尺寸截图,用来对比改版前后版式。
 *
 * 用法: node render.mjs [out.png] [days]
 *   days = 日期列个数(2/3/4/10),默认 3(2026-11-05 起排单计划默认只印 3 天)
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire('D:/workspace/yinjia/tools/archive/')
const { launch, sleep } = require('./_cdpclient.cjs')

const OUT = process.argv[2] || 'after-3days.png'
const DAYS = Number(process.argv[3] || 3)

const { schedPlanSheetHtml, planSheetWindow } = await import(
  'file:///D:/workspace/yinjia/frontend/src/business/print-formats.js')

// ── 用户截图(2026-11-05 11:xx)里的三行真数据,字段与 /px/scheduleBoard/planSheet 返回同构 ──
const ROWS = [
  {
    客户等级: '', 客户: '广州佳贝尔环保有限公司', 加工单号: 'GD-2026-10-0227', 工单行号: 1,
    公司代码: '0', 物料编码: 'B-58-07', 规格型号: '48*30*264.5', 生产线: '2号车间',
    未交量: 6000, 排产数量: 6000, 当前工序完工量: 0, 交期: '2026-10-31', 交期紧迫度: -5,
    '7天已排': 6000, '15天已排': 6000, '大于15天已排': 0,
    日计划: { '2026-11-05': 6000, '2026-11-06': 0, '2026-11-07': 0 },
  },
  {
    客户等级: '', 客户: '广东一米环境科技有限公司', 加工单号: 'GD-2026-10-0228', 工单行号: 1,
    公司代码: '0', 物料编码: 'B-46-07', 规格型号: '60*45*231', 生产线: '2号车间',
    未交量: 2000, 排产数量: 2000, 当前工序完工量: 300, 交期: '2026-11-07', 交期紧迫度: 2,
    '7天已排': 1700, '15天已排': 1700, '大于15天已排': 0,
    日计划: { '2026-11-05': 567, '2026-11-06': 567, '2026-11-07': 566 },
  },
  {
    客户等级: '', 客户: '青岛伊可普电器有限公司', 加工单号: 'GD-2026-10-0229', 工单行号: 1,
    公司代码: '0', 物料编码: 'C-95-12', 规格型号: '45*21*256.5', 生产线: '2号车间',
    未交量: 3000, 排产数量: 3000, 当前工序完工量: 0, 交期: '2026-11-15', 交期紧迫度: 10,
    '7天已排': 2184, '15天已排': 3000, '大于15天已排': 0,
    日计划: { '2026-11-05': 273, '2026-11-06': 273, '2026-11-07': 273 },
  },
]

const dates = planSheetWindow('2026-11-05', DAYS)
const body = await schedPlanSheetHtml(ROWS, dates, { today: '2026-11-05', shop: '成型', dates })
const html = '<!doctype html><html><head><meta charset="utf-8"><title>成型车间排单计划</title></head>'
  + '<body style="margin:6mm;background:#fff">' + body + '</body></html>'
const file = path.join(HERE, '_preview.html')
await fs.writeFile(file, html, 'utf-8')
console.log('[written]', file, '日期列 =', dates.join(' '))

const s = await launch({ port: 9491 })
try {
  // A4 横向 @96dpi = 1123×794;整页高度放宽以便 captureBeyondViewport 抓到多行
  await s.send('Emulation.setDeviceMetricsOverride', { width: 1123, height: 900, deviceScaleFactor: 2, mobile: false })
  await s.navigate('file:///' + file.replace(/\\/g, '/'))
  await sleep(1200)
  const png = await s.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await fs.writeFile(path.join(HERE, OUT), Buffer.from(png.result.data, 'base64'))
  console.log('[written]', OUT)
} finally {
  try { s.close?.() } catch { /* ignore */ }
  try { await fs.unlink(file) } catch { /* ignore */ }
}
