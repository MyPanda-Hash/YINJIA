/**
 * 产品信息表两处修正（2026-11-23 用户口径）：
 *   ①「这个产品名称已经固定了，但是必填没有取消」⇒ yj_field.required=0（迁移），
 *      纸面已无该输入格（titleKey 撤掉）；
 *   ②「把备注栏放到客户图纸下边」⇒ 备注从「五、文件与签署」移到第四节、
 *      紧跟「客户图纸或规格书」之后。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { recordSheetConfigs } from './recordSheetConfigs.js'

const cfg = recordSheetConfigs.RD_PROD_INFO
const mig = readFileSync(new URL('../../../../tools/migrate-prodinfo-name-not-required-20261123.sql', import.meta.url), 'utf8')

const sectionOf = (bar) => cfg.sections.find((s) => s.bar === bar)
const keysOf = (sec) => sec.rows.flatMap((r) => (r.pairs || []).map((p) => p.key))

test('备注在「四、特殊性能描述」里、紧跟客户图纸之后', () => {
  const sec = sectionOf('四、特殊性能描述')
  assert.ok(sec, '缺第四节')
  const keys = keysOf(sec)
  const iFile = keys.indexOf('客户图纸或规格书')
  const iRemark = keys.indexOf('备注')
  assert.ok(iFile >= 0, '客户图纸或规格书应在第四节')
  assert.ok(iRemark >= 0, '备注应在第四节')
  assert.equal(iRemark, iFile + 1, '备注必须紧跟客户图纸或规格书')
})

test('备注不再出现在「五、文件与签署」', () => {
  const keys = keysOf(sectionOf('五、文件与签署'))
  assert.ok(!keys.includes('备注'), '第五节不应再出现备注')
  assert.deepEqual(keys, ['审核人（一级审批人）', '审核人（二级审批人）'], '第五节只留两级审核')
})

test('产品名称不再是纸面大标题输入框（titleKey 已撤）', () => {
  assert.equal(cfg.titleKey, undefined, 'titleKey 应已注释掉')
  assert.equal(cfg.staticTitle, '产品信息表')
})

test('迁移把产品名称 required 置 0（纸面无输入口就不该拦必填）', () => {
  assert.match(mig, /UPDATE yj_field SET required = 0/, '迁移必须置 required=0')
  assert.match(mig, /panel_code = N'RD_PROD_INFO' AND label = N'产品名称'/, '只改本面板产品名称')
  assert.match(mig, /RAISERROR\(N'\[prodinfo-name-not-required\] 自检失败/, '必须有自检')
})
