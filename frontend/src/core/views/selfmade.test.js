/**
 * 研发管理·自制料（2026-11-19 用户口径，《新建 XLS 工作表.xls》）：
 *   录入面板：材料名/主批次手填，子批次自动 `主批次-N`（1~10 行），流程卡/配料表为附件格，
 *             录入人默认练庆文；无审批。
 *   查询页：材料名 + 批次起止，结果含录入日期；导出 Excel + 打印二维码（材料名+主批次）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'
import { applyDocDefaults } from '../panel/docDefaults.js'

const sheet = readFileSync(new URL('./RecordSheetPanels.vue', import.meta.url), 'utf8')
const page = readFileSync(new URL('../../views/rd/SelfmadeQuery.vue', import.meta.url), 'utf8')
const mig = readFileSync(new URL('../../../../tools/migrate-selfmade-20261119.sql', import.meta.url), 'utf8')

test('录入面板：两格手填 + 附件格 + 子批次自动编号(1~10)', () => {
  const cfg = recordSheetConfigs.RD_SELFMADE
  assert.ok(cfg, '缺 RD_SELFMADE 面板配置')
  const heads = cfg.sections.flatMap((s) => s.rows.flatMap((r) => r.pairs || [])).map((p) => p.key)
  assert.deepEqual(heads, ['材料名', '主批次'], '材料名与主批次都是手填格')
  const dt = cfg.dataTables[0]
  assert.deepEqual(dt.subBatch, { key: '子批次', from: '主批次', max: 10, min: 1 })
  const fileCols = dt.cols.filter((c) => c.type === 'file').map((c) => c.key)
  assert.deepEqual(fileCols, ['流程卡', '配料表'], '两格都是附件格（图片或文件）')
  assert.equal(dt.blankRows, 1, '默认 1 行（最少一个子批次）')
})

test('录入人默认练庆文（可改）', () => {
  const form = {}
  applyDocDefaults('RD_SELFMADE', form, { realName: '系统管理员', userName: 'admin' }, { isNew: true, today: '2026-11-19' })
  assert.equal(form['录入人'], '练庆文')
})

test('子批次由行序推导：上限拦截 + 增删行重排，不让人手填', () => {
  assert.match(sheet, /function applySubBatch\(dt\)/, '缺子批次重排')
  assert.match(sheet, /r\[sb\.key\] = base \? `\$\{base\}-\$\{no\}` : String\(no\)/, '格式 = 主批次-序号')
  assert.match(sheet, /function subBatchFull\(dt\)/, '缺上限判断')
  assert.match(sheet, /if \(subBatchFull\(dt\)\) \{ ElMessage\.warning/, '到 10 行要拦住')
  assert.match(sheet, /for \(const dt of \(cfg\.value\?\.dataTables \|\| \[\]\)\) if \(dt && dt\.subBatch\) applySubBatch\(dt\)/, '删行后重排')
})

test('查询页：材料名+批次区间、录入日期列、导出 Excel、二维码=材料名+主批次', () => {
  assert.match(page, /\/px\/selfmadeQuery/, '走查询端点')
  assert.match(page, /batchFrom/, '有批次起')
  assert.match(page, /batchTo/, '有批次止')
  assert.match(page, /tt\('录入日期'\)/, '结果要显示录入日期')
  assert.match(page, /xlsx/, '导出 Excel')
  assert.match(page, /const text = `\$\{row\['材料名'\] \|\| ''\} \$\{row\['主批次'\] \|\| ''\}`\.trim\(\)/, '二维码内容 = 材料名 + 主批次')
})

test('迁移：头/明细表 + 面板 + 附件字段 + 权限骨架', () => {
  assert.match(mig, /CREATE TABLE dbo\.rd_selfmade_head/)
  assert.match(mig, /CREATE TABLE dbo\.rd_selfmade_detail/)
  assert.match(mig, /RD_SELFMADE/)
  assert.match(mig, /N'流程卡',\s*N'流程卡',\s*N'附件'/, '流程卡必须是附件类型')
  assert.match(mig, /INSERT INTO yj_role_panel/)
})
