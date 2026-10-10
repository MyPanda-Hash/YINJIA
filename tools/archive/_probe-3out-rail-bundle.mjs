// 一次性探针(2026-10-15):核对构建产物里三出库面板的左栏「单据选择」配置已生效。
//
// 断言表(2026-10-15 二轮口径):
//   SALE_OUT    = 销售订单号 + 客户 + ERP单派生列(用户:左栏要有销售订单号与 ERP单)
//   MATERIAL_OUT= 生产车间 + ERP单派生列(用户:材料出库页一样要有 ERP单)
//   FINISH_IN   = 加工单号(本轮未动)
// 判定用「该面板配置片段里含该列名」而非整数组精确匹配 —— 压缩后数组里混有派生列对象,整串匹配太脆。
//
// 用法: node tools/archive/_probe-3out-rail-bundle.mjs [chunkPath]
import fs from 'node:fs'

const file = process.argv[2] || 'frontend/dist/assets/PanelxList-CiOCJDYq.js'
const src = fs.readFileSync(file, 'utf8')

const EXPANDED = {
  SALE_OUT: ['销售订单号', '客户', 'ERP单'],
  MATERIAL_OUT: ['生产车间', 'ERP单'],
  FINISH_IN: ['加工单号'],
}

let pass = 0
let total = 0

for (const [code, cols] of Object.entries(EXPANDED)) {
  // 取该面板配置的数组片段(从 `CODE:[` 到配对的 `]`)
  const start = src.indexOf(code + ':[')
  let seg = ''
  if (start >= 0) {
    let depth = 0, end = -1
    for (let i = start + code.length + 1; i < src.length; i++) {
      if (src[i] === '[') depth++
      else if (src[i] === ']') { depth--; if (depth === 0) { end = i; break } }
    }
    if (end > 0) seg = src.slice(start, end + 1)
  }
  for (const col of cols) {
    total++
    const hit = seg.includes(`"${col}"`) || seg.includes(`'${col}'`)
    console.log((hit ? '[PASS] ' : '[FAIL] ') + code + ' -> ' + col)
    if (hit) pass++
  }
}

// 对照:销售订单原配置仍在,且旧的四单未被动过
for (const [code, col] of [['SO_ORDER', '客户'], ['PU_ORDER', '供应商']]) {
  total++
  const re = new RegExp(code + '\\s*:\\s*\\[\\s*["\']' + col + '["\']')
  const hit = re.test(src)
  console.log((hit ? '[PASS] ' : '[FAIL] ') + '(回归) ' + code + ' -> ' + col)
  if (hit) pass++
}

console.log(`\n结果: ${pass}/${total}`)
process.exit(pass === total ? 0 : 1)
