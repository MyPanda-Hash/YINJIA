/**
 * 配方表 ⇄ 计算引擎的接线逻辑(纯函数,不碰 Vue)。
 *
 * 三件事:
 *   ① `slotsFromRows`  单据页 2「配方表」的行 → 引擎的 10 个料位
 *   ② `paramsFromHead` 单据头字段 + 参数集 → 引擎入参
 *   ③ `buildPatch`     引擎结果 → 回填补丁(页 1 十一个格 + 配方表两列)
 *
 * 另有两条**输入闸**(2026-10-15,治"输入不全却静默出结果"):
 *   · `paramsFromHead(head, overrides, rows)` 第三参给出配方表行时,`materialRowCount(rows) === 0`
 *     ⇒ `missing` 里多一条 `NO_RECIPE_ROWS`,弹窗据此阻断(0 行是唯一没有歧义的"根本算不了");
 *   · `unfilledDesignRows(rows, slots)` 点名"有物料但没填设计添加量"的行 → 弹窗出告警(只告警不阻断)。
 * 两条都只做**判定**,不碰 `recipeEngine.compute` 的公式(ADR-0004)。
 *
 * 单位与口径(与 recipeEngine 的头注一致,这里再钉一次):
 *   - 粉料/胶粉行的「设计添加量」= **比例**。单据上人可能填小数(0.62)也可能填百分数(62),
 *     故 `parseRatio` 做容错解释并对"按百分数解释"标记出来,弹窗会把它显示给用户看;
 *   - 折算料行的「设计添加量」= **克/支**(引擎自己乘腔数),若直接当比例会算出荒谬的料位1 补差;
 *   - 料位 1 恒为**补差位**(= 1 − Σ料位2~7),与演示程序一致 —— 单据上第 1 行填的值不参与计算,
 *     弹窗把它显示为只读并标注来源。
 *
 * 已知局限(写下来而不是装作没有):
 *   料位分组按「物料种类」判定(与演示程序的料位可选物料一致)。若有人把「功能料-粉末」的物料
 *   当成折算料填在第 8~10 行,它会被分到粉料位、结果就错了。弹窗会显示每个料位的实际分组,
 *   且粉料超过 5 行会告警 —— 但根子上要靠"物料种类填对"或后续加一列显式料位号来根治。
 */
import { SLOT_COUNT, POWDER_SLOTS, GLUE_SLOTS, CONVERTED_SLOTS, DEFAULT_LENGTH_TOL } from './recipeConstants.js'

export const SLOT_GROUPS = { POWDER: '粉料', GLUE: '胶粉', CONVERTED: '折算料' }

/**
 * `paramsFromHead(...).missing` 里的阻断项名:配方行一行物料都没有。
 * 判据就是**调用方传进来的那份行**:2026-10-15 起配方表的行在配方计算弹窗里录
 * (不再从规格书带入、也不要求页 2 先填),故弹窗传的是它自己那份行 —— 页 2 空不空与本次计算无关。
 * 弹窗据此换一句对症的文案(「请先在页 1 填好…」那套对配方行说不通)。
 */
export const NO_RECIPE_ROWS = '配方表物料行'

/** 物料种类 → 料位分组(与演示程序 料位↔可选物料 的对应关系一致) */
export function groupOfMaterialType(type) {
  const t = String(type ?? '').trim()
  if (!t) return ''
  if (t.includes('胶粉')) return SLOT_GROUPS.GLUE
  if (t.includes('颗粒') || t.includes('折算物料')) return SLOT_GROUPS.CONVERTED
  if (t.includes('炭粉') || t.includes('粉末')) return SLOT_GROUPS.POWDER
  return ''
}

/** 「设计添加量」→ 比例:小数原样,'62'/'62%' 按百分数解释(并标记,弹窗要提示) */
export function parseRatio(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  const explicitPercent = raw.includes('%')
  const num = Number(raw.replace('%', '').trim())
  if (!Number.isFinite(num)) return null
  if (explicitPercent) return { value: num / 100, percentAssumed: false }
  if (num > 1) return { value: num / 100, percentAssumed: true }
  return { value: num, percentAssumed: false }
}

/** 数值文本(折算料的克/支) */
function parseNumber(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  const num = Number(raw.replace('%', '').trim())
  return Number.isFinite(num) ? num : null
}

/**
 * 炭棒规格格文本 → 数字。
 *
 * ⚠ 为什么不能直接用 parseNumber:「选产品编号」带出的落格文本**带标签前缀**
 * (`外：56.5` / `内：29.5` / `长：250`,见 core/panel/carbonSpec.js 的 SPEC_SLOTS),
 * 直接 Number() 得到 NaN。外径/内径另有「外径mm/内径mm」兜底,长度没有兜底 ——
 * 于是"单据上明明有长度"却永远报「缺长度」,或者被当成缺失拦下来。
 *
 * 口径:先剥掉**冒号前缀**(冒号前没有数字才算前缀,免得把 `12:30` 这类值当标签),
 * 再要求剩下的部分是一个纯数字(允许尾随 `mm`);解析不出给 null —— 不猜。
 */
export function parseSpecNumber(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  const m = raw.match(/^[^0-9]*[：:]\s*(.+)$/)
  const body = (m ? m[1] : raw).trim()
  const num = /^([+-]?\d+(?:\.\d+)?)\s*(?:mm)?$/i.exec(body)
  return num ? Number(num[1]) : null
}

/**
 * 弹窗那一格「含水率%」→ 引擎要的小数。
 * 弹窗标签与 exe 前端一致用百分数(exe 把物料的 0.06 显示成 6.0),
 * 而引擎的 moisture 是小数 —— 少这一步换算,填 6 会被当成 600%,灌料湿重直接算飞。
 */
export function moisturePercent(text) {
  const raw = String(text ?? '').trim()
  if (!raw) return null
  const num = Number(raw.replace('%', '').trim())
  return Number.isFinite(num) ? num / 100 : null
}

/** 「密度范围：0.56~0.58」这类文本 → [下限, 上限] */
export function parseDensityRange(text) {
  const raw = String(text ?? '')
  const m = raw.match(/(\d+(?:\.\d+)?)\s*[~～\-—至]\s*(\d+(?:\.\d+)?)/)
  if (!m) return null
  const low = Number(m[1])
  const high = Number(m[2])
  return Number.isFinite(low) && Number.isFinite(high) ? [low, high] : null
}

/**
 * 配方表的行 → 10 个料位。
 * @returns {{slots: Array, warnings: string[]}} slots 恒为 10 个(不足补空位),每个含
 *   {slot, group, code, name, designRatio, amountG, moisture, rowIndex, derived, issue}
 */
export function slotsFromRows(rows) {
  const list = Array.isArray(rows) ? rows : []
  const warnings = []
  const buckets = { [SLOT_GROUPS.POWDER]: [], [SLOT_GROUPS.GLUE]: [], [SLOT_GROUPS.CONVERTED]: [] }
  const capacity = { [SLOT_GROUPS.POWDER]: POWDER_SLOTS.length, [SLOT_GROUPS.GLUE]: GLUE_SLOTS.length, [SLOT_GROUPS.CONVERTED]: CONVERTED_SLOTS.length }

  list.forEach((r, rowIndex) => {
    const kind = r?.['物料种类']
    const group = groupOfMaterialType(kind)
    const name = r?.['物料名称'] || r?.['物料编号'] || ''
    if (!group) {
      warnings.push(`第 ${rowIndex + 1} 行「${name || '未填物料'}」的物料种类「${kind ?? ''}」认不出来，暂按粉料处理，请核对物料档案的物料种类`)
      buckets[SLOT_GROUPS.POWDER].push({ rowIndex, row: r, issue: 'unknown-type' })
      return
    }
    if (buckets[group].length >= capacity[group]) {
      warnings.push(`${group}料位最多 ${capacity[group]} 个，第 ${rowIndex + 1} 行已忽略（请合并或调整配方行）`)
      return
    }
    buckets[group].push({ rowIndex, row: r })
  })

  const slots = []
  const push = (group, slotNo, entry) => {
    const r = entry?.row
    const designText = r?.['设计添加量']
    const isConverted = group === SLOT_GROUPS.CONVERTED
    const parsed = parseRatio(designText)
    // ⚠ 只有粉料/胶粉位才谈得上"比例" —— 折算料位的设计值本来就是克/支,>1 是正常的,
    //   对它报"已按百分数解释"是假告警(界面探针实测到过),会把工艺员引去改一个本来就对的格。
    if (!isConverted && parsed?.percentAssumed) {
      warnings.push(`料位 ${slotNo} 的「设计添加量」填的是 ${String(designText).trim()}，已按百分数解释为 ${(parsed.value * 100).toFixed(2)}%`)
    }
    slots.push({
      slot: slotNo,
      group,
      code: r?.['物料编号'] || '',
      name: r?.['物料名称'] || '',
      designRatio: isConverted ? null : (parsed ? parsed.value : (r ? 0 : null)),
      amountG: isConverted ? (parseNumber(designText) ?? 0) : null,
      moisture: null,
      rowIndex: entry ? entry.rowIndex : -1,
      derived: slotNo === 1,
      issue: entry?.issue || '',
    })
  }

  POWDER_SLOTS.forEach((_, i) => push(SLOT_GROUPS.POWDER, i + 1, buckets[SLOT_GROUPS.POWDER][i]))
  GLUE_SLOTS.forEach((_, i) => push(SLOT_GROUPS.GLUE, i + 6, buckets[SLOT_GROUPS.GLUE][i]))
  CONVERTED_SLOTS.forEach((_, i) => push(SLOT_GROUPS.CONVERTED, i + 8, buckets[SLOT_GROUPS.CONVERTED][i]))

  // 料位 1 恒为补差位:1 − Σ(料位2~7)
  const others = slots.filter((s) => s.slot >= 2 && s.slot <= 7).reduce((sum, s) => sum + (s.designRatio || 0), 0)
  slots[0].designRatio = 1 - others
  if (slots[0].designRatio < 0) {
    warnings.push(`料位 1 的补差比例算出来是负的（${(slots[0].designRatio * 100).toFixed(2)}%），说明料位 2~7 的比例合计已超过 100%，请核对设计添加量`)
  }
  return { slots, warnings }
}

/**
 * 「参与计算的行没填设计添加量」的行号清单(1 起,升序)—— 弹窗据此出告警。
 *
 * 为什么必须有这条:空着的「设计添加量」在引擎里等同于 0(粉料/胶粉位 = 比例 0,折算料位 = 0 克/支),
 * 而料位 1 是补差位(1 − Σ料位2~7)会把差额全吃下来 ⇒ **两行折算料全空也照样出结果、零告警**,
 * 页 1 十一格全来自"料位 1 = 100%",看着像算成功了,其实毫无意义。
 *
 * 哪些行**该填**(按引擎真实料位语义,不是"凡有行就报"):
 *   · 料位 1(第 1 个粉料行)是补差位 —— 它的值由引擎反推,行上填什么本来就不参与 ⇒ 不点名;
 *   · 料位 2~7(粉料/胶粉)吃 `design_ratio`、料位 8~10(折算料)吃 `amount_g` ⇒ 空/非数字即按 0 算,点名;
 *   · 没有物料(编号与名称皆空)的空行不点名 —— 明细表天生会留空行;
 *   · 显式填 `0` 不点名 —— 那是"这个料不用"的有意输入(与"忘了填"要区分开)。
 * ⚠ 刻意**只告警不阻断**:料位分组按「物料种类」判定,第 1 行/空行/不参与位的存在使"该填哪些行"
 *   无法做到零误判(硬要求:宁可提示,不可误伤合法场景)。唯一无歧义的"0 行"由 NO_RECIPE_ROWS 阻断。
 *
 * @param {Array} rows 配方表行
 * @param {Array} slots slotsFromRows(...).slots
 * @returns {number[]} 行号(配方表第几行),无问题给 []
 */
export function unfilledDesignRows(rows, slots) {
  const out = []
  const list = Array.isArray(slots) ? slots : []
  list.forEach((s) => {
    if (!s || s.rowIndex < 0 || s.slot === 1) return                       // 空料位 / 补差位
    if (!String(s.code ?? '').trim() && !String(s.name ?? '').trim()) return  // 连物料都没有的空行
    const text = rows?.[s.rowIndex]?.['设计添加量']
    const usable = s.group === SLOT_GROUPS.CONVERTED ? parseNumber(text) !== null : parseRatio(text) !== null
    if (!usable) out.push(s.rowIndex + 1)
  })
  return out.sort((a, b) => a - b)
}

/* ── 烧结尺寸表(60 行模具↔炭棒内外径公差对照,表 rd_sinter_tolerance)──────────────── */

/**
 * 「长度范围」文本 → [下限, 上限]。
 * 设计源有 3 行脏值(`1#车间不封底10-300 ⏎4#车间封底200-220`、两行带 `（只可做低精度）`),
 * 按 §12.4 的口径**原样存库**,解析时只取前段 `NNN-NNN`(取不到就不提示,不猜)。
 */
export function parseLengthRange(text) {
  const m = String(text ?? '').match(/(\d+)\s*-\s*(\d+)/)
  if (!m) return null
  const a = Number(m[1]); const b = Number(m[2])
  return a <= b ? [a, b] : [b, a]
}

/**
 * 档案面板查询结果 → 行数组。
 * ⚠ 档案面板返回**主从结构**(list[0].detail.items[]),平铺数组也兜住;停用的行剔除 ——
 * 否则工艺员会在弹窗里选到一个已经停用的模具。
 */
export function sinterRowsFromQuery(data) {
  const d = (data && data.data !== undefined) ? data.data : data
  const list = Array.isArray(d) ? d : (d?.list || d?.rows || [])
  const rows = []
  list.forEach((m) => {
    const items = m?.detail?.items || m?.detail?.children
    if (Array.isArray(items)) rows.push(...items)
    else if (m && typeof m === 'object') rows.push(m)
  })
  const isOff = (v) => v === true || v === 1 || v === '1' || v === 'Y' || v === '是' || String(v ?? '').trim() === 'True'
  return rows.filter((r) => !isOff(r['停用']))
}

/** 按车间挑行:表里 `1/3` 这种写法表示两个车间共用该型号,所以按 '/' 拆开匹配 */
export function sinterRowsForWorkshop(rows, workshop) {
  const w = String(workshop ?? '').trim()
  if (!w) return rows || []
  return (rows || []).filter((r) => String(r?.['车间'] ?? '').split('/').map((s) => s.trim()).includes(w))
}

/** 选中行 → 引擎要的外径/内径(取不到给 null,交给 paramsFromHead 回退单据) */
export function sinterParams(row) {
  const toNum = (k) => {
    const v = Number(String(row?.[k] ?? '').trim())
    return Number.isFinite(v) ? v : null
  }
  return { od: toNum('炭棒外径'), id: toNum('炭棒内径') }
}

/** 选中行 → 页 1「检验要求 · 炭棒尺寸」四格(设计口径:炭棒尺寸引用模具尺寸表) */
export function sinterPatch(row) {
  const pick = (k) => String(row?.[k] ?? '').trim()
  return { 外径mm: pick('炭棒外径'), 外径公差: pick('炭棒外径公差'), 内径mm: pick('炭棒内径'), 内径公差: pick('炭棒内径公差') }
}

/** 文本 → 数字(空/非数字给 null,别把 null 当 0 比) */
function numOf(v) {
  const s = String(v ?? '').trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * 按外径/内径在烧结尺寸表里找型号(「按产品规格一键带出」用它自动选中型号)。
 * 口径:
 *   · 先只看**正好等于单据车间**的行;没有再用 sinterRowsForWorkshop(把 `1/3` 这类共用行按 / 拆开);
 *   · 该车间里没有这个规格就返回 '' —— **不跨车间乱选**(选错车间等于选错模具);
 *   · 命中多行也返回 ''(宁可让人手选,也不猜)。
 * @returns {string} 型号(带括号说明的原样文本),没匹配到给 ''
 */
export function matchSinterModel(rows, workshop, od, id) {
  const w = String(workshop ?? '').trim()
  const list = rows || []
  const odN = numOf(od)
  const idN = numOf(id)
  if (odN === null || idN === null) return ''
  const exact = w ? list.filter((r) => String(r?.['车间'] ?? '').trim() === w) : []
  const pool = exact.length ? exact : (w ? sinterRowsForWorkshop(list, w) : list)
  const hit = pool.filter((r) => numOf(r?.['炭棒外径']) === odN && numOf(r?.['炭棒内径']) === idN)
  return hit.length === 1 ? String(hit[0]?.['型号'] ?? '').trim() : ''
}

/**
 * 一张单据表头里的密度范围:上下限优先,只有「密度管控要求」文本时按 parseDensityRange 解析。
 * 解析口径只此一处(带出/带出历史筛选/校验都走它),免得两处规则漂移。
 * @returns {{low: string, high: string}|null} 取不到给 null(不猜)
 */
export function densityOf(row) {
  let low = String(row?.['实际密度管控下限'] ?? '').trim()
  let high = String(row?.['实际密度管控上限'] ?? '').trim()
  if (!low || !high) {
    const range = parseDensityRange(row?.['密度管控要求'])
    if (range) { low = String(range[0]); high = String(range[1]) }
  }
  return low && high ? { low, high } : null
}

/**
 * 「按产品规格一键带出」:产品信息行 + 该产品最近一张已保存单据 → 页 1 该补的格。
 *
 * 数据来源(都不编造,取不到就如实报 missing):
 *   · 炭棒规格 1/2/3(外径/内径/长度)← 产品信息表 RD_PROD_INFO 的 炭棒外径/炭棒内径/炭棒长度;
 *   · 密度上下限 ← 该产品最近一张成型工艺清单(densityOf:上下限,或解析「密度管控要求」文本)。
 *
 * 硬口径:**只填空格**。工艺员已经填过的格一律不动,值不同则记进 skipped 交给界面提示
 * (静默覆盖等于偷偷改掉人已确认的工艺参数)。
 *
 * @param {{[k:string]: any}|null} product 产品信息行(可为 null/{}:取不到)
 * @param {{[k:string]: any}|null} history 该产品最近一张单据的表头行(可为 null)
 * @param {{[k:string]: any}|null} head 当前单据表头
 * @returns {{patch: Record<string,string>, skipped: string[], missing: string[]}}
 */
export function specCarryFrom(product, history, head) {
  const h = head || {}
  const p = product || {}
  const patch = {}
  const skipped = []
  const missing = []
  const put = (key, val) => {
    const v = String(val ?? '').trim()
    if (!v) return
    const old = String(h[key] ?? '').trim()
    if (old) { if (old !== v) skipped.push(key); return }
    patch[key] = v
  }

  const specs = [['炭棒规格1', p['炭棒外径']], ['炭棒规格2', p['炭棒内径']], ['炭棒规格3', p['炭棒长度']]]
  if (specs.some(([, v]) => String(v ?? '').trim())) specs.forEach(([k, v]) => put(k, v))
  else missing.push('炭棒规格')

  const dens = densityOf(history)
  if (dens) {
    put('实际密度管控下限', dens.low)
    put('实际密度管控上限', dens.high)
  } else missing.push('密度')

  return { patch, skipped, missing }
}

/** 长度越界提示(设计源的「长度范围」就是干这个的);解析不出范围或长度不可数则不提示 */
export function sinterLengthWarning(row, length) {
  const range = parseLengthRange(row?.['长度范围'])
  const len = Number(length)
  if (!range || !Number.isFinite(len)) return null
  if (len > range[1]) return `长度 ${len} 超过该模具的可做范围 ${range[0]}-${range[1]}`
  if (len < range[0]) return `长度 ${len} 小于该模具的可做范围 ${range[0]}-${range[1]}`
  return null
}

/**
 * 配方表里"有物料的行"数:物料编号/物料名称/物料种类任一非空才算数。
 * 整行空白的行不算(明细表格天生会留空行),否则"0 行"这道闸永远拦不住。
 */
export function materialRowCount(rows) {
  const keys = ['物料编号', '物料名称', '物料种类']
  return (Array.isArray(rows) ? rows : []).filter((r) => keys.some((k) => String(r?.[k] ?? '').trim())).length
}

/** 引擎入参:尺寸/密度读单据,工艺参数来自参数集(弹窗传入) */
export function paramsFromHead(head, overrides = {}, rows) {
  const h = head || {}
  const pick = (parse, ...keys) => {
    for (const k of keys) {
      const v = parse(h[k])
      if (v !== null) return v
    }
    return null
  }
  // 尺寸优先取弹窗里选中的烧结尺寸行(表 rd_sinter_tolerance),没选才回退单据上的炭棒规格/外径内径。
  // 炭棒规格格是「选产品编号」带出的**带前缀**文本(`外：56.5`),故走 parseSpecNumber 而不是 parseNumber。
  const overOd = parseNumber(overrides.od)
  const overId = parseNumber(overrides.id)
  const od = overOd !== null ? overOd : pick(parseSpecNumber, '炭棒规格1', '外径mm')
  const id = overId !== null ? overId : pick(parseSpecNumber, '炭棒规格2', '内径mm')
  const length = pick(parseSpecNumber, '炭棒规格3')
  let densityLow = pick(parseNumber, '实际密度管控下限')
  let densityHigh = pick(parseNumber, '实际密度管控上限')
  if (densityLow === null || densityHigh === null) {
    const range = parseDensityRange(h['密度管控要求'])
    if (range) {
      if (densityLow === null) densityLow = range[0]
      if (densityHigh === null) densityHigh = range[1]
    }
  }

  const missing = []
  // 配方行一行物料都没有 ⇒ 引擎拿到的全是空料位,算出来的比例/克重毫无意义
  // (实测:照算照回填,页 1 十一格全来自"料位 1 补差=100%",看着像算成功了)。
  // 与"缺外径/内径/长度/密度"同级阻断 —— 这是唯一没有歧义的拦法(调用方必须显式传 rows 才做这项校验;
  // 2026-10-15 起配方计算弹窗传的是**弹窗里那份物料行**,与页 2 有没有行无关)。
  if (Array.isArray(rows) && materialRowCount(rows) === 0) missing.push(NO_RECIPE_ROWS)
  if (od === null) missing.push('外径')
  if (id === null) missing.push('内径')
  if (length === null) missing.push('长度')
  if (densityLow === null) missing.push('密度下限')
  if (densityHigh === null) missing.push('密度上限')

  const params = {
    od,
    id,
    length,
    cavities: Number(overrides.cavities ?? 1),
    density_low: densityLow,
    density_high: densityHigh,
    conversion_ratio: Number(overrides.conversion_ratio ?? 0.5),
    length_tol_low: Number(overrides.length_tol_low ?? DEFAULT_LENGTH_TOL),
    length_tol_high: Number(overrides.length_tol_high ?? DEFAULT_LENGTH_TOL),
    demold_low_factor: Number(overrides.demold_low_factor ?? 1),
    demold_high_factor: Number(overrides.demold_high_factor ?? 1),
  }
  return { params, missing }
}

/** 位数口径(照《炭棒BOM及工艺信息表单需求设计内容》):灌料/脱模/长度 1 位,水分 2 位,比例 2 位带 % */
const fixed = (x, digits) => (Number.isFinite(x) ? x.toFixed(digits) : '')

/**
 * 把物料档案里的含水率(bs_inv.水分含量,小数)并进弹窗输入。
 * 口径:只有粉料位的含水率参与计算(胶粉/折算料不进公式),所以只填粉料位;
 * **用户手改过的格不许被覆盖**(touched 下标),档案没有的物料编号记进 missingCodes 让人手填。
 * @returns {{values: string[], filledSlots: number[], missingCodes: string[]}} values 是百分数字符串(与输入框同单位)
 */
export function applyArchiveMoisture(slots, current, touched, archiveByCode) {
  const values = Array.isArray(current) ? current.slice() : []
  while (values.length < SLOT_COUNT) values.push('')
  const touchedSet = new Set(touched || [])
  const archive = archiveByCode || {}
  const filledSlots = []
  const missingCodes = []
  slots.slice(0, SLOT_COUNT).forEach((s, i) => {
    if (s.group !== SLOT_GROUPS.POWDER || !s.code) return
    if (touchedSet.has(i)) return
    const hit = archive[s.code]
    if (hit === undefined || hit === null) { missingCodes.push(s.code); return }
    const pct = Number(hit) * 100
    if (!Number.isFinite(pct)) { missingCodes.push(s.code); return }
    // 去掉多余的 0:0.06 → '6'、0.055 → '5.5'(与输入框的人读习惯一致)
    values[i] = String(Number(pct.toFixed(2)))
    filledSlots.push(s.slot)
  })
  return { values, filledSlots, missingCodes }
}

/** 引擎结果 → 回填补丁(只含有行或有值的料位;空料位不产生行补丁)
 *  extraHead:额外要写的头字段(如烧结尺寸表带出的外径mm/外径公差/内径mm/内径公差);
 *  **引擎算出来的项优先**,extraHead 只补它没有的键 —— 免得外部传错键把算好的值覆盖掉。 */
export function buildPatch(result, slots, extraHead) {
  const p = result.params
  const head = { ...(extraHead || {}) }
  const engineHead = {
    理论最低灌料重量g: fixed(result.pour_weights.low, 1),    理论灌料中间值g: fixed(result.pour_weights.std, 1),
    理论最高灌料重量g: fixed(result.pour_weights.high, 1),
    理论水分: fixed(result.moisture.powder_avg * 100, 2),
    最短长度mm: fixed(result.lengths.low, 1),
    中间值mm: fixed(result.lengths.std, 1),
    最长长度mm: fixed(result.lengths.high, 1),
    最低重量g: fixed(result.demold.low, 1),
    中间值g: fixed(result.demold.mid, 1),
    最高重量g: fixed(result.demold.high, 1),
    实际密度管控下限: fixed(p.density_low, 2),
    实际密度管控上限: fixed(p.density_high, 2),
  }
  Object.assign(head, engineHead)   // 引擎算出来的项优先
  const rows = []
  slots.forEach((s, i) => {
    if (s.rowIndex < 0) return
    rows.push({
      rowIndex: s.rowIndex,
      code: s.code,
      实际添加比例: `${fixed(result.final_ratios[i] * 100, 2)}%`,
      单支物料含量: fixed(result.final_amounts[i], 2),
    })
  })
  return { head, rows }
}

/** 给引擎的料位数组(顺便把空料位补成合法对象) */
export function toEngineRecipe(slots) {
  const list = slots.slice(0, SLOT_COUNT)
  while (list.length < SLOT_COUNT) {
    list.push({ slot: list.length + 1, group: '', code: '', name: '', designRatio: 0, amountG: 0, moisture: null, rowIndex: -1 })
  }
  return list.map((s) => ({
    design_ratio: s.designRatio,
    amount_g: s.amountG,
    moisture: s.moisture,
  }))
}
