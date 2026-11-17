// 一次性探针:检查指定 i18n 键在 en/ja 里是否重复(本次新增译名防重复)
import { readFileSync } from 'node:fs'

const KEYS = [
  '提交', '无批次', '加入清单', '本次数量', '扫码',
  '匹配到多行,请选择工单行', '扫码失败：', '扫描或输入物料码（存货编码|批号）',
  '退到仓库', '请选择仓库', '没有单据', '点单据进明细页，在那里打印或补打印',
  '扫工单码，或输入工单号/产品名片段查询', '没有找到匹配的工单：换个工单号或产品名的片段试试',
]
const FILES = [
  'D:/YINJIA-main/frontend/src/i18n/locales/en.js',
  'D:/YINJIA-main/frontend/src/i18n/locales/ja.js',
]
let bad = 0
for (const f of FILES) {
  const lines = readFileSync(f, 'utf8').split('\n')
  for (const k of KEYS) {
    const hits = []
    lines.forEach((l, i) => {
      const t = l.trim()
      if (t.startsWith("'" + k + "':") || t.startsWith('"' + k + '":')) hits.push(i + 1)
    })
    if (hits.length > 1) { bad += 1; console.log(f, 'DUP', k, hits.join(',')) }
  }
}
console.log(bad ? 'has duplicates' : 'no duplicates')
