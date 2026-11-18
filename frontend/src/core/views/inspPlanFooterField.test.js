/**
 * inspPlanFooterField.test.js — 出货检验计划表「不合格应对措施放表格最下层」+ 检查频率专属下拉
 * (用户口径 2026-11-17)
 *
 * 【用户原话】
 *   ①「出货检验计划表下拉框的数据过多,修改为下面的修改,1%/一个生产批次、1PCS/一个生产批次、
 *     1PCS/一个工单、型式检验。下拉款中内容可自行增加。」
 *   ②「不合格应对措施放置表格最下层,因为当前的不合格措施都是一样的」(配图另有「检验方法内容
 *     适当调宽一点」)。
 *
 * 【为什么这条要专门的钉子 —— 它是"显示合并、存储逐行"的契约】
 *   那一格不是新字段、也不是表头字段:值仍然逐行存在 rd_insp_plan_detail.[不合格应对措施] 上
 *   (带入检验单 applyShipPlanItems / applyInspItems、标准库勾选、规格书 autoFillSpec.defaults、
 *    保存 upsert 四条链路都按**行**读写这一格)。所以:
 *     · 显示 = 取本表第一行非空值;编辑 = 写回**全部行**;
 *     · 新增行必须继承同一份文本,否则这一行带入检验单时是空的。
 *   下面把这几条连同"频率库另开一支"一起钉住 —— 改错任一条都不会报错,只会让纸上/库里悄悄不一致。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const ROOT = new URL('../../../', import.meta.url) // frontend/
const read = (rel) => readFileSync(new URL(rel, ROOT), 'utf8')
const panel = read('src/core/views/RecordSheetPanels.vue')
const migration = readFileSync(new URL('../../../../tools/migrate-insp-freq-oqc-20261117.sql', import.meta.url), 'utf8')

const dtOf = () => recordSheetConfigs.RD_INSP_PLAN.dataTables.find((d) => d.filterVal === '检验项目')

test('① 配置:不合格应对措施退出可见列,改挂 footerField(表格最下层)', () => {
  const dt = dtOf()
  assert.ok(dt, '缺出货检验项目表')
  const vis = (dt.cols || []).filter((c) => !c.hiddenCol)
  assert.deepEqual(vis.map((c) => c.key),
    ['序号', '控制项目', '控制标准及要求', '控制方法', '检测频率', '备注'],
    '可见列应是 6 列(不合格应对措施已挪到表格最下层)')
  assert.ok((dt.cols || []).some((c) => c.key === '不合格应对措施' && c.hiddenCol),
    '不合格应对措施 必须留在 cols 里并标 hiddenCol(值要逐行往返)')
  assert.equal(dt.footerField?.key, '不合格应对措施')
  assert.equal(dt.footerField?.label, '不合格应对措施', '那一格的标签就是字段名(纸上要印出来)')
  assert.ok(Number(dt.footerField?.rows) >= 2, '最低行数应 ≥2(三段式措施要能整段看见)')
})

test('② 列宽:6 列合计仍 = 1187(与报告头/纸宽同宽,右缘才齐平)', () => {
  const dt = dtOf()
  const sum = (dt.cols || []).filter((c) => !c.hiddenCol).reduce((a, c) => a + (c.w || 100), 0)
  assert.equal(sum, 1187, `6 列合计应为 1187,实际 ${sum}`)
  const method = (dt.cols || []).find((c) => c.key === '控制方法')
  assert.ok(method.w >= 300, `检验方法列应加宽(用户口径「检验方法内容适当调宽一点」),实际 ${method.w}`)
})

test('③ 组件:最下层那条合并行跨满全表,编辑写回全部行,新增行继承同一份', () => {
  assert.match(panel, /<tr v-if="dt\.footerField">/, '模板里缺 footerField 那一行')
  assert.match(panel, /:colspan="totalSpan\(dt\)" class="rsp-footer-field"/, '合并格应跨满全部可见列')
  // 编辑 = 写回**全部行**(不是只写第一行)
  assert.match(panel, /for \(const r of rows\) r\[key\] = v/,
    'setFooterFieldValue 必须写回本表全部行,否则其余行保存的是旧文本')
  // 显示 = 第一行非空值
  assert.match(panel, /for \(const r of rowsOf\(dt\)\)/, 'footerFieldValue 应遍历本表行取非空值')
  // 新增行继承
  assert.match(panel, /if \(dt\.footerField\?\.key\) row\[dt\.footerField\.key\] = footerFieldValue\(dt\)/,
    '新行必须继承最下层那一格的文本(否则带入检验单时该行为空)')
  // 位置:在明细行之后、表尾注之前
  const atField = panel.indexOf('<tr v-if="dt.footerField">')
  const atNote = panel.indexOf('<tr v-if="dt.footerNote">')
  assert.ok(atField > 0 && atNote > atField, '那条合并行必须紧接明细行、位于表尾注之前(表格最下层)')
})

test('④ 检查频率:本面板改用专属库 INSP_FREQ_OQC,共用库不动', () => {
  const dt = dtOf()
  const freq = (dt.cols || []).find((c) => c.key === '检测频率')
  assert.equal(freq.stdLib, 'INSP_FREQ_OQC', '检查频率应指向本面板专属库')
  assert.match(panel, /const STD_LIB_CODES = \['INSP_FREQ', 'INSP_FREQ_OQC'\]/,
    'STD_LIB_CODES 必须带上新库,否则下拉没有候选(只剩手输)')
  // 迁移脚本:用户点名的 4 条都要在种子里,且共用库 INSP_FREQ 不在本脚本里被删/停用
  for (const v of ['1%/一个生产批次', '1PCS/一个生产批次', '1PCS/一个工单', '型式检验']) {
    assert.ok(migration.includes(`N'${v}'`), `迁移脚本种子缺「${v}」`)
  }
  assert.ok(!/DELETE\s+FROM\s+yj_std_lib/i.test(migration), '本脚本不应删任何标准库条目(共用库另有 3 张检验单在用)')
  assert.ok(migration.includes("dict_sql = N'INSP_FREQ_OQC'"), '迁移脚本缺字段切换')
})
