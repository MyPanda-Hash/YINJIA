import test from 'node:test'
import assert from 'node:assert/strict'
import { applyMenuOverrides, flattenMenuNodes, pickVisibleTree, wouldCycle } from './menuOverrides.js'

/**
 * 菜单设计器(2026-10-23 用户口径:「给系统管理模块加上一个菜单命名的功能,就是可以编辑各个面板的
 *   位置与一级模块与二级模块的分支和名字,就不需要每次修改都要重新打包部署」)。
 *
 * 设计:代码里的 menus.js 是**基线**(路由/面板码/图标这些数据键只在代码里),数据库 yj_menu_node
 *   存**覆盖**(名称/上级/排序/隐藏)。合并规则全部落在本文件,以便单测把口径钉死:
 *   · 有覆盖行 ⇒ 该行的 title/parentCode/seq/hidden 生效
 *   · 没有覆盖行 ⇒ 用基线(代码里新加的面板,库里还没快照时不会消失)
 *   · 新建分组 ⇒ isNew 行没有基线节点,按 parentCode 挂上去
 *   · 数据键(path/panelCode/icon/adminOnly)永远取自代码,菜单设计器改不动它们
 */

/** 一份最小基线:两个一级模块 / 一个嵌套二级 / 各带叶子 */
const BASE = [
  {
    code: 'a', title: '甲模块', icon: 'HomeFilled',
    children: [
      {
        code: 'a1', title: '甲一', icon: 'Folder',
        children: [
          { code: 'a1x', title: '甲一X', path: '/panelx/list/A1X', panelCode: 'A1X', icon: 'Tickets' },
          { code: 'a1y', title: '甲一Y', path: '/panelx/list/A1Y', panelCode: 'A1Y', icon: 'Tickets' },
        ],
      },
      { code: 'a2', title: '甲二', path: '/panelx/list/A2', panelCode: 'A2', icon: 'Tickets' },
    ],
  },
  {
    code: 'b', title: '乙模块', icon: 'MagicStick',
    children: [
      { code: 'b1', title: '乙一', path: '/panelx/list/B1', panelCode: 'B1', icon: 'Tickets' },
    ],
  },
]

/** 便捷构造覆盖行 */
const row = (menuCode, parentCode, title, seq, extra = {}) =>
  ({ menuCode, parentCode, title, seq, hidden: false, isNew: false, ...extra })

const codesOf = (tree) => tree.map((n) => n.code)
const node = (tree, code) => {
  let hit = null
  const walk = (list, parent) => list.forEach((n) => {
    if (n.code === code) hit = { node: n, parent }
    if (n.children) walk(n.children, n)
  })
  walk(tree, null)
  return hit
}

// ---------- 1. 无覆盖:基线原样 ----------
test('没有覆盖行时菜单与基线完全一致(层级/名称/顺序),且不改动入参', () => {
  const before = JSON.stringify(BASE)
  const tree = applyMenuOverrides(BASE, [])
  assert.deepEqual(codesOf(tree), ['a', 'b'])
  assert.deepEqual(codesOf(tree[0].children), ['a1', 'a2'])
  assert.deepEqual(codesOf(tree[0].children[0].children), ['a1x', 'a1y'])
  assert.equal(tree[1].title, '乙模块')
  assert.equal(JSON.stringify(BASE), before, '基线必须原样不动(多次合并不能互相污染)')
})

// ---------- 2. 改名 ----------
test('改名只盖显示名,数据键(path/panelCode/icon)仍取代码', () => {
  const tree = applyMenuOverrides(BASE, [
    row('a', null, '智能制造', 0),
    row('a1x', 'a1', '甲一X(改名)', 0),
  ])
  assert.equal(tree[0].title, '智能制造')
  const x = node(tree, 'a1x').node
  assert.equal(x.title, '甲一X(改名)')
  assert.equal(x.path, '/panelx/list/A1X')
  assert.equal(x.panelCode, 'A1X')
  assert.equal(x.icon, 'Tickets')
})

// ---------- 3. 换分支(一级/二级/三级之间挪动) ----------
test('把面板从甲一挪到乙模块下:层级变了,路由与面板码不变', () => {
  const tree = applyMenuOverrides(BASE, [
    row('a', null, '甲模块', 0),
    row('b', null, '乙模块', 1),
    row('a1', 'a', '甲一', 0),
    row('a2', 'a', '甲二', 1),
    row('a1x', 'b', '甲一X', 0),
    row('a1y', 'a1', '甲一Y', 1),
    row('b1', 'b', '乙一', 1),
  ])
  assert.deepEqual(codesOf(tree[0].children.find((n) => n.code === 'a1').children), ['a1y'])
  const b = tree.find((n) => n.code === 'b')
  assert.deepEqual(codesOf(b.children), ['a1x', 'b1'], '按 seq 排:甲一X(0) 在乙一(1) 前')
  assert.equal(b.children[0].path, '/panelx/list/A1X', '挪位置不能改路由')
})

test('二级分组整体挪到另一个一级模块下', () => {
  const tree = applyMenuOverrides(BASE, [row('a1', 'b', '甲一', 0)])
  assert.deepEqual(codesOf(tree[0].children), ['a2'], '甲模块下只剩甲二')
  const b = tree.find((n) => n.code === 'b')
  assert.deepEqual(codesOf(b.children), ['a1', 'b1'])
  assert.equal(node(tree, 'a1').parent.code, 'b')
})

// ---------- 4. 排序 ----------
test('seq 决定同级顺序;缺覆盖行的基线节点排在有 seq 的后面', () => {
  const tree = applyMenuOverrides(BASE, [
    row('a', null, '甲模块', 0),
    row('b', null, '乙模块', 1),
    row('a2', 'a', '甲二', 0),
    row('a1', 'a', '甲一', 1),
  ])
  assert.deepEqual(codesOf(tree[0].children), ['a2', 'a1'])
})

// ---------- 5. 隐藏 ----------
test('隐藏:合并后的树保留该节点(hidden=true),渲染树 pickVisibleTree 去掉它', () => {
  const tree = applyMenuOverrides(BASE, [
    row('a1y', 'a1', '甲一Y', 1, { hidden: true }),
    row('b', null, '乙模块', 1, { hidden: true }),
  ])
  assert.equal(node(tree, 'a1y').node.hidden, true, '编辑态要看得到被隐藏的项')
  const visible = pickVisibleTree(tree)
  assert.equal(node(visible, 'a1y'), null, '隐藏项不进导航')
  assert.equal(visible.find((n) => n.code === 'b'), undefined, '整枝隐藏的一级模块不出现')
  assert.deepEqual(codesOf(visible[0].children[0].children), ['a1x'])
})

test('隐藏二级分组后,该组连同子项一起消失;留下的空分组不渲染', () => {
  const tree = applyMenuOverrides(BASE, [row('a1', 'a', '甲一', 0, { hidden: true })])
  const visible = pickVisibleTree(tree)
  assert.deepEqual(codesOf(visible[0].children), ['a2'])
  assert.deepEqual(codesOf(visible), ['a', 'b'])
})

// ---------- 6. 新建分组 ----------
test('新建二级分组:库里只有这一行,基线里没有该节点,按 parentCode 挂上去', () => {
  const tree = applyMenuOverrides(BASE, [
    row('gNew', 'a', '新分组', 0, { isNew: true, icon: 'FolderOpened' }),
    row('a1', 'a', '甲一', 1),
    row('a2', 'a', '甲二', 2),
  ])
  assert.deepEqual(codesOf(tree[0].children), ['gNew', 'a1', 'a2'])
  const g = tree[0].children[0]
  assert.equal(g.title, '新分组')
  assert.equal(g.icon, 'FolderOpened')
  assert.deepEqual(g.children, [], '空分组允许存在(管理员还没往里放面板)')
  // 空分组不进导航(没有可点的入口),但保留在合并结果里供设计器继续编辑
  assert.deepEqual(codesOf(pickVisibleTree(tree)[0].children), ['a1', 'a2'])
})

test('新建一级模块:parentCode 为空串或 null 都算一级', () => {
  const t1 = applyMenuOverrides(BASE, [row('gTop', null, '新一级', 0, { isNew: true })])
  assert.deepEqual(codesOf(t1), ['gTop', 'a', 'b'])
  const t2 = applyMenuOverrides(BASE, [row('gTop', '', '新一级', 0, { isNew: true })])
  assert.deepEqual(codesOf(t2), ['gTop', 'a', 'b'])
})

// ---------- 7. 脏数据不能丢菜单 ----------
test('parentCode 指向不存在的节点 ⇒ 落到一级(宁可位置错,不能让菜单凭空消失)', () => {
  const tree = applyMenuOverrides(BASE, [row('a1x', 'no-such-group', '甲一X', 0)])
  // 落到一级后仍按该行的 seq(0) 排序 ⇒ 排在最前;路径/面板码原样保留
  assert.deepEqual(codesOf(tree), ['a1x', 'a', 'b'])
  assert.equal(node(tree, 'a1x').node.path, '/panelx/list/A1X')
})

test('覆盖行把「叶子」当上级时:该叶子被提升为分组,子项不丢(基线曾出现重名 code)', () => {
  const tree = applyMenuOverrides(BASE, [row('a2', 'a1x', '甲二', 5)])
  const x = node(tree, 'a1x').node
  assert.ok(Array.isArray(x.children), '甲一X 应被提升为分组')
  assert.deepEqual(codesOf(x.children), ['a2'], '甲二挂进去而不是消失')
  assert.equal(x.path, '/panelx/list/A1X', '提升为分组不改它的数据键')
})

test('父子成环 ⇒ 该节点落到一级,不死循环、不丢菜单', () => {  const rows = [row('a', 'a1', '甲模块', 0), row('a1', 'a', '甲一', 0)]
  const tree = applyMenuOverrides(BASE, rows)
  const flat = []
  const walk = (list) => list.forEach((n) => { flat.push(n.code); if (n.children) walk(n.children) })
  walk(tree)
  assert.ok(flat.includes('a') && flat.includes('a1'), '两个节点都还在')
  assert.ok(flat.includes('a1x') && flat.includes('a1y'), '环里的子项也不能丢')
})

// ---------- 8. 设计器辅助:防环 ----------
test('wouldCycle:不能把分组挂到自己的子孙下面,也不能挂到自己下面', () => {
  const tree = applyMenuOverrides(BASE, [])
  assert.equal(wouldCycle(tree, 'a1', 'a1'), true)
  assert.equal(wouldCycle(tree, 'a', 'a1'), true, '甲模块挂到自己的子分组甲一下面 = 环')
  assert.equal(wouldCycle(tree, 'a1', 'a'), false, '挂回父级是合法操作')
  assert.equal(wouldCycle(tree, 'a1x', 'b'), false, '叶子挪到别的一级模块合法')
})

// ---------- 9. 往返:flatten → apply 结构不变 ----------
test('flattenMenuNodes 快照再合并,结构与顺序逐字一致(保存/重载安全)', () => {
  const first = applyMenuOverrides(BASE, [])
  const rows = flattenMenuNodes(first)
  assert.deepEqual(rows.map((r) => [r.menuCode, r.parentCode, r.seq]), [
    ['a', null, 0], ['a1', 'a', 1], ['a1x', 'a1', 2], ['a1y', 'a1', 3], ['a2', 'a', 4],
    ['b', null, 5], ['b1', 'b', 6],
  ], 'seq 全局递增(同一父下相对顺序即最终顺序)')
  const again = applyMenuOverrides(BASE, rows)
  assert.deepEqual(codesOf(again), ['a', 'b'])
  assert.deepEqual(codesOf(again[0].children), ['a1', 'a2'])
  assert.deepEqual(codesOf(again[0].children[0].children), ['a1x', 'a1y'])
})

test('flatten 保住标题改写与隐藏标记(保存后重载不回退)', () => {
  const tree = applyMenuOverrides(BASE, [
    row('a', null, '智能制造', 0),
    row('a1y', 'a1', '甲一Y', 1, { hidden: true }),
  ])
  const rows = flattenMenuNodes(tree)
  const again = applyMenuOverrides(BASE, rows)
  assert.equal(again[0].title, '智能制造')
  assert.equal(node(again, 'a1y').node.hidden, true)
  assert.equal(rows.find((r) => r.menuCode === 'a1y').hidden, true)
})

test('flatten 给新建分组标 isNew,基线节点不标', () => {
  const tree = applyMenuOverrides(BASE, [row('gNew', 'a', '新分组', 0, { isNew: true })])
  const rows = flattenMenuNodes(tree)
  assert.equal(rows.find((r) => r.menuCode === 'gNew').isNew, true)
  assert.equal(rows.find((r) => r.menuCode === 'a').isNew, false)
})
