import test from 'node:test'
import assert from 'node:assert/strict'
import { menuTree } from './menus.js'

/** 研发管理二级目录:按研发流程分三组(项目管理 / 测试记录 / 产品文件) */
const rd = menuTree.find((node) => node.code === 'rd')
const group = (code) => (rd.children || []).find((node) => node.code === code)
const leafCodes = (node) => (node.children || []).map((child) => child.panelCode || child.code)

test('研发管理只有三个二级分组,顺序=项目管理/测试记录/产品文件', () => {
  assert.deepEqual((rd.children || []).map((c) => c.code), ['rdProject', 'rdTest', 'rdFiles'])
  assert.deepEqual((rd.children || []).map((c) => c.title), ['项目管理', '测试记录', '产品文件'])
})

test('项目管理组:立项申请 → 项目实施计划 → 项目进度查询', () => {
  assert.deepEqual(leafCodes(group('rdProject')), ['RD_APPROVAL', 'RD_PLAN', 'RD_PROGRESS'])
})

test('测试记录组下挂数据记录表 8 张与实验室使用记录表 4 张', () => {
  const test1 = group('rdTest')
  assert.deepEqual((test1.children || []).map((c) => c.code), ['rdData', 'rdLab'])
  const data = test1.children.find((c) => c.code === 'rdData')
  const lab = test1.children.find((c) => c.code === 'rdLab')
  assert.equal((data.children || []).length, 8)
  assert.equal((lab.children || []).length, 4)
})

test('产品文件组仍是 7 张,顺序不变', () => {
  assert.deepEqual(leafCodes(group('rdFiles')), [
    'RD_PROD_INFO', 'RD_MOLD_PROC', 'RD_MOLD_FORMULA', 'RD_SPEC_DOC',
    'RD_ASM_BOM', 'RD_ASM_PROC', 'RD_INSP_PLAN',
  ])
})

test('二级目录里不再出现"叶子项与分组混排"', () => {
  for (const node of rd.children || []) {
    assert.ok(Array.isArray(node.children) && node.children.length > 0, `${node.title} 应为分组`)
  }
})

test('研发管理 22 个面板一个不少', () => {
  const collect = (node) => (node.children || []).flatMap((child) => (child.children ? collect(child) : [child.panelCode]))
  const codes = collect(rd).filter(Boolean)
  assert.equal(codes.length, 22)
  assert.equal(new Set(codes).size, 22)
})
