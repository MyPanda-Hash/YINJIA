/**
 * woBoardColumns.js — 「工单排产」(WorkOrderBoard)明细表的列定义 + 列设置后的渲染列序(2026-11-18)
 *
 * 背景(用户口径「为当前的工单排产处也增加列设置。让用户可以调整当前查看的列和不查看的列」):
 * 本页明细表基础 30+ 列、再加数据驱动的日排产日期列,列定义原来全部写死在 WorkOrderBoard.vue 的模板里,
 * 想少看几列只能改代码。列定义抽到这里(**纯数据 + 纯函数,无 Vue 依赖 ⇒ 可单测**),页面只负责按
 * 返回的列序渲染;显隐/顺序本身走系统级实现 `useReportColumns` + `/px/reportColumnSettings`
 * (panelCode=WORK_ORDER_BOARD,与「订单结转」「生产工单·列表」同一套持久化,按面板存一份、全用户共享)。
 *
 * 三条硬口径(别改坏):
 *  ① **冻结区**:`frozen: true` 的四列(产品编码/产品规格/订单数量/客户)必须始终 `fixed` 且排在非冻结列
 *     之前 —— 2026-11-08 用户口径「产品编码、产品规格、订单数量显示在前面冻结,方便看」。el-table 的
 *     sticky 冻结列**声明顺序=视觉顺序**,一旦被拖到滚动区中间,冻结区就散了 ⇒ 顺序锁定:列设置里只能
 *     显隐(`locked`,拖动/▲▼ 禁用),不能换位。
 *  ② **日期列组**:日排产日期列由后端按数据生成(几十列),不进列设置 —— 用一个伪列
 *     `日排产日期列` 统管「整组显示/隐藏」,它的位置同时是日期列在表格里的**插入点**
 *     (拖动它 = 整组日期列前后搬家)。与「生产工单·列表」(WorkOrderList)同一套做法。
 *  ③ **列名 vs 数据键**:`prop` 是列设置的稳定键、也是中文标签(存进设置 JSON 里可读);`key` 是行数据键
 *     (默认同 prop)。列名与数据键不同的(订单数量→需求数量、可加工量→当前工序可加工量 …)必须写 key,
 *     否则 el-table 取不到值、sortable 也按错的键排。
 */

import { normalizePin } from '../core/report/reportColumnSettings.js'

/** 列设置里的伪列:整组「日排产日期列」的显隐开关 + 日期列插入点(本身不出列) */
export const DAY_PLAN_COL_PROP = '日排产日期列'

/** 需求交期三桶共用的表头 tooltip(2026-11-15 口径:需交付 = 工序计划量) */
const DUE_TIP = '需交付 = 工序计划量(排产数量 × 该道换算率),按交期落桶;与「已排」三桶同一口径'

/**
 * 列定义(默认顺序 = 表格默认顺序)。
 * 字段:
 *   prop          列设置的稳定键 = 中文标签(会存进 report_column_settings)
 *   key           行数据键(省略 = 同 prop)
 *   width/minWidth/align/sortable/showOverflow/headerTip  同 el-table-column 对应属性
 *   frozen        冻结区列(强制 fixed 左,顺序锁定,见文件头 ①)
 */
export const WO_BOARD_COLUMNS = [
  // ── 冻结区(2026-11-08 用户口径,顺序锁定)──
  //    用户原话:「排单界面物产品编码、产品规格、订单数量,显示在前面冻结,方便看。」
  //    宽度刻意收窄(110/120/84):表格列已 30+,冻结区一宽就挤掉滚动区;长值一律走 show-overflow-tooltip,
  //    不靠拉宽列。原来夹在滚动区里的「物料编码/规格型号/需求数量」是**位置前移、不复制**,避免同一信息出现两次。
  { prop: '产品编码', key: '物料编码', width: 110, showOverflow: true, frozen: true },
  { prop: '产品规格', key: '规格型号', width: 120, showOverflow: true, frozen: true },
  { prop: '订单数量', key: '需求数量', width: 84, align: 'right', frozen: true,
    headerTip: '订单数量 = 本行需求数量(本次转单量);备品场景可大于销售订单数量' },
  { prop: '客户', minWidth: 110, showOverflow: true, frozen: true },
  // ── 横向滚动区(可自由排序/显隐)──
  { prop: '工单行号', width: 90, sortable: true },
  { prop: '排产日期', width: 95 },
  { prop: '客户PO', width: 110, showOverflow: true },
  { prop: '产品名称', minWidth: 140, showOverflow: true },
  { prop: '单位', width: 55 },
  { prop: '批号', width: 100, showOverflow: true },
  { prop: '重点管控', width: 80 },
  // 排产日期(2026-10-31):就地改「开工日 / 计划完工日」—— 双击进 date-picker(cell 分支 'planDate')
  { prop: '开工日期', width: 105, cell: 'planDate' },
  { prop: '计划完工日期', width: 115, cell: 'planDate' },
  { prop: '实际完工日期', width: 105 },
  // 本线排产数量(2026-11-11 用户口径):一行 = 一张工单行在当前产线做当前工序,
  //   所以这列看的是本线要做的量 = 排产数量 × 该道换算率(= 当前工序计划量);成品口径看「订单数量」。
  { prop: '本线排产数量', width: 110, align: 'right', cell: 'lineQty',
    headerTip: '本线排产数量 = 排产数量 × 该工序自己的换算率(取该行当前工序的台账计划数量);成品口径请用左侧「订单数量」' },
  { prop: '入库数量', width: 90, align: 'right' },
  // 工序块(2026-11-12 用户口径「这些数据完成需要放在前面…放在工序那边」):从左到右读成一条链
  { prop: '当前工序', width: 95, sortable: true, cell: 'process' },
  { prop: '当前工序计划量', width: 120, align: 'right' },
  { prop: '当前工序完工量', width: 120, align: 'right' },
  { prop: '上道工序', width: 95, cell: 'process' },
  { prop: '上道完工量', width: 110, align: 'right', cell: 'flowNum',
    headerTip: '上道完工量 = 上一道已审核报工数(上一道自己的计量单位,不折算);换算率不同时,本道能做多少看「可加工量」' },
  { prop: '可加工量', key: '当前工序可加工量', width: 100, align: 'right', cell: 'flowNum',
    headerTip: '可加工量 = 上一道流下来的量(已按换算率折到本道单位),也就是本道现在最多能做多少' },
  { prop: '待报量', key: '当前工序待报量', width: 92, align: 'right', cell: 'flowNum',
    headerTip: '待报量 = 可加工量 − 本工序已审报工(本道还能报多少)' },
  { prop: '待流入量', key: '当前工序待流入量', width: 100, align: 'right', cell: 'flowGap',
    headerTip: '待流入量 = 本工序计划量 − 可加工量(还等上一道流下来多少)' },
  { prop: '交期紧迫度', width: 90, align: 'right' },
  // 需交付三桶(2026-11-15):口径 = 工序计划量(排产 × 该道换算率),与「已排」三桶同一把尺。
  //   ⚠ 值走 num() 显式渲染:0 要显示 0,别用 prop 默认渲染(实测合并进 row 的 0 会显示空格)。
  { prop: '7天需交付', width: 92, align: 'right', cell: 'num', headerTip: DUE_TIP },
  { prop: '15天需交付', width: 96, align: 'right', cell: 'num', headerTip: DUE_TIP },
  { prop: '大于15天需交付', width: 112, align: 'right', cell: 'num', headerTip: DUE_TIP },
  { prop: '7天已排', width: 88, align: 'right' },
  { prop: '15天已排', width: 92, align: 'right' },
  { prop: '大于15天已排', width: 108, align: 'right' },
  // 日排产日期列的伪列(锚点):它**不是一列**,只是标出「日期组插在这里」+ 统管整组显隐。
  //   放在这里 = 默认位置与改造前的表格一致(工序桶之后、成品口径「未交量」之前);用户可在列设置里拖动它,
  //   整组日期列跟着搬家(见 boardRenderColumns)。
  { prop: DAY_PLAN_COL_PROP, anchor: true },
  // 成品口径:未交量 = 排产数量 − 入库数量(整单剩余,不折工序;2026-11-15 用户再次确认)
  { prop: '未交量', width: 85, align: 'right', cell: 'flowNum',
    headerTip: '未交量 = 排产数量 − 入库数量(成品口径,整单剩余;不折工序)' },
  { prop: '操作员', width: 80 },
  // 「余量」列已隐藏(2026-11-08 用户口径「直接隐藏吧」):它是「本工单行需求 − 本行订单占用」
  //   (form_flow_link SO→PLANG)的口径 —— 新口径下需求=转单量、占用链也写同一个数,余量恒为 0
  //   (正式库实测 399 行里 397 行为 0),与「当前工序还剩多少未生产」无关、极易误读;后台字段照旧返回,
  //   只是界面不再展示。要看"还剩多少":用「未交量」(排产−入库)或「当前工序计划量/当前工序完工量」。
  //   要恢复:把 `{ prop: '余量', width: 90, align: 'right' }` 加回本数组即可(2026-11-18 起列定义集中在这里,
  //   加回后列设置里会自动出现该项)。
  { prop: '备注', minWidth: 100, showOverflow: true },
  { prop: '领料单号', width: 120, showOverflow: true },
  { prop: '入库单号', width: 120, showOverflow: true },
  { prop: '结案', width: 70, cell: 'closed' },
  { prop: '结案人', width: 80 },
  { prop: '结案时间', width: 130 },
  { prop: '打印人', width: 80 },
  { prop: '打印时间', width: 130 },
  { prop: '打印次数', width: 80, align: 'right' },
]

/** 冻结区列名(顺序锁定,列设置里只给显隐;ColumnSettingsDialog 按 locked 禁用拖动/▲▼) */
export const WO_BOARD_FROZEN_PROPS = WO_BOARD_COLUMNS.filter((c) => c.frozen).map((c) => c.prop)

/**
 * 冻结区四列的**默认固定位置**(2026-11-18 起「固定」是列设置里的一项用户偏好):
 * 没保存过设置时它们默认固定左侧(保住 2026-11-08 用户口径「产品编码/产品规格/订单数量显示在前面冻结」);
 * 冻结列本身在列设置里顺序锁定、固定端不可改,所以这里只是 render 的默认值来源。
 */
export const WO_BOARD_DEFAULT_PINS = Object.fromEntries(
  WO_BOARD_COLUMNS.filter((c) => c.frozen).map((c) => [c.prop, 'left'])
)

/** 传进 useReportColumns 的字段名列表(= 列定义顺序,伪列在自己的锚点位置 ⇒ 弹窗里也落在同一处) */
export function boardColumnProps(columns = WO_BOARD_COLUMNS) {
  return columns.map((c) => c.prop)
}

/**
 * 把「滚动区列」的目标下标夹回滚动区(冻结区之后)。
 *
 * 为什么需要:冻结区在表格里恒排最左(顺序锁定),但弹窗里它和其它列同处一个列表 —— 用户把「备注」
 * 拖到第 1 位时,表格里它仍会排在「客户」之后;不夹的话弹窗顺序和表格顺序就对不上(看起来像"拖了没生效"),
 * 而且滚动列一旦被挤进冻结区,下次渲染还得靠 boardRenderColumns 再筛一遍。夹住 = 弹窗所见即表格所得。
 *
 * @param {{prop:string}[]} draft - 列草稿
 * @param {number} index - 想插入的下标
 * @param {string[]} frozenProps - 冻结区列名
 * @returns {number} 夹回后的下标(不早于冻结区末尾)
 */
export function clampToScrollZone(draft = [], index = 0, frozenProps = WO_BOARD_FROZEN_PROPS) {
  const frozen = new Set(frozenProps)
  let end = 0                                  // 冻结区末尾(草稿里最后一个冻结列的下一个下标)
  draft.forEach((c, i) => { if (c && frozen.has(c.prop)) end = i + 1 })
  const last = Math.max(end, draft.length - 1) // 最大合法下标
  const n = Number(index)
  if (!Number.isFinite(n)) return end
  return Math.min(Math.max(Math.trunc(n), end), last)
}

/**
 * 算出表格**实际渲染**的列序(列设置草稿 → 渲染列表)。
 *
 * 返回数组元素两种形态:
 *   · 普通列 = `{ ...列定义, fixed?: 'left'|'right' }`(固定列带 fixed)
 *   · 日期列 = `{ prop: '__dp__<日期>', date: '<日期>' }`(整组由伪列的位置与显隐决定)
 * 顺序:固定左(冻结区 → 用户固定左)→ 不固定(草稿顺序,日期组在伪列位置展开)→ 固定右(草稿顺序)。
 *
 * 2026-11-18 用户口径「列设置增加可以对列固定位置,移动后这个列不再随着滚轮移动」:
 *   · 冻结区 4 列 = 定义层默认固定左(`frozen`),顺序按列定义锁定;
 *   · 其余列按草稿里的 `pin` 分组(设置没存过 ⇒ 不固定);固定右的列由 el-table 自己贴到最右侧
 *     (它会把 fixed 列统一重排成「固定左 + 非固定 + 固定右」,所以这里只需保证同端内部顺序
 *     与弹窗一致,并把 `fixed` 属性交给模板)。
 *
 * @param {{prop:string, visible:boolean, pin?:string}[]} draft - useReportColumns 的列草稿(空 = 还没 init)
 * @param {Object[]} columns - 列定义
 * @param {string[]} dates - 日排产日期列(升序)
 * @param {string} anchorProp - 日排产日期列的伪列名
 * @returns {Object[]}
 */
export function boardRenderColumns(draft = [], columns = WO_BOARD_COLUMNS, dates = [], anchorProp = DAY_PLAN_COL_PROP) {
  const byProp = new Map(columns.map((c) => [c.prop, c]))
  /** 草稿里没这条(新加的列/还没 init)⇒ 视为可见,不静默丢列 */
  const visibleOf = (prop) => {
    const hit = draft.find((x) => x && x.prop === prop)
    return !hit || hit.visible !== false
  }
  const left = []
  const middle = []
  const right = []
  // ① 冻结区:一律按列定义的声明顺序、固定左侧(顺序锁定;草稿顺序不参与,免得被拖散)
  const placed = new Set()
  for (const c of columns) {
    if (!c.frozen || !visibleOf(c.prop)) continue
    left.push({ ...c, fixed: 'left' })
    placed.add(c.prop)
  }
  // ② 其余列:按草稿顺序,再按 pin 分到 左/中/右 三组;伪列在「中」组展开成整组日期列
  const seq = draft.some((x) => x && x.prop)
    ? draft
    : columns.map((c) => ({ prop: c.prop, visible: true }))
  for (const item of seq) {
    if (!item || !item.prop) continue
    if (item.prop === anchorProp) {
      // 伪列本身不出列:它只决定「日期组显示与否」+「日期组插在哪」
      placed.add(anchorProp)
      if (item.visible === false) continue
      for (const d of dates) middle.push({ prop: `__dp__${d}`, date: d, width: 88, align: 'center' })
      continue
    }
    const c = byProp.get(item.prop)
    if (!c || c.frozen) continue   // 冻结列已在 ① 出过;未知 prop(老存档里的死列名)直接丢
    placed.add(c.prop)
    if (item.visible === false) continue
    const pin = normalizePin(item.pin)
    if (pin === 'left') left.push({ ...c, fixed: 'left' })
    else if (pin === 'right') right.push({ ...c, fixed: 'right' })
    else middle.push({ ...c })
  }
  // ③ 兜底:列定义里有、草稿里却没有的列(草稿过期/刚加的列)按定义顺序补在「中」组末尾,不静默丢列。
  //    实际流程里 buildReportColumnSettings 总会把列定义全量并进草稿,这里只是防脏设置把新列吃掉。
  for (const c of columns) {
    if (c.frozen || c.anchor || placed.has(c.prop) || !visibleOf(c.prop)) continue
    middle.push({ ...c })
  }
  return [...left, ...middle, ...right]
}
