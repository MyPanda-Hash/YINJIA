/**
 * 客户名称「预选 + 手填」（2026-11-18 用户口径，Excel #10）：
 * 「同时写进客户档案（KHDA），后续能选到，但是同时弹窗要求填写其客户编号和联系人，
 *   也可以选择不填编号和联系人，但是不填就不回填客户档案」。
 * 用户另确认：写 `dm_kh`、建档时打标记。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sampleExtSheetCfg } from './docSheetConfigs.js'

const vue = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')
const java = readFileSync(new URL('../../../../backend/src/main/java/com/yinjia/mes/service/QueryService.java', import.meta.url), 'utf8')

test('样品单客户名称格声明 manualRef（只有这一张要手填）', () => {
  const cell = sampleExtSheetCfg.info.find((i) => i.key === '客户名称')
  assert.ok(cell, '缺客户名称格')
  assert.equal(cell.manualRef, true, '要出「＋新客户」按钮')
})

test('不填编号 → 只写单上，不调建档接口', () => {
  const at = vue.indexOf('async function submitManualRef')
  assert.ok(at > 0, '缺 submitManualRef')
  const seg = vue.slice(at, at + 1200)
  assert.match(seg, /if \(!code\)/, '必须先判空编号')
  assert.match(seg, /props\.head\[key\] = name[\s\S]{0,200}tt\('未填客户编号/, '空编号分支只写本单并提示')
  // 空编号分支必须在调用接口之前 return
  const callAt = seg.indexOf("/px/khdaUpsert")
  const retAt = seg.indexOf('return')
  assert.ok(retAt > 0 && retAt < callAt, '空编号时不能调用建档接口')
})

test('手填客户读写本单字段必须走 props.head（script setup 里没有裸 head）', () => {
  // 2026-11-20 实测：openManualRef / submitManualRef 里写裸 `head[...]` ⇒ 点「＋新客户」直接
  // ReferenceError: head is not defined，弹窗根本打不开；模板能用裸 head 是编译器给模板的绑定，
  // <script setup> 的函数里必须走 props.head。
  const at = vue.indexOf('function openManualRef')
  assert.ok(at > 0, '缺 openManualRef')
  const seg = vue.slice(at, vue.indexOf('async function submitManualRef') + 1600)
  assert.doesNotMatch(seg.replace(/props\.head/g, ''), /\bhead\[/, '不允许再出现裸 head[...]')
  assert.match(seg, /props\.head\?\.\[manualRefField\.value\]/, '弹窗要用本单当前客户名做初值')
  assert.equal((seg.match(/props\.head\[key\] = name/g) || []).length, 2, '两条提交分支都要写回本单')
})

test('填了编号 → 调 /px/khdaUpsert 并按结果给不同提示', () => {
  assert.match(vue, /request\.post\('\/px\/khdaUpsert'/, '要调建档接口')
  assert.match(vue, /state === 'created'/, '新建成功要提示')
  assert.match(vue, /state === 'exists'/, '已存在要提示"未新建"')
})

test('后端写 dm_kh：编号空直接返回 no_code；动态列；打「MES手工新建」标记', () => {
  const at = java.indexOf('public String upsertCustomer')
  assert.ok(at > 0, '缺 upsertCustomer')
  const seg = java.slice(at, at + 2600)
  assert.match(seg, /if \(dm\.isEmpty\(\)\) return "no_code"/, '不填编号不回填档案')
  assert.match(seg, /INFORMATION_SCHEMA\.COLUMNS WHERE TABLE_NAME='dm_kh'/, '列清单要运行时读（遗留表列名不规整）')
  assert.match(seg, /INSERT INTO dm_kh/, '写 dm_kh（用户确认）')
  assert.match(seg, /MES手工新建/, '要打标记')
  assert.match(seg, /"exists"/, '同名/同编号已存在时不重复插')
})
