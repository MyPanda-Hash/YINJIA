// YINJIA-MES 菜单:面板以 HSDZ_MES yj_panel 注册表为准(首批 10 面板)
// 结构与过滤逻辑沿用 light-mes(busy 层适配,core 渲染器不改)
export const menuTree = [
  {
    code: 'dashboard',
    title: '我的桌面',
    path: '/dashboard',
    icon: 'HomeFilled',
  },
  {
    code: 'ywdj',
    title: '业务单据',
    icon: 'Tickets',
    children: [
      { code: 'rkd', title: '入库单', path: '/panelx/list/RKD', icon: 'Download', panelCode: 'RKD', operationName: '新增流程' },
      { code: 'ckd', title: '出库单', path: '/panelx/list/CKD', icon: 'Upload', panelCode: 'CKD', operationName: '新增流程' },
      { code: 'cgd', title: '采购单', path: '/panelx/list/CGD', icon: 'ShoppingCart', panelCode: 'CGD', operationName: '新增流程' },
      { code: 'khdd', title: '客户订单', path: '/panelx/list/KHDD', icon: 'Document', panelCode: 'KHDD', operationName: '新增流程' },
      { code: 'wlbom', title: '物料清单', path: '/panelx/list/WLBOM', icon: 'Grid', panelCode: 'WLBOM', operationName: '新增流程' },
    ],
  },
  {
    // 智能供应链(light-mes scm 框架:采购管理 + 库存核算;委外归采购管理)
    code: 'scm',
    title: '智能供应链',
    icon: 'Connection',
    children: [
      {
        code: 'sales',
        title: '销售管理',
        icon: 'ShoppingCart',
        children: [
          {
            code: 'doc', title: '单据', children: [
              { code: 'soOrder', title: '销售订单', path: '/panelx/list/SO_ORDER', icon: 'Tickets', panelCode: 'SO_ORDER', operationName: '新增流程' },
            ],
          },
          {
            code: 'detail', title: '明细表', children: [
              { code: 'soDetail', title: '销售订单明细表', path: '/panelx/list/SALES_ORDER_DETAIL', panelCode: 'SALES_ORDER_DETAIL', icon: 'List' },
            ],
          },
          {
            code: 'stats', title: '统计表', children: [
              { code: 'soStats', title: '销售订单统计表', path: '/panelx/list/SALES_ORDER_STATS', panelCode: 'SALES_ORDER_STATS', icon: 'Histogram' },
            ],
          },
        ],
      },
      {
        code: 'purchase',
        title: '采购管理',
        icon: 'ShoppingCart',
        children: [
          {
            code: 'doc', title: '单据', children: [
              { code: 'puReq', title: '请购单', path: '/panelx/list/PU_REQ', icon: 'Tickets', panelCode: 'PU_REQ', operationName: '新增流程' },
              { code: 'puOrder', title: '采购订单', path: '/panelx/list/PU_ORDER', icon: 'Tickets', panelCode: 'PU_ORDER', operationName: '新增流程' },
            ],
          },
        ],
      },
      {
        code: 'invAcct',
        title: '库存核算',
        icon: 'Box',
        children: [
          {
            code: 'doc', title: '单据', children: [
              { code: 'purchaseIn', title: '采购入库单', path: '/panelx/list/PURCHASE_IN', icon: 'Download', panelCode: 'PURCHASE_IN', operationName: '新增流程' },
              { code: 'finishIn', title: '产成品入库单', path: '/panelx/list/FINISH_IN', icon: 'Download', panelCode: 'FINISH_IN', operationName: '新增流程' },
              { code: 'otherIn', title: '其他入库单', path: '/panelx/list/OTHER_IN', icon: 'Download', panelCode: 'OTHER_IN', operationName: '新增流程' },
              { code: 'outsourceIn', title: '委外入库单', path: '/panelx/list/OUTSOURCE_IN', icon: 'Download', panelCode: 'OUTSOURCE_IN', operationName: '新增流程' },
              { code: 'saleOut', title: '销售出库单', path: '/panelx/list/SALE_OUT', icon: 'Upload', panelCode: 'SALE_OUT', operationName: '新增流程' },
              { code: 'materialOut', title: '材料出库单', path: '/panelx/list/MATERIAL_OUT', icon: 'Upload', panelCode: 'MATERIAL_OUT', operationName: '新增流程' },
              { code: 'otherOut', title: '其他出库单', path: '/panelx/list/OTHER_OUT', icon: 'Upload', panelCode: 'OTHER_OUT', operationName: '新增流程' },
              { code: 'outsourceIssue', title: '委外发料单', path: '/panelx/list/OUTSOURCE_ISSUE', icon: 'Upload', panelCode: 'OUTSOURCE_ISSUE', operationName: '新增流程' },
            ],
          },
          {
            code: 'detail', title: '明细表', children: [
              { code: 'purchaseInDetail', title: '采购入库单明细表', path: '/panelx/list/PURCHASE_IN_DETAIL', panelCode: 'PURCHASE_IN_DETAIL', icon: 'List' },
              { code: 'finishInDetail', title: '产成品入库单明细表', path: '/panelx/list/FINISH_IN_DETAIL', panelCode: 'FINISH_IN_DETAIL', icon: 'List' },
              { code: 'otherInDetail', title: '其他入库单明细表', path: '/panelx/list/OTHER_IN_DETAIL', panelCode: 'OTHER_IN_DETAIL', icon: 'List' },
              { code: 'outsourceInDetail', title: '委外入库单明细表', path: '/panelx/list/OUTSOURCE_IN_DETAIL', panelCode: 'OUTSOURCE_IN_DETAIL', icon: 'List' },
              { code: 'saleOutDetail', title: '销售出库单明细表', path: '/panelx/list/SALE_OUT_DETAIL', panelCode: 'SALE_OUT_DETAIL', icon: 'List' },
              { code: 'materialOutDetail', title: '材料出库单明细表', path: '/panelx/list/MATERIAL_OUT_DETAIL', panelCode: 'MATERIAL_OUT_DETAIL', icon: 'List' },
              { code: 'otherOutDetail', title: '其他出库单明细表', path: '/panelx/list/OTHER_OUT_DETAIL', panelCode: 'OTHER_OUT_DETAIL', icon: 'List' },
              { code: 'outsourceIssueDetail', title: '委外发料单明细表', path: '/panelx/list/OUTSOURCE_ISSUE_DETAIL', panelCode: 'OUTSOURCE_ISSUE_DETAIL', icon: 'List' },
            ],
          },
          {
            code: 'stats', title: '统计表', children: [
              { code: 'purchaseInStats', title: '采购入库单统计表', path: '/panelx/list/PURCHASE_IN_STATS', panelCode: 'PURCHASE_IN_STATS', icon: 'Histogram' },
              { code: 'finishInStats', title: '产成品入库单统计表', path: '/panelx/list/FINISH_IN_STATS', panelCode: 'FINISH_IN_STATS', icon: 'Histogram' },
              { code: 'otherInStats', title: '其他入库单统计表', path: '/panelx/list/OTHER_IN_STATS', panelCode: 'OTHER_IN_STATS', icon: 'Histogram' },
              { code: 'outsourceInStats', title: '委外入库单统计表', path: '/panelx/list/OUTSOURCE_IN_STATS', panelCode: 'OUTSOURCE_IN_STATS', icon: 'Histogram' },
              { code: 'saleOutStats', title: '销售出库单统计表', path: '/panelx/list/SALE_OUT_STATS', panelCode: 'SALE_OUT_STATS', icon: 'Histogram' },
              { code: 'materialOutStats', title: '材料出库单统计表', path: '/panelx/list/MATERIAL_OUT_STATS', panelCode: 'MATERIAL_OUT_STATS', icon: 'Histogram' },
              { code: 'otherOutStats', title: '其他出库单统计表', path: '/panelx/list/OTHER_OUT_STATS', panelCode: 'OTHER_OUT_STATS', icon: 'Histogram' },
              { code: 'outsourceIssueStats', title: '委外发料单统计表', path: '/panelx/list/OUTSOURCE_ISSUE_STATS', panelCode: 'OUTSOURCE_ISSUE_STATS', icon: 'Histogram' },
            ],
          },
        ],
      },
    ],
  },
  {
    // 新生产(light-mes mfg 框架:生产管理)
    code: 'mfg',
    title: '新生产',
    icon: 'Odometer',
    children: [
      {
        code: 'prod',
        title: '生产管理',
        icon: 'Cpu',
        children: [
          {
            code: 'doc', title: '单据', children: [
              { code: 'manufactureOrder', title: '生产加工单', path: '/panelx/list/MANU_ORDER', icon: 'Document', panelCode: 'MANU_ORDER', operationName: '新增流程' },
              { code: 'dispatch', title: '工序派工单', path: '/panelx/list/DISPATCH', icon: 'AlarmClock', panelCode: 'DISPATCH', operationName: '新增流程' },
              { code: 'outsourceOrder', title: '委外加工单', path: '/panelx/list/OUTSOURCE_ORDER', icon: 'Tickets', panelCode: 'OUTSOURCE_ORDER', operationName: '新增流程' },
            ],
          },
          {
            code: 'detail', title: '明细表', children: [
              { code: 'manuDetail', title: '生产加工单明细表', path: '/panelx/list/MANU_ORDER_DETAIL', panelCode: 'MANU_ORDER_DETAIL', icon: 'List' },
              { code: 'dispatchDetail', title: '工序派工单明细表', path: '/panelx/list/DISPATCH_DETAIL', panelCode: 'DISPATCH_DETAIL', icon: 'List' },
            ],
          },
          {
            code: 'stats', title: '统计表', children: [
              { code: 'manuStats', title: '生产加工单统计表', path: '/panelx/list/MANU_ORDER_STATS', panelCode: 'MANU_ORDER_STATS', icon: 'Histogram' },
              { code: 'dispatchStats', title: '工序派工单统计表', path: '/panelx/list/DISPATCH_STATS', panelCode: 'DISPATCH_STATS', icon: 'Histogram' },
            ],
          },
        ],
      },
    ],
  },
  {
    // 基础设置(目录结构按 light-mes 原版:foundation → base → 基本信息/价格信息)
    code: 'jcsz',
    title: '基础设置',
    icon: 'Setting',
    children: [
      {
        code: 'base',
        title: '基础设置',
        icon: 'Collection',
        children: [
          {
            code: 'info',
            title: '基本信息',
            children: [
              { code: 'dept', title: '部门', path: '/panelx/list/DEPT', icon: 'OfficeBuilding', panelCode: 'DEPT', operationName: '新增流程' },
              { code: 'employee', title: '员工', path: '/panelx/list/EMP', icon: 'User', panelCode: 'EMP', operationName: '新增流程' },
              { code: 'partner', title: '往来单位', path: '/panelx/list/PARTNER', icon: 'OfficeBuilding', panelCode: 'PARTNER', operationName: '新增流程' },
              { code: 'khda', title: '客户档案', path: '/panelx/list/KHDA', icon: 'User', panelCode: 'KHDA', operationName: '新增流程' },
              { code: 'uom', title: '计量单位', path: '/panelx/list/UOM', icon: 'ScaleToOriginal', panelCode: 'UOM', operationName: '新增流程' },
              { code: 'inventory', title: '存货', path: '/panelx/list/INV', icon: 'Grid', panelCode: 'INV', operationName: '新增流程' },
              { code: 'equip', title: '设备', path: '/panelx/list/EQUIP', icon: 'Cpu', panelCode: 'EQUIP', operationName: '新增流程' },
              { code: 'team', title: '班组', path: '/panelx/list/TEAM', icon: 'UserFilled', panelCode: 'TEAM', operationName: '新增流程' },
              { code: 'wc', title: '工作中心', path: '/panelx/list/WC', icon: 'Odometer', panelCode: 'WC', operationName: '新增流程' },
              { code: 'process', title: '工序', path: '/panelx/list/OP', icon: 'SetUp', panelCode: 'OP', operationName: '新增流程' },
              { code: 'routing', title: '工艺路线', path: '/panelx/list/ROUTE', icon: 'Guide', panelCode: 'ROUTE', operationName: '新增流程' },
              { code: 'bom', title: '物料清单', path: '/panelx/list/BOM', icon: 'Files', panelCode: 'BOM', operationName: '新增流程' },
              { code: 'warehouse', title: '仓库', path: '/panelx/list/WH', icon: 'House', panelCode: 'WH', operationName: '新增流程' },
              { code: 'region', title: '地区', path: '/panelx/list/REGION', icon: 'Location', panelCode: 'REGION', operationName: '新增流程' },
              { code: 'proj', title: '项目', path: '/panelx/list/PROJ', icon: 'Flag', panelCode: 'PROJ', operationName: '新增流程' },
              { code: 'reject', title: '不合格原因', path: '/panelx/list/REJECT', icon: 'CircleClose', panelCode: 'REJECT', operationName: '新增流程' },
              { code: 'qcItem', title: '检验项目', path: '/panelx/list/QC_ITEM', icon: 'List', panelCode: 'QC_ITEM', operationName: '新增流程' },
              { code: 'qcPlan', title: '检验方案', path: '/panelx/list/QC_PLAN', icon: 'DocumentChecked', panelCode: 'QC_PLAN', operationName: '新增流程' },
              { code: 'zdgl', title: '数据字典', path: '/panelx/list/ZDGL', icon: 'Collection', panelCode: 'ZDGL', operationName: '新增流程' },
            ],
          },
          {
            code: 'price',
            title: '价格信息',
            children: [
              { code: 'invPrice', title: '存货价格本', path: '/panelx/list/INV_PRICE', icon: 'PriceTag', panelCode: 'INV_PRICE', operationName: '新增流程' },
            ],
          },
        ],
      },
    ],

  },
]

function walk(node, fn) {
  fn(node)
  if (node.children) node.children.forEach((c) => walk(c, fn))
}

export function flatMenus(tree) {
  const out = []
  walk({ children: tree || menuTree }, (n) => {
    if (n.path) out.push(n)
  })
  return out
}

export function findMenuByPath(path) {
  let hit = null
  walk({ children: menuTree }, (n) => {
    if (n.path === path) hit = n
  })
  return hit
}

export function filterTree(nodes, keyword) {
  const k = keyword.trim()
  if (!k) return nodes
  return nodes
    .map((n) => {
      if (n.children) {
        const children = filterTree(n.children, k)
        return children.length ? { ...n, children } : null
      }
      return n.title.includes(k) ? n : null
    })
    .filter(Boolean)
}

// 角色权限过滤：仅保留 visiblePanels 内的面板叶子；分组节点在子项全不可见时隐藏；admin 返回全量
export function filterMenuTree(tree, visiblePanels, isAdmin) {
  if (isAdmin) return tree
  const vis = Array.isArray(visiblePanels) ? visiblePanels : []
  const filterNode = (nodes) => {
    const out = []
    for (const n of nodes) {
      if (n.panelCode) {
        if (vis.includes(n.panelCode)) out.push({ ...n })
        continue
      }
      if (n.children && n.children.length) {
        const c = filterNode(n.children)
        if (c.length) out.push({ ...n, children: c })
        continue
      }
      if (n.path) out.push({ ...n })
    }
    return out
  }
  return filterNode(tree)
}
