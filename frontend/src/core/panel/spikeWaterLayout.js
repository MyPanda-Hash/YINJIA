/**
 * spikeWaterLayout.js —— 加标水配置记录表的**自定义表格结构**（纯函数，可 node --test）
 *
 * 【用户口径 2026-11-06】
 *   「加标水这个单据做成可以自定义面板格式的，就是可以自己编辑要多少列，列下面有没有分格，
 *     列名字叫啥，这个要和标准库绑定的，就是一个标准库条目对应一个设计的表格样式，
 *     可以去参考品质管理的来料检验要求」
 *
 * 【做法】结构不写进前端配置，而是**存进标准库条目的 content**（一个条目 = 一套表结构）：
 *   面板的「测试项目」字段是标准库字段（dataType='标准库'），选中哪个条目就取它的 content 当列定义。
 *   这样"一个标准库条目对应一个设计的表格样式"成立，且加一种测试项目 = 加一个标准库条目，
 *   不用改代码、不用发版。
 *
 * 【结构格式】JSON 字符串，存 yj_std_lib.content：
 *   {
 *     "cols": [
 *       { "key": "测试日期", "label": "测试日期", "w": 90, "rowspan": 2 },
 *       { "key": "硫酸镁",   "label": "硫酸镁",   "w": 90, "group": "试剂用量（g）" }
 *     ]
 *   }
 *   字段含义与 recordSheetConfigs 里 variants[*].cols 完全一致（同一条渲染路径）：
 *     · w       列宽（px）
 *     · group   该列属于哪个**分格**（合并表头）；同 group 的相邻列合并成一格
 *     · rowspan 2 = 无分格的列在表头占两行（与有分格的那些列对齐）
 *
 * 【为什么单独抽出来】解析失败必须**不报错、退回内置列集** —— 用户在标准库里手改 JSON 写错一个
 *   逗号，不能让整张单据白屏。这条兜底逻辑要能用 node:test 钉住。
 */

/** 内置兜底列集（= 原 variants.除铅 的那套，结构坏了就用它） */
export const FALLBACK_COLS = [
  { key: '测试日期', label: '测试日期', w: 90, rowspan: 2 },
  { key: '项目名称', label: '项目名称', w: 110, rowspan: 2 },
  { key: '测试装置', label: '测试装置', w: 100, rowspan: 2 },
  { key: '测试工位', label: '测试工位', w: 90, rowspan: 2 },
  { key: '配水量\n（L）', label: '配水量\n（L）', w: 80, rowspan: 2 },
  { key: '配置用水', label: '配置用水', w: 90, rowspan: 2 },
  { key: '负责人', label: '负责人', w: 70, rowspan: 2 },
]

const str = (v) => (v === null || v === undefined ? '' : String(v).trim())

/**
 * 把标准库条目的 content 解析成列定义。
 *
 * @param {string|object|null} content 条目内容（JSON 字符串；也接受已解析的对象）
 * @returns {{cols: Array, ok: boolean, reason: string}} ok=false 时 cols 是 FALLBACK_COLS
 */
export function parseLayout(content) {
  if (content === null || content === undefined || str(content) === '') {
    return { cols: FALLBACK_COLS, ok: false, reason: '条目内容为空' }
  }
  let obj = content
  if (typeof content === 'string') {
    try {
      obj = JSON.parse(content)
    } catch (e) {
      return { cols: FALLBACK_COLS, ok: false, reason: 'JSON 解析失败：' + e.message }
    }
  }
  const raw = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.cols) ? obj.cols : null)
  if (!raw) return { cols: FALLBACK_COLS, ok: false, reason: '缺少 cols 数组' }
  const cols = raw
    .filter((c) => c && str(c.key))
    .map((c) => {
      const key = str(c.key)
      const col = { key, label: str(c.label) || key, w: Number(c.w) > 0 ? Number(c.w) : 90 }
      if (c.group !== undefined && str(c.group)) col.group = str(c.group)
      // 有分格的列不写 rowspan（它在第二行占一格）；没分格的列要 rowspan:2 才不被表头挤掉
      if (!col.group) col.rowspan = Number(c.rowspan) === 1 ? 1 : 2
      return col
    })
  if (!cols.length) return { cols: FALLBACK_COLS, ok: false, reason: 'cols 里没有有效列（每列都要有 key）' }
  return { cols, ok: true, reason: '' }
}

/**
 * 按 group 把列切成**表头分段**：相邻且 group 相同的列合并成一格。
 * 渲染器据此出第一行（分格）与第二行（分格下的子列）。
 *
 * @param {Array} cols parseLayout 的产物
 * @returns {Array<{group: string, span: number, col: object}>} span=0 表示该列自占两行（无分格）
 */
export function groupSegments(cols) {
  const out = []
  let i = 0
  while (i < cols.length) {
    const g = cols[i].group
    if (!g) {
      out.push({ group: '', span: 0, col: cols[i] })
      i += 1
      continue
    }
    let n = 1
    while (i + n < cols.length && cols[i + n].group === g) n += 1
    out.push({ group: g, span: n, col: cols[i] })
    i += n
  }
  return out
}

/** 总宽（用于纸面网格对齐；渲染器按比例分配） */
export function totalWidth(cols) {
  return cols.reduce((a, c) => a + (Number(c.w) > 0 ? Number(c.w) : 90), 0)
}
