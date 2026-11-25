// 复现:分批送料对话框打开后的默认态(纯前端口径,数据取自生产 /px/batchFlow/lines 实测快照)
import { defaultPickKeys, buildBatchSendLines, sumPickedQty, overAllowance } from 'file:///D:/YINJIA-main/frontend/src/core/selection/batchSendLines.js'

const lines = [
  { lineKey: 'YJ-20260921-10#5537', 数量: 35000, 已送数量: 35000, 已退回数量: 0, 剩余数量: 0, 可送上限: 17500, 小数位数: 0 },
  { lineKey: 'YJ-20260921-10#5538', 数量: 35000, 已送数量: 39000, 已退回数量: 0, 剩余数量: 0, 可送上限: 13500, 小数位数: 0 },
  { lineKey: 'YJ-20260921-10#5539', 数量: 5000,  已送数量: 5000,  已退回数量: 0, 剩余数量: 0, 可送上限: 2500,  小数位数: 0 },
]

// BatchSendDialog.load(): qtyOf[lineKey] = 剩余数量 > 0 ? 剩余数量 : 0
const qtyOf = {}
for (const r of lines) qtyOf[r.lineKey] = Number(r.剩余数量) > 0 ? Number(r.剩余数量) : 0

// 打开时默认勾选 = defaultPickKeys(rows)
const pickKeys = defaultPickKeys(lines)

console.log('打开对话框后:')
console.log('  本次送料数量 =', JSON.stringify(qtyOf))
console.log('  默认勾选行数 =', pickKeys.length)
console.log('  已选合计     =', sumPickedQty(lines, new Set(pickKeys), qtyOf))
console.log('  confirm() 会提交的 lines =', JSON.stringify(buildBatchSendLines(lines, new Set(pickKeys), qtyOf)))
console.log('  ⇒ lines.length =', buildBatchSendLines(lines, new Set(pickKeys), qtyOf).length,
  '⇒ confirm() 走 `if (!lines.length)` 分支,弹「请至少勾选一行并填写本次送料数量」,不发请求、不生成单据')

// 若「按剩余量填充」:
const qty2 = {}
for (const r of lines) qty2[r.lineKey] = Number(r.剩余数量) > 0 ? Number(r.剩余数量) : 0
console.log('按剩余量填充后:勾选行数 =', defaultPickKeys(lines).length, '合计 =', sumPickedQty(lines, new Set(defaultPickKeys(lines)), qty2))

// 手工勾行 + 按超送额填量(唯一还能生单的走法)
const picks = new Set(['YJ-20260921-10#5537'])
const qty3 = { 'YJ-20260921-10#5537': 17500 }
console.log('手工勾第1行填 17500:', JSON.stringify(buildBatchSendLines(lines, picks, qty3)),
  '上限复核 =', overAllowance(35000, 35000, 0, 50, 0), '| 第2行上限 =', overAllowance(35000, 39000, 0, 50, 0), '| 第3行上限 =', overAllowance(5000, 5000, 0, 50, 0))
