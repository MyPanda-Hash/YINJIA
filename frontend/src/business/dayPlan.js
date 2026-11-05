/**
 * 日排产(2026-10-29)纯逻辑 —— 只放**显示层**判定;日计划本身由后端算(见下)。
 *
 * 生产工单(WorkOrderList)与工单排产(WorkOrderBoard)两页共用:
 *   · 表格里的「日期列」:格上方是当天计划量、格下方绿色小字是当天已审核报工量;
 *   · 计划量**由后端自动算**(`DayPlanSpread`:工序计划量 ÷ 开工日→交期),前端不填、不保存。
 *
 * ⚠ 2026-10-31 用户口径(逐轮收敛的最终态,别往回改):
 *   1. 「**当前不需要手填,能自动算就可以了**」⇒ 日期格**只读**,「保存日排产」按钮与
 *      手填/落库链路整体撤除(2026-10-30 删掉的「按完工日期均摊」弹窗也不需要恢复);
 *      日计划是派生值:交期/排产数量一改,下次刷新自然就变。
 *   2. 产能**只显示、不拦截** —— 不影响实际排产量;超产能只把列头标红;
 *      开工日/完工日/交期只做查询与显示(不排序、不卡窗口)。
 *   3. 格内两个数要分清:上=计划,下=报工(「实」标 + 绿色);日期列分段:
 *      今天列标「今」+ 浅蓝底、过去列灰底(历史对照段)。
 *
 * 本文件只放这些**纯判定**(便于单测),接口调用见 `business/dayPlanApi.js`,组件只管状态与渲染。
 */

/** 数量显示:0/空显示空白(日期格没排就是空的,免得满屏 0) */
export function qtyText(v) {
  const n = Number(v || 0)
  return n ? n.toFixed(2).replace(/\.?0+$/, '') : ''
}

/** 日期是否属于"过去"(不含今天):过去列 = 历史对照段(列头/格子灰底) */
export function isPast(date, today) {
  return !!date && !!today && date < today
}

/** 日期是否就是"今天"(列头标「今」,一眼看出哪一列是当天) */
export function isToday(date, today) {
  return !!date && !!today && date === today
}

/**
 * 日期列状态(2026-10-31 用户口径「列头标出今/过去,别让两段混在一起」):
 * `past` = 今天以前的列(历史对照)、`today` = 今天列(标「今」)、`future` = 今天以后。
 *
 * <p>只影响列头与底色,不改任何取数口径。
 */
export function dayColState(date, today) {
  if (!date || !today) return 'future'
  if (isToday(date, today)) return 'today'
  return isPast(date, today) ? 'past' : 'future'
}

/**
 * 超产能判定(2026-10-31):某线某天「已排 > 日产能」⇒ true(界面标红)。
 *
 * <p>产能 <= 0 视为**未配产能**,一律不判超载 —— 沿用 bs_prod_line.日产能 列注明「0=不判超载」。
 * 本函数只用于显示,调用方**不得**据此拦任何东西(用户口径:不堵死录入)。
 *
 * @param {number} planned  该线当天已排合计
 * @param {number} capacity 产线日产能
 */
export function isOverCapacity(planned, capacity) {
  const cap = Number(capacity || 0)
  return cap > 0 && Number(planned || 0) > cap + 1e-6
}

/**
 * 日计划格的**融合显示**(2026-10-31 用户口径:「计划和实际排产这个得融合的好一点,当前太丑了…
 * 没有实际报工的话就还是显示原来的数量」;**当天有报工就必须看到实际完成数**——
 * 2026-10-31 晚用户再次报障:「红框内不是存在对应的完成数量的吗?怎么没有了」)。
 *
 * <p>一个格子只显示**一个数**:
 * <ul>
 *   <li>当天**有已审报工** ⇒ 显示**实际完成数**(绿色,一眼看出真做了多少;没达成时自然就比计划小);</li>
 *   <li>当天**没有报工** ⇒ 显示**计划**(原来那样)。</li>
 * </ul>
 * 计划为 0 却有报工(临时插单/补做)⇒ 同样显示实际。
 *
 * <p>计划值不丢:进格子的 tooltip(`计划 X · 实报 Y`),屏幕上不再挤两行数字。
 *
 * @param {number} plan   当日计划(人工指定 ∪ 自动摊剩余后的值)
 * @param {number} actual 当日已审核报工量
 * @returns {{qty:number, isActual:boolean}} qty=要显示的数; isActual=显示的是实际值(前端标绿)
 */
export function dayCellQty(plan, actual) {
  const p = Number(plan || 0)
  const a = Number(actual || 0)
  if (a > 0) return { qty: a, isActual: true }
  return { qty: p, isActual: false }
}

/**
 * 日期格是否**落在本行排产区间之外**(2026-11-01 用户口径:
 * 「如果改行的日期不再整个的排产中就要有斜杆在这个日期表下,就比如我修改最下面一条的开工日期为
 *  11.02 号了,那么今日的那行就要画/」)。
 *
 * <p>区间 = **开工日 → 计划完工日**(与后端 `DayPlanSpread` 摊分用的区间同一份来源:
 * `plang.st_date` / `plang.cp_date`)。落在区间外的那一格画「/」,表示"这一天不归本行排"。
 *
 * <p>两端**各自独立**判定:开工日为空(历史单常态)不在左端画杠;计划完工日为空不在右端画杠 ——
 * 不拿"今天"去猜,免得老单满屏斜杠。
 *
 * <p>两个数据坑(2026-11-01 实测正式库):
 * <ul>
 *   <li><b>1900-01-01 哨兵</b>:老数据把"没填"写成 1900-01-01 ⇒ 当空处理,否则整行满屏斜杠;</li>
 *   <li><b>完工日早于开工日</b>(录入反了,如 GD-2026-10-0202:10-11 → 10-10):与后端
 *       {@code DayPlanSpread} 同口径收成单日窗口(终点 = 开工日),不然整行区间为空、全被画杠。</li>
 * </ul>
 *
 * <p>⚠ 只有"空着的格子"才画杠:有日计划 / 有已审报工 / 有「手」人工指定的格子永远显示数字
 * (那些是真实的排产事实,哪怕落在区间外);调用方先判有值再调本函数。
 *
 * @param {string} date  列头日期(yyyy-MM-dd)
 * @param {string} start 本行计划开工日期(可空)
 * @param {string} due   本行计划完工日期(可空)
 * @returns {boolean} true = 不在区间内(该画斜杠)
 */
export function isOutOfPlanRange(date, start, due) {
  const norm = (s) => {
    const t = String(s == null ? '' : s).slice(0, 10)
    return !t || t < '1900-01-02' ? '' : t   // 1900-01-01 = 老数据"没填"
  }
  const d = norm(date)
  if (!d) return false
  const s = norm(start)
  let e = norm(due)
  if (s && e && e < s) e = s                // 完工日早于开工日 ⇒ 与摊分一致:单日窗口
  if (s && d < s) return true
  if (e && d > e) return true
  return false
}
