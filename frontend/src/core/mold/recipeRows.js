/**
 * 配方计算弹窗的「物料行」编辑接线(纯函数,不碰 Vue;单测 recipeRows.test.js)。
 *
 * 用户口径变更(2026-10-15,原话):
 *   「成型工艺清单的配方表的数据是在**配方计算器里面填写数据然后填入单据**的,
 *     而不是带入的规格书的」;追问确认选择 = **弹窗里录物料行**。
 * 于是配方表的真源从"页 2 手填 / 规格书带出"变成"配方计算弹窗里这份行":
 *   · 弹窗打开时把页 2 已有的行**带进来接着编**(页 2 空就从零加)—— 见 editRowsFrom;
 *   · 算完点「填入单据」时把这份行**整表写回**页 2 配方表 —— 见 buildRecipeRows;
 *   · 两道输入闸(NO_RECIPE_ROWS 阻断 / 未填设计添加量告警)的判据跟着**这份行**走
 *     (它们本来就只看传进去的数组,见 recipeSheet.js)。
 *
 * 键一律用单据页 2 配方表的**原始中文数据键**:一行数据两种视图,不另立一套键 ——
 * 另立一套就要在两边翻译,漏一个键就是静默丢值。
 */
import { MATERIAL_KINDS } from './materialKinds.js'

/** 弹窗里可录入的四个输入格(其余列:序号自动编,实际添加比例/单支物料含量是算出来的) */
export const RECIPE_INPUT_KEYS = ['物料种类', '物料编号', '物料名称', '设计添加量']

/** 一行空白编辑行(「加一行」用) */
export function blankRecipeRow() {
  return Object.fromEntries(RECIPE_INPUT_KEYS.map((k) => [k, '']))
}

/**
 * 页 2 配方表的行 → 弹窗编辑行(**拷贝**)。
 *
 * 为什么必须拷贝:弹窗里改的是"待写入的草稿",点「填入单据」才写回单据;
 * 直接引用单据行的话,用户点「取消」也改掉了单据(而且不触发 dirty)。
 * 行上的其它键(表区/序号/上一轮算出的两列)一并带过来 —— 写回时原样保留,
 * 「旧值 → 新值」的回填预览也才有旧值可显示。
 *
 * @param {Array<Record<string, any>>|null} rows 页 2 配方表的行(可为空 = 从零开始)
 * @returns {Array<Record<string, any>>} 编辑行(保序、键逐字相同)
 */
export function editRowsFrom(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => ({ ...blankRecipeRow(), ...(r || {}) }))
}

/** 这行算不算"有物料":物料种类/编号/名称任一非空(与 recipeSheet.materialRowCount 同一口径) */
function hasMaterial(row) {
  return RECIPE_INPUT_KEYS.slice(0, 3).some((k) => String(row?.[k] ?? '').trim() !== '')
}

/**
 * 弹窗里这份编辑行 + 引擎算出的两列 → **整表写回**页 2 配方表的行。
 *
 * 口径:
 *   · **整行空白**的行不写回(明细表天生会留空行;用户删剩的空行不该落库);
 *   · `序号` 按写回后的次序重排 1..N —— 与面板「加一行」的 autoSeqBar 口径一致
 *     (弹窗里能删行,沿用旧号会留断号);
 *   · 引擎算出的 `实际添加比例` / `单支物料含量` 按**行号**并回对应行
 *     (行号口径 = slotsFromRows 给 slot 的 rowIndex,就是这份编辑行的下标);
 *   · **没参与计算的行**(如超出料位容量被忽略)保留行上原来的两列值:行是用户录的数据,
 *     不是这次算出来的,宁可留上一次的值,也不写空/undefined;
 *   · 行上其它键(表区…)原样保留 —— 少了 `表区` 这行就不属于配方表了。
 *
 * @param {Array<Record<string, any>>|null} editRows 弹窗里的编辑行
 * @param {Array<{rowIndex: number, [k: string]: any}>|null} patchRows buildPatch(...).rows
 * @returns {Array<Record<string, any>>} 写回页 2 的行(可直接整表替换本表区)
 */
export function buildRecipeRows(editRows, patchRows) {
  const byIndex = new Map()
  for (const p of (Array.isArray(patchRows) ? patchRows : [])) {
    if (p && Number.isInteger(p.rowIndex)) byIndex.set(p.rowIndex, p)
  }
  const out = []
  ;(Array.isArray(editRows) ? editRows : []).forEach((r, i) => {
    const src = r || {}
    if (!hasMaterial(src)) return
    const row = { ...src, 序号: String(out.length + 1) }
    const hit = byIndex.get(i)
    if (hit) {
      row['实际添加比例'] = hit['实际添加比例']
      row['单支物料含量'] = hit['单支物料含量']
    }
    out.push(row)
  })
  return out
}

/**
 * 商品档案行 → 「物料编号」下拉的选项(2026-10-15 用户口径:「手打太慢了,应该是可以下拉选择商品里面的数据」)。
 *
 * 显示 `存货编码 — 名称`,值取 `存货编码`(写进单据的就是这个编码);保档案返回的原序(不在这里偷偷排序)。
 * 去重与丢弃都只按"这条档案行能不能选"来判:`存货编码` 空的行不是可选物料(下拉里会出现一个点不出值的空项);
 * 同编码多行只留第一条(下拉里两个同值项会让人以为选错了)。
 * ⚠ 这只是**候选**:控件同时开 allow-create,档案里没有的编码照样能手打 —— 下拉不许堵死例外情况。
 *
 * @param {Array<Record<string, any>>|null} rows 商品档案行(invCarry.invRowsOf 的产物)
 * @returns {Array<{value: string, label: string}>} el-select 的选项
 */
export function invOptionsOf(rows) {
  const out = []
  const seen = new Set()
  for (const r of (Array.isArray(rows) ? rows : [])) {
    const code = String(r?.['存货编码'] ?? '').trim()
    if (!code || seen.has(code)) continue
    seen.add(code)
    const name = String(r?.['存货名称'] ?? '').trim()
    out.push({ value: code, label: name ? `${code} — ${name}` : code })
  }
  return out
}

const norm = (v) => (v === null || v === undefined ? '' : String(v).trim())

/**
 * 按某个档案列在商品档案行里找**唯一**命中那一行(选中/手填一格后带出对侧值与种类的判据)。
 *
 * 为什么必须"唯一命中才认":后端 `condition` 对普通文本走 `LIKE %值%`(见 core/panel/invCarry.js 头注),
 * `M-001` 会把 `XM-001` 一起带回来(2026-10-15 实测:condition {存货编码:'M-001'} 回 2 行
 * —— YJ-HSM-001 与 M-001),所以**判等在本地按 trim 后全等收紧**;查到多条(重码/重名)同样谁也不认
 * —— 宁可不带,不带错(调用方据此保持用户输入不动、不清空、不弹错)。
 *
 * @param {Array<Record<string, any>>|null} rows 商品档案行(已 flatten 的,如 invRowsOf 的产物)
 * @param {string} key 比对的列(`存货编码` 或 `存货名称`)
 * @param {*} value 用户选中/手填的值
 * @returns {Record<string, any>|null} 唯一命中 ⇒ 该档案行;否则 null
 */
export function uniqueInvRowBy(rows, key, value) {
  const want = norm(value)
  if (!want || !Array.isArray(rows)) return null
  const hits = rows.filter((r) => norm(r?.[key]) === want)
  return hits.length === 1 ? hits[0] : null
}

/**
 * 按编码取唯一命中的档案行(等价 `uniqueInvRowBy(rows, '存货编码', code)`,保留原调用点与口径)。
 * @param {Array<Record<string, any>>|null} rows 商品档案行
 * @param {*} code 用户选中/手填的 物料编号
 * @returns {Record<string, any>|null} 唯一命中 ⇒ 该档案行;否则 null
 */
export function uniqueInvRowOf(rows, code) {
  return uniqueInvRowBy(rows, '存货编码', code)
}

/* ── 物料种类 = 前置筛选(2026-10-15 用户口径:「先通过前面的物料种类先进行一个筛选,
      方便后面的物料编码、物料名称的查找」)────────────────────────────────────────
   规模事实:本机两个账套 bs_inv 都是 **114 行**(实测),生产服务器**几千行**
   (`QueryService` 里 ARCH_LOAD_CAP 的注释记着 2026-09-16 已 3850 行)。
   所以候选**永远不一次性全拉全渲**:选了种类 ⇒ 只拉那一类;没选种类 ⇒ 打字才远程查。 */

/** 下拉一次最多渲染多少项 —— 与档案行数无关的硬上限(几千行不许一次性渲成 el-option) */
export const OPTION_CAP = 50

/**
 * 按「物料种类」把档案行收窄到**真的属于这一类**的行。
 *
 * ⚠ 服务端那层只当**收窄**:`QueryService.appendDirectFilters` 对普通文本字段走 `LIKE %值%`
 * (只有 dataType=参照 才等值),所以 `所属类别 = 功能料-粉末` 在服务端会把
 * 「功能料-粉末新」这类**含子串**的类别一起带回来(实测口径同 `condition {存货编码:'M-001'}` → 2 行)。
 * 因此这里必须再按 trim 后**全等**筛一遍 —— 服务端返回多少行,不构成判据。
 *
 * 未选种类(kind 空)**故意返回空数组**:未选种类时前端走的是 remote 搜索那条路,
 * 若这里退化成"返回全量",几千行就会顺着这个口子渲进下拉 —— 宁可空,不许全量。
 *
 * @param {Array<Record<string, any>>|null} rows 档案行(invRowsOf 的产物)
 * @param {string} kind 物料种类(引擎认的五个词之一,或用户手打的词)
 * @returns {Array<Record<string, any>>} 该种类的档案行(保原序)
 */
export function invRowsOfKind(rows, kind) {
  const want = norm(kind)
  if (!want || !Array.isArray(rows)) return []
  return rows.filter((r) => norm(r?.['所属类别']) === want)
}

/** 两格的取值列:物料编号格取 `存货编码`,物料名称格取 `存货名称`(互为反向) */
export const INV_SEARCH_FIELDS = {
  物料编号: { value: '存货编码', label: '存货编码' },
  物料名称: { value: '存货名称', label: '存货名称' },
}

/**
 * 「物料编号」/「物料名称」下拉的候选(纯函数;两格共用,只是取值列不同)。
 *
 * 口径:
 *   · 值 = 该格的列(编号格给 `存货编码`,名称格给 `存货名称`);
 *     编号格的显示是 `编码 — 名称`(与既有 invOptionsOf 一致),名称格显示名称本身;
 *   · 关键字**同时**匹配编码与名称、**大小写无关** —— 用户记不住编码只记得名字是常态,
 *     下拉里本来就显示着名称;后端 LIKE 实测同样大小写不敏感(`m-00` 与 `M-00` 都回 11 行),前端同口径;
 *   · 同一格取值相同的只留第一条(下拉里两个同值项会让人以为选错了);
 *   · **封顶 cap 项**,同时报 `matched` 总数 —— 界面据此提示"还有 N 条,继续输入缩小范围"。
 *     这是"几千行不许一次性渲染"的可测落点:渲染量只由 cap 决定,与档案行数无关。
 *
 * @param {Array<Record<string, any>>|null} rows 候选来源(某种类的缓存 或 远程搜索回来的那一小把)
 * @param {'物料编号'|'物料名称'} field 用户在搜哪一格
 * @param {string} keyword 用户敲进去的关键字(空 = 不过滤,给前 cap 项)
 * @param {number} [cap=OPTION_CAP] 最多返回几项
 * @returns {{options: Array<{value: string, label: string}>, matched: number}}
 */
export function invSearchOptions(rows, field, keyword, cap = OPTION_CAP) {
  const spec = INV_SEARCH_FIELDS[field]
  if (!spec || !Array.isArray(rows)) return { options: [], matched: 0 }
  const kw = norm(keyword).toLowerCase()
  const seen = new Set()
  const hits = []
  for (const r of rows) {
    const value = norm(r?.[spec.value])
    // 没有编码的档案行不是可录进单据的物料(编码才是身份):名称格也不放它进来 ——
    // 选中它连编号都回填不了,只会得到一行"有名字没编号"的配方行。
    if (!norm(r?.['存货编码']) || !value || seen.has(value)) continue
    if (kw) {
      const hay = `${norm(r?.['存货编码'])} ${norm(r?.['存货名称'])}`.toLowerCase()
      if (!hay.includes(kw)) continue
    }
    seen.add(value)
    const name = norm(r?.['存货名称'])
    hits.push({
      value,
      label: field === '物料名称' ? value : (name ? `${value} — ${name}` : value),
    })
  }
  const limit = Number.isInteger(cap) && cap > 0 ? cap : OPTION_CAP
  return { options: hits.slice(0, limit), matched: hits.length }
}

/**
 * 在下拉里挑中一格后,这一行**真正要改**的格(两格互为反向带出的**防打架**闸门)。
 *
 * 三条规矩(缺一条就会两格互触发):
 *   ① **被操作的那一格永不回写** —— 回写它就是"名称 change → 写名称 → 又触发 change"的起点;
 *   ② **值真的不同才写**(trim 后比)—— 同值再写一遍只会白触发一轮,定长列的尾空格还会来回写;
 *   ③ 档案取不到 / 类别不是引擎认的词 ⇒ 该格**不带**(与既有口径一致,不清空、不报错、不猜)。
 *
 * 两侧的"对侧格"语义**故意不对称**,理由写在各分支里:
 *   · 选**编号**:沿用 2026-10-15 既有口径(只补空格,人手填的名称不被档案覆盖)—— 有单测钉着;
 *   · 选**名称**:用户是按**名字**挑的物料 ⇒ 编号**必须**跟着走(留着旧编号 = 新名的料配旧编号,
 *     是静默错数),所以这一侧是"不同就覆盖"。
 *
 * @param {Record<string, any>|null} row 弹窗里的编辑行
 * @param {Record<string, any>|null} inv 唯一命中的档案行(取不到传 null)
 * @param {'物料编号'|'物料名称'} side 用户刚操作的那一格
 * @returns {Record<string, string>} 要写进该行的格(一个都不改给 {})
 */
export function materialFillFor(row, inv, side) {
  if (side === '物料编号') return invFillFor(row, inv)
  if (side !== '物料名称') return {}
  const out = {}
  const code = norm(inv?.['存货编码'])
  if (code && norm(row?.['物料编号']) !== code) out['物料编号'] = code
  const kind = norm(inv?.['所属类别'])
  if (kind && MATERIAL_KINDS.includes(kind) && !norm(row?.['物料种类'])) out['物料种类'] = kind
  return out
}

/**
 * 商品档案行 → 这行**还能补上**的格(填「物料编号」带出名称/种类;只补空格)。
 *
 * 数据源 = 既有档案查询(商品档案 INV,列 `存货编码`/`存货名称`/`所属类别`),
 * 不新开后端接口。两条硬规矩:
 *   · 已有值的格一律不动(人手填的优先);
 *   · `所属类别` 必须是**引擎认得的词**(MATERIAL_KINDS 口径;materialKinds.test.js 钉着
 *     "词表里每个词都被 groupOfMaterialType 认出来")才补 —— 档案里的 包装材料/辅助材料/成品
 *     这类配不上料位的词填进「物料种类」只会让引擎认不出来(暂按粉料算 + 弹窗告警),不如不补。
 *
 * @param {Record<string, any>|null} row 弹窗里的编辑行
 * @param {Record<string, any>|null} inv 商品档案行(取不到传 null)
 * @returns {Record<string, string>} 要写进该行的格(取不到任何值给 {})
 */
export function invFillFor(row, inv) {
  const out = {}
  const name = String(inv?.['存货名称'] ?? '').trim()
  if (name && !String(row?.['物料名称'] ?? '').trim()) out['物料名称'] = name
  const kind = String(inv?.['所属类别'] ?? '').trim()
  if (kind && MATERIAL_KINDS.includes(kind) && !String(row?.['物料种类'] ?? '').trim()) out['物料种类'] = kind
  return out
}
