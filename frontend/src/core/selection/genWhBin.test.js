/**
 * genWhBin.test.js —— 生单对话框「仓库 / 仓位」预填的纯函数钉子(2026-11-13 用户口径)
 *
 * 【用户原话】
 *   「从采购订单生单的时候就开始预填仓库仓位」;
 *   「生单可以选仓库和仓位,可以每行不一样,也可以所有行带入第一个填入的仓库和仓位」。
 *
 * 这里钉三件事(其余靠界面取证):
 *   ① 仓位候选**按本行仓库收窄**(仓位档案的「仓库」存的是仓库名称快照,别按编码比);
 *   ② 默认仓位取「是否默认」那一个,多个取编码最小(与后端 ButtonService.presetBinFor 同口径);
 *   ③ 提交键只为"真选了"的字段出现 —— 没选仓库就整组不提交,否则后端会把空值当"清空"。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { binsOfWarehouse, defaultBinOf, whBinPayload, WHBIN_KEYS } from './genWhBin.js'

const bins = [
  { wh: '原料仓', whCode: 'WH01', code: 'B03', name: '原料仓-B03', isDefault: true },
  { wh: '原料仓', whCode: 'WH01', code: 'B01', name: '原料仓-B01', isDefault: true },
  { wh: '原料仓', whCode: 'WH01', code: 'B02', name: '原料仓-B02', isDefault: false },
  { wh: '成品仓', whCode: 'WH02', code: 'F01', name: '成品仓-F01', isDefault: false },
]
const warehouses = [
  { name: '原料仓', code: 'WH01', binManaged: true },
  { name: '成品仓', code: 'WH02', binManaged: false },
]

test('仓位候选:按本行仓库收窄(名称优先,编码兜底)', () => {
  assert.deepEqual(binsOfWarehouse(bins, '原料仓').map((b) => b.code), ['B03', 'B01', 'B02'])
  assert.deepEqual(binsOfWarehouse(bins, 'WH02').map((b) => b.code), ['F01'], '仓库为空/编码形态也要能匹配')
  assert.deepEqual(binsOfWarehouse(bins, ''), [], '没选仓库 ⇒ 没有候选(不倒全库仓位给用户)')
})

test('默认仓位:取「是否默认」,多个取编码最小(与后端 presetBinFor 同口径)', () => {
  assert.equal(defaultBinOf(bins, '原料仓'), 'B01')
  assert.equal(defaultBinOf(bins, '成品仓'), '')
})

test('提交键:没选仓库就整组不提交(空值不能被当成"清空")', () => {
  assert.deepEqual(whBinPayload({ warehouses, bins, warehouse: '', bin: 'B01' }), {})
})

test('提交键:仓库 + 仓位 + 仓位名称 + 是否启用仓位管理', () => {
  assert.deepEqual(
    whBinPayload({ warehouses, bins, warehouse: '原料仓', bin: 'B03' }),
    { 仓库: '原料仓', 仓库编码: 'WH01', 仓库启用仓位管理: '1', 仓位: 'B03', 仓位名称: '原料仓-B03' },
  )
  // 只选仓库不选仓位:只提交仓库那几项,仓位留给后端按默认预设
  assert.deepEqual(
    whBinPayload({ warehouses, bins, warehouse: '成品仓', bin: '' }),
    { 仓库: '成品仓', 仓库编码: 'WH02', 仓库启用仓位管理: '0' },
  )
})

test('提交键的键名与后端 WHBIN_KEYS 同口径(中文数据键,ADR-0001)', () => {
  const payload = whBinPayload({ warehouses, bins, warehouse: '原料仓', bin: 'B03' })
  for (const k of Object.keys(payload)) {
    assert.ok(WHBIN_KEYS.includes(k), `未知提交键 ${k}:后端 PushGenerateHandler.WHBIN_KEYS 对不上会静默丢字段`)
  }
  assert.ok(!('仓位id' in payload), '仓位 id 不从前端造 —— 参照回写那套才写 id,这里只认编码')
})
