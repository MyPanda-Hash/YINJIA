// 一次性探针(2026-10-14):复算 LeftNav.vue 悬停浮层的分列结果,取证「生产制造」已并入通用分支。
// 用法(仓库根): node tools/archive/_nav-card-columns.mjs
// 判定:① 每个一级模块的列结构打印;② 生产制造按"通用分支"算出的列 == 改造前 m.code==='mfg' 特判的列(golden)。
import { menuTree } from '../../frontend/src/business/menus.js'

// —— 与 frontend/src/layout/LeftNav.vue 现版本同构 ——
function flattenCardItems(nodes) {
  const out = []
  const walk = (node, depth) => {
    if (node.path) out.push({ ...node, depth })
    if (node.children) node.children.forEach((child) => walk(child, node.path ? depth + 1 : depth))
  }
  nodes.forEach((node) => walk(node, 0))
  return out
}

function leafGroupColumns(node) {
  const out = []
  const walk = (parent) => {
    const children = parent.children || []
    const leaves = children.filter((c) => !c.children || !c.children.length)
    const groups = children.filter((c) => c.children && c.children.length)
    if (leaves.length) out.push({ title: parent.title, items: flattenCardItems(leaves) })
    groups.forEach(walk)
  }
  walk(node)
  return out
}

/** 现版本通用实现(LeftNav.cardColumns 去特判后) */
function cardColumns(m) {
  if (!m) return []
  if (!m.children || !m.children.length) return [{ title: m.title, items: [m] }]
  if (m.code === 'rd') return leafGroupColumns(m)
  if (m.children[0]?.children) {
    return m.children.map((cat) => ({ title: cat.title, items: flattenCardItems(cat.children || [cat]) }))
  }
  return [{ title: m.title, items: m.children.flatMap((mod) => flattenCardItems([mod])) }]
}

/** 期望的「生产制造」浮层分列(2026-10-14 终态)——
 *  演进:① 原为 m.code==='mfg' 特判穿「生产管理」空壳层;② 拍平后走通用分支,列仍是 8 列;
 *        ③ 用户口径「明细表和统计表不做大类区分」后,4 张明细/统计面板并入所属业务域 ⇒ 6 列。 */
const EXPECTED_MFG_COLUMNS = [
  '生产计划(7: 订单结转/生产工单/快速排产/工单排产/产线排产负荷/生产工单明细表/生产工单统计表)',
  '生产执行(3: 工序报工单/报工记录/生产异常处理单)',
  '生产记录(6: 生产日报表/投料确认单/物料混合记录/造粒记录/无黑处理登记/封箱确认)',
  '设备维护(2: 设备点检记录/保养计划)',
  '样品管理(1: 样品申请单)',
  '经典单据(4: 工序派工单/委外加工单/工序派工单明细表/工序派工单统计表)',
]

const brief = (cols) => cols.map((c) => `${c.title}(${c.items.length}: ${c.items.map((i) => i.title).join('/')})`)

for (const g of menuTree) {
  console.log(`\n=== 一级「${g.title}」(${g.code}) : 二级项 ${(g.children || []).length} 个 → 浮层 ${cardColumns(g).length} 列`)
  for (const line of brief(cardColumns(g))) console.log('  ' + line)
}

// 回归比对:期望的分列(见上方 EXPECTED_MFG_COLUMNS) == 现通用分支产出的列
const mfg = menuTree.find((n) => n.code === 'mfg')
const now = JSON.stringify(brief(cardColumns(mfg)))
const expect = JSON.stringify(EXPECTED_MFG_COLUMNS)
console.log('\n--- 生产制造 分列回归比对(改造前特判 vs 现通用分支) ---')
console.log('期望:', expect)
console.log('实际:', now)
console.log(expect === now ? '[PASS] 浮层列结构与期望一致(全部模块走同一条通用分支)' : '[FAIL] 列结构变化,需人工核对')

const mfgMods = (mfg.children || []).map((c) => `${c.title}(${c.code})`)
console.log('\n生产制造 侧栏二级项(改造后):', mfgMods.join(' / '))
console.log('是否仍有「生产管理」空壳层:', JSON.stringify(mfg).includes('生产管理') ? '是' : '否')
console.log('是否仍有「明细表/统计表」二级大类:',
  (mfg.children || []).some((c) => c.title === '明细表' || c.title === '统计表') ? '是' : '否')
