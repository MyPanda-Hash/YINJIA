import test from 'node:test'
import assert from 'node:assert/strict'
import { invRowsOf, pickInvCarry, invCarryPair, INV_CARRY } from './invCarry.js'

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

test('列映射口径钉死:明细列 ↔ 商品档案列', () => {
  assert.deepEqual(INV_CARRY, {
    物料编号: { match: '存货编码', out: '存货名称' },
    物料名称: { match: '存货名称', out: '存货编码' },
  })
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
