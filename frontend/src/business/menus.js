// YINJIA-MES 菜单:面板以 HSDZ_MES yj_panel 注册表为准
// 模块:智能供应链 / 库存管理 / 生产制造 / 品质管理 / 研发管理 / 系统管理平台(原「基础档案」,2026-10-18 改名)
export const menuTree = [
  {
    code: 'dashboard',
    title: '我的桌面',
    path: '/dashboard',
    icon: 'HomeFilled',
    panelCode: 'DASHBOARD', // 权限化:组织架构「通用·我的桌面」勾可见才显示(admin 恒可见)
  },
  {
    code: 'rd',
    title: '研发管理',
    icon: 'MagicStick',
    // 二级目录按研发流程分三组(2026-09-10 整理):项目管理 → 测试记录 → 产品文件;
    // 叶子项与分组不再混排,面板/权限/数据键均不变,只调整导航层级。
    children: [
      {
        code: 'rdProject', title: '项目管理', icon: 'DocumentAdd', children: [
          { code: 'rdApproval', title: '立项申请', path: '/panelx/list/RD_APPROVAL', icon: 'DocumentAdd', panelCode: 'RD_APPROVAL', operationName: '新增流程' },
          { code: 'rdPlan', title: '项目实施计划', path: '/panelx/list/RD_PLAN', icon: 'Calendar', panelCode: 'RD_PLAN', operationName: '新增流程' },
          { code: 'rdProgress', title: '项目进度查询', path: '/panelx/list/RD_PROGRESS', icon: 'DataLine', panelCode: 'RD_PROGRESS' },
        ],
      },
      {
        code: 'rdTest', title: '测试记录', icon: 'Notebook', children: [
          {
            code: 'rdData', title: '数据记录表', icon: 'Notebook', children: [
              { code: 'rdFilterEff', title: '功能性滤效', path: '/panelx/list/RD_FILTER_EFF', panelCode: 'RD_FILTER_EFF', icon: 'Histogram' },
              { code: 'rdAlkaline', title: '碱性', path: '/panelx/list/RD_ALKALINE', panelCode: 'RD_ALKALINE', icon: 'Coin' },
              { code: 'rdMineral', title: '矿化', path: '/panelx/list/RD_MINERAL', panelCode: 'RD_MINERAL', icon: 'Odometer' },
              { code: 'rdAntibact', title: '抑菌', path: '/panelx/list/RD_ANTIBACT', panelCode: 'RD_ANTIBACT', icon: 'CircleCheck' },
              { code: 'rdScale', title: '阻垢性能', path: '/panelx/list/RD_SCALE', panelCode: 'RD_SCALE', icon: 'Minus' },
              { code: 'rdRoProtect', title: 'RO保护', path: '/panelx/list/RD_RO_PROTECT', panelCode: 'RD_RO_PROTECT', icon: 'Umbrella' },
              { code: 'rdSoak', title: '浸泡安全', path: '/panelx/list/RD_SOAK', panelCode: 'RD_SOAK', icon: 'Coffee' },
              { code: 'rdDropPrec', title: '压降、精度', path: '/panelx/list/RD_DROP_PREC', panelCode: 'RD_DROP_PREC', icon: 'Bottom' },
            ],
          },
          {
            code: 'rdLab', title: '实验室使用记录表', icon: 'Flask', children: [
              { code: 'rdSpikeWater', title: '加标水配置记录表', path: '/panelx/list/RD_SPIKE_WATER', panelCode: 'RD_SPIKE_WATER', icon: 'Coin' },
              // 2026-09-30:「内部委托测试申请单」升级为**一张单三个页签**的「测试申请单」
              //   (页签 = 内部委托-测试申请单 / 销售端-测试/检测申请表 / 委托测试汇总表,
              //    按《3.实验室使用记录表\测试申请单.xlsx》3 个 sheet 复刻);面板编码 RD_DOM_TEST 不变。
              { code: 'rdDomTest', title: '测试申请单', path: '/panelx/list/RD_DOM_TEST', panelCode: 'RD_DOM_TEST', icon: 'DocumentAdd' },
              { code: 'rdEquipUse', title: '设备使用登记表', path: '/panelx/list/RD_EQUIP_USE', panelCode: 'RD_EQUIP_USE', icon: 'Monitor' },
              { code: 'rdInstrUse', title: '仪器使用记录表', path: '/panelx/list/RD_INSTR_USE', panelCode: 'RD_INSTR_USE', icon: 'Odometer' },
            ],
          },
        ],
      },
      {
        code: 'rdFiles', title: '产品文件', icon: 'FolderOpened', children: [
          { code: 'rdProdInfo', title: '产品信息表', path: '/panelx/list/RD_PROD_INFO', panelCode: 'RD_PROD_INFO', icon: 'Tickets' },
          // 成型工艺清单 = 页1 工艺清单 + 页2 成型配方(2026-09-11 起 RD_MOLD_FORMULA 并入其第 2 页签)
          { code: 'rdMoldProc', title: '成型工艺清单', path: '/panelx/list/RD_MOLD_PROC', panelCode: 'RD_MOLD_PROC', icon: 'SetUp' },
          // 2026-09-11 下线(并入 RD_MOLD_PROC 第 2 页签):yj_panel/yj_field/yj_role_panel 行保留,
          // 面板配置与保存链路都还在,需要恢复入口时放开本行即可。
          // { code: 'rdMoldFormula', title: '成型配方', path: '/panelx/list/RD_MOLD_FORMULA', panelCode: 'RD_MOLD_FORMULA', icon: 'Coin' },
          { code: 'rdSpecDoc', title: '规格书', path: '/panelx/list/RD_SPEC_DOC', panelCode: 'RD_SPEC_DOC', icon: 'Document' },
          // 2026-09-11 下线(并入 RD_ASM_PROC 第 2 页签):同上,行保留、配置保留,放开本行即恢复。
          // { code: 'rdAsmBom', title: '组装BOM表', path: '/panelx/list/RD_ASM_BOM', panelCode: 'RD_ASM_BOM', icon: 'Grid' },
          // 组装工艺清单 = 页1 关键工序控制清单 + 页2 组装BOM表(物料清单 + 修订记录)
          { code: 'rdAsmProc', title: '组装工艺清单', path: '/panelx/list/RD_ASM_PROC', panelCode: 'RD_ASM_PROC', icon: 'Operation' },
          { code: 'rdInspPlan', title: '出货检验计划表', path: '/panelx/list/RD_INSP_PLAN', panelCode: 'RD_INSP_PLAN', icon: 'CircleCheck' },
          // 2026-09-18 新增(研发管理 × 产品开发最新设计):
          //   · 产品文件列表 —— 设计《产品开发系统需求汇总》sheet「文件汇总表」;
          //     **只读派生视图**(产品×4文件 开发状态矩阵),数据源与产品信息表侧栏「产品开发」同一份
          //   · 样品编号表(RD_SAMPLE_NO)于 2026-09-30 **下架**:用户口径「样品编号表删掉」。
          //     面板元数据/字段/权限已清(tools/migrate-drop-sample-no-panel-2026-09-30.sql),
          //     rd_sample_no_head / rd_sample_no_detail 两张数据表**保留**留档;
          //     代码里的样品编号唯一性校验与归档登记同批移除。
          //     要恢复:反向重跑该脚本(元数据)+ 放开本行 + 恢复那两处代码。
          { code: 'rdProdDocList', title: '产品文件列表', path: '/panelx/list/RD_PROD_DOCLIST', panelCode: 'RD_PROD_DOCLIST', icon: 'Grid' },
          // 2026-09-21 新增:产品变更申请单(RD_CHANGE,YJ-QR-130《KPC变更申请通知单》)——
          // 产品变更**走单**的载体:发起人建单 → 各受控文件勾选 → 部门按账号填本部门栏 →(需会签时)会签
          // → 冯总(admin)审批 → 生效即按勾选文件建下一版草稿并通知责任人重走受控审核。
          // 归「产品文件」组:它改的就是这四个受控文件,与产品信息表/四文件同一族。
          { code: 'rdChange', title: '产品变更申请单', path: '/panelx/list/RD_CHANGE', panelCode: 'RD_CHANGE', icon: 'Refresh' },
        ],
      },
      {
        // 共享文件(2026-09-17):全公司共享资料库(标准/测试报告/认证报告),专用视图非面板引擎;
        // 权限走 yj_role_panel(全员默认 view 查阅,上传/改/删=组织架构按角色勾 add/edit/delete)
        code: 'rdShare', title: '共享文件', icon: 'Folder', children: [
          { code: 'rdShareFile', title: '共享文件库', path: '/rd/shareFile', panelCode: 'RD_SHARE_FILE', icon: 'Collection' },
        ],
      },
    ],
  },
  {
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
              // 2026-10-08 下架:请购单(PU_REQ)—— 用户口径「请购单不需要」。
              // 面板/字段/授权/译名与 bd_pu_req+bl_pu_req 两张表已整体删除
              // (tools/migrate-drop-extra-docs-pu-req-20261008.sql),不是摘菜单,放开注释也恢复不了;
              // 回退:跑 tools/archive/_panel-age/_backup-20261008/restore-metadata.sql + 重建两张表。
              { code: 'puOrder', title: '采购订单', path: '/panelx/list/PU_ORDER', icon: 'Tickets', panelCode: 'PU_ORDER', operationName: '新增流程' },
              // 特采单(2026-10-19 用户口径「特采单归供应链的采购管理的目录下,不要在品质管理的目录下」):
              // 面板编码 QC_TC_IN / 路径 / 表 / 前缀 TCI / 权限行一个字节没动,只是**导航父节点**从
              // 品质管理 > 来料品质 搬到 智能供应链 > 采购管理 > 单据(业务上它是采购口对不合格来料的让步接收申请)。
              { code: 'qcTcIn', title: '特采单', path: '/panelx/list/QC_TC_IN', icon: 'DocumentAdd', panelCode: 'QC_TC_IN', operationName: '新增流程' },
            ],
          },
          // 2026-10-18 用户口径「为采购订单补齐,采购订单明细表与采购订单统计表」——
          // 照「销售管理」同款三段式(单据 → 明细表 → 统计表)把采购订单补全:
          //   · 明细表 PU_ORDER_DETAIL:头×行逐行展开(v_pu_order_detail);
          //   · 统计表 PU_ORDER_STATS :按 供应商 × 物料 聚合(v_pu_order_stats,「订单数」=不同单据数)。
          // 两者都是 flat 只读报表,不改任何业务表、不动采购订单面板本身
          // (tools/migrate-pu-order-detail-stats-20261018.sql)。
          {
            code: 'detail', title: '明细表', children: [
              { code: 'puDetail', title: '采购订单明细表', path: '/panelx/list/PU_ORDER_DETAIL', panelCode: 'PU_ORDER_DETAIL', icon: 'List' },
            ],
          },
          {
            code: 'stats', title: '统计表', children: [
              { code: 'puStats', title: '采购订单统计表', path: '/panelx/list/PU_ORDER_STATS', panelCode: 'PU_ORDER_STATS', icon: 'Histogram' },
            ],
          },
        ],
      },
    ],
  },
  // 2026-10-18 用户口径:「智能供应链里面的 库存核算/库存明细/库存统计/库存报表,单独提出来
  //   写在一个和智能供应链同一级下的目录(新建为)库存管理」。
  //   ⇒ 四个分组**原样整体搬移**(面板编码、路径、权限行、图标、组内叶子顺序都一个字节没动),
  //     只是在导航树上从「智能供应链」的二级提到了**同级的独立一级目录**。
  //   ⚠ 组 code(invAcct/invDetail/invStats/invReports)与叶子 code 保持原值 —— 页签恢复(stores/tabs)、
  //     左栏展开记忆、`数据字典`/面板权限里按 code 的引用都不受影响;智能供应链随之只剩 销售管理 / 采购管理。
  {
    code: 'inv',
    title: '库存管理',
    icon: 'Box',
    children: [
      {
        code: 'invAcct',
        title: '库存核算',
        icon: 'Box',
        children: [
          {
            code: 'doc', title: '单据', children: [
              // 送料暂收单:面板编码 QC_RECV(2026-09-20 由 SL_RECV 改名,物理表仍 sl_recv/sl_recv_detail,单据前缀 SL)
              { code: 'slRecv', title: '送料暂收单', path: '/panelx/list/QC_RECV', icon: 'Download', panelCode: 'QC_RECV', operationName: '新增流程' },
              { code: 'qcReturn', title: '暂收退料单', path: '/panelx/list/QC_RETURN', icon: 'RefreshLeft', panelCode: 'QC_RETURN', operationName: '新增流程' },
              { code: 'purchaseIn', title: '采购入库单', path: '/panelx/list/PURCHASE_IN', icon: 'Download', panelCode: 'PURCHASE_IN', operationName: '新增流程' },
              { code: 'finishIn', title: '产成品入库单', path: '/panelx/list/FINISH_IN', icon: 'Download', panelCode: 'FINISH_IN', operationName: '新增流程' },
              // 2026-10-14 恢复:其他入库单(OTHER_IN)—— 面板/表/视图按金蝶字段重建 + 接入转ERP
              // (migrate-other-docs-rebuild-20261014.sql);委外入库单(OUTSOURCE_IN)仍保持 2026-10-08 下架状态。
              { code: 'otherIn', title: '其他入库单', path: '/panelx/list/OTHER_IN', icon: 'Download', panelCode: 'OTHER_IN', operationName: '新增' },
              { code: 'saleOut', title: '销售出库单', path: '/panelx/list/SALE_OUT', icon: 'Upload', panelCode: 'SALE_OUT', operationName: '新增流程' },
              { code: 'materialOut', title: '材料出库单', path: '/panelx/list/MATERIAL_OUT', icon: 'Upload', panelCode: 'MATERIAL_OUT', operationName: '新增流程' },
              // 2026-10-14 恢复:其他出库单(OTHER_OUT)—— 同其他入库单;委外发料单(OUTSOURCE_ISSUE)仍保持下架。
              { code: 'otherOut', title: '其他出库单', path: '/panelx/list/OTHER_OUT', icon: 'Upload', panelCode: 'OTHER_OUT', operationName: '新增' },
              // 2026-10-18 新增:调拨单 / 盘点单 —— 库存核算里两张**会改 kucun** 的单据
              // (调拨=仓库间移库双腿过账;盘点=按实盘差异调平)。面板/表/视图见
              // tools/migrate-transfer-stocktake-20261018.sql,记账见 StockLedgerService.applyTransfer/applyStocktake。
              { code: 'transfer', title: '调拨单', path: '/panelx/list/TRANSFER', icon: 'Switch', panelCode: 'TRANSFER', operationName: '新增' },
              { code: 'stocktake', title: '盘点单', path: '/panelx/list/STOCKTAKE', icon: 'DocumentChecked', panelCode: 'STOCKTAKE', operationName: '新增' },
            ],
          },
        ],
      },
      {
        code: 'invDetail',
        title: '库存明细',
        icon: 'List',
        children: [
          { code: 'purchaseInDetail', title: '采购入库单明细表', path: '/panelx/list/PURCHASE_IN_DETAIL', panelCode: 'PURCHASE_IN_DETAIL', icon: 'List' },
          { code: 'finishInDetail', title: '产成品入库单明细表', path: '/panelx/list/FINISH_IN_DETAIL', panelCode: 'FINISH_IN_DETAIL', icon: 'List' },
          // 2026-10-14 恢复:其他入库单/其他出库单 明细表(视图已随 migrate-other-docs-rebuild-20261014.sql 重建)
          { code: 'otherInDetail', title: '其他入库单明细表', path: '/panelx/list/OTHER_IN_DETAIL', panelCode: 'OTHER_IN_DETAIL', icon: 'List' },
          { code: 'otherOutDetail', title: '其他出库单明细表', path: '/panelx/list/OTHER_OUT_DETAIL', panelCode: 'OTHER_OUT_DETAIL', icon: 'List' },
          { code: 'saleOutDetail', title: '销售出库单明细表', path: '/panelx/list/SALE_OUT_DETAIL', panelCode: 'SALE_OUT_DETAIL', icon: 'List' },
          { code: 'materialOutDetail', title: '材料出库单明细表', path: '/panelx/list/MATERIAL_OUT_DETAIL', panelCode: 'MATERIAL_OUT_DETAIL', icon: 'List' },
          // 2026-10-18 新增:调拨单/盘点单明细表(视图 v_transfer_detail / v_stocktake_detail)
          { code: 'transferDetail', title: '调拨单明细表', path: '/panelx/list/TRANSFER_DETAIL', panelCode: 'TRANSFER_DETAIL', icon: 'List' },
          { code: 'stocktakeDetail', title: '盘点单明细表', path: '/panelx/list/STOCKTAKE_DETAIL', panelCode: 'STOCKTAKE_DETAIL', icon: 'List' },
        ],
      },
      {
        code: 'invStats',
        title: '库存统计',
        icon: 'Histogram',
        children: [
          { code: 'purchaseInStats', title: '采购入库单统计表', path: '/panelx/list/PURCHASE_IN_STATS', panelCode: 'PURCHASE_IN_STATS', icon: 'Histogram' },
          { code: 'finishInStats', title: '产成品入库单统计表', path: '/panelx/list/FINISH_IN_STATS', panelCode: 'FINISH_IN_STATS', icon: 'Histogram' },
          // 2026-10-14 恢复:其他入库单/其他出库单 统计表(视图已随 migrate-other-docs-rebuild-20261014.sql 重建)
          { code: 'otherInStats', title: '其他入库单统计表', path: '/panelx/list/OTHER_IN_STATS', panelCode: 'OTHER_IN_STATS', icon: 'Histogram' },
          { code: 'otherOutStats', title: '其他出库单统计表', path: '/panelx/list/OTHER_OUT_STATS', panelCode: 'OTHER_OUT_STATS', icon: 'Histogram' },
          { code: 'saleOutStats', title: '销售出库单统计表', path: '/panelx/list/SALE_OUT_STATS', panelCode: 'SALE_OUT_STATS', icon: 'Histogram' },
          { code: 'materialOutStats', title: '材料出库单统计表', path: '/panelx/list/MATERIAL_OUT_STATS', panelCode: 'MATERIAL_OUT_STATS', icon: 'Histogram' },
          // 2026-10-18 新增:调拨单/盘点单统计表(视图 v_transfer_stats / v_stocktake_stats)
          { code: 'transferStats', title: '调拨单统计表', path: '/panelx/list/TRANSFER_STATS', panelCode: 'TRANSFER_STATS', icon: 'Histogram' },
          { code: 'stocktakeStats', title: '盘点单统计表', path: '/panelx/list/STOCKTAKE_STATS', panelCode: 'STOCKTAKE_STATS', icon: 'Histogram' },
        ],
      },
      {
        // 库存报表(四张核心库存报表集中入口)
        code: 'invReports',
        title: '库存报表',
        icon: 'DataAnalysis',
        children: [
          // 库存状况表:实时聚合 8 类出入库单据行的现存量/结存金额(自库存统计组迁入)
          { code: 'stockBalance', title: '库存状况表', path: '/panelx/list/STOCK_BALANCE', panelCode: 'STOCK_BALANCE', icon: 'DataAnalysis' },
          // 库存台账:8类出入库行级流水+按仓库+存货滚动结存(v_stock_ledger)
          { code: 'stockLedger', title: '库存台账', path: '/panelx/list/STOCK_LEDGER', panelCode: 'STOCK_LEDGER', icon: 'Notebook' },
          // 收发存汇总表:按仓库+存货+期次聚合的期初/本期收入发出/期末(v_stock_summary)
          { code: 'stockSummary', title: '收发存汇总表', path: '/panelx/list/STOCK_SUMMARY', panelCode: 'STOCK_SUMMARY', icon: 'DataAnalysis' },
          // 库存明细(2026-10-15):**直读结存表 kucun**(物料×仓库×批号一行:累计入库量/累计出库量/现存量/结存单价)。
          // 与上面三张的区别:那三张读 v_stock_* 流水视图,2026-10-14 的金蝶期初(2004 行)只写进 kucun 没写流水,
          // 流水口径合计为负 ⇒ 「现在还有多少货」只有这张答得出(见 tools/migrate-stock-detail-panel.sql 头注)。
          { code: 'stockDetail', title: '库存明细', path: '/panelx/list/STOCK_DETAIL', panelCode: 'STOCK_DETAIL', icon: 'List' },
        ],
      },
      {
        // 条码管理(2026-10-18):《【附件一】智慧工厂系统明细清单》WMS 的三条「条码管理」。
        // 形态 = 三个**只读报表面板**(flat,一批一码/批次码),不是扫码作业:
        //   材料仓 ← 采购入库单 头行(材料入库的正式单据)
        //   半成品仓 ← 报工派生(scjl 工序=成型/切炭;**未进库存**,面板列里明写数据来源)
        //   成品仓 ← 产成品入库单 头行
        // 码内容 = 编码|批号。箱码/托盘码/序列号与「扫码出入库过账」属下一阶段(需扫码页 + 端点),
        // 现状与缺口见 docs/design/智慧工厂清单差距分析.md §1.8/1.9/1.10。
        code: 'barcode',
        title: '条码管理',
        icon: 'Grid',
        children: [
          { code: 'barcodeMat', title: '材料仓条码管理', path: '/panelx/list/BARCODE_MAT', panelCode: 'BARCODE_MAT', icon: 'Tickets' },
          { code: 'barcodeWip', title: '半成品仓条码管理', path: '/panelx/list/BARCODE_WIP', panelCode: 'BARCODE_WIP', icon: 'Box' },
          { code: 'barcodeFin', title: '成品仓条码管理', path: '/panelx/list/BARCODE_FIN', panelCode: 'BARCODE_FIN', icon: 'Finished' },
          // 扫码领料(2026-10-18 用户口径:「根据这个规则或设定在条码管理里面通过标签进行操作」):
          // 页面级(无 panelCode),扫标签码 `存货编码|批号` → 按批号查 v_stock_pick 可用量 → 组单。
          // 存在的理由:材料出库单里选商品看的是(物料,仓库)聚合口径,常显示「没有库存」;
          // 仓库实际发料关心的是批号级可用量,而标签里正好带着批号。
          { code: 'barcodeScanPick', title: '扫码领料', path: '/scm/scanPick', icon: 'FullScreen' },
        ],
      },
    ],
  },
  {
    code: 'mfg',
    title: '生产制造',
    icon: 'Odometer',
    // 2026-10-14 两次归一(用户口径「和其他模块的侧边栏不一样,要求相同实现方式」+「明细表和统计表不做大类区分」):
    // ① 原先这里多包了一层空壳二级目录「生产管理」(它自己不含面板,真正的业务域在它下面),
    //    后果:侧栏点开「生产制造」只列出一个二级项「生产管理」,而 智能供应链/品质管理/基础档案
    //    都是一级 → 业务域(二级) → 分类·面板(三级);前端 LeftNav 还为此写了 `m.code === 'mfg'` 特判去"穿"这层。
    // ② 原「明细表」「统计表」是并列的两个二级大类,同样与别的模块不同 —— 别的模块里明细/统计表都挂在
    //    所属业务对象下(如 智能供应链·销售管理:销售订单 → 销售订单明细表 → 销售订单统计表)。
    // 现终态:二级只剩 6 个业务域(生产计划/生产执行/生产记录/设备维护/样品管理/经典单据),
    // 4 张明细/统计面板按业务对象并入 生产计划 / 经典单据;LeftNav 的 mfg 特判已删除,全部模块走同一条通用分支。
    // 2026-10-16 再收敛:样品管理 / 经典单据 两组随其仅有的 5 个叶子一并下架 ⇒ 现为 3 个业务域
    // (生产计划 / 生产过程 / 设备维护),详见下方该两组的摘除注释。
    // 2026-10-18 用户口径「把生产制造模块里面的生产执行和生产记录合并一下改为生产过程」:
    //   原「生产执行」「生产记录」两个二级目录合并为「生产过程」一组(10 张面板入口原样保留,
    //   执行 4 项在前、记录 6 项在后)⇒ 4 个业务域变 3 个。只动菜单分组,面板/路由/权限零改动。
    children: [
      {
        // 生产计划(流程图·生管泳道):销售订单→工单→排产→齐套
        code: 'plan', title: '生产计划', children: [
          // 订单结转·发单工作台(方案 V1.0):待结转行(剩余=需求−已排产−已采购)→转工单/转采购单;
          // 防重复=行级占用链,转满自动消失;不改销售订单状态。置首位:发单是排产的上一步。
          // 2026-10-16 权限化:这四个看板页面此前**没有 panelCode** —— 而 filterMenuTree 对
          // 「无 panelCode 的叶子」一律放行 ⇒ 任何登录账号都能看到并进入。现挂页面级虚拟面板码
          // (定义见后端 PagePanelRegistry;组织架构「角色与面板权限」里按页特性勾动作)。
          { code: 'orderConvert', title: '订单结转', path: '/prod/plan/orderConvert', panelCode: 'ORDER_CONVERT', icon: 'Switch' },
          // 生产工单(2026-09-24 用户拍板改名:原「生产加工单」MANU_ORDER,面板名/菜单位移自此;
          // 流程位置=订单结转之后、排产之前:生单→编制审核→排产工作台排线)。
          // 原生产记录组的「生产加工单」菜单同步下线,单一入口。
          // 列表样式=工单排产·列表(2026-09-24,参考旧系统 ProSchedulingController 报表式:修改/结案/打印工单/打印工单_多个/打印领料单/批量调线+产线筛选+追溯);单据维护从行点修改进表单
          { code: 'manufactureOrder', title: '生产工单', path: '/prod/plan/workOrderList', panelCode: 'WORK_ORDER_LIST', icon: 'Document' },
          // 快速排产(原「排产工作台」,2026-09-26 用户拍板改名):待排产池(已审核·未指派产线)→选产线(带负荷)→单笔/批量排入→撤销回池;
          // 排产单一入口(工单「排产」按钮已下线,表单产线/开工·完工日只读)
          { code: 'scheduleBoard', title: '快速排产', path: '/prod/plan/scheduleBoard', panelCode: 'SCHEDULE_BOARD', icon: 'AlarmClock' },
          // 2026-09-22 单轨改造(参考库式,用户拍板):生产工单/排单计划菜单下线——
          // 工单=生产加工单(MANU_ORDER),看板职责由「生产排产 MANU_SCHEDULE」承接(含五工序完成/未完成数量);
          // 面板与权限行保留可回滚(同 组装BOM表 并页签先例)。恢复:取消下两行注释即可。
          // { code: 'woOrder', title: '生产工单', path: '/panelx/list/WO_ORDER', icon: 'Tickets', panelCode: 'WO_ORDER', operationName: '新增流程' },
          // { code: 'woSchedule', title: '排单计划', path: '/panelx/list/WO_SCHEDULE', panelCode: 'WO_SCHEDULE', icon: 'DataLine' },
          // 2026-09-23 纠偏(用户拍板):「生产排产」平铺看板改为「工单排产」产线骨架视图(参考旧系统工单排产页,
          // 按产线查看正在运行的工单任务);MANU_SCHEDULE 面板/权限行保留可回滚(同 WO_ORDER 先例)。
          // { code: 'manuSchedule', title: '生产排产', path: '/panelx/list/MANU_SCHEDULE', panelCode: 'MANU_SCHEDULE', icon: 'Histogram' },
          { code: 'workOrderBoard', title: '工单排产', path: '/prod/plan/workOrderBoard', panelCode: 'WORK_ORDER_BOARD', icon: 'Histogram' },
          // 工序任务(路线驱动,A 项 2026-10-05)菜单已按用户口径**撤下**(「把工序任务删除掉算了」,
          // 2026-10-05):工单详情只看"走到哪一步"(按报工统计),不再维护工序任务队列。
          // 页面组件/后端接口/表结构按可撤回要求保留但不再挂菜单;要恢复只需把下面一行注释去掉。
          // { code: 'processQueue', title: '工序任务', path: '/prod/plan/processQueue', icon: 'Sort' },
          // 生产线档案在 基础资料→生产(PROD_LINE,2026-09-23 归位);此处负荷看板按 生产线档案日产能 判超载
          { code: 'lineLoad', title: '产线排产负荷', path: '/panelx/list/LINE_LOAD', panelCode: 'LINE_LOAD', icon: 'DataLine' },
          // 2026-10-14 工单齐套表 WO_KIT 菜单下线:唯一数据源 v_wo_kit(基于自建物料的齐套视图)已随
          // MES 自建「物料清单(BOM)」功能整体删除(表 bs_bom / 视图 v_wo_kit / 面板 BOM、WO_KIT 同批下架)。
          // 2026-10-17 生产工单明细表/统计表(MANU_ORDER_DETAIL / MANU_ORDER_STATS)**下架**:
          //   两者是经典遗留那对表的报表面板(v_manu_order_detail / v_manu_order_stats ← bd_manu_order +
          //   bl_manu_order),而那两张表在正式库 **0 行** ⇒ 打开就是空表;真实工单走 plang + 订单结转 +
          //   自建工单列表页。取证:yj_usage_log 全库 7633 行里这两个面板 **一次都没被打开过**、
          //   后端 Java **零引用**、无任何视图/过程依赖这两个视图。
          //   ⇒ 视图 + 面板元数据 + 菜单项整体下架(migrate-drop-manu-order-report-panels-20261017.sql;
          //   底表 bd_manu_order/bl_manu_order **保留** —— MANU_ORDER 面板的处理器仍在用)。
        ],
      },
      {
        // 生产过程(2026-10-18 用户口径「把生产制造模块里面的生产执行和生产记录合并一下改为生产过程」)
        // 合并前是两个并列二级目录:
        //   生产执行(五道工序:领料/报工)= 工序报工单 / 报工记录 / 完工明细 / 生产异常处理单
        //   生产记录(29份真实单据·家族面板)= 生产日报表 / 投料确认单 / 物料混合记录 / 造粒记录 / 无黑处理登记 / 封箱确认
        // 合并只动菜单分组:**10 个面板入口、面板码、路径、顺序一律不变**(执行 4 项在前、记录 6 项在后),
        // 所以路由/权限/面板元数据零改动,可随时按本段注释回滚成两组。
        code: 'prodProcess', title: '生产过程', icon: 'Notebook', children: [
          // ── 原「生产执行」4 项 ──
          { code: 'woReport', title: '工序报工单', path: '/panelx/list/WO_REPORT', icon: 'Promotion', panelCode: 'WO_REPORT', operationName: '新增流程' },
          { code: 'woReportList', title: '报工记录', path: '/panelx/list/WO_REPORT_LIST', panelCode: 'WO_REPORT_LIST', icon: 'List' },
          { code: 'woCompletionList', title: '完工明细', path: '/panelx/list/WO_COMPLETION_LIST', panelCode: 'WO_COMPLETION_LIST', icon: 'List' },
          // 生产异常闭环(生产部纪要 三:异常提出→分析→处理→结案;挂工单号/批次号按批追溯)
          { code: 'prodAbn', title: '生产异常处理单', path: '/panelx/list/PROD_ABN', panelCode: 'PROD_ABN', icon: 'WarningFilled' },
          // ── 原「生产记录」6 项 ──
          { code: 'dayReport', title: '生产日报表', path: '/panelx/list/DAY_REPORT', panelCode: 'DAY_REPORT', operationName: '新增流程' },
          { code: 'feedConfirm', title: '投料确认单', path: '/panelx/list/FEED_CONFIRM', panelCode: 'FEED_CONFIRM', operationName: '新增流程' },
          { code: 'mixRecord', title: '物料混合记录', path: '/panelx/list/MIX_RECORD', panelCode: 'MIX_RECORD', operationName: '新增流程' },
          { code: 'granRecord', title: '造粒记录', path: '/panelx/list/GRAN_RECORD', panelCode: 'GRAN_RECORD', operationName: '新增流程' },
          { code: 'whRecord', title: '无黑处理登记', path: '/panelx/list/WH_RECORD', panelCode: 'WH_RECORD', operationName: '新增流程' },
          { code: 'packConfirm', title: '封箱确认', path: '/panelx/list/PACK_CONFIRM', panelCode: 'PACK_CONFIRM', operationName: '新增流程' },
        ],
      },
      {
        code: 'device', title: '设备维护', children: [
          { code: 'equipCheck', title: '设备点检记录', path: '/panelx/list/EQUIP_CHECK', panelCode: 'EQUIP_CHECK', operationName: '新增流程' },
          { code: 'maintPlan', title: '保养计划', path: '/panelx/list/MAINT_PLAN', panelCode: 'MAINT_PLAN', operationName: '新增流程' },
        ],
      },
      // ══════════ 2026-10-16 下架:「样品管理」「经典单据」两组整体摘除 ══════════
      // 用户口径:「去除当前这两个菜单内的单据」。被摘的 5 个叶子 =
      //   样品管理:样品申请单 SAMPLE_REQ
      //   经典单据:工序派工单 DISPATCH / 委外加工单 OUTSOURCE_ORDER /
      //             工序派工单明细表 DISPATCH_DETAIL / 工序派工单统计表 DISPATCH_STATS
      // 两组各只有这几个叶子,摘完即空壳 —— 空分组违反本文件第 135 行那条测试
      // (二级目录一律是「带面板的分组」),所以连二级目录一起摘。
      //
      // 走的是「轻路线」(先例见 docs/development/面板老化盘点-品质管理与智能供应链.md §5):
      //   yj_panel / yj_field / yj_role_panel 元数据与物理表(sample_req / bd_dispatch /
      //   bl_dispatch / bd_outsource_order / bl_outsource_order / 两张 v_dispatch_* 视图)
      //   **原样保留**,只是不再挂菜单 ⇒ 随时可回滚。
      //   同批数据侧取证(两账套行数 / 操作留痕 / 参照 / DB 依赖)在
      //   tools/archive/_disp-sample-audit/(结论:4 张零数据零留痕,SAMPLE_REQ 只有 1 张
      //   2026-09-22 的草稿测试单 SP-2026-09-0001)。
      // 若要连元数据与物理表一起删(重路线),另立迁移脚本,不靠放开本段注释。
      // 恢复办法:取消下面这两段的注释即可(菜单项、权限行、译名都还在)。
      // {
      //   code: 'sample', title: '样品管理', children: [
      //     { code: 'sampleReq', title: '样品申请单', path: '/panelx/list/SAMPLE_REQ', panelCode: 'SAMPLE_REQ', operationName: '新增流程' },
      //   ],
      // },
      // {
      //   code: 'legacy', title: '经典单据', children: [
      //     // 生产工单已归位「生产计划」组(2026-09-24),此处不再重复入口
      //     { code: 'dispatch', title: '工序派工单', path: '/panelx/list/DISPATCH', icon: 'AlarmClock', panelCode: 'DISPATCH', operationName: '新增流程' },
      //     { code: 'outsourceOrder', title: '委外加工单', path: '/panelx/list/OUTSOURCE_ORDER', icon: 'Tickets', panelCode: 'OUTSOURCE_ORDER', operationName: '新增流程' },
      //     // 2026-10-14 同上:派工单的明细/统计表并回本域,取消二级「明细表/统计表」大类
      //     { code: 'dispatchDetail', title: '工序派工单明细表', path: '/panelx/list/DISPATCH_DETAIL', panelCode: 'DISPATCH_DETAIL', icon: 'List' },
      //     { code: 'dispatchStats', title: '工序派工单统计表', path: '/panelx/list/DISPATCH_STATS', panelCode: 'DISPATCH_STATS', icon: 'Histogram' },
      //   ],
      // },
    ],
  },
  {
    code: 'qc',
    title: '品质管理',
    icon: 'CircleCheck',
    children: [
      {
        // 来料品质(流程图·采购支线:检验;暂收入库单已下线,暂收角色由「库存核算·送料暂收单」承接)
        // 特采单(2026-09-21 建,2026-10-19 迁出):独立面板 QC_TC_IN / 独立表 qc_tc_in / 前缀 TCI,
        // 同一张 YJ-QR-60 表单 —— 用户口径「特采单归供应链的采购管理的目录下,不要在品质管理的目录下」,
        // 菜单已搬到 智能供应链 > 采购管理 > 单据(本组只剩检验与检验要求)。
        // 检验目录(2026-09-22):QC_CATALOG 单单据面板(方式对照 RD_PROGRESS),《品质资料 2026.09.19.xlsx》检验目录页签一比一。
        code: 'incoming', title: '来料品质', children: [
          { code: 'qcInsp', title: '来料检验单', path: '/panelx/list/QC_INSP', icon: 'Search', panelCode: 'QC_INSP', operationName: '新增流程' },
          { code: 'qcCatalog', title: '检验目录', path: '/panelx/list/QC_CATALOG', icon: 'Notebook', panelCode: 'QC_CATALOG' },
          // 检验数据记录(2026-09-22):纸张式检验报告 YJ-QR-96,版式对照《品质资料 2026.09.19.xlsx》「检验数据记录模版」;
          // 检验目录行上的批次号 📄 可按物料批次查阅本面板的报告。
          { code: 'qcInspRec', title: '检验数据记录', path: '/panelx/list/QC_INSP_REC', icon: 'Document', panelCode: 'QC_INSP_REC', operationName: '新增流程' },
          // 来料检验要求(2026-09-22):《品质资料 2026.09.19.xlsx》折叠棉~PP棉 7 张检验要求表,
          // 档案式整表面板(规格书式页签+Excel 复刻表格,非翻页单据),行按物料类别分流 7 页签
          { code: 'qcInspReq', title: '来料检验要求', path: '/panelx/list/QC_INSP_REQ', icon: 'Grid', panelCode: 'QC_INSP_REQ' },
          // 来料检验要求(系列)(2026-10-04 用户口径):表太多不再挤在一个面板 ⇒ 拆出 10 张**全自定义**表
          // (阻垢系列/BK材料系列/除重金属系列/矿化(碱性)系列/抑菌系列/载银系列/炭粉/胶粉/矿化料/原料来料);
          // 与「来料检验要求」同构:每张表各自加自定义列(每表 20 个扩展位)、可带父字段(分组表头)、
          // 检验数据记录按物料编码一起带入(只带子字段)。页签集由 物料类别 词典决定,加页签只改词典。
          { code: 'qcInspReqSeries', title: '来料检验要求(系列)', path: '/panelx/list/QC_INSP_REQ_SERIES', icon: 'Grid', panelCode: 'QC_INSP_REQ_SERIES' },
        ],
      },
      {
        // 制程品质(流程图·品质泳道:工序质检数据)
        // 2026-10-09 下架:「工序质检单 QC_OP / 检验记录单 QC_RECORD」已随那批无用面板整体删除
        // (tools/migrate-drop-qc-unused-panels-20261009.sql),不是摘菜单,放开注释也恢复不了;
        // 🔴 2026-10-16 再下架两张:「成型检验单 QC_MOLD_INSP / 切炭检验单 QC_CUT_INSP」按用户口径
        // (「删除当前成型检验单和切炭检验单,以及成品检验规范」)**连面板元数据与物理表一起删**
        // (tools/migrate-drop-qc-mold-cut-finspec-20261016.sql),放开注释也恢复不了 ——
        // 回退抓手在 tools/archive/_qc-drop3/_backup-20261016-{prod,test}/。
        // 这两类的工序检验职能由「制程检验单 QC_PROC_INSP」(人工开单)与「首件检验单」
        // (报工审核自动出单)承接,故不再各留一张按工序切的检验单。
        code: 'process', title: '制程品质', children: [
          // 首件检验单(2026-10-15 新增,面板 QC_FIRST_INSP):按《生产相关品质检验.xlsx》Sheet1 第2步
          // 「车间生产(首批,每天一个生产批次)→ 首件检验」建,实现方式照成品检验单(QC_ASM_INSP)。
          // 本(工单号,批次号,工单行号)的**第一张报工**审核时自动出一张草稿,检验要求按
          // 《成型工艺清单》RD_MOLD_PROC 的检验要求区块预铺。置首位 = 流程上最早的一道检验。
          { code: 'qcFirstInsp', title: '首件检验单', path: '/panelx/list/QC_FIRST_INSP', icon: 'DocumentChecked', panelCode: 'QC_FIRST_INSP', operationName: '新增流程' },
          // 制程检验单(2026-10-12 新增,面板 QC_PROC_INSP):按《生产相关品质检验.xlsx》第3步建。
          // 表样=截图「制程检验」页签:外观/尺寸/出货重量 三组 + 出货检验功能性测试组(用「表区」区分)。
          // 检验类别字段区分「首件检验(第2步)」与「制程检验(第3步)」。
          { code: 'qcProcInsp', title: '制程检验单', path: '/panelx/list/QC_PROC_INSP', icon: 'Checked', panelCode: 'QC_PROC_INSP', operationName: '新增流程' },
          // 组装成品检验单(9.29 批次④,2026-10-05):**组装**报工审核自动出单;含合格转库存/不合格待处理
          { code: 'qcAsmInsp', title: '组装成品检验单', path: '/panelx/list/QC_ASM_INSP', icon: 'Finished', panelCode: 'QC_ASM_INSP', operationName: '新增流程' },
        ],
      },
      // 2026-10-09 下架:「不良处理」整组(不良品处理单 QC_DISPOSAL / 炭棒不良退货登记 ROD_RETURN)、
      // 「品质追溯」组(批号追溯 LOT_TRACE)—— 用户口径「都是没有用到的吧」,
      // 实测:yj_usage_log 操作留痕 0、7 张业务表 0 行、单据状态 0 行 ⇒ 建好之后一张单都没录过。
      // 面板/字段/授权/视图 v_lot_trace/7 张物理表 已整体删除
      // (tools/migrate-drop-qc-unused-panels-20261009.sql),不是摘菜单,放开注释也恢复不了;
      // 回退:跑 tools/archive/_panel-age/_backup-20261009-qc/restore-metadata.sql + 重建 7 张表与 v_lot_trace。
      {
        // 质量单据(YJ-QR 体系;2026-09-22 起为七表 —— 特采申请单已整体下线)
        // 2026-09-22 下线:特采申请单(QC_TC)—— 与「来料品质·特采单」QC_TC_IN 同表同版式、重复,
        // 按用户口径删的就是这一个。注意:面板与业务表 qc_tc 已整体删除(tools/migrate-qc-tc-drop.sql),
        // 不是仅摘菜单,放开注释也恢复不了;特采单入口在 品质管理 > 来料品质 > 特采单。
        code: 'qcDoc', title: '质量单据', icon: 'DocumentChecked', children: [
          // 🔴 2026-10-16 下架「成品检验规范 QC_FIN_SPEC」:用户口径「删除当前成型检验单和切炭检验单,
          // 以及成品检验规范」。面板 + qc_fin_spec_head/_detail + 译名 + 报工审核自动出单钩子
          // (ButtonService.finSpecGenerate)已整体删除(tools/migrate-drop-qc-mold-cut-finspec-20261016.sql),
          // 放开注释也恢复不了;回退抓手 tools/archive/_qc-drop3/_backup-20261016-{prod,test}/。
          // 成品检验的纸面能力由「组装成品检验单 QC_ASM_INSP」承接(报表 qc_asm_insp.jrxml)。
          { code: 'qcNcrp', title: '不合格报告(制程)', path: '/panelx/list/QC_BHG', icon: 'CircleClose', panelCode: 'QC_BHG', operationName: '新增流程' },
          { code: 'qcNcdp', title: '不合格品处理单(制程)', path: '/panelx/list/QC_BHC', icon: 'Box', panelCode: 'QC_BHC', operationName: '新增流程' },
          { code: 'qcNcdz', title: '不合格品处理单(自制物料)', path: '/panelx/list/QC_BHZ', icon: 'Files', panelCode: 'QC_BHZ', operationName: '新增流程' },
          { code: 'qcJjf', title: '紧急放行申请单', path: '/panelx/list/QC_JJF', icon: 'AlarmClock', panelCode: 'QC_JJF', operationName: '新增流程' },
          { code: 'qcScp', title: '试产材料使用申请单', path: '/panelx/list/QC_SCP', icon: 'DocumentChecked', panelCode: 'QC_SCP', operationName: '新增流程' },
          { code: 'qcLyb', title: '来料异常分析报告', path: '/panelx/list/QC_LYB', icon: 'DataAnalysis', panelCode: 'QC_LYB', operationName: '新增流程' },
          { code: 'qcScy', title: '生产异常分析报告', path: '/panelx/list/QC_SCY', icon: 'TrendCharts', panelCode: 'QC_SCY', operationName: '新增流程' },
        ],
      },
    ],
  },
  // 2026-10-18 用户口径:「写一个数据建模目录」——其下依次放 字段管理 / 数据字典。
  //   · 字段管理(FIELDMGR):直接以 yj_field 元数据表为数据源的新面板 —— 全系统字段模型在一屏可见、
  //     可按面板筛、可就地改(顺序/列宽/必填/隐藏/字典SQL…),保存走通用档案保存的「只提交改动行」;
  //   · 数据字典(ZDGL):原在 系统管理平台·基础数据,按用户口径「还有写个数据字典」随本栏目一并摆到这里
  //     (面板/表/权限行一个字节没动,只换导航位置);
  //   · ERP导入日志(ERPLG)已于 2026-10-18 再次迁出:随用户口径移到新的一级目录「ERP系统集成」
  //     (yj_panel.category/module_group 同批改为「ERP系统集成」,见 tools/migrate-erp-integ-config-20261018.sql)。
  {
    code: 'dm',
    title: '数据建模',
    icon: 'SetUp',
    children: [
      {
        code: 'dmFields',
        title: '字段管理',
        icon: 'Grid',
        children: [
          { code: 'fieldMgr', title: '字段管理', path: '/panelx/list/FIELDMGR', icon: 'Grid', panelCode: 'FIELDMGR', operationName: '新增流程' },
        ],
      },
      {
        code: 'dmDict',
        title: '数据字典',
        icon: 'Collection',
        children: [
          { code: 'zdgl', title: '数据字典', path: '/panelx/list/ZDGL', icon: 'Collection', panelCode: 'ZDGL', operationName: '新增流程' },
        ],
      },
      // 2026-10-18 用户口径「把现在系统管理平台里面的面板全部挪到数据建模」:原「系统管理平台」的
      //   基础数据 / 物料及价格 / 生产 / 财务 四组(32 张面板)**整组搬到这里**,分组 code 不变
      //   (yj_panel.module_group 同批改为「数据建模」⇒ 权限矩阵里这 32 张也归到本模块组)。
      {
        code: 'bdata',
        title: '基础数据',
        icon: 'Collection',
        children: [
          { code: 'dept', title: '部门', path: '/panelx/list/DEPT', icon: 'OfficeBuilding', panelCode: 'DEPT', operationName: '新增流程' },
          { code: 'employee', title: '职员', path: '/panelx/list/EMP', icon: 'User', panelCode: 'EMP', operationName: '新增流程' },
          // 2026-10-18 迁出:「数据字典 ZDGL」「ERP导入日志 ERPLG」按用户口径移到一级目录「数据建模」
          //   (面板/表/权限行都不动,只换导航位置与 yj_panel.category)。
          { code: 'warehouse', title: '仓库', path: '/panelx/list/WH', icon: 'House', panelCode: 'WH', operationName: '新增流程' },
          // 仓位(2026-09-28 建为「库位」,2026-10-08 正名「仓位」对齐金蝶):仓库下货位档案,一仓多仓位、一仓位一仓;
          // 支持与商品同款「二维码标签」勾选即打
          { code: 'whloc', title: '仓位', path: '/panelx/list/WHLOC', icon: 'LocationInformation', panelCode: 'WHLOC', operationName: '新增流程' },
          { code: 'khda', title: '客户', path: '/panelx/list/KHDA', icon: 'User', panelCode: 'KHDA', operationName: '新增流程' },
          { code: 'gfda', title: '供应商', path: '/panelx/list/GFDA', icon: 'OfficeBuilding', panelCode: 'GFDA', operationName: '新增流程' },
          // 客户/供应商分类不占导航:从 客户/供应商 面板工具栏「分类管理」进入(金蝶同款交互)
          // 2026-09-17 下线:库存状况(STOCK_STATUS,旧kucun台账面板,报表口径由「库存管理·库存报表」承接)、
          // 往来单位(PARTNER,客户/供应商已独立档案)——菜单移除,面板配置保留(放开本注释即恢复)
          // { code: 'stockStatus', title: '库存状况', path: '/panelx/list/STOCK_STATUS', icon: 'Histogram', panelCode: 'STOCK_STATUS' },
          // { code: 'partner', title: '往来单位', path: '/panelx/list/PARTNER', icon: 'OfficeBuilding', panelCode: 'PARTNER', operationName: '新增流程' },
          { code: 'region', title: '地区', path: '/panelx/list/REGION', icon: 'Location', panelCode: 'REGION', operationName: '新增流程' },
          { code: 'proj', title: '项目', path: '/panelx/list/PROJ', icon: 'Flag', panelCode: 'PROJ', operationName: '新增流程' },
        ],
      },
      {
        code: 'bmat',
        title: '物料及价格',
        icon: 'Box',
        children: [
          { code: 'uom', title: '计量单位', path: '/panelx/list/UOM', icon: 'ScaleToOriginal', panelCode: 'UOM', operationName: '新增流程' },
          // 商品分类不占导航:从 商品 面板工具栏「分类管理」进入(与 客户/供应商 同款交互)
          { code: 'inventory', title: '商品', path: '/panelx/list/INV', icon: 'Grid', panelCode: 'INV', operationName: '新增流程' },
          // 2026-10-14 物料清单(BOM)菜单下线:MES 自建 BOM 功能整体删除
          // (表 bs_bom / 面板 BOM 及其正反向查询 BOM_FWD、BOM_REV 同批下架)。
          // ⚠ 2026-10-15 补回「物料清单」入口 —— 但**指向 WLBOM(mate 表),不是当年下架的 BOM(bs_bom)**:
          //   规格书「1.关键物料列表」引用的那份物料数据就是 WLBOM(面板与表都还在,yj_panel 里仍有登记),
          //   当年下线的只是另一套自建 BOM;用户报障「物料清单面板入口没有在基础档案里面」即指此。
          //   位置按 README §基础档案 的登记顺序:计量单位 / 商品 / 物料清单 / 存货价格本。
          { code: 'wlbom', title: '物料清单', path: '/panelx/list/WLBOM', icon: 'Files', panelCode: 'WLBOM', operationName: '新增流程' },
          { code: 'invPrice', title: '存货价格本', path: '/panelx/list/INV_PRICE', icon: 'PriceTag', panelCode: 'INV_PRICE', operationName: '新增流程' },
        ],
      },
      {
        code: 'bprod',
        title: '生产',
        icon: 'Cpu',
        children: [
          { code: 'equip', title: '设备', path: '/panelx/list/EQUIP', icon: 'Cpu', panelCode: 'EQUIP', operationName: '新增流程' },
          { code: 'team', title: '班组', path: '/panelx/list/TEAM', icon: 'UserFilled', panelCode: 'TEAM', operationName: '新增流程' },
          { code: 'wc', title: '工作中心', path: '/panelx/list/WC', icon: 'Odometer', panelCode: 'WC', operationName: '新增流程' },
          // 生产线档案(2026-09-23 归位基础资料):排产指派对象,日产能=负荷/超载基准;原「产线产能」(生产计划组)收编下线
          { code: 'prodLine', title: '生产线', path: '/panelx/list/PROD_LINE', icon: 'DCaret', panelCode: 'PROD_LINE', operationName: '新增流程' },
          { code: 'process', title: '工序', path: '/panelx/list/OP', icon: 'SetUp', panelCode: 'OP', operationName: '新增流程' },
          { code: 'routing', title: '工艺路线', path: '/panelx/list/ROUTE', icon: 'Guide', panelCode: 'ROUTE', operationName: '新增流程' },
          // 工序工时:参考库 gxgs——按 客户×物料×工序 维护 换线/标准·最快·最慢·平均时间与加工单价(排产产能/计件依据)
          { code: 'opTime', title: '工序工时', path: '/panelx/list/OP_TIME', icon: 'Timer', panelCode: 'OP_TIME', operationName: '新增流程' },
          { code: 'reject', title: '不合格原因', path: '/panelx/list/REJECT', icon: 'CircleClose', panelCode: 'REJECT', operationName: '新增流程' },
          // 2026-10-09 摘除「检验项目 QC_ITEM」「检验方案 QC_PLAN」两个菜单入口(用户口径:维护入口收敛到
          // 检验单工具栏那一个按钮,弹窗两用=勾选带入 + 就地维护)。⚠ 只摘菜单:**面板与数据表保留不动**
          // (bs_qc_plan/bs_qc_item 仍被维护弹窗读写,面板元数据留作历史/备份),放开注释即可恢复入口。
        ],
      },
      {
        code: 'bfin',
        title: '财务',
        icon: 'Money',
        children: [
          { code: 'finTax', title: '税别资料', path: '/panelx/list/FIN_TAX', icon: 'Ticket', panelCode: 'FIN_TAX', operationName: '新增流程' },
          { code: 'settle', title: '结算方式', path: '/panelx/list/SETTLE', icon: 'Tickets', panelCode: 'SETTLE', operationName: '新增流程' },
          { code: 'cur', title: '币别', path: '/panelx/list/CUR', icon: 'Money', panelCode: 'CUR', operationName: '新增流程' },
          { code: 'finExp', title: '费用类别', path: '/panelx/list/FIN_EXP', icon: 'Wallet', panelCode: 'FIN_EXP', operationName: '新增流程' },
          { code: 'finAcc', title: '会计科目', path: '/panelx/list/FIN_ACC', icon: 'Notebook', panelCode: 'FIN_ACC', operationName: '新增流程' },
        ],
      },
    ],
  },
  // 2026-10-18 用户口径:「在系统左侧菜单写一个 erp 系统集成的目录,目录下把 erp 导入日志移动到他下方。
  //   再写一个 erp 集成配置清单,分为导入与转出两种面板,每个面板再分类,把 api 接口、对应的设备、
  //   字段间的映射,做成一个可视化、可以统一配置编辑的面板。」
  //   · ERP集成配置清单 = 页面级虚拟面板 ERP_INTEG(自定义视图 views/erp/ErpIntegConfig.vue,
  //     数据源 erp_integ_api/_field/_device 三张配置表;不插 yj_panel 行,授权落 yj_role_panel);
  //   · ERP导入日志 = 原「数据建模 / ERP集成」下的 ERPLG(批次级),行级明细 ERPLG_ROW 从批次行进入。
  {
    code: 'erpInteg',
    title: 'ERP系统集成',
    icon: 'Connection',
    children: [
      // 二级必须是「带面板的分组」(导航层级同构:不出现裸叶子,见 menus.test.js)
      {
        code: 'erpManage',
        title: '集成管理',
        icon: 'SetUp',
        children: [
          { code: 'erpIntegCfg', title: 'ERP集成配置清单', path: '/erp/integConfig', icon: 'SetUp', panelCode: 'ERP_INTEG' },
          { code: 'erpImpLog', title: 'ERP导入日志', path: '/panelx/list/ERPLG', icon: 'Download', panelCode: 'ERPLG' },
        ],
      },
    ],
  },
  // 2026-10-18 新增「数采平台」:面向后续硬件(电子秤已确定,先补看板/扫码枪等)接入的配置与监控入口。
  //   三个页面都是**页面级叶子**(不是 yj_panel 面板 ⇒ 无 panelCode/operationName),
  //   路由在 router/index.js 显式注册,并已从 flatMenus 自动路由里排除;菜单侧不参与面板权限过滤。
  {
    code: 'dc',
    title: '数采平台',
    icon: 'Cpu',
    children: [
      { code: 'dcConfig', title: '设备配置管理', path: '/dc/config', icon: 'SetUp' },
      { code: 'dcMonitor', title: '数据监控', path: '/dc/monitor', icon: 'Monitor' },
      { code: 'dcStats', title: '状态统计', path: '/dc/stats', icon: 'DataAnalysis' },
    ],
  },
  // 2026-10-15 用户要求「把侧边栏的财务管理与设备管理删掉」——
  //   这两栏从建起来就是**空的占位分组**(children: []),里面没有任何菜单项,
  //   侧边栏却会渲染出两个点不开的空分类,徒增噪音。删除不影响任何面板入口
  //   (财务类面板本就走「系统管理平台 → 财务」栏,设备类走「生产」栏的 设备/设备维护)。
  // 2026-10-18 用户口径:「将基础档案改名为系统管理平台」。
  //   **只改显示标题**,一级目录 code 仍为 'base'(路由/展开态/页签/权限都不按标题走)。
  //   同日第二轮:原二级分组(基础数据/物料及价格/生产/财务)共 32 张面板整组移到「数据建模」,
  //   本目录只剩「系统功能」一组入口 —— 详见下方 sysFunc 注释。
  {
    code: 'base',
    title: '系统管理平台',
    icon: 'Setting',
    children: [
      {
        // 2026-10-18 用户口径:「把现在系统管理平台里面的面板全部挪到数据建模,然后把这个做成入口写到系统管理平台里面」
        //   ⇒ 原四组(基础数据/物料及价格/生产/财务)共 32 张面板**整组**移到一级目录「数据建模」
        //   (menus.js dm 末尾,分组 code 与原题目一个没改;yj_panel.module_group 同批改为「数据建模」,
        //   见 tools/migrate-sysadmin-panels-to-dm-20261018.sql)。
        //   本目录不再挂任何业务面板,只做**系统功能入口**(顶栏用户下拉里那几个系统功能都收在这一页);
        //   组织架构/使用权限查看 = 管理员专属(adminOnly ⇒ filterMenuTree 只对 isAdmin 放行,
        //   路由侧 meta.requireAdmin 双保险)。
        code: 'sysFunc',
        title: '系统功能',
        icon: 'Monitor',
        children: [
          { code: 'sysConsole', title: '系统管理', path: '/sys/console', icon: 'Monitor' },
          { code: 'sysOrg', title: '组织架构', path: '/sys/org', icon: 'OfficeBuilding', adminOnly: true },
          { code: 'sysUsage', title: '使用权限查看', path: '/sys/usage', icon: 'View', adminOnly: true },
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
      // adminOnly:整枝只对管理员可见(如「系统功能 → 组织架构 / 使用权限查看」)。
      //   这类叶子没有 panelCode 却带 path,原来会在下面那条 if (n.path) 里被判成有权而放行。
      if (n.adminOnly) continue
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
