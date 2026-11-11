/**
 * qcProcInspExport.js — 出货检验功能记录表(YJ-QR-154)纸面表 → Excel(.xlsx)的**版式单一真源**。
 *
 * 用户口径(2026-11-11):
 *   ·「将当前的组装成品检验修改为出货检验表观」(只改显示名,面板代号/表结构/单号前缀不动)
 *   ·「将当前的出货检验列表的格式修改为图2所示的形式」—— 图2 = 《出货检验功能记录表》:
 *       标题 + 右上「表单编号：YJ-QR-154」
 *       → 抬头 3 行 × 2 组(单据编号|检测周期 / 产品编码|工单号 / 产品型号|抽检方案)
 *       → 「检验明细」矩阵:检验项目|检验方法|检验要求 + **每个内部批次两列**(批次号|本批结果判断)
 *       → 表尾 2 行 × 2 组(检验人|检验结论 / 审核人|处理意见)
 *   本模块取代 2026-10-17 那版「客户名称/产品编码/型号/批号 + 结果判断」的单批八列版式。
 *
 * 只放**纯函数**(产出 aoa / 列宽 / 合并区),不 import xlsx ⇒ 可用 node:test 钉死版式;
 * 组件拿到结果后自己做 `XLSX.utils.aoa_to_sheet` + `writeFile`(与 QcCatalogSheet 同一套写法)。
 *
 * ⚠ 实测(xlsx **社区版 0.18.5**,`tools/archive/_probe-xlsx-cols.mjs`):
 *     · `!cols`(列宽)与 `!merges`(合并区)**能**写进 .xlsx(解压看 xl/worksheets/sheet1.xml 里的 `<cols>`);
 *     · 单元格样式(`.s` = 加粗/底色/自动换行)与 `cellStyles:true` 选项都**不会**落进文件
 *       —— 导出的就是"纯值 + 列宽 + 合并"的版式,长文本在 Excel 里要用户自己开"自动换行"才好看。
 *       要带框线/自动换行的纸面级 Excel,得换 `xlsx-js-style` 或走后端报表(另开任务,别在这里硬凑)。
 *
 * ── 行/列骨架(N = 3 + 2 × 批次数,批次数 ≥ 1) ──
 *   r0          标题 | … | 表单编号：YJ-QR-154
 *   r1          副标题(公司/单号/状态,可选文本;整行合并)
 *   r2..r4      抬头 3 行,每行 2 组:标签 c0 | 值 c1..c2 | 标签 c3 | 值 c4..N-1
 *   headerRow1  「检验明细」区块标题行(整行合并)
 *   headerRow2  明细列标签:检验项目 | 检验方法 | 检验要求 | (批次号 | 本批结果判断) × 批次数
 *   …           数据行:一行一个检验项目,每批两格(批次号 | 本批结果判断)
 *   末 2 行      表尾 2 行 2 组(检验人|检验结论 / 审核人|处理意见),合并区同抬头
 *
 * 合并区口径:
 *   · 标题(右侧留「表单编号」两列)+ 副标题整行 + 「检验明细」整行;
 *   · 抬头/表尾:**值**格合并(标签格不合并),组 2 的值格一直跨到最后一列(N-1);
 *   · 检验明细:每批两列**不做跨列合并**(批次号 / 本批结果判断 各占一列),批次号按行重复填写;
 *   · 单列(如 N=5 时的最右值格)不产生 1×1 合并 —— xlsx 里 1×1 mergeRange 只会是脏区。
 *
 * 数据口径(**收口在这里**,组件只负责把当前单据扔进来):
 *   · 批次列清单 = `batchListOf(head)`,优先头表「内部批次清单」(英文逗号分隔),旧单回退单批
 *     (批次号 = 头「批次号」,空则「本批」)—— 旧单渲染成**一列**批次列,与纸面/面板同口径。
 *   · 明细行 = `aggregateInspItems(rows, batches)`:
 *       - 已聚合形态(组件已按检验项目聚合):`{ 检验项目, 检验方法, 检验要求, 结果: { [批次号]: '合格' } }`;
 *       - 原始明细行形态(行表真身,一行 = 检验项目 × 内部批次):`{ 检验项目, 检验方法, 检验要求, 内部批次, 结果判断 }`,
 *         这里按「检验项目」聚合成一行、结果落 `结果[内部批次]`。
 *     两种都收 ⇒ 面板/单测各用各的,别在组件里再写一份聚合。
 */

/** 标题(纸面固定印刷的表单名) */
export const PROC_INSP_TITLE = '出货检验功能记录表'
/** 表单编号(纸面右上角固定印刷) */
export const PROC_INSP_FORM_CODE = 'YJ-QR-154'
/** 表单编号的标签文字(组件可传 tt('表单编号') 覆盖) */
export const PROC_INSP_FORM_LABEL = '表单编号'
/** 「检验明细」区块标题(组件可传 tt('检验明细') 覆盖) */
export const PROC_INSP_DETAIL_TITLE = '检验明细'
/** 旧单(无批次清单)单批列的批次号兜底 */
export const PROC_INSP_EMPTY_BATCH = '本批'

/** 抬头 3 行 × 2 组(图2 版式):label = 纸面标签,key = 单据头数据键(取值用) */
export const PROC_INSP_HEAD_DEFS = [
  [{ label: '单据编号', key: '单据编号' }, { label: '检测周期', key: '检测周期' }],
  [{ label: '产品编码', key: '产品编码' }, { label: '工单号', key: '工单号' }],
  // 产品型号的落库键是「规格型号」(yj_field label 仍是型号),抽检方案取「检验方案」
  [{ label: '产品型号', key: '规格型号' }, { label: '抽检方案', key: '检验方案' }],
]

/** 表尾 4 组(排成 2 行 × 2 组):label = 纸面标签,key = 单据头数据键 */
export const PROC_INSP_FOOT_DEFS = [
  { label: '检验人', key: '检验员' },
  { label: '检验结论', key: '总结论' },
  // 审核人是**纸面签名**(head「表单审核人」,docDefaults 默认冯敏、可改),
  // 不是审批流虚拟字段「审核人」(yj_doc_status.shr 那套)。
  { label: '审核人', key: '表单审核人' },
  { label: '处理意见', key: '处理方式' },
]

/** 检验明细固定 3 列(顺序即 Excel 列序) */
export const PROC_INSP_BASE_COLS = [
  { label: '检验项目', wch: 14 },
  { label: '检验方法', wch: 40 },
  { label: '检验要求', wch: 34 },
]
/** 每个内部批次占 2 列 */
export const PROC_INSP_BATCH_COLS = [
  { label: '批次号', wch: 14 },
  { label: '本批结果判断', wch: 14 },
]

/** 空值 → 空串(导出格子里永远写字符串,别写 undefined) */
const text = (v) => (v === undefined || v === null ? '' : String(v))

/**
 * 批次列清单(有序、去重):优先头表「内部批次清单」(英文逗号分隔,如 `261105,261107`),
 * 为空则旧单回退**单批** = `head['批次号']`(空则「本批」)。
 *
 * ⚠ 这里**不**扫明细行的「内部批次」:设计口径是「批次列顺序由清单保证(先加批次、后带入检验项目
 * 也不丢列)」,旧单两处都空 ⇒ 单批次列。清单写了但行没数据时列照样在,这是本函数的全部意义。
 * @param {object} head 单据头
 * @returns {string[]} 至少一项
 */
export function batchListOf(head = {}) {
  const raw = text(head && head['内部批次清单']).trim()
  const out = []
  if (raw) {
    // 英文逗号是口径(设计 §二),顺手兼容中文逗号/分号 —— 历史数据里手填的不在少数
    for (const seg of raw.split(/[,，;；]/)) {
      const name = seg.trim()
      if (name && !out.includes(name)) out.push(name)   // 去重:重名批次会变成两列一样的列
    }
  }
  if (out.length) return out
  const single = text(head && head['批次号']).trim()
  return [single || PROC_INSP_EMPTY_BATCH]
}

/**
 * 明细行 → 一行一个检验项目(按「检验项目」聚合,顺序 = 首次出现顺序)。
 *
 * 两种入参都收(见文件头「数据口径」):
 *   · 已聚合:`{ 检验项目, 检验方法, 检验要求, 结果: { [批次号]: '合格' } }` —— 原样规整;
 *   · 原始行表:`{ 检验项目, 检验方法, 检验要求, 内部批次, 结果判断 }` —— 聚合成一行,
 *     结果按 `内部批次` 落到 `结果[批次号]`;`内部批次` 空的行落**首列批次**(旧单)。
 * ⚠ 检验要求/检验方法 同项目在各批次行上应写穿成同值(面板保证),这里取首个非空值兜底。
 *
 * @param {Array<object>} rows
 * @param {string[]} batches 批次列清单(决定旧单行的落列)
 * @returns {Array<{检验项目:string, 检验方法:string, 检验要求:string, 结果:Object<string,string>}>}
 */
export function aggregateInspItems(rows = [], batches = []) {
  const list = Array.isArray(rows) ? rows : []
  const fallbackBatch = text(Array.isArray(batches) && batches.length ? batches[0] : '').trim()
  const out = []
  const index = new Map()
  list.forEach((row, i) => {
    if (!row || typeof row !== 'object') return
    const name = text(row['检验项目']).trim()
    // 已聚合形态:带「结果」对象 ⇒ 原样收下(同名单据行不合并,由调用方保证唯一)
    const verdicts = row['结果']
    if (verdicts && typeof verdicts === 'object' && !Array.isArray(verdicts)) {
      const r = {}
      const t = {}
      for (const [k, v] of Object.entries(verdicts)) r[text(k)] = text(v)
      const texts = row['实测数值']
      if (texts && typeof texts === 'object' && !Array.isArray(texts)) {
        for (const [k, v] of Object.entries(texts)) t[text(k)] = text(v)
      }
      out.push({ 检验项目: name, 检验方法: text(row['检验方法']), 检验要求: text(row['检验要求']), 结果: r, 结果文本: t })
      return
    }
    // 原始明细行:按检验项目聚合。无检验项目的行各自成组(空名不能塌成一行)
    const key = name || `#${i}`
    let item = index.get(key)
    if (!item) {
      item = { 检验项目: name, 检验方法: '', 检验要求: '', 结果: {}, 结果文本: {} }
      index.set(key, item)
      out.push(item)
    }
    if (!item['检验方法']) item['检验方法'] = text(row['检验方法'])
    if (!item['检验要求']) item['检验要求'] = text(row['检验要求'])
    const b = text(row['内部批次']).trim() || fallbackBatch
    if (!b) return
    // 同项目同批次重复行(理论上不该有):先落的值为准,后者不覆盖
    if (!(b in item['结果'])) item['结果'][b] = text(row['结果判断'])
    if (!(b in item['结果文本'])) item['结果文本'][b] = text(row['实测数值'])
  })
  return out
}

/**
 * 组装导出的二维数组 / 列宽 / 合并区。
 *
 * @param {object} p
 * @param {string}  [p.title]        标题(默认 PROC_INSP_TITLE;组件传 tt('出货检验功能记录表'))
 * @param {string}  [p.subtitle]     副标题(公司 / 单号 / 状态,可选;整行合并)
 * @param {string}  [p.formCode]     表单编号(默认 YJ-QR-154;空串则不印)
 * @param {string}  [p.formCodeLabel] 表单编号的标签文字(默认「表单编号」)
 * @param {string}  [p.detailTitle]  「检验明细」区块标题(默认「检验明细」)
 * @param {Array<Array<{label:string,value:string}>>} [p.headPairs]
 *        抬头 3 行,每行 2 组(单据编号|检测周期、产品编码|工单号、产品型号|抽检方案);
 *        不传则按 PROC_INSP_HEAD_DEFS 从 p.head 取值(单测/兜底用)。
 * @param {string[]} [p.batches]     批次列清单(来自 batchListOf(head));不传则按 p.head 现算
 * @param {Array<object>} [p.rows]   明细行(已聚合形态或原始行表形态,见 aggregateInspItems)
 * @param {Array<{label:string,value:string}>} [p.foot]
 *        表尾 4 组(检验人 / 检验结论 / 审核人 / 处理意见),按 2 行 2 组排版;
 *        不传则按 PROC_INSP_FOOT_DEFS 从 p.head 取值。
 * @param {object}  [p.head]         单据头(仅用于不给 headPairs/batches/foot 时补默认值)
 * @returns {{aoa:Array<Array<any>>, cols:Array<{wch:number}>, merges:Array<object>,
 *            headerRow1:number, headerRow2:number}}
 *   ⚠ headerRow1 = 「检验明细」区块标题行,**headerRow2 = 明细列标签行**(检验项目|检验方法|检验要求|每批两列)。
 *   组件样式直接可用的附加索引:titleRow / subtitleRow / headRows / firstDataRow / lastDataRow / footRows,
 *   以及 batchNames / batchCount / colCount。
 */
export function buildProcInspExport({
  title = PROC_INSP_TITLE,
  subtitle = '',
  formCode = PROC_INSP_FORM_CODE,
  formCodeLabel = PROC_INSP_FORM_LABEL,
  detailTitle = PROC_INSP_DETAIL_TITLE,
  headPairs = [],
  batches = [],
  rows = [],
  foot = [],
  head = {},
} = {}) {
  const aoa = []
  const merges = []
  const merge = (r1, c1, r2, c2) => {
    // 1×1 合并区在 .xlsx 里无意义(Excel 会当脏区),一律不写
    if (r1 === r2 && c1 === c2) return
    merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } })
  }

  // ── 列骨架:N = 3 + 2 × 批次数 ──
  const batchNames = (Array.isArray(batches) && batches.length ? batches : batchListOf(head)).map(text)
  const B = batchNames.length
  const N = PROC_INSP_BASE_COLS.length + PROC_INSP_BATCH_COLS.length * B   // 3 + 2B,恒 ≥ 5

  /** 一行 N 格空表(定位填写用) */
  const blankRow = () => new Array(N).fill('')

  // ── r0 标题 + 右上表单编号 ──
  const titleRow = aoa.length
  const formText = text(formCode).trim() ? `${text(formCodeLabel).trim() || PROC_INSP_FORM_LABEL}：${text(formCode).trim()}` : ''
  const titleLine = blankRow()
  titleLine[0] = text(title)
  if (formText) {
    // 标题让出最后两列给「表单编号：YJ-QR-154」,与纸面右上角同位
    titleLine[N - 2] = formText
    merge(titleRow, 0, titleRow, N - 3)
    merge(titleRow, N - 2, titleRow, N - 1)
  } else {
    merge(titleRow, 0, titleRow, N - 1)
  }
  aoa.push(titleLine)

  // ── r1 副标题(整行合并)──
  const subtitleRow = aoa.length
  aoa.push([text(subtitle)])
  merge(subtitleRow, 0, subtitleRow, N - 1)

  // ── 抬头 3 行 × 2 组:标签 c0 | 值 c1..c2 | 标签 c3 | 值 c4..N-1 ──
  const headPairRows = (Array.isArray(headPairs) && headPairs.length
    ? headPairs
    : PROC_INSP_HEAD_DEFS.map((pairs) => pairs.map((d) => ({ label: d.label, value: text(head?.[d.key]) }))))
  /** 抬头/表尾共用的一套「2 组」排版(纸面同形:组 1 = 1 列标签 + 2 列值;组 2 = 1 列标签 + 余下列) */
  const pushPairRow = (groups) => {
    const r = aoa.length
    const line = blankRow()
    const [g1, g2] = groups
    line[0] = text(g1?.label)
    line[1] = text(g1?.value)
    line[3] = text(g2?.label)
    line[4] = text(g2?.value)
    aoa.push(line)
    merge(r, 1, r, 2)          // 组 1 值跨 2 列(检验方法 + 检验要求 那两列)
    merge(r, 4, r, N - 1)      // 组 2 值跨余下全部列(单列时不合并)
    return r
  }
  const headRows = []
  for (const pairRow of headPairRows) {
    headRows.push(pushPairRow((pairRow || []).slice(0, 2)))
  }

  // ── 「检验明细」区块标题行 + 明细列标签行 ──
  const headerRow1 = aoa.length
  aoa.push([text(detailTitle)])
  merge(headerRow1, 0, headerRow1, N - 1)

  const headerRow2 = aoa.length
  const headerLine = PROC_INSP_BASE_COLS.map((c) => c.label)
  // 每批两列:第一列表头带**批号**(纸面同一位置是手填/命名的批号格),第二列是本批结果判断;
  // 批号只在表头出现一次,数据体第一列 = 录入对应结果(实录「实测数值」)—— 与纸面同口径。
  for (let i = 0; i < B; i++) {
    headerLine.push(`${PROC_INSP_BATCH_COLS[0].label}：${batchNames[i]}`)
    headerLine.push(PROC_INSP_BATCH_COLS[1].label)
  }
  aoa.push(headerLine)

  // ── 数据行:一行一个检验项目 × 批次列(每批两格:录入对应结果 | 本批结果判断)──
  const items = aggregateInspItems(rows, batchNames)
  const firstDataRow = aoa.length
  // 空单也铺一行空表体:导出的是一张能继续手填的表,不是只有表头的空壳(与旧版口径一致)
  const dataItems = items.length ? items : [{ 检验项目: '', 检验方法: '', 检验要求: '', 结果: {}, 结果文本: {} }]
  for (const item of dataItems) {
    const line = [text(item['检验项目']), text(item['检验方法']), text(item['检验要求'])]
    for (const b of batchNames) {
      line.push(text(item['结果文本']?.[b]))    // 录入对应结果(落库「实测数值」)
      line.push(text(item['结果']?.[b]))        // 本批结果判断
    }
    aoa.push(line)
  }
  const lastDataRow = aoa.length - 1

  // ── 表尾 2 行 × 2 组(检验人|检验结论 / 审核人|处理意见)──
  const footGroups = PROC_INSP_FOOT_DEFS.map((d, i) => {
    const given = Array.isArray(foot) ? foot[i] : null
    return {
      label: text(given?.label) || d.label,
      value: given && given.value !== undefined ? text(given.value) : text(head?.[d.key]),
    }
  })
  const footRows = [pushPairRow(footGroups.slice(0, 2)), pushPairRow(footGroups.slice(2, 4))]

  // ── 列宽:检验项目/检验方法/检验要求 + 每批两列 ──
  const cols = [
    ...PROC_INSP_BASE_COLS.map((c) => ({ wch: c.wch })),
    ...Array.from({ length: B }, () => PROC_INSP_BATCH_COLS.map((c) => ({ wch: c.wch }))).flat(),
  ]

  return {
    aoa,
    cols,
    merges,
    headerRow1,        // 「检验明细」区块标题行
    headerRow2,        // 明细列标签行(检验项目|检验方法|检验要求|(批次号|本批结果判断)×B)
    // ── 以下为组件样式/调试用的附加索引(不改变上面的骨架语义)──
    titleRow,
    subtitleRow,
    headRows,
    firstDataRow,
    lastDataRow,
    footRows,
    batchNames,
    batchCount: B,
    colCount: N,
  }
}
