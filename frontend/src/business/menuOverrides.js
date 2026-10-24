/**
 * menuOverrides.js — 菜单覆盖层(菜单设计器)的**合并口径唯一真源**
 *
 * 背景(2026-10-23 用户口径「给系统管理模块加上一个菜单命名的功能,就是可以编辑各个面板的位置与
 *   一级模块与二级模块的分支和名字,就不需要每次修改都要重新打包部署」):
 *   导航此前写死在 `business/menus.js`,改一个名字/挪一个位置就得改代码 + 重新打包部署。
 *
 * 分层(为什么不整棵树搬进库):
 *   · **代码 = 基线**:每个节点的 `code / path / panelCode / icon / adminOnly` 是**数据键**,
 *     和路由注册、权限词、面板元数据一一对应 —— 放进库就和代码脱钩,一次误改会打出打不开的菜单。
 *   · **数据库 = 覆盖**(`yj_menu_node`):只存人能改的四件事 —— 名称 `title`、上级 `parentCode`、
 *     排序 `seq`、隐藏 `hidden`,以及管理员新建的分组(`isNew=1`,基线里没有这个节点)。
 *   · 合并 = 本文件。基线里有、库里没快照的节点**一律按基线显示**(代码里新加的面板不会因为
 *     库没跟上而隐身);库里指向不存在的上级或成环 ⇒ 该节点落到一级,**宁可位置错也不丢菜单**。
 *
 * 不可编辑项(设计器里只读):path / panelCode / icon / adminOnly / operationName。
 */

/** 覆盖行允许的字段(后端也按同一组校验;多字段无害但会被忽略) */
const ROW_KEYS = ['menuCode', 'parentCode', 'title', 'seq', 'hidden', 'isNew', 'icon']

/** 空串/undefined/null 的统一表示:一级 */
function normParent(v) {
  const s = v == null ? '' : String(v).trim()
  return s === '' ? null : s
}

function normSeq(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * 把「基线树 + 覆盖行」合并成渲染树。
 * @param {Array} baseTree `business/menus.js` 的 menuTree
 * @param {Array<{menuCode:string,parentCode?:string|null,title?:string,seq?:number,hidden?:boolean,isNew?:boolean,icon?:string}>} rows
 * @returns {Array} 合并后的树(**不改动入参**;隐藏节点仍在树里,带 `hidden: true`)
 */
export function applyMenuOverrides(baseTree, rows) {
  const base = Array.isArray(baseTree) ? baseTree : []
  const rowList = Array.isArray(rows) ? rows : []

  const rowByCode = new Map()
  for (const r of rowList) {
    if (!r) continue
    const code = String(r.menuCode ?? '').trim()
    if (code) rowByCode.set(code, r)
  }

  // ① 基线节点 → 骨架(数据键原样克隆,children 稍后重建)
  const nodes = new Map() // code -> { node, parentCode, order, isNew }
  let order = 0
  const collect = (list, parentCode) => {
    for (const n of list) {
      if (!n || !n.code) continue
      const { children, ...rest } = n
      nodes.set(n.code, { node: rest, parentCode, order: order++, isNew: false, hasChildren: Array.isArray(children) })
      if (Array.isArray(children)) collect(children, n.code)
    }
  }
  collect(base, null)

  // ② 库里新建的分组(基线没有这个节点)
  for (const [code, r] of rowByCode) {
    if (nodes.has(code)) continue
    if (r.isNew !== true) continue // 基线没有、又不是新建的 ⇒ 别凭空造菜单
    const rest = {}
    for (const k of ROW_KEYS) if (k !== 'menuCode' && r[k] !== undefined) rest[k] = r[k]
    delete rest.parentCode; delete rest.title; delete rest.seq; delete rest.hidden; delete rest.isNew
    nodes.set(code, { node: { code, ...rest, icon: r.icon || 'Folder' }, parentCode: null, order: order++, isNew: true, hasChildren: true })
  }

  const allCodes = new Set(nodes.keys())

  // ③ 算每个节点的最终上级/标题/隐藏/排序
  const finalParent = new Map()
  const titleOf = new Map()
  const hiddenOf = new Map()
  const seqOf = new Map()

  const parentChainHas = (startCode, target) => {
    let cur = startCode
    const seen = new Set()
    while (cur != null) {
      if (cur === target) return true
      if (seen.has(cur)) return true // 数据里本来就有环:一律按"有环"处理,挂到一级止损
      seen.add(cur)
      cur = finalParent.has(cur) ? finalParent.get(cur) : null
    }
    return false
  }

  for (const [code, info] of nodes) {
    const r = rowByCode.get(code)
    const rawParent = r ? normParent(r.parentCode) : info.parentCode
    let parent = rawParent
    if (parent != null) {
      if (!allCodes.has(parent)) parent = null // 孤立上级 ⇒ 一级
      else if (parent === code) parent = null // 自己当自己上级 ⇒ 一级
      else if (parentChainHas(parent, code)) parent = null // 成环 ⇒ 一级(先到的节点先定父,后来的让路)
    }
    finalParent.set(code, parent)

    const baseTitle = info.node.title ?? code
    const t = r && r.title != null ? String(r.title).trim() : ''
    titleOf.set(code, t || (info.isNew ? code : baseTitle))
    hiddenOf.set(code, !!(r && r.hidden))
    const s = r ? normSeq(r.seq) : null
    seqOf.set(code, s == null ? 1e9 + info.order : s)
  }

  // ④ 防御:被当成上级引用的节点必须是分组 —— 基线里曾经出现重名 code(分组与叶子撞名,
  //   2026-10-23 已在上游修掉),那种数据会让"挂子项"落在一个叶子身上。这里直接把该节点
  //   提升为分组,而不是丢掉它的子项(宁可多一层空壳,不丢菜单)。
  for (const parent of finalParent.values()) {
    if (parent != null && nodes.has(parent)) nodes.get(parent).hasChildren = true
  }

  // ⑤ 组装树(按 seq 稳定排序:同 seq 保留基线顺序)
  const childrenOf = new Map()
  const top = []
  for (const [code, info] of nodes) {
    const out = { ...info.node, code, title: titleOf.get(code), seq: seqOf.get(code) }
    if (hiddenOf.get(code)) out.hidden = true
    if (info.isNew) out.isNew = true
    if (info.hasChildren) out.children = []
    childrenOf.set(code, out)
  }
  for (const [code, info] of nodes) {
    const parent = finalParent.get(code)
    const out = childrenOf.get(code)
    if (parent == null) top.push(out)
    else childrenOf.get(parent).children.push(out)
  }
  for (const out of childrenOf.values()) {
    if (Array.isArray(out.children) && out.children.length > 1) {
      const baseOrder = (n) => (nodes.get(n.code)?.order ?? 0)
      out.children.sort((a, b) => (a.seq - b.seq) || (baseOrder(a) - baseOrder(b)))
    }
  }
  top.sort((a, b) => (a.seq - b.seq) || (nodes.get(a.code).order - nodes.get(b.code).order))
  return top
}

/**
 * 渲染用树:去掉隐藏节点(整枝),以及隐藏后变空的分组(没有可点入口的分组只是噪音)。
 * @param {Array} tree applyMenuOverrides 的结果
 */
export function pickVisibleTree(tree) {
  const walk = (list) => {
    const out = []
    for (const n of list || []) {
      if (n.hidden) continue
      if (Array.isArray(n.children)) {
        const kids = walk(n.children)
        if (!kids.length) continue // 原本有子项却全被隐藏/删空 ⇒ 不渲染
        out.push({ ...n, children: kids })
        continue
      }
      out.push({ ...n })
    }
    return out
  }
  return walk(tree)
}

/**
 * 设计器保存用快照:树 → 覆盖行(seq 按先序遍历全局递增,同一父下的相对顺序即最终顺序)。
 * @param {Array} tree
 * @returns {Array<{menuCode:string,parentCode:string|null,title:string,seq:number,hidden:boolean,isNew:boolean,icon?:string}>}
 */
export function flattenMenuNodes(tree) {
  const rows = []
  let seq = 0
  const walk = (list, parentCode) => {
    for (const n of list || []) {
      if (!n || !n.code) continue
      const r = {
        menuCode: n.code,
        parentCode: parentCode ?? null,
        title: n.title ?? n.code,
        seq: seq++,
        hidden: !!n.hidden,
        isNew: n.isNew === true,
      }
      if (n.icon) r.icon = n.icon
      rows.push(r)
      if (Array.isArray(n.children)) walk(n.children, n.code)
    }
  }
  walk(tree, null)
  return rows
}

/** 找节点及其子孙的 code 集合(设计器拖拽防环用) */
function subtreeCodes(tree, code) {
  const out = new Set()
  const walk = (list) => {
    for (const n of list || []) {
      out.add(n.code)
      if (n.children) walk(n.children)
    }
  }
  const find = (list) => {
    for (const n of list || []) {
      if (n.code === code) { out.add(n.code); if (n.children) walk(n.children); return true }
      if (n.children && find(n.children)) return true
    }
    return false
  }
  find(tree)
  return out
}

/**
 * 把 `code` 挪到 `parentCode` 下面会不会成环(自己/自己的子孙不能当父)。
 * @param {Array} tree
 * @param {string} code 被移动的节点
 * @param {string|null} parentCode 目标父(空 = 一级)
 */
export function wouldCycle(tree, code, parentCode) {
  const p = normParent(parentCode)
  if (p == null) return false
  if (p === code) return true
  return subtreeCodes(tree, code).has(p)
}
