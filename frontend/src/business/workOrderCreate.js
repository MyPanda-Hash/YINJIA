/**
 * workOrderCreate.js — 生产工单「新增」弹窗的**纯逻辑**(2026-11-13)
 *
 * 入口:`frontend/src/views/modules/plan/WorkOrderCreateDialog.vue`(只负责请求/渲染,判定全在这里)。
 * 单测:`workOrderCreate.test.js`(`cd frontend && node --test src/business/workOrderCreate.test.js`)。
 *
 * 口径来源(用户四项需求之②③ + 后端接口契约):
 *   ① 生产工单页可以**新建**生产工单(此前只有订单结转能生成);
 *   ② 新建弹窗有「常规工单 / 临时工单」两页签;临时工单 = 上方主物料 + 下方**本工单自己的用料**
 *      (临时 BOM,落 `wo_bom`;常规工单不写 BOM,领料按产品的标准组装 BOM 取料)。
 *
 * 两条硬规矩:
 *   · **提交给后端的键名一字不差**按契约 D(`工单类型`/`产品编码`/…/`物料清单`),数据键永远中文不翻译
 *     (ADR-0001);这里只做规范化(trim、数值化、行序重排),不改键名、不改语义。
 *   · 校验返回**待 tt() 的中文文案**而不是拼好的字符串 —— 本文件是纯函数,不许 import i18n
 *     (node --test 直接 import 本文件)。组件拿到 `message` 后自己 `tt()`。
 */
/** 本组弹窗按哪个面板校验权限(`/px/invOptions` 的 panelCode;后端按调用方面板授权) */
export const WORK_ORDER_PANEL = 'WORK_ORDER_LIST'

/** 页签/存储值(数据键,永远中文;显示时才 tt()) */
export const KIND_NORMAL = '常规'
export const KIND_TEMP = '临时'

/** 空值安全取字符串(去首尾空格;null/undefined → '') */
const str = (v) => (v === null || v === undefined ? '' : String(v).trim())

/** 空值安全取数字(非法 → 0;用于数量列,避免 Number('') = 0 之外还出现 NaN 落库) */
const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * 本地日期 → `YYYY-MM-DD`。
 * ⚠ 不用 `toISOString()`:那是 UTC,东八区 00:00~08:00 之间会把「今天」算成昨天,
 * 工单日期直接错一天(仓库里其他页面也是本地算法,口径一致)。
 *
 * @param {Date} [d] 默认现在;传非法值返回 ''
 * @returns {string} yyyy-MM-dd
 */
export function todayStr(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

/**
 * 弹窗表单的初始值(打开弹窗 = 重置成这一份)。
 * 工单日期默认**今天**;计划开工日期/交期可空;订单数量/生产数量留空(让用户填)。
 *
 * @param {object} [overrides] 覆盖项(单测/回填用)
 * @returns {object} 表单对象(键名 = 契约 D 的键,前端内部一致)
 */
export function blankForm(overrides = {}) {
  return {
    产品编码: '', 产品名称: '', 规格型号: '', 计量单位: '',
    客户编码: '', 客户名称: '',
    订单数量: undefined, 生产数量: undefined,
    工单日期: todayStr(), 计划开工日期: '', 交期: '',
    工艺路线: '', 备注: '',
    ...(overrides || {}),
  }
}

/**
 * 一行「临时工单用料」的空行。
 * 默认值按契约:标准用量默认 1(>0 才合法)、损耗量默认 0;名称/规格由子件档案带出。
 *
 * @param {number} [行序] 行号(默认 1;追加行时用 nextLineSeq)
 * @returns {{行序:number,子件编码:string,子件名称:string,子件规格:string,计量单位:string,标准用量:number,损耗量:number,行备注:string}}
 */
export function blankBomLine(行序 = 1) {
  return {
    行序: num(行序) || 1,
    子件编码: '', 子件名称: '', 子件规格: '', 计量单位: '',
    标准用量: 1, 损耗量: 0, 行备注: '',
  }
}

/** 下一个可用行序 = 现有最大行序 + 1(空表 = 1) */
export function nextLineSeq(lines) {
  const list = Array.isArray(lines) ? lines : []
  return list.reduce((m, r) => Math.max(m, num(r && r.行序)), 0) + 1
}

/**
 * 行序重排成 1..n(**返回新数组,不改入参**)。
 * 删行/带出后行号会断号,提交前必须连续(后端 wo_bom 按 行序 排序展示)。
 */
export function renumberLines(lines) {
  return (Array.isArray(lines) ? lines : []).map((r, i) => ({ ...(r || {}), 行序: i + 1 }))
}

/**
 * 「从标准BOM带出」的返回 → 弹窗明细行。
 *
 * 后端 `/px/workOrderList/stdBom` 返回 `{来源, 单据编号, 版本号, 行:[{行序,子件编码,…,标准用量,损耗量,备注}]}`;
 * 这里:① 行序**重排**成 1..n(标准BOM 的行序可能从 0 起或有断号);
 *      ② 数值列数值化;③ 子件字段 trim;④ `备注`(标准BOM 的叫法)→ `行备注`(本表/契约 D 的叫法);
 *      ⑤ 标准用量**缺失**时按 1(新增行默认值),但明确的 0 原样保留 —— 不替用户改数,交给校验点名。
 *
 * @param {object|Array} stdBom 接口返回(或直接给行数组)
 * @returns {Array<object>} 可直接绑到表格的行
 */
export function mapStdBomLines(stdBom) {
  const raw = Array.isArray(stdBom)
    ? stdBom
    : (Array.isArray(stdBom && stdBom.行) ? stdBom.行 : [])
  return raw
    .filter((r) => r && typeof r === 'object')
    .map((r, i) => {
      const std = r.标准用量
      const qty = std === undefined || std === null || std === '' ? 1 : num(std)
      return {
        行序: i + 1,
        子件编码: str(r.子件编码),
        子件名称: str(r.子件名称),
        子件规格: str(r.子件规格),
        计量单位: str(r.计量单位),
        标准用量: qty,
        损耗量: num(r.损耗量),
        行备注: str(r.行备注 ?? r.备注),
      }
    })
}

/**
 * 单行的必填/数值判定(组件用它给行标红,validateWorkOrder 用它点名)。
 *
 * @param {object} line 明细行
 * @returns {{field:string, reason:'required'|'positive'}|null} 合法 → null
 */
export function lineProblem(line) {
  const r = line || {}
  if (!str(r.子件编码)) return { field: '子件编码', reason: 'required' }
  if (!(num(r.标准用量) > 0)) return { field: '标准用量', reason: 'positive' }
  if (!str(r.计量单位)) return { field: '计量单位', reason: 'required' }
  return null
}

/** 一行是不是"还什么都没填"(刚点「添加行」出来的空行不算…都空才算) */
function isBlankLine(line) {
  const r = line || {}
  return !str(r.子件编码) && !str(r.子件名称) && !str(r.子件规格) && !str(r.计量单位) && !str(r.行备注)
}

/**
 * 保存前校验(返回**待 tt() 的中文文案**;组件 `ElMessage.warning(tt(message))`)。
 *
 * 规则(契约「前端契约·校验」):
 *   产品编码必填(主物料)、订单数量>0、生产数量>0、工艺路线必填;
 *   工艺路线必须**已审核**(2026-10-16 用户口径,后端同口径兜底);
 *   临时工单 ≥1 行,且每行 子件编码必填、标准用量>0、计量单位非空;常规工单不看明细。
 *
 * @param {{kind?:string, form?:object, lines?:Array, routes?:Array}} [p]
 *        kind=常规|临时;routes=可选(传了才核对审核状态,不传只做主数据校验)
 * @returns {{ok:boolean, message:string, lineNo?:number, field?:string, reason?:string}}
 *          message 是中文原文(i18n 键),lineNo 是出错行序(行级错误才有)
 */
export function validateWorkOrder({ kind = KIND_NORMAL, form = {}, lines = [], routes = null } = {}) {
  const f = form || {}
  const temp = kind === KIND_TEMP
  if (!str(f.产品编码)) return { ok: false, message: '请选择主物料', field: '产品编码', reason: 'required' }
  if (!(num(f.订单数量) > 0)) return { ok: false, message: '订单数量必须大于 0', field: '订单数量', reason: 'positive' }
  if (!(num(f.生产数量) > 0)) return { ok: false, message: '生产数量必须大于 0', field: '生产数量', reason: 'positive' }
  if (!str(f.工艺路线)) return { ok: false, message: '请选择工艺路线', field: '工艺路线', reason: 'required' }
  // 未审核的路线不能用于生产工单(下拉里已 disabled,这里是手改/默认值失配时的兜底)
  if (Array.isArray(routes) && routes.length) {
    const hit = routes.find((r) => str(r && r.编码) === str(f.工艺路线))
    if (hit && str(hit.审核状态) !== '已审核') {
      return { ok: false, message: '工艺路线尚未审核，不能用于生产工单', field: '工艺路线', reason: 'audit' }
    }
  }
  if (!temp) return { ok: true, message: '' }
  const list = Array.isArray(lines) ? lines : []
  if (!list.filter((r) => r && !isBlankLine(r)).length) {
    return { ok: false, message: '临时工单至少要填写一行所需物料（子件）' }
  }
  for (let i = 0; i < list.length; i++) {
    const line = list[i]
    if (!line || isBlankLine(line)) continue            // 多余空行不拦(提交时自然被过滤掉)
    const p = lineProblem(line)
    if (p) return { ok: false, message: p.field, lineNo: num(line.行序) || i + 1, field: p.field, reason: p.reason }
  }
  return { ok: true, message: '' }
}

/**
 * 默认工艺路线(契约:优先**产品档案**的工艺路线(若已审核),否则 options.默认工艺路线)。
 *
 * @param {{routes?:Array, productRoute?:string, fallback?:string}} [p]
 *        routes = `/px/processTask/routes` 全量(含 审核状态);productRoute = productInfo.工艺路线;
 *        fallback = options.默认工艺路线
 * @returns {string} 可用的路线编码;都不满足 → ''(让用户自己选,绝不默认塞一条未审核的)
 */
export function pickDefaultRoute({ routes = [], productRoute = '', fallback = '' } = {}) {
  const audited = new Set(
    (Array.isArray(routes) ? routes : [])
      .filter((r) => str(r && r.审核状态) === '已审核')
      .map((r) => str(r && r.编码))
      .filter(Boolean),
  )
  for (const c of [str(productRoute), str(fallback)]) {
    if (c && audited.has(c)) return c
  }
  return ''
}

/**
 * 弹窗表单 + 明细 → `POST /px/workOrderList/create` 的请求体。
 *
 * 键名严格按契约 D(一字不差):
 * ```
 * { 工单类型: '常规'|'临时', 产品编码, 客户编码, 客户名称(仅展示,后端按编码取),
 *   订单数量, 生产数量, 工单日期, 计划开工日期, 交期, 工艺路线, 备注,
 *   物料清单: [{行序, 子件编码, 子件名称, 子件规格, 计量单位, 标准用量, 损耗量, 行备注}] }
 * ```
 * 口径:① 常规工单 `物料清单: []`(后端不写 wo_bom);② 临时工单只提交**有子件编码**的行
 * (空行不落库,不报错),行序按提交顺序重排 1..n;③ 数值列统一 Number,空值 → 0。
 *
 * @param {object} form 表单
 * @param {Array} lines 临时工单用料行
 * @param {string} [kind] 常规|临时
 * @returns {object} 请求体
 */
export function buildCreatePayload(form = {}, lines = [], kind = KIND_NORMAL) {
  const f = form || {}
  const temp = kind === KIND_TEMP
  const list = temp
    ? (Array.isArray(lines) ? lines : [])
      .filter((r) => r && str(r.子件编码))
      .map((r, i) => ({
        行序: i + 1,
        子件编码: str(r.子件编码),
        子件名称: str(r.子件名称),
        子件规格: str(r.子件规格),
        计量单位: str(r.计量单位),
        标准用量: num(r.标准用量),
        损耗量: num(r.损耗量),
        行备注: str(r.行备注),
      }))
    : []
  return {
    工单类型: temp ? KIND_TEMP : KIND_NORMAL,
    产品编码: str(f.产品编码),
    客户编码: str(f.客户编码),
    客户名称: str(f.客户名称),
    订单数量: num(f.订单数量),
    生产数量: num(f.生产数量),
    工单日期: str(f.工单日期),
    计划开工日期: str(f.计划开工日期),
    交期: str(f.交期),
    工艺路线: str(f.工艺路线),
    备注: str(f.备注),
    物料清单: list,
  }
}
