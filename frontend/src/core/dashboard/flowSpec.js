/**
 * flowSpec.js —— 「流程管控」看板的**声明式链路规格**(2026-10-16)
 *
 * 用户口径:「我的桌面缺失对生产过程和库存的一个流程管理视图,可以根据图片以及下面文字设计一个
 * 对生产过程和库存的流程管控」+ 两张链路的逐步说明(生产:销售订单→订单结转→生产工单→排产→
 * 领料→产线→报工→续序/完工→检验→产成品入库;库存:采购订单→暂收单→(来料检验?)→来料检验单→
 * 检验数据记录+检验目录→合格→采购入库 / 不合格→退货单(特采)→特采单(二级审批)→采购入库;
 * 库存报表是查询表;出库有预警,低于预警无法审核)。
 *
 * ⚠ 2026-10-18 口径调整(用户:「先要完成排产才进入到领料,同时需要让当前的一个生产工单
 *   可以对应多个领料单据」):生产链**第二条泳道**由「领料与排产」改为「**排产与领料**」——
 *   快速排产 → 工单排产/预排线 → 产线排产负荷 → **材料出库单**;
 *   排产入线(scx 非空)+ 排产数量>0 才放行转领料,且一张工单行可开多张(见 WorkOrderPickingService)。
 *
 * 本文件只放**数据**:节点放第几条泳道、主数字读哪个口径、什么条件算积压/阻断、点了跳哪。
 * 图形与取数全部由此驱动 ——
 *   - 口径真源在服务端 `FlowBoardService`(复用 OrderConvertService/ScheduleBoardService,
 *     不另写一套待结转/待排产 SQL),前端只用 `ref` 点路径取值;
 *   - 因此这里可以直接单测(`flowSpec.test.js`),加节点=加一条声明,不用改渲染组件。
 *
 * ⚠ 口径提醒(写进卡片副文案,避免"看板数字对不上业务")：
 *   - 生产工单数据源是**参考库 plang 单轨**(转工单直落 plang);
 *   - 工序报工单的表是 scjl,单据号取「报工单号」;
 *   - 库存报表 5 张是 flat 直读视图,只有行数,没有单据状态。
 */

/** 一级链路:生产(4 段泳道) / 库存(4 段泳道) */
const text = (v) => (v == null || v === '' ? '—' : String(v))

export const CHAINS = [
  {
    key: 'prod',
    name: '生产过程',
    tone: 'prod',
    intro: '销售订单 → 结转 → 工单 → 排产 → 领料 → 报工续序 → 检验 → 产成品入库',
    lanes: [
      {
        key: 'plan', name: '生管泳道 · 接单与计划', hint: '订单进来后先结转成工单,才谈得上排产',
        nodes: [
          {
            key: 'so', name: '销售订单', code: 'SO_ORDER', route: '/panelx/list/SO_ORDER',
            main: { label: '订单数', ref: 'nodes.SO_ORDER.docs' },
            subs: [
              { label: '待结转行', ref: 'special.convert.pendingRows' },
              { label: '待审批', ref: 'nodes.SO_ORDER.pending' },
            ],
            warn: ['special.convert.pendingRows'],
            note: 'ERP 自动导入;订单行剩余 = 需求 − 已排产 − 已采购',
          },
          {
            key: 'convert', name: '订单结转', code: 'ORDER_CONVERT', route: '/prod/plan/orderConvert',
            main: { label: '待结转行', ref: 'special.convert.pendingRows' },
            subs: [
              { label: '款数', ref: 'special.convert.styles' },
              { label: '下单数量', ref: 'special.convert.qty' },
              { label: '最新下单', text: (d) => text(d?.special?.convert?.latest) },
            ],
            warn: ['special.convert.pendingRows'],
            note: '选中工艺路线才能转成生产工单;行级占用链防重复转单',
          },
          {
            key: 'workorder', name: '生产工单', code: 'WORK_ORDER_LIST', route: '/prod/plan/workOrderList',
            main: { label: '未排产', ref: 'special.workorder.unassigned' },
            subs: [
              { label: '已排产', ref: 'special.workorder.assigned' },
              { label: '已完工', ref: 'special.workorder.done' },
              { label: '排产数量', ref: 'special.workorder.qty' },
            ],
            warn: ['special.workorder.unassigned'],
            note: '转工单直落参考库 plang,无需审核即入待排产池',
          },
        ],
      },
      {
        key: 'release', name: '排产与领料', hint: '先排产(选产线入线)→ 再领料:排产完成才放行转领料,一张工单可开多张领料单',
        nodes: [
          {
            key: 'schedule', name: '快速排产', code: 'SCHEDULE_BOARD', route: '/prod/plan/scheduleBoard',
            main: { label: '待排产笔数', ref: 'special.schedule.pool' },
            subs: [
              { label: '今日排产(张)', ref: 'special.schedule.todayCnt' },
              { label: '今日排产(量)', ref: 'special.schedule.todayQty' },
              { label: '在产线', ref: 'special.schedule.lines' },
            ],
            warn: ['special.schedule.pool'],
            note: '池 = 产线库空且未结案的工单行;选产线(带负荷)→ 单笔/批量排入;排产入线是领料的前置条件',
          },
          {
            key: 'board', name: '工单排产 / 预排线', code: 'WORK_ORDER_BOARD', route: '/prod/plan/workOrderBoard',
            main: { label: '在制未完成量', ref: 'special.schedule.wipQty' },
            subs: [
              { label: '产线数', ref: 'special.schedule.lines' },
              { label: '已排产行', ref: 'special.workorder.assigned' },
            ],
            note: '选择工序 → 预排线(工序·工序序·计划产线·计划数量)',
          },
          {
            key: 'lineload', name: '产线排产负荷', code: 'LINE_LOAD', route: '/panelx/list/LINE_LOAD',
            main: { label: '负荷行数', ref: 'nodes.LINE_LOAD.rows' },
            subs: [{ label: '产线数', ref: 'special.schedule.lines' }],
            note: '按开工日→交期把在制量均摊到每天,看哪条线压着活',
          },
          {
            key: 'matout', name: '材料出库单', code: 'MATERIAL_OUT', route: '/panelx/list/MATERIAL_OUT',
            main: { label: '单据数', ref: 'nodes.MATERIAL_OUT.docs' },
            subs: [
              { label: '草稿', ref: 'nodes.MATERIAL_OUT.draft' },
              { label: '待审批', ref: 'nodes.MATERIAL_OUT.pending' },
            ],
            warn: ['nodes.MATERIAL_OUT.draft'],
            note: '排产入线后才放行「转领料单」;一张工单行可开多张,只写单头,明细由仓库补填',
          },
        ],
      },
      {
        key: 'exec', name: '生产执行(五道工序:领料 · 报工)', hint: '报工达标才切下一道预排线,全部达标才完工',
        nodes: [
          {
            key: 'woreport', name: '工序报工单', code: 'WO_REPORT', route: '/panelx/list/WO_REPORT',
            main: { label: '报工单', ref: 'nodes.WO_REPORT.docs' },
            subs: [
              { label: '待审核', ref: 'nodes.WO_REPORT.pending' },
              { label: '报工行', ref: 'nodes.WO_REPORT.rows' },
            ],
            block: ['nodes.WO_REPORT.pending'],
            note: '扫码领料 → 报工 → 审核通过;不过审不进下一道',
          },
          {
            key: 'completion', name: '完工明细', code: 'WO_COMPLETION_LIST', route: '/panelx/list/WO_COMPLETION_LIST',
            main: { label: '完工行', ref: 'nodes.WO_COMPLETION_LIST.rows' },
            note: '排线跑完(路线各道均达标)即完工',
          },
          {
            key: 'reportlist', name: '报工记录', code: 'WO_REPORT_LIST', route: '/panelx/list/WO_REPORT_LIST',
            main: { label: '记录行', ref: 'nodes.WO_REPORT_LIST.rows' },
            note: '续序轨迹:第一道未达标 = 当前该做的道',
          },
        ],
      },
      {
        key: 'qcput', name: '品质与入库', hint: '检验合格数量 → 产成品入库单 → 仓库审核记账',
        nodes: [
          {
            key: 'firstinsp', name: '首件检验单', code: 'QC_FIRST_INSP', route: '/panelx/list/QC_FIRST_INSP',
            main: { label: '单据数', ref: 'nodes.QC_FIRST_INSP.docs' },
            subs: [
              { label: '待审核', ref: 'nodes.QC_FIRST_INSP.pending' },
              { label: '草稿', ref: 'nodes.QC_FIRST_INSP.draft' },
            ],
            block: ['nodes.QC_FIRST_INSP.pending'],
            note: '本批第一张报工审核后自动出草稿',
          },
          {
            key: 'procinsp', name: '制程检验单(成型产出)', code: 'QC_PROC_INSP', route: '/panelx/list/QC_PROC_INSP',
            main: { label: '单据数', ref: 'nodes.QC_PROC_INSP.docs' },
            subs: [
              { label: '合格数量', ref: 'nodes.QC_PROC_INSP.okQty' },
              { label: '不合格数量', ref: 'nodes.QC_PROC_INSP.ngQty' },
              { label: '待审核', ref: 'nodes.QC_PROC_INSP.pending' },
            ],
            block: ['nodes.QC_PROC_INSP.pending'],
            warn: ['nodes.QC_PROC_INSP.ngQty'],
            note: '成型工序产出检验数据:人工开单填写',
          },
          {
            key: 'asminsp', name: '组装成品检验单', code: 'QC_ASM_INSP', route: '/panelx/list/QC_ASM_INSP',
            main: { label: '单据数', ref: 'nodes.QC_ASM_INSP.docs' },
            subs: [
              { label: '合格数量', ref: 'nodes.QC_ASM_INSP.okQty' },
              { label: '不合格数量', ref: 'nodes.QC_ASM_INSP.ngQty' },
              { label: '待审核', ref: 'nodes.QC_ASM_INSP.pending' },
            ],
            block: ['nodes.QC_ASM_INSP.pending'],
            warn: ['nodes.QC_ASM_INSP.ngQty'],
            note: '组装报工审核自动生成;表头「合格数量」必填',
          },
          {
            key: 'ngtreat', name: '不合格品处理单(制程)', code: 'QC_BHC', route: '/panelx/list/QC_BHC',
            main: { label: '待处理草稿', ref: 'nodes.QC_BHC.draft' },
            subs: [{ label: '单据数', ref: 'nodes.QC_BHC.docs' }],
            warn: ['nodes.QC_BHC.draft'],
            note: '检验不合格的数量转不良品处理单草稿',
          },
          {
            key: 'finishin', name: '产成品入库单', code: 'FINISH_IN', route: '/panelx/list/FINISH_IN',
            main: { label: '单据数', ref: 'nodes.FINISH_IN.docs' },
            subs: [
              { label: '待审核', ref: 'nodes.FINISH_IN.draft' },
              { label: '已审核', ref: 'nodes.FINISH_IN.audited' },
            ],
            warn: ['nodes.FINISH_IN.draft'],
            note: '审核通过按表头「合格数量」生成草稿;仓库审核后记库存流水并回写工单',
          },
        ],
      },
    ],
  },
  {
    key: 'stock',
    name: '库存流转',
    tone: 'stock',
    intro: '采购订单 → 暂收单 →(来料检验?)→ 检验/退货/特采 → 采购入库 → 转 ERP',
    lanes: [
      {
        key: 'in', name: '采购与收料', hint: '暂收单按商品的「来料检验」字段决定走不走检验',
        nodes: [
          {
            key: 'puorder', name: '采购订单', code: 'PU_ORDER', route: '/panelx/list/PU_ORDER',
            main: { label: '单据数', ref: 'nodes.PU_ORDER.docs' },
            subs: [
              { label: '待审批', ref: 'nodes.PU_ORDER.pending' },
              { label: '草稿', ref: 'nodes.PU_ORDER.draft' },
            ],
            block: ['nodes.PU_ORDER.pending'],
            note: '采购订单生单 → 送料暂收单',
          },
          {
            key: 'recv', name: '送料暂收单', code: 'QC_RECV', route: '/panelx/list/QC_RECV',
            main: { label: '单据数', ref: 'nodes.QC_RECV.docs' },
            subs: [
              { label: '草稿', ref: 'nodes.QC_RECV.draft' },
              { label: '待审核', ref: 'nodes.QC_RECV.pending' },
            ],
            warn: ['nodes.QC_RECV.draft'],
            note: '商品档案「来料检验 = 是」→ 走来料检验;= 否 → 直接采购入库',
          },
        ],
      },
      {
        key: 'qc', name: '检验与判定', hint: '来料检验单审核后按合格数量 / 不合格数量分流',
        nodes: [
          {
            key: 'qcinsp', name: '来料检验单', code: 'QC_INSP', route: '/panelx/list/QC_INSP',
            main: { label: '单据数', ref: 'nodes.QC_INSP.docs' },
            subs: [
              { label: '合格数量', ref: 'nodes.QC_INSP.okQty' },
              { label: '不合格数量', ref: 'nodes.QC_INSP.ngQty' },
              { label: '待审核', ref: 'nodes.QC_INSP.pending' },
            ],
            block: ['nodes.QC_INSP.pending'],
            warn: ['nodes.QC_INSP.ngQty'],
            note: '合格 → 采购入库单;不合格 → 退货单(特采=是,审批)',
          },
          {
            key: 'qcrec', name: '检验数据记录', code: 'QC_INSP_REC', route: '/panelx/list/QC_INSP_REC',
            main: { label: '记录单', ref: 'nodes.QC_INSP_REC.docs' },
            note: '检验单每条明细对应一张数据记录',
          },
          {
            key: 'qccat', name: '检验目录', code: 'QC_CATALOG', route: '/panelx/list/QC_CATALOG',
            main: { label: '目录单', ref: 'nodes.QC_CATALOG.docs' },
            note: '检验项目/方案的占位台账,按目录取检验项',
          },
        ],
      },
      {
        key: 'put', name: '入库 / 退货 / 特采', hint: '特采必须二级审批通过才放行进采购入库',
        nodes: [
          {
            key: 'purchasein', name: '采购入库单', code: 'PURCHASE_IN', route: '/panelx/list/PURCHASE_IN',
            main: { label: '单据数', ref: 'nodes.PURCHASE_IN.docs' },
            subs: [
              { label: '待审核', ref: 'nodes.PURCHASE_IN.draft' },
              { label: '已审核', ref: 'nodes.PURCHASE_IN.audited' },
            ],
            warn: ['nodes.PURCHASE_IN.draft'],
            note: '审核通过后转 ERP;库存流水按批号记账',
          },
          {
            key: 'ret', name: '暂收退料单', code: 'QC_RETURN', route: '/panelx/list/QC_RETURN',
            main: { label: '单据数', ref: 'nodes.QC_RETURN.docs' },
            subs: [
              { label: '待审核', ref: 'nodes.QC_RETURN.pending' },
              { label: '草稿', ref: 'nodes.QC_RETURN.draft' },
            ],
            warn: ['nodes.QC_RETURN.draft'],
            note: '不合格数量退料;「特采 = 是」的行转特采流程',
          },
          {
            key: 'tc', name: '特采单', code: 'QC_TC_IN', route: '/panelx/list/QC_TC_IN',
            main: { label: '单据数', ref: 'nodes.QC_TC_IN.docs' },
            subs: [
              { label: '待审批', ref: 'nodes.QC_TC_IN.pending' },
              { label: '草稿', ref: 'nodes.QC_TC_IN.draft' },
            ],
            block: ['nodes.QC_TC_IN.pending'],
            note: '二级审批:通过后放行 → 采购入库单',
          },
        ],
      },
      {
        key: 'stockq', name: '库存查询与预警(旁路)', hint: '报表都是查询表;出库受预警数量拦截',
        nodes: [
          {
            key: 'stockrpt', name: '库存报表(只读)', code: 'STOCK_BALANCE', route: '/panelx/list/STOCK_DETAIL',
            main: { label: '库存明细行', ref: 'nodes.STOCK_DETAIL.rows' },
            subs: [
              { label: '库存状况', ref: 'nodes.STOCK_BALANCE.rows' },
              { label: '库存台账', ref: 'nodes.STOCK_LEDGER.rows' },
              { label: '收发存汇总', ref: 'nodes.STOCK_SUMMARY.rows' },
            ],
            note: '库存状况/台账/收发存汇总/库存明细 = flat 直读查询表,不可编辑',
          },
          {
            key: 'warn', name: '出库预警', code: 'STOCK_DETAIL', route: '/panelx/list/STOCK_DETAIL',
            main: { label: '低于预警', ref: 'special.warn.below' },
            subs: [
              { label: '已设预警', ref: 'special.warn.thresholded' },
              { label: '负结存', ref: 'special.warn.negative' },
            ],
            block: ['special.warn.below'],
            note: '出库后该批次余额 < 预警数量 ⇒ 审批被拦下(先在库存明细设预警数量)',
          },
        ],
      },
    ],
  },
]

/** 节点级状态:block 红 / warn 橙 / ok 绿 / idle 灰 / na 无数据 */
export const LEVEL_TEXT = {
  block: '阻断', warn: '积压', ok: '通畅', idle: '无在办', na: '无数据',
}

/** 'nodes.WO_REPORT.pending' → data.nodes.WO_REPORT.pending;取不到返回 null(渲染成「—」) */
export function get(root, ref) {
  if (!root || !ref) return null
  let cur = root
  for (const seg of String(ref).split('.')) {
    if (cur == null || typeof cur !== 'object') return null
    cur = cur[seg]
  }
  return cur === undefined ? null : cur
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

/** 数字显示:整数带千分位;小数保留 1 位 */
export function fmtNum(v) {
  if (!isNum(v)) return '—'
  const n = Math.round(v * 10) / 10
  return Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

/** 一个节点要显示的指标(主数字 + 副行),值统一在这里落成「数字或 —」。
 *  ⚠ 必须容忍 data 为 null:视图在接口回来之前就会先渲染一帧(data=null),
 *  2026-10-16 实测「vite dev 上整块空白」就是这个 —— 某节点的 text 处理器写了 `d.special.x`
 *  而 d 是 null ⇒ render 抛 TypeError ⇒ FlowBoard 整块不渲染(8090 恰好抢在渲染前拿到数据,才没暴露)。
 *  故两层兜底:① 调用方传 `data || {}`;② 处理器抛错也不拖垮整块看板(落「—」)。 */
export function metricsOf(node, data) {
  const d = data || {}
  const mainVal = get(d, node.main.ref)
  const main = { label: node.main.label, value: mainVal, text: mainVal == null ? '—' : fmtNum(mainVal) }
  const subs = (node.subs || []).map((s) => {
    if (s.text) {
      try { return { label: s.label, text: s.text(d) } } catch { return { label: s.label, text: '—' } }
    }
    const v = get(d, s.ref)
    return { label: s.label, text: v == null ? '—' : fmtNum(v) }
  })
  return { main, subs }
}

/** 节点状态:先看 block 口径有没有量(阻断),再看 warn(积压),再看主数字 */
export function levelOf(node, data) {
  if (data == null) return 'na'
  const anyPositive = (refs) => (refs || []).some((r) => { const v = get(data, r); return isNum(v) && v > 0 })
  if (anyPositive(node.block)) return 'block'
  if (anyPositive(node.warn)) return 'warn'
  const m = get(data, node.main.ref)
  if (!isNum(m)) return 'na'
  return m > 0 ? 'ok' : 'idle'
}

/** 链路汇总:节点数 / 各状态计数 / 阻断节点清单(顶部卡点条之外的链路级判断) */
export function chainSummary(chain, data) {
  const levels = {}
  const blocked = []
  let total = 0
  for (const lane of chain.lanes) {
    for (const node of lane.nodes) {
      total++
      const lv = levelOf(node, data)
      levels[lv] = (levels[lv] || 0) + 1
      if (lv === 'block') blocked.push(node.name)
    }
  }
  return { total, levels, blocked }
}

/** 全部节点扁平清单(测试与「节点总数」断言用) */
export function allNodes() {
  return CHAINS.flatMap((c) => c.lanes.flatMap((l) => l.nodes))
}
