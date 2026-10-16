/**
 * permWordDrift.test.js —— 「组织架构矩阵可勾的词 = 引擎真读的词」的钉子(2026-10-16)
 *
 * 【用户原话】「现在组织架构里面的研发管理模块角色可配置的权限与现在的面板功能是对不上的,
 *   现在审视一遍,把这个权限配置完善」
 *
 * 【实测病根(证据 tools/archive/_rd-perm-audit-20261016/)】矩阵下发的词表与引擎读的词表**两套**:
 *   - 通用集给的是 edit/delete/price/review/adjust,而 PanelPermissionService 一个都不认(它只认
 *     modify/del/modlog)⇒ 非文书类面板永远授不出「申请修改/删除申请」,勾了也 403;
 *   - 反向:库里几十张面板已授 modify/modlog/del,而通用矩阵**没有这三列** ⇒ 界面上看不见、点不掉;
 *   - price/review/adjust 全库零消费者。
 * 归位口径:SysAdminController.PERMISSION_ACTIONS = 引擎词表;文件类集是它的子集(少 print/warn)。
 *
 * 单测跑不了运行时,按仓库既有做法读源码钉住(同 specDriftNotice.test.js / rdChangeConfig.test.js)。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sys = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/controller/SysAdminController.java', import.meta.url), 'utf8')
const perms = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/PanelPermissionService.java', import.meta.url), 'utf8')
const shareSvc = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/ShareFileService.java', import.meta.url), 'utf8')
const shareCtl = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/controller/ShareFileController.java', import.meta.url), 'utf8')
const manifest = readFileSync(new URL('../../../../tools/db-migrations.txt', import.meta.url), 'utf8')

/** 取出某个 `String[][] X = { ... };` 代码块里的词(只认 {"词", "...} 形式) */
function actionsOf(src, constName) {
  const at = src.indexOf(`String[][] ${constName} = {`)
  assert.ok(at > 0, `SysAdminController 里找不到 ${constName}`)
  const block = src.slice(at, src.indexOf('};', at))
  return [...block.matchAll(/\{\s*"([a-z]+)"\s*,\s*"/g)].map((m) => m[1])
}
/** 取出 PanelPermissionService.PERM_LABEL 的键(Map.entry("view", "可见") / Map.entry("warn", "预警配置")) */
function permLabelKeys(src) {
  const at = src.indexOf('PERM_LABEL = Map.ofEntries(')
  assert.ok(at > 0, 'PanelPermissionService 里找不到 PERM_LABEL')
  const block = src.slice(at, src.indexOf(');', at))
  return [...block.matchAll(/Map\.entry\("([a-z]+)"/g)].map((m) => m[1])
}

const COMMON = actionsOf(sys, 'PERMISSION_ACTIONS')
const FILE = actionsOf(sys, 'FILE_PANEL_ACTIONS')
const LABELS = permLabelKeys(perms)
/** 引擎**没有任何消费者**的废词:旧通用集里的五個 */
const DEAD_WORDS = ['edit', 'delete', 'price', 'review', 'adjust']

test('通用动作集 = 引擎词表(每个词都能在 PERM_LABEL 里找到中文标签 ⇒ 前端列头与后端 403 提示同源)', () => {
  assert.ok(COMMON.length >= 11, `通用动作集只剩 ${COMMON.length} 项,疑似被删空`)
  for (const w of COMMON) {
    assert.ok(LABELS.includes(w), `通用动作集里的「${w}」不在 PanelPermissionService.PERM_LABEL 里 —— 又是"勾了引擎不认"的旧病`)
  }
  // 引擎认的关键词一个都不能少(否则那类面板的动作在矩阵里无法授予)
  for (const w of ['view', 'query', 'add', 'modify', 'modlog', 'del', 'export', 'print', 'audit', 'field', 'warn']) {
    assert.ok(COMMON.includes(w), `通用动作集缺「${w}」⇒ 该类权限在组织架构里授不出去`)
  }
})

test('废词彻底消失:edit/delete/price/review/adjust 不在任何动作集、也没人再读它', () => {
  for (const w of DEAD_WORDS) {
    assert.ok(!COMMON.includes(w), `通用动作集仍有废词「${w}」`)
    assert.ok(!FILE.includes(w), `文件类动作集仍有废词「${w}」`)
  }
  // ShareFileService/Controller 是全库最后一个吃 edit/delete 的地方,必须已改读 modify/del
  assert.ok(!/hasAnyPerm\(PANEL, "add", "edit"/.test(shareSvc), 'ShareFileService 仍在读 edit 词')
  assert.ok(!/"add", "edit", "delete"/.test(shareCtl), 'ShareFileController 仍在读 edit/delete 词')
  assert.match(shareSvc, /hasAnyPerm\(PANEL, "add", "modify"\)/, 'ShareFileService 应改读 modify')
  assert.match(shareCtl, /requireAnyPerm\(ShareFileService\.PANEL, "删除", "add", "modify", "del"\)/, 'ShareFileController 删除闸门应改读 add/modify/del')
})

test('文件类动作集是通用集的子集(只少 print/warn)—— 不允许再分叉出第二套词', () => {
  for (const w of FILE) {
    assert.ok(COMMON.includes(w), `文件类动作集里的「${w}」不在通用集里 ⇒ 两套词表又开始漂移`)
  }
  const extra = COMMON.filter((w) => !FILE.includes(w))
  assert.deepEqual(extra.sort(), ['print', 'warn'], `文件类相对通用只该少 print/warn,实际差:${extra.join(',')}`)
})

test('数据侧配套迁移已登记(词表改了而库没回正 = 界面格子仍在旧词上)', () => {
  assert.ok(manifest.includes('migrate-role-perm-words-20261016.sql'), 'tools/db-migrations.txt 未登记词表归位迁移')
})
