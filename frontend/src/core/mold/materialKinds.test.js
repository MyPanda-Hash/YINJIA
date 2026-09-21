import test from 'node:test'
import assert from 'node:assert/strict'
import { MATERIAL_KINDS } from './materialKinds.js'
import { groupOfMaterialType, SLOT_GROUPS } from './recipeSheet.js'

/**
 * 背景(2026-09-21 真人流程 e2e 抓到的隐患):
 *   配方表「物料种类」原来是自由文本格。引擎的 groupOfMaterialType 只认**物料档案口径**的词
 *   (bs_inv.所属类别:炭粉 / 胶粉 / 功能料-粉末 / 功能料-颗粒;折算料位靠「颗粒|折算物料」命中)。
 *   工艺员顺手填自然词「粉料」「折算料」时:不报错,静默落到粉料组 —— 折算料 2g/支 会被当成 2% 比例,
 *   整张单的灌料重量/长度/脱模重量全算错,只在弹窗②里有一行小字告警。
 *   ⇒ 界面改成下拉,并且**下拉里给的每一个选项都必须被引擎认出来**(这组断言钉住这条不变量)。
 */

test('下拉提供的每个物料种类都能被引擎分到料位组(不许有认不出来的选项)', () => {
  const bad = MATERIAL_KINDS.filter((k) => !groupOfMaterialType(k))
  assert.deepEqual(bad, [], `这些选项引擎认不出来,选了就会静默算错:${JSON.stringify(bad)}`)
})

test('下拉覆盖全部三个料位组(粉料/胶粉/折算料)', () => {
  const groups = new Set(MATERIAL_KINDS.map((k) => groupOfMaterialType(k)))
  assert.deepEqual([...groups].sort(), [SLOT_GROUPS.CONVERTED, SLOT_GROUPS.GLUE, SLOT_GROUPS.POWDER].sort())
})

test('下拉词汇与物料档案口径一致(四个类别)', () => {
  assert.deepEqual(MATERIAL_KINDS, ['炭粉', '胶粉', '功能料-粉末', '功能料-颗粒'])
})

test('自然词「粉料」「折算料」引擎不认 —— 记录这是必须靠下拉避免的坑', () => {
  assert.equal(groupOfMaterialType('粉料'), '')
  assert.equal(groupOfMaterialType('折算料'), '')
})
