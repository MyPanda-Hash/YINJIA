/**
 * docPreview.js —— 文书侧栏「单据预览查找」卡片的摘要字段口径（纯函数，无 Vue/无 IO）  2026-11-11
 *
 * 【用户口径（逐字）】
 *   「立项申请的单据预览做成和销售订单左侧栏类似，显示最主要的信息方便去查找对应单据」
 *   —— 参照物是「销售订单选择」左侧那张表：一行一张单，只看 单号 / 日期 / 客户 / 审核状态。
 *
 * 【为什么原来的卡片不好用】
 *   旧口径 = "表头前 4 个非空业务字段"，每格 `标签：值` 各占一行。
 *   立项申请那 4 格是 客户名 / 立项背景 / 机型及应用位置 / 滤芯炭棒规格或结构——
 *   后三个是长文本（截到 42 字还会折行）⇒ 一张卡片能占十行，十几张单就要滚好几屏，
 *   想找"某某客户那张"反而更难。参照物里一行只有**一个短摘要**，扫一眼就定位。
 *
 * 【现在的口径（两档，面板自己选）】
 *   · 指定了摘要字段的面板（见 PREVIEW_FIELDS）⇒ **只显示这几个**、不带标签、
 *     与日期同排成一行（`2026-11-10 · 零售客户`），卡片 = 两行；
 *   · 没指定的面板 ⇒ 沿用旧口径（前 4 个非空业务字段、带标签），行为与改前逐字一致。
 *   为什么不一刀切：别的面板（规格书/产品信息/检验计划）摘要格本来就短，
 *   一行一单反而看不出差异；只有长文本面板需要压。
 */

/** 摘要字段剔除清单：系统列与阶段明细列不进卡片 */
export const PREVIEW_SKIP = new Set([
  '单据编号', '编号', '单据日期', '单据状态', '文档编号', '文件管理人', '密级',
  '文件使用范围', '备注', '打印时间', '公司名称',
])

/**
 * 面板 → 摘要字段（按此顺序显示，不带标签）。没登记的面板走通用口径。
 * @type {Record<string, string[]>}
 */
export const PREVIEW_FIELDS = {
  // 立项申请：客户是"找单"的第一线索（参照销售订单左侧的"客户"列）；
  // 项目等级是分档用的短字段；申请立项人用来认"这张单是谁提的"（2026-11-11 用户追加
  // 「还要有申请立项人」）。其余（立项背景/机型/滤芯规格/开发目标…）都是长文本，
  // 扫列表时只会干扰。
  RD_APPROVAL: ['客户名', '项目等级', '申请立项人'],
  // 产品信息表（2026-11-12 用户口径「单据预览横向多列排布」）：
  //   改成浮层横向多列后，卡片**高度必须齐**才扫得快。原先走通用口径（前 4 个非空字段），
  //   而各单填的字段不一样 —— 实测 PI-2026-11-0002 出的是「编辑人 / 审核人（一级审批人）」，
  //   CP382 出的是「产品编号 / 项目编号 / 产品名称 / 产品功能类别」⇒ 卡片高矮不齐、列也错位。
  //   这里固定成三个"找单第一线索"：产品编号（找哪支产品）→ 产品名称（认得出是什么）
  //   → 客户名称（谁下的）。都是短字段，一行放得下。
  RD_PROD_INFO: ['产品编号', '产品名称', '客户名称'],
}

/** 摘要值截断长度（通用口径 42 字；指定字段的比较短，一行能放下） */
export const PREVIEW_VALUE_CAP = 42
export const PREVIEW_COMPACT_CAP = 18

/**
 * 一张卡片的摘要内容。
 *
 * @param {object} p
 * @param {Record<string, any>|null} p.row 单据行（表头键值）
 * @param {Array<{dataName?: string, code?: string}>} p.fields 表头字段定义（顺序即显示顺序）
 * @param {(f: any) => string} p.keyOf 字段定义 → 数据键
 * @param {string} p.panelCode 面板码
 * @param {number} [p.limit] 通用口径最多几个字段（默认 4，与改前一致）
 * @returns {{ compact: boolean, items: Array<{label: string, value: string}> }}
 *   compact=true 表示"指定了摘要字段"：items 不带标签，调用方按一行拼起来；
 *   compact=false 是旧口径：items 带标签、逐行显示。
 */
export function previewSummaryOf({ row, fields, keyOf, panelCode, limit = 4 }) {
  const r = row || {}
  const list = Array.isArray(fields) ? fields : []
  const key = (f) => (typeof keyOf === 'function' ? String(keyOf(f) || '') : String(f?.dataName || f?.code || ''))
  const textOf = (k) => {
    const v = r[k]
    if (v === null || v === undefined) return ''
    return String(v).replace(/\s+/g, ' ').trim()
  }

  const wanted = PREVIEW_FIELDS[panelCode]
  if (Array.isArray(wanted) && wanted.length) {
    const items = []
    for (const k of wanted) {
      const s = textOf(k)
      if (!s) continue
      items.push({ label: k, value: s.length > PREVIEW_COMPACT_CAP ? s.slice(0, PREVIEW_COMPACT_CAP) + '…' : s })
    }
    return { compact: true, items }
  }

  const out = []
  for (const f of list) {
    if (out.length >= limit) break
    const k = key(f)
    if (!k || PREVIEW_SKIP.has(k) || /^阶段\d+/.test(k)) continue
    const s = textOf(k)
    if (!s) continue
    out.push({ label: k, value: s.length > PREVIEW_VALUE_CAP ? s.slice(0, PREVIEW_VALUE_CAP) + '…' : s })
  }
  return { compact: false, items: out }
}

/**
 * 卡片的「一行摘要」文本（仅 compact 面板用）：`零售客户 · 重点`
 * @param {{items: Array<{value: string}>}} summary previewSummaryOf 的返回值
 * @returns {string}
 */
export function previewLineText(summary) {
  const items = Array.isArray(summary?.items) ? summary.items : []
  return items.map((x) => String(x?.value ?? '')).filter(Boolean).join(' · ')
}

/* ===== 立项申请「单据预览」的筛选口径 · 2026-11-17 =====
 *
 * 用户口径：「点击单据预览就根据申请立项人进行一个筛选全屏展示这些属于自己申请的单据的明细」。
 * 纯函数，页面只负责画 —— 与同文件其它口径一致。
 */

export const APPLICANT_KEY = '申请立项人'

/** 归一化：去首尾空白 + 转小写（中文不受影响） */
function norm(v) {
  return v === undefined || v === null ? '' : String(v).trim().toLowerCase()
}

/**
 * 归属人是否就是当前登录人。
 *
 * <p>除了全等，还要认**签署格「姓名/日期」**这一种：样品申请单的「申请」格实测存的是
 * `系统管理员/2026.11.6`（SPW-2026-11-0011），而登录人姓名是 `系统管理员` ⇒
 * 只做全等比较会让「只看我申请的」在这两张单上永远 0 条（2026-11-20 实测踩到）。
 * 取斜杠前那一段再比一次即可；其它面板的字段（申请立项人/编辑人/测试负责人…）值里没有斜杠，
 * 这一条对它们完全无影响。</p>
 */
function samePerson(owner, meName) {
  const a = norm(owner)
  const b = norm(meName)
  if (!a || !b) return false
  if (a === b) return true
  const head = a.split(/[\/／]/)[0].trim()
  return !!head && head === b
}

/**
 * 范围：mine = 该单的「归属人」=== 当前登录人；all = 不过滤。
 *
 * @param {string} [ownerKey] 归属人字段名。缺省 = 「申请立项人」（立项申请）；
 *   其它面板按 resolvePreviewOwnerKey 探测（产品信息=编辑人、样品单=申请、
 *   数据记录表=测试负责人…）；探不到时=发起人。
 *   2026-11-17：产品信息表接入同一套全屏预览时参数化，避免把两套判据写死。
 *   2026-11-20：研发管理全部面板接入，改为按面板探测（见 resolvePreviewOwnerKey）。
 */
export function inApplicantScope(row, me, scope, ownerKey = APPLICANT_KEY) {
  if (scope === 'all') return true
  const meName = norm(me)
  if (!meName) return false
  return samePerson(row && row[ownerKey], meName)
}

/**
 * 立项申请单据预览的筛选：范围（我的/全部）→ 关键字。
 *  - mine：申请立项人 === 当前登录人（去首尾空白）；申请人为空的单不算任何人的；
 *  - 登录人姓名为空时 mine 返回空（绝不退化成全量）；
 *  - all：不按人过滤（管理员/代查）；
 *  - 关键字在筛选结果内再收窄：单号 / 客户名 / 申请立项人，大小写无关。
 */
export function filterApprovalPreview(rows, opts) {
  const o = opts || {}
  const me = o.me || ''
  const scope = o.scope || 'mine'
  const kw = norm(o.keyword || '')
  // 2026-11-17 新增三个条件（用户口径：参考金蝶「商品列表」的顶部查询栏）
  const status = norm(o.status || '')     // 单据状态：'' = 不限
  const grade = norm(o.grade || '')       // 项目等级：'' = 不限
  const from = norm(o.dateFrom || '')     // 单据日期 >= from（yyyy-MM-dd，字符串比较即可）
  const to = norm(o.dateTo || '')         // 单据日期 <= to
  const ownerKey = o.ownerKey || APPLICANT_KEY
  const list = Array.isArray(rows) ? rows : []
  return list.filter(function (r) {
    if (!inApplicantScope(r, me, scope, ownerKey)) return false
    if (status && norm(r && r['单据状态']) !== status) return false
    if (grade && norm(r && r['项目等级']) !== grade) return false
    if (from || to) {
      const d = norm(r && r['单据日期'])
      if (!d) return false                      // 没日期的行在"按日期筛"时不参与
      if (from && d < from) return false
      if (to && d > to) return false
    }
    if (!kw) return true
    // 2026-11-19 销售问题汇总 P12：「需要能正常搜索查询」。
    //   原来只拼 4 个键（单据编号/客户名/归属人/产品名称）——
    //   产品信息表的**产品编号**、立项的**立项名称**这些真正用来找单的字段搜不到 ⇒ 用户以为搜索坏了。
    //   现改为**整行所有字段值一起匹配**（与列表页「模糊搜索」同一口径）：
    //   不论哪张面板、哪一列，只要这一行有该文案就能命中；字段增删也不用再同步白名单。
    const hay = Object.keys(r || {})
      .filter(function (k) { return k !== 'detail' })
      .map(function (k) { const v = r[k]; return v === null || v === undefined ? '' : norm(v) })
      .join(' ')
    return hay.indexOf(kw) >= 0
  })
}

/**
 * 「单据预览」全屏表格的**列配置**（2026-11-17 用户口径）。
 *
 * <p>用户原话：「因为现在的单据编号是固定的，所以应该是展示其他的一些比较重点的字段」。</p>
 *
 * <p>问题：产品信息表的纸面右上角印的是**受控表单编号**（YJ-QR-152，逐页常量，见
 * recordSheetConfigs 的 docNoStatic），拿它当"找单的第一列"没有区分度；
 * 而且同名列下有的行是真实流水号（PI-2026-11-0006），语义本身是混的。
 * ⇒ 每类单据按自己的**业务识别字段**排前面，单号退到后面（仍保留，便于对账）。</p>
 *
 * <p>`kind` 只有两档：`text` 普通左对齐 / `num` 右对齐+等宽（等级、数量类）。</p>
 *
 * @type {Record<string, Array<{key: string, label: string, width?: number, minWidth?: number, kind?: string}>>}
 */
export const PREVIEW_TABLE_COLUMNS = {
  // 立项申请：客户 + 项目等级 + 申请人 是"找这张单"的三条线索（沿用卡片时代的登记口径）
  RD_APPROVAL: [
    { key: '单据编号', label: '单据编号', minWidth: 160 },
    { key: '单据日期', label: '单据日期', width: 110 },
    { key: '客户名', label: '客户名', minWidth: 200 },
    { key: '项目等级', label: '项目等级', width: 90, kind: 'num' },
    { key: '申请立项人', label: '申请立项人', width: 120 },
  ],
  // 产品信息表：产品编号 / 产品名称 / 客户名称 才是识别字段；单据编号排最后（它可能是固定表单号）
  RD_PROD_INFO: [
    { key: '产品编号', label: '产品编号', minWidth: 130 },
    { key: '产品名称', label: '产品名称', minWidth: 200 },
    { key: '客户名称', label: '客户名称', minWidth: 180 },
    { key: '产品管控等级', label: '产品管控等级', width: 120 },
    { key: '编辑人', label: '编辑人', width: 120 },
    { key: '单据日期', label: '单据日期', width: 110 },
    { key: '单据编号', label: '单据编号', minWidth: 140 },
  ],

  /* ── 2026-11-20：研发管理其余面板接入同一套全屏预览，列按各自真实字段登记 ──
   * 用户口径：「现在所有的研发模块的单据预览全部做成和立项申请和产品信息表类似的单据查询界面」。
   * 下面每一列都取自 yj_field 的真实 label（数据键），不是猜的：
   *   · 样品单 head 只有 客户名称/费用/期望交期/申请/审核/确认/进度描述；
   *   · 数据记录表 = 单号/日期/报告编号（功能性滤效叫「测试编号」）/测试主题/测试负责人；
   *   · 工艺清单 = 单号/版本号/产品编号+名称/表单管理人（X烧结没有「单据编号」列，单号在「编号」上）；
   *   · 规格书 = 单号/产品编号/名称/客户名称/版本；
   *   · 实施计划 = 单号/项目名称/项目定级/负责人；
   *   · 产品变更 = 单号/标题/产品编号/产品名称/申请人。
   * 没登记的面板继续走 previewColumnsOf 的兜底（单号/日期/归属人），行为不变。 */
  // 样品单：费用是金额列 → kind=num（右对齐 + 等宽）
  RD_SAMPLE_EXT: [
    { key: '单据编号', label: '单据编号', minWidth: 160 },
    { key: '客户名称', label: '客户名称', minWidth: 200 },
    { key: '期望交期', label: '期望交期', width: 110 },
    { key: '费用', label: '费用', width: 110, kind: 'num' },
    { key: '申请', label: '申请', minWidth: 160 },
    { key: '确认', label: '确认', minWidth: 160 },
    { key: '单据日期', label: '单据日期', width: 110 },
  ],
  RD_SAMPLE_ND: [
    { key: '单据编号', label: '单据编号', minWidth: 160 },
    { key: '客户名称', label: '客户名称', minWidth: 200 },
    { key: '期望交期', label: '期望交期', width: 110 },
    { key: '费用', label: '费用', width: 110, kind: 'num' },
    { key: '申请', label: '申请', minWidth: 160 },
    { key: '确认', label: '确认', minWidth: 160 },
    { key: '单据日期', label: '单据日期', width: 110 },
  ],
  // 数据记录表 8 张：测试主题 + 测试负责人是"找这张记录"的线索
  RD_FILTER_EFF: [
    { key: '单据编号', label: '单据编号', minWidth: 160 },
    { key: '测试主题', label: '测试主题', minWidth: 220 },
    { key: '测试编号', label: '测试编号', minWidth: 130 },
    { key: '测试负责人', label: '测试负责人', width: 120 },
    { key: '单据日期', label: '单据日期', width: 110 },
  ],
  RD_ALKALINE: [
    { key: '单据编号', label: '单据编号', minWidth: 160 },
    { key: '测试主题', label: '测试主题', minWidth: 220 },
    { key: '报告编号', label: '报告编号', minWidth: 130 },
    { key: '测试负责人', label: '测试负责人', width: 120 },
    { key: '单据日期', label: '单据日期', width: 110 },
  ],
  RD_MINERAL: [
    { key: '单据编号', label: '单据编号', minWidth: 160 },
    { key: '测试主题', label: '测试主题', minWidth: 220 },
    { key: '报告编号', label: '报告编号', minWidth: 130 },
    { key: '测试负责人', label: '测试负责人', width: 120 },
    { key: '单据日期', label: '单据日期', width: 110 },
  ],
  RD_ANTIBACT: [
    { key: '单据编号', label: '单据编号', minWidth: 160 },
    { key: '测试主题', label: '测试主题', minWidth: 220 },
    { key: '报告编号', label: '报告编号', minWidth: 130 },
    { key: '测试负责人', label: '测试负责人', width: 120 },
    { key: '单据日期', label: '单据日期', width: 110 },
  ],
  RD_SCALE: [
    { key: '单据编号', label: '单据编号', minWidth: 160 },
    { key: '测试主题', label: '测试主题', minWidth: 220 },
    { key: '报告编号', label: '报告编号', minWidth: 130 },
    { key: '测试负责人', label: '测试负责人', width: 120 },
    { key: '单据日期', label: '单据日期', width: 110 },
  ],
  RD_RO_PROTECT: [
    { key: '单据编号', label: '单据编号', minWidth: 160 },
    { key: '测试主题', label: '测试主题', minWidth: 220 },
    { key: '报告编号', label: '报告编号', minWidth: 130 },
    { key: '测试负责人', label: '测试负责人', width: 120 },
    { key: '单据日期', label: '单据日期', width: 110 },
  ],
  RD_SOAK: [
    { key: '单据编号', label: '单据编号', minWidth: 160 },
    { key: '测试主题', label: '测试主题', minWidth: 220 },
    { key: '报告编号', label: '报告编号', minWidth: 130 },
    { key: '测试负责人', label: '测试负责人', width: 120 },
    { key: '单据日期', label: '单据日期', width: 110 },
  ],
  RD_DROP_PREC: [
    { key: '单据编号', label: '单据编号', minWidth: 160 },
    { key: '测试主题', label: '测试主题', minWidth: 220 },
    { key: '报告编号', label: '报告编号', minWidth: 130 },
    { key: '测试负责人', label: '测试负责人', width: 120 },
    { key: '单据日期', label: '单据日期', width: 110 },
  ],
  // 工艺清单：版本号是受控版本（同产品多版本时用来区分）
  RD_MOLD_PROC: [
    { key: '单据编号', label: '单据编号', minWidth: 160 },
    { key: '版本号', label: '版本号', width: 140 },
    { key: '产品编号', label: '产品编号', minWidth: 130 },
    { key: '产品名称', label: '产品名称', minWidth: 200 },
    { key: '表单管理人', label: '表单管理人', width: 120 },
    { key: '单据日期', label: '单据日期', width: 110 },
  ],
  RD_ASM_PROC: [
    { key: '单据编号', label: '单据编号', minWidth: 160 },
    { key: '版本号', label: '版本号', width: 140 },
    { key: '产品编号', label: '产品编号', minWidth: 130 },
    { key: '产品名称', label: '产品名称', minWidth: 200 },
    { key: '客户项目名称', label: '客户项目名称', minWidth: 160 },
    { key: '表单管理人', label: '表单管理人', width: 120 },
    { key: '单据日期', label: '单据日期', width: 110 },
  ],
  // X烧结工艺清单的表头**没有「单据编号」字段**（单号落在「编号」上，见 previewCellText 的别名兜底）
  RD_X_SINTER: [
    { key: '编号', label: '单据编号', minWidth: 160 },
    { key: '版本号', label: '版本号', width: 140 },
    { key: '产品编号', label: '产品编号', minWidth: 130 },
    { key: '产品名称', label: '产品名称', minWidth: 200 },
    { key: '表单管理人', label: '表单管理人', width: 120 },
  ],
  // 规格书：产品编号 + 名称 + 客户 是找"哪一支产品/哪个客户"的线索
  RD_SPEC_DOC: [
    { key: '单据编号', label: '单据编号', minWidth: 160 },
    { key: '产品编号', label: '产品编号', minWidth: 130 },
    { key: '名称', label: '名称', minWidth: 200 },
    { key: '客户名称', label: '客户名称', minWidth: 180 },
    { key: '版本', label: '版本', width: 100 },
    { key: '单据日期', label: '单据日期', width: 110 },
  ],
  // 项目实施计划：项目名称 + 项目定级（数字列）+ 负责人
  RD_PLAN: [
    { key: '单据编号', label: '单据编号', minWidth: 160 },
    { key: '项目名称', label: '项目名称', minWidth: 220 },
    { key: '项目定级', label: '项目定级', width: 100, kind: 'num' },
    { key: '负责人', label: '负责人', width: 120 },
    { key: '单据日期', label: '单据日期', width: 110 },
  ],
  // 产品变更申请单：标题 + 产品编号/名称 + 申请人
  RD_CHANGE: [
    { key: '单据编号', label: '单据编号', minWidth: 160 },
    { key: '标题', label: '标题', minWidth: 220 },
    { key: '产品编号', label: '产品编号', minWidth: 130 },
    { key: '产品名称', label: '产品名称', minWidth: 180 },
    { key: '申请人', label: '申请人', width: 110 },
    { key: '单据日期', label: '单据日期', width: 110 },
  ],
}

/** 取某面板的列配置；没登记的面板退回「单号/日期/归属人」的最小集 */
export function previewColumnsOf(panelCode, ownerKey) {
  const cols = PREVIEW_TABLE_COLUMNS[String(panelCode || '')]
  if (Array.isArray(cols) && cols.length) return cols
  return [
    { key: '单据编号', label: '单据编号', minWidth: 160 },
    { key: '单据日期', label: '单据日期', width: 110 },
    { key: ownerKey || APPLICANT_KEY, label: ownerKey || APPLICANT_KEY, width: 130 },
  ]
}

/**
 * 左侧「分类树」的节点 = 该面板里出现过的**单据状态**（按固定业务顺序，不按字符串排）。
 *
 * <p>用户口径（2026-11-17）：「左侧树按单据状态分」（参考金蝶的「商品类别」树）。</p>
 *
 * <p>为什么固定顺序：草稿 → 审批中 → 已审核 → 已归档 是业务推进顺序，
 * 字典序排会变成「已归档、已审核、审批中、草稿」，读起来是倒的。</p>
 *
 * @returns {{ key: string, label: string, count: number }[]} count = 该状态的单据数，
 *   只返回**有数据**的状态（空节点不画，避免满屏 0）；最前面固定一个「全部」。
 */
export function approvalStatusTree(rows) {
  const ORDER = ['草稿', '修改中', '会签中', '审批中', '待二级审批', '待批准', '已生效', '已审核', '已归档', '已作废']
  const list = Array.isArray(rows) ? rows : []
  const cnt = new Map()
  for (const r of list) {
    const k = String(r && r['单据状态'] || '').trim() || '未标注'
    cnt.set(k, (cnt.get(k) || 0) + 1)
  }
  const keys = [...cnt.keys()].sort(function (a, b) {
    const ia = ORDER.indexOf(a); const ib = ORDER.indexOf(b)
    if (ia >= 0 && ib >= 0) return ia - ib
    if (ia >= 0) return -1
    if (ib >= 0) return 1
    return a.localeCompare(b)
  })
  return [{ key: '', label: '全部', count: list.length }]
    .concat(keys.map(function (k) { return { key: k, label: k, count: cnt.get(k) } }))
}

/* ===== 研发管理「单据预览」全屏化 · 面板判定 / 归属人探测 / 单号取值 · 2026-11-20 =====
 *
 * 用户口径：「现在所有的研发模块的单据预览全部做成和立项申请和产品信息表类似的单据查询界面」。
 * 下面三条都是纯函数，页面（PanelxList / ApprovalPreviewOverlay）只负责取数与渲染。
 */

/**
 * 研发管理面板 → 全屏单据预览。
 *
 * <p><b>判定为什么用 RD_ 前缀，而不是 yj_panel.module_group</b>：</p>
 * <ul>
 *   <li>后端确实有 module_group（PanelRegistry.PanelDef.moduleGroup），2026-11-20 查库核对：
 *       `module_group='研发管理'` 恰好 32 张，且这 32 张**全部**是 RD_ 前缀；没有非 RD_ 的研发面板。
 *       （SQL：`SELECT panel_code, module_group FROM yj_panel WHERE panel_code LIKE 'RD[_]%' OR module_group=N'研发管理'`）</li>
 *   <li>但前端拿不到它：面板配置接口 GET /px/getPanelConfig 下发的 metadata 只有
 *       panelCode/panelName/panelCategory/panelButtons… **没有 moduleGroup**
 *       （见 PanelConfigService 的 metadata 组装）。要用 module_group 得先改后端契约 + 重新部署。</li>
 *   <li>RD_ 前缀在本库与 module_group 一一对应 ⇒ 取更可靠、零后端改动的那条。</li>
 * </ul>
 *
 * <p><b>唯一例外 RD_PROD_DOCLIST</b>：它是「单单据 + 产品矩阵」面板，库里只有 1 张单，
 * 侧栏那颗按钮叫「产品预览」、列出的是**产品行 × 4 个文件状态**。把它改成单据全屏只会剩
 * PDL-0001 一行，反而毁掉现有功能 ⇒ 保留产品矩阵预览（见 FULL_PREVIEW_EXCLUDED）。</p>
 *
 * @param {string} panelCode
 * @returns {boolean}
 */
export const RD_PANEL_PREFIX = 'RD_'
export const FULL_PREVIEW_EXCLUDED = new Set(['RD_PROD_DOCLIST'])

export function isFullPreviewPanel(panelCode) {
  const p = String(panelCode || '')
  return p.startsWith(RD_PANEL_PREFIX) && !FULL_PREVIEW_EXCLUDED.has(p)
}

/**
 * 归属人字段候选（「只看我申请的」按这一列判人）。
 *
 * <p>顺序 = 先父任务给定的 7 个，再补研发面板实测存在的同类字段（2026-11-20 查 yj_field）：</p>
 * <pre>
 *   8 张数据记录表 = 测试负责人；烧结/组装工艺清单、出货检验计划表 = 表单管理人；
 *   出货检验计划表另有 编写人（比表单管理人更贴"这张单是谁写的"）；自制料制程记录 = 录入人。
 * </pre>
 * <p>为什么补这几个：只按前 7 个探测，研发 32 张里有 14 张探不到归属人、只能退回创建人；
 * 补上后这些面板能按真实存在的字段筛「我的」。补的字段排在父任务给的候选**之后**，不会抢占
 * 立项/产品信息/样品/计划/变更这些已确认面板的字段。</p>
 */
export const PREVIEW_OWNER_CANDIDATES = [
  '申请立项人', '申请人', '申请', '编辑人', '编制人', '负责人', '制表人',
  '测试负责人', '编写人', '录入人', '项目负责人', '产品负责人', '表单管理人',
]

/**
 * 一个归属人字段都探测不到时的兜底：创建人。
 *
 * <p>列表行里没有 asp_user1（账号），后端把「创建人/申请人」解析成**姓名**放在「发起人」上
 * （QueryService.loadDocs：pending_by → 制单人 → 申请人；草稿阶段就是创建人姓名）
 * ⇒ 兜底键取「发起人」。</p>
 */
export const PREVIEW_OWNER_FALLBACK = '发起人'

/**
 * 该面板的归属人字段：按候选表顺序取 yj_field 里存在的第一个；都没有就退回创建人。
 *
 * @param {Array<{dataName?: string, code?: string, label?: string}>} fields 面板表头字段定义
 *   （PanelxList 传 cfgCache.data.dataSchema.fields —— 与 yj_field 表头行同源）
 * @param {string[]} [candidates]
 * @param {string} [fallback]
 * @returns {string}
 */
export function resolvePreviewOwnerKey(fields, candidates = PREVIEW_OWNER_CANDIDATES, fallback = PREVIEW_OWNER_FALLBACK) {
  const names = new Set()
  for (const f of Array.isArray(fields) ? fields : []) {
    const n = typeof f === 'string' ? f : String(f?.dataName || f?.code || f?.label || '')
    if (n) names.add(n)
  }
  for (const c of Array.isArray(candidates) ? candidates : []) {
    if (c && names.has(c)) return c
  }
  return fallback
}

/**
 * 全屏预览打开时的默认范围。
 *
 * <p>「只看我申请的」要求**我的**单据真的存在，否则一打开就是空表 —— 比"看到全部"更糟。
 * 研发管理 27 张面板里，很多归属人格子不是当前登录人（实测烧结工艺清单的「表单管理人」
 * 是柴善银，admin 打开时"我的"= 0 条），或者整列没填（8 张数据记录表的「测试负责人」）
 * ⇒ 一律默认 mine 会让人以为「单据预览没数据」。</p>
 *
 * <p>所以默认值按数据判：**我的单据 ≥1 张 ⇒ mine（沿用立项/产品信息表的既有口径）；
 * 我的为 0 ⇒ all**。用户仍可手动切「只看我申请的」，空态会给「查看全部单据」按钮。</p>
 *
 * @param {Array<Record<string, any>>} rows
 * @param {string} ownerKey
 * @param {string} me 当前登录人姓名
 * @returns {'mine'|'all'}
 */
export function defaultPreviewScope(rows, ownerKey, me) {
  const list = Array.isArray(rows) ? rows : []
  if (!ownerKey) return 'all'
  const meName = String(me == null ? '' : me).trim()
  if (!meName) return 'all'
  const has = list.some(function (r) { return samePerson(r == null ? null : r[ownerKey], meName) })
  return has ? 'mine' : 'all'
}

/**
 * 全屏预览表格的单元格文本。
 *
 * <p>单号列做一次别名兜底：研发面板里 RD_X_SINTER（X烧结工艺清单）、RD_SHARE_FILE（共享文件库）
 * 的表头没有「单据编号」这一格，单号落在「编号」上 —— 不做兜底整列都是「—」。</p>
 *
 * @param {Record<string, any>|null} row
 * @param {string} key
 * @returns {string}
 */
export function previewCellText(row, key) {
  const r = row || {}
  const v = r[key]
  if (v !== undefined && v !== null && String(v) !== '') return String(v)
  if (String(key) === '单据编号') {
    const alt = r['编号']
    if (alt !== undefined && alt !== null && String(alt) !== '') return String(alt)
  }
  return ''
}
