import test from 'node:test'
import assert from 'node:assert/strict'
import { invFillFor, invRowsOfKind, invSearchOptions, materialClearFor, materialFillFor, uniqueInvRowBy } from './recipeRows.js'

/**
 * 配方计算弹窗「物料行」的**种类前置筛选**(2026-10-15 用户口径)。
 *
 * 用户原话:「现在的数据是 100 多条在商品里面,**实际上的服务器上的数据是几千条**,
 *   现在加上一个优化的点,**可以先通过前面的物料种类先进行一个筛选,
 *   方便后面的物料编码、物料名称的查找**」。
 *
 * 数据事实(2026-10-15 直接打本机 8090 的 /px/queryFormDataList 实测,账套 YJ_TEST / YJ 都是 114 行):
 *   · condition {}            → 114 行(全量;生产服务器几千行,`QueryService.ARCH_LOAD_CAP` 注释记的 3850 行)
 *   · condition {所属类别:炭粉}  → 26 行(炭粉 26 / 功能料-粉末 16 / 功能料-颗粒 30 / 胶粉 12 / 折算物料 5)
 *   · condition {存货编码:M-001} → **2 行**(YJ-HSM-001、M-001)⇒ 后端对普通文本走 `LIKE %值%` 确实会多带
 *   · keyword 'M-00'          → 11 行;keyword '' → 114 行(**空关键字等于不过滤**,前端不许发空关键字)
 *
 * 所以这层纯函数钉三件事:
 *   ① 服务端 condition 只当**收窄**,本地必须按 `所属类别` trim 后全等再筛一遍(invRowsOfKind);
 *   ② 下拉候选**有上限**(invSearchOptions 的 cap)—— 几千行档案不许一次性渲成 option;
 *   ③ 「物料编号 ↔ 物料名称」两格**不许互相打架**(materialFillFor:被操作的那格永不回写 + 值没变就不写)。
 */

const INV = (code, name, kind) => ({ 存货编码: code, 存货名称: name, 所属类别: kind })

/* ── ① 种类收窄:LIKE 多带的必须在本地剔掉 ─────────────────────────────────────── */

test('种类筛选 · 只留 trim 后全等的行(后端 LIKE %值% 会多带,不能信它返回多少)', () => {
  const rows = [
    INV('A', '甲', '炭粉'),
    INV('B', '乙', '功能料-粉末新'),   // 含子串「功能料-粉末」⇒ 服务端 LIKE 会带回来
    INV('C', '丙', '功能料-粉末'),
    INV('D', '丁', '包装材料'),
  ]
  assert.deepEqual(invRowsOfKind(rows, '功能料-粉末').map((r) => r['存货编码']), ['C'],
    '服务端把「功能料-粉末新」也带回来了 —— 本地按 所属类别 全等筛才是真判据')
  assert.deepEqual(invRowsOfKind(rows, '炭粉').map((r) => r['存货编码']), ['A'])
  assert.deepEqual(invRowsOfKind(rows, '折算物料'), [], '这一类一条都没有 ⇒ 空候选(不是"退回全量")')
})

test('种类筛选 · 前后空格容忍(SQL Server 定长列尾空格),空种类给空数组而不是全量', () => {
  const rows = [INV('A', '甲', '  炭粉  '), INV('B', '乙', '炭粉'), INV('C', '丙', '炭粉尾')]
  assert.deepEqual(invRowsOfKind(rows, '炭粉').map((r) => r['存货编码']), ['A', 'B'])
  assert.deepEqual(invRowsOfKind(rows, ' 炭粉 ').map((r) => r['存货编码']), ['A', 'B'])
  // 未选种类时**不许**从这条路拿全量:几千行会顺着它渲进下拉。要全量请走 remote 搜索。
  assert.deepEqual(invRowsOfKind(rows, ''), [])
  assert.deepEqual(invRowsOfKind(rows, null), [])
  assert.deepEqual(invRowsOfKind(null, '炭粉'), [])
})

/* ── ② 下拉候选:值/显示/命中口径 ────────────────────────────────────────────── */

test('编号候选 · 值=存货编码、显示「编码 — 名称」,关键字命中编码**或**名称(两头都能找)', () => {
  const rows = [INV('M-001', '炭棒', '折算物料'), INV('YJ-TP-002', 'TP311胶粉', '胶粉')]
  assert.deepEqual(invSearchOptions(rows, '物料编号', '').options, [
    { value: 'M-001', label: 'M-001 — 炭棒' },
    { value: 'YJ-TP-002', label: 'YJ-TP-002 — TP311胶粉' },
  ])
  assert.deepEqual(invSearchOptions(rows, '物料编号', 'M-001').options, [{ value: 'M-001', label: 'M-001 — 炭棒' }])
  assert.deepEqual(invSearchOptions(rows, '物料编号', '胶粉').options,
    [{ value: 'YJ-TP-002', label: 'YJ-TP-002 — TP311胶粉' }],
    '用户记不住编码只记得名字 ⇒ 编号格也要按名称命中(下拉里本来就显示名称)')
})

test('候选 · 关键字是**子串**命中(与后端 LIKE 同口径)⇒ 候选只是候选,判等另算', () => {
  // 实测(本机 8090,账套 YJ_TEST):keyword 'M-00' → 11 行,里面就有 `YJ-HSM-002`(它含子串 `m-00`)。
  const rows = [INV('M-001', '炭棒', '折算物料'), INV('YJ-HSM-002', 'TP311胶粉', '胶粉')]
  assert.deepEqual(invSearchOptions(rows, '物料编号', 'M-00').options.map((o) => o.value), ['M-001', 'YJ-HSM-002'],
    '下拉多给一条不致命(候选而已),但落库/带出必须靠 trim 后全等的唯一命中')
  assert.equal(uniqueInvRowBy(rows, '存货编码', 'M-00'), null, '所以选中/手填后的判等仍是全等,不是子串')
})

test('名称候选 · 值=存货名称(选中后由调用方回填编号),空名称行不出现在候选里', () => {
  const rows = [INV('M-001', '炭棒', '折算物料'), INV('X-9', '', '胶粉')]
  assert.deepEqual(invSearchOptions(rows, '物料名称', '').options, [{ value: '炭棒', label: '炭棒' }],
    '档案里没有名称的行没法在"按名称找"的下拉里被认出来 ⇒ 不出现')
  assert.deepEqual(invSearchOptions(rows, '物料名称', '炭').options, [{ value: '炭棒', label: '炭棒' }])
})

test('候选 · 关键字大小写无关(后端 LIKE 实测大小写不敏感,前端同口径)', () => {
  const rows = [INV('YJ-HSM-002', 'TP311胶粉', '胶粉'), INV('m-001', '小写码', '炭粉')]
  assert.deepEqual(invSearchOptions(rows, '物料编号', 'm-001').options.map((o) => o.value), ['m-001'])
  assert.deepEqual(invSearchOptions(rows, '物料编号', 'yj-hsm').options.map((o) => o.value), ['YJ-HSM-002'])
  assert.deepEqual(invSearchOptions(rows, '物料编号', 'tp311').options.map((o) => o.value), ['YJ-HSM-002'])
})

test('候选 · 空编码的档案行不是可录的物料(两格都不给),同值只留第一条', () => {
  const rows = [
    INV('', '没编码的不算物料', '炭粉'),          // 编码才是物料的身份 ⇒ 两格都不给
    INV('M-001', '炭棒', '折算物料'),
    INV('M-001', '重码的第二条', '折算物料'),      // 同编码
    INV('M-002', '重码的第二条', '折算物料'),      // 同名称(不同编码)
  ]
  assert.deepEqual(invSearchOptions(rows, '物料编号', '').options.map((o) => o.value), ['M-001', 'M-002'],
    '下拉里两个同值项会让人以为选错了 ⇒ 同编码只留第一条')
  assert.deepEqual(invSearchOptions(rows, '物料名称', '').options.map((o) => o.value), ['炭棒', '重码的第二条'],
    '两个同名称项在"按名称找"的下拉里分辨不出来 ⇒ 也只留第一条')
})

/* ── ③ 规模:候选必须封顶,几千行不许一次性渲 ──────────────────────────────────── */

test('候选封顶 · 200 行档案只给 cap 项,matched 报总数(界面据此提示"继续输入缩小范围")', () => {
  const rows = Array.from({ length: 200 }, (_, i) => INV(`P-${String(i).padStart(3, '0')}`, `料${i}`, '包装材料'))
  const all = invSearchOptions(rows, '物料编号', '')
  assert.equal(all.options.length, 50, '默认 cap=50 —— 一次最多渲 50 个 el-option,不受档案行数影响')
  assert.equal(all.matched, 200, 'matched 是命中总数(前端提示"还有 150 条")')
  assert.deepEqual(invSearchOptions(rows, '物料编号', '', 5).options.map((o) => o.value),
    ['P-000', 'P-001', 'P-002', 'P-003', 'P-004'], 'cap 可传(测试用)')
  const one = invSearchOptions(rows, '物料编号', 'P-123')
  assert.equal(one.options.length, 1)
  assert.equal(one.matched, 1)
})

test('候选 · 非数组/undefined 给空候选,不抛', () => {
  for (const bad of [null, undefined, '不是数组', 0]) {
    assert.deepEqual(invSearchOptions(bad, '物料编号', 'x'), { options: [], matched: 0 })
  }
  assert.deepEqual(invSearchOptions([INV('A', '甲', '炭粉')], '不认识的格', 'x'), { options: [], matched: 0 })
})

/* ── ④ 防打架:两格互为反向带出,不许互相触发 ──────────────────────────────────── */

test('防打架 · 选编号仍沿用既有"只补空格"口径(人手填的名称不被档案覆盖)', () => {
  const inv = INV('M-001', '炭棒', '折算物料')
  assert.deepEqual(materialFillFor({ 物料编号: 'M-001' }, inv, '物料编号'), invFillFor({ 物料编号: 'M-001' }, inv),
    '选编号这条路与 2026-10-15 的实现逐字一致(不因为加了名称下拉就改掉既有口径)')
  assert.deepEqual(materialFillFor({ 物料编号: 'M-001', 物料名称: '手填的名' }, inv, '物料编号'),
    { 物料种类: '折算物料' })
})

test('防打架 · **被操作的那一格永不回写** —— 选名称只写编号/种类,绝不碰名称本身', () => {
  const inv = INV('M-001', '炭棒', '折算物料')
  const fill = materialFillFor({ 物料名称: '炭棒' }, inv, '物料名称')
  assert.deepEqual(fill, { 物料编号: 'M-001', 物料种类: '折算物料' })
  assert.equal('物料名称' in fill, false, '回写名称就是"名称 change → 写名称 → 又触发 change"的起点')
  assert.equal('物料编号' in materialFillFor({ 物料编号: 'M-001' }, inv, '物料编号'), false,
    '编号侧同理:不许把自己再写一遍')
})

test('防打架 · **值真的不同才写** —— 同值不回写(没有新行为的写只会白触发一轮)', () => {
  const inv = INV('M-001', '炭棒', '折算物料')
  assert.deepEqual(materialFillFor({ 物料名称: '炭棒', 物料编号: 'M-001', 物料种类: '折算物料' }, inv, '物料名称'),
    {}, '两格都已经是要写的值 ⇒ 一个格都不动')
  assert.deepEqual(materialFillFor({ 物料名称: '炭棒', 物料编号: 'M-001', 物料种类: ' 折算物料 ' }, inv, '物料名称'),
    {}, 'trim 后相同也算"没变"(不然定长列的尾空格会来回写)')
  assert.deepEqual(materialFillFor({ 物料名称: '炭棒', 物料编号: '  旧编号 ' }, inv, '物料名称'),
    { 物料编号: 'M-001', 物料种类: '折算物料' },
    '编号真的不一样 ⇒ 必须跟着名称走(留着旧编号 = 新名的料配旧编号,静默错数);种类是空格顺带补上')
})

test('防打架 · 双向收敛:编号带出名称后再走一遍名称那条路,一个格都不动(有不动点)', () => {
  const inv = INV('M-001', '炭棒', '折算物料')
  const row = { 物料编号: '', 物料名称: '', 物料种类: '' }
  const steps = []
  for (let i = 0; i < 6; i++) {                     // 交替模拟两格各自的 change 处理器
    const side = i % 2 === 0 ? '物料编号' : '物料名称'
    row[side] = side === '物料编号' ? 'M-001' : '炭棒'   // 用户/控件把这一格设成选中的值
    const fill = materialFillFor(row, inv, side)
    steps.push({ side, wrote: Object.keys(fill) })
    Object.assign(row, fill)
  }
  assert.deepEqual(steps[2].wrote, [], '第 3 步(编号侧第 2 轮)就该一个格都不写了 ⇒ 环路在第 2 步终止')
  assert.deepEqual(row, { 物料编号: 'M-001', 物料名称: '炭棒', 物料种类: '折算物料' },
    '收敛到的就是"编号+名称+种类三格一致"的稳定态')
})

/* ── ⑤ 名称侧的唯一命中:同名两条谁也不认(与编码侧同口径) ───────────────────── */

test('名称侧唯一命中 · 同名两条谁都不可选,不猜;取不到档案时一个格都不写', () => {
  const rows = [INV('M-001', '炭棒', '折算物料'), INV('M-002', '炭棒', '折算物料')]
  assert.equal(uniqueInvRowBy(rows, '存货名称', '炭棒'), null, '重名 ⇒ 不猜哪条对(宁可不带,不带错)')
  assert.equal(uniqueInvRowBy(rows, '存货名称', '炭棒'), null, '重名两张同理')
  assert.equal(uniqueInvRowBy([INV('M-1', '炭棒', '炭粉')], '存货名称', ' 炭棒 ')?.['存货编码'], 'M-1',
    '唯一命中时前后空格要能容忍')
  assert.equal(uniqueInvRowBy(rows, '存货名称', ''), null)
  assert.equal(uniqueInvRowBy(rows, '存货名称', '查无此名'), null)
  assert.deepEqual(materialFillFor({ 物料名称: '炭棒' }, null, '物料名称'), {},
    '档案查不到(读不到/没有)⇒ 什么都不动,不清空用户输入')
  assert.deepEqual(materialFillFor({ 物料名称: '炭棒' }, INV('M-001', '炭棒', '其它类别'), '物料名称'),
    { 物料编号: 'M-001' }, '档案里的类别不是引擎认的词 ⇒ 只回填编号,种类不猜')
})

/* ── ④ 清空要连带清对侧(2026-10-30 用户口径)────────────────────────────────────────
   原话:「另一个配方计算的叉掉分类、编号、名称自己退回空白还没有做，现在就是 X烧结 实现了」。
   带出是"挑中就填"，清空是它的另一半 —— 只剩一半的值比空着更糟:
   屏幕上写着「YJ-XXX 英克瑞斯椰壳炭」，实际只清了编号，下次保存就是旧名字配空编号。 */

test('清空 · 清掉编号或名称,对侧跟着退回空白(只剩一半 = 静默错数)', () => {
  const row = { 物料种类: '炭粉', 物料编号: 'YJ-YKRS-001', 物料名称: '英克瑞斯椰壳炭', 设计添加量: '45' }
  assert.deepEqual(materialClearFor(row, '物料编号'), { 物料名称: '' }, '清编号 ⇒ 名称必须一起空')
  assert.deepEqual(materialClearFor(row, '物料名称'), { 物料编号: '' }, '清名称 ⇒ 编号必须一起空')
  assert.deepEqual(materialClearFor({ 物料编号: 'A' }, '物料编号'), {},
    '对侧本来就空 ⇒ 一个格都不写(免得白触发一轮 change)')
})

test('清空 · 清掉物料种类时编号与名称一起退空;选上种类时什么都不清', () => {
  const row = { 物料种类: '炭粉', 物料编号: 'YJ-YKRS-001', 物料名称: '英克瑞斯椰壳炭', 设计添加量: '45' }
  assert.deepEqual(materialClearFor(row, '物料种类'), { 物料编号: '', 物料名称: '' },
    '候选范围是靠种类收窄的,种类没了还留着那对编号/名称 = 假装它仍属于刚被清掉的类别')
  // 选上(而不是清空)种类时由 onKindChange 走另一条路:只作废旧候选,不许抹掉已录的物料
  assert.deepEqual(materialClearFor({ 物料编号: 'A', 物料名称: '甲' }, '设计添加量'), {},
    '清别的格(数量等)不许动物料三格')
  assert.deepEqual(materialClearFor(null, '物料编号'), {}, '空行不炸')
  assert.deepEqual(materialClearFor(row, ''), {})
})
