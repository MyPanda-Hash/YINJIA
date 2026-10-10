// 一次性探针(2026-10-15):核对构建产物里三出库面板的左栏「单据选择」配置已生效。
// 用法: node tools/archive/_probe-3out-rail-bundle.mjs [chunkPath]
import fs from 'node:fs'

const file = process.argv[2] || 'frontend/dist/assets/PanelxList-CdL9WgQE.js'
const src = fs.readFileSync(file, 'utf8')

// DOC_RAIL_PANELS 在产物里被压缩成对象字面量;直接按「面板码:['列']」片段找
const expect = {
  SALE_OUT: '客户',
  MATERIAL_OUT: '生产车间',
  FINISH_IN: '加工单号',
}
let pass = 0
for (const [code, col] of Object.entries(expect)) {
  // 匹配形如 MATERIAL_OUT:["生产车间"] (压缩后可能是单引号/双引号)
  const re = new RegExp(code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:\\s*\\[\\s*["\']' + col + '["\']\\s*\\]')
  const hit = re.test(src)
  console.log((hit ? '[PASS] ' : '[FAIL] ') + code + ' -> ' + col)
  if (hit) pass++
}
// 对照:销售订单原配置仍在,且旧的四单未被动过
for (const [code, col] of [['SO_ORDER', '客户'], ['PU_ORDER', '供应商']]) {
  const re = new RegExp(code + '\\s*:\\s*\\[\\s*["\']' + col + '["\']')
  const hit = re.test(src)
  console.log((hit ? '[PASS] ' : '[FAIL] ') + '(回归) ' + code + ' -> ' + col)
  if (hit) pass++
}
console.log(`\n结果: ${pass}/5`)
process.exit(pass === 5 ? 0 : 1)
