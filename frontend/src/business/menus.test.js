import test from 'node:test'
import assert from 'node:assert/strict'
import { menuTree } from './menus.js'

/** 研发管理二级目录:按研发流程分组(项目管理 / 测试记录 / 产品文件 / 共享文件) */
test('完工明细为生产执行下的独立通用列表', () => {
  const exec = menuTree.find((n) => n.code === 'mfg').children.find((n) => n.code === 'exec')
  const entry = exec.children.find((n) => n.panelCode === 'WO_COMPLETION_LIST')
  assert.equal(entry?.title, '完工明细')
  assert.equal(entry?.path, '/panelx/list/WO_COMPLETION_LIST')
})

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
 * 2026-10-14 用户拍板:MES 自建「物料清单(BOM)」功能整体删除
 * (数据库 DROP TABLE bs_bom / DROP VIEW v_wo_kit,面板 BOM、BOM_FWD、BOM_REV、WO_KIT 同批下架)。
 * 菜单是被删的第一层入口 —— 这里钉住"不得从别处溜回导航",否则用户点进去就是空表/报错。
 */
test('自建 BOM 下线:菜单树里不得再有 物料清单(BOM)/工单齐套表(WO_KIT) 入口', () => {
  const all = JSON.stringify(menuTree)
  assert.ok(!all.includes('/panelx/list/BOM'), '菜单树里不应再有 物料清单 入口(或 BOM_FWD/BOM_REV 变体)')
  assert.ok(!all.includes('WO_KIT'), '菜单树里不应再有 工单齐套表 入口(v_wo_kit 已删)')
  assert.ok(!all.includes('工单齐套表'), '菜单树里不应再有「工单齐套表」标题')
  // ⚠ 2026-10-15 修正判据:原来这里断言"菜单树里不得出现「物料清单」标题" —— **判宽了**。
  //   当天下架的是**自建 BOM 那套**(表 bs_bom / 面板 BOM、BOM_FWD、BOM_REV),它们绝不能回来;
  //   而 **WLBOM(物料清单,表 mate)是另一个面板** —— 它一直都在库里(yj_panel 仍登记、mode=doc、
  //   line_table=mate、mate 表有数据),规格书「1.关键物料清单」引用的就是它,只是当天连菜单一起下线了。
  //   用户报障「物料清单面板入口没有在基础档案里面」⇒ 已按 README 的栏目顺序(计量单位/商品/物料清单/
  //   存货价格本)把 **WLBOM** 入口补回「物料及价格」栏。故本测试改为**按 panelCode 精确禁止**,
  //   仍能钉住"自建 BOM 不得溜回导航",同时不再误伤那个仍然在用的 WLBOM。
  const collectCodes = (node) => {
    if (Array.isArray(node)) return node.flatMap(collectCodes)
    if (!node || typeof node !== 'object') return []
    const self = node.panelCode ? [node.panelCode] : []
    return self.concat(collectCodes(node.children))
  }
  const codes = collectCodes(menuTree)
  for (const dead of ['BOM', 'BOM_FWD', 'BOM_REV', 'WO_KIT']) {
    assert.ok(!codes.includes(dead), `菜单树里不应再有已下架面板 ${dead} 的入口`)
  }
  assert.ok(codes.includes('WLBOM'), 'WLBOM(物料清单,表 mate)仍在用 —— 入口应在「物料及价格」栏里')
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

/**
 * 2026-10-14 用户口径:「生产制造的侧边栏和其他模块不一样,要求使用相同的实现方式」
 *   + 「明细表和统计表不做大类区分,跟其他模块方式一样」。
 * 病根 = 生产制造下多包了一层空壳二级目录「生产管理」,且「明细表」「统计表」自成了两个二级大类:
 *   · 侧栏点开「生产制造」只列出一项「生产管理」,而 智能供应链/品质管理/基础档案 都列业务域;
 *   · LeftNav 为此写了 `m.code === 'mfg'` 特判去"穿"这层,别的模块走通用分支 —— 两套实现;
 *   · 别的模块里明细/统计表都挂在所属业务对象下(智能供应链·销售管理:销售订单 → 明细表 → 统计表)。
 * 终态 = 二级只剩 6 个业务域,4 张明细/统计面板按业务对象并入 生产计划 / 经典单据。
 * 2026-10-16:样品管理 / 经典单据 两组随其仅有的 5 个叶子整体下架 ⇒ 6 → 4 个业务域。
 */
test('生产制造二级目录 = 4 个业务域(拍平「生产管理」空壳层 + 取消「明细表/统计表」大类 + 摘两组)', () => {
  const mfg = menuTree.find((n) => n.code === 'mfg')
  assert.deepEqual((mfg.children || []).map((c) => c.code),
    ['plan', 'exec', 'records', 'device'])
  assert.deepEqual((mfg.children || []).map((c) => c.title),
    ['生产计划', '生产执行', '生产记录', '设备维护'])
  // 空壳层 / 类型大类都不得回来
  assert.ok(!(mfg.children || []).some((c) => c.code === 'prod'), '不应再有 prod 空壳层')
  assert.ok(!(mfg.children || []).some((c) => c.title === '生产管理'), '不应再有「生产管理」空壳层')
  assert.ok(!(mfg.children || []).some((c) => c.title === '明细表' || c.title === '统计表'),
    '明细表/统计表不应再是二级大类')
})

/**
 * 2026-10-16 用户口径「去除当前这两个菜单内的单据」:
 * 样品管理(样品申请单 SAMPLE_REQ)与经典单据(工序派工单 DISPATCH / 委外加工单 OUTSOURCE_ORDER /
 * 工序派工单明细表 DISPATCH_DETAIL / 工序派工单统计表 DISPATCH_STATS)两组整体摘除。
 * 走轻路线(元数据与物理表保留可回滚)⇒ 钉住的是「菜单里不得再有入口」,不是「面板已删」。
 * 恢复 = 放开 menus.js 里那两段的注释,届时本测试必须同步改回。
 */
test('样品管理 / 经典单据 两组下架:菜单树里不得再有这 5 张面板的入口或分组', () => {
  const mfg = menuTree.find((n) => n.code === 'mfg')
  for (const code of ['sample', 'legacy']) {
    assert.ok(!(mfg.children || []).some((c) => c.code === code), `不应再有 ${code} 二级分组`)
  }
  for (const title of ['样品管理', '经典单据']) {
    assert.ok(!(mfg.children || []).some((c) => c.title === title), `不应再有「${title}」分组`)
  }
  const all = JSON.stringify(mfg)
  for (const p of ['SAMPLE_REQ', 'DISPATCH', 'OUTSOURCE_ORDER', 'DISPATCH_DETAIL', 'DISPATCH_STATS']) {
    assert.ok(!all.includes(`"${p}"`), `菜单树里不应再有 ${p} 入口`)
  }
})

test('生产制造的明细/统计表挂在所属业务对象下(与销售管理同款)', () => {
  const mfg = menuTree.find((n) => n.code === 'mfg')
  const group = (code) => (mfg.children || []).find((c) => c.code === code)
  // 域内顺序 = 单据 → 明细表 → 统计表(照抄 智能供应链·销售管理)
  // 2026-10-16:生产计划域的四个看板页面(订单结转/生产工单/快速排产/工单排产)新增了
  // **页面级虚拟面板码**(权限化,定义见后端 PagePanelRegistry),故也进入本断言 ——
  // 顺序即 menus.js 里的菜单顺序,改菜单必须同步这里。
  // 2026-10-17:生产工单明细表/统计表(MANU_ORDER_DETAIL/MANU_ORDER_STATS)**下架**
  //   —— 载体视图读的是正式库 0 行的 bd_manu_order/bl_manu_order,打开即空表,且从未被打开过
  //   (migrate-drop-manu-order-report-panels-20261017.sql),故从本断言里移除。
  assert.deepEqual((group('plan').children || []).map((c) => c.panelCode).filter(Boolean),
    ['ORDER_CONVERT', 'WORK_ORDER_LIST', 'SCHEDULE_BOARD', 'WORK_ORDER_BOARD', 'LINE_LOAD'])
  // 下架后不该再出现在菜单树里:防"删了数据库却漏删菜单",反之亦然
  const all = JSON.stringify(mfg)
  for (const p of ['MANU_ORDER_DETAIL', 'MANU_ORDER_STATS']) {
    assert.equal(all.split(`"${p}"`).length - 1, 0, `${p} 已下架,不该再出现在生产制造菜单里`)
  }
})

test('导航层级同构:一级模块的二级目录一律是"带面板的分组",不出现裸叶子/空壳层', () => {
  for (const g of menuTree) {
    if (!g.children || !g.children.length) continue // 我的桌面/财务管理/设备管理 等暂无二级
    for (const c of g.children) {
      assert.ok(Array.isArray(c.children) && c.children.length > 0, `${g.title} > ${c.title} 应是"带面板的分组"`)
    }
  }
})

/**
 * 2026-10-16 用户口径:「删除当前成型检验单和切炭检验单,以及成品检验规范。」
 * 走的是**重路线**(与上一批 5 张只摘菜单不同):面板元数据、译名、报工自动出单钩子与物理表
 * (qc_mold_insp_head/_detail、qc_cut_insp_head/_detail、qc_fin_spec_head/_detail)全部删除,
 * 见 tools/migrate-drop-qc-mold-cut-finspec-20261016.sql。这里钉住「菜单里不得再有入口」——
 * 面板都没了,放开注释也恢复不了;要回退得先跑备份里的建表/元数据脚本。
 */
test('成型检验单 / 切炭检验单 / 成品检验规范 已下架:菜单树里不得再有入口', () => {
  const all = JSON.stringify(menuTree)
  for (const p of ['QC_MOLD_INSP', 'QC_CUT_INSP', 'QC_FIN_SPEC']) {
    assert.ok(!all.includes(`"${p}"`), `菜单树里不应再有 ${p} 入口`)
  }
  for (const t of ['成型检验单', '切炭检验单', '成品检验规范']) {
    assert.ok(!all.includes(t), `菜单树里不应再有「${t}」标题`)
  }
  // 制程品质组现役 = 首件 / 制程 / 组装成品 三张;质量单据组现役 = 7 张
  const qc = menuTree.find((n) => n.code === 'qc')
  const group = (code) => (qc.children || []).find((c) => c.code === code)
  assert.deepEqual((group('process').children || []).map((c) => c.panelCode),
    ['QC_FIRST_INSP', 'QC_PROC_INSP', 'QC_ASM_INSP'])
  assert.equal((group('qcDoc').children || []).length, 7)
})
