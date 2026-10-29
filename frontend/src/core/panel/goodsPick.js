/**
 * goodsPick.js — 规格书「从商品引用」弹窗的纯逻辑(2026-10-21)
 *
 * 背景:规格书第 4 页「1.关键物料列表」原先是「从物料清单引用」(数据源 WLBOM)。
 * 用户口径(2026-10-21):「把引用的数据内容改为引用商品里面的数据,弹窗可以通过上面那些信息
 * 来索引数据,然后勾选填写进去,**每进行一个字段的填写,其他选项就可以对应的范围缩小**,
 * 方便查找」。
 *
 * 所以数据源换成「商品」面板(INV → bs_inv,实测 3917 行),弹窗顶部是商品列表的四列:
 * 所属类别 / 存货编码 / 存货名称 / 规格型号 —— 四栏互为对方的筛选项(级联收窄)。
 *
 * 抽成纯函数的原因:级联收窄 + 去重落行的规则最容易写错,而 .vue 里跑不了 node --test。
 */

/** 商品面板(INV)上与「关键物料列表」对应的四列 —— 既是筛选项,也是弹窗显示列 */
export const GOODS_FACETS = ['所属类别', '存货编码', '存货名称', '规格型号']

/** 每个筛选下拉最多给多少项(存货编码 3000+ 个,全量渲染 el-select 会明显卡) */
export const FACET_CAP = 300

/**
 * 从 `/px/queryFormDataList` 的返回里剥出商品行 —— **不在这里另写一份**:
 * 档案型面板(INV,mode=archive)的返回是「一张虚拟单」`{list:[{detail:{inv:[...]}}]}`,
 * 而明细键是 `yj_panel.detail_key`(= LOWER(panel_code),生产上是 `detail.inv`),
 * 本地空列时退化成 `items` —— 这份"三个键依次兜底"的规则已经踩过上线恒空的坑,
 * 统一走 invCarry.js 的 invRowsOf → detailRowsOf,别复制第二份。
 */

/** 去掉空值/纯空格的筛选条件(级联判定只认"真的填了"的字段) */
export function normFilters(filters) {
  const out = {}
  for (const [k, v] of Object.entries(filters || {})) {
    const s = String(v ?? '').trim()
    if (s) out[k] = s
  }
  return out
}

/**
 * 命中筛选的行(AND 语义,子串匹配、不区分大小写)。
 * @param {any[]} rows
 * @param {Record<string,string>} filters
 * @param {string} [excludeKey] 计算某一栏的候选值时,把它自己那一栏的条件排除掉
 */
export function matchGoods(rows, filters, excludeKey = '') {
  const f = normFilters(filters)
  const keys = Object.keys(f).filter((k) => k !== excludeKey)
  if (!keys.length) return Array.isArray(rows) ? rows.slice() : []
  return (Array.isArray(rows) ? rows : []).filter((r) =>
    keys.every((k) => String(r?.[k] ?? '').toLowerCase().includes(f[k].toLowerCase())))
}

/**
 * 某一栏的下拉候选值 —— **按其它三栏的当前条件收窄**(这就是用户要的"范围缩小")。
 * 本栏已选的值即使不在候选里也补在最前面,免得用户看不到自己选了什么。
 *
 * @returns {{ values: string[], more: number }} more = 超过 cap 被省略的项数
 */
export function facetValues(rows, key, filters, cap = FACET_CAP) {
  const pool = matchGoods(rows, filters, key)
  const set = new Set()
  for (const r of pool) {
    const v = String(r?.[key] ?? '').trim()
    if (v) set.add(v)
  }
  const values = Array.from(set).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const cur = String(normFilters(filters)[key] ?? '').trim()
  const rest = cur ? values.filter((v) => v !== cur) : values
  const head = cur ? [cur] : []
  const keep = rest.slice(0, Math.max(0, cap - head.length))
  return { values: head.concat(keep), more: rest.length - keep.length }
}

/**
 * 勾选的行 → 目标表要落的值(按目标表实际存在的列过滤,多余列不落)。
 * 映射(同一个商品列对不同目标表可能是不同名字,**按目标表的列名适配**):
 *   物料编码 / 物料编号 ← 存货编码
 *   物料名称           ← 存货名称
 *   规格参数 / 尺寸规格 ← 规格型号
 *   备注               ← 商品备注(有才带)
 * 同一物料编码已在本表区存在(或本次勾选里重复)时跳过 —— 重复点导入不会灌重复行。
 *
 * ⚠ 2026-10-29 扩两组别名:产品信息表新版「三、产品BOM表」的列叫 **物料编号 / 尺寸规格**
 *   (旧的两张表叫 物料编码 / 规格参数)。两套名字并存,靠"目标表里有哪个就落哪个"适配,
 *   不给调用方加分支、也不改既有两张表的落点。
 * ⚠ 数量**不在这里带**:商品档案没有用量口径,凭空填 1 会变成错误数据(口径同 2026-10-21)。
 *
 * @returns {{ rows: Array<Record<string,string>>, skipped: number }}
 */
export function goodsToDetail(checked, existingCodes = [], colKeys = []) {
  const cols = new Set(colKeys || [])
  const seen = new Set((existingCodes || []).map((c) => String(c ?? '').trim()).filter(Boolean))
  const out = []
  let skipped = 0
  for (const r of Array.isArray(checked) ? checked : []) {
    const code = String(r?.['存货编码'] ?? '').trim()
    if (!code) continue
    if (seen.has(code)) { skipped++; continue }
    seen.add(code)
    const spec = String(r?.['规格型号'] ?? '').trim()
    const row = {}
    if (cols.has('物料编码')) row['物料编码'] = code
    if (cols.has('物料编号')) row['物料编号'] = code
    if (cols.has('物料名称')) row['物料名称'] = String(r?.['存货名称'] ?? '').trim()
    if (cols.has('规格参数')) row['规格参数'] = spec
    if (cols.has('尺寸规格')) row['尺寸规格'] = spec
    if (cols.has('备注')) row['备注'] = String(r?.['备注'] ?? '').trim()
    out.push(row)
  }
  return { rows: out, skipped }
}
