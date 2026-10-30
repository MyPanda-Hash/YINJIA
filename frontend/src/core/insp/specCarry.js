import { parseDimensionRequirement, parseRodSizeRequirement } from './dimensionSpec.js'
import { parseDropRequirement } from './dropSpec.js'
import { parseTestMethod } from './testParamSpec.js'

/**
 * 「自动填充规格书」的失败口径(出货检验计划表 RD_INSP_PLAN ← 规格书 RD_SPEC_DOC)。
 *
 * 用户口径(2026-09-21):
 *   「出货检验计划表检验方法按规格书自动填充/带入,避免重复选择。
 *     必须得规格书已经填写提交审批完才可以在选择产品编码时自动填充带入。」
 * 即:规格书没走完提交审批(草稿/审批中/…)时,**一个格都不许自动带入** ——
 * 拿未定稿的检验方法去填出货检验计划,等于把没批准的检验口径发到产线。
 *
 * 门禁在后端(权威):/api/px/specByProduct 只挑「已审核/已归档」的规格书,
 * 没挑到就返回 found:false + reason:'not_approved' + 是哪一张、什么状态;
 * 本模块只负责把那个 payload 翻成界面要说的人话口径(纯函数,有单测)。
 *
 * @param {{found?: boolean, reason?: string, 规格书编号?: string, 规格书状态?: string}|null} payload 后端返回值
 * @returns {null | {kind: 'not_approved'|'no_spec', specNo: string, status: string}} null = 拿得到规格书
 */
export function specCarryFailure(payload) {
  const p = payload || {}
  if (p.found) return null
  if (p.reason === 'not_approved') {
    return {
      kind: 'not_approved',
      specNo: String(p['规格书编号'] ?? '').trim(),
      status: String(p['规格书状态'] ?? '').trim(),
    }
  }
  return { kind: 'no_spec', specNo: '', status: '' }
}

/* ── 跨面板复用(2026-10-13):组装工艺清单「组装BOM表」← 规格书「1.关键物料列表」──────
   用户口径:「组装工艺清单的 BOM 表也是可以导入对应规格书的 1.关键物料列表,这个是需要规格书
   已经填写完并且通过审批才会导入对应的规格书的数据…如果规格书没有通过审批归档导致数据不能
   导入时,可以弹窗提示『规格书未进行填写,请规格书通过审批之后再试,或者自行填写』,
   在还没有提交审批之前都是可以尝试导入规格书数据的。」

   于是同一套「按产品编号取规格书 + 审批门禁 + 整表替换」被两条链共用,差异全部落在
   autoFillSpec 配置上(不配 = 出厂口径 = 出货检验计划表那条**已验收通过**的链,一个字节都不变):
     · endpoint      —— 打哪个端点(权限按承载面板校验:RD_INSP_PLAN / RD_ASM_PROC);
     · specSheetArea —— 取规格书哪个表区('检验要求' / '物料清单');
     · notApprovedTip—— 未审批时的提示文案;
     · specDrift     —— 是否参与「规格书变动」比对(false = 该链的明细不是检验项目,比了只会误报)。
   下面三个纯函数就是这三处差异的唯一出口,组件不再自己拼 URL/文案(可单测)。 */

/** 出货检验计划表那条**已验收通过**的未审批提示(2026-09-21 用户口径)—— 缺省文案,不许改字 */
export const DEFAULT_NOT_APPROVED_TIP = '该产品的规格书 {no} 还没填写提交审批完（当前：{st}），暂不能自动带入 —— 请先在规格书里填好并走完提交审批'

/** 未审批提示的模板:面板配了 notApprovedTip 就用自己的措辞,否则用例(出货检验计划表) */
export function specNotApprovedTip(afs) {
  const t = String(afs?.notApprovedTip ?? '').trim()
  return t || DEFAULT_NOT_APPROVED_TIP
}

/**
 * 取规格书的请求(端点 + 查询参数)。
 * ⚠ 没配 specSheetArea 时**不带** sheetArea 参数 —— 出货检验计划表那条链的请求与改造前逐字相同
 *   (后端缺省取 '检验要求' 表区)。
 * @returns {{url: string, params: {code: string, sheetArea?: string}}}
 */
export function specCarryRequest(code, afs) {
  const url = String(afs?.endpoint ?? '').trim() || '/px/specByProduct'
  const params = { code: String(code ?? '').trim() }
  const area = String(afs?.specSheetArea ?? '').trim()
  if (area) params.sheetArea = area
  return { url, params }
}

/** 该链是否参与「规格书变动」比对(只有检验项目那类明细可比;显式 false 才关) */
export function specDriftEnabled(afs) {
  return afs?.specDrift !== false
}

/* ── 表头格 ← 规格书明细,按「检验项目」名匹配(成型工艺清单 A4)──────────────────────
   用户口径(2026-10-15 实测反馈,推翻上一版的"块名下方只读显示"):
     「规格书的检验要求数据应该是填在成型工艺清单的**表格内的要求、强度要求、压降标准**里面的」
     「如果是尺寸,应该是把对应检测的内径或者外径的公差等数据填写进成型工艺清单的对应检测要求
       里面的数据表格里面」
   即落点是**真实数据格**,映射写在 autoFillSpec.headFromDetail:
     规格书 · 检验项目      成型工艺清单 · 检验要求区
       跌落(强度组的跌落行)→  跌落要求 / 跌落高度cm / 跌落次数(**整句解析**,见 dropSpec.js)
       抗压强度      →       强度要求kgf
       压降          →       压降标准kpa
       炭棒尺寸      →       外径mm / 外径公差 / 内径mm / 内径公差(**整句解析**,见 dimensionSpec.js)

   2026-10-16 报障修正(用户截图:炭棒尺寸/压降/抗压强度 三块全空):
     规格书那张纸上的项目名是 **`<组名>·<子项名>` 且带 `*`/`#` 装饰**(实测 SD-2026-10-0010:
     `#*压降` / `*炭棒尺寸`(外径/内径/长度**每行一条**) / `强度·*抗压强度` / `强度·（裸棒）`),
     而配置里写的是裸名 ⇒ 精确相等一个都匹配不上。现在匹配按三步容错:
       ① 去掉全部空白与 `*`/`#`(全角也认);
       ② 按 `·` 拆 组名/子项名,两边都算命中;
       ③ 配置名是项目名的**子串**也算命中('抗压强度' ⊂ '强度*抗压强度')。
     匹配优先级:整串相等 → 组名/子项相等 → 子串包含;同一候选取**最好那一档**的全部行。
     ⚠ 尺寸那条**只认「炭棒尺寸」**,不拿 '尺寸' 当子串兜底 —— 规格书里还有
       `*整体尺寸(外包无纺布)`(46±0.5,是组装后的滤芯尺寸),拿它填炭棒尺寸就是静默错数。

   ⚠ 与出货检验计划表那条链的差别:那边是「整表替换明细」,这里只写**表头格**。 */

/** headFromDetail 里认的**解析器**名(落点不是一个格,而是把整句解析成多个格);新增解析器在此登记 */
const DETAIL_PARSERS = {
  dimension: parseDimensionRequirement,
  drop: parseDropRequirement,
  // 「检验方法」里那几个测试参数(测试间距mm/压头下降速度/压降测试流速)—— 与上面两个的区别是
  // **取哪一列**由映射项的 `from` 指定(默认 检验要求,这里写 from:'检验方法')
  testParams: parseTestMethod,
  // X烧结工艺清单(RD_X_SINTER)专用:同一句尺寸落到 炭棒外径/炭棒内径/炭棒出货长度 三格
  // (要长度、不要公差;格名与成型工艺清单不同,故单开一个解析器,见 dimensionSpec 的说明)
  rodSize: parseRodSizeRequirement,
}

/** 项目名归一:去掉**全部空白**与 `*`/`#` 装饰(含全角 ＊＃) */
function normProject(v) {
  return String(v ?? '').replace(/\s+/g, '').replace(/[*#＊＃]/g, '')
}

/**
 * 规格书的项目名 → **要写进下游面板**的名字(2026-10-16 用户选 A:
 *   「只规范带下去的名字(`强度·*抗压强度` → `*抗压强度`),不碰标准库与历史单据」)。
 *
 * 判定是**有条件**的 —— 组名有时是真信息,一律砍掉会出歧义:
 *   · `强度·*抗压强度`      → `*抗压强度`(组名已被子项名包含:强度 ⊂ 抗压强度 ⇒ 冗余);
 *   · `*余氯去除性能·初始去除率` → **原样**(砍掉只剩「初始去除率」,看不出测的是哪个物质);
 *   · `强度·（裸棒）`        → **原样**(子项是括号补语,脱离组名不成词);
 *   · 没有 `·` 的名字(`*炭棒尺寸` / `#*压降`)→ **原样**(一个字节都不动)。
 * `*`/`#` 是必检标记,一律保留(下游面板自己的标准库也是 `*外观` / `*压降测试` 这么命名的)。
 *
 * @param {*} v 规格书明细的 检验项目
 * @returns {string} 带下去的名字(空值给空串)
 */
export function carryProjectName(v) {
  const raw = String(v ?? '').trim()
  if (!raw) return ''
  const i = raw.indexOf('·')
  if (i < 0) return raw
  const group = raw.slice(0, i).trim()
  const sub = raw.slice(i + 1).trim()
  if (!group || !sub) return raw
  if (/^[（(]/.test(sub)) return raw
  return normProject(sub).includes(normProject(group)) ? sub : raw
}

/** 明细落点里可声明的**名字归一**器(与 DETAIL_PARSERS 同一套注册口径;新增在此登记) */
const NAME_NORMS = { projectName: carryProjectName }

/** 项目名的三个可比形态:整串 / 组名(`·` 前)/ 子项名(`·` 后) */
function projectNames(v) {
  const full = normProject(v)
  const i = full.indexOf('·')
  return { full, group: i > 0 ? full.slice(0, i) : full, sub: i >= 0 ? full.slice(i + 1) : '' }
}

/** 配置里的候选名:字符串或数组(数组按优先级) */
function candidatesOf(m) {
  const raw = Array.isArray(m?.matchProject) ? m.matchProject : [m?.matchProject]
  return raw.map(normProject).filter(Boolean)
}

/**
 * 按一个候选名找匹配的规格书行(**保序**;尺寸那类"一行一条"的项会命中多行)。
 * 分档:0 整串相等 / 1 组名或子项相等 / 2 子串包含 —— 取命中最靠前的那一档,不再混档。
 */
function matchRows(rows, cand) {
  let bestRank = 99
  const best = []
  for (const r of rows) {
    const p = projectNames(r?.['检验项目'])
    if (!p.full) continue
    let rank = -1
    if (p.full === cand) rank = 0
    else if (p.group === cand || p.sub === cand) rank = 1
    else if (p.full.includes(cand)) rank = 2
    if (rank < 0) continue
    if (rank < bestRank) { bestRank = rank; best.length = 0 }
    if (rank === bestRank) best.push(r)
  }
  return best
}

/**
 * 规格书明细行 → 表头格的值。
 *
 * @param {{headFromDetail?: Array<{to?: string, parse?: string, matchProject: string|string[]}>}|null} afs 「自动填充规格书」配置
 * @param {Array<Record<string, any>>|null} items 规格书明细行(键 = RD_SPEC_DOC 的字段 label)
 * @returns {Record<string, string>} **只含真取到的格**的 { 本面板字段label: 值 };
 *   某个 检验项目 在规格书里没有对应行(或那行 检验要求 为空、解析不出) = **该键不出现** ——
 *   调用方按条目写 head 即可,没取到的那一格保持不动(不清空、也不写空串)。
 */
export function headFromSpecDetail(afs, items) {
  const out = {}
  const maps = afs?.headFromDetail
  if (!Array.isArray(maps) || !maps.length) return out
  const rows = Array.isArray(items) ? items : []
  for (const m of maps) {
    const cands = candidatesOf(m)
    if (!cands.length) continue
    // 候选按优先级:前一个候选一个行都没命中,才轮到下一个
    let hitRows = []
    for (const cand of cands) {
      hitRows = matchRows(rows, cand)
      if (hitRows.length) break
    }
    if (!hitRows.length) continue
    // 整句解析型落点(尺寸/跌落/测试参数):解析器自己保证"只吐真解析出来的格" —— 解析不出就是不写;
    // 多行(尺寸每行一条)按行序合并,后面的行补齐前面的行没解析出来的格;
    // 取哪一列由 `from` 指定(默认 检验要求;测试参数那几格在**检验方法**里)
    const parse = String(m?.parse ?? '').trim()
    if (parse) {
      const fn = DETAIL_PARSERS[parse]
      if (!fn) continue
      const srcKey = String(m?.from ?? '').trim() || '检验要求'
      for (const r of hitRows) {
        const val = String(r?.[srcKey] ?? '').trim()
        if (val) Object.assign(out, fn(val))
      }
      continue
    }
    const to = String(m?.to ?? '').trim()
    if (!to) continue
    const srcKey = String(m?.from ?? '').trim() || '检验要求'
    const val = hitRows.map((r) => String(r?.[srcKey] ?? '').trim()).find((v) => v) || ''
    if (val) out[to] = val
  }
  return out
}

/**
 * autoFillSpec.detail(整表替换型落点:出货检验计划表/组装BOM表)的行构造。
 *
 * ⚠ 2026-10-16 增补 `indexWhenEmpty`(用户报障「出货检验记录表前面缺失序号」):
 *   规格书明细的 `序号` **不落库** —— 那张纸上的序号是渲染时按组现算的(实测 rd_spec_doc_detail.序号
 *   全 NULL),所以 `{to:'序号', from:'序号'}` 带过去永远是空串,计划表左侧那一列整列空白。
 *   口径:声明了 indexWhenEmpty 的落点,源值为空时兜底 ——
 *     · `'group'`(现用)= **组号**:同一个检验项目(afs.detailGroupFrom 那列按 `·` 前段分组)同号,
 *       与规格书那张纸的序号完全一致(炭棒尺寸 三行 = 3,3,3);
 *     · `true` / `'row'` = 行号 1..N。
 *   规格书自己带了序号就用它自己的(不覆盖已落库的值)。
 *
 * @param {{detail?: Array<{to: string, from: string, indexWhenEmpty?: boolean}>}|null} afs 配置
 * @param {Array<Record<string, any>>|null} srcRows 规格书本表区的行(payload.items)
 * @returns {Array<Record<string, string>>} 明细行(键 = 本面板字段 label;一行一条、保序)
 */
export function detailRowsOf(afs, srcRows) {
  const maps = Array.isArray(afs?.detail) ? afs.detail : []
  const rows = Array.isArray(srcRows) ? srcRows : []
  // 组号兜底(indexWhenEmpty:'group')用的分组:该列(afs.detailGroupFrom)按「首次出现次序」编号 ——
  // 与规格书那张纸的序号**同一口径**(一个检验项目一个号,子项共享:炭棒尺寸 三行 = 3,3,3)。
  // 分组键 = 去装饰/去空白后 `·` 之前那一段(`强度·（裸棒）` 与 `强度·*抗压强度` 同组)。
  const groupCol = String(afs?.detailGroupFrom ?? '').trim()
  const groupNo = new Map()
  if (groupCol) {
    for (const r of rows) {
      const k = normProject(r?.[groupCol]).split('·')[0]
      if (k && !groupNo.has(k)) groupNo.set(k, groupNo.size + 1)
    }
  }
  const groupKeyOf = (r) => normProject(r?.[groupCol]).split('·')[0]
  return rows.map((r, i) => {
    const row = {}
    for (const m of maps) {
      const to = String(m?.to ?? '').trim()
      if (!to) continue
      const raw = r?.[m?.from]
      let v = raw === undefined || raw === null ? '' : String(raw)
      if (!v.trim() && m?.indexWhenEmpty) {
        v = m.indexWhenEmpty === 'group'
          ? String(groupNo.get(groupKeyOf(r)) || '')
          : String(i + 1)
      }
      // 名字归一(可选):如 projectName —— 把规格书的「组名·子项名」规范成带下去的名字,
      // 认不出来的归一名字 ⇒ 原样写(不静默吞掉值)
      const normName = String(m?.norm ?? '').trim()
      if (normName && v.trim()) {
        const fn = NAME_NORMS[normName]
        if (fn) v = fn(v)
      }
      row[to] = v
    }
    return row
  })
}

/**
 * 明细落点取哪一段行:规格书**本表区**的行(后端把该表区的行放在 payload.items)。
 *
 * ⚠ 2026-10-15:原有一个 `detailSource` 分支(成型工艺清单的配方表 ← payload['物料清单'] 表区),
 *   随用户口径变更撤掉 —— 「配方表的数据是在配方计算器里面填写数据然后填入单据的,
 *   而不是带入的规格书的」(配方行改在配方计算弹窗里录,见 core/mold/recipeRows.js)。
 *   剩下的三链表(出货检验计划表/组装BOM表/成型工艺清单的检验要求)取的都是 payload.items,
 *   故这里只剩来回结构 + 非数组兜底;**不再有第二个取数源**。
 *
 * @param {{items?: Array}|null} payload 后端 /px/specByProduct* 的返回
 * @returns {Array<Record<string, any>>} items 不是数组一律空数组(不猜)
 */
export function specCarryRows(payload) {
  return Array.isArray(payload?.items) ? payload.items : []
}


/**
 * 归一:去掉**所有**空白(含换行)。
 * 口径理由:检验要求/检验方法里的换行与空格是排版差异(「目视检查」写成「目视 检查」、
 * 「≤5 kPa」写成「≤5kPa」),工艺员不认为这是规格书变动;为它弹"规格书已变动"是假告警,
 * 会让提示失去可信度。反过来真改字(≤5→≤6、目视→仪器)仍然会被抓到。
 */
const norm = (v) => String(v ?? '').replace(/\s+/g, '')

/**
 * 出货检验计划表「当前内容」vs「规格书」的差异 —— 「规格书变动就提示」的判据。
 *
 * 用户口径(2026-09-21):「出货检验根据规格书进行录入,检验项根据规格书一致,能自动填入,
 *   规格书变动就提示当前出货检验进行提示。」
 * 实现口径:**只比内容,不比单号** —— 这样"同一张规格书改了内容"和"出了新版本规格书"两种情况
 * 都能提示到(系统里规格书改版本来就是新建一张单据 + 版本号,只比单号会漏)。
 * 对齐键 = 检验项目名(本单字段叫 控制项目,纸面都显示"检验项目");
 * 逐项比 检验要求 与 检验方法(本单 控制标准及要求 / 控制方法)。
 *
 * @param {Array<{检验项目?: string, 检验要求?: string, 检验方法?: string}>|null} specRows 规格书「检验要求」行
 * @param {Array<Record<string, any>>|null} planRows 本单明细行(键用本面板字段名)
 * @returns {{added: string[], removed: string[], changed: Array<{item: string, fields: string[]}>, drifted: boolean}}
 */
export function specDrift(specRows, planRows) {
  const empty = { added: [], removed: [], changed: [], drifted: false }
  // 对齐键 = `组名·子项名` 的**末段**(归一后取最后一个 · 之后)——
  // 2026-10-16:带下去的名字会被 carryProjectName 规范成 `*抗压强度`(去冗余组名前缀),
  // 而规格书上仍是 `强度·*抗压强度`、改名前落库的行也是整串 ⇒ 三种形态必须算同一个检验项目,
  // 否则一进页面就误报"规格书已变动"。
  const keyOf = (v) => norm(v).split('·').pop()
  const pick = (item, req, method) => ({ item: norm(item), key: keyOf(item), req: norm(req), method: norm(method) })
  const specs = (specRows || [])
    .map((r) => pick(r?.['检验项目'], r?.['检验要求'], r?.['检验方法']))
    .filter((r) => r.item && r.key)
  const plans = (planRows || [])
    .map((r) => pick(r?.['控制项目'], r?.['控制标准及要求'], r?.['控制方法']))
    .filter((r) => r.item && r.key)
  // 一边空:没有可比的内容(该走"没有可带入的规格书"那条提示,不在这里报"变动")
  if (!specs.length || !plans.length) return empty

  /* ⚠ 2026-10-16 修误报:规格书里**同一个检验项目名会出现多行** ——
     实测 SD-2026-10-0010:`*炭棒尺寸` 3 行(外径/内径/长度)、`*余氯去除性能·除余氯寿命` 2 行
     (寿命920L / 去除率≥50%)。旧实现用 Map 按名字对齐,**同名行互相盖掉**(只留最后一条),
     于是刚按规格书带完就弹「规格书已变动:…(检验要求)…」——实测就是这么误报的。
     现改为**按名字聚合两边的取值集合**(要求/方法各一个 Set),集合不同才算变动:
     同名多行、行序不同都不再误报;真改字(≤5→≤6、目视→仪器)照样抓得到;
     本表少了同名多行里的一行(集合缺一个取值)也算"与规格书不一致",照样提示。 */
  const byKey = (list) => {
    const m = new Map()
    for (const x of list) {
      if (!m.has(x.key)) m.set(x.key, { item: x.item, reqs: new Set(), methods: new Set() })
      const e = m.get(x.key)
      e.reqs.add(x.req)
      e.methods.add(x.method)
    }
    return m
  }
  const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x))
  const S = byKey(specs)
  const P = byKey(plans)
  const added = [...S.keys()].filter((k) => !P.has(k)).map((k) => S.get(k).item)
  const removed = [...P.keys()].filter((k) => !S.has(k)).map((k) => P.get(k).item)
  const changed = []
  for (const [k, s] of S) {
    const p = P.get(k)
    if (!p) continue
    const fields = []
    if (!sameSet(s.reqs, p.reqs)) fields.push('检验要求')
    if (!sameSet(s.methods, p.methods)) fields.push('检验方法')
    if (fields.length) changed.push({ item: s.item, fields })
  }
  return { added, removed, changed, drifted: added.length + removed.length + changed.length > 0 }
}
