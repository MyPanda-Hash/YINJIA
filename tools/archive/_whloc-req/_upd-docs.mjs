// 更新当前态文档(库位改回):数据库表清单 bs_wh_loc 行 + 追加 v3.7 记录;库存表清单 bs_wh_loc 行
// 历史记录 v3.3~v3.6 与冻结基线《采购链四单…》不动。
import fs from 'node:fs'

function edit(rel, pairs) {
  const abs = 'D:/workspace/yinjia/' + rel
  let t = fs.readFileSync(abs, 'utf8')
  for (const [from, to] of pairs) {
    if (!t.includes(from)) { console.log(`  ⚠ 未命中 ${rel}: ${from.slice(0, 50)}…`); continue }
    t = t.replace(from, to)
    console.log(`  ✓ ${rel}`)
  }
  fs.writeFileSync(abs, t, 'utf8')
}

edit('docs/development/数据库表清单.md', [
  ['| `bs_wh_loc` | 仓位档案(仓库内货位主数据:仓库/仓库编码/仓位编码/仓位地址;',
   '| `bs_wh_loc` | 库位档案(仓库内货位主数据:仓库/仓库编码/库位编码/库位地址;'],
  ['一仓多仓位、一仓位一仓,仓库列存仓库名称、仓库编码选仓库时参照带回自 bs_wh;仓位二维码标签内容=仓库编码@仓位地址@仓位编码;',
   '一仓多库位、一库位一仓,仓库列存仓库名称、仓库编码选仓库时参照带回自 bs_wh;库位二维码标签内容=仓库编码@库位地址@库位编码;'],
  ['**2026-10-08 三次演进:① 库位→仓位术语统一(migrate-whloc-rename-bin)② 区码与存储分区解耦 + 清试录垃圾(clean-coord)③ 加 `大区` 并按「厂区>仓>大区>分区」重构、`厂区` 列移回仓库表(zone-logic)**) | 38 | WHLOC（仓位） |',
   '**2026-10-08 四次演进:① 库位→仓位术语统一(rename-bin)② 区码与存储分区解耦 + 清试录垃圾(clean-coord)③ 加 `大区` 并按「厂区>仓>大区>分区」重构、`厂区` 列移回仓库表(zone-logic)④ **术语改回「库位」**(rename-back-loc)**) | 38 | WHLOC（库位） |'],
])

edit('docs/development/库存表清单.md', [
  ['| `bs_wh_loc` | 仓位档案（正式 5 行） | 仓库内货位。**库存链路零引用**，尚未启用。2026-10-08 由「库位档案」正名为「仓位档案」（对齐金蝶 sp_number/sp_name） |',
   '| `bs_wh_loc` | 库位档案（正式 679 行） | 仓库内货位。**库存链路零引用**，尚未启用。2026-10-08 上午曾正名为「仓位档案」（对齐金蝶 sp_number/sp_name），同日下午按用户口径改回「库位档案」（`migrate-whloc-rename-back-loc-20261008.sql`） |'],
])
console.log('done')
