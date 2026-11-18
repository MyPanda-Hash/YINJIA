/**
 * 产品信息表（RD_PROD_INFO）目标版式（2026-11-17 用户口径，1117问题 #7）。
 *
 * 用户四条口径：「客户名里已含编码 … 挤一格」「应用场景加标准库功能」
 *   「BOM 默认就是新增一行数据行」+ 目标版式里尺寸行的「外径±公差」写法。
 *
 * 已核实现状（不需要改，作为基线钉住）：
 *   · 一、产品基本信息 的行序/字段与目标版式一致（项目编号|项目名称 / 产品编号|客户名称 /
 *     客户编码|客户料号 / 产品管控等级|产品功能类别 / 产品形态|应用场景）；
 *   · 产品管控等级 / 产品功能类别 / 产品形态 三个字段的 data_type 已是「标准库」⇒ 自动出维护入口。
 * 本次改动：应用场景→标准库、BOM 默认一行、尺寸三格提示词。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const cfg = recordSheetConfigs.RD_PROD_INFO
const mig = readFileSync(
  new URL('../../../../tools/migrate-prod-info-scene-stdlib-20261117.sql', import.meta.url), 'utf8')

const basic = (cfg.sections || []).find((s) => s.bar === '一、产品基本信息')

test('基本信息区行序与目标版式一致（客户名仍是单格，不拆两列）', () => {
  assert.ok(basic, '缺「一、产品基本信息」')
  const flat = []
  for (const row of basic.rows) {
    for (const pair of row.pairs || []) {
      if (pair.cells) pair.cells.forEach((c) => flat.push(c.key))
      else flat.push(pair.key)
    }
  }
  assert.deepEqual(flat.slice(0, 10), ['项目编号', '项目名称', '产品编号', '客户名称',
    '客户编码', '客户料号', '产品管控等级', '产品功能类别', '产品形态', '应用场景'])
  assert.ok(!flat.includes('客户编码') || flat.indexOf('客户编码') > flat.indexOf('客户名称'),
    '客户编码是独立一格（与客户名称并列），不是把客户名称拆成两列')
})

test('应用场景改成标准库（可维护），并种入历史取值', () => {
  assert.match(mig, /data_type = N'标准库', dict_sql = N'prod\.scene'/, '字段要改标准库')
  // 种库走**动态 SQL**（sp_executesql）：两账套 schema 不同步，测试库没有 [应用场景] 列，
  //   而 IF COL_LENGTH(...) 包不住批编译期的列名解析（实测 207），所以整段拼串执行。
  assert.match(mig, /EXEC sp_executesql @seedSql/, '种库必须是动态 SQL')
  assert.match(mig, /INSERT INTO yj_std_lib[\s\S]*prod\.scene/, '要把历史取值种进库')
  assert.match(mig, /IF COL_LENGTH\('rd_prod_info_head', N'应用场景'\) IS NOT NULL/, '缺列要跳过')
})

test('BOM 表默认生成一行（面板级 seedRows）', () => {
  assert.deepEqual(cfg.seedRows, [{ 序号: 1 }], 'RD_PROD_INFO 应有 1 行预置')
  const bom = (cfg.dataTables || []).find((d) => d.tablesAfterBar === '三、产品BOM表')
  assert.ok(bom, '缺 BOM 数据表')
  // 面板明细只有 BOM 一张表 ⇒ 面板级 seedRows 不会铺到别的页
  assert.equal((cfg.dataTables || []).length, 1, '若将来加第二张明细表，seedRows 必须改成按表预置')
})

test('尺寸行按「外径±公差 / 内径±公差 / 长度±公差」写', () => {
  const size = (cfg.sections || []).find((s) => s.bar === '二、规格与尺寸')
  const overall = size.rows[0].pairs[0]
  assert.match(overall.ph, /外径±公差/, '整体尺寸提示要含外径±公差')
  assert.match(overall.ph, /内径±公差/)
  assert.match(overall.ph, /长度±公差/)
  const rod = size.rows[1].pairs[0]
  assert.deepEqual(rod.cells.map((c) => c.ph), ['外径±公差mm', '内径±公差mm', '长度±公差'])
})

test('应用场景的 config.type 必须是 select（配合元数据的标准库）', () => {
  // 元数据改成标准库还不够：渲染层按 config 的 type 决定出输入框还是下拉，
  // 写 'text' 时标准库维护入口不会出现（2026-11-17 实测踩到，截图里该格是空白框）。
  const basic = (cfg.sections || []).find((s) => s.bar === '一、产品基本信息')
  const pair = basic.rows.flatMap((r) => r.pairs || []).find((p) => p.key === '应用场景')
  assert.ok(pair, '缺应用场景')
  assert.equal(pair.type, 'select', '应用场景必须按 select 渲染')
})
