/**
 * 删除行二次确认（2026-11-18 用户口径，Excel #11）：
 *   「给样品内部、开发外部两个面板做删除行二次确认」。
 * 只有这两张打开开关；非开发样品单（展开继承 EXT）显式关闭。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sampleExtSheetCfg, sampleIntSheetCfg, sampleNdSheetCfg } from './docSheetConfigs.js'

const vue = readFileSync(new URL('./DocSheet.vue', import.meta.url), 'utf8')

test('只有 外部开发 / 内部开发 两张单打开删除确认', () => {
  assert.equal(sampleExtSheetCfg.confirmDeleteRow, true, '外部-开发样品单要确认')
  assert.equal(sampleIntSheetCfg.confirmDeleteRow, true, '内部-开发样品单要确认')
  assert.equal(sampleNdSheetCfg.confirmDeleteRow, false, '非开发样品单不开（展开继承 EXT，必须显式关）')
})

test('确认弹窗走 ElMessageBox，取消时不删、不报错', () => {
  const at = vue.indexOf('async function removeGridRow')
  assert.ok(at > 0, '缺 removeGridRow')
  const seg = vue.slice(at, at + 1200)
  assert.match(seg, /confirmDeleteRow/, '必须读配置开关')
  assert.match(seg, /ElMessageBox\.confirm/, '要弹确认框')
  assert.match(seg, /catch \(e\) \{\s*return \/\/ 用户取消/, '取消要直接 return（不能继续删）')
  // 取消分支必须在 splice 之前
  const retAt = seg.indexOf('return // 用户取消')
  const spliceAt = seg.indexOf('items.splice(idx, 1)')
  assert.ok(retAt > 0 && retAt < spliceAt, '取消分支必须在删除之前')
})

test('没开开关的面板零弹窗（保持原来的直接删）', () => {
  const at = vue.indexOf('async function removeGridRow')
  const seg = vue.slice(at, at + 1200)
  assert.match(seg, /if \(props\.config && props\.config\.confirmDeleteRow\)/, '开关是唯一判据，不能写死面板码')
})
