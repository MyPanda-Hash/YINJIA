import test from 'node:test'
import assert from 'node:assert/strict'
import { menuTree, filterMenuTree } from './menus.js'

/** 完工明细(2026-10-20 起「生产过程」升为一级目录,不再是 mfg 下的二级) */
test('完工明细为生产过程下的独立通用列表', () => {
  const proc = menuTree.find((n) => n.code === 'prodProcess')
  const entry = proc.children.find((n) => n.panelCode === 'WO_COMPLETION_LIST')
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

/**
 * 2026-10-20 用户口径:「填完立项申请提交审批后不知道文件到哪个流程了……在项目管理里面加上一个项目流程管控,
 *   通过立项申请表的编号查流程走到哪里」。⇒ 项目管理组多一张只读盯单页 PROJECT_FLOW(排最后)。
 */
test('项目管理组:立项申请 → 项目实施计划 → 项目进度查询 → 项目流程管控', () => {
  assert.deepEqual(leafCodes(group('rdProject')), ['RD_APPROVAL', 'RD_PLAN', 'RD_PROGRESS', 'PROJECT_FLOW'])
  const flow = group('rdProject').children.find((c) => c.panelCode === 'PROJECT_FLOW')
  assert.equal(flow.title, '项目流程管控')
  assert.equal(flow.path, '/rd/projectFlow', '页面级虚拟面板走专用路由,不是 /panelx/list')
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
 * 2026-10-18 用户口径:「为采购订单补齐,采购订单明细表与采购订单统计表」。
 * 照「销售管理」同款三段式:单据 → 明细表 → 统计表。
 * 面板与视图由 tools/migrate-pu-order-detail-stats-20261018.sql 建,这里钉住**菜单入口**不丢。
 */
test('采购管理 = 采购订单 → 明细表 → 统计表(与销售管理同款三段式)', () => {
  const scm = menuTree.find((n) => n.code === 'scm')
  const purchase = (scm.children || []).find((c) => c.code === 'purchase')
  assert.ok(purchase, '应有 采购管理 分组')
  // 顺序即菜单顺序:单据 → 明细表 → 统计表(照抄 销售管理)
  assert.deepEqual((purchase.children || []).map((c) => c.code), ['purchaseDoc', 'purchaseDetail', 'purchaseStats'])
  const codesOf = (node) => {
    if (Array.isArray(node)) return node.flatMap(codesOf)
    if (!node || typeof node !== 'object') return []
    return (node.panelCode ? [node.panelCode] : []).concat(codesOf(node.children))
  }
  // 2026-10-19《10.19 问题》第 3 条:特采单(QC_TC_IN)从 品质管理 > 来料品质 搬到 采购管理 > 单据,
  // 排在采购订单之后(同组叶子顺序即菜单顺序)。
  assert.deepEqual(codesOf(purchase), ['PU_ORDER', 'QC_TC_IN', 'PU_ORDER_DETAIL', 'PU_ORDER_STATS'])
  // 特采单只能有一个入口,且不得再挂在 品质管理 下
  const qc = menuTree.find((n) => n.code === 'qc')
  const qcCodes = JSON.stringify(qc)
  assert.ok(!qcCodes.includes('QC_TC_IN'), '品质管理下不应再挂特采单')
  const tcinLeaf = (purchase.children || []).flatMap((c) => c.children || []).find((x) => x.panelCode === 'QC_TC_IN')
  assert.equal(tcinLeaf.title, '特采单')
  assert.equal(tcinLeaf.path, '/panelx/list/QC_TC_IN')
  // 两个报表都要能点进去(path 指向 panelx 列表),且标题就是「统计表」口径
  const leaf = (p) => (purchase.children || []).flatMap((c) => c.children || []).find((x) => x.panelCode === p)
  assert.equal(leaf('PU_ORDER_DETAIL').path, '/panelx/list/PU_ORDER_DETAIL')
  assert.equal(leaf('PU_ORDER_STATS').path, '/panelx/list/PU_ORDER_STATS')
  assert.equal(leaf('PU_ORDER_STATS').title, '采购订单统计表')
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
 * 2026-10-20:新增 项目流程管控 PROJECT_FLOW(只读盯单页)⇒ 23 → 24 张。
 * 计数断言保留价值:防止面板被误删/误加而不自知。
 */
test('研发管理 24 个面板一个不少(含新增 项目流程管控)', () => {
  const collect = (node) => (node.children || []).flatMap((child) => (child.children ? collect(child) : [child.panelCode]))
  const codes = collect(rd).filter(Boolean)
  assert.equal(codes.length, 24)
  assert.equal(new Set(codes).size, 24)
  assert.ok(codes.includes('PROJECT_FLOW'), '项目流程管控必须挂在研发管理下')
})

/**
 * 2026-10-20 用户口径:「把生产制造的生产计划和生产过程提成一级目录,生产制造这个一级目录不要了;
 *   把设备维护挪到系统管理平台」。
 * ⇒ 一级目录里不再有「生产制造」(mfg);生产计划 / 生产过程 各成一级;设备维护整组挂到「系统管理平台」。
 * 只动菜单分组:面板码/路由/权限词不变(可随时按本段回滚)。
 */
test('生产制造已拆:生产计划 / 生产过程 升为一级,设备维护移到系统管理平台', () => {
  const topCodes = menuTree.map((n) => n.code)
  assert.ok(!topCodes.includes('mfg'), '不应再有「生产制造」一级目录')
  const plan = menuTree.find((n) => n.code === 'plan')
  const proc = menuTree.find((n) => n.code === 'prodProcess')
  assert.equal(plan?.title, '生产计划')
  assert.equal(proc?.title, '生产过程')
  // 一级目录顺序:生产计划在生产过程之前(原 mfg 内顺序)
  assert.ok(topCodes.indexOf('plan') >= 0 && topCodes.indexOf('plan') < topCodes.indexOf('prodProcess'),
    '生产计划应在生产过程之前')
  // 设备维护:从生产域挪到「系统管理平台」(base),且不再挂在 plan/prodProcess 下
  const base = menuTree.find((n) => n.code === 'base')
  const device = (base.children || []).find((c) => c.code === 'device')
  assert.equal(device?.title, '设备维护')
  assert.deepEqual((device.children || []).map((c) => c.panelCode), ['EQUIP_CHECK', 'MAINT_PLAN'])
  assert.ok(!(plan.children || []).some((c) => c.code === 'device'), '生产计划下不应再有设备维护')
  assert.ok(!(proc.children || []).some((c) => c.code === 'device'), '生产计划下不应再有设备维护')
})

/**
 * 2026-10-18 用户口径「把生产制造模块里面的生产执行和生产记录合并一下改为生产过程」。
 * 合并只改菜单分组,**10 个面板入口与顺序保持原样**:原生产执行 4 项在前、原生产记录 6 项在后。
 * 顺序被钉住是为了防止合并时不小心丢项或重排(用户按现有位置找菜单)。
 */
test('生产过程组 = 原生产执行 4 项 + 原生产记录 6 项,顺序不变', () => {
  const proc = menuTree.find((n) => n.code === 'prodProcess')
  assert.deepEqual((proc.children || []).map((c) => c.panelCode), [
    'WO_REPORT', 'WO_REPORT_LIST', 'WO_COMPLETION_LIST', 'PROD_ABN',
    'DAY_REPORT', 'FEED_CONFIRM', 'MIX_RECORD', 'GRAN_RECORD', 'WH_RECORD', 'PACK_CONFIRM',
  ])
  assert.deepEqual((proc.children || []).map((c) => c.title), [
    '工序报工单', '报工记录', '完工明细', '生产异常处理单',
    '生产日报表', '投料确认单', '物料混合记录', '造粒记录', '无黑处理登记', '封箱确认',
  ])
})

/**
 * 2026-10-16 用户口径「去除当前这两个菜单内的单据」:
 * 样品管理(样品申请单 SAMPLE_REQ)与经典单据(工序派工单 DISPATCH / 委外加工单 OUTSOURCE_ORDER /
 * 工序派工单明细表 DISPATCH_DETAIL / 工序派工单统计表 DISPATCH_STATS)两组整体摘除。
 * 走轻路线(元数据与物理表保留可回滚)⇒ 钉住的是「菜单里不得再有入口」,不是「面板已删」。
 * 恢复 = 放开 menus.js 里那两段的注释,届时本测试必须同步改回。
 */
test('样品管理 / 经典单据 两组下架:菜单树里不得再有这 5 张面板的入口或分组', () => {
  // 2026-10-20:「生产制造」一级目录已拆,故改为在全树范围内钉(原来只看 mfg.children)
  const allGroups = []
  const collect = (nodes) => nodes.forEach((n) => { allGroups.push(n); if (n.children) collect(n.children) })
  collect(menuTree)
  for (const code of ['sample', 'legacy']) {
    assert.ok(!allGroups.some((c) => c.code === code), `不应再有 ${code} 二级分组`)
  }
  for (const title of ['样品管理', '经典单据']) {
    assert.ok(!allGroups.some((c) => c.title === title), `不应再有「${title}」分组`)
  }
  const all = JSON.stringify(menuTree)
  for (const p of ['SAMPLE_REQ', 'DISPATCH', 'OUTSOURCE_ORDER', 'DISPATCH_DETAIL', 'DISPATCH_STATS']) {
    assert.ok(!all.includes(`"${p}"`), `菜单树里不应再有 ${p} 入口`)
  }
})

test('生产计划(2026-10-20 起为一级目录)的明细/统计表挂在所属业务对象下(与销售管理同款)', () => {
  const plan = menuTree.find((n) => n.code === 'plan')
  const group = () => plan
  // 域内顺序 = 单据 → 明细表 → 统计表(照抄 智能供应链·销售管理)
  // 2026-10-16:生产计划域的四个看板页面(订单结转/生产工单/快速排产/工单排产)新增了
  // **页面级虚拟面板码**(权限化,定义见后端 PagePanelRegistry),故也进入本断言 ——
  // 顺序即 menus.js 里的菜单顺序,改菜单必须同步这里。
  // 2026-10-17:生产工单明细表/统计表(MANU_ORDER_DETAIL/MANU_ORDER_STATS)**下架**
  //   —— 载体视图读的是正式库 0 行的 bd_manu_order/bl_manu_order,打开即空表,且从未被打开过
  //   (migrate-drop-manu-order-report-panels-20261017.sql),故从本断言里移除。
  assert.deepEqual((group().children || []).map((c) => c.panelCode).filter(Boolean),
    ['ORDER_CONVERT', 'WORK_ORDER_LIST', 'SCHEDULE_BOARD', 'WORK_ORDER_BOARD', 'LINE_LOAD'])
  // 下架后不该再出现在菜单树里:防"删了数据库却漏删菜单",反之亦然
  const all = JSON.stringify(plan)
  for (const p of ['MANU_ORDER_DETAIL', 'MANU_ORDER_STATS']) {
    assert.equal(all.split(`"${p}"`).length - 1, 0, `${p} 已下架,不该再出现在生产计划菜单里`)
  }
})

// 2026-10-18:数采平台(dc)的二级项是**页面级叶子**——三页是 Vue 页面,不是 yj_panel 面板,
//   因此没有 panelCode、也不该再套一层分组。这里不是"放宽断言",而是对它单独钉更严的口子:
//   必须带 /dc/ 路由前缀、不带 panelCode/operationName、code 与 path 一一对应。
// 2026-10-20:生产计划 / 生产过程 由「生产制造」下的二级目录升为一级目录 ⇒ 它们的一级子项是
//   带 panelCode 的**面板叶子**(不是再套一层分组),与 dc 同款但必须挂面板码。
const PAGE_LEAF_GROUPS = new Set(['dc'])
const PANEL_LEAF_GROUPS = new Set(['plan', 'prodProcess'])
test('导航层级同构:一级模块的二级目录一律是"带面板的分组",不出现裸叶子/空壳层', () => {
  for (const g of menuTree) {
    if (!g.children || !g.children.length) continue // 我的桌面 等暂无二级
    if (PAGE_LEAF_GROUPS.has(g.code)) {
      for (const c of g.children) {
        assert.ok(typeof c.path === 'string' && c.path.startsWith('/dc/'), `${g.title} > ${c.title} 应是 /dc/ 下的页面级路由`)
        // 2026-10-20:三页挂上页面级虚拟面板码(DC_CONFIG/DC_MONITOR/DC_STATS),才能在
        //   组织架构「角色与面板权限」里授权 —— 口径与订单结转等四个看板一致。
        assert.ok(/^DC_[A-Z]+$/.test(String(c.panelCode)), `${g.title} > ${c.title} 应带 DC_* 页面面板码`)
        assert.equal(c.children, undefined, `${g.title} > ${c.title} 是页面级叶子,不该再套分组`)
      }
      continue
    }
    if (PANEL_LEAF_GROUPS.has(g.code)) {
      for (const c of g.children) {
        assert.ok(typeof c.panelCode === 'string' && c.panelCode.length > 0, `${g.title} > ${c.title} 应带面板编码`)
        assert.equal(c.children, undefined, `${g.title} > ${c.title} 是面板叶子,不该再套分组`)
      }
      continue
    }
    for (const c of g.children) {
      assert.ok(Array.isArray(c.children) && c.children.length > 0, `${g.title} > ${c.title} 应是"带面板的分组"`)
    }
  }
})

/**
 * 2026-10-18 用户口径:「智能供应链里面的库存核算,库存明细,库存统计和库存报表。单独提出来写在一个
 * 和智能供应链同一级下的目录下(新建为)库存管理」。
 * 终态 = 「库存管理」是与「智能供应链」同级的**独立一级目录**,四个分组整体搬过去(顺序不变);
 *       「智能供应链」只剩 销售管理 / 采购管理。
 * 判定口径 = 面板编码集合:同一张面板不得在两个一级目录里各挂一次,也不得从「智能供应链」溜回来。
 */
test('WMS管理 = 与智能供应链同级的一级目录,含 库存核算/库存明细/库存统计/库存报表 四组', () => {
  const topCodes = menuTree.map((n) => n.code)
  assert.ok(topCodes.includes('inv'), '应有一级目录 WMS管理(inv)')
  const inv = menuTree.find((n) => n.code === 'inv')
  assert.equal(inv.title, 'WMS管理')
  const scm = menuTree.find((n) => n.code === 'scm')
  assert.equal(topCodes.indexOf('inv'), topCodes.indexOf('scm') + 1, 'WMS管理紧随智能供应链(同级)')

  // 五个分组:code 保持原值(权限/页签/展开记忆都按 code 走),顺序 = 核算 → 明细 → 统计 → 报表 → 条码管理
  // (条码管理 2026-10-18 并入库存管理:它与库存报表同属 WMS 域,合并在「库存管理」下比留在智能供应链更顺)
  assert.deepEqual((inv.children || []).map((c) => c.code), ['invAcct', 'invDetail', 'invStats', 'invReports', 'barcode'])
  assert.deepEqual((inv.children || []).map((c) => c.title), ['库存核算', '库存明细', '库存统计', '库存报表', '条码管理'])

  // 智能供应链:四个库存分组一个都不该留下
  assert.deepEqual((scm.children || []).map((c) => c.code), ['sales', 'purchase'])

  const codesOf = (node) => {
    if (Array.isArray(node)) return node.flatMap(codesOf)
    if (!node || typeof node !== 'object') return []
    const self = node.panelCode ? [node.panelCode] : []
    return self.concat(codesOf(node.children))
  }
  const invCodes = codesOf(inv)
  // 库存核算 10 张单据 + 明细 8 + 统计 8 + 报表 4 + 条码管理 3 = 33 张面板,另加 2026-10-20
  //   给「扫码领料」挂的页面级面板码 BARCODE_SCAN_PICK(此前无码 ⇒ 任何人可进,也不在权限矩阵里)
  //   ⇒ 34。2026-10-18 的增项:调拨单 TRANSFER / 盘点单 STOCKTAKE 及其明细表/统计表。
  // 2026-10-21 再加「工单扫码领料」的页面级面板码 WORK_ORDER_PICK(按工单+BOM 作业)⇒ 35。
  // 同批「扫码领料记录」也挂 WORK_ORDER_PICK(同一作业的留痕查询,不另开权限码)⇒ 菜单项多一条
  // 但**面板码不重复** —— 下面 new Set 的断言仍然成立,这正是共用面板码的预期。
  assert.equal(invCodes.length, 36, `WMS管理应有 36 个面板码挂点,实际 ${invCodes.length}`)
  assert.equal(new Set(invCodes).size, 35, 'WMS管理内不应有重复面板(扫码领料记录与工单扫码领料共用 WORK_ORDER_PICK)')
  assert.ok(invCodes.includes('BARCODE_SCAN_PICK'), '扫码领料应挂页面级面板码)')
  assert.ok(invCodes.includes('WORK_ORDER_PICK'), '工单扫码领料应挂页面级面板码(2026-10-21)')
  assert.ok(invCodes.includes('STOCK_DETAIL') && invCodes.includes('STOCK_BALANCE'), '库存明细/报表入口应在WMS管理')
  // 调拨单 / 盘点单:库存核算里唯二「审核即改 kucun」的新单据 —— 单据 + 明细表 + 统计表 入口钉死
  for (const p of ['TRANSFER', 'TRANSFER_DETAIL', 'TRANSFER_STATS',
                   'STOCKTAKE', 'STOCKTAKE_DETAIL', 'STOCKTAKE_STATS']) {
    assert.ok(invCodes.includes(p), `WMS管理下应有 ${p} 入口`)
  }
  const scmCodes = codesOf(scm)
  for (const p of invCodes) {
    assert.ok(!scmCodes.includes(p), `${p} 已在WMS管理下,不应再从智能供应链暴露`)
  }
})

/**
 * 2026-10-18 用户口径:「将基础档案改名为系统管理平台」;同日第二轮:「把现在系统管理平台里面的面板
 * 全部挪到数据建模,然后把这个做成入口写到系统管理平台里面」(顶栏用户下拉那几项收成一页)。
 * 终态 = 一级目录 code 仍是 'base'(路由/展开态/页签/权限都不按标题走),但**不挂任何业务面板**,
 *       只剩一个「系统功能」分组:系统管理(入口页 sys/console) / 组织架构 / 使用权限查看。
 */
test('系统管理平台(base)= 系统功能入口 + 设备维护(2026-10-20 从生产域搬来)', () => {
  const base = menuTree.find((n) => n.code === 'base')
  assert.equal(base.title, '系统管理平台')
  assert.deepEqual((base.children || []).map((c) => c.code), ['sysFunc', 'device'])
  const sysFunc = base.children[0]
  assert.equal(sysFunc.title, '系统功能')
  // 2026-10-19 追加「数据备份」(sysBackup,管理员专属的数据安全页:数据库主动/自动备份);
  // 2026-10-23 追加「菜单设计」(sysMenuDesign,管理员专属:改导航名称/分组/顺序/隐藏)
  assert.deepEqual((sysFunc.children || []).map((c) => c.code), ['sysConsole', 'sysOrg', 'sysUsage', 'sysBackup', 'sysMenuDesign'])
  // 组织架构 / 使用权限查看 / 数据备份 / 菜单设计 = 管理员专属(adminOnly,filterMenuTree 只对 isAdmin 放行)
  assert.deepEqual((sysFunc.children || []).filter((c) => c.adminOnly).map((c) => c.code), ['sysOrg', 'sysUsage', 'sysBackup', 'sysMenuDesign'])
  const topTitles = menuTree.map((n) => n.title)
  assert.ok(!topTitles.includes('基础档案'), '一级菜单不应再有「基础档案」')
  // 迁出后只剩 sysFunc(无面板)+ device(2026-10-20 搬来的设备维护:点检记录 / 保养计划)
  assert.deepEqual((base.children[1].children || []).map((c) => c.panelCode), ['EQUIP_CHECK', 'MAINT_PLAN'])
  // 32 张基础资料面板仍不许回来(口径见下一条测试),整枝只允许 device 这两个码
  const panelCodes = [...JSON.stringify(base).matchAll(/"panelCode":"([A-Z0-9_]+)"/g)].map((m) => m[1])
  assert.deepEqual([...new Set(panelCodes)].sort(), ['EQUIP_CHECK', 'MAINT_PLAN'])
})

/**
 * 2026-10-18 第二轮落点:原「基础数据/物料及价格/生产/财务」四组 32 张面板整组进「数据建模」。
 * 菜单侧只挂出其中一部分(库存状况 STOCK_STATUS / 往来单位 PARTNER 早在 2026-09-17 就下线;
 * 客户分组 CUSGRP / 物料分组 MATGRP / 供应商分组 SUPGRP / 检验项目 QC_ITEM / 检验计划 QC_PLAN /
 * 烧结公差 RD_SINTER_TOL 与明细面板 ERPLG_ROW 本就没有菜单项),
 * 故 27 = 字段管理 + 数据字典 + 迁来的 25 张。
 * ⚠ 「ERP导入日志 ERPLG」已按 2026-10-18 后续口径迁到一级目录「ERP系统集成」,不再计入数据建模。
 */
test('数据建模(dm)接住系统管理平台迁来的四组面板(整树里每张只挂一次)', () => {
  const dm = menuTree.find((n) => n.code === 'dm')
  const codesOf = (node) => {
    if (Array.isArray(node)) return node.flatMap(codesOf)
    if (!node || typeof node !== 'object') return []
    const self = node.panelCode ? [node.panelCode] : []
    return self.concat(codesOf(node.children))
  }
  const dmCodes = codesOf(dm)
  const moved = ['DEPT', 'EMP', 'WH', 'WHLOC', 'KHDA', 'GFDA', 'REGION', 'PROJ', 'UOM',
    'INV', 'WLBOM', 'INV_PRICE', 'EQUIP', 'TEAM', 'WC', 'PROD_LINE', 'OP', 'ROUTE', 'OP_TIME',
    'REJECT', 'FIN_TAX', 'SETTLE', 'CUR', 'FIN_EXP', 'FIN_ACC']
  for (const code of moved) {
    assert.ok(dmCodes.includes(code), `系统管理平台迁来的面板 ${code} 应在数据建模下`)
  }
  assert.equal(dmCodes.length, 27, `数据建模应有 27 张面板入口,实际 ${dmCodes.length}`)
  assert.equal(new Set(dmCodes).size, 27, '数据建模内不应有重复面板')
  // 2026-10-20:设备维护整组搬进系统管理平台 ⇒ base 下允许 EQUIP_CHECK / MAINT_PLAN 两张,
  //   基础资料那 32 张仍不许回来
  const baseCodes = codesOf(menuTree.find((n) => n.code === 'base'))
  assert.deepEqual([...new Set(baseCodes)].sort(), ['EQUIP_CHECK', 'MAINT_PLAN'],
    '系统管理平台只应挂设备维护两张(2026-10-20 迁入)')
})

/**
 * adminOnly 叶子(没 panelCode 却带 path)以前会被 filterMenuTree 的 if (n.path) 当"有权限"放行,
 * 非管理员因此能在侧边栏点到组织架构/使用权限查看。这里钉住修正后的行为。
 */
test('filterMenuTree:非管理员看不到 adminOnly 叶子,管理员全量可见', () => {
  const base = menuTree.find((n) => n.code === 'base')
  const vis = () => []
  const filtered = filterMenuTree([base], vis(), false)[0]
  const codes = (filtered?.children || []).flatMap((g) => (g.children || []).map((c) => c.code))
  assert.ok(codes.includes('sysConsole'), '非管理员应仍能用「系统管理」入口页')
  assert.ok(!codes.includes('sysOrg'), '非管理员不应看到组织架构')
  assert.ok(!codes.includes('sysUsage'), '非管理员不应看到使用权限查看')
  assert.ok(!codes.includes('sysBackup'), '非管理员不应看到数据备份(备份文件=全库数据拷贝)')
  const admin = filterMenuTree([base], vis(), true)[0]
  // 2026-10-20:base 下多了「设备维护」组(设备点检记录 / 保养计划),按组拆开断言
  const adminGroups = (admin.children || []).map((g) => ({ code: g.code, kids: (g.children || []).map((c) => c.code) }))
  // 2026-10-19:数据安全 · 数据库备份(sysBackup)接在系统功能组末尾,管理员专属
  // 2026-10-23:菜单设计(sysMenuDesign)再往后接一格,同样管理员专属
  assert.deepEqual(adminGroups, [
    { code: 'sysFunc', kids: ['sysConsole', 'sysOrg', 'sysUsage', 'sysBackup', 'sysMenuDesign'] },
    { code: 'device', kids: ['equipCheck', 'maintPlan'] },
  ])
})

/**
 * 2026-10-18 用户口径(第二版):「在系统左侧菜单写一个 erp 系统集成的目录,目录下把 erp 导入日志
 * 移动到他下方;再写一个 erp 集成配置清单…」。
 * 终态 = 一级目录「ERP系统集成」(erpInteg) → ERP集成配置清单(ERP_INTEG,页面级虚拟面板) / ERP导入日志(ERPLG);
 *       数据建模只保留 字段管理 / 数据字典;系统管理平台两份都不得再挂(防两边各挂一份)。
 */
test('ERP系统集成 = 一级目录,含 配置清单 / ERP导入日志', () => {
  const erp = menuTree.find((n) => n.code === 'erpInteg')
  assert.ok(erp, '应有一级目录 ERP系统集成(erpInteg)')
  assert.equal(erp.title, 'ERP系统集成')
  // 二级是「集成管理」分组(导航层级同构:一级下面不出现裸叶子),两个面板都挂在该组下
  const grp = (erp.children || [])[0]
  assert.ok(grp?.children?.length, 'ERP系统集成 下应是「带面板的分组」')
  assert.deepEqual((grp.children || []).map((c) => c.panelCode), ['ERP_INTEG', 'ERPLG'])
  assert.equal(grp.children[0].path, '/erp/integConfig')

  // 数据建模 = 字段管理 / 数据字典 + 系统管理平台迁来的四组(ERP集成分组已随用户口径迁出)
  const dm = menuTree.find((n) => n.code === 'dm')
  assert.deepEqual((dm.children || []).map((c) => c.title),
    ['字段管理', '数据字典', '基础数据', '物料及价格', '生产', '财务'])
  // 系统管理平台迁来的 32 张面板必须真的挂在数据建模下(与 merge 前本地口径一致)
  const dmPanels = (() => {
    const acc = []
    const walk = (n) => { if (Array.isArray(n)) return n.forEach(walk); if (!n || typeof n !== 'object') return; if (n.panelCode) acc.push(n.panelCode); (n.children || []).forEach(walk) }
    walk(dm)
    return acc
  })()
  for (const p of ['DEPT', 'EMP', 'WH', 'INV', 'PROD_LINE', 'FIN_ACC']) {
    assert.ok(dmPanels.includes(p), `数据建模下应有 ${p}`)
  }

  const codesOf = (node) => {
    if (Array.isArray(node)) return node.flatMap(codesOf)
    if (!node || typeof node !== 'object') return []
    const self = node.panelCode ? [node.panelCode] : []
    return self.concat(codesOf(node.children))
  }
  const erpCodes = codesOf(erp)
  for (const p of ['ERP_INTEG', 'ERPLG']) {
    assert.ok(erpCodes.includes(p), `ERP系统集成下应有 ${p}`)
  }
  const dmCodes = codesOf(dm)
  for (const p of ['FIELDMGR', 'ZDGL']) {
    assert.ok(dmCodes.includes(p), `数据建模下应有 ${p}`)
  }
  assert.ok(!dmCodes.includes('ERPLG'), 'ERPLG 已迁到 ERP系统集成,数据建模里不应再有入口')
  // 迁移而非复制:系统管理平台里不得再出现这两个面板
  const baseCodes = codesOf(menuTree.find((n) => n.code === 'base'))
  for (const p of ['ZDGL', 'ERPLG']) {
    assert.ok(!baseCodes.includes(p), `${p} 已迁出,系统管理平台里不应再有入口`)
  }
  // 整棵树里每张面板只挂一次
  const all = codesOf(menuTree)
  for (const p of ['FIELDMGR', 'ZDGL', 'ERPLG', 'ERP_INTEG']) {
    assert.equal(all.filter((c) => c === p).length, 1, `${p} 在整个菜单树里应恰好出现一次`)
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
  // (2026-10-23:该组 code 由 'process' 改为 'qcProcess' —— 与「工序 OP」叶子重名,菜单覆盖表要求 code 全树唯一)
  const qc = menuTree.find((n) => n.code === 'qc')
  const group = (code) => (qc.children || []).find((c) => c.code === code)
  assert.deepEqual((group('qcProcess').children || []).map((c) => c.panelCode),
    ['QC_FIRST_INSP', 'QC_PROC_INSP', 'QC_ASM_INSP'])
  assert.equal((group('qcDoc').children || []).length, 7)
})

/**
 * 2026-10-18 用户口径(附件一 WMS 三条「条码管理」):三个只读报表面板,一批一码,
 * 半成品先走「报工数据派生视图」。这里钉住入口与形态:
 *   · 三个 panelCode 必须在导航里且各自独立(不能挤成一张面板);
 *   · 走的必须是通用面板路由 /panelx/list/<code>(后端 flat 面板,前端零页面)。
 */
test('条码管理组(库存管理下):材料/半成品/成品 三个只读面板 + 扫码领料入口', () => {
  const inv = menuTree.find((n) => n.code === 'inv')
  const bc = (inv.children || []).find((c) => c.code === 'barcode')
  assert.ok(bc, '库存管理下应有「条码管理」分组')
  assert.equal(bc.title, '条码管理')
  // 2026-10-18 追加第四个叶子「扫码领料」;2026-10-20 起它也挂页面级面板码 BARCODE_SCAN_PICK
  //   (此前无码 ⇒ 权限矩阵里勾不到、任何人可进)。三个只读报表面板与本页区分开断言。
  const panelLeaves = (bc.children || []).filter((c) => c.panelCode && c.path.startsWith('/panelx/list/'))
  assert.deepEqual(panelLeaves.map((c) => c.panelCode),
    ['BARCODE_MAT', 'BARCODE_WIP', 'BARCODE_FIN'])
  assert.deepEqual(panelLeaves.map((c) => c.title),
    ['材料仓条码管理', '半成品仓条码管理', '成品仓条码管理'])
  for (const leaf of panelLeaves) {
    assert.equal(leaf.path, '/panelx/list/' + leaf.panelCode)
  }
  const scanPick = (bc.children || []).find((c) => c.code === 'barcodeScanPick')
  assert.ok(scanPick, '条码管理下应有「扫码领料」入口')
  assert.equal(scanPick.path, '/scm/scanPick')
  assert.equal(scanPick.panelCode, 'BARCODE_SCAN_PICK', '扫码领料应挂页面级面板码(2026-10-20)')
  assert.equal(scanPick.title, '扫码领料')
  // 工单扫码领料(2026-10-21):与上面「扫码领料」并列,但作业口径不同 —— 这张按工单+BOM,
  // 那张按物料找库存。两者都必须有各自的页面级面板码,否则权限矩阵里勾不到。
  const woPick = (bc.children || []).find((c) => c.code === 'workOrderPick')
  assert.ok(woPick, '条码管理下应有「工单扫码领料」入口')
  assert.equal(woPick.path, '/scm/workOrderPick')
  assert.equal(woPick.panelCode, 'WORK_ORDER_PICK')
  assert.equal(woPick.title, '工单扫码领料')
})
