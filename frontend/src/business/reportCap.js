/**
 * 工序报工「可报上限」纯逻辑(2026-11-13 用户口径,手机端工序报工页)。
 *
 * <p><b>为什么单独抽出来</b>:用户报障「当前这个报工提示不明确」——当时超量提交失败后,页面把后端
 * 一长串原文(嵌套括号:`超出允许上限(本行工序[装箱]上限 1200(本道可加工量 1200,来自上一道已审完工
 * 折成品 1200),允许至 1212;已报 1100,本次 200)`)直接挂到页面顶部横幅,手机上又长又难读。
 * 改为**弹窗**提示,并把"为什么只能报这么多"讲成一句算式:
 *
 * <pre>
 *   本次最多可报 100      ← 主数字(大)
 *   你填了 200,超 100
 *   本道可报 = 上一道「成型」已审完工 1200 − 本道已报 1100 = 100
 *   本道只能报上一道工序真正流下来的量,不能超过它。
 * </pre>
 *
 * <p><b>口径</b>(与后端 `ProcessFlow` 的"按量流转"同源,别在这里另立一套):
 * <ul>
 *   <li>可加工量 = 上一道**已审核报工**折到本道单位(首道 = 排产数量折算);老接口没这个字段 ⇒ 退回计划量;</li>
 *   <li>本次最多可报 = 可加工量 − 本道已报(与后端 `剩余可报` / 页面 `leftOf` 同口径);</li>
 *   <li>首道与后道的差别只在"上一道"存不存在,用于弹窗里换一句人话。</li>
 * </ul>
 *
 * <p>本文件只做纯计算(便于 `node --test`),UI 文案在 `MobileReport.vue` 里用 `tt()` 组装。
 */

/** 数值比较容差:报工数量是 decimal,不让二进制误差判成"超 0.0000001" */
export const CAP_EPS = 1e-4

/** 数值兜底:null/undefined/NaN 一律当 0 */
function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * 计算选中工序的「本次最多可报」以及弹窗需要的全部字段。
 *
 * @param {Array<object>} ops   工序台账(后端 `/px/workReport/context` 的 `工序台账`,按工序顺序)
 * @param {string} opName       选中的工序名(成型/切炭/组装…)
 * @param {number} qty          本次填写的完工数量
 * @returns {null|{op:string, prevOp:string, isFirst:boolean, plan:number, avail:number,
 *   reported:number, max:number, qty:number, over:boolean, overBy:number}}
 *   `null` = 工序不在台账里(调用方自己处理);`max` = 本次最多可报;`over` = 填超了
 */
export function reportCapInfo(ops, opName, qty) {
  const list = Array.isArray(ops) ? ops : []
  const idx = list.findIndex((o) => String((o && o.工序) || '') === String(opName || ''))
  if (idx < 0) return null
  const op = list[idx] || {}
  const plan = num(op.计划数量)
  const reported = num(op.已报工)
  // 可加工量:后端按量流转算出来的"上一道流下来多少(折本道单位)";老接口没有 ⇒ 退回计划量(历史口径)
  const avail = (op.可加工量 === undefined || op.可加工量 === null) ? plan : num(op.可加工量)
  // 本次最多可报 = 可加工量 − 本道已报(与后端 ProcessFlow.剩余可报 / 页面 leftOf 同口径)
  const max = Math.max(avail - reported, 0)
  const q = num(qty)
  return {
    op: String(op.工序 || ''),
    prevOp: idx > 0 ? String((list[idx - 1] && list[idx - 1].工序) || '') : '',
    isFirst: idx <= 0,
    plan,
    avail,
    reported,
    max,
    qty: q,
    over: q > max + CAP_EPS,
    overBy: q > max + CAP_EPS ? q - max : 0,
  }
}

/**
 * 提交失败文案是否属于「超出可报上限」——新老后端文案都认,别只认一种(过渡期两边都可能出现):
 * <ul>
 *   <li>旧:`报工数量超出允许上限(本行工序[装箱]上限 1200(…),允许至 1212;已报 1100,本次 200)`</li>
 *   <li>新:`报工数量超出可报上限:本道最多可报 100,本次 200`</li>
 *   <li>前端提示:`超出本道可报量:100`</li>
 * </ul>
 */
export function isOverCapMessage(text) {
  const s = String(text || '')
  return /超出(允许|可报)上限/.test(s) || /超出本道可报量/.test(s)
}

/**
 * 把后端异常原文压成**一句人话**(非超量类失败的弹窗正文用):
 * 去掉「报工没有提交成功/报工提交失败」前缀、「请稍后重试…」尾巴,只留第一句,过长截断。
 *
 * 例:`报工没有提交成功:审核失败(工单 GD-2026-11-0012 已结案,不能报工)。请稍后重试,…`
 *   → `工单 GD-2026-11-0012 已结案,不能报工`
 */
export function conciseReportError(text, fallback = '') {
  let s = String(text || '').replace(/\s+/g, ' ').trim()
  if (!s) return String(fallback || '')
  s = s.replace(/^报工(没有)?提交(成功)?[:：]?\s*/, '')
  s = s.replace(/^报工提交失败[:：]?\s*/, '')
  s = s.replace(/^(审核|提交审批|保存)失败[:：]?\s*/, '')
  // 去掉"请稍后重试,或直接到…"这类建议(弹窗自己给一句统一的)
  s = s.replace(/[。;；]?\s*请稍后重试.*$/, '')
  // 只留第一句
  const m = s.match(/^[^。;；]*/)
  s = (m ? m[0] : s).trim()
  if (s.length > 60) s = s.slice(0, 60) + '…'
  return s || String(fallback || '')
}
