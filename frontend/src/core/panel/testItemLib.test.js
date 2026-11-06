import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  toCanonical,
  emptyEntry,
  toSpecSub,
  toInspRow,
  isCanonical,
  CANONICAL_KEYS,
  orderSpecGroups,
  specMotherOf,
  clusterSpecGroups,
} from './testItemLib.js'

/**
 * 这组断言守的是**内容格式与投影**的正确性,不是"两面板共用库":
 * 规格书(RD_SPEC_DOC)用 `spec.test`、出货检验计划表(RD_INSP_PLAN)用 `insp.plan`,
 * 两个面板各管各的库、互不可见(2026-09-11 的共库决定已撤销);
 * 规范结构(canonical v=2)是**两库共用的格式**,让历史旧格式条目也能编辑。
 * 难点是两库的 JSON 形状本来就不同:
 *   · 规格书(旧 spec.test): item_code=组名, content={sub,req,method,basis}
 *   · 出货计划(旧 insp.plan): item_code=表区名, content=10 个中文键
 * 所以统一到一份规范结构(canonical),再各自投影回自己那一侧的形态;**空字段一律留空,不丢数据**。
 */

test('旧规格书条目 → 规范结构:item 当组名,sub 当 name', () => {
  const e = toCanonical({ sub: '产品尺寸', req: '外径28±0.5', method: '游标卡尺', basis: '银嘉标准' }, '尺寸')
  assert.equal(e.group, '尺寸')
  assert.equal(e.name, '产品尺寸')
  assert.equal(e.req, '外径28±0.5')
  assert.equal(e.method, '游标卡尺')
  assert.equal(e.basis, '银嘉标准')
  assert.equal(e.quality, '')
})

test('旧出货计划条目 → 规范结构:10 个中文键逐一映射,不丢一个', () => {
  const legacy = {
    控制项目: '外观', 质量控制内容: '无破损', 检测仪器: '目视', 控制标准及要求: '银嘉标准',
    检验: 'IQC', 不合格应对措施: '退货', 检测频率: '每批', 取样方式: '随机', 检验内容: '外观检查', 控制方法: '目测',
  }
  const e = toCanonical(legacy, '必测项')
  assert.equal(e.group, '必测项')
  assert.equal(e.name, '外观')
  assert.equal(e.quality, '无破损')
  assert.equal(e.instrument, '目视')
  assert.equal(e.req, '银嘉标准')
  assert.equal(e.inspect, 'IQC')
  assert.equal(e.measure, '退货')
  assert.equal(e.freq, '每批')
  assert.equal(e.sampling, '随机')
  assert.equal(e.content, '外观检查')
  assert.equal(e.method, '目测')
})

test('规范结构 → 规格书子项:只带 name/req/method/basis,出货计划专有字段不带过去', () => {
  const e = { ...emptyEntry(), group: '必测项', name: '外观', req: '银嘉标准', method: '目测', freq: '每批', content: '外观检查' }
  const sub = toSpecSub(e)
  assert.deepEqual(sub, { name: '外观', req: '银嘉标准', method: '目测', basis: '' })
})

test('规范结构 → 出货计划行:10 个中文键齐全,规格书没有的字段留空不丢结构', () => {
  const e = { ...emptyEntry(), group: '尺寸', name: '产品尺寸', req: '外径28±0.5', method: '游标卡尺', basis: '银嘉标准' }
  const row = toInspRow(e)
  assert.equal(row['控制项目'], '产品尺寸')
  assert.equal(row['控制标准及要求'], '外径28±0.5')
  assert.equal(row['控制方法'], '游标卡尺')
  assert.equal(row['质量控制内容'], '')
  assert.equal(row['检测仪器'], '')
  assert.equal(row['检测频率'], '')
  assert.equal(row['检验内容'], '')
  for (const k of ['控制项目', '质量控制内容', '检测仪器', '控制标准及要求', '检验', '不合格应对措施', '检测频率', '取样方式', '检验内容', '控制方法']) {
    assert.ok(k in row, `出货计划行缺列 ${k}`)
  }
})

test('投影互转:规格书形态与出货计划形态之间可无损转换(字段映射正确)', () => {
  // 规格书形态的条目投影到出货计划行,应落到对应列
  const fromSpec = toCanonical({ sub: '整体尺寸', req: '长210±1', method: '卡尺', basis: '银嘉标准' }, '尺寸')
  const inspRow = toInspRow(fromSpec)
  assert.equal(inspRow['控制项目'], '整体尺寸')
  assert.equal(inspRow['控制标准及要求'], '长210±1')
  // 出货计划形态的条目投影到规格书子项,应可作为子项勾选
  const fromInsp = toCanonical({ 控制项目: '外观', 控制标准及要求: '无破损', 控制方法: '目视' }, '必测项')
  const specSub = toSpecSub(fromInsp)
  assert.equal(specSub.name, '外观')
  assert.equal(specSub.req, '无破损')
  assert.equal(specSub.method, '目视')
})

test('规范结构可原样往返(幂等):已是 v2 的内容再解析不变', () => {
  const e = { ...emptyEntry(), group: '必测项', name: '外观', req: 'R', freq: 'F' }
  assert.equal(isCanonical(e), true)
  assert.deepEqual(toCanonical(e, '别的组'), e) // 已规范化时不再用 item 覆盖 group
})

test('坏内容/空内容不抛异常,退化为空条目(不能把界面打挂)', () => {
  for (const bad of [null, undefined, '', 'not-json', 123, []]) {
    const e = toCanonical(bad, '组')
    assert.equal(e.name, '')
    assert.equal(e.group, '组')
  }
})

test('规范结构的键集合稳定(CANONICAL_KEYS 是唯一真源,新增字段要同步改这里)', () => {
  const e = emptyEntry()
  assert.deepEqual(Object.keys(e).sort(), [...CANONICAL_KEYS].sort())
  assert.equal(e.v, 2)
})

/**
 * 规格书标准库「组序」——用户口径 2026-11-06:
 * 「把研发管理的规格书的检验项目的标准库里面的内容的排序按《测试项目汇总.xlsx》进行排序」
 *
 * 组序的真源是 `yj_std_lib.seq`(迁移 tools/migrate-testlib-spec-order-20261106.sql 按 Excel
 * 「序 号」列重编号:序号 n 的组 → seq 段 n*100,组内第 k 项 → n*100 + k*10)。
 * 内置常量(SPEC_TEST_LIB)的既有次序只作兜底:未跑种子的空库、或某组还没入库时用。
 * 之前只按常量排序,库里的 seq 完全不起作用 ⇒ 用户按 Excel 找「余氯性能测试」时,
 * 它排在 18 个组的第 17 位(Excel 是第 11 项),找不着。
 */
test('组序按库里的 seq(Excel 序号):余氯排在隔夜浸泡之后、VOC 之前', () => {
  const lib = [
    { name: '*外观', seq: 110 },
    { name: '*黑水及颗粒物测试', seq: 610 },
    { name: '隔夜浸泡口感/气味', seq: 910 },
    { name: '*余氯去除性能', seq: 1110 },
    { name: 'VOC性能测试', seq: 1810 },
    { name: '*卫生安全', seq: 2610 },
  ]
  const order = ['*外观', '*黑水及颗粒物测试', '隔夜浸泡口感/气味', 'VOC性能测试', '*余氯去除性能', '*卫生安全']
  assert.deepEqual(orderSpecGroups(lib, order).map((g) => g.name),
    ['*外观', '*黑水及颗粒物测试', '隔夜浸泡口感/气味', '*余氯去除性能', 'VOC性能测试', '*卫生安全'])
})

test('组序兜底:没有 seq 的组按内置常量次序,再按组名;常量里没有的缀后', () => {
  const lib = [{ name: '新自定义组' }, { name: 'B组', seq: null }, { name: 'A组' }]
  assert.deepEqual(orderSpecGroups(lib, ['B组', 'A组']).map((g) => g.name), ['B组', 'A组', '新自定义组'])
})

test('排序不改原数组(调用方还拿着它做别的)', () => {
  const lib = [{ name: 'b', seq: 20 }, { name: 'a', seq: 10 }]
  const out = orderSpecGroups(lib, [])
  assert.deepEqual(lib.map((g) => g.name), ['b', 'a'])
  assert.deepEqual(out.map((g) => g.name), ['a', 'b'])
})

/**
 * 母项归拢(用户口径 2026-11-06 追加):
 * 「新增录进去不会变体归拢到一起,所以会出现一个母项下的变体到处跑,都找不到,要根据组名来进行归拢」
 *
 * 现行库里的组名是**业务上同一项的不同写法**(生产库实测 37 组:尺寸/整体尺寸/*炭棒尺寸;
 * 余氯性能测试/*余氯去除性能;阻垢去除性能/阻垢去除性能测试/*阻垢去除率测试;
 * *PFOA&PFOS去除性能测试/*PFOA/PFOS去除测试/PFOA&PFOS去除性能测试 …)。
 * 只按组名字符串分组 ⇒ 一个母项散成 2~3 块、还被 seq 甩到列表末尾。
 * 口径:按《测试项目汇总.xlsx》的 26 个「检验项目」做母项,组名→母项查表(SPEC_MOTHERS);
 *   表里没有的组名照旧独立成组、排在最后(不猜、不错并)。
 */
test('组名 → 母项:变体写法都归到 Excel 的同一项', () => {
  assert.equal(specMotherOf('*炭棒尺寸')?.no, 2)
  assert.equal(specMotherOf('整体尺寸')?.no, 2)
  assert.equal(specMotherOf('尺寸')?.name, '尺寸')
  assert.equal(specMotherOf('余氯性能测试')?.no, 11)
  assert.equal(specMotherOf('*余氯去除性能')?.no, 11)
  assert.equal(specMotherOf('阻垢去除率测试')?.no, 13)
  assert.equal(specMotherOf('*PFOA/PFOS去除测试')?.no, 22)
  assert.equal(specMotherOf('抗堵性能'), null)
})

test('归拢:同母项的变体合成一组,组序=Excel 序号,变体名挂在行上', () => {
  const lib = [
    { name: '*余氯去除性能', seq: 430, subs: [{ name: '初始去除率', req: 'R1' }, { name: '除余氯寿命', req: 'R2' }] },
    { name: '余氯性能测试', seq: 0, subs: [{ name: '', req: 'R0' }] },
    { name: '*炭棒尺寸', seq: 20, subs: [{ name: '', req: '外径' }, { name: '', req: '内径' }] },
    { name: '尺寸', seq: 0, subs: [{ name: '', req: '产品尺寸' }] },
    { name: '整体尺寸', seq: 0, subs: [{ name: '', req: '整体' }] },
  ]
  const out = clusterSpecGroups(lib)
  assert.deepEqual(out.map((g) => g.name), ['尺寸', '余氯性能测试'])
  assert.equal(out[0].subs.length, 4)
  // 母项同名的行不加前缀;变体行带「变体名 · 」
  assert.deepEqual(out[0].subs.map((s) => s.groupLabel), ['', '整体尺寸', '炭棒尺寸', '炭棒尺寸'])
  assert.deepEqual(out[1].subs.map((s) => s.groupLabel), ['', '余氯去除性能', '余氯去除性能'])
})

test('归拢:表里没有的组名独立成组,排在 26 项之后(不猜、不并)', () => {
  const lib = [{ name: '抗堵性能', seq: 630, subs: [{ name: '', req: 'X' }] },
    { name: '*外观', seq: 10, subs: [{ name: '', req: 'Y' }] }]
  const out = clusterSpecGroups(lib)
  assert.deepEqual(out.map((g) => g.name), ['外观', '抗堵性能'])
})
