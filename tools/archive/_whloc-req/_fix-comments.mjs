// 修掉批量替换留下的语义坏注释(「库位→库位」等)—— 补上「上午改仓位、下午改回库位」的沿革
import fs from 'node:fs'
const fix = [
  ['frontend/src/business/menus.js',
    '// 库位(2026-09-28 建为「库位」,2026-10-08 正名「库位」对齐金蝶):仓库下货位档案,一仓多库位、一库位一仓;',
    '// 库位(2026-09-28 建为「库位」;2026-10-08 上午曾正名为「仓位」对齐金蝶,同日下午按用户口径改回「库位」):一仓多库位、一库位一仓;'],
  ['frontend/src/business/print-formats.js',
    ' * 库位标识卡(WHLOC 库位档案「二维码标签」勾选即打,2026-09-28;2026-10-08 库位→库位术语统一)',
    ' * 库位标识卡(WHLOC 库位档案「二维码标签」勾选即打,2026-09-28;2026-10-08 上午曾随术语统一改名,同日下午按用户口径改回「库位」)'],
  ['frontend/src/business/print-formats.test.js',
    ' *  ⑤ 库位标识卡(printLocationCards;2026-09-28 建为库位卡,2026-10-08 库位→库位术语统一):',
    ' *  ⑤ 库位标识卡(printLocationCards;2026-09-28 建为库位卡;2026-10-08 术语来回后定为「库位」):'],
  ['frontend/src/business/print-formats.test.js',
    '// ═══ 库位标识卡(WHLOC 库位档案「二维码标签」,2026-09-28 建为库位卡,2026-10-08 库位→库位):同款 75×100mm,卡面只放库位字段 ═══',
    '// ═══ 库位标识卡(WHLOC 库位档案「二维码标签」,2026-09-28 建为库位卡;2026-10-08 术语来回后定为「库位」):同款 75×100mm,卡面只放库位字段 ═══'],
  ['frontend/src/core/views/PanelxList.vue',
    '// 同码行勾一个即代表该码;WHLOC 库位(2026-09-28;2026-10-08 库位→库位)另带 qrLabelScopeKey=仓库 ⇒ 行键=仓库+库位编码 复合',
    '// 同码行勾一个即代表该码;WHLOC 库位(2026-09-28;2026-10-08 术语来回后定为「库位」)另带 qrLabelScopeKey=仓库 ⇒ 行键=仓库+库位编码 复合'],
  ['frontend/src/core/views/PanelxList.vue',
    '    // WHLOC 库位(2026-09-28;2026-10-08 库位→库位术语统一):同款勾选即打,',
    '    // WHLOC 库位(2026-09-28;2026-10-08 术语来回后定为「库位」):同款勾选即打,'],
]
let ok = 0
for (const [rel, from, to] of fix) {
  const abs = 'D:/workspace/yinjia/' + rel
  const t = fs.readFileSync(abs, 'utf8')
  if (!t.includes(from)) { console.log(`  ⚠ 未命中 ${rel}: ${from.slice(0, 40)}...`); continue }
  fs.writeFileSync(abs, t.replace(from, to), 'utf8')
  console.log(`  ✓ ${rel}`)
  ok++
}
console.log(`修好 ${ok}/${fix.length} 处`)
