import test from 'node:test'
import assert from 'node:assert/strict'
import { menuTree } from './menus.js'

/** 研发管理二级目录:按研发流程分组(项目管理 / 测试记录 / 产品文件 / 共享文件) */
const rd = menuTree.find((node) => node.code === 'rd')
const group = (code) => (rd.children || []).find((node) => node.code === code)
const leafCodes = (node) => (node.children || []).map((child) => child.panelCode || child.code)

test('研发管理四个二级分组,顺序=项目管理/测试记录/产品文件/共享文件', () => {
  assert.deepEqual((rd.children || []).map((c) => c.code), ['rdProject', 'rdTest', 'rdFiles', 'rdShare'])
  assert.deepEqual((rd.children || []).map((c) => c.title), ['项目管理', '测试记录', '产品文件', '共享文件'])
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
  // 2026-09-30:RD_DOM_TEST 由「内部委托测试申请单」升级为**一张单三个页签**的「测试申请单」
  // (面板编码不变 ⇒ 权限行/单据表/单据编号前缀全沿用);菜单名必须跟着改,否则用户找不到。
  assert.deepEqual((lab.children || []).map((c) => c.title), [
    '加标水配置记录表', '测试申请单', '设备使用登记表', '仪器使用记录表',
  ])
  assert.ok(!JSON.stringify(menuTree).includes('内部委托测试申请单'), '旧菜单名不应残留')
})

test('产品文件组 7 张(2026-09-30 下架 样品编号表)', () => {
  assert.deepEqual(leafCodes(group('rdFiles')), [
    'RD_PROD_INFO', 'RD_MOLD_PROC', 'RD_SPEC_DOC', 'RD_ASM_PROC', 'RD_INSP_PLAN',
    'RD_PROD_DOCLIST', 'RD_CHANGE',
  ])
  // 下线面板不得从别处溜回导航(RD_MOLD_FORMULA/RD_ASM_BOM 仍是合法面板,只是没有菜单入口)
  const all = JSON.stringify(menuTree)
  assert.ok(!all.includes('RD_MOLD_FORMULA'), '菜单树里不应再有 RD_MOLD_FORMULA 入口')
  assert.ok(!all.includes('RD_ASM_BOM'), '菜单树里不应再有 RD_ASM_BOM 入口')
  // 2026-09-30 用户口径「样品编号表删掉」:面板已下架(元数据同批清理),
  // 菜单里不得再有它的入口或标题残留。
  assert.ok(!all.includes('RD_SAMPLE_NO'), '菜单树里不应再有 RD_SAMPLE_NO 入口')
  assert.ok(!all.includes('样品编号表'), '菜单树里不应再有「样品编号表」标题')
})

test('共享文件组:共享文件库(专用视图,path 非 panelx)', () => {
  const share = group('rdShare')
  assert.deepEqual(leafCodes(share), ['RD_SHARE_FILE'])
  assert.ok(!share.children[0].path.includes('/panelx/'), '共享文件库走专用路由 /rd/shareFile')
})

test('二级目录里不再出现"叶子项与分组混排"', () => {
  for (const node of rd.children || []) {
    assert.ok(Array.isArray(node.children) && node.children.length > 0, `${node.title} 应为分组`)
  }
})

/**
 * 2026-09-18:新增 产品文件列表 与 样品编号表(设计对照的 2 张新面板)⇒ 21 → 23 张。
 * 2026-09-21:新增 产品变更申请单 RD_CHANGE ⇒ 23 → 24 张。
 * 2026-09-30:下架 样品编号表 RD_SAMPLE_NO(用户口径「样品编号表删掉」)⇒ 24 → 23 张。
 * 计数断言保留价值:防止面板被误删/误加而不自知。
 */
test('研发管理 23 个面板一个不少(24 - 下架 样品编号表)', () => {
  const collect = (node) => (node.children || []).flatMap((child) => (child.children ? collect(child) : [child.panelCode]))
  const codes = collect(rd).filter(Boolean)
  assert.equal(codes.length, 23)
  assert.equal(new Set(codes).size, 23)
})
