/**
 * 产能对比柱状图 —— 几何与格式化口径的唯一真源(纯函数,node:test 钉住)。
 *
 * 为什么单独成文件(2026-10-08 用户需求「日产能对比可以 tap 切换周/月/年,柱状图竖向排列」):
 *   柱高怎么算、轴取到多少、哪根柱该变色,这些如果写在 .vue 里就只能靠肉眼看图验证;
 *   8 条产线 × 4 个周期各画一遍,改一次样式就要人眼复核一次,画错了没人发现。
 *   抽成纯函数后,几何口径由 `capacityBars.test.js` 守着,组件只负责画。
 *
 * 口径(与既有「单天产能比」子弹条 SCapacity.vue 保持一致,别各写一套):
 *   · 实际与上限**共用同一条刻度轴**(轴上限 = 两者最大值向上取整到 1/2/5×10^n),
 *     否则「实际比上限高」这种事实在图上读不出来;
 *   · 超上限的柱高帽在 100% —— 比例失真是误导,溢出靠颜色 + 数字表达;
 *   · 未配日产能上限(limit=null)的行不画上限柱,色标记 na,提示去产线档案维护。
 */

/** 四档周期。key 与后端 `?period=` 一一对应;days 用于图例说明上限折算口径。 */
export const CAPACITY_PERIODS = [
  { key: 'day', label: '日产能', days: 1 },
  { key: 'week', label: '周产能', days: 7 },
  // 月按自然月天数折算(28~31 天不定),故 days=null 由后端算,前端只说明「按当月自然日」
  { key: 'month', label: '月产能', days: null },
  { key: 'year', label: '年产能', days: 365 },
]

/** 轴上限:向上取整到 1/2/5×10^n。空/非正数退化为 1(顺带做除零保护)。 */
export function niceMax(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(n)))
  for (const m of [1, 2, 5, 10]) {
    if (n <= m * exp) return m * exp
  }
  return 10 * exp
}

/** 达成率配色:与子弹条同阈值(<80 正常 / 80–100 接近满载 / >100 超上限 / 无上限)。 */
export function toneOf(pct) {
  if (pct == null) return 'na'
  if (pct > 100) return 'over'
  if (pct >= 80) return 'warn'
  return 'ok'
}

/**
 * 把后端行数据换算成柱高百分比。
 * @param {Array<{name:string, actual:number, limit:number|null, pct:number|null}>} rows 后端顺序即显示顺序
 * @returns {{max:number, rows:Array}} max = 刻度轴上限(原始值,用于刻度标签)
 */
export function scaleCapacity(rows) {
  const list = Array.isArray(rows) ? rows : []
  if (!list.length) return { max: 1, rows: [] }
  const nums = []
  for (const r of list) {
    const a = Number(r?.actual)
    if (Number.isFinite(a)) nums.push(a)
    const l = Number(r?.limit)
    if (r?.limit != null && Number.isFinite(l)) nums.push(l)
  }
  const max = niceMax(nums.length ? Math.max(...nums) : 0)
  const pctOf = (v) => {
    const n = Number(v)
    if (!Number.isFinite(n) || n <= 0) return 0
    return Math.min(100, Math.max(0, Math.round((n / max) * 100)))
  }
  return {
    max,
    rows: list.map((r) => ({
      ...r,
      actualPct: pctOf(r?.actual),
      limitPct: r?.limit == null ? 0 : pctOf(r.limit),
      tone: toneOf(r?.pct),
    })),
  }
}

/** 柱顶/纵轴数值:≤4 字符宽,过万缩「x.x万」(与看板 KPI 同款紧凑口径)。 */
export function fmtCompact(v) {
  const n = Number(v || 0)
  if (Math.abs(n) >= 10000) {
    return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万'
  }
  return n.toLocaleString('zh-CN')
}

/**
 * 标题副行:数据区间 + 上限折算口径。
 * ⚠ 口径按**数据自己的周期**(payload.period)取,不按当前选中的 tab ——
 *   点「周产能」的一瞬间新周期规则就绪、数据还没回来,若按选中的 tab 标注,
 *   标题会写成「数据区间 2026-08-26 · 上限 = 日产能 × 7 天」这种自相矛盾的组合
 *   (2026-10-08 界面探针在切换瞬间读到过这个混搭态)。
 * @param {{period?:string, from?:string, to?:string}|null} payload 后端载荷
 * @param {string} selectedKey 当前选中的周期(载荷还没有 period 时的兜底)
 * @param {(s:string)=>string} t 翻译函数(默认原样返回,便于单测)
 */
export function capacitySubText(payload, selectedKey, t = (s) => s) {
  const d = payload || {}
  const p = CAPACITY_PERIODS.find((x) => x.key === (d.period || selectedKey)) || CAPACITY_PERIODS[0]
  const span = d.from ? `${d.from}${d.to && d.to !== d.from ? ' ~ ' + d.to : ''}` : ''
  const rule = p.days ? `${t('上限 = 日产能 ×')} ${p.days} ${t('天')}` : t('上限 = 日产能 × 当月自然日')
  return [span ? `${t('数据区间')} ${span}` : '', rule].filter(Boolean).join(' · ')
}
