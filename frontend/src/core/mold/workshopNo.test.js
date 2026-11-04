/**
 * workshopNo.test.js — 「车间」两套写法归一 + 按车间筛模具行(2026-11-04)
 *
 * 背景:单据「生产车间」来自部门档案(1#车间),生产模具表 rd_sinter_tolerance.车间 存裸号(1/2/3/4),
 *   原实现只做字符串精确比较 ⇒ 选完车间一条型号都筛不出来(60 行模具数据全用不上)。
 *   口径 A(用户定):两边都不改,代码归一。
 */
import assert from 'node:assert/strict'
import test from 'node:test'

import { workshopNo, workshopMatches } from './workshopNo.js'
import { sinterRowsForWorkshop } from './recipeSheet.js'

const ROWS = [
  { 车间: '1', 型号: '48*25', 炭棒外径: '48', 炭棒外径公差: '±0.5', 炭棒内径: '24.5', 炭棒内径公差: '±0.5' },
  { 车间: '1', 型号: '56.5*30', 炭棒外径: '56.5', 炭棒外径公差: '±0.3', 炭棒内径: '30', 炭棒内径公差: '±0.3' },
  { 车间: '2', 型号: '27.5*12', 炭棒外径: '27.5', 炭棒外径公差: '±0.2', 炭棒内径: '12', 炭棒内径公差: '±0.2' },
  // 两车间共用:写法 1/3
  { 车间: '1/3', 型号: '40*20', 炭棒外径: '40', 炭棒外径公差: '±0.4', 炭棒内径: '20', 炭棒内径公差: '±0.4' },
  { 车间: '3', 型号: '33.5*15', 炭棒外径: '33.5', 炭棒外径公差: '±0.5', 炭棒内径: '15', 炭棒内径公差: '±0.5' },
]

test('workshopNo:取开头的车间号,不猜带字母的编码', () => {
  assert.equal(workshopNo('1#车间'), '1')
  assert.equal(workshopNo('4#车间'), '4')
  assert.equal(workshopNo('1'), '1')
  assert.equal(workshopNo(' 2 '), '2')
  assert.equal(workshopNo('01'), '1', '前导 0 视为同一车间')
  assert.equal(workshopNo('3车间'), '3')
  // 前置字母一律不猜 —— D05 是"1#车间"的部门编码,绝不能当成 5 号车间
  assert.equal(workshopNo('D05'), '')
  assert.equal(workshopNo(''), '')
  assert.equal(workshopNo(null), '')
  assert.equal(workshopNo(undefined), '')
})

test('workshopMatches:1#车间 ≡ 1;1/3 两段都算;跨车间不算', () => {
  assert.equal(workshopMatches('1', '1#车间'), true)
  assert.equal(workshopMatches('1/3', '3#车间'), true, '共用行对 3 号车间也算命中')
  assert.equal(workshopMatches('1/3', '1#车间'), true)
  assert.equal(workshopMatches('2', '1#车间'), false)
  assert.equal(workshopMatches('1', 'D05'), false, '取不到车间号就不猜')
  assert.equal(workshopMatches('1', ''), false)
})

test('sinterRowsForWorkshop:写法一致时行为与改造前一致(精确优先)', () => {
  const got = sinterRowsForWorkshop(ROWS, '2')
  assert.deepEqual(got.map((r) => r.型号), ['27.5*12'])
})

test('sinterRowsForWorkshop:单据是 1#车间 时能筛到 1 号车间的型号(含共用行)', () => {
  const got = sinterRowsForWorkshop(ROWS, '1#车间')
  assert.deepEqual(got.map((r) => r.型号), ['48*25', '56.5*30', '40*20'])
})

test('sinterRowsForWorkshop:车间为空 ⇒ 返回全部(与改造前一致)', () => {
  assert.equal(sinterRowsForWorkshop(ROWS, '').length, ROWS.length)
  assert.equal(sinterRowsForWorkshop(ROWS, null).length, ROWS.length)
})

test('sinterRowsForWorkshop:取不到车间号的编码不会错配到任何行', () => {
  assert.equal(sinterRowsForWorkshop(ROWS, 'D05').length, 0)
})