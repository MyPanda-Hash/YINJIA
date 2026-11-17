/**
 * 内部样品单「每月一张 + 整单归档」（2026-11-17 用户口径，Excel #4）。
 *
 * 用户原话：
 *  · 「按每月1张申请单，每个人在下面进行新增」
 *  · 「每月进行点击归档按钮对该单据进行归档，归档后所有人不得修改（除管理员撤销归档）」
 *  · 「新增单据时默认填充 ****年**月 内部（开发样品申请单） 表名称」
 *
 * 这三条都是"看代码在不在 + 语义对不对"，故按源码断言（与 changeSignoffStamp.test 同款）。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const btn = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ButtonService.java', import.meta.url), 'utf8')
const cfg = readFileSync(
  new URL('../../../../backend/src/main/java/com/yinjia/mes/service/PanelConfigService.java', import.meta.url), 'utf8')
const list = readFileSync(new URL('./PanelxList.vue', import.meta.url), 'utf8')

test('A1 每月一张：新增时先找当月单并复用，不新建', () => {
  const at = btn.indexOf('if (no == null && items.isEmpty() && !markSaved && "RD_SAMPLE_INT".equals(def.code()))')
  assert.ok(at > 0, '缺「新增复用当月单」的入口判断')
  const seg = btn.slice(at, at + 420)
  assert.match(seg, /findSampleMonthDoc\(def\)/, '必须调 findSampleMonthDoc')
  assert.match(seg, /return result\(month/, '命中当月单要直接返回它（不落新建分支）')
  // 判据用单号里的年月，不是单据日期（实测头表 单据日期 常为 null）
  const find = btn.indexOf('private String findSampleMonthDoc')
  assert.ok(find > 0, '缺 findSampleMonthDoc')
  const fseg = btn.slice(find, find + 900)
  assert.match(fseg, /yyyy-MM/, '按 yyyy-MM 取当月')
  assert.match(fseg, /LIKE \?/, '用单号前缀 LIKE 匹配（单据日期不可靠）')
})

test('整单归档：归档/撤销归档两个动作，撤销仅管理员且回到草稿', () => {
  assert.match(btn, /case "归档" -> archiveSampleMonth/, '缺归档动作')
  assert.match(btn, /case "撤销归档" -> unarchiveSampleMonth/, '缺撤销归档动作')

  const at = btn.indexOf('private Map<String, Object> unarchiveSampleMonth')
  assert.ok(at > 0, '缺 unarchiveSampleMonth')
  const seg = btn.slice(at, at + 1200)
  assert.match(seg, /isAdminUser\(currentUserName\(\)\)/, '撤销归档必须卡管理员')
  // 只清 archived 会退到「已审核」，仍然是锁定态 ⇒ 必须连 shr/shsj 一起清
  assert.match(seg, /shr = NULL/, '撤销必须清 shr')
  assert.match(seg, /shsj = NULL/, '撤销必须清 shsj')
})

test('工具栏给 RD_SAMPLE_INT 下发「归档」组（主按钮=归档 / 下拉=撤销归档）', () => {
  const at = cfg.indexOf('if ("RD_SAMPLE_INT".equals(def.code()))')
  assert.ok(at > 0, '缺 RD_SAMPLE_INT 的按钮组注入')
  const seg = cfg.slice(at, at + 300)
  assert.match(seg, /group\("归档", List\.of\("归档", "撤销归档"\)\)/, '组名与动作不匹配')
})

test('标题按单所属月份动态生成「YYYY年M月内部」', () => {
  const at = list.indexOf('const sampleMonthTitle = computed')
  assert.ok(at > 0, '缺 sampleMonthTitle')
  const seg = list.slice(at, at + 480)
  assert.match(seg, /\\d\{4\}\)-\(\\d\{2\}\)-/, '要从单号取年月')
  assert.match(seg, /年\$\{mo\}月内部|年\$\{y\}|月内部/, '要拼「YYYY年M月内部」')
  assert.match(list, /titlePart1: sampleMonthTitle\.value/, '标题前半段要用动态值')
})
