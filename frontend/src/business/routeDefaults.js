/**
 * routeDefaults.js — 「上次」预填纯逻辑(2026-10-25 定稿方案 v2:条39 转工单带上次工艺路线 / 条7 排产带上次产线)
 *
 * 为什么单独一个模块:优先级、候选校验、整行写入/仅填空行这些语义全是纯函数,
 * 能直接被 `node --test` 钉住边界;页面组件(OrderConvert.vue / ProcessRoutePlanDialog.vue)只负责请求与渲染。
 *
 * 数据键中文(与 dataName 口径一致,永不翻译):
 *   · 条39 后端 pending 行:工艺路线(=档案绑定 bs_inv.工艺路线)、上次工艺路线/上次路线来源单/上次日期/上次路线审核状态
 *     ,以及 2026-10-29 增的「同品名同规格」族兜底四列:同品名同规格上次工艺路线/…来源单/…日期/…审核状态
 *   · 条7 后端 routeSteps:上次首道 {上次首道线, 工单号, 日期}、上次产线 [{工序, 上次生产线, 工单号, 日期}]
 *
 * 优先级(2026-10-29 用户拍板):**同物料 > 同品名同规格(族兜底)> 档案绑定 > 空**
 *   —— 先认这个存货编码自己的最近一次转单;只有它没历史(或带出的路线已不在 bs_route)时,
 *   才用「同品名 + 同规格型号」的兄弟编码兜底(用户口径:「要同规格同品名的产品实现,
 *   不然只是根据上次的随便一条转工单的工艺路线就没有实际存在的意义」)。
 * 若业务日后要求「族优先、单物料兜底」,只需对调 pickRouteDefault 里两段顺序+对应断言,其余零影响。
 */

const norm = (v) => String(v ?? '').trim()

/**
 * 候选产线:按「生产车间」(ProcessTaskService 归口车间口径,装箱归组装)过滤**启用**线。
 *
 * ⚠ 预填路径**不回退全量**:车间判不出(空)或没有匹配线 ⇒ 返回 [](留空不预填,绝不锁死);
 *   手选下拉走 {@link lineOptions}(2026-10-28 起:限定车间才筛,否则列全部启用线)。
 *   两者刻意不同 —— 手选兜底是让人任何时候都有得选,预填不回退是不把跨车间/停用的线塞进默认值。
 * @param {Array<{生产线, 生产车间, 停用?}>} lines 产线档案(stats.产线 已只含启用线;停用过滤是防御)
 * @param {string} shop 归口车间(成型/切炭/组装)
 */
export function candidateLines(lines, shop) {
  const s = norm(shop)
  if (!s) return []
  return enabledLines(lines).filter((l) => norm(l['生产车间']) === s)
}

/** 只留启用线(候选/全量两条路都要过的同一道闸) */
function enabledLines(lines) {
  return (Array.isArray(lines) ? lines : []).filter((l) => {
    if (l == null || typeof l !== 'object') return false
    const off = l['停用']
    return !(off === 1 || off === '1' || off === true || off === 'Y')
  })
}

/**
 * **排线弹窗某一行「生产线」下拉的选项**(2026-10-28 用户口径:
 * 「之后任意一个不是当前三个工序名称的工序,也要能选到生产线 —— 没有对应产线类型就把全部产线列出来」)。
 *
 * 规则与服务端 `ProcessTaskService.requiredShop()` 一一对应,两边不能各写一套:
 *   · `step.限定车间 === true`(工序登记过固定车间 **且** 该车间确实有启用线)⇒ 只出该车间的启用线;
 *   · 其余情况(工序没登记固定车间 / 它的车间一条线都没有 / 老后端没回这个开关)⇒ **全部启用线**,
 *     并且 `limited=false` 让页面提示一句「已列出全部产线」,别让人以为筛错了。
 *
 * @param {object} step 弹窗行 {工序, 生产车间, 限定车间?}
 * @param {Array<{生产线, 生产车间, 停用?}>} lines 产线档案(stats.产线)
 * @returns {{ lines: Array, limited: boolean }}
 */
export function lineOptions(step, lines) {
  const all = enabledLines(lines)
  const cands = candidateLines(all, step?.['生产车间'])
  if (step?.['限定车间'] && cands.length) return { lines: cands, limited: true }
  return { lines: all, limited: false }
}

/**
 * 条39:该结转行的默认工艺路线。
 * 优先级 = 同物料上次(∈ bs_route 候选)> 同品名同规格族上次(∈ 候选)> 档案绑定 > 空。
 *
 * @param {object} row 后端 pending 行(含 工艺路线/上次工艺路线/… 与 同品名同规格上次工艺路线/…)
 * @param {Set<string>|Iterable<string>} routeSet 路线候选(bs_route 编码集合;上次已删路线 ⇒ 下探一档)
 * @returns {{ route: string, source: 'last'|'spec'|'bound'|'', fromNo: string, fromDate: string }}
 *   source='last'=按同物料上次带出 / 'spec'=按同品名同规格族兜底 / 'bound'=按档案绑定 / ''=皆无
 */
export function pickRouteDefault(row, routeSet) {
  const set = routeSet instanceof Set ? routeSet : new Set([...(routeSet || [])].map(norm).filter(Boolean))
  const last = norm(row?.['上次工艺路线'])
  if (last && set.has(last)) {
    return {
      route: last,
      source: 'last',
      fromNo: norm(row?.['上次路线来源单']),
      fromDate: norm(row?.['上次日期']),
    }
  }
  // 族兜底(2026-10-29):同物料没历史/路线已删时,借「同品名+同规格」的兄弟编码最近一次
  const spec = norm(row?.['同品名同规格上次工艺路线'])
  if (spec && set.has(spec)) {
    return {
      route: spec,
      source: 'spec',
      fromNo: norm(row?.['同品名同规格上次来源单']),
      fromDate: norm(row?.['同品名同规格上次日期']),
    }
  }
  const bound = norm(row?.['工艺路线'])
  if (bound) return { route: bound, source: 'bound', fromNo: '', fromDate: '' }
  return { route: '', source: '', fromNo: '', fromDate: '' }
}

/**
 * 条39:整行写入语义(冷读#1 拍板,**不是「仅补空值」**)——
 * 每行按 default=同物料上次(∈候选)>族兜底>绑定>空 **计算后整行写入** 行.工艺路线。
 * 此刻行刚由后端返回、无用户编辑可覆盖(与今天后端每次预填绑定同构);用户可逐行改,永不锁死。
 *
 * 路线审核状态**仅 source='last'/'spec' 时**改写为上面对应档的审核状态:
 *   · 'last' → 上次路线审核状态;'spec' → 同品名同规格上次审核状态;
 *   · source='bound' 保留后端按绑定算好的列值(本就正确);
 *   · source=''      保留后端的 '未选择'(无历史不产生红显噪音,冷读#6)。
 * 后端审核闸(requireRouteAudited)零改动,未审核的上次/族路线照样转不了单。
 *
 * @param {Array<object>} rows loadPending 映射后的行
 * @param {Set<string>|Iterable<string>} routeSet bs_route 编码集合
 */
export function applyRouteDefaults(rows, routeSet) {
  for (const row of rows || []) {
    if (row == null || typeof row !== 'object') continue
    const pick = pickRouteDefault(row, routeSet)
    row['工艺路线'] = pick.route          // 无条件整行写入
    row['路线来源'] = pick.source
    row['路线来源单'] = pick.fromNo
    row['路线来源日期'] = pick.fromDate
    if (pick.source === 'last') row['路线审核状态'] = norm(row['上次路线审核状态'])
    if (pick.source === 'spec') row['路线审核状态'] = norm(row['同品名同规格上次审核状态'])
  }
  return rows
}

/**
 * 条7:单道工序的默认线。工序名**两边 String().trim() 后精确匹配**(与 preplanManual 的
 * op.equals(trim) 同式;路线台账里存在「成型 」这类带尾空格的脏值)。
 *
 * @param {object} step 弹窗行 {工序, 生产车间(归口), 生产线?}
 * @param {Map<string,string>|Array<{工序, 上次生产线}>} lastByOp 同物料各道上次线(首条即最近)
 * @param {{上次首道线, 工单号?, 日期?}|null} lastFirst 同物料上次首道线(plang_pc 排产台账)
 * @param {Array<{生产线, 生产车间, 停用?}>} lines 产线档案
 * @param {boolean} firstOp 是否首道(只有首道可用「上次首道」兜底,其余各道不用)
 * @returns {{ line: string, from: 'last'|'' }} line=''=不预填(候选校验不通过/无历史)
 */
export function pickLineDefault(step, lastByOp, lastFirst, lines, firstOp = false) {
  const byOp = lastByOp instanceof Map ? lastByOp : opMapOf(lastByOp)
  const cands = candidateLines(lines, step?.['生产车间'])
  let pick = byOp.get(norm(step?.['工序'])) || ''
  if (!pick && firstOp) pick = norm(lastFirst?.['上次首道线'])
  if (!pick) return { line: '', from: '' }
  // 候选校验:只预填该工序归口车间的启用线 —— 跨车间/停用/脏名一律留空,绝不锁死
  if (!cands.some((l) => norm(l['生产线']) === pick)) return { line: '', from: '' }
  return { line: pick, from: 'last' }
}

/**
 * 条7:对弹窗行集应用「上次产线」预填 —— **仅填空行**(已排台账回填与首道锁定优先,语义与条39不同且各自正确)。
 *
 * @param {Array<object>} rows 弹窗行 [{工序, 生产车间, 换算率, 工序序, 计划完工日期, 生产线}]
 * @param {Array<{工序, 上次生产线}>} lastByOp 上次各道线
 * @param {{上次首道线}|null} lastFirst 上次首道线
 * @param {Array<{生产线, 生产车间, 停用?}>} lines 产线档案
 * @param {{ lockedFirst?: boolean }} [opts] lockedFirst=改线模式(已排产):首道锁定当前线,不覆盖
 * @returns rows(原数组,就地写 生产线/线来源)
 */
export function applyLineDefaults(rows, lastByOp, lastFirst, lines, opts = {}) {
  const byOp = opMapOf(lastByOp)
  ;(rows || []).forEach((row, i) => {
    if (row == null || typeof row !== 'object') return
    if (norm(row['生产线'])) return                    // 仅填空行(已排台账回填值不被污染)
    if (opts.lockedFirst && i === 0) return            // 改线模式:首道锁定,不覆盖
    const pick = pickLineDefault(row, byOp, lastFirst, lines, i === 0)
    if (pick.line) {
      row['生产线'] = pick.line
      row['线来源'] = pick.from                        // 行内「来源小字」的开关
    }
  })
  return rows
}

/** 上次各道线 → Map(键=trim 后工序名;后端已按最近倒序,同工序首条即最近) */
function opMapOf(lastByOp) {
  const m = new Map()
  for (const e of (Array.isArray(lastByOp) ? lastByOp : [])) {
    const op = norm(e?.['工序'])
    const line = norm(e?.['上次生产线'])
    if (op && line && !m.has(op)) m.set(op, line)
  }
  return m
}
