/**
 * recordSheetConfigs.filtervals.test.js —— 分区表(filterKey/filterVal)通用不变量(2026-09-21)
 *
 * 为什么单独一条:2026-09-21 产品文件全流程走查踩到一个**静默**坑 ——
 * 按"页面名"给行写 `表区='成型配方'`,而行表的分区列被各表按 `filterVal` 过滤
 * (配方表认的是 `'配方表'`),于是**行确实入库了,但界面上任何一张表都不显示它**。
 * 已有测试只对 成型/组装 两个面板各自写了 filterVal 唯一性断言(见 recordSheetConfigs.keys.test.js),
 * 本文件把口径推广成**全面板通用**不变量,并补一条以前没人查的:
 *   分区键(filterKey)必须是该面板**登记过的 yj_field label** —— 否则那一格写不回库/读不回来
 *   (label 集合来自离线基线 rdPanelLabels.fixture.json,CI 无库也能跑)。
 * ⚠ 曾想把"分区列要出现在 cols 里"也做成不变量,实测**是误报**:新增行由 addRow 盖 `row[filterKey]=filterVal`
 *   戳(RecordSheetPanels.vue),既有行从库里带值,往返走 yj_field 定义而不是 cols ⇒ 配方表 cols 里没有 表区
 *   也完全正常。真正会出事的是"脚本/接口按**页面名**硬编码表区值"(见下一条测试)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const FIXTURE = JSON.parse(
  readFileSync(new URL('./rdPanelLabels.fixture.json', import.meta.url), 'utf8'),
)

test('分区表不变量:filterKey 合法、filterVal 齐且不重复', () => {
  const problems = []
  for (const [panel, cfg] of Object.entries(recordSheetConfigs)) {
    const seen = new Map()          // filterVal → 表名(查重)
    const labels = new Set(FIXTURE[panel]?.labels || [])
    for (const dt of cfg.dataTables || []) {
      const name = dt.bar || dt.pageTitle || `${panel} 第${(dt.page ?? 0) + 1} 页的表`
      const hasPartition = dt.filterKey !== undefined || dt.filterVal !== undefined
      if (!hasPartition) continue
      // ① 分区键口径:全库只有 表区 一种物理分块列(见 CONTEXT「表区是物理列而非内存标记」)
      if (dt.filterKey !== '表区') problems.push(`${panel}「${name}」filterKey=${JSON.stringify(dt.filterKey)}(约定只有 表区)`)
      // ② 分区值必须写、且同面板内唯一(两张表共用一个值 = 同一批行显示两遍还互相覆盖)
      if (!dt.filterVal) problems.push(`${panel}「${name}」缺 filterVal`)
      else if (seen.has(dt.filterVal)) problems.push(`${panel}「${name}」filterVal='${dt.filterVal}' 与「${seen.get(dt.filterVal)}」重复`)
      else seen.set(dt.filterVal, name)
      // ③ 分区键必须是该面板登记过的字段 label(否则写不回库 —— 行会掉进"没有表认领"的桶)
      if (labels.size && dt.filterKey && !labels.has(dt.filterKey))
        problems.push(`${panel}「${name}」filterKey='${dt.filterKey}' 不是该面板的 yj_field label(写不回库)`)
    }
  }
  assert.deepEqual(problems, [], '\n' + problems.join('\n'))
})

/**
 * 走查踩坑固化(2026-09-21):分区值是 **filterVal**,不是页面名/BAR 名 ——
 * 按页面名硬编码写行(如给成型配方页写 表区='成型配方')会造出"没有表认领"的行:**入了库但界面上永不显示**。
 * 这条测试把"表名 → 该用的值"钉死,脚本/探针要写行就从这张表取值,别再按页面名猜。
 */
test('表名 → 表区值(filterVal)对照固化:脚本写行必须用右边这个值', () => {
  const mapOf = (panel) => Object.fromEntries((recordSheetConfigs[panel]?.dataTables || [])
    .filter((dt) => dt.filterVal)
    .map((dt) => [dt.bar || dt.pageTitle || `page${dt.page ?? 0}`, dt.filterVal]))
  assert.deepEqual(mapOf('RD_MOLD_PROC'), {
    修订记录: '修订记录',
    // 注意:这张表的 bar 就叫「配方表」,它的表区值也是「配方表」;页签名叫「成型配方」——
    // 写行时不能用页签名(踩过:写了 '成型配方' ⇒ 行入库但两张表都不显示)
    配方表: '配方表',
  })
  assert.deepEqual(mapOf('RD_ASM_PROC'), {
    修订记录: '修订记录',
    // 这张表 bar 叫「BOM表」、页签叫「组装BOM表」,而表区值是「物料清单」—— 三者都不同名
    BOM表: '物料清单',
    关键控制清单: '关键控制清单',
  })
})

