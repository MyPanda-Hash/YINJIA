/**
 * dropSpec.js — 规格书「强度」组里跌落类那一行的「检验要求」→ 成型工艺清单 跌落强度块的三个格
 * (纯函数,可 node --test 断言)
 *
 * 用户口径(2026-10-16 实测反馈):
 *   「要根据规格书的检验项目的名字来对成型工艺清单的数据进行一个填写」——
 *   规格书那张纸上 强度 组下的跌落行(实测 SD-2026-10-0010)是:
 *     检验项目 = `强度·（裸棒）`,检验要求 = `成品强度（一切二）：高度60cm，垂直跌落3次，炭棒无断裂`
 *   成型工艺清单 跌落强度块有三格:高度cm / 跌落次数 / 要求 —— 前两格就在这句话里,**照抠**。
 *
 * 三条口径(与 dimensionSpec.js / carbonSpec.js 同款):
 *   ① **原句照旧进「跌落要求」格**:它是纸面「要求」列的原话,不能只留抠出来的两个数;
 *   ② 抠不出来就不写那一格(没有 `高度60cm` ⇒ 高度cm 这个键不出现),绝不写半截值/空串;
 *   ③ 高度只认 `高度`/`跌落高度` 后的数字(cm 单位),次数只认 `跌落 N 次`/`N 次`
 *      —— 别把「垂直跌落3次」里的 3 误当高度(实测句式里两个数挨着,按关键词分别取才不串)。
 */

/** 全角 → 半角(U+FF01..U+FF5E 整体平移 0xFEE0;全角空格单独折成普通空格)—— 与 dimensionSpec 同款 */
function toHalfWidth(s) {
  return String(s ?? '')
    .replace(/[\uFF01-\uFF5E]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ')
}

/**
 * @param {string|null|undefined} text 跌落类检验项目的「检验要求」原句
 * @returns {Record<string,string>} **只含解析成功的格**:
 *   { 跌落要求?: 原句, 跌落高度cm?: '60', 跌落次数?: '3' }
 */
export function parseDropRequirement(text) {
  const out = {}
  const raw = String(text ?? '').trim()
  if (!raw) return out
  out['跌落要求'] = raw
  const s = toHalfWidth(raw).replace(/\s+/g, '')
  // 高度:高度60cm / 跌落高度 1.2m(=120cm) —— 单位不同不给数,交给人工(宁缺毋滥)
  const h = s.match(/高度[:：]?\s*([0-9]+(?:\.[0-9]+)?)\s*(cm|CM|厘米)/)
  if (h) out['跌落高度cm'] = h[1]
  // 次数:垂直跌落3次 / 跌 3 次 / 3次自由跌落(「跌」「落」任一都能当锚,实测两种句式都出现过)
  const n = s.match(/(?:跌落|跌|落)\s*([0-9]+)\s*次/) || s.match(/([0-9]+)\s*次(?:自由)?跌落/)
  if (n) out['跌落次数'] = n[1]
  return out
}
