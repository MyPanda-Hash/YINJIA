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
test('同面板内只要有一张表带 filterKey，**所有**表都必须带（否则不带的会显示全部行）', () => {
  // ⚠ 2026-11-11 实测踩过：给 RD_INSP_PLAN 加了「修订记录」页并预铺 18 行空行后，
  //   「检验项目」表（当时没有 filterVal）把 18 行全显示了出来 —— 序号 1..18 出现在检验项目页，
  //   而这两张表共用 rd_insp_plan_detail 一张行表。
  //   本条的判据：**共用行表 + 有一张分块，则所有表都要分块**。
  //   rowsOf(dt) 对不带 filterKey 的表返回**全部 items**，它会把别的表的行也算进来。
  const problems = []
  for (const [panel, cfg] of Object.entries(recordSheetConfigs)) {
    const dts = cfg.dataTables || []
    if (dts.length < 2) continue
    const partitioned = dts.filter((d) => d.filterKey)
    if (!partitioned.length) continue
    for (const dt of dts) {
      if (dt.filterKey) continue
      const name = dt.bar || dt.pageTitle || `第${(dt.page ?? 0) + 1} 页的表`
      problems.push(`${panel}「${name}」没有 filterKey，而同面板的「${partitioned[0].bar || partitioned[0].pageTitle}」有 `
        + '⇒ 它会把别的表的行也显示出来（共用一张行表）')
    }
  }
  assert.deepEqual(problems, [], '\n' + problems.join('\n'))
})

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

/**
 * 2026-10-27 用户口径(1027系统使用-产品工艺文件问题点待改善 #8):
 *   「炭棒配方管控清单页面:配方表默认填充 10 行表格」,用户另确认「没有的留空就行」。
 *
 * 这条断言守三件**改错了也不会报错**的事:
 *   ① blankRows 必须挂在**配方表**这张 dt 上(挂错表 = 铺到修订记录页去);
 *   ② 只能**有它一张**表带 blankRows(同面板修订记录表与它共用行表,多挂一张就多铺一份);
 *   ③ 值必须正好 10(用户口径的确定数字,不是"随便给几行")。
 */
test('#8 配方表默认铺 10 行空行,且只有配方表这一张表带 blankRows', () => {
  const cfg = recordSheetConfigs.RD_MOLD_PROC
  const dts = cfg.dataTables || []
  const formula = dts.find((d) => d.filterVal === '配方表')
  assert.ok(formula, 'RD_MOLD_PROC 缺配方表')
  assert.equal(Number(formula.blankRows), 10, '配方表应 blankRows:10(用户口径的确定数字)')

  // ⚠ 2026-11-11 用户口径变更:「所有的修订记录 tap 页都要预先设置符合 A4 打印的行数」——
  //   修订记录表现在**也**要带 blankRows。原断言"只有配方表能带"的依据是
  //   「多挂一张会把空行铺到修订记录页」,而那个前提只在不带分块键时成立:
  //   实测 RecordSheetPanels 的铺设逻辑是
  //     ① 每张 dt 用**自己的** filterVal 给行打标（row[filterKey] = dt.filterVal）;
  //     ② 记账键 `${单据号}::${filterKey}::${filterVal}` ⇒ 每张表独立记账、独立铺;
  //     ③ rowsOf(dt) 又按 filterVal 过滤 ⇒ 两张表的行在界面上互不可见。
  //   纯逻辑复现（两张表 10 + 18 行）:总 28 行、配方表可见 10、修订记录可见 18、串味 0 行。
  //   ⇒ 真正该守的约束是「**每张带 blankRows 的表都必须有 filterKey+filterVal**」,
  //     没有分块键才会真的混进同一桶。
  const withBlank = dts.filter((d) => Number(d.blankRows) > 0)
  assert.ok(withBlank.length >= 1, '配方表/修订记录至少各有一张该带 blankRows')
  for (const d of withBlank) {
    assert.ok(d.filterKey && d.filterVal,
      `「${d.filterVal || d.bar || d.pageTitle}」带 blankRows 但没有 filterKey+filterVal `
      + '⇒ 空行会混进同面板所有表共用的那一桶(这才是原本要防的串味)')
  }
})

