import test from 'node:test'
import assert from 'node:assert/strict'
import { invRowsOf, pickInvCarry, pickInvKind, invCarryPair, INV_CARRY } from './invCarry.js'

// 背景(2026-10-14 用户报障):
//   成型工艺清单「成型配方」页的 物料编号 / 物料名称 是普通文本、没配参照,
//   手输编码不带出名称、手输名称不带出编码。
//   数据源 = 商品档案 INV(表 bs_inv,列 存货编码 / 存货名称)。
//   口径(用户原话「输入物料编号无法自动录入对应物料名称…」):
//     · 双向;
//     · **只有唯一命中才带出**;查不到 / 查到多条 ⇒ 不带出(调用方保持用户输入不动、不弹错);
//     · 对照时按 trim 后的**全等**比 —— 后端 condition 对普通文本走 LIKE,前端必须自己收紧。

const archiveRes = (rows) => ({ totalSize: rows.length, list: [{ 编号: '商品', detail: { items: rows } }] })

test('档案响应(archive 单单据契约)拍平成行', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'M-001', 存货名称: '炭棒' }]))
  assert.deepEqual(rows, [{ 存货编码: 'M-001', 存货名称: '炭棒' }])
})

test('档案响应形状不认识时返回空数组(不炸)', () => {
  assert.deepEqual(invRowsOf(null), [])
  assert.deepEqual(invRowsOf({}), [])
  assert.deepEqual(invRowsOf({ list: [] }), [])
})

test('物料编号 → 物料名称:唯一命中才带出', () => {
  const rows = invRowsOf(archiveRes([
    { 存货编码: 'M-001', 存货名称: '炭棒' },
    { 存货编码: 'M-003', 存货名称: '炭纤维' },
  ]))
  assert.equal(pickInvCarry(rows, '物料编号', 'M-001'), '炭棒')
  assert.equal(pickInvCarry(rows, '物料编号', 'M-003'), '炭纤维')
})

test('物料名称 → 物料编号:反方向同样唯一命中才带出', () => {
  const rows = invRowsOf(archiveRes([
    { 存货编码: 'M-001', 存货名称: '炭棒' },
    { 存货编码: 'M-003', 存货名称: '炭纤维' },
  ]))
  assert.equal(pickInvCarry(rows, '物料名称', '炭纤维'), 'M-003')
})

test('查不到(编码还没建档)⇒ 返回空串,调用方保持用户输入不动', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'M-001', 存货名称: '炭棒' }]))
  assert.equal(pickInvCarry(rows, '物料编号', 'M-999'), '')
})

test('命中多条(同名/重复编码)⇒ 返回空串,不猜', () => {
  const dup = invRowsOf(archiveRes([
    { 存货编码: 'M-001', 存货名称: '炭棒' },
    { 存货编码: 'M-001', 存货名称: '炭棒(旧)' },
  ]))
  assert.equal(pickInvCarry(dup, '物料编号', 'M-001'), '')
  const dupName = invRowsOf(archiveRes([
    { 存货编码: 'M-001', 存货名称: '炭棒' },
    { 存货编码: 'M-002', 存货名称: '炭棒' },
  ]))
  assert.equal(pickInvCarry(dupName, '物料名称', '炭棒'), '')
})

test('用户输入为空/纯空格 ⇒ 不带出(也不发查询)', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'M-001', 存货名称: '炭棒' }]))
  assert.equal(pickInvCarry(rows, '物料编号', ''), '')
  assert.equal(pickInvCarry(rows, '物料编号', '   '), '')
  assert.equal(pickInvCarry(rows, '物料编号', null), '')
})

test('前后空格与档案列的尾随空格都按 trim 后全等比(bs_inv 是 nchar/手工导入)', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'M-001 ', 存货名称: ' 炭棒' }]))
  assert.equal(pickInvCarry(rows, '物料编号', ' M-001'), '炭棒')
})

test('子串不算命中(LIKE 会串码,前端必须收紧成全等)', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'XM-001', 存货名称: '别的' }]))
  assert.equal(pickInvCarry(rows, '物料编号', 'M-001'), '')
})

test('档案里对侧列为空 ⇒ 不带出(不写空值把用户已有内容抹掉)', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'M-001', 存货名称: '' }]))
  assert.equal(pickInvCarry(rows, '物料编号', 'M-001'), '')
})

test('非这两个列(别的明细列)一律不参与', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'M-001', 存货名称: '炭棒' }]))
  assert.equal(pickInvCarry(rows, '实际添加比例', 'M-001'), '')
  assert.equal(pickInvCarry(rows, '物料种类', '炭棒'), '')
})

test('列映射口径钉死:明细列 ↔ 商品档案列(含种类带出源 所属类别)', () => {
  assert.deepEqual(INV_CARRY, {
    物料编号: { match: '存货编码', out: '存货名称', kind: '所属类别' },
    物料名称: { match: '存货名称', out: '存货编码', kind: '所属类别' },
  })
})

/* ── 物料种类也按档案带出(2026-10-16 用户口径)────────────────────────────────
   原话:「在成型工艺清单填写配方表的物料信息的时候,手动填写物料编码应该带出对应的物料类别
          以及物料名称,把填写框的物料种类的下拉框改为普通文本框」。
   实测(HSDZ_MES.bs_inv):YJ-LL-003 → 存货名称 胶粉、所属类别 胶粉;
                            YJ-SLD-012 → 超高分子量聚乙烯、所属类别 胶粉。
   页 2 配方表原先只带对侧那一格 ⇒ 物料名称 有值、物料种类 一直空着(用户截图即此),本次补上。 */
test('物料编号 → 物料种类:档案「所属类别」带出(两个方向都带)', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'YJ-LL-003', 存货名称: '胶粉', 所属类别: '胶粉' }]))
  assert.equal(pickInvKind(rows, '物料编号', 'YJ-LL-003', ''), '胶粉')
  assert.equal(pickInvKind(rows, '物料名称', '胶粉', ''), '胶粉', '按名称填的那一头同样带出')
})

test('档案类别引擎认不出来 ⇒ 不带出(带进去会让料位静默算错,见 materialKinds.js 注释)', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'B-001', 存货名称: '纸箱', 所属类别: '包装材料' }]))
  assert.equal(pickInvKind(rows, '物料编号', 'B-001', ''), '')
})

test('种类这格人手填过就不动它;查不到/重码/空输入同样不动', () => {
  const rows = invRowsOf(archiveRes([{ 存货编码: 'YJ-LL-003', 存货名称: '胶粉', 所属类别: '胶粉' }]))
  assert.equal(pickInvKind(rows, '物料编号', 'YJ-LL-003', '炭粉'), '', '人手填的种类优先,不许被档案覆盖')
  assert.equal(pickInvKind(rows, '物料编号', 'YJ-LL-003', '  '), '胶粉', '空白(含纯空格)算没填')
  assert.equal(pickInvKind(rows, '物料编号', 'YJ-999', ''), '')
  assert.equal(pickInvKind(rows, '物料编号', '', ''), '')
  const dup = invRowsOf(archiveRes([
    { 存货编码: 'YJ-LL-003', 存货名称: '胶粉', 所属类别: '胶粉' },
    { 存货编码: 'YJ-LL-003', 存货名称: '胶粉(旧)', 所属类别: '炭粉' },
  ]))
  assert.equal(pickInvKind(dup, '物料编号', 'YJ-LL-003', ''), '')
  assert.equal(pickInvKind(rows, '实际添加比例', 'YJ-LL-003', ''), '')
})

// 生效范围:只有**同一张明细表里这两列都在**才启用(库里实测只有成型工艺清单的配方表两列齐全),
// 别的明细表(组装 BOM 只有 物料编号、来料检验单只有 物料名称…)不受影响。
test('同一张表两列齐全 ⇒ 启用;缺一列 ⇒ 不启用', () => {
  assert.deepEqual(invCarryPair([{ key: '序号' }, { key: '物料编号' }, { key: '物料名称' }]),
    ['物料编号', '物料名称'])
  assert.equal(invCarryPair([{ key: '物料编号' }, { key: '物料规格' }]), null)
  assert.equal(invCarryPair([{ key: '物料名称' }]), null)
  assert.equal(invCarryPair([]), null)
  assert.equal(invCarryPair(null), null)
})
