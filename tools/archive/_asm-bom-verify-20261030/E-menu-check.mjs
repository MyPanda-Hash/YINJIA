// T3 独立验收:E 菜单树检查(只读 import,不改任何文件)
import { menuTree } from '../../../frontend/src/business/menus.js'

const out = []
let fail = 0
const dm = menuTree.find((n) => n.code === 'dm')
out.push(`dm = ${dm ? dm.title + ' / ' + dm.code : '<缺失>'}`)
const bprod = (dm?.children || []).find((n) => n.code === 'bprod')
out.push(`bprod = ${bprod ? bprod.title + ' / ' + bprod.code : '<缺失>'}`)
const leaf = (bprod?.children || []).find((c) => c.panelCode === 'ASM_BOM')
if (!leaf) {
  out.push('[FAIL] dm→bprod 下没有 panelCode=ASM_BOM 的叶子')
  fail++
} else {
  const chk = (label, ok, got) => {
    out.push(`[${ok ? 'PASS' : 'FAIL'}] ${label} = ${JSON.stringify(got)}`)
    if (!ok) fail++
  }
  chk('leaf.title', leaf.title === '组装物料清单', leaf.title)
  chk('leaf.path', leaf.path === '/panelx/list/ASM_BOM', leaf.path)
  chk('leaf.code', leaf.code === 'asmBom', leaf.code)
  chk('leaf.operationName', typeof leaf.operationName === 'string' && leaf.operationName.length > 0, leaf.operationName)
}
// 全树 ASM_BOM 出现次数(按 panelCode)+ 同 path 出现次数
const codes = []
const paths = []
const walk = (n) => {
  if (Array.isArray(n)) return n.forEach(walk)
  if (!n || typeof n !== 'object') return
  if (n.panelCode) codes.push(n.panelCode)
  if (n.path) paths.push(n.path)
  ;(n.children || []).forEach(walk)
}
walk(menuTree)
const cntCode = codes.filter((c) => c === 'ASM_BOM').length
const cntPath = paths.filter((p) => p === '/panelx/list/ASM_BOM').length
out.push(`[${cntCode === 1 ? 'PASS' : 'FAIL'}] 全树 panelCode=ASM_BOM 次数 = ${cntCode}`)
if (cntCode !== 1) fail++
out.push(`[${cntPath === 1 ? 'PASS' : 'FAIL'}] 全树 path=/panelx/list/ASM_BOM 次数 = ${cntPath}`)
if (cntPath !== 1) fail++
// 兄弟叶子(生产组现有内容),证明挂载位置在「生产」组且未被挤出
out.push(`bprod 子项(${(bprod?.children || []).length}): ` +
  (bprod?.children || []).map((c) => `${c.code}=${c.panelCode || ''}`).join(', '))
// 父级路径
const chain = []
const find = (nodes, target, stack) => {
  for (const n of nodes) {
    const st = [...stack, n.title]
    if (n === target) return st
    if (n.children) { const r = find(n.children, target, st); if (r) return r }
  }
  return null
}
if (leaf) out.push(`挂载路径: ${(find(menuTree, leaf, []) || []).join(' → ')}`)
out.push(fail === 0 ? 'RESULT: PASS' : `RESULT: FAIL(${fail})`)
console.log(out.join('\n'))
process.exit(fail === 0 ? 0 : 1)
