/**
 * 2026-11-17 深夜核验补漏（用户：「再对文件其他的修改点进行核验，有没有遗漏的没有改的」）。
 *
 * 重新通读四个工作表后发现两处**明确遗漏**（此前只做了「1117问题」页 8 条）：
 *
 * ① 「具体问题点」行10：「炭棒工艺管控起单及组装控制清单：右上角加多一行审核人，
 *    审核完成后自动生成」—— 组装工艺（RD_ASM_PROC）当天做了，**烧结/炭棒（RD_MOLD_PROC）漏了**。
 *
 * ② 「产品信息表」表行22：「主要性能描述：加标准库」—— 同页四个下拉格都加了，这格漏了
 *    （实测 data_type 仍是「文本」）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const btn = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const qs = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/QueryService.java', import.meta.url), 'utf8')
const moldMig = readFileSync(
  new URL('../../../../tools/migrate-mold-proc-auditor-20261117.sql', import.meta.url), 'utf8')
const perfMig = readFileSync(
  new URL('../../../../tools/migrate-prod-info-perf-stdlib-20261117.sql', import.meta.url), 'utf8')

test('① 炭棒工艺管控清单有「审核人」格：纸面只读 + 库列 + 审批回填 + 不被 shr 覆盖', () => {
  const info = recordSheetConfigs.RD_MOLD_PROC.info
  const row = info.find((i) => i.label === '审核人')
  assert.ok(row, '纸面信息栏缺「审核人」（行10 遗漏项）')
  assert.equal(row.readonly, true, '必须只读（审核后自动生成，不能手填）')

  assert.match(moldMig, /N'备用3', N'审核人'/, '落库列应为 备用3（与组装工艺同口径）')
  assert.match(moldMig, /N'header', 35, 110, 0, 0, 0, 1/, 'seq 35 / editable=0')
  assert.match(moldMig, /ISNULL\(NULLIF\(LTRIM\(RTRIM\(u\.real_name\)\)/, '历史单按 shr 补，账号→姓名')

  assert.match(btn, /"RD_ASM_PROC"\.equals\(def\.code\(\)\) \|\| "RD_MOLD_PROC"\.equals\(def\.code\(\)\)/,
    '审批通过时两张单都要回填')
  assert.match(qs, /"RD_MOLD_PROC"\.equals\(panelCode\)/, 'RD_MOLD_PROC 也要进"表内审核人为准"例外')
})

test('② 主要性能描述按标准库渲染 + 元数据迁移', () => {
  const sec = recordSheetConfigs.RD_PROD_INFO.sections.find((s) => s.bar === '四、特殊性能描述')
  const row = sec.rows[0].pairs.find((p) => p.key === '主要性能描述')
  assert.equal(row.type, 'select', '要按 select 渲染（否则标准库维护入口不出现）')

  assert.match(perfMig, /SET data_type = N'标准库', dict_sql = N'prod\.perf'/, '字段改标准库')
  assert.match(perfMig, /EXEC sp_executesql @seed/, '种库必须动态 SQL（两账套 schema 不同步）')
  assert.match(perfMig, /prod\.perf/, '库编码')
})

test('③ 出货检验计划存量按旧默认冯敏→崔晓云（只改等于旧默认的行）', () => {
  // 生产实测分布：管理人 空 8 张 / 冯敏 4 张 ⇒ 只把「冯敏」这 4 张改掉：
  //   · 空值不动（用户说的是"默认写"，不是"凭空补"）；
  //   · 人工改成别人的不动（那是人为指定）。
  // ⚠ 物理列是「管理人」不是「表单管理人」（label 同名陷阱，实测踩过）。
  const mig = readFileSync(
    new URL('../../../../tools/migrate-insp-plan-manager-20261118.sql', import.meta.url), 'utf8')
  assert.match(mig, /SET \[管理人\] = N'崔晓云'/, '要改「管理人」列')
  assert.match(mig, /WHERE \[管理人\] = N'冯敏'/, '只改仍等于旧默认的行')
  assert.doesNotMatch(mig, /SET \[表单管理人\]/, '不得写死 label 同名列（会列名无效）')
})
