/**
 * prodInfoBomSheet.test.js —— 产品信息表 / 产品规格书 2026-10-29 新版设计的回归钉
 *
 * 【用户口径】2026-10-29 两张设计图 +「格式变了,按上面说的来改」,四项确认:
 *   ① 产品信息表新增「三、产品BOM表」(物料编号|物料名称|尺寸规格|数量),真做(明细表+可录入+引用导入);
 *   ② 产品信息表新增 4 个真字段(项目编号/项目名称/客户名称/应用场景);
 *   ③ 产品规格书封面**删掉**「客户名称」那一行;
 *   ④ 规格书「版本」自动值改 V+年月日(后端,见 specDraftOnDispatch.test.js)。
 *
 * 这里守的是**改配置不报错、但一打开就不对**的四件事:
 *   ① 章节带编号与顺序(BOM 表夹在「二、规格与尺寸」与「四、特殊性能描述」之间);
 *   ② BOM 表自带列宽 colgroup ⇒ 可见列宽合计必须等于本面板纸面网格,否则比上边短一截
 *      (2026-10-28 组装BOM表就是这么踩的);
 *   ③ BOM 表必须挂在「三、产品BOM表」这个锚点上,且**自己不带 bar**(带了两处标题都画一遍);
 *   ④ 规格书封面 9 行、第 2 行是产品名称(key = 名称,不是「产品名称」)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const prod = recordSheetConfigs.RD_PROD_INFO
const spec = recordSheetConfigs.RD_SPEC_DOC

test('产品信息表:五个章节带编号且顺序正确(三 = 产品BOM表)', () => {
  const bars = (prod?.sections || []).map((s) => s.bar).filter(Boolean)
  assert.deepEqual(bars, [
    '一、产品基本信息',
    '二、规格与尺寸',
    '三、产品BOM表',
    '四、特殊性能描述',
    '五、文件与签署',
  ], '章节编号/顺序必须与新设计一致')
})

test('产品信息表:第一节的四格与整行「应用场景」', () => {
  const sec = (prod.sections || []).find((s) => s.bar === '一、产品基本信息')
  assert.ok(sec, '缺「一、产品基本信息」')
  const pairsOf = (row) => (row.pairs || []).map((p) => p.key)
  const rows = sec.rows.map(pairsOf)
  assert.deepEqual(rows[0], ['项目编号', '项目名称'], '第 1 行 = 项目编号 | 项目名称')
  assert.deepEqual(rows[1], ['产品编号', '客户名称'], '第 2 行 = 产品编号 | 客户名称')
  assert.deepEqual(rows[2], ['客户料号', '产品管控等级'])
  assert.deepEqual(rows[3], ['产品功能类别', '产品形态'])
  assert.deepEqual(rows[4], ['应用场景'], '末行 = 整行「应用场景」')
  // 旧字段不再上纸面(库里的列与历史值保留,只是这张纸面不画)
  const flat = rows.flat()
  assert.ok(!flat.includes('立项文档编号'), '「立项文档编号」不再上纸面(项目进度查询还要用它的列)')
  assert.ok(!flat.includes('客户项目名称'), '「客户项目名称」不再上纸面(规格书封面/下游参照仍在用)')
})

test('产品信息表:三、产品BOM表的列与宽度(可见列宽合计 = 纸面网格)', () => {
  const dts = prod.dataTables || []
  assert.equal(dts.length, 1, '产品信息表只有一张明细表(产品BOM表)')
  const bom = dts[0]
  assert.equal(bom.tablesAfterBar, '三、产品BOM表', 'BOM 表要挂在「三、产品BOM表」之后')
  assert.ok(!bom.bar, 'BOM 表不得自带 bar(标题由章节出,两边都写会画两遍)')
  assert.equal(bom.materialPick, true, '要能直接导入采购物料清单(materialPick)')
  const vis = (bom.cols || []).filter((c) => !c.hiddenCol)
  assert.deepEqual(vis.map((c) => c.key), ['物料编号', '物料名称', '尺寸规格', '数量'],
    '列 = 物料编号 | 物料名称 | 尺寸规格 | 数量(序号是物理列,纸面藏起来)')
  const visSum = vis.reduce((s, c) => s + (c.w || 100), 0)
  const gridSum = (prod.grid || []).reduce((s, w) => s + w, 0)
  assert.ok(gridSum > 0, '面板网格缺失')
  assert.equal(visSum, gridSum,
    `BOM 表可见列宽之和 ${visSum} ≠ 纸面网格 ${gridSum}(自带 colgroup 的表不铺满就比上边短一截)`)
})

test('产品规格书封面:9 行,第 2 行是产品名称(key=名称),没有「客户名称」', () => {
  const fields = spec?.cover?.fields || []
  assert.equal(fields.length, 9, '封面字段表应为设计里的 9 行')
  assert.equal(fields[0].key, '产品编号', '第 1 行 = 产品编号')
  assert.equal(fields[0].label, '产品编号')
  assert.equal(fields[1].key, '名称', '第 2 行 = 产品名称,数据键是 yj_field.label「名称」')
  assert.equal(fields[1].label, '产品名称', '纸面文案写「产品名称」')
  const labels = fields.map((f) => f.label)
  assert.ok(!labels.includes('客户名称'), '新版设计没有「客户名称」这一行')
  assert.ok(labels.includes('客户（项目）名称'), '客户项目名称的纸面文案带括号')
  assert.ok(fields.some((f) => f.key === '客户项目名称'), '数据键仍是「客户项目名称」')
})